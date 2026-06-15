import { useState } from 'react';
import {
  Phone,
  MessageCircle,
  ChevronRight,
  ChevronDown,
  Send,
  ArrowUp,
  ArrowDown,
  Trash2,
  Copy,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge, EmptyState, Spinner } from '@/components/ui/Misc';
import { Button } from '@/components/ui/Button';
import { apiError } from '@/api/client';
import { useLogCall } from '@/api/calls';
import { useAddRemark, useScheduleFollowUp, useUpdateLead, useDeleteLead } from '@/api/leads';
import {
  CALL_STATUS_COLORS,
  CALL_STATUS_LABELS,
  DISPOSITION_LABELS,
  DISPOSITIONS,
  LEAD_STATUS_COLORS,
  LEAD_STATUS_LABELS,
  PRIORITY_COLORS,
} from '@/lib/constants';
import { cleanPhone, fmtDate, fmtDateTime, telLink, whatsappLink } from '@/lib/format';
import type { CallStatus, Density, Disposition, Lead, Role, User } from '@/types';

interface Props {
  leads: Lead[];
  isLoading: boolean;
  role: Role;
  density: Density;
  selectable?: boolean;
  selected: string[];
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  telecallers?: User[];
  onAssign?: (leadId: string, telecallerId: string, name: string) => void;
  sortBy: string;
  order: 'asc' | 'desc';
  onSort: (field: string) => void;
  emptyHint?: string;
}

const NOT_DONE = '__not_done__';
const PRIORITIES = ['low', 'medium', 'high'] as const;

function location(l: Lead) {
  return [l.city, l.state, l.country].filter(Boolean).join(', ');
}

function copyPhone(phone: string) {
  const num = cleanPhone(phone);
  navigator.clipboard
    .writeText(num)
    .then(() => toast.success(`Copied ${num}`))
    .catch(() => toast.error('Copy failed'));
}

/** Inline follow-up scheduler (both roles; telecaller scoped server-side). */
function FollowUpCell({ lead }: { lead: Lead }) {
  const schedule = useScheduleFollowUp();
  return (
    <div onClick={(e) => e.stopPropagation()} className="space-y-0.5">
      <input
        type="datetime-local"
        onChange={(e) =>
          e.target.value &&
          schedule.mutate(
            { id: lead._id, scheduledAt: new Date(e.target.value).toISOString() },
            { onSuccess: () => toast.success('Follow-up scheduled'), onError: (err) => toast.error(apiError(err)) }
          )
        }
        className="w-[168px] rounded-lg border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand-500"
      />
      {lead.nextFollowUpAt && (
        <p className="text-[11px] text-slate-400">Next: {fmtDate(lead.nextFollowUpAt)}</p>
      )}
    </div>
  );
}

/** Copy (left) · Call · WhatsApp actions for a phone number. */
function PhoneActions({ phone, big }: { phone: string; big?: boolean }) {
  const size = big ? 16 : 15;
  const cls = big ? 'rounded-lg p-2' : 'rounded p-1.5';
  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => copyPhone(phone)}
        title="Copy number"
        className={`${cls} text-slate-500 hover:bg-slate-100`}
      >
        <Copy size={size} />
      </button>
      <a href={telLink(phone)} title={phone} className={`${cls} text-brand-600 hover:bg-brand-50 ${big ? 'bg-brand-50' : ''}`}>
        <Phone size={size} />
      </a>
      <a
        href={whatsappLink(phone)}
        target="_blank"
        rel="noreferrer"
        className={`${cls} text-emerald-600 hover:bg-emerald-50 ${big ? 'bg-emerald-50' : ''}`}
      >
        <MessageCircle size={size} />
      </a>
    </div>
  );
}
function outcomeValue(l: Lead) {
  if (l.callStatus === 'done') return l.lastOutcome ?? '';
  if (l.callStatus === 'not_done') return NOT_DONE;
  return '';
}

