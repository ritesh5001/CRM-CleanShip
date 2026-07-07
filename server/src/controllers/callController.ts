import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { CallLog, DISPOSITION_TO_LEAD_STATUS, type Disposition } from '../models/CallLog.js';
import { CallRecording } from '../models/CallRecording.js';
import { Lead } from '../models/Lead.js';
import { FollowUp } from '../models/FollowUp.js';
import { getPagination, paginated } from '../utils/pagination.js';
import type { LogCallInput } from '../validators/callValidators.js';
import {
  buildDialTwiml,
  generateVoiceToken,
  isEnabled as twilioEnabled,
  resolveCallerId,
  fetchRecordingMedia,
  getTwilioSettings,
} from '../services/twilioService.js';

/** Normalizes a phone to a dial-able form, keeping a single leading '+'. */
function cleanPhone(raw: string): string {
  const trimmed = raw.trim().replace(/[^\d+]/g, '');
  return trimmed.startsWith('+')
    ? `+${trimmed.slice(1).replace(/\+/g, '')}`
    : trimmed.replace(/\+/g, '');
}

// Maps a call disposition to the per-phone (CALL STATUS / LEAD STATUS) columns so
// that calling a number + picking an outcome updates that number's row in the table.
const DISPOSITION_TO_PHONE_OUTCOME: Record<
  Disposition,
  { callStatus: 'connected' | 'not_connected' | 'incorrect_no'; leadOutcome: 'none' | 'interested' | 'not_interested' }
> = {
  interested: { callStatus: 'connected', leadOutcome: 'interested' },
  converted: { callStatus: 'connected', leadOutcome: 'interested' },
  callback: { callStatus: 'connected', leadOutcome: 'none' },
  not_interested: { callStatus: 'connected', leadOutcome: 'not_interested' },
  dnd: { callStatus: 'connected', leadOutcome: 'not_interested' },
  busy: { callStatus: 'not_connected', leadOutcome: 'none' },
  switched_off: { callStatus: 'not_connected', leadOutcome: 'none' },
  wrong_number: { callStatus: 'incorrect_no', leadOutcome: 'not_interested' },
};

// POST /calls — telecaller records a call update on one of their contacts.
// callStatus 'done'  → logs a CallLog with an outcome (disposition) and may promote to a Lead.
// callStatus 'not_done' → records the attempt only (no CallLog, no outcome).
export const logCall = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as LogCallInput;
  const lead = await Lead.findOne({ _id: body.lead, workspace: req.workspaceId });
  if (!lead) throw ApiError.notFound('Contact not found');

  // Telecallers may only update contacts assigned to them.
  if (req.user!.role === 'telecaller' && String(lead.assignedTo) !== req.user!.id) {
    throw ApiError.forbidden('This contact is not assigned to you');
  }

  let followUp = null;
  const isDone = body.callStatus === 'done';
  const disposition = isDone ? (body.disposition as Disposition) : undefined;
  const slot =
    body.phone === 'phone2' ? lead.phone2Outcome : body.phone === 'phone3' ? lead.phone3Outcome : lead.phone1Outcome;
  const s = slot as { callStatus: string; leadOutcome: string; lastCalledAt?: Date };

  // Always log the call — connected (with a disposition) OR a not-connected attempt —
  // so every call shows up in Recents / call history.
  const callLog = await CallLog.create({
    lead: lead._id,
    telecaller: req.user!.id,
    disposition,
    callStatus: isDone ? DISPOSITION_TO_PHONE_OUTCOME[disposition!].callStatus : 'not_connected',
    notes: body.notes || body.remark,
    durationSec: body.durationSec,
    nextFollowUpAt: body.nextFollowUpAt,
    twilioCallSid: body.twilioCallSid,
    phone: body.phone,
    phoneNumber: body.phoneNumber,
    workspace: req.workspaceId,
  });

  // Attach a Twilio recording if its webhook already landed (see CallRecording).
  if (body.twilioCallSid) {
    const rec = await CallRecording.findOne({ callSid: body.twilioCallSid });
    if (rec) {
      if (rec.recordingUrl) callLog.recordingUrl = rec.recordingUrl;
      if (!body.durationSec && rec.durationSec) callLog.durationSec = rec.durationSec;
      await callLog.save();
    }
  }

  s.lastCalledAt = new Date();

  if (isDone) {
    lead.status = DISPOSITION_TO_LEAD_STATUS[disposition!] as typeof lead.status;
    lead.callStatus = 'done';
    lead.lastOutcome = disposition!;
    // Promote to a Lead when the outcome is a success.
    if (disposition === 'interested' || disposition === 'converted') lead.qualified = true;

    // Reflect the outcome on the dialled number's CALL STATUS / LEAD STATUS columns.
    const mapped = DISPOSITION_TO_PHONE_OUTCOME[disposition!];
    s.callStatus = mapped.callStatus;
    if (mapped.leadOutcome !== 'none') s.leadOutcome = mapped.leadOutcome;

    // Schedule a follow-up if a date was provided.
    if (body.nextFollowUpAt) {
      followUp = await FollowUp.create({
        lead: lead._id,
        telecaller: req.user!.id,
        scheduledAt: body.nextFollowUpAt,
        notes: body.notes || body.remark,
        callLog: callLog._id,
        workspace: req.workspaceId,
      });
    }
  } else {
    // Not done — record the attempt on the dialled number.
    lead.callStatus = 'not_done';
    s.callStatus = 'not_connected';
  }

  lead.lastContactedAt = new Date();
  lead.nextFollowUpAt = body.nextFollowUpAt ?? lead.nextFollowUpAt;

  // Append the remark to the shared timeline, tagged with the number that was dialled.
  if (body.remark) {
    lead.remarks.push({
      text: body.remark,
      by: req.user!.id,
      byName: req.user!.name,
      byRole: req.user!.role,
      phone: body.phone,
      createdAt: new Date(),
    });
  }

  await lead.save();

  res.status(201).json({ success: true, callLog, followUp, lead });
});

