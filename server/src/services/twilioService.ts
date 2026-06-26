import twilio from 'twilio';
import { env } from '../config/env.js';
import { Integration, type IntegrationDoc } from '../models/Integration.js';
import { User } from '../models/User.js';

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
 * Ensures a number is E.164: if it has no leading '+', prepends the default
 * country code (stripping any leading zeros from the local part).
 */
export function toE164(raw: string, defaultCountryCode?: string): string {
  const cleaned = raw.trim().replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return `+${cleaned.slice(1).replace(/\+/g, '')}`;
  const local = cleaned.replace(/\+/g, '').replace(/^0+/, '');
  const code = (defaultCountryCode || '').trim();
  if (!code) return local;
  return `${code.startsWith('+') ? code : `+${code}`}${local}`;
}

/**
 * Resolves the caller-ID (Twilio number) a given user dials from:
 *  - a telecaller uses the number the admin assigned them (else none → can't call);
 *  - a superadmin uses their assigned number, else the global default caller ID.
 */
export async function resolveCallerId(userId: string): Promise<string> {
  const user = await User.findById(userId).select('twilioNumber role');
  const assigned = (user?.twilioNumber || '').trim();
  if (assigned) return assigned;
  if (user?.role === 'superadmin') {
    const s = await getTwilioSettings();
    return (s?.callerId || '').trim();
  }
  return '';
}

/**
 * Fetches a call recording's audio from Twilio, authenticated with the account
 * credentials. Twilio recording media requires HTTP Basic auth, so this must be
 * proxied server-side — never expose the recording URL/creds to the browser.
 */
export async function fetchRecordingMedia(
  recordingUrl: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const s = await getTwilioSettings();
  if (!s || !s.accountSid || !s.authToken) return null;
  // The recording resource URL serves media when suffixed with .mp3 (or .wav).
  const mediaUrl = /\.(mp3|wav)$/i.test(recordingUrl) ? recordingUrl : `${recordingUrl}.mp3`;
  const auth = Buffer.from(`${s.accountSid}:${s.authToken}`).toString('base64');
  const resp = await fetch(mediaUrl, { headers: { Authorization: `Basic ${auth}` } });
  if (!resp.ok) return null;
  const buffer = Buffer.from(await resp.arrayBuffer());
  return { buffer, contentType: resp.headers.get('content-type') || 'audio/mpeg' };
}

/** Lists the account's voice-capable phone numbers (for the admin assignment UI). */
export async function listNumbers(): Promise<{ phoneNumber: string; friendlyName: string }[]> {
  const s = await getTwilioSettings();
  if (!s || !s.accountSid || !s.authToken) return [];
  const client = twilio(s.accountSid, s.authToken);
  const nums = await client.incomingPhoneNumbers.list({ limit: 100 });
  return nums
    .filter((n) => n.capabilities?.voice)
    .map((n) => ({ phoneNumber: n.phoneNumber, friendlyName: n.friendlyName || n.phoneNumber }));
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
 * Builds the TwiML that dials the lead from the browser leg, using `callerId`
 * (the calling telecaller's assigned Twilio number). Records the call (dual
 * channel) when recording is enabled and asks Twilio to POST the recording back.
 */
export async function buildDialTwiml(to: string, callerId: string): Promise<string> {
  const s = await getTwilioSettings();
  const response = new VoiceResponse();
  const recordingCallback = (() => {
    const base = publicBase(s);
    return base ? `${base}/api/v1/calls/recording` : undefined;
  })();

  const dialOptions: Record<string, unknown> = { callerId };
  if (s?.recordCalls) {
    dialOptions.record = 'record-from-answer-dual';
    if (recordingCallback) {
      dialOptions.recordingStatusCallback = recordingCallback;
      dialOptions.recordingStatusCallbackEvent = ['completed'];
    }
  }
  const dial = response.dial(dialOptions);
  // Ensure the dialled number carries a country code (Twilio needs E.164).
  dial.number(toE164(to, s?.defaultCountryCode));
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
