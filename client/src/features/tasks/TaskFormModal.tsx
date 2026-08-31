import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Link2, Search, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Label, Textarea } from '@/components/ui/Field';
import { useCreateTask, useUpdateTask } from '@/api/tasks';
import { useLeads } from '@/api/leads';
import { useTelecallers } from '@/api/users';
import { apiError } from '@/api/client';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { toDateTimeInput } from '@/lib/format';
import { formatPhoneDisplay } from '@/lib/phone';
import { TASK_TYPE_LABELS } from './taskHelpers';
import type { Lead, Task, TaskType, User } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pass a task to edit it; omit to create. */
  task?: Task | null;
}

type Priority = 'low' | 'medium' | 'high';

const TYPES: TaskType[] = ['custom', 'call', 'follow_up'];
const PRIORITIES: Priority[] = ['low', 'medium', 'high'];

/** Quick due-date presets — the common cases, one tap each. */
function presets() {
  const at = (days: number, hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return toDateTimeInput(d);
  };
  return [
    { label: 'Today 6 pm', value: at(0, 18) },
    { label: 'Tomorrow 10 am', value: at(1, 10) },
    { label: 'In 3 days', value: at(3, 10) },
    { label: 'Next week', value: at(7, 10) },
  ];
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  labels,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  labels: Record<string, string>;
}) {
  return (
    <div className="flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-600">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium capitalize transition-colors ${
            value === opt
              ? 'bg-brand-600 text-white'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          {labels[opt] ?? opt}
        </button>
      ))}
    </div>
  );
}

