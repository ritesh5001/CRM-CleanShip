import { z } from 'zod';
import { TASK_TYPES, TASK_STATUSES, TASK_PRIORITIES } from '../models/Task.js';

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().default(''),
  type: z.enum(TASK_TYPES).optional().default('custom'),
  relatedLead: z.string().optional(),
  assignedTo: z.string().min(1, 'assignedTo is required'),
  dueDate: z.coerce.date().optional(),
  priority: z.enum(TASK_PRIORITIES).optional().default('medium'),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  type: z.enum(TASK_TYPES).optional(),
  relatedLead: z.string().optional(),
  assignedTo: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
});

export const updateTaskStatusSchema = z.object({
  status: z.enum(TASK_STATUSES),
});
