import { z } from 'zod';

// All fields optional so the admin form can send partial updates. Secret fields
// (authToken, apiKeySecret) left blank mean "keep the existing value".
export const updateTwilioSchema = z.object({
  enabled: z.boolean().optional(),
  accountSid: z.string().trim().optional(),
  authToken: z.string().trim().optional(),
  apiKeySid: z.string().trim().optional(),
  apiKeySecret: z.string().trim().optional(),
  twimlAppSid: z.string().trim().optional(),
  callerId: z.string().trim().optional(),
  recordCalls: z.boolean().optional(),
  publicServerUrl: z.string().trim().optional(),
  defaultCountryCode: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\+\d{1,4}$/.test(v), 'Use a country code like +91 or +1')
    .optional(),
});

export type UpdateTwilioInput = z.infer<typeof updateTwilioSchema>;
