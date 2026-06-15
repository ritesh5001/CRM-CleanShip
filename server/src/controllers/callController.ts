import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { CallLog, DISPOSITION_TO_LEAD_STATUS, type Disposition } from '../models/CallLog.js';
import { Lead } from '../models/Lead.js';
import { FollowUp } from '../models/FollowUp.js';
import { getPagination, paginated } from '../utils/pagination.js';
import type { LogCallInput } from '../validators/callValidators.js';

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
    });

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
