/**
 * TeleCMI (PIOPIY) telephony provider — the second calling backend alongside Twilio.
 *
 * Two calling modes are supported, both configured from the admin panel:
 *  - **Softphone**: the browser registers directly with a TeleCMI SBC via the
 *    `@telecmi/piopiyjs` WebRTC SDK using the telecaller's own SIP user/password.
 *    Unlike Twilio there is no server-minted token and no TwiML webhook — we just
 *    hand the authenticated telecaller their own credentials.
 *  - **Click-to-call**: the server asks TeleCMI to ring the telecaller's phone and
 *    bridge the lead (`/v1/agentConnect`), authenticated with a per-agent token
 *    obtained from `/v1/agentLogin` (valid 30 days, cached on the User doc).
 *
 * Call outcomes arrive asynchronously on the CDR webhook; recordings are fetched
 * back through the REST API and proxied so credentials never reach the browser.
 */
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { env } from '../config/env.js';
import { Integration, type IntegrationDoc } from '../models/Integration.js';
import { User } from '../models/User.js';

export const TELECMI_KEY = 'telecmi';

const AGENT_LOGIN_URL = 'https://piopiy.telecmi.com/v1/agentLogin';
const AGENT_CONNECT_URL = 'https://piopiy.telecmi.com/v1/agentConnect';
const RECORDING_URL = 'https://rest.telecmi.com/v2/piopiy/play';

/** Agent tokens are valid 30 days; refresh a little early to avoid edge failures. */
const TOKEN_TTL_MS = 29 * 24 * 60 * 60 * 1000;

/** The SBC regions TeleCMI exposes for the browser SDK. */
export const SBC_REGIONS = [
  { uri: 'sbcind.telecmi.com', label: 'India' },
  { uri: 'sbcus.telecmi.com', label: 'America' },
  { uri: 'sbcuk.telecmi.com', label: 'Europe' },
  { uri: 'sbcsg.telecmi.com', label: 'Asia (Singapore)' },
] as const;

export const DEFAULT_SBC_URI = 'sbcind.telecmi.com';

/** Loads the saved TeleCMI settings (admin panel), or null if never configured. */
export async function getTelecmiSettings(): Promise<IntegrationDoc | null> {
  return Integration.findOne({ key: TELECMI_KEY });
}

/** True when a settings doc has the credentials needed for the REST API. */
function hasAllCreds(s: IntegrationDoc): boolean {
  return Boolean(s.appId && s.apiToken);
}

/** True when TeleCMI calling is switched on AND fully configured. */
export async function isEnabled(): Promise<boolean> {
  const s = await getTelecmiSettings();
  return Boolean(s && s.enabled && hasAllCreds(s));
}

/** Public base URL TeleCMI should use for our CDR webhook (panel value, else env). */
export function publicBase(s: IntegrationDoc | null): string | undefined {
  const base = s?.publicServerUrl || env.publicUrl;
  return base ? base.replace(/\/$/, '') : undefined;
}

/**
 * Normalizes a number to E.164 for TeleCMI. Same rule as the Twilio path: a
 * number that already carries its country code without the '+' must not be
 * prefixed again.
 */
export function toE164(raw: string, defaultCountryCode?: string): string {
  const cleaned = raw.trim().replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return `+${cleaned.slice(1).replace(/\+/g, '')}`;
  const digits = cleaned.replace(/\+/g, '');
  const local = digits.replace(/^0+/, '');
  const code = (defaultCountryCode || '').trim();
  if (!code) return digits;
  const plusCode = code.startsWith('+') ? code : `+${code}`;

  const asIs = parsePhoneNumberFromString(`+${digits}`);
  const prefixed = parsePhoneNumberFromString(`${plusCode}${local}`);
  if (asIs?.isValid() && !prefixed?.isValid()) return asIs.number;
  if (prefixed?.isValid()) return prefixed.number;
  if (asIs?.isPossible()) return asIs.number;
  return `${plusCode}${local}`;
}

/**
 * The softphone credentials a given telecaller registers with. Returns null when
 * the admin hasn't assigned this user a TeleCMI SIP user yet — the caller turns
 * that into a clear "ask your admin" error rather than a failed registration.
 */
