import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const NOTIFICATION_TYPES = [
  'lead_assigned',
  'task_assigned',
  'task_updated',
  'followup_due',
  'system',
] as const;

const notificationSchema = new Schema(
  {
    recipient: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, default: 'system' },
    title: { type: String, required: true },
    message: { type: String, default: '' },
    link: { type: String, default: '' },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

notificationSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret.__v;
    return ret;
  },
});

export type NotificationAttrs = InferSchemaType<typeof notificationSchema>;
export type NotificationDoc = HydratedDocument<NotificationAttrs>;

export const Notification = model('Notification', notificationSchema);
