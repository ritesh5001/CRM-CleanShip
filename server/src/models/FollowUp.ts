import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const FOLLOWUP_STATUSES = ['pending', 'done', 'missed'] as const;

const followUpSchema = new Schema(
  {
    lead: { type: Types.ObjectId, ref: 'Lead', required: true, index: true },
    telecaller: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    scheduledAt: { type: Date, required: true, index: true },
    status: { type: String, enum: FOLLOWUP_STATUSES, default: 'pending', index: true },
    notes: { type: String, default: '' },
    callLog: { type: Types.ObjectId, ref: 'CallLog' },
  },
  { timestamps: true }
);

followUpSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret.__v;
    return ret;
  },
});

export type FollowUpAttrs = InferSchemaType<typeof followUpSchema>;
export type FollowUpDoc = HydratedDocument<FollowUpAttrs>;

export const FollowUp = model('FollowUp', followUpSchema);
