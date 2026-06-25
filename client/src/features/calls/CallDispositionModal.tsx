import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Label, Select, Textarea, Input } from '@/components/ui/Field';
import { apiError } from '@/api/client';
import { useLogCall } from '@/api/calls';
import { DISPOSITION_LABELS, DISPOSITIONS } from '@/lib/constants';
import { useCallStore } from '@/store/call';
import type { CallStatus, Disposition } from '@/types';

function fmtDuration(sec: number) {
  if (!sec) return '0s';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}

/** Opens automatically after a Twilio call ends to capture the outcome. */
export function CallDispositionModal() {
  const pending = useCallStore((s) => s.pending);
  const clearPending = useCallStore((s) => s.clearPending);
  const logCall = useLogCall();

  const [callStatus, setCallStatus] = useState<CallStatus>('done');
  const [disposition, setDisposition] = useState<Disposition>('interested');
  const [remark, setRemark] = useState('');
  const [nextFollowUpAt, setNextFollowUpAt] = useState('');

  // Reset the form each time a new call ends.
  useEffect(() => {
    if (pending) {
      setCallStatus('done');
      setDisposition('interested');
      setRemark('');
      setNextFollowUpAt('');
    }
  }, [pending]);

  if (!pending) return null;

  function submit() {
    if (!pending) return;
    logCall.mutate(
      {
        lead: pending.leadId,
        callStatus,
        disposition: callStatus === 'done' ? disposition : undefined,
        remark: remark.trim() || undefined,
        durationSec: pending.durationSec,
        nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt).toISOString() : undefined,
        twilioCallSid: pending.twilioCallSid,
      },
      {
        onSuccess: () => {
          toast.success('Call logged');
          clearPending();
        },
        onError: (err) => toast.error(apiError(err)),
      }
    );
  }

  return (
    <Modal
      open
      onClose={clearPending}
      title="Call outcome"
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={clearPending} disabled={logCall.isPending}>
            Skip
          </Button>
          <Button onClick={submit} loading={logCall.isPending}>
            Save outcome
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">
          <p className="font-medium text-slate-800 dark:text-slate-100">{pending.leadName || pending.phone}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Duration: {fmtDuration(pending.durationSec)}
          </p>
        </div>

        <div>
          <Label>Call status</Label>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={callStatus === 'done' ? 'success' : 'secondary'}
              onClick={() => setCallStatus('done')}
            >
              Connected
            </Button>
            <Button
              size="sm"
              variant={callStatus === 'not_done' ? 'danger' : 'secondary'}
              onClick={() => setCallStatus('not_done')}
            >
              Not connected
            </Button>
          </div>
        </div>

        {callStatus === 'done' && (
          <div>
            <Label htmlFor="disposition">Outcome</Label>
            <Select
              id="disposition"
              value={disposition}
              onChange={(e) => setDisposition(e.target.value as Disposition)}
            >
              {DISPOSITIONS.map((d) => (
                <option key={d} value={d}>
                  {DISPOSITION_LABELS[d]}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div>
          <Label htmlFor="remark">Remark</Label>
          <Textarea
            id="remark"
            rows={2}
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="What happened on the call?"
          />
        </div>

        <div>
          <Label htmlFor="followup">Next follow-up (optional)</Label>
          <Input
            id="followup"
            type="date"
            value={nextFollowUpAt}
            onChange={(e) => setNextFollowUpAt(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
