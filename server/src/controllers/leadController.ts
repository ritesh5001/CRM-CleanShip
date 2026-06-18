import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { Lead, deriveCallStatus, deriveLeadStatus } from '../models/Lead.js';
import type { PhoneCallStatus, PhoneLeadOutcome } from '../models/Lead.js';
import { User } from '../models/User.js';
import { FollowUp } from '../models/FollowUp.js';
import { getPagination, paginated } from '../utils/pagination.js';
import { importLeads } from '../services/importService.js';
import { notify } from '../services/notificationService.js';
import { idOf } from '../utils/idOf.js';
import type { PhoneOutcomeInput } from '../validators/leadValidators.js';

// Builds the Mongo filter from query params. `includeCallStatus=false` is used by
// the stats endpoint so chip counts reflect every callStatus within the same scope.
function buildFilter(req: Request, includeCallStatus = true): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  // Telecallers only ever see their own leads.
  if (req.user!.role === 'telecaller') {
    filter.assignedTo = req.user!.id;
  } else if (typeof req.query.assignedTo === 'string' && req.query.assignedTo) {
    filter.assignedTo = req.query.assignedTo === 'unassigned' ? null : req.query.assignedTo;
  }

  if (typeof req.query.status === 'string' && req.query.status) filter.status = req.query.status;
  if (typeof req.query.priority === 'string' && req.query.priority) filter.priority = req.query.priority;
  if (includeCallStatus && typeof req.query.callStatus === 'string' && req.query.callStatus)
    filter.callStatus = req.query.callStatus;
  // Leads tab passes qualified=true; Contacts tab omits it (shows everything).
  if (req.query.qualified === 'true') filter.qualified = true;
  else if (req.query.qualified === 'false') filter.qualified = false;

  if (typeof req.query.search === 'string' && req.query.search.trim()) {
    const rx = new RegExp(req.query.search.trim(), 'i');
    filter.$or = [{ name: rx }, { phone: rx }, { email: rx }, { company: rx }];
  }
  return filter;
}

const SORTABLE = new Set([
  'name',
  'company',
  'city',
  'country',
  'status',
  'callStatus',
  'lastContactedAt',
  'assignedAt',
  'createdAt',
  'qualified',
]);

function buildSort(req: Request): Record<string, 1 | -1> {
  const by = typeof req.query.sortBy === 'string' && SORTABLE.has(req.query.sortBy) ? req.query.sortBy : 'createdAt';
  const order: 1 | -1 = req.query.order === 'asc' ? 1 : -1;
  return { [by]: order };
}

export const listLeads = asyncHandler(async (req: Request, res: Response) => {
  const pg = getPagination(req.query);
  const filter = buildFilter(req);

  const [leads, total] = await Promise.all([
    Lead.find(filter)
      .populate('assignedTo', 'name email')
      .collation({ locale: 'en', strength: 2 }) // case-insensitive sort for name/company
      .sort(buildSort(req))
      .skip(pg.skip)
      .limit(pg.limit),
    Lead.countDocuments(filter),
  ]);

  res.json({ success: true, ...paginated(leads, total, pg) });
});

// GET /leads/stats — counts for the clickable stat chips (scope minus callStatus).
export const getLeadStats = asyncHandler(async (req: Request, res: Response) => {
  const base = buildFilter(req, false);
  const [total, notCalled, done, notDone, leads] = await Promise.all([
    Lead.countDocuments(base),
    Lead.countDocuments({ ...base, callStatus: 'pending' }),
    Lead.countDocuments({ ...base, callStatus: 'done' }),
    Lead.countDocuments({ ...base, callStatus: 'not_done' }),
    Lead.countDocuments({ ...base, qualified: true }),
  ]);
  res.json({ success: true, stats: { total, notCalled, done, notDone, leads } });
});

// GET /leads/export — all matching rows (capped) for client-side CSV.
export const exportLeads = asyncHandler(async (req: Request, res: Response) => {
  const filter = buildFilter(req);
  const leads = await Lead.find(filter)
    .populate('assignedTo', 'name')
    .collation({ locale: 'en', strength: 2 })
    .sort(buildSort(req))
    .limit(10000)
    .lean();
  res.json({ success: true, data: leads });
});

