import type { Lead, User } from '@/types';
import { fmtDateTime } from './format';

function cell(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  // Quote if it contains comma, quote, or newline.
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const COLUMNS: { header: string; value: (l: Lead) => unknown }[] = [
  { header: 'Name', value: (l) => l.name },
  { header: 'Title', value: (l) => l.title },
  { header: 'Company', value: (l) => l.company },
  { header: 'Phone', value: (l) => l.phone },
  { header: 'Alt Phone', value: (l) => l.altPhone },
  { header: 'Alt Phone 2', value: (l) => l.altPhone2 },
  { header: 'Email', value: (l) => l.email },
  { header: 'City', value: (l) => l.city },
  { header: 'State', value: (l) => l.state },
  { header: 'Country', value: (l) => l.country },
  { header: 'Status', value: (l) => l.status },
  { header: 'Call Status', value: (l) => l.callStatus },
  { header: 'Outcome', value: (l) => l.lastOutcome },
  { header: 'Qualified (Lead)', value: (l) => (l.qualified ? 'Yes' : 'No') },
  { header: 'Assigned To', value: (l) => (l.assignedTo as User | undefined)?.name ?? '' },
  { header: 'Remarks', value: (l) => l.remarks?.length ?? 0 },
  { header: 'Last Remark', value: (l) => l.remarks?.[l.remarks.length - 1]?.text ?? '' },
  { header: 'Last Contacted', value: (l) => (l.lastContactedAt ? fmtDateTime(l.lastContactedAt) : '') },
  { header: 'Next Follow-up', value: (l) => (l.nextFollowUpAt ? fmtDateTime(l.nextFollowUpAt) : '') },
];

export function downloadLeadsCsv(leads: Lead[], fileName = 'contacts.csv') {
  const head = COLUMNS.map((c) => c.header).join(',');
  const rows = leads.map((l) => COLUMNS.map((c) => cell(c.value(l))).join(','));
  const csv = [head, ...rows].join('\n');

  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