// GET /calls?lead=  — call history; telecallers scoped to their own logs.
export const listCalls = asyncHandler(async (req: Request, res: Response) => {
  const pg = getPagination(req.query);
  const filter: Record<string, unknown> = { workspace: req.workspaceId };

  if (req.user!.role === 'telecaller') {
    filter.telecaller = req.user!.id;
  } else if (typeof req.query.telecaller === 'string' && req.query.telecaller) {
    filter.telecaller = req.query.telecaller;
  }
  if (typeof req.query.lead === 'string' && req.query.lead) filter.lead = req.query.lead;

  const [calls, total] = await Promise.all([
    CallLog.find(filter)
      .populate('lead', 'name phone')
      .populate('telecaller', 'name')
      .sort({ createdAt: -1 })
      .skip(pg.skip)
      .limit(pg.limit),
    CallLog.countDocuments(filter),
  ]);

  res.json({ success: true, ...paginated(calls, total, pg) });
});

// GET /calls/:id/recording — streams a call's recording audio, proxied + authed
// against Twilio. Telecallers can only access their own calls.
export const streamRecording = asyncHandler(async (req: Request, res: Response) => {
  const call = await CallLog.findOne({ _id: req.params.id, workspace: req.workspaceId });
  if (!call) throw ApiError.notFound('Call not found');
  if (req.user!.role === 'telecaller' && String(call.telecaller) !== req.user!.id) {
    throw ApiError.forbidden('This call is not yours');
  }
  if (!call.recordingUrl) throw ApiError.notFound('No recording for this call');

  const media = await fetchRecordingMedia(call.recordingUrl);
  if (!media) throw ApiError.serviceUnavailable('Could not fetch the recording');

  res.setHeader('Content-Type', media.contentType);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.send(media.buffer);
});

// GET /calls/config — tells the client whether in-app (Twilio) calling is
// available *for this user*. A telecaller needs a Twilio number assigned by the
// admin; a superadmin falls back to the default caller ID.
export const getCallConfig = asyncHandler(async (req: Request, res: Response) => {
  const enabled = (await twilioEnabled()) && Boolean(await resolveCallerId(req.user!.id));
  const settings = await getTwilioSettings();
  res.json({ success: true, enabled, defaultCountryCode: settings?.defaultCountryCode ?? '' });
});

// GET /calls/token — mints a short-lived Twilio Voice access token for the
// authenticated user's browser softphone (only if they have a caller ID).
export const getVoiceToken = asyncHandler(async (req: Request, res: Response) => {
  if (!(await twilioEnabled())) throw ApiError.serviceUnavailable('Calling is not configured');
  if (!(await resolveCallerId(req.user!.id))) {
    throw ApiError.forbidden('No calling number is assigned to you. Ask an admin to assign one.');
  }
  const { token, identity } = await generateVoiceToken(req.user!.id);
  res.json({ success: true, token, identity });
});