/** Searchable contact picker — only mounts (and queries) once the admin opens it. */
function ContactPicker({ onPick, onCancel }: { onPick: (lead: Lead) => void; onCancel: () => void }) {
  const [term, setTerm] = useState('');
  const search = useDebouncedValue(term, 300);
  const { data, isFetching } = useLeads({ search, limit: 6 });

  return (
    <div className="mt-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
      <div className="flex items-center gap-2">
        <Search size={14} className="shrink-0 text-slate-400" />
        <Input
          autoFocus
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search contacts by name, phone or company…"
        />
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X size={14} />
        </Button>
      </div>
      <div className="mt-2 max-h-44 overflow-y-auto">
        {isFetching && !data ? (
          <p className="p-3 text-center text-xs text-slate-400">Searching…</p>
        ) : !data?.data.length ? (
          <p className="p-3 text-center text-xs text-slate-400">No contacts match that search.</p>
        ) : (
          data.data.map((lead) => (
            <button
              key={lead._id}
              type="button"
              onClick={() => onPick(lead)}
              className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{lead.name}</p>
              <p className="text-xs text-slate-400">
                {formatPhoneDisplay(lead.phone, lead.country)}
                {lead.company ? ` · ${lead.company}` : ''}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export function TaskFormModal({ open, onClose, task }: Props) {
  const isEdit = Boolean(task);
  const create = useCreateTask();
  const update = useUpdateTask();
  const { data: telecallers } = useTelecallers({ isActive: 'true', limit: 200 }, { enabled: open });
  const titleRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TaskType>('custom');
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [relatedLead, setRelatedLead] = useState<Lead | null>(null);
  const [pickingContact, setPickingContact] = useState(false);
  const [assigneeTerm, setAssigneeTerm] = useState('');
  const [error, setError] = useState('');

  // Reset the form whenever it opens (fresh create, or the task being edited).
  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? '');
    setDescription(task?.description ?? '');
    setType(task?.type ?? 'custom');
    setPriority(task?.priority ?? 'medium');
    setDueDate(toDateTimeInput(task?.dueDate));
    const assignee = task?.assignedTo as User | string | undefined;
    setAssignees(assignee ? [typeof assignee === 'string' ? assignee : assignee._id] : []);
    const lead = task?.relatedLead as Lead | string | null | undefined;
    setRelatedLead(lead && typeof lead === 'object' ? lead : null);
    setPickingContact(false);
    setAssigneeTerm('');
    setError('');
    setTimeout(() => titleRef.current?.focus(), 50);
  }, [open, task]);

  const people = telecallers?.data ?? [];
  const visiblePeople = useMemo(() => {
    const t = assigneeTerm.trim().toLowerCase();
    if (!t) return people;
    return people.filter((p) => p.name.toLowerCase().includes(t) || p.email.toLowerCase().includes(t));
  }, [people, assigneeTerm]);

  function toggleAssignee(id: string) {
    setAssignees((prev) => {
      // Editing moves the task between people, so it stays single-assignee.
      if (isEdit) return [id];
      return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    });
  }

  const allSelected = people.length > 0 && assignees.length === people.length;

  async function handleSubmit() {
    if (!title.trim()) {
      setError('Give the task a title so the user knows what to do.');
      titleRef.current?.focus();
      return;
    }
    if (!assignees.length) {
      setError(isEdit ? 'Choose who owns this task.' : 'Choose at least one user to assign this task to.');
      return;
    }
    setError('');

    const base = {
      title: title.trim(),
      description: description.trim(),
      type,
      priority,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      relatedLead: relatedLead?._id ?? null,
    };

    try {
      if (isEdit && task) {
        await update.mutateAsync({ id: task._id, ...base, assignedTo: assignees[0] });
        toast.success('Task updated');
      } else {
        const res = await create.mutateAsync({ ...base, assignedTo: assignees });
        toast.success(res.count > 1 ? `Task assigned to ${res.count} users` : 'Task assigned');
      }
      onClose();
    } catch (err) {
      toast.error(apiError(err));
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? 'Edit task' : 'Assign a task'}
      footer={
        <div className="flex items-center justify-between gap-2">
          <p className="hidden text-xs text-slate-400 sm:block">
            {isEdit ? 'The assignee is notified if you move this task.' : 'Everyone you pick gets their own copy.'}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={pending}>
              {isEdit ? 'Save changes' : assignees.length > 1 ? `Assign to ${assignees.length}` : 'Assign task'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="task-title">What needs doing?</Label>
          <Input
            id="task-title"
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Call back the Mumbai shipping enquiries"
          />
        </div>

        <div>
          <Label htmlFor="task-desc">Details (optional)</Label>
          <Textarea
            id="task-desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Anything the user needs to know before starting"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <Label>
              {isEdit ? 'Assigned to' : 'Assign to'}
              {!isEdit && assignees.length > 0 && (
                <span className="ml-1 font-normal text-brand-600">({assignees.length} selected)</span>
              )}
            </Label>
            {!isEdit && people.length > 1 && (
              <button
                type="button"
                onClick={() => setAssignees(allSelected ? [] : people.map((p) => p._id))}
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                <Users size={11} className="mr-1 inline" />
                {allSelected ? 'Clear all' : 'Select everyone'}
              </button>
            )}
          </div>

          {people.length > 6 && (
            <Input
              className="mb-2"
              value={assigneeTerm}
              onChange={(e) => setAssigneeTerm(e.target.value)}
              placeholder="Filter users…"
            />
          )}

          <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-1.5 dark:border-slate-700">
            {!visiblePeople.length && (
              <p className="p-3 text-center text-xs text-slate-400">
                {people.length ? 'No user matches that filter.' : 'No active users in this workspace yet.'}
              </p>
            )}
            {visiblePeople.map((p) => {
              const selected = assignees.includes(p._id);
              return (
                <button
                  key={p._id}
                  type="button"
                  onClick={() => toggleAssignee(p._id)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                    selected ? 'bg-brand-50 dark:bg-brand-500/15' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {selected && <Check size={11} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-slate-700 dark:text-slate-200">{p.name}</span>
                    <span className="block truncate text-[11px] text-slate-400">{p.email}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Type</Label>
            <Segmented value={type} options={TYPES} onChange={setType} labels={TASK_TYPE_LABELS} />
          </div>
          <div>
            <Label>Priority</Label>
            <Segmented
              value={priority}
              options={PRIORITIES}
              onChange={setPriority}
              labels={{ low: 'Low', medium: 'Medium', high: 'High' }}
            />
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <Label htmlFor="task-due">Due by (optional)</Label>
            {dueDate && (
              <button
                type="button"
                onClick={() => setDueDate('')}
                className="text-xs font-medium text-slate-400 hover:text-rose-500"
              >
                Clear
              </button>
            )}
          </div>
          <Input id="task-due" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {presets().map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setDueDate(p.value)}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  dueDate === p.value
                    ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>Linked contact (optional)</Label>
          {relatedLead ? (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
              <Link2 size={14} className="shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-700 dark:text-slate-200">{relatedLead.name}</p>
                <p className="truncate text-xs text-slate-400">
                  {formatPhoneDisplay(relatedLead.phone, relatedLead.country)}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setRelatedLead(null)}>
                <X size={14} />
              </Button>
            </div>
          ) : pickingContact ? (
            <ContactPicker
              onPick={(lead) => {
                setRelatedLead(lead);
                setPickingContact(false);
              }}
              onCancel={() => setPickingContact(false)}
            />
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setPickingContact(true)}>
              <Link2 size={14} /> Link a contact
            </Button>
          )}
        </div>

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
