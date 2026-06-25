import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

// Singleton settings document(s) for third-party integrations, keyed by `key`.
// Currently only 'twilio'. Credentials live here (managed from the admin panel)
// instead of env vars. Secrets are never returned to the client raw — see
// `integrationController.sanitizeTwilio`.
const integrationSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true }, // e.g. 'twilio'
    enabled: { type: Boolean, default: false },
    // Twilio credentials.
    accountSid: { type: String, default: '' },
    authToken: { type: String, default: '' }, // secret
    apiKeySid: { type: String, default: '' },
    apiKeySecret: { type: String, default: '' }, // secret
    twimlAppSid: { type: String, default: '' },
    callerId: { type: String, default: '' },
    // Call behaviour.
    recordCalls: { type: Boolean, default: true },
    // Public base URL Twilio uses to reach our webhooks (overrides env fallback).
    publicServerUrl: { type: String, default: '' },
    updatedBy: { type: Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

integrationSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret.__v;
    return ret;
  },
});

export type IntegrationAttrs = InferSchemaType<typeof integrationSchema>;
export type IntegrationDoc = HydratedDocument<IntegrationAttrs>;

export const Integration = model('Integration', integrationSchema);