export function ContactsTable({
  leads,
  isLoading,
  role,
  density,
  selectable,
  selected,
  onToggle,
  onToggleAll,
  telecallers = [],
  onAssign,
  sortBy,
  order,
  onSort,
  emptyHint,
}: Props) {
  const isAdmin = role === 'superadmin';
  const logCall = useLogCall();
  const pad = density === 'compact' ? 'px-2 py-1' : 'px-2 py-2.5';

  function handleOutcome(lead: Lead, value: string) {
    if (!value) return;
    const vars =
      value === NOT_DONE
        ? { lead: lead._id, callStatus: 'not_done' as CallStatus }
        : { lead: lead._id, callStatus: 'done' as CallStatus, disposition: value as Disposition };
    logCall.mutate(vars, {
      onSuccess: () => toast.success(value === NOT_DONE ? 'Marked not done' : 'Call logged'),
      onError: (e) => toast.error(apiError(e)),
    });
  }

  if (isLoading) return <Spinner />;
  if (!leads.length) return <EmptyState title="Nothing here yet" hint={emptyHint} />;

  const allChecked = selectable && leads.every((l) => selected.includes(l._id));

  const SortHeader = ({ field, label }: { field: string; label: string }) => (
    <button onClick={() => onSort(field)} className="flex items-center gap-1 hover:text-slate-700">
      {label}
      {sortBy === field && (order === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
    </button>
  );

  return (
    <>
      {/* Desktop grid (horizontally scrollable) */}
      <div className="hidden md:block">
        <table className="w-full min-w-[1650px] text-sm">
          <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_#e2e8f0]">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
              {selectable && (
                <th className="px-2 py-2">
                  <input type="checkbox" className="h-4 w-4" checked={!!allChecked} onChange={onToggleAll} />
                </th>
              )}
              <th className="w-6 px-2 py-2"></th>
              <th className="px-2 py-2"><SortHeader field="name" label="Name" /></th>
              <th className="px-2 py-2">Title</th>
              <th className="px-2 py-2"><SortHeader field="company" label="Company" /></th>
              <th className="px-2 py-2"><SortHeader field="country" label="Location" /></th>
              <th className="px-2 py-2">Phone</th>
              <th className="px-2 py-2">Alt Phone</th>
              <th className="px-2 py-2">Email</th>
              <th className="px-2 py-2">Priority</th>
              {isAdmin && <th className="px-2 py-2"><SortHeader field="assignedAt" label="Assigned To" /></th>}
              <th className="px-2 py-2"><SortHeader field="callStatus" label="Outcome" /></th>
              <th className="px-2 py-2"><SortHeader field="lastContactedAt" label="Last Contacted" /></th>
              <th className="px-2 py-2">Follow-up</th>
              <th className="px-2 py-2"><SortHeader field="createdAt" label="Added" /></th>
              <th className="min-w-[220px] px-2 py-2">Remark</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <Row
                key={lead._id}
                lead={lead}
                isAdmin={isAdmin}
                role={role}
                pad={pad}
                selectable={selectable}
                selected={selected.includes(lead._id)}
                onToggle={onToggle}
                telecallers={telecallers}
                onAssign={onAssign}
                onOutcome={handleOutcome}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="divide-y divide-slate-100 md:hidden">
        {leads.map((lead) => (
          <MobileCard
            key={lead._id}
            lead={lead}
            isAdmin={isAdmin}
            role={role}
            selectable={selectable}
            selected={selected.includes(lead._id)}
            onToggle={onToggle}
            telecallers={telecallers}
            onAssign={onAssign}
            onOutcome={handleOutcome}
          />
        ))}
      </div>
    </>
  );
}

/* ----------------------------- shared cells ------------------------------ */

function AssignSelect({
  lead,
  telecallers,
  onAssign,
}: {
  lead: Lead;
  telecallers: User[];
  onAssign?: (id: string, tid: string, name: string) => void;
}) {
  return (
    <select
      value={(lead.assignedTo as User | undefined)?._id ?? ''}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const t = telecallers.find((x) => x._id === e.target.value);
        if (t) onAssign?.(lead._id, t._id, t.name);
      }}
      className="max-w-[150px] rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-brand-500"
    >
      <option value="">Assign…</option>
      {telecallers.map((t) => (
        <option key={t._id} value={t._id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}

function PriorityCell({ lead, isAdmin }: { lead: Lead; isAdmin: boolean }) {
  const update = useUpdateLead();
  if (!isAdmin) {
    return <Badge className={PRIORITY_COLORS[lead.priority]}>{lead.priority}</Badge>;
  }
  return (
    <select
      value={lead.priority}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) =>
        update.mutate(
          { id: lead._id, priority: e.target.value as Lead['priority'] },
          { onError: (err) => toast.error(apiError(err)) }
        )
      }
      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-brand-500"
    >
      {PRIORITIES.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </select>
  );
}

function OutcomeControl({
  lead,
  isAdmin,
  onOutcome,
}: {
  lead: Lead;
  isAdmin: boolean;
  onOutcome: (lead: Lead, v: string) => void;
}) {
  if (isAdmin) {
    return (
      <Badge className={CALL_STATUS_COLORS[(lead.callStatus ?? 'pending') as CallStatus]}>
        {lead.callStatus === 'done' && lead.lastOutcome
          ? DISPOSITION_LABELS[lead.lastOutcome as Disposition] ?? 'Done'
          : CALL_STATUS_LABELS[(lead.callStatus ?? 'pending') as CallStatus]}
      </Badge>
    );
  }
  return (
    <select
      value={outcomeValue(lead)}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onOutcome(lead, e.target.value)}
      className="max-w-[150px] rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-brand-500"
    >
      <option value="">— Outcome —</option>
      {DISPOSITIONS.map((d) => (
        <option key={d} value={d}>
          {DISPOSITION_LABELS[d]}
        </option>
      ))}
      <option value={NOT_DONE}>Not Done</option>
    </select>
  );
}

function RemarkCell({ lead }: { lead: Lead }) {
  const [text, setText] = useState('');
  const addRemark = useAddRemark();
  const last = lead.remarks?.[lead.remarks.length - 1];

  function submit() {
    const t = text.trim();
    if (!t) return;
    setText('');
    addRemark.mutate({ id: lead._id, text: t }, { onError: (e) => toast.error(apiError(e)) });
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-1">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Add remark…"
          className="w-full min-w-[160px] rounded-lg border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand-500"
        />
        <button onClick={submit} className="rounded p-1 text-brand-600 hover:bg-brand-50" title="Add remark">
          <Send size={13} />
        </button>
      </div>
      {last && (
        <p className="mt-0.5 max-w-[240px] truncate text-[11px] text-slate-400" title={last.text}>
          {lead.remarks!.length}× · {last.text}
        </p>
      )}
    </div>
  );
}

function ExpandedDetail({ lead, isAdmin }: { lead: Lead; isAdmin: boolean }) {
  const del = useDeleteLead();
  const loc = location(lead);

  function onDelete() {
    if (!confirm(`Delete contact "${lead.name}"? This cannot be undone.`)) return;
    del.mutate(lead._id, {
      onSuccess: () => toast.success('Contact deleted'),
      onError: (e) => toast.error(apiError(e)),
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 bg-slate-50 p-4 lg:grid-cols-3">
      <div className="space-y-2 text-sm">
        {lead.email && <Detail label="Email" value={lead.email} />}
        {lead.altPhone && <Detail label="Alt phone" value={lead.altPhone} />}
        {loc && <Detail label="Location" value={loc} />}
        {lead.source && <Detail label="Source" value={lead.source} />}
        {!!lead.tags?.length && <Detail label="Tags" value={lead.tags.join(', ')} />}
      </div>
      <div className="space-y-2 text-sm">
        {lead.lastContactedAt && <Detail label="Last contacted" value={fmtDateTime(lead.lastContactedAt)} />}
        {lead.nextFollowUpAt && <Detail label="Next follow-up" value={fmtDateTime(lead.nextFollowUpAt)} />}
        <Detail label="Added" value={fmtDateTime(lead.createdAt)} />
        {isAdmin && (
          <Button size="sm" variant="danger" onClick={onDelete}>
            <Trash2 size={14} /> Delete contact
          </Button>
        )}
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold text-slate-500">Remarks</p>
        <div className="max-h-48 space-y-1.5 overflow-y-auto">
          {!lead.remarks?.length && <p className="text-xs text-slate-400">No remarks yet.</p>}
          {(lead.remarks ?? [])
            .slice()
            .reverse()
            .map((r, i) => (
              <div key={r._id ?? i} className="rounded-lg bg-white p-2">
                <p className="text-xs text-slate-700">{r.text}</p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  {r.byName || 'Unknown'}
                  {r.byRole ? ` (${r.byRole === 'superadmin' ? 'Admin' : 'Telecaller'})` : ''} ·{' '}
                  {fmtDateTime(r.createdAt)}
                </p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-slate-400">{label}</span>
      <p className="break-words text-slate-700">{value}</p>
    </div>
  );
}

/* ------------------------------ desktop row ------------------------------ */

function Row({
  lead,
  isAdmin,
  role,
  pad,
  selectable,
  selected,
  onToggle,
  telecallers,
  onAssign,
  onOutcome,
}: {
  lead: Lead;
  isAdmin: boolean;
  role: Role;
  pad: string;
  selectable?: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
  telecallers: User[];
  onAssign?: (id: string, tid: string, name: string) => void;
  onOutcome: (lead: Lead, v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const muted = 'text-slate-500';

  return (
    <>
      <tr className="border-b border-slate-100 hover:bg-slate-50/60">
        {selectable && (
          <td className={pad}>
            <input type="checkbox" className="h-4 w-4" checked={selected} onChange={() => onToggle(lead._id)} />
          </td>
        )}
        <td className={pad}>
          <button onClick={() => setOpen((o) => !o)} className="text-slate-400 hover:text-slate-600">
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </td>
        <td className={pad}>
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-800">{lead.name}</p>
            <Badge className={LEAD_STATUS_COLORS[lead.status]}>{LEAD_STATUS_LABELS[lead.status]}</Badge>
            {lead.qualified && <Badge className="bg-green-600 text-white">Lead</Badge>}
          </div>
        </td>
        <td className={`${pad} ${muted}`}>{lead.title || '—'}</td>
        <td className={`${pad} ${muted}`}>{lead.company || '—'}</td>
        <td className={`${pad} ${muted}`}>{location(lead) || '—'}</td>
        <td className={pad}>
          <PhoneActions phone={lead.phone} />
        </td>
        <td className={pad}>
          {lead.altPhone ? <PhoneActions phone={lead.altPhone} /> : <span className="text-slate-300">—</span>}
        </td>
        <td className={`${pad} ${muted}`}>
          {lead.email ? (
            <a href={`mailto:${lead.email}`} className="hover:text-brand-600" onClick={(e) => e.stopPropagation()}>
              {lead.email}
            </a>
          ) : (
            '—'
          )}
        </td>
        <td className={pad}>
          <PriorityCell lead={lead} isAdmin={isAdmin} />
        </td>
        {isAdmin && (
          <td className={pad}>
            {onAssign ? (
              <AssignSelect lead={lead} telecallers={telecallers} onAssign={onAssign} />
            ) : (
              (lead.assignedTo as User | undefined)?.name ?? <span className="text-slate-300">—</span>
            )}
          </td>
        )}
        <td className={pad}>
          <OutcomeControl lead={lead} isAdmin={isAdmin} onOutcome={onOutcome} />
        </td>
        <td className={`${pad} ${muted}`}>{lead.lastContactedAt ? fmtDate(lead.lastContactedAt) : '—'}</td>
        <td className={pad}>
          <FollowUpCell lead={lead} />
        </td>
        <td className={`${pad} ${muted}`}>{fmtDate(lead.createdAt)}</td>
        <td className={pad}>
          <RemarkCell lead={lead} />
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={99} className="p-0">
            <ExpandedDetail lead={lead} isAdmin={isAdmin} />
          </td>
        </tr>
      )}
    </>
  );
}

/* ------------------------------ mobile card ------------------------------ */

function MobileCard({
  lead,
  isAdmin,
  role,
  selectable,
  selected,
  onToggle,
  telecallers,
  onAssign,
  onOutcome,
}: {
  lead: Lead;
  isAdmin: boolean;
  role: Role;
  selectable?: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
  telecallers: User[];
  onAssign?: (id: string, tid: string, name: string) => void;
  onOutcome: (lead: Lead, v: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-3">
      <div className="flex items-start gap-2">
        {selectable && (
          <input type="checkbox" className="mt-1 h-4 w-4" checked={selected} onChange={() => onToggle(lead._id)} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-medium text-slate-800">{lead.name}</p>
            {lead.qualified && <Badge className="bg-green-600 text-white">Lead</Badge>}
          </div>
          <p className="truncate text-sm text-slate-500">
            {lead.phone}
            {lead.company ? ` · ${lead.company}` : ''}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <PhoneActions phone={lead.phone} big />
            {isAdmin && onAssign && <AssignSelect lead={lead} telecallers={telecallers} onAssign={onAssign} />}
            {!isAdmin && <OutcomeControl lead={lead} isAdmin={isAdmin} onOutcome={onOutcome} />}
            <button onClick={() => setOpen((o) => !o)} className="ml-auto text-slate-400">
              {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>
          </div>
          <div className="mt-2">
            <RemarkCell lead={lead} />
          </div>
        </div>
      </div>
      {open && (
        <div className="mt-2 overflow-hidden rounded-lg">
          <ExpandedDetail lead={lead} isAdmin={isAdmin} />
        </div>
      )}
    </div>
  );
}
