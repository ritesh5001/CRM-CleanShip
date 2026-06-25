import { useEffect, useState } from 'react';
import { Play, Mic } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCalls, fetchRecordingObjectUrl } from '@/api/calls';
import { apiError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Misc';
import { DISPOSITION_LABELS } from '@/lib/constants';
import { fmtDateTime } from '@/lib/format';
import type { Disposition } from '@/types';

function fmtDuration(sec?: number) {
  if (!sec) return '0s';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}

/** Lazily downloads (auth-proxied) and plays a single call recording. */
function RecordingPlayer({ callId }: { callId: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Release the object URL when this player unmounts.
  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);

  async function load() {
    setLoading(true);
    try {
      setSrc(await fetchRecordingObjectUrl(callId));
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoading(false);
    }
  }

  if (src) return <audio controls autoPlay src={src} className="h-8 w-56 max-w-full" />;
  return (
    <Button size="sm" variant="secondary" onClick={load} loading={loading}>
      <Play size={13} /> Play recording
    </Button>
  );
}

/** Call log + recordings for one lead, shown in the expanded contact detail. */
export function CallHistory({ leadId }: { leadId: string }) {
  const { data, isLoading } = useCalls({ lead: leadId });
  const calls = data?.data ?? [];

  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
        <Mic size={13} /> Calls &amp; recordings
      </p>
      {isLoading ? (
        <Spinner />
      ) : !calls.length ? (
        <p className="text-xs text-slate-400 dark:text-slate-500">No calls logged yet.</p>
      ) : (
        <div className="max-h-48 space-y-1.5 overflow-y-auto">
          {calls.map((c) => (
            <div
              key={c._id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-2 dark:bg-slate-800"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  {DISPOSITION_LABELS[c.disposition as Disposition] ?? c.disposition}
                  <span className="ml-1.5 font-normal text-slate-400 dark:text-slate-500">
                    · {fmtDuration(c.durationSec)}
                  </span>
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">{fmtDateTime(c.createdAt)}</p>
              </div>
              {c.recordingUrl ? (
                <RecordingPlayer callId={c._id} />
              ) : (
                <span className="text-[10px] text-slate-400 dark:text-slate-500">No recording</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
