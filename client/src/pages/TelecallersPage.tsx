import { useState } from 'react';
import { Plus, Pencil, KeyRound, Power, Trash2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useTelecallers,
  useSetTelecallerStatus,
  useResetTelecallerPassword,
  useDeleteTelecaller,
} from '@/api/users';
import { apiError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Badge, Card, EmptyState, Spinner } from '@/components/ui/Misc';
import { TelecallerFormModal } from '@/features/telecallers/TelecallerFormModal';
import { fmtRelative } from '@/lib/format';
import type { User } from '@/types';

export function TelecallersPage() {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  const { data, isLoading } = useTelecallers({ search });
  const setStatus = useSetTelecallerStatus();
  const resetPw = useResetTelecallerPassword();
  const del = useDeleteTelecaller();

  async function handleReset(u: User) {
    const pw = prompt(`New password for ${u.name}:`);
    if (!pw) return;
    try {
      await resetPw.mutateAsync({ id: u._id, newPassword: pw });
      toast.success('Password reset');
    } catch (e) {
      toast.error(apiError(e));
    }
  }

  async function handleDelete(u: User) {
    if (!confirm(`Delete telecaller "${u.name}"? This cannot be undone.`)) return;
    try {
      await del.mutateAsync(u._id);
      toast.success('Telecaller deleted');
    } catch (e) {
      toast.error(apiError(e));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">Telecallers</h1>
        <Button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus size={16} /> Add telecaller
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
        <Input
          className="pl-9"
          placeholder="Search by name, email, phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        {isLoading ? (
          <Spinner />
        ) : !data?.data.length ? (
          <EmptyState title="No telecallers yet" hint="Add your first telecaller to get started." />
        ) : (
          <div className="divide-y divide-slate-100">
            {data.data.map((u) => (
              <div key={u._id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700">
                  {u.name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-800">{u.name}</p>
                    <Badge className={u.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="truncate text-sm text-slate-500">{u.email}</p>
                  <p className="text-xs text-slate-400">
                    Target: {u.dailyTarget}/day · Last login {fmtRelative(u.lastLoginAt)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(u);
                      setModalOpen(true);
                    }}
                  >
                    <Pencil size={15} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleReset(u)}>
                    <KeyRound size={15} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setStatus.mutate({ id: u._id, isActive: !u.isActive })}
                  >
                    <Power size={15} className={u.isActive ? 'text-emerald-600' : 'text-slate-400'} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(u)}>
                    <Trash2 size={15} className="text-rose-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <TelecallerFormModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />
    </div>
  );
}
