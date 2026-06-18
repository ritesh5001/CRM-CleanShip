import { useState } from 'react';
import { Phone, MessageCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useFollowUps, useMarkFollowUpDone } from '@/api/followups';
import { Button } from '@/components/ui/Button';
import { Badge, Card, EmptyState, Spinner } from '@/components/ui/Misc';
import { fmtDateTime, isOverdue, telLink, whatsappLink } from '@/lib/format';
import { apiError } from '@/api/client';
import type { Lead } from '@/types';

const SCOPES = [
  { key: 'today', label: 'Today' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'all', label: 'All' },
];

export function FollowUpsPage() {
  const [scope, setScope] = useState('today');
  const { data, isLoading } = useFollowUps({ scope });
  const markDone = useMarkFollowUpDone();

  async function handleDone(id: string) {
    try {
      await markDone.mutateAsync(id);
      toast.success('Follow-up completed');
    } catch (e) {
      toast.error(apiError(e));
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Follow-ups</h1>

      <div className="flex flex-wrap gap-2">
        {SCOPES.map((s) => (
          <button
            key={s.key}
            onClick={() => setScope(s.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              scope === s.key
                ? 'bg-brand-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <Card>
        {isLoading ? (
          <Spinner />
        ) : !data?.data.length ? (
          <EmptyState title="No follow-ups" hint="You're all caught up here." />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.data.map((f) => {
              const lead = f.lead as Lead;
              const overdue = isOverdue(f.scheduledAt);
              return (
                <div key={f._id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-800 dark:text-slate-100">{lead?.name}</p>
                      {overdue && <Badge className="bg-rose-100 text-rose-700">Overdue</Badge>}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{lead?.phone}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Scheduled {fmtDateTime(f.scheduledAt)}</p>
                    {f.notes && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">“{f.notes}”</p>}
                  </div>
                  <div className="flex gap-1.5">
                    {lead?.phone && (
                      <>
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
                      </>
                    )}
                    <Button size="sm" variant="success" onClick={() => handleDone(f._id)}>
                      <CheckCircle2 size={14} /> Done
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
