import { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Label, Select } from '@/components/ui/Field';
import { useAssignLead, useBulkAssignLeads } from '@/api/leads';
import { useTelecallers } from '@/api/users';
import { apiError } from '@/api/client';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Single lead id, or array for bulk assign. */
  leadIds: string[];
}

export function AssignModal({ open, onClose, leadIds }: Props) {
  const { data: telecallers } = useTelecallers({ isActive: 'true', limit: 100 }, { enabled: open });
  const assign = useAssignLead();
  const bulkAssign = useBulkAssignLeads();
  const [assignedTo, setAssignedTo] = useState('');

  async function handleAssign() {
    if (!assignedTo) return toast.error('Select a telecaller');
    try {
      if (leadIds.length === 1) {
        await assign.mutateAsync({ id: leadIds[0], assignedTo });
      } else {
        await bulkAssign.mutateAsync({ leadIds, assignedTo });
      }
      toast.success(`Assigned ${leadIds.length} lead(s)`);
      onClose();
    } catch (err) {
      toast.error(apiError(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Assign ${leadIds.length} lead(s)`}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAssign} loading={assign.isPending || bulkAssign.isPending}>
            Assign
          </Button>
        </div>
      }
    >
      <Label>Telecaller</Label>
      <Select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
        <option value="">Select telecaller…</option>
        {telecallers?.data.map((t) => (
          <option key={t._id} value={t._id}>
            {t.name}
          </option>
        ))}
      </Select>
    </Modal>
  );
}
