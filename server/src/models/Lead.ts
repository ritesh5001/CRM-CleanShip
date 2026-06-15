import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

export type LeadStatus =
  | 'new'
  | 'assigned'
  | 'in_progress'
  | 'interested'
  | 'callback'
  | 'not_interested'
  | 'converted'
  | 'dnd';

export const LEAD_STATUSES: LeadStatus[] = [
  'new',
  'assigned',
  'in_progress',
  'interested',
  'callback',
  'not_interested',
  'converted',
  'dnd',
];

export const LEAD_PRIORITIES = ['low', 'medium', 'high'] as const;
export const CALL_STATUSES = ['pending', 'done', 'not_done'] as const;

const remarkSchema = new Schema(
  {
    text: { type: String, required: true, trim: true },
    by: { type: Types.ObjectId, ref: 'User' },
    byName: { type: String, default: '' },
    byRole: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const leadSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    altPhone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    title: { type: String, trim: true, default: '' },
    company: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, default: '' },
    source: { type: String, trim: true, default: 'manual' },
    tags: { type: [String], default: [] },
    status: { type: String, enum: LEAD_STATUSES, default: 'new', index: true },
    priority: { type: String, enum: LEAD_PRIORITIES, default: 'medium' },
    qualified: { type: Boolean, default: false, index: true },
    callStatus: { type: String, enum: CALL_STATUSES, default: 'pending', index: true },
    lastOutcome: { type: String, default: '' },
    remarks: { type: [remarkSchema], default: [] },
    assignedTo: { type: Types.ObjectId, ref: 'User', index: true },
    assignedAt: { type: Date },
    lastContactedAt: { type: Date },
    nextFollowUpAt: { type: Date },
    notes: { type: String, default: '' },
    createdBy: { type: Types.ObjectId, ref: 'User' },
    importBatch: { type: Types.ObjectId, ref: 'ImportBatch' },
  },
  { timestamps: true }
);

leadSchema.index({ name: 'text', phone: 'text', email: 'text', company: 'text' });

leadSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret.__v;
    return ret;
  },
});

export type LeadAttrs = InferSchemaType<typeof leadSchema>;
export type LeadDoc = HydratedDocument<LeadAttrs>;

export const Lead = model('Lead', leadSchema);
