import { useEffect, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react';
import { useCallStore } from '@/store/call';

function fmtElapsed(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Floating in-call bar; persists across routes while a call is active. */
export function CallBar() {
  const phase = useCallStore((s) => s.phase);
  const leadName = useCallStore((s) => s.leadName);
  const phone = useCallStore((s) => s.phone);
  const startedAt = useCallStore((s) => s.startedAt);
  const muted = useCallStore((s) => s.muted);
  const error = useCallStore((s) => s.error);
  const toggleMute = useCallStore((s) => s.toggleMute);
  const hangup = useCallStore((s) => s.hangup);

  const [elapsed, setElapsed] = useState(0);

  // Tick the live timer once the call is connected.
  useEffect(() => {
    if (phase !== 'in_call' || !startedAt) return;
    setElapsed(Math.round((Date.now() - startedAt) / 1000));
    const id = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [phase, startedAt]);

  // Only show while a call is live (the disposition modal takes over once ended).
  if (phase !== 'connecting' && phase !== 'ringing' && phase !== 'in_call') return null;

  const statusText =
    phase === 'connecting' ? 'Connecting…' : phase === 'ringing' ? 'Ringing…' : fmtElapsed(elapsed);

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-4 sm:bottom-4">
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          <Phone size={16} />
          {phase !== 'in_call' && (
            <span className="absolute inset-0 animate-ping rounded-full border-2 border-emerald-400/70" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {leadName || phone || 'Call'}
          </p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {error ? <span className="text-rose-600">{error}</span> : statusText}
          </p>
        </div>

        <button
          onClick={toggleMute}
          disabled={phase !== 'in_call'}
          title={muted ? 'Unmute' : 'Mute'}
          className="rounded-full p-2.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {muted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        <button
          onClick={hangup}
          title="Hang up"
          className="rounded-full bg-rose-600 p-2.5 text-white hover:bg-rose-700"
        >
          <PhoneOff size={18} />
        </button>
      </div>
    </div>
  );
}