// POST /calls/voice — Twilio fetches this when the browser places a call. Returns
// TwiML that dials the lead from the *calling telecaller's* assigned number and
// records the call. The caller's identity rides in `From` (`client:<userId>`),
// baked into the signed access token, so the caller ID is server-authoritative.
// Public endpoint, protected by Twilio signature verification (see callRoutes).
export const handleVoice = asyncHandler(async (req: Request, res: Response) => {
  res.type('text/xml');
  const to = cleanPhone(typeof req.body.To === 'string' ? req.body.To : '');
  if (!/^\+?\d{6,15}$/.test(to)) {
    res.send('<Response><Say>Sorry, the number is invalid.</Say></Response>');
    return;
  }
  const callerUserId = (typeof req.body.From === 'string' ? req.body.From : '').replace(/^client:/, '');
  const callerId = callerUserId ? await resolveCallerId(callerUserId) : '';
  if (!callerId) {
    res.send('<Response><Say>No calling number is assigned to your account.</Say></Response>');
    return;
  }
  res.send(await buildDialTwiml(to, callerId));
});

// POST /calls/recording — Twilio posts the recording details when ready. Stages
// them in CallRecording (keyed by CallSid) and patches any existing CallLog.
// Public endpoint, protected by Twilio signature verification (see callRoutes).
export const handleRecording = asyncHandler(async (req: Request, res: Response) => {
  const callSid = typeof req.body.CallSid === 'string' ? req.body.CallSid : '';
  const recordingUrl = typeof req.body.RecordingUrl === 'string' ? req.body.RecordingUrl : undefined;
  const durationSec = req.body.RecordingDuration ? Number(req.body.RecordingDuration) : undefined;

  if (callSid && recordingUrl) {
    await CallRecording.updateOne(
      { callSid },
      { $set: { recordingUrl, ...(durationSec ? { durationSec } : {}) } },
      { upsert: true }
    );
    // If the disposition was already submitted, patch its CallLog too.
    await CallLog.updateOne({ twilioCallSid: callSid }, { $set: { recordingUrl } });
  }
  res.json({ success: true });
});

// POST /calls/dial-status — Twilio's <Dial> action callback. Records WHY the call
// ended (completed/busy/no-answer/failed/canceled) so the client can show a reason.
// Public, Twilio-signature protected. Returns empty TwiML to end the parent call.
export const handleDialStatus = asyncHandler(async (req: Request, res: Response) => {
  const callSid = typeof req.body.CallSid === 'string' ? req.body.CallSid : '';
  const dialStatus = typeof req.body.DialCallStatus === 'string' ? req.body.DialCallStatus : undefined;
  const durationSec = req.body.DialCallDuration ? Number(req.body.DialCallDuration) : undefined;

  if (callSid && dialStatus) {
    await CallRecording.updateOne(
      { callSid },
      { $set: { dialStatus, ...(durationSec ? { durationSec } : {}) } },
      { upsert: true }
    );
  }
  res.type('text/xml').send('<Response></Response>');
});

// GET /calls/dial-status/:callSid — lets the client poll the dial result after hangup.
export const getDialStatus = asyncHandler(async (req: Request, res: Response) => {
  const rec = await CallRecording.findOne({ callSid: req.params.callSid });
  res.json({ success: true, dialStatus: rec?.dialStatus ?? null });
});

// POST /calls/status — optional call status callback; stores authoritative
// duration/status keyed by CallSid. Public, Twilio-signature protected.
export const handleStatus = asyncHandler(async (req: Request, res: Response) => {
  const callSid = typeof req.body.CallSid === 'string' ? req.body.CallSid : '';
  const status = typeof req.body.CallStatus === 'string' ? req.body.CallStatus : undefined;
  const durationSec = req.body.CallDuration ? Number(req.body.CallDuration) : undefined;

  if (callSid) {
    await CallRecording.updateOne(
      { callSid },
      { $set: { ...(status ? { status } : {}), ...(durationSec ? { durationSec } : {}) } },
      { upsert: true }
    );
  }
  res.json({ success: true });
});
