import { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Field';
import { useLogCall } from '@/api/calls';
import { apiError } from '@/api/client';
import { DISPOSITION_LABELS, DISPOSITIONS } from '@/lib/constants';
import type { Disposition, Lead } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  lead: Lead | null;
}

const NEEDS_FOLLOWUP: Disposition[] = ['callback', 'busy', 'switched_off', 'interested'];

export function LogCallModal({ open, onClose, lead }: Props) {
  const logCall = useLogCall();
  const [disposition, setDisposition] = useState<Disposition>('interested');
  const [notes, setNotes] = useState('');
  const [nextFollowUpAt, setNextFollowUpAt] = useState('');

  if (!lead) return null;

  async function handleSubmit() {
    try {
      await logCall.mutateAsync({
        lead: lead!._id,
        disposition,
        notes,
        nextFollowUpAt: nextFollowUpAt || undefined,
      });
      toast.success('Call logged');
      setNotes('');
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
      title={`Log call — ${lead.name}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={logCall.isPending}>
            Save call
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <Label>Disposition</Label>
          <Select value={disposition} onChange={(e) => setDisposition(e.target.value as Disposition)}>
            {DISPOSITIONS.map((d) => (
              <option key={d} value={d}>
                {DISPOSITION_LABELS[d]}
              </option>
            ))}
          </Select>
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
        <div>
          <Label>Notes</Label>
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What happened on the call?"
          />
        </div>
      </div>
    </Modal>
  );
}
