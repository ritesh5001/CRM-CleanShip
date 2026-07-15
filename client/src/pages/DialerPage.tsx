import { useEffect, useState } from 'react';
import { Delete, Phone, AlertTriangle } from 'lucide-react';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Misc';
import { Keypad } from '@/features/calls/Keypad';
import { useCallConfig } from '@/api/calls';
import { useCallStore } from '@/store/call';
import { toE164 } from '@/lib/phone';

/**
 * Dial any number that isn't a saved contact. The call still gets logged (and can
 * be saved as a contact afterwards) via the usual disposition flow.
 */
export function DialerPage() {
  const [number, setNumber] = useState('');
  const config = useCallConfig().data;
  const startCall = useCallStore((s) => s.startCall);
  const phase = useCallStore((s) => s.phase);
  const error = useCallStore((s) => s.error);

  const callActive = phase === 'connecting' || phase === 'ringing' || phase === 'in_call';
  const defaultCode = config?.defaultCountryCode || '';
  // Show what will actually be dialled, so a missing country code is obvious
  // before the call fails rather than after.
  const typed = number.trim();
  const e164 = typed ? toE164(number, null, defaultCode) : '';
  const valid = e164 ? isValidPhoneNumber(e164) : false;
  // A local number with no default country code configured can't be resolved to
  // E.164 — that's a setup gap, not a typo, so say which it is.
  const needsCountryCode = Boolean(typed) && !valid && !typed.startsWith('+') && !defaultCode;

  // Type on the physical keyboard as well as the on-screen pad.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (callActive) return; // digits belong to the in-call keypad instead
      if (/^[0-9*#+]$/.test(e.key)) setNumber((n) => n + e.key);
      else if (e.key === 'Backspace') setNumber((n) => n.slice(0, -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [callActive]);

  function dial() {
    if (!valid || callActive) return;
    startCall({ leadId: null, name: '', phone: e164 });
  }

  const cannotCall = !config?.enabled;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-slate-100">
          <Phone size={20} /> Dialer
        </h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Call any number. You can save it as a contact after the call.
        </p>
      </div>

      {cannotCall && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            {config && !config.configured
              ? 'Browser calling isn’t set up yet — ask your admin to configure Twilio in Integrations.'
              : 'No calling number is assigned to you. Ask your admin to assign one on the Integrations page.'}
          </span>
        </div>
      )}

      <Card className="mx-auto max-w-xs p-4">
        <div className="mb-3">
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && dial()}
            placeholder="Enter a number"
            inputMode="tel"
            aria-label="Phone number"
            className="w-full bg-transparent text-center text-2xl font-semibold tracking-wider text-slate-800 outline-none placeholder:text-lg placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 dark:text-slate-100"
          />
          <div className="mt-1 flex min-h-4 items-center justify-center px-1 text-center">
            {needsCountryCode ? (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                Add a country code (e.g. +1), or set a default one in Integrations.
              </span>
            ) : typed && !valid ? (
              <span className="text-xs text-rose-600">Not a valid number</span>
            ) : valid && e164 !== typed ? (
              <span className="text-xs text-slate-400 dark:text-slate-500">Dials as {e164}</span>
            ) : null}
          </div>
        </div>

        <Keypad disabled={callActive} onPress={(d) => setNumber((n) => n + d)} />

        <div className="mt-3 flex items-center gap-2">
          <Button
            variant="success"
            className="flex-1"
            disabled={!valid || callActive || cannotCall}
            onClick={dial}
          >
            <Phone size={15} /> {callActive ? 'In call…' : 'Call'}
          </Button>
          <Button
            variant="secondary"
            aria-label="Delete last digit"
            disabled={!number}
            onClick={() => setNumber((n) => n.slice(0, -1))}
          >
            <Delete size={15} />
          </Button>
        </div>

        {error && !callActive && <p className="mt-2 text-center text-xs text-rose-600">{error}</p>}
      </Card>
    </div>
  );
}
