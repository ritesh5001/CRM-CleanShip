import { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Field';
import { useCreateLead } from '@/api/leads';
import { useTelecallers } from '@/api/users';
import { apiError } from '@/api/client';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function LeadFormModal({ open, onClose }: Props) {
  const create = useCreateLead();
  const { data: telecallers } = useTelecallers({ isActive: 'true', limit: 100 }, { enabled: open });

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    company: '',
    city: '',
    priority: 'medium',
    assignedTo: '',
    notes: '',
  });

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit() {
    try {
      await create.mutateAsync({
        ...form,
        priority: form.priority as 'low' | 'medium' | 'high',
        assignedTo: form.assignedTo || undefined,
      });
      toast.success('Lead created');
      onClose();
    } catch (err) {
      toast.error(apiError(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add lead"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={create.isPending}>
            Create lead
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Name</Label>
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </div>
        <div>
          <Label>Email</Label>
          <Input value={form.email} onChange={(e) => set('email', e.target.value)} />
        </div>
        <div>
          <Label>Company</Label>
          <Input value={form.company} onChange={(e) => set('company', e.target.value)} />
        </div>
        <div>
          <Label>City</Label>
          <Input value={form.city} onChange={(e) => set('city', e.target.value)} />
        </div>
        <div>
          <Label>Priority</Label>
          <Select value={form.priority} onChange={(e) => set('priority', e.target.value)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
        </div>
        <div>
          <Label>Assign to</Label>
          <Select value={form.assignedTo} onChange={(e) => set('assignedTo', e.target.value)}>
            <option value="">Unassigned</option>
            {telecallers?.data.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>Notes</Label>
          <Textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