export const getLead = asyncHandler(async (req: Request, res: Response) => {
  const lead = await Lead.findById(req.params.id).populate('assignedTo', 'name email');
  if (!lead) throw ApiError.notFound('Lead not found');
  if (req.user!.role === 'telecaller' && idOf(lead.assignedTo) !== req.user!.id) {
    throw ApiError.forbidden('This lead is not assigned to you');
  }
  res.json({ success: true, lead });
});

export const createLead = asyncHandler(async (req: Request, res: Response) => {
  const body = { ...req.body };
  if (body.assignedTo) {
    body.status = 'assigned';
    body.assignedAt = new Date();
  }
  const lead = await Lead.create({ ...body, createdBy: req.user!.id });

  if (lead.assignedTo) {
    await notify({
      recipient: String(lead.assignedTo),
      type: 'lead_assigned',
      title: 'New lead assigned',
      message: `${lead.name} (${lead.phone})`,
      link: `/leads/${lead._id}`,
    });
  }
  res.status(201).json({ success: true, lead });
});

export const updateLead = asyncHandler(async (req: Request, res: Response) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw ApiError.notFound('Lead not found');
  if (req.user!.role === 'telecaller' && String(lead.assignedTo) !== req.user!.id) {
    throw ApiError.forbidden('This lead is not assigned to you');
  }
  Object.assign(lead, req.body);
  await lead.save();
  res.json({ success: true, lead });
});

export const deleteLead = asyncHandler(async (req: Request, res: Response) => {
  const lead = await Lead.findByIdAndDelete(req.params.id);
  if (!lead) throw ApiError.notFound('Lead not found');
  res.json({ success: true, message: 'Lead deleted' });
});

// POST /leads/:id/followup — schedule a follow-up inline (no CallLog logged).
export const scheduleFollowUp = asyncHandler(async (req: Request, res: Response) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw ApiError.notFound('Contact not found');

  // Telecallers may only schedule follow-ups on contacts assigned to them.
  if (req.user!.role === 'telecaller' && idOf(lead.assignedTo) !== req.user!.id) {
    throw ApiError.forbidden('This contact is not assigned to you');
  }

  // The follow-up belongs to whoever the contact is assigned to (fallback: actor).
  const telecaller = idOf(lead.assignedTo) || req.user!.id;

  const followUp = await FollowUp.create({
    lead: lead._id,
    telecaller,
    scheduledAt: req.body.scheduledAt,
    notes: req.body.notes,
  });

  lead.nextFollowUpAt = req.body.scheduledAt;
  await lead.save();

  // If an admin scheduled it, notify the assigned telecaller.
  if (req.user!.role === 'superadmin' && telecaller && telecaller !== req.user!.id) {
    await notify({
      recipient: telecaller,
      type: 'followup_due',
      title: `Follow-up scheduled: ${lead.name}`,
      message: `Scheduled for ${new Date(req.body.scheduledAt).toLocaleString()}`,
      link: '/followups',
    });
  }

  res.status(201).json({ success: true, followUp, lead });
});

// POST /leads/:id/remarks — both roles add to the shared remark timeline.
export const addRemark = asyncHandler(async (req: Request, res: Response) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw ApiError.notFound('Contact not found');

  // Telecallers may only remark on contacts assigned to them.
  if (req.user!.role === 'telecaller' && idOf(lead.assignedTo) !== req.user!.id) {
    throw ApiError.forbidden('This contact is not assigned to you');
  }

  lead.remarks.push({
    text: req.body.text,
    by: req.user!.id,
    byName: req.user!.name,
    byRole: req.user!.role,
    createdAt: new Date(),
  });
  await lead.save();

  // Notify the counterparty: superadmin → assigned telecaller; telecaller → contact creator.
  const recipient =
    req.user!.role === 'superadmin' ? idOf(lead.assignedTo) : idOf(lead.createdBy);
  if (recipient && recipient !== req.user!.id) {
    await notify({
      recipient,
      type: 'system',
      title: `New remark on ${lead.name}`,
      message: req.body.text,
      link: `/contacts`,
    });
  }

  res.status(201).json({ success: true, lead });
});

async function assertTelecaller(id: string) {
  const u = await User.findOne({ _id: id, role: 'telecaller', isActive: true });
  if (!u) throw ApiError.badRequest('Invalid or inactive telecaller');
  return u;
}