export async function resolveAgentCredentials(
  userId: string
): Promise<{ userId: string; password: string; sbcUri: string } | null> {
  const user = await User.findById(userId).select('+telecmiPassword telecmiUserId');
  const sipUser = (user?.telecmiUserId || '').trim();
  const password = (user?.telecmiPassword || '').trim();
  if (!sipUser || !password) return null;

  const s = await getTelecmiSettings();
  return { userId: sipUser, password, sbcUri: (s?.sbcUri || '').trim() || DEFAULT_SBC_URI };
}

/**
 * Returns a valid agent token for click-to-call, logging in against TeleCMI and
 * caching the result on the User doc. Tokens last 30 days, so this hits the
 * network roughly once a month per telecaller.
 */
export async function getAgentToken(userId: string, forceRefresh = false): Promise<string | null> {
  const user = await User.findById(userId).select('+telecmiPassword +telecmiAgentToken telecmiUserId telecmiTokenAt');
  if (!user) return null;

  const cached = (user.telecmiAgentToken || '').trim();
  const issuedAt = user.telecmiTokenAt ? new Date(user.telecmiTokenAt).getTime() : 0;
  if (!forceRefresh && cached && Date.now() - issuedAt < TOKEN_TTL_MS) return cached;

  const sipUser = (user.telecmiUserId || '').trim();
  const password = (user.telecmiPassword || '').trim();
  if (!sipUser || !password) return null;

  const resp = await fetch(AGENT_LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: sipUser, password }),
  });
  const data = (await resp.json().catch(() => null)) as { code?: number; token?: string } | null;
  if (!resp.ok || data?.code !== 200 || !data.token) return null;

  user.telecmiAgentToken = data.token;
  user.telecmiTokenAt = new Date();
  await user.save();
  return data.token;
}

/**
 * Places a click-to-call: TeleCMI rings the telecaller's own phone first, then
 * bridges `to` once they answer. Retries once with a fresh token so an expired
 * cached token self-heals instead of surfacing as a failure.
 */
export async function clickToCall(
  userId: string,
  to: string
): Promise<{ ok: true; requestId: string } | { ok: false; message: string }> {
  const s = await getTelecmiSettings();
  const number = toE164(to, s?.defaultCountryCode);

  for (const forceRefresh of [false, true]) {
    const token = await getAgentToken(userId, forceRefresh);
    if (!token) return { ok: false, message: 'No TeleCMI agent credentials assigned to you. Ask your admin.' };

    const resp = await fetch(AGENT_CONNECT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, to: number }),
    });
    const data = (await resp.json().catch(() => null)) as
      | { code?: number; msg?: string; request_id?: string }
      | null;

    if (resp.ok && data?.code === 200 && data.request_id) {
      return { ok: true, requestId: data.request_id };
    }
    // A stale token reads as an auth failure — fall through and retry once.
    if (forceRefresh) {
      return { ok: false, message: data?.msg || 'TeleCMI rejected the call. Check the number and your agent setup.' };
    }
  }
  return { ok: false, message: 'Could not place the call through TeleCMI.' };
}

/**
 * Fetches a recorded call's audio from TeleCMI. Like the Twilio path this must be
 * proxied server-side — the app id + API token would otherwise reach the browser.
 */
export async function fetchRecordingMedia(
  filename: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const s = await getTelecmiSettings();
  if (!s || !hasAllCreds(s) || !filename) return null;

  const url = new URL(RECORDING_URL);
  url.searchParams.set('appid', s.appId);
  url.searchParams.set('token', s.apiToken);
  url.searchParams.set('file', filename);

  const resp = await fetch(url);
  if (!resp.ok) return null;
  const buffer = Buffer.from(await resp.arrayBuffer());
  return { buffer, contentType: resp.headers.get('content-type') || 'audio/mpeg' };
}

/** Maps a TeleCMI CDR hangup reason / status onto a human-readable failure cause. */
export function reasonForCdr(status?: string, hangupReason?: string): string | undefined {
  if (status === 'answered') return undefined;
  switch (hangupReason) {
    case 'recv_reject':
    case 'sent_reject':
      return 'Call rejected by the other end.';
    case 'recv_cancel':
      return 'Call cancelled before it was answered.';
    case 'no_answer':
      return 'No answer.';
    case 'busy':
      return 'The line was busy.';
    default:
      return status === 'missed' ? 'No answer.' : undefined;
  }
}
