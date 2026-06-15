import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { Lead } from '../models/Lead.js';
import { User } from '../models/User.js';
import { getPagination, paginated } from '../utils/pagination.js';
import { importLeads } from '../services/importService.js';
import { notify } from '../services/notificationService.js';
import { idOf } from '../utils/idOf.js';

function buildFilter(req: Request): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  // Telecallers only ever see their own leads.
  if (req.user!.role === 'telecaller') {
    filter.assignedTo = req.user!.id;
  } else if (typeof req.query.assignedTo === 'string' && req.query.assignedTo) {
    filter.assignedTo = req.query.assignedTo === 'unassigned' ? null : req.query.assignedTo;
  }

  if (typeof req.query.status === 'string' && req.query.status) filter.status = req.query.status;
  if (typeof req.query.priority === 'string' && req.query.priority) filter.priority = req.query.priority;
  if (typeof req.query.callStatus === 'string' && req.query.callStatus) filter.callStatus = req.query.callStatus;
  // Leads tab passes qualified=true; Contacts tab omits it (shows everything).
  if (req.query.qualified === 'true') filter.qualified = true;
  else if (req.query.qualified === 'false') filter.qualified = false;

  if (typeof req.query.search === 'string' && req.query.search.trim()) {
    const rx = new RegExp(req.query.search.trim(), 'i');
    filter.$or = [{ name: rx }, { phone: rx }, { email: rx }, { company: rx }];
  }
  return filter;
}

export const listLeads = asyncHandler(async (req: Request, res: Response) => {
  const pg = getPagination(req.query);
  const filter = buildFilter(req);

  const [leads, total] = await Promise.all([
    Lead.find(filter)
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 })
      .skip(pg.skip)
      .limit(pg.limit),
    Lead.countDocuments(filter),
  ]);

  res.json({ success: true, ...paginated(leads, total, pg) });
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
