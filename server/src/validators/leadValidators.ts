import { z } from 'zod';
import { LEAD_STATUSES, LEAD_PRIORITIES } from '../models/Lead.js';

export const createLeadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone is required'),
  altPhone: z.string().optional().default(''),
  email: z.string().email().optional().or(z.literal('')).default(''),
  company: z.string().optional().default(''),
  city: z.string().optional().default(''),
  source: z.string().optional().default('manual'),
  tags: z.array(z.string()).optional().default([]),
  priority: z.enum(LEAD_PRIORITIES).optional().default('medium'),
  notes: z.string().optional().default(''),
  assignedTo: z.string().optional(),
});

export const updateLeadSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  altPhone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  company: z.string().optional(),
  city: z.string().optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
  priority: z.enum(LEAD_PRIORITIES).optional(),
  status: z.enum(LEAD_STATUSES as [string, ...string[]]).optional(),
  notes: z.string().optional(),
});

export const assignLeadSchema = z.object({
  assignedTo: z.string().min(1, 'assignedTo is required'),
});

export const bulkAssignSchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1, 'Select at least one lead'),
  assignedTo: z.string().min(1, 'assignedTo is required'),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
