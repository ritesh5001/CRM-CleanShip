import { useEffect, useRef, useState, type ReactNode } from 'react';
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
  Columns3,
  GripVertical,
  RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge, EmptyState, Spinner } from '@/components/ui/Misc';
import { Button } from '@/components/ui/Button';
import { apiError } from '@/api/client';
import { useAddRemark, useScheduleFollowUp, useUpdateLead, useDeleteLead, useUpdatePhoneOutcome } from '@/api/leads';
import {
  LEAD_STATUS_COLORS,
  LEAD_STATUS_LABELS,
  PHONE_CALL_STATUS_COLORS,
  PHONE_CALL_STATUS_LABELS,
  PHONE_LEAD_OUTCOME_COLORS,
  PHONE_LEAD_OUTCOME_LABELS,
  PRIORITY_COLORS,
} from '@/lib/constants';
import { cleanPhone, fmtDate, fmtDateTime, telLink, whatsappLink } from '@/lib/format';
import { useUiStore } from '@/store/ui';
import type { Density, Lead, PhoneCallStatus, PhoneLeadOutcome, Role, User } from '@/types';

const DEFAULT_WIDTHS: Record<string, number> = {
  select: 36,
  expand: 32,
  name: 210,
  title: 150,
  company: 150,
  location: 170,
  email: 210,
  priority: 100,
  assigned: 150,
  phone1: 130,
  callstatus1: 145,
  leadstatus1: 140,
  remark1: 200,
  phone2: 130,
  callstatus2: 145,
  leadstatus2: 140,
  remark2: 200,
  lastContacted: 120,
  followup: 200,
  added: 110,
};

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

const PRIORITIES = ['low', 'medium', 'high'] as const;
const PHONE_CALL_OPTIONS: PhoneCallStatus[] = ['connected', 'not_connected', 'voicemail', 'incorrect_no'];
const PHONE_LEAD_OPTIONS: PhoneLeadOutcome[] = ['interested', 'not_interested'];

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
        className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand-500"
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

/* --------------------------- per-phone cell inputs ------------------------- */

/** Phone number with copy/call/WhatsApp actions, or a dash when empty. */
function PhoneNumberCell({ lead, phone }: { lead: Lead; phone: 'phone1' | 'phone2' }) {
  const num = phone === 'phone1' ? lead.phone : lead.altPhone;
  return num ? <PhoneActions phone={num} /> : <span className="text-slate-300">—</span>;
}

/** Inline call-status dropdown for one phone (connected / not connected / voice mail / incorrect no). */
function CallStatusCell({ lead, phone }: { lead: Lead; phone: 'phone1' | 'phone2' }) {
  const update = useUpdatePhoneOutcome();
  const num = phone === 'phone1' ? lead.phone : lead.altPhone;
  const slot = phone === 'phone1' ? lead.phone1Outcome : lead.phone2Outcome;
  const value = (slot?.callStatus ?? 'pending') as PhoneCallStatus;
  if (phone === 'phone2' && !num) return <span className="text-slate-300">—</span>;
  return (
    <select
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) =>
        update.mutate(
          { id: lead._id, phone, callStatus: e.target.value as PhoneCallStatus },
          { onError: (err) => toast.error(apiError(err)) }
        )
      }
      className={`w-full rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium outline-none focus:border-brand-500 ${PHONE_CALL_STATUS_COLORS[value]}`}
    >
      <option value="pending">Not Called</option>
      <option value="connected">Connected</option>
      <option value="not_connected">Not Connected</option>
      <option value="voicemail">Voice Mail</option>
      <option value="incorrect_no">Incorrect No</option>
    </select>
  );
}

/** Inline lead-outcome dropdown for one phone (interested / not interested). */
function LeadStatusCell({ lead, phone }: { lead: Lead; phone: 'phone1' | 'phone2' }) {
  const update = useUpdatePhoneOutcome();
  const num = phone === 'phone1' ? lead.phone : lead.altPhone;
  const slot = phone === 'phone1' ? lead.phone1Outcome : lead.phone2Outcome;
  const value = (slot?.leadOutcome ?? 'none') as PhoneLeadOutcome;
  if (phone === 'phone2' && !num) return <span className="text-slate-300">—</span>;
  return (
    <select
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) =>
        update.mutate(
          { id: lead._id, phone, leadOutcome: e.target.value as PhoneLeadOutcome },
          { onError: (err) => toast.error(apiError(err)) }
        )
      }
      className={`w-full rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium outline-none focus:border-brand-500 ${PHONE_LEAD_OUTCOME_COLORS[value]}`}
    >
      <option value="none">—</option>
      <option value="interested">Interested</option>
      <option value="not_interested">Not Interested</option>
    </select>
  );
}