export const assignLead = asyncHandler(async (req: Request, res: Response) => {
  await assertTelecaller(req.body.assignedTo);
  const lead = await Lead.findByIdAndUpdate(
    req.params.id,
    { $set: { assignedTo: req.body.assignedTo, assignedAt: new Date(), status: 'assigned' } },
    { new: true }
  );
  if (!lead) throw ApiError.notFound('Lead not found');

  await notify({
    recipient: req.body.assignedTo,
    type: 'lead_assigned',
    title: 'New lead assigned',
    message: `${lead.name} (${lead.phone})`,
    link: `/leads/${lead._id}`,
  });
  res.json({ success: true, lead });
});

export const bulkAssignLeads = asyncHandler(async (req: Request, res: Response) => {
  const { leadIds, assignedTo } = req.body as { leadIds: string[]; assignedTo: string };
  await assertTelecaller(assignedTo);

  const result = await Lead.updateMany(
    { _id: { $in: leadIds } },
    { $set: { assignedTo, assignedAt: new Date(), status: 'assigned' } }
  );

  await notify({
    recipient: assignedTo,
    type: 'lead_assigned',
    title: `${result.modifiedCount} leads assigned`,
    message: 'New leads have been assigned to you',
    link: '/leads',
  });

  res.json({ success: true, modified: result.modifiedCount });
});

export const importLeadsHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded (field name must be "file")');
  const assignedTo = typeof req.body.assignedTo === 'string' && req.body.assignedTo ? req.body.assignedTo : undefined;
  if (assignedTo) await assertTelecaller(assignedTo);

  const result = await importLeads(req.file.buffer, req.file.originalname, req.user!.id, assignedTo);

  if (assignedTo && result.successCount > 0) {
    await notify({
      recipient: assignedTo,
      type: 'lead_assigned',
      title: `${result.successCount} leads assigned`,
      message: 'Imported leads have been assigned to you',
      link: '/leads',
    });
  }
  res.status(201).json({ success: true, result });
});

export const updatePhoneOutcome = asyncHandler(async (req: Request, res: Response) => {
  const { phone, callStatus, leadOutcome, remark } = req.body as PhoneOutcomeInput;

  const lead = await Lead.findById(req.params.id);
  if (!lead) throw ApiError.notFound('Contact not found');

  if (req.user!.role === 'telecaller' && idOf(lead.assignedTo) !== req.user!.id) {
    throw ApiError.forbidden('This contact is not assigned to you');
  }

  const slot = phone === 'phone1' ? lead.phone1Outcome : lead.phone2Outcome;

  if (callStatus) {
    (slot as { callStatus: PhoneCallStatus }).callStatus = callStatus;
    if (callStatus === 'connected') {
      lead.lastContactedAt = new Date();
      // Default a follow-up to 2 weeks out when a call connects and none is set yet.
      if (!lead.nextFollowUpAt) {
        const followUpAt = new Date();
        followUpAt.setDate(followUpAt.getDate() + 14);
        lead.nextFollowUpAt = followUpAt;
        const telecaller = idOf(lead.assignedTo) || req.user!.id;
        await FollowUp.create({
          lead: lead._id,
          telecaller,
          scheduledAt: followUpAt,
          notes: 'Auto-scheduled 2 weeks after connected call',
        });
      }
    }
  }
  if (leadOutcome) {
    (slot as { leadOutcome: PhoneLeadOutcome }).leadOutcome = leadOutcome;
    if (leadOutcome !== 'none') lead.lastOutcome = leadOutcome;
  }

  lead.callStatus = deriveCallStatus(
    (lead.phone1Outcome as { callStatus: PhoneCallStatus }).callStatus,
    (lead.phone2Outcome as { callStatus: PhoneCallStatus }).callStatus
  );

  const derived = deriveLeadStatus(
    (lead.phone1Outcome as { leadOutcome: PhoneLeadOutcome }).leadOutcome,
    (lead.phone2Outcome as { leadOutcome: PhoneLeadOutcome }).leadOutcome
  );
  if (derived !== null) {
    lead.status = derived.status;
    lead.qualified = derived.qualified;
  }

  if (remark?.trim()) {
    lead.remarks.push({
      text: remark.trim(),
      by: req.user!.id as unknown as typeof lead.remarks[0]['by'],
      byName: req.user!.name ?? '',
      byRole: req.user!.role,
      createdAt: new Date(),
      phone,
    } as typeof lead.remarks[0]);
  }

  await lead.save();
  res.json({ success: true, lead });
});
