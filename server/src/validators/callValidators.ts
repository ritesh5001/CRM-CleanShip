import { z } from 'zod';
import { DISPOSITIONS } from '../models/CallLog.js';

export const logCallSchema = z.object({
  lead: z.string().min(1, 'lead is required'),
  disposition: z.enum(DISPOSITIONS as [string, ...string[]]),
  notes: z.string().optional().default(''),
  durationSec: z.number().int().min(0).optional().default(0),
  nextFollowUpAt: z.coerce.date().optional(),
});

export type LogCallInput = z.infer<typeof logCallSchema>;