/** Inline remark input scoped to one phone, showing the latest phone-specific remark. */
function PhoneRemarkCell({ lead, phone }: { lead: Lead; phone: 'phone1' | 'phone2' }) {
  const [text, setText] = useState('');
  const update = useUpdatePhoneOutcome();
  const num = phone === 'phone1' ? lead.phone : lead.altPhone;
  const phoneRemarks = (lead.remarks ?? []).filter((r) => r.phone === phone || (phone === 'phone1' && !r.phone));
  const last = phoneRemarks[phoneRemarks.length - 1];

  function submit() {
    const t = text.trim();
    if (!t) return;
    setText('');
    update.mutate({ id: lead._id, phone, remark: t }, { onError: (e) => toast.error(apiError(e)) });
  }

  if (phone === 'phone2' && !num) return <span className="text-slate-300">—</span>;
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-1">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Remark…"
          className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand-500"
        />
        <button onClick={submit} className="rounded p-1 text-brand-600 hover:bg-brand-50" title="Add remark">
          <Send size={13} />
        </button>
      </div>
      {last && (
        <p className="mt-0.5 truncate text-[11px] text-slate-400" title={last.text}>
          {phoneRemarks.length}× · {last.text}
        </p>
      )}
    </div>
  );
}

/* ----------------------------- column registry ---------------------------- */

interface CellCtx {
  isAdmin: boolean;
  telecallers: User[];
  onAssign?: (id: string, tid: string, name: string) => void;
}

interface ColumnDef {
  id: string;
  label: string;
  sortField?: string;
  adminOnly?: boolean; // only rendered for superadmins
  locked?: boolean; // cannot be hidden (always visible)
  muted?: boolean; // cell gets the muted text color
  cell: (lead: Lead, ctx: CellCtx) => ReactNode;
}

// Source-of-truth column definitions. Order here is the default order; the user
// can reorder (drag) and hide/show columns — both persisted in the UI store.
const COLUMNS: ColumnDef[] = [
  {
    id: 'name',
    label: 'Name',
    sortField: 'name',
    locked: true,
    cell: (l) => (
      <div className="flex min-w-0 items-center gap-2">
        <p className="truncate font-medium text-slate-800" title={l.name}>{l.name}</p>
        <Badge className={`shrink-0 ${LEAD_STATUS_COLORS[l.status]}`}>{LEAD_STATUS_LABELS[l.status]}</Badge>
        {l.qualified && <Badge className="shrink-0 bg-green-600 text-white">Lead</Badge>}
      </div>
    ),
  },
  { id: 'title', label: 'Title', muted: true, cell: (l) => <span className="block truncate" title={l.title}>{l.title || '—'}</span> },
  { id: 'company', label: 'Company', sortField: 'company', muted: true, cell: (l) => <span className="block truncate" title={l.company}>{l.company || '—'}</span> },
  { id: 'location', label: 'Location', sortField: 'country', muted: true, cell: (l) => <span className="block truncate" title={location(l)}>{location(l) || '—'}</span> },
  {
    id: 'email',
    label: 'Email',
    muted: true,
    cell: (l) =>
      l.email ? (
        <a href={`mailto:${l.email}`} title={l.email} className="block truncate hover:text-brand-600" onClick={(e) => e.stopPropagation()}>
          {l.email}
        </a>
      ) : (
        '—'
      ),
  },
  { id: 'priority', label: 'Priority', cell: (l, ctx) => <PriorityCell lead={l} isAdmin={ctx.isAdmin} /> },
  {
    id: 'assigned',
    label: 'Assigned To',
    sortField: 'assignedAt',
    adminOnly: true,
    cell: (l, ctx) =>
      ctx.onAssign ? (
        <AssignSelect lead={l} telecallers={ctx.telecallers} onAssign={ctx.onAssign} />
      ) : (
        (l.assignedTo as User | undefined)?.name ?? <span className="text-slate-300">—</span>
      ),
  },
  { id: 'phone1', label: 'Phone 1', cell: (l) => <PhoneNumberCell lead={l} phone="phone1" /> },
  { id: 'callstatus1', label: 'Call Status 1', cell: (l) => <CallStatusCell lead={l} phone="phone1" /> },
  { id: 'leadstatus1', label: 'Lead Status 1', cell: (l) => <LeadStatusCell lead={l} phone="phone1" /> },
  { id: 'remark1', label: 'Remark 1', cell: (l) => <PhoneRemarkCell lead={l} phone="phone1" /> },
  { id: 'phone2', label: 'Phone 2', cell: (l) => <PhoneNumberCell lead={l} phone="phone2" /> },
  { id: 'callstatus2', label: 'Call Status 2', cell: (l) => <CallStatusCell lead={l} phone="phone2" /> },
  { id: 'leadstatus2', label: 'Lead Status 2', cell: (l) => <LeadStatusCell lead={l} phone="phone2" /> },
  { id: 'remark2', label: 'Remark 2', cell: (l) => <PhoneRemarkCell lead={l} phone="phone2" /> },
  { id: 'lastContacted', label: 'Last Contacted', sortField: 'lastContactedAt', muted: true, cell: (l) => (l.lastContactedAt ? fmtDate(l.lastContactedAt) : '—') },
  { id: 'followup', label: 'Follow-up', cell: (l) => <FollowUpCell lead={l} /> },
  { id: 'added', label: 'Added', sortField: 'createdAt', muted: true, cell: (l) => fmtDate(l.createdAt) },
];

