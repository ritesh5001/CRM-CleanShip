import { useState } from 'react';
import { Phone, MessageCircle, ChevronRight, ChevronDown, Send, ArrowUp, ArrowDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge, EmptyState, Spinner } from '@/components/ui/Misc';
import { apiError } from '@/api/client';
import { useLogCall } from '@/api/calls';
import { useAddRemark, useScheduleFollowUp } from '@/api/leads';
import {
  CALL_STATUS_COLORS,
  CALL_STATUS_LABELS,
  DISPOSITION_LABELS,
  DISPOSITIONS,
  LEAD_STATUS_COLORS,
  LEAD_STATUS_LABELS,
} from '@/lib/constants';
import { fmtDateTime, telLink, whatsappLink } from '@/lib/format';
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

function location(l: Lead) {
  return [l.city, l.state, l.country].filter(Boolean).join(', ');
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
      {sortBy === field &&
        (order === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
    </button>
  );

  return (
    <>
      {/* Desktop grid */}
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_#e2e8f0]">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
              {selectable && (
                <th className="px-2 py-2">
                  <input type="checkbox" className="h-4 w-4" checked={!!allChecked} onChange={onToggleAll} />
                </th>
              )}
              <th className="w-6 px-2 py-2"></th>
              <th className="px-2 py-2"><SortHeader field="name" label="Name" /></th>
              <th className="px-2 py-2"><SortHeader field="company" label="Company · Location" /></th>
              <th className="px-2 py-2">Phone</th>
              {isAdmin && <th className="px-2 py-2"><SortHeader field="assignedAt" label="Assigned To" /></th>}
              <th className="px-2 py-2"><SortHeader field="callStatus" label="Outcome" /></th>
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
          className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand-500"
        />
        <button onClick={submit} className="rounded p-1 text-brand-600 hover:bg-brand-50" title="Add remark">
          <Send size={13} />
        </button>
      </div>
      {last && (
        <p className="mt-0.5 truncate text-[11px] text-slate-400" title={last.text}>
          {lead.remarks!.length}× · {last.text}
        </p>
      )}
    </div>
  );
}

function ExpandedDetail({ lead, role }: { lead: Lead; role: Role }) {
  const scheduleFollowUp = useScheduleFollowUp();
  const loc = location(lead);

  function onDate(v: string) {
    if (!v) return;
    scheduleFollowUp.mutate(
      { id: lead._id, scheduledAt: new Date(v).toISOString() },
      { onSuccess: () => toast.success('Follow-up scheduled'), onError: (e) => toast.error(apiError(e)) }
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 bg-slate-50 p-4 lg:grid-cols-2">
      <div className="space-y-2 text-sm">
        {lead.email && <Detail label="Email" value={lead.email} />}
        {lead.altPhone && <Detail label="Alt phone" value={lead.altPhone} />}
        {loc && <Detail label="Location" value={loc} />}
        {lead.lastContactedAt && <Detail label="Last contacted" value={fmtDateTime(lead.lastContactedAt)} />}
        {role === 'telecaller' && (
          <div>
            <span className="text-xs text-slate-400">Schedule follow-up</span>
            <input
              type="datetime-local"
              onChange={(e) => onDate(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand-500"
            />
            {lead.nextFollowUpAt && (
              <p className="mt-1 text-[11px] text-slate-400">Next: {fmtDateTime(lead.nextFollowUpAt)}</p>
            )}
          </div>
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
      <p className="text-slate-700">{value}</p>
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
          {lead.title && <p className="text-xs text-slate-400">{lead.title}</p>}
        </td>
        <td className={`${pad} text-slate-500`}>
          {lead.company || '—'}
          {location(lead) ? <span className="text-slate-400"> · {location(lead)}</span> : ''}
        </td>
        <td className={pad}>
          <div className="flex gap-1.5">
            <a href={telLink(lead.phone)} className="rounded p-1.5 text-brand-600 hover:bg-brand-50" title={lead.phone}>
              <Phone size={15} />
            </a>
            <a href={whatsappLink(lead.phone)} target="_blank" rel="noreferrer" className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50">
              <MessageCircle size={15} />
            </a>
          </div>
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
        <td className={pad}>
          <RemarkCell lead={lead} />
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={99} className="p-0">
            <ExpandedDetail lead={lead} role={role} />
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
            <a href={telLink(lead.phone)} className="rounded-lg bg-brand-50 p-2 text-brand-600">
              <Phone size={16} />
            </a>
            <a href={whatsappLink(lead.phone)} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <MessageCircle size={16} />
            </a>
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
          <ExpandedDetail lead={lead} role={role} />
        </div>
      )}
    </div>
  );
}
