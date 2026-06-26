import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import { countryISO } from './countries';

/** Strips junk (quotes, spaces, letters) keeping digits and a single leading '+'. */
function stripJunk(raw: string): string {
  const s = raw.trim().replace(/[^\d+]/g, '');
  return s.startsWith('+') ? `+${s.slice(1).replace(/\+/g, '')}` : s.replace(/\+/g, '');
}

/**
 * Formats a phone number for display, e.g. `"+971501510371` → "+971 50 151 0371"
 * and `14102927721` (US contact) → "+1 410 292 7721". Uses the contact's country
 * to parse local numbers. Falls back to the cleaned digits when it can't parse.
 */
export function formatPhoneDisplay(raw?: string | null, country?: string | null): string {
  if (!raw) return '';
  const cleaned = stripJunk(raw);
  if (!cleaned) return '';
  const region = countryISO(country) as CountryCode | undefined;
  const parsed = parsePhoneNumberFromString(cleaned, region);
  if (parsed && parsed.isValid()) return parsed.formatInternational();
  return cleaned;
}

/**
 * Normalizes a number to E.164 for dialling. Parses with the contact's country
 * (so `14102927721` for a US contact → `+14102927721`, not `+1110…`). Falls back
 * to prepending `defaultCode` when the country/number can't be parsed.
 */
export function toE164(raw: string, country?: string | null, defaultCode?: string | null): string {
  const cleaned = stripJunk(raw);
  if (!cleaned) return '';
  const region = countryISO(country) as CountryCode | undefined;
  const parsed = parsePhoneNumberFromString(cleaned, region);
  if (parsed && parsed.isValid()) return parsed.number; // E.164, e.g. +14102927721
  if (cleaned.startsWith('+')) return cleaned;
  const code = (defaultCode || '').trim();
  if (code) return `${code.startsWith('+') ? code : `+${code}`}${cleaned.replace(/^0+/, '')}`;
  return cleaned;
}