const COLUMN_MAP: Record<string, ColumnDef> = Object.fromEntries(COLUMNS.map((c) => [c.id, c]));
const DEFAULT_DATA_COL_IDS = COLUMNS.map((c) => c.id);

/** Resolves the effective full data-column order from the persisted order, appending any new columns. */
function resolveOrder(stored: string[]): string[] {
  const valid = stored.filter((id) => COLUMN_MAP[id]);
  const missing = DEFAULT_DATA_COL_IDS.filter((id) => !valid.includes(id));
  return [...valid, ...missing];
}

/** Dropdown to show/hide table columns. Rendered in the contacts top bar. */
export function ColumnsMenu({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hiddenCols = useUiStore((s) => s.hiddenCols);
  const toggleCol = useUiStore((s) => s.toggleCol);
  const resetCols = useUiStore((s) => s.resetCols);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const cols = COLUMNS.filter((c) => !c.adminOnly || isAdmin);
  const hiddenCount = cols.filter((c) => hiddenCols.includes(c.id)).length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
          open || hiddenCount
            ? 'border-brand-400 bg-brand-50 text-brand-700'
            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
        }`}
      >
        <Columns3 size={13} />
        Columns
        <ChevronDown size={12} />
        {hiddenCount > 0 && <span className="ml-0.5 rounded-full bg-brand-500 px-1.5 text-[10px] font-bold text-white">{hiddenCount}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Toggle columns</span>
            <button onClick={resetCols} className="flex items-center gap-1 text-[11px] text-brand-600 hover:underline">
              <RotateCcw size={11} /> Reset
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {cols.map((c) => {
              const visible = !hiddenCols.includes(c.id);
              return (
                <label
                  key={c.id}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                    c.locked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={visible}
                    disabled={c.locked}
                    onChange={() => toggleCol(c.id)}
                    className="h-4 w-4 accent-brand-600"
                  />
                  {c.label}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
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
  const pad = density === 'compact' ? 'px-2 py-1' : 'px-2 py-2.5';

  // Resizable columns (widths persisted in the UI store).
  const storedWidths = useUiStore((s) => s.colWidths);
  const setColWidths = useUiStore((s) => s.setColWidths);
  const colOrder = useUiStore((s) => s.colOrder);
  const setColOrder = useUiStore((s) => s.setColOrder);
  const hiddenCols = useUiStore((s) => s.hiddenCols);
  const [widths, setWidths] = useState<Record<string, number>>({ ...DEFAULT_WIDTHS, ...storedWidths });
  const widthsRef = useRef(widths);
  widthsRef.current = widths;

  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // The effective, ordered & visible data columns (respects role + hidden list).
  const fullOrder = resolveOrder(colOrder);
  const visibleCols = fullOrder
    .map((id) => COLUMN_MAP[id])
    .filter((c): c is ColumnDef => !!c && (!c.adminOnly || isAdmin) && !hiddenCols.includes(c.id));

  const renderedColIds = [...(selectable ? ['select'] : []), 'expand', ...visibleCols.map((c) => c.id)];
  const widthOf = (id: string) => widths[id] ?? DEFAULT_WIDTHS[id] ?? 120;
  const totalWidth = renderedColIds.reduce((s, id) => s + widthOf(id), 0);

  function startResize(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = widthOf(id);
    const move = (ev: MouseEvent) => setWidths((p) => ({ ...p, [id]: Math.max(60, startW + ev.clientX - startX) }));
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      setColWidths(widthsRef.current);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }

  // Drag-to-reorder: operates on the full data order so hidden columns keep position.
  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setOverId(null);
      return;
    }
    const base = resolveOrder(colOrder);
    const from = base.indexOf(dragId);
    const to = base.indexOf(targetId);
    if (from !== -1 && to !== -1) {
      base.splice(to, 0, base.splice(from, 1)[0]);
      setColOrder(base);
    }
    setDragId(null);
    setOverId(null);
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

  // Header cell for a draggable, resizable, sortable data column.
  const ThData = ({ col }: { col: ColumnDef }) => (
    <th
      className={`relative select-none px-2 py-2 ${overId === col.id ? 'bg-brand-50' : ''}`}
      onDragOver={(e) => {
        if (dragId) {
          e.preventDefault();
          if (overId !== col.id) setOverId(col.id);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(col.id);
      }}
    >
      <div
        draggable
        onDragStart={() => setDragId(col.id)}
        onDragEnd={() => { setDragId(null); setOverId(null); }}
        title="Drag to reorder"
        className={`flex cursor-grab items-center gap-1 active:cursor-grabbing ${dragId === col.id ? 'opacity-40' : ''}`}
      >
        <GripVertical size={11} className="shrink-0 text-slate-300" />
        {col.sortField ? <SortHeader field={col.sortField} label={col.label} /> : <span>{col.label}</span>}
      </div>
      <span
        onMouseDown={(e) => startResize(col.id, e)}
        className="absolute right-0 top-0 z-20 h-full w-1.5 cursor-col-resize hover:bg-brand-300"
      />
    </th>
  );

  return (
    <>
      {/* Desktop grid (horizontally scrollable, resizable + reorderable columns) */}
      <div className="hidden md:block">
        <table className="text-sm" style={{ tableLayout: 'fixed', width: totalWidth }}>
          <colgroup>
            {renderedColIds.map((id) => (
              <col key={id} style={{ width: widthOf(id) }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_#e2e8f0]">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
              {selectable && (
                <th className="relative select-none px-2 py-2">
                  <input type="checkbox" className="h-4 w-4" checked={!!allChecked} onChange={onToggleAll} />
                </th>
              )}
              <th className="relative select-none px-2 py-2" />
              {visibleCols.map((col) => (
                <ThData key={col.id} col={col} />
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <Row
                key={lead._id}
                columns={visibleCols}
                lead={lead}
                isAdmin={isAdmin}
                role={role}
                pad={pad}
                selectable={selectable}
                selected={selected.includes(lead._id)}
                onToggle={onToggle}
                telecallers={telecallers}
                onAssign={onAssign}
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
      className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-brand-500"
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

/** Compact read-only call-status badges shown in the table's Outcome column. */
function PhoneSummaryBadges({ lead }: { lead: Lead }) {
  const p1 = lead.phone1Outcome?.callStatus ?? 'pending';
  const p2 = lead.phone2Outcome?.callStatus ?? 'pending';
  return (
    <div className="space-y-0.5">
      <Badge className={`${PHONE_CALL_STATUS_COLORS[p1]} text-[10px]`}>
        P1: {PHONE_CALL_STATUS_LABELS[p1]}
      </Badge>
      {lead.altPhone && (
        <Badge className={`${PHONE_CALL_STATUS_COLORS[p2]} text-[10px]`}>
          P2: {PHONE_CALL_STATUS_LABELS[p2]}
        </Badge>
      )}
    </div>
  );
}

/** Per-phone call tracking panel shown inside the expanded row. */
function PhoneOutcomePanel({
  lead,
  phone,
  isAdmin,
}: {
  lead: Lead;
  phone: 'phone1' | 'phone2';
  isAdmin: boolean;
}) {
  const phoneNumber = phone === 'phone1' ? lead.phone : lead.altPhone!;
  const slot = (phone === 'phone1' ? lead.phone1Outcome : lead.phone2Outcome) ?? {
    callStatus: 'pending' as PhoneCallStatus,
    leadOutcome: 'none' as PhoneLeadOutcome,
  };
  const [remarkText, setRemarkText] = useState('');
  const update = useUpdatePhoneOutcome();

  const phoneRemarks = (lead.remarks ?? []).filter(
    (r) => r.phone === phone || (phone === 'phone1' && !r.phone),
  );

  function setCallStatus(cs: PhoneCallStatus) {
    update.mutate({ id: lead._id, phone, callStatus: cs }, { onError: (e) => toast.error(apiError(e)) });
  }
  function setLeadOutcome(lo: PhoneLeadOutcome) {
    update.mutate({ id: lead._id, phone, leadOutcome: lo }, { onError: (e) => toast.error(apiError(e)) });
  }
  function submitRemark() {
    const t = remarkText.trim();
    if (!t) return;
    setRemarkText('');
    update.mutate({ id: lead._id, phone, remark: t }, { onError: (e) => toast.error(apiError(e)) });
  }

  const label = phone === 'phone1' ? 'Phone 1' : 'Phone 2';

  if (isAdmin) {
    return (
      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <PhoneActions phone={phoneNumber} />
          <Badge className={PHONE_CALL_STATUS_COLORS[slot.callStatus]}>
            {PHONE_CALL_STATUS_LABELS[slot.callStatus]}
          </Badge>
          {slot.leadOutcome !== 'none' && (
            <Badge className={PHONE_LEAD_OUTCOME_COLORS[slot.leadOutcome]}>
              {PHONE_LEAD_OUTCOME_LABELS[slot.leadOutcome]}
            </Badge>
          )}
        </div>
        {phoneRemarks.slice(-2).reverse().map((r, i) => (
          <div key={r._id ?? i} className="rounded bg-slate-50 p-1.5 text-xs text-slate-600">
            {r.text}
            <span className="ml-1 text-[10px] text-slate-400">{fmtDate(r.createdAt)}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <PhoneActions phone={phoneNumber} />
      <div className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
        {PHONE_CALL_OPTIONS.map((cs) => (
          <button
            key={cs}
            onClick={() => setCallStatus(cs)}
            disabled={update.isPending}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              slot.callStatus === cs
                ? `${PHONE_CALL_STATUS_COLORS[cs]} ring-1 ring-current`
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {PHONE_CALL_STATUS_LABELS[cs]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
        {PHONE_LEAD_OPTIONS.map((lo) => (
          <button
            key={lo}
            onClick={() => setLeadOutcome(lo)}
            disabled={update.isPending}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              slot.leadOutcome === lo
                ? `${PHONE_LEAD_OUTCOME_COLORS[lo]} ring-1 ring-current`
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {PHONE_LEAD_OUTCOME_LABELS[lo]}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <input
          value={remarkText}
          onChange={(e) => setRemarkText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitRemark()}
          placeholder={`Remark for ${label}…`}
          className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand-500"
        />
        <button onClick={submitRemark} className="rounded p-1 text-brand-600 hover:bg-brand-50" title="Send">
          <Send size={13} />
        </button>
      </div>
      {phoneRemarks.slice(-2).reverse().map((r, i) => (
        <p key={r._id ?? i} className="truncate text-[11px] text-slate-400" title={r.text}>
          {r.text}
        </p>
      ))}
    </div>
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
    <div className="space-y-4 bg-slate-50 p-4">
      {/* Per-phone call tracking */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PhoneOutcomePanel lead={lead} phone="phone1" isAdmin={isAdmin} />
        {lead.altPhone && <PhoneOutcomePanel lead={lead} phone="phone2" isAdmin={isAdmin} />}
      </div>

      {/* Contact details, timestamps, and full remarks timeline */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-2 text-sm">
          {lead.email && <Detail label="Email" value={lead.email} />}
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
          <p className="mb-1 text-xs font-semibold text-slate-500">All Remarks</p>
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
                    {r.byRole ? ` (${r.byRole === 'superadmin' ? 'Admin' : 'User'})` : ''}
                    {r.phone ? ` · ${r.phone === 'phone1' ? 'Phone 1' : 'Phone 2'}` : ''} ·{' '}
                    {fmtDateTime(r.createdAt)}
                  </p>
                </div>
              ))}
          </div>
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
  columns,
  isAdmin,
  pad,
  selectable,
  selected,
  onToggle,
  telecallers,
  onAssign,
}: {
  lead: Lead;
  columns: ColumnDef[];
  isAdmin: boolean;
  role: Role;
  pad: string;
  selectable?: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
  telecallers: User[];
  onAssign?: (id: string, tid: string, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const muted = 'text-slate-500';
  const ctx: CellCtx = { isAdmin, telecallers, onAssign };

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
        {columns.map((col) => (
          <td key={col.id} className={col.muted ? `${pad} ${muted}` : pad}>
            {col.cell(lead, ctx)}
          </td>
        ))}
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
}: {
  lead: Lead;
  isAdmin: boolean;
  role: Role;
  selectable?: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
  telecallers: User[];
  onAssign?: (id: string, tid: string, name: string) => void;
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
            <PhoneSummaryBadges lead={lead} />
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
