import { format, formatDistanceToNow, isToday, isTomorrow, isYesterday, isPast } from 'date-fns';

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

/** Builds a click-to-call (tel:) link. */
export function telLink(phone: string) {
  return `tel:${cleanPhone(phone)}`;
}

/** Builds a WhatsApp deep link. */
export function whatsappLink(phone: string) {
  return `https://wa.me/${phone.replace(/[^\d]/g, '')}`;
}

/** Formats a date to local `yyyy-MM-ddTHH:mm` for an `<input type="datetime-local">`. */
export function toDateTimeInput(d?: string | Date | null) {
  if (!d) return '';
  return format(new Date(d), "yyyy-MM-dd'T'HH:mm");
}

/** "2h 15m" / "45m" — for a self-reported effort in minutes. */
export function fmtMinutes(mins?: number | null) {
  if (mins == null || mins < 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Day-relative label for a due date: "Today, 4:30 pm" / "Tomorrow" / "12 Mar". */
export function fmtDueLabel(d?: string | Date | null) {
  if (!d) return 'No due date';
  const date = new Date(d);
  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
  const time = hasTime ? `, ${format(date, 'h:mm a')}` : '';
  if (isToday(date)) return `Today${time}`;
  if (isTomorrow(date)) return `Tomorrow${time}`;
  if (isYesterday(date)) return `Yesterday${time}`;
  return `${format(date, 'dd MMM')}${time}`;
}

/** Compact stamp for dense table cells: "01 Sep, 9:21 AM" (year only when it isn't this one). */
export function fmtStamp(d?: string | Date | null) {
  if (!d) return '—';
  const date = new Date(d);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return format(date, sameYear ? 'dd MMM, h:mm a' : 'dd MMM yyyy, h:mm a');
}
