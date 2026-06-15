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

export function isOverdue(d?: string | Date | null) {
  if (!d) return false;
  return isPast(new Date(d)) && !isToday(new Date(d));
}

/** Builds a click-to-call (tel:) link. */
export function telLink(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/** Builds a WhatsApp deep link. */
export function whatsappLink(phone: string) {
  return `https://wa.me/${phone.replace(/[^\d]/g, '')}`;
}
