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
} from '../services/twilioService.js';

/** Normalizes a phone to a dial-able form, keeping a single leading '+'. */
function cleanPhone(raw: string): string {
  const trimmed = raw.trim().replace(/[^\d+]/g, '');
  return trimmed.startsWith('+')
    ? `+${trimmed.slice(1).replace(/\+/g, '')}`
    : trimmed.replace(/\+/g, '');
}

// POST /calls — telecaller records a call update on one of their contacts.
// callStatus 'done'  → logs a CallLog with an outcome (disposition) and may promote to a Lead.
// callStatus 'not_done' → records the attempt only (no CallLog, no outcome).
export const logCall = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as LogCallInput;
  const lead = await Lead.findById(body.lead);
  if (!lead) throw ApiError.notFound('Contact not found');

  // Telecallers may only update contacts assigned to them.
  if (req.user!.role === 'telecaller' && String(lead.assignedTo) !== req.user!.id) {
    throw ApiError.forbidden('This contact is not assigned to you');
  }

  let callLog = null;
  let followUp = null;

  if (body.callStatus === 'done') {
    const disposition = body.disposition as Disposition;

    callLog = await CallLog.create({
      lead: lead._id,
      telecaller: req.user!.id,
      disposition,
      notes: body.notes || body.remark,
      durationSec: body.durationSec,
      nextFollowUpAt: body.nextFollowUpAt,
      twilioCallSid: body.twilioCallSid,
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

    lead.status = DISPOSITION_TO_LEAD_STATUS[disposition] as typeof lead.status;
    lead.callStatus = 'done';
    lead.lastOutcome = disposition;
    // Promote to a Lead when the outcome is a success.
    if (disposition === 'interested' || disposition === 'converted') lead.qualified = true;

    // Schedule a follow-up if a date was provided.
    if (body.nextFollowUpAt) {
      followUp = await FollowUp.create({
        lead: lead._id,
        telecaller: req.user!.id,
        scheduledAt: body.nextFollowUpAt,
        notes: body.notes || body.remark,
        callLog: callLog._id,
      });
    }
  } else {
    // Not done — record the attempt only.
    lead.callStatus = 'not_done';
  }

  lead.lastContactedAt = new Date();
  lead.nextFollowUpAt = body.nextFollowUpAt ?? lead.nextFollowUpAt;

  // Append the remark to the shared timeline.
  if (body.remark) {
    lead.remarks.push({
      text: body.remark,
      by: req.user!.id,
      byName: req.user!.name,
      byRole: req.user!.role,
      createdAt: new Date(),
    });
  }

  await lead.save();

  res.status(201).json({ success: true, callLog, followUp, lead });
});

// GET /calls?lead=  — call history; telecallers scoped to their own logs.
export const listCalls = asyncHandler(async (req: Request, res: Response) => {
  const pg = getPagination(req.query);
  const filter: Record<string, unknown> = {};

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
  const call = await CallLog.findById(req.params.id);
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
  res.json({ success: true, enabled });
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
