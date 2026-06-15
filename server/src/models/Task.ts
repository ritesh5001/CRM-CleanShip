import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const TASK_TYPES = ['call', 'follow_up', 'custom'] as const;
export const TASK_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'] as const;
export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;

const taskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    type: { type: String, enum: TASK_TYPES, default: 'custom' },
    relatedLead: { type: Types.ObjectId, ref: 'Lead' },
    assignedTo: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    assignedBy: { type: Types.ObjectId, ref: 'User', required: true },
    dueDate: { type: Date },
    priority: { type: String, enum: TASK_PRIORITIES, default: 'medium' },
    status: { type: String, enum: TASK_STATUSES, default: 'pending', index: true },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

taskSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret.__v;
    return ret;
  },
});

export type TaskAttrs = InferSchemaType<typeof taskSchema>;
export type TaskDoc = HydratedDocument<TaskAttrs>;

export const Task = model('Task', taskSchema);
