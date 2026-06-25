import twilio from 'twilio';
import { env } from '../config/env.js';
import { Integration, type IntegrationDoc } from '../models/Integration.js';

const { AccessToken } = twilio.jwt;
const { VoiceGrant } = AccessToken;
const { VoiceResponse } = twilio.twiml;

export const TWILIO_KEY = 'twilio';

/** Loads the saved Twilio settings (admin panel), or null if never configured. */
export async function getTwilioSettings(): Promise<IntegrationDoc | null> {
  return Integration.findOne({ key: TWILIO_KEY });
}

/** True when a settings doc has every credential needed to place a call. */
function hasAllCreds(s: IntegrationDoc): boolean {
  return Boolean(s.accountSid && s.apiKeySid && s.apiKeySecret && s.twimlAppSid && s.callerId);
}

/** True when calling is switched on AND fully configured. */
export async function isEnabled(): Promise<boolean> {
  const s = await getTwilioSettings();
  return Boolean(s && s.enabled && hasAllCreds(s));
}

/** Public base URL Twilio should use for our webhooks (panel value, else env). */
function publicBase(s: IntegrationDoc | null): string | undefined {
  const base = s?.publicServerUrl || env.publicUrl;
  return base ? base.replace(/\/$/, '') : undefined;
}

/**
 * Mints a short-lived Voice access token for a telecaller's browser softphone.
 * Throws if calling isn't fully configured (callers should check `isEnabled`).
 */
export async function generateVoiceToken(identity: string): Promise<{ token: string; identity: string }> {
  const s = await getTwilioSettings();
  if (!s || !hasAllCreds(s)) throw new Error('Twilio is not configured');
  const token = new AccessToken(s.accountSid, s.apiKeySid, s.apiKeySecret, { identity, ttl: 3600 });
  token.addGrant(new VoiceGrant({ outgoingApplicationSid: s.twimlAppSid, incomingAllow: false }));
  return { token: token.toJwt(), identity };
}

/**
 * Builds the TwiML that dials the lead from the browser leg. Records the call
 * (dual channel) when recording is enabled and asks Twilio to POST the recording
 * back to us when ready.
 */
export async function buildDialTwiml(to: string): Promise<string> {
  const s = await getTwilioSettings();
  const response = new VoiceResponse();
  const recordingCallback = (() => {
    const base = publicBase(s);
    return base ? `${base}/api/v1/calls/recording` : undefined;
  })();

  const dialOptions: Record<string, unknown> = { callerId: s?.callerId };
  if (s?.recordCalls) {
    dialOptions.record = 'record-from-answer-dual';
    if (recordingCallback) {
      dialOptions.recordingStatusCallback = recordingCallback;
      dialOptions.recordingStatusCallbackEvent = ['completed'];
    }
  }
  const dial = response.dial(dialOptions);
  dial.number(to);
  return response.toString();
}

/**
 * Verifies an incoming Twilio webhook request signature using the saved auth
 * token. Reconstructs the public URL so validation works behind a proxy/tunnel.
 */
export async function validateSignature(req: {
  headers: Record<string, unknown>;
  originalUrl: string;
  body: Record<string, unknown>;
}): Promise<boolean> {
  const s = await getTwilioSettings();
  if (!s || !s.authToken) return false;
  const signature = req.headers['x-twilio-signature'];
  if (typeof signature !== 'string') return false;
  const base = publicBase(s);
  if (!base) return false;
  const url = `${base}${req.originalUrl}`;
  return twilio.validateRequest(s.authToken, signature, url, req.body);
}
