import { useState } from 'react';
import { Plus, Upload, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLeads, useAssignLead, useBulkAssignLeads } from '@/api/leads';
import { useTelecallers } from '@/api/users';
import { apiError } from '@/api/client';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Card } from '@/components/ui/Misc';
import { ContactsTable } from './ContactsTable';
import { LeadFormModal } from '@/features/leads/LeadFormModal';
import { ImportModal } from '@/features/leads/ImportModal';
import { LEAD_STATUS_LABELS } from '@/lib/constants';
import type { LeadStatus } from '@/types';

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

export function ContactsView({ mode }: { mode: 'contacts' | 'leads' }) {
  const role = useAuthStore((s) => s.user!.role);
  const isAdmin = role === 'superadmin';
  const isContacts = mode === 'contacts';

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [callStatus, setCallStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const { data, isLoading } = useLeads({
    search,
    status,
    callStatus,
    qualified: isContacts ? undefined : 'true',
    page,
  });

  const leads = data?.data ?? [];
  // Bulk assign + import only on the all-contacts view for the superadmin.
  const selectable = isAdmin && isContacts;

  // Telecaller list + assign (superadmin only).
  const { data: tcData } = useTelecallers({ isActive: 'true', limit: 100 }, { enabled: isAdmin });
  const telecallers = tcData?.data ?? [];
  const assign = useAssignLead();
  const bulkAssign = useBulkAssignLeads();

  function handleAssign(leadId: string, telecallerId: string, name: string) {
    assign.mutate(
      { id: leadId, assignedTo: telecallerId, assignedToName: name },
      { onSuccess: () => toast.success('Assigned'), onError: (err) => toast.error(apiError(err)) }
    );
  }

  function handleBulkAssign(telecallerId: string) {
    const t = telecallers.find((x) => x._id === telecallerId);
    if (!t || !selected.length) return;
    bulkAssign.mutate(
      { leadIds: selected, assignedTo: telecallerId, assignedToName: t.name },
      {
        onSuccess: () => {
          toast.success(`Assigned ${selected.length} contact(s) to ${t.name}`);
          setSelected([]);
        },
        onError: (err) => toast.error(apiError(err)),
      }
    );
  }

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  function toggleAll() {
    setSelected((s) => (leads.every((l) => s.includes(l._id)) ? [] : leads.map((l) => l._id)));
  }

  const title = isContacts ? (isAdmin ? 'Contacts' : 'My Contacts') : isAdmin ? 'Leads' : 'My Leads';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{title}</h1>
          <p className="text-sm text-slate-400">
            {isContacts
              ? isAdmin
                ? 'All uploaded contacts. Assign them and track calls — all inline.'
                : 'Your contacts. Set the outcome and add remarks right in the row.'
              : isAdmin
                ? 'Interested contacts that converted into leads.'
                : 'Your contacts that turned into interested leads.'}
          </p>
        </div>
        {selectable && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload size={16} /> Import
            </Button>
            <Button onClick={() => setFormOpen(true)}>
              <Plus size={16} /> Add contact
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <Input
            className="pl-9"
            placeholder="Search name, phone, email, company…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          className="w-40"
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
        <Select
          className="w-36"
          value={callStatus}
          onChange={(e) => {
            setCallStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All calls</option>
          <option value="pending">Not Called</option>
          <option value="done">Call Done</option>
          <option value="not_done">Not Done</option>
        </Select>
      </div>

      {/* Inline bulk-assign bar */}
      {selectable && selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-brand-50 px-4 py-2 text-sm">
          <span className="font-medium">{selected.length} selected</span>
          <Select
            className="w-52"
            value=""
            onChange={(e) => handleBulkAssign(e.target.value)}
          >
            <option value="">Assign selected to…</option>
            {telecallers.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
            Clear
          </Button>
        </div>
      )}

      <Card>
        <ContactsTable
          leads={leads}
          isLoading={isLoading}
          role={role}
          selectable={selectable}
          selected={selected}
          onToggle={toggle}
          onToggleAll={toggleAll}
          telecallers={telecallers}
          onAssign={isAdmin ? handleAssign : undefined}
          emptyHint={
            isContacts
              ? isAdmin
                ? 'Import or add contacts to begin.'
                : 'No contacts assigned to you yet.'
              : 'No leads yet — set a call outcome to “Interested” to create one.'
          }
        />
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

      {isAdmin && (
        <>
          <LeadFormModal open={formOpen} onClose={() => setFormOpen(false)} />
          <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
        </>
      )}
    </div>
  );
}
