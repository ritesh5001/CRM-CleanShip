import { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Field';
import { useCreateTask } from '@/api/tasks';
import { useTelecallers } from '@/api/users';
import { apiError } from '@/api/client';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function TaskFormModal({ open, onClose }: Props) {
  const create = useCreateTask();
  const { data: telecallers } = useTelecallers({ isActive: 'true', limit: 100 });

  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'custom',
    assignedTo: '',
    priority: 'medium',
    dueDate: '',
  });

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit() {
    if (!form.assignedTo) return toast.error('Choose a telecaller');
    try {
      await create.mutateAsync({
        title: form.title,
        description: form.description,
        type: form.type as 'call' | 'follow_up' | 'custom',
        assignedTo: form.assignedTo,
        priority: form.priority as 'low' | 'medium' | 'high',
        dueDate: form.dueDate || undefined,
      });
      toast.success('Task assigned');
      onClose();
    } catch (err) {
      toast.error(apiError(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Assign task"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={create.isPending}>
            Assign task
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <Label>Title</Label>
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="What needs doing?" />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Assign to</Label>
            <Select value={form.assignedTo} onChange={(e) => set('assignedTo', e.target.value)}>
              <option value="">Select…</option>
              {telecallers?.data.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Type</Label>
            <Select value={form.type} onChange={(e) => set('type', e.target.value)}>
              <option value="custom">Custom</option>
              <option value="call">Call</option>
              <option value="follow_up">Follow-up</option>
            </Select>
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
            <Label>Due date</Label>
            <Input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
