import { format, formatDistanceToNow, isToday, isPast } from 'date-fns';

export function fmtDate(d?: string | Date | null) {
  if (!d) return '—';
  return format(new Date(d), 'dd MMM yyyy');
}

export function fmtDateTime(d?: string | Date | null) {
  if (!d) return '—';
  return format(new Date(d), 'dd MMM yyyy, hh:mm a');
}

export function fmtRelative(d?: string | Date | null) {
  if (!d) return '—';
  return formatDistanceToNow(new Date(d), { addSuffix: true });
}

/** Formats a date to local `yyyy-MM-dd` for a <input type="date"> value. */
export function toDateInput(d?: string | Date | null) {
  if (!d) return '';
  return format(new Date(d), 'yyyy-MM-dd');
}

export function isOverdue(d?: string | Date | null) {
  if (!d) return false;
  return isPast(new Date(d)) && !isToday(new Date(d));
}

/** Normalizes a phone to a clean dial-able form, preserving the leading +country code. */
export function cleanPhone(phone: string) {
  const trimmed = phone.trim().replace(/[^\d+]/g, '');
  // Keep only a single leading '+'.
  return trimmed.startsWith('+') ? `+${trimmed.slice(1).replace(/\+/g, '')}` : trimmed.replace(/\+/g, '');
}

/**
 * Ensures a number is E.164. If it has no leading '+', prepends `defaultCode`
 * (e.g. '+91'), stripping leading zeros from the local part. Returns the cleaned
 * number unchanged when no country code is available.
 */
export function toE164(phone: string, defaultCode?: string | null) {
  const cleaned = cleanPhone(phone);
  if (cleaned.startsWith('+')) return cleaned;
  const code = (defaultCode || '').trim();
  if (!code) return cleaned;
  const local = cleaned.replace(/^0+/, '');
  return `${code.startsWith('+') ? code : `+${code}`}${local}`;
}

/** Builds a click-to-call (tel:) link. */
export function telLink(phone: string) {
  return `tel:${cleanPhone(phone)}`;
}

/** Builds a WhatsApp deep link. */
export function whatsappLink(phone: string) {
  return `https://wa.me/${phone.replace(/[^\d]/g, '')}`;
}
