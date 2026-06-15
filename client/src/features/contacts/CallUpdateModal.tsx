import { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Field';
import { useLogCall } from '@/api/calls';
import { apiError } from '@/api/client';
import { DISPOSITION_LABELS, DISPOSITIONS } from '@/lib/constants';
import type { CallStatus, Disposition, Lead } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  lead: Lead | null;
}

const NEEDS_FOLLOWUP: Disposition[] = ['callback', 'busy', 'switched_off', 'interested'];

export function CallUpdateModal({ open, onClose, lead }: Props) {
  const logCall = useLogCall();
  const [callStatus, setCallStatus] = useState<CallStatus>('done');
  const [disposition, setDisposition] = useState<Disposition>('interested');
  const [remark, setRemark] = useState('');
  const [nextFollowUpAt, setNextFollowUpAt] = useState('');

  if (!lead) return null;

  async function handleSubmit() {
    try {
      await logCall.mutateAsync({
        lead: lead!._id,
        callStatus,
        disposition: callStatus === 'done' ? disposition : undefined,
        remark,
        nextFollowUpAt: callStatus === 'done' && nextFollowUpAt ? nextFollowUpAt : undefined,
      });
      toast.success(callStatus === 'done' ? 'Call logged' : 'Marked not done');
      setRemark('');
      setNextFollowUpAt('');
      onClose();
    } catch (err) {
      toast.error(apiError(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Update call — ${lead.name}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={logCall.isPending}>
            Save update
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <Label>Call status</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setCallStatus('done')}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                callStatus === 'done'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-slate-300 text-slate-600'
              }`}
            >
              ✓ Call Done
            </button>
            <button
              type="button"
              onClick={() => setCallStatus('not_done')}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                callStatus === 'not_done'
                  ? 'border-amber-500 bg-amber-50 text-amber-700'
                  : 'border-slate-300 text-slate-600'
              }`}
            >
              ✕ Not Done
            </button>
          </div>
        </div>

        {callStatus === 'done' && (
          <>
            <div>
              <Label>Outcome</Label>
              <Select value={disposition} onChange={(e) => setDisposition(e.target.value as Disposition)}>
                {DISPOSITIONS.map((d) => (
                  <option key={d} value={d}>
                    {DISPOSITION_LABELS[d]}
                  </option>
                ))}
              </Select>
              {(disposition === 'interested' || disposition === 'converted') && (
                <p className="mt-1 text-xs text-emerald-600">
                  This contact will be promoted to a Lead.
                </p>
              )}
            </div>
            {NEEDS_FOLLOWUP.includes(disposition) && (
              <div>
                <Label>Schedule follow-up</Label>
                <Input
                  type="datetime-local"
                  value={nextFollowUpAt}
                  onChange={(e) => setNextFollowUpAt(e.target.value)}
                />
              </div>
            )}
          </>
        )}

        <div>
          <Label>Remark</Label>
          <Textarea
            rows={3}
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="What happened on the call / the update?"
          />
        </div>
      </div>
    </Modal>
  );
}
