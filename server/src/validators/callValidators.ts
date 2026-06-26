import { z } from 'zod';
import { DISPOSITIONS } from '../models/CallLog.js';

export const logCallSchema = z
  .object({
    lead: z.string().min(1, 'lead is required'),
    callStatus: z.enum(['done', 'not_done']).optional().default('done'),
    disposition: z.enum(DISPOSITIONS as [string, ...string[]]).optional(),
    notes: z.string().optional().default(''),
    remark: z.string().optional().default(''),
    durationSec: z.number().int().min(0).optional().default(0),
    nextFollowUpAt: z.coerce.date().optional(),
    twilioCallSid: z.string().optional(),
    phone: z.enum(['phone1', 'phone2', 'phone3']).optional().default('phone1'),
    phoneNumber: z.string().optional().default(''),
  })
  .refine((d) => d.callStatus !== 'done' || !!d.disposition, {
    message: 'An outcome (disposition) is required when the call is marked done',
    path: ['disposition'],
  });

export type LogCallInput = z.infer<typeof logCallSchema>;
