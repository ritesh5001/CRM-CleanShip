import { useMemo, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCreateTask } from '@/api/tasks';
import { useTelecallers } from '@/api/users';
import { apiError } from '@/api/client';
import { TASK_TYPE_LABELS, localDateTimeInput } from './taskHelpers';
import type { TaskType } from '@/types';

/**
 * The whole assign flow, inline above the table — no dialog. Type a title, pick
 * people (each pick becomes a chip so one task can go to several users), hit
 * Enter. Everything else has a sane default.
 */
export function TaskComposer() {
  const create = useCreateTask();
  const { data: telecallers } = useTelecallers({ isActive: 'true', limit: 200 });
  const titleRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [type, setType] = useState<TaskType>('custom');
  const [error, setError] = useState('');

  const people = telecallers?.data ?? [];
  const byId = useMemo(() => new Map(people.map((p) => [p._id, p])), [people]);
  const remaining = people.filter((p) => !assignees.includes(p._id));

  function reset() {
    setTitle('');
    setAssignees([]);
    setDueDate('');
    setPriority('medium');
    setType('custom');
    setError('');
  }

  async function submit() {
    if (!title.trim()) {
      setError('Give the task a title.');
      titleRef.current?.focus();
      return;
    }
    if (!assignees.length) {
      setError('Pick at least one person.');
      return;
    }
    setError('');
    try {
      // Omit what isn't set rather than sending explicit nulls, and send a lone
      // assignee as a plain string — a create has nothing to clear, so null adds
      // nothing and only narrows what the API has to accept.
      const res = await create.mutateAsync({
        title: title.trim(),
        description: '',
        type,
        priority,
        ...(dueDate ? { dueDate: new Date(dueDate).toISOString() } : {}),
        assignedTo: assignees.length === 1 ? assignees[0] : assignees,
      });
      toast.success(res.count > 1 ? `Assigned to ${res.count} people` : 'Task assigned');
      reset();
      titleRef.current?.focus();
    } catch (err) {
      toast.error(apiError(err));
    }
  }

  const cell =
    'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-brand-500/25';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-2">
        <Plus size={16} className="ml-1 shrink-0 text-slate-400" aria-hidden />

        <input
          ref={titleRef}
          aria-label="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="What needs doing? Type it here, pick who, press Enter"
          className={`${cell} min-w-56 flex-1 border-transparent bg-transparent text-[15px] placeholder:text-slate-400 focus:border-brand-500 dark:border-transparent dark:bg-transparent`}
        />

        {/* Native picker; each choice becomes a chip, so one task can go to many. */}
        <select
          aria-label="Assign to"
          value=""
          onChange={(e) => {
            if (e.target.value) setAssignees((a) => [...a, e.target.value]);
          }}
          disabled={!remaining.length}
          className={`${cell} w-36 shrink-0 disabled:opacity-50`}
        >
          <option value="">{assignees.length ? 'Add person…' : 'Assign to…'}</option>
          {remaining.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>

        <input
          aria-label="Due date and time"
          type="datetime-local"
          value={dueDate}
          min={localDateTimeInput()}
          onChange={(e) => setDueDate(e.target.value)}
          className={`${cell} w-48 shrink-0`}
        />

        <select
          aria-label="Priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value as typeof priority)}
          className={`${cell} w-28 shrink-0`}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>

        <select
          aria-label="Task type"
          value={type}
          onChange={(e) => setType(e.target.value as TaskType)}
          className={`${cell} w-28 shrink-0`}
        >
          {(Object.keys(TASK_TYPE_LABELS) as TaskType[]).map((t) => (
            <option key={t} value={t}>
              {TASK_TYPE_LABELS[t]}
            </option>
          ))}
        </select>

        <button
          onClick={submit}
          disabled={create.isPending}
          className="shrink-0 rounded-md bg-brand-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {create.isPending ? 'Assigning…' : assignees.length > 1 ? `Assign to ${assignees.length}` : 'Assign'}
        </button>
      </div>

      {assignees.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-7">
          {assignees.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-2.5 pr-1 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
            >
              {byId.get(id)?.name ?? 'Unknown'}
              <button
                onClick={() => setAssignees((a) => a.filter((x) => x !== id))}
                aria-label={`Remove ${byId.get(id)?.name ?? 'person'}`}
                className="rounded-full p-0.5 hover:bg-brand-100 dark:hover:bg-brand-500/25"
              >
                <X size={11} />
              </button>
            </span>
          ))}
          {people.length > 1 && assignees.length < people.length && (
            <button
              onClick={() => setAssignees(people.map((p) => p._id))}
              className="ml-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              Everyone
            </button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 pl-7 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}
