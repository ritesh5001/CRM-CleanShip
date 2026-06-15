import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { CallLog, DISPOSITION_TO_LEAD_STATUS, type Disposition } from '../models/CallLog.js';
import { Lead } from '../models/Lead.js';
import { FollowUp } from '../models/FollowUp.js';
import { getPagination, paginated } from '../utils/pagination.js';
import type { LogCallInput } from '../validators/callValidators.js';

// POST /calls — telecaller logs a call disposition for one of their leads.
export const logCall = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as LogCallInput;
  const lead = await Lead.findById(body.lead);
  if (!lead) throw ApiError.notFound('Lead not found');

  // Telecallers may only log calls for leads assigned to them.
  if (req.user!.role === 'telecaller' && String(lead.assignedTo) !== req.user!.id) {
    throw ApiError.forbidden('This lead is not assigned to you');
  }

  const callLog = await CallLog.create({
    lead: lead._id,
    telecaller: req.user!.id,
    disposition: body.disposition,
    notes: body.notes,
    durationSec: body.durationSec,
    nextFollowUpAt: body.nextFollowUpAt,
  });

  // Update the lead's status & last-contacted timestamp.
  lead.status = DISPOSITION_TO_LEAD_STATUS[body.disposition as Disposition] as typeof lead.status;
  lead.lastContactedAt = new Date();
  lead.nextFollowUpAt = body.nextFollowUpAt ?? undefined;
  await lead.save();

  // Schedule a follow-up if a date was provided.
  let followUp = null;
  if (body.nextFollowUpAt) {
    followUp = await FollowUp.create({
      lead: lead._id,
      telecaller: req.user!.id,
      scheduledAt: body.nextFollowUpAt,
      notes: body.notes,
      callLog: callLog._id,
    });
  }

  res.status(201).json({ success: true, callLog, followUp });
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
