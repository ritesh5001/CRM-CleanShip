import type { CallStatus, Disposition, LeadStatus, PhoneCallStatus, PhoneLeadOutcome, TaskStatus } from '@/types';

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  interested: 'Interested',
  callback: 'Callback',
  not_interested: 'Not Interested',
  converted: 'Converted',
  dnd: 'DND',
};

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-slate-100 text-slate-700',
  assigned: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  interested: 'bg-emerald-100 text-emerald-700',
  callback: 'bg-purple-100 text-purple-700',
  not_interested: 'bg-rose-100 text-rose-700',
  converted: 'bg-green-600 text-white',
  dnd: 'bg-gray-700 text-white',
};

export const DISPOSITION_LABELS: Record<Disposition, string> = {
  interested: 'Interested',
  callback: 'Callback',
  not_interested: 'Not Interested',
  busy: 'Busy',
  switched_off: 'Switched Off',
  wrong_number: 'Wrong Number',
  dnd: 'DND',
  converted: 'Converted',
};

export const DISPOSITIONS = Object.keys(DISPOSITION_LABELS) as Disposition[];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  pending: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-rose-100 text-rose-700',
};

export const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-rose-100 text-rose-700',
};

export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  pending: 'Not Called',
  done: 'Call Done',
  not_done: 'Not Done',
};

export const CALL_STATUS_COLORS: Record<CallStatus, string> = {
  pending: 'bg-slate-100 text-slate-600',
  done: 'bg-emerald-100 text-emerald-700',
  not_done: 'bg-amber-100 text-amber-700',
};

export const PHONE_CALL_STATUS_LABELS: Record<PhoneCallStatus, string> = {
  pending: 'Not Called',
  connected: 'Connected',
  not_connected: 'Not Connected',
  voicemail: 'Voice Mail',
  incorrect_no: 'Incorrect No',
};

/** Label for a call log: its disposition if any, else the call status (for attempts/dropdown marks). */
export function callLogOutcomeLabel(disposition?: Disposition | null, callStatus?: PhoneCallStatus | null): string {
  if (disposition) return DISPOSITION_LABELS[disposition];
  if (callStatus && callStatus !== 'pending') return PHONE_CALL_STATUS_LABELS[callStatus];
  return 'Logged';
}

export const PHONE_CALL_STATUS_COLORS: Record<PhoneCallStatus, string> = {
  pending: 'bg-slate-100 text-slate-500',
  connected: 'bg-emerald-100 text-emerald-700',
  not_connected: 'bg-amber-100 text-amber-700',
  voicemail: 'bg-purple-100 text-purple-700',
  incorrect_no: 'bg-rose-100 text-rose-700',
};

export const PHONE_LEAD_OUTCOME_LABELS: Record<PhoneLeadOutcome, string> = {
  none: '—',
  interested: 'Interested',
  not_interested: 'Not Interested',
};

export const PHONE_LEAD_OUTCOME_COLORS: Record<PhoneLeadOutcome, string> = {
  none: 'bg-slate-100 text-slate-400',
  interested: 'bg-emerald-100 text-emerald-700',
  not_interested: 'bg-rose-100 text-rose-700',
};
