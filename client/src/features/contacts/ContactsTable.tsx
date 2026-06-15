import { Phone, MessageCircle, MessageSquare } from 'lucide-react';
import { Badge, EmptyState, Spinner } from '@/components/ui/Misc';
import {
  CALL_STATUS_COLORS,
  CALL_STATUS_LABELS,
  LEAD_STATUS_COLORS,
  LEAD_STATUS_LABELS,
} from '@/lib/constants';
import { telLink, whatsappLink } from '@/lib/format';
import type { CallStatus, Lead, Role, User } from '@/types';

interface Props {
  leads: Lead[];
  isLoading: boolean;
  role: Role;
  selectable?: boolean;
  selected: string[];
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onOpen: (lead: Lead) => void;
  emptyHint?: string;
}

function location(l: Lead) {
  return [l.city, l.state, l.country].filter(Boolean).join(', ');
}

export function ContactsTable({
  leads,
  isLoading,
  role,
  selectable,
  selected,
  onToggle,
  onToggleAll,
  onOpen,
  emptyHint,
}: Props) {
  const isAdmin = role === 'superadmin';

  if (isLoading) return <Spinner />;
  if (!leads.length) return <EmptyState title="Nothing here yet" hint={emptyHint} />;

  const allChecked = selectable && leads.every((l) => selected.includes(l._id));

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              {selectable && (
                <th className="p-3">
                  <input type="checkbox" className="h-4 w-4" checked={!!allChecked} onChange={onToggleAll} />
                </th>
              )}
              <th className="p-3">Name</th>
              <th className="p-3">Company</th>
              <th className="p-3">Location</th>
              <th className="p-3">Status</th>
              <th className="p-3">Call</th>
              {isAdmin && <th className="p-3">Assigned To</th>}
              <th className="p-3">Remarks</th>
              <th className="p-3">Contact</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const assignee = lead.assignedTo as User | undefined;
              return (
                <tr
                  key={lead._id}
                  className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                  onClick={() => onOpen(lead)}
                >
                  {selectable && (
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={selected.includes(lead._id)}
                        onChange={() => onToggle(lead._id)}
                      />
                    </td>
                  )}
                  <td className="p-3">
                    <p className="font-medium text-slate-800">{lead.name}</p>
                    {lead.title && <p className="text-xs text-slate-400">{lead.title}</p>}
                  </td>
                  <td className="p-3 text-slate-600">{lead.company || '—'}</td>
                  <td className="p-3 text-slate-500">{location(lead) || '—'}</td>
                  <td className="p-3">
                    <Badge className={LEAD_STATUS_COLORS[lead.status]}>
                      {LEAD_STATUS_LABELS[lead.status]}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Badge className={CALL_STATUS_COLORS[(lead.callStatus ?? 'pending') as CallStatus]}>
                      {CALL_STATUS_LABELS[(lead.callStatus ?? 'pending') as CallStatus]}
                    </Badge>
                  </td>
                  {isAdmin && (
                    <td className="p-3 text-slate-600">{assignee?.name ?? <span className="text-slate-300">Unassigned</span>}</td>
                  )}
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <MessageSquare size={14} /> {lead.remarks?.length ?? 0}
                    </span>
                  </td>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1.5">
                      <a href={telLink(lead.phone)} className="rounded p-1.5 text-brand-600 hover:bg-brand-50" title={lead.phone}>
                        <Phone size={15} />
                      </a>
                      <a
                        href={whatsappLink(lead.phone)}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50"
                      >
                        <MessageCircle size={15} />
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="divide-y divide-slate-100 md:hidden">
        {leads.map((lead) => {
          const assignee = lead.assignedTo as User | undefined;
          return (
            <div key={lead._id} className="flex items-center gap-3 p-3" onClick={() => onOpen(lead)}>
              {selectable && (
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={selected.includes(lead._id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => onToggle(lead._id)}
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-slate-800">{lead.name}</p>
                  <Badge className={CALL_STATUS_COLORS[(lead.callStatus ?? 'pending') as CallStatus]}>
                    {CALL_STATUS_LABELS[(lead.callStatus ?? 'pending') as CallStatus]}
                  </Badge>
                </div>
                <p className="truncate text-sm text-slate-500">
                  {lead.phone}
                  {lead.company ? ` · ${lead.company}` : ''}
                </p>
                <p className="text-xs text-slate-400">
                  {isAdmin ? (assignee?.name ?? 'Unassigned') : LEAD_STATUS_LABELS[lead.status]}
                  {lead.remarks?.length ? ` · ${lead.remarks.length} remark(s)` : ''}
                </p>
              </div>
              <a
                href={telLink(lead.phone)}
                onClick={(e) => e.stopPropagation()}
                className="rounded-lg bg-brand-50 p-2 text-brand-600"
              >
                <Phone size={16} />
              </a>
            </div>
          );
        })}
      </div>
    </>
  );
}
