import { useState } from 'react';
import { Plus, Upload, Search, Phone, MessageCircle, PhoneCall, UserPlus } from 'lucide-react';
import { useLeads } from '@/api/leads';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Badge, Card, EmptyState, Spinner } from '@/components/ui/Misc';
import { LEAD_STATUS_COLORS, LEAD_STATUS_LABELS, PRIORITY_COLORS } from '@/lib/constants';
import { telLink, whatsappLink, fmtDate } from '@/lib/format';
import { LeadFormModal } from '@/features/leads/LeadFormModal';
import { ImportModal } from '@/features/leads/ImportModal';
import { AssignModal } from '@/features/leads/AssignModal';
import { LogCallModal } from '@/features/leads/LogCallModal';
import type { Lead, LeadStatus, User } from '@/types';

const STATUSES: LeadStatus[] = [
  'new',
  'assigned',
  'in_progress',
  'interested',
  'callback',
  'not_interested',
  'converted',
  'dnd',
];

export function LeadsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'superadmin';

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [assignIds, setAssignIds] = useState<string[] | null>(null);
  const [callLead, setCallLead] = useState<Lead | null>(null);

  const { data, isLoading } = useLeads({ search, status, page });

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">{isAdmin ? 'Leads' : 'My Leads'}</h1>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload size={16} /> Import
            </Button>
            <Button onClick={() => setFormOpen(true)}>
              <Plus size={16} /> Add lead
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <Input
            className="pl-9"
            placeholder="Search name, phone, email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          className="w-44"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {LEAD_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      {/* Bulk-assign bar (admin) */}
      {isAdmin && selected.length > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-brand-50 px-4 py-2 text-sm">
          <span>{selected.length} selected</span>
          <Button size="sm" onClick={() => setAssignIds(selected)}>
            <UserPlus size={14} /> Assign selected
          </Button>
        </div>
      )}

      <Card>
        {isLoading ? (
          <Spinner />
        ) : !data?.data.length ? (
          <EmptyState title="No leads found" hint={isAdmin ? 'Import or add leads to begin.' : 'No leads assigned to you yet.'} />
        ) : (
          <div className="divide-y divide-slate-100">
            {data.data.map((lead) => {
              const assignee = lead.assignedTo as User | undefined;
              return (
                <div key={lead._id} className="flex flex-wrap items-center gap-3 p-4">
                  {isAdmin && (
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selected.includes(lead._id)}
                      onChange={() => toggle(lead._id)}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-800">{lead.name}</p>
                      <Badge className={LEAD_STATUS_COLORS[lead.status]}>
                        {LEAD_STATUS_LABELS[lead.status]}
                      </Badge>
                      <Badge className={PRIORITY_COLORS[lead.priority]}>{lead.priority}</Badge>
                    </div>
                    <p className="text-sm text-slate-500">
                      {lead.phone}
                      {lead.company ? ` · ${lead.company}` : ''}
                      {lead.city ? ` · ${lead.city}` : ''}
                    </p>
                    <p className="text-xs text-slate-400">
                      {isAdmin
                        ? assignee
                          ? `Assigned to ${assignee.name}`
                          : 'Unassigned'
                        : lead.nextFollowUpAt
                          ? `Next follow-up ${fmtDate(lead.nextFollowUpAt)}`
                          : ''}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {/* Click-to-call (everyone) */}
                    <a href={telLink(lead.phone)}>
                      <Button size="sm" variant="secondary">
                        <Phone size={14} /> Call
                      </Button>
                    </a>
                    <a href={whatsappLink(lead.phone)} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="ghost">
                        <MessageCircle size={14} className="text-emerald-600" />
                      </Button>
                    </a>
                    {!isAdmin && (
                      <Button size="sm" onClick={() => setCallLead(lead)}>
                        <PhoneCall size={14} /> Log
                      </Button>
                    )}
                    {isAdmin && (
                      <Button size="sm" variant="ghost" onClick={() => setAssignIds([lead._id])}>
                        <UserPlus size={14} />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-slate-500">
            Page {data.pagination.page} of {data.pagination.totalPages}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={page >= data.pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <LeadFormModal open={formOpen} onClose={() => setFormOpen(false)} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <AssignModal
        open={!!assignIds}
        leadIds={assignIds ?? []}
        onClose={() => {
          setAssignIds(null);
          setSelected([]);
        }}
      />
      <LogCallModal open={!!callLead} lead={callLead} onClose={() => setCallLead(null)} />
    </div>
  );
}
