import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { env } from '../config/env.js';
import { Integration, type IntegrationDoc } from '../models/Integration.js';
import { TWILIO_KEY, listNumbers } from '../services/twilioService.js';
import type { UpdateTwilioInput } from '../validators/integrationValidators.js';

// Fields the admin form sends that are kept secret: blanks mean "leave unchanged",
// and we never echo their values back to the client.
const SECRET_FIELDS = ['authToken', 'apiKeySecret'] as const;

/** Client-safe view of the Twilio settings — secrets reduced to a "set" flag. */
function sanitizeTwilio(doc: IntegrationDoc | null) {
  const base = (doc?.publicServerUrl || env.publicUrl || '').replace(/\/$/, '');
  const hasAllCreds = Boolean(
    doc?.accountSid && doc?.apiKeySid && doc?.apiKeySecret && doc?.twimlAppSid && doc?.callerId
  );
  return {
    enabled: doc?.enabled ?? false,
    configured: hasAllCreds,
    accountSid: doc?.accountSid ?? '',
    apiKeySid: doc?.apiKeySid ?? '',
    twimlAppSid: doc?.twimlAppSid ?? '',
    callerId: doc?.callerId ?? '',
    recordCalls: doc?.recordCalls ?? true,
    publicServerUrl: doc?.publicServerUrl ?? '',
    authTokenSet: Boolean(doc?.authToken),
    apiKeySecretSet: Boolean(doc?.apiKeySecret),
    // Handy for the admin: the URL to paste into the Twilio TwiML App's Voice config.
    voiceWebhookUrl: base ? `${base}/api/v1/calls/voice` : '',
  };
}

// GET /integrations/twilio (superadmin) — current Twilio settings, secrets masked.
export const getTwilioIntegration = asyncHandler(async (_req: Request, res: Response) => {
  const doc = await Integration.findOne({ key: TWILIO_KEY });
  res.json({ success: true, data: sanitizeTwilio(doc) });
});

// PUT /integrations/twilio (superadmin) — upsert Twilio settings. Non-secret fields
// always overwrite; secret fields only overwrite when a non-empty value is sent.
export const updateTwilioIntegration = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as UpdateTwilioInput;
  const doc = (await Integration.findOne({ key: TWILIO_KEY })) ?? new Integration({ key: TWILIO_KEY });

  const plainFields = [
    'enabled',
    'accountSid',
    'apiKeySid',
    'twimlAppSid',
    'callerId',
    'recordCalls',
    'publicServerUrl',
  ] as const;
  for (const field of plainFields) {
    if (body[field] !== undefined) doc.set(field, body[field]);
  }
  // Only replace a secret when a fresh value is supplied (blank = keep current).
  for (const field of SECRET_FIELDS) {
    if (body[field]) doc.set(field, body[field]);
  }

  doc.updatedBy = req.user!.id as unknown as IntegrationDoc['updatedBy'];
  await doc.save();

  res.json({ success: true, data: sanitizeTwilio(doc) });
});

// GET /integrations/twilio/numbers (superadmin) — voice-capable numbers owned by
// the Twilio account, for assigning to telecallers.
export const listTwilioNumbers = asyncHandler(async (_req: Request, res: Response) => {
  const numbers = await listNumbers();
  res.json({ success: true, data: numbers });
});
