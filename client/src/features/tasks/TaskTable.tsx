import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, Circle, Link2, Trash2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDeleteTask, useUpdateTask, useUpdateTaskStatus } from '@/api/tasks';
import { apiError } from '@/api/client';
import { PRIORITY_COLORS, TASK_STATUS_COLORS, TASK_STATUS_LABELS } from '@/lib/constants';
import { fmtDateTime, fmtDueLabel, fmtMinutes, fmtStamp, toDateTimeInput } from '@/lib/format';
import { formatPhoneDisplay } from '@/lib/phone';
import { TASK_TYPE_LABELS, isTaskOverdue, localDateTimeInput } from './taskHelpers';
import type { Lead, Task, TaskStatus, TaskType, User } from '@/types';

const CELL =
  'rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-brand-500/25';

const TH = 'px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400';

interface Props {
  tasks: Task[];
  isAdmin: boolean;
  people: User[];
  /** Row to auto-open (deep link from a notification). */
  openId?: string | null;
  onOpenHandled?: () => void;
}

export function TaskTable({ tasks, isAdmin, people, openId, onOpenHandled }: Props) {
  // Only one row is ever expanded: 'details' shows/edits it, 'complete' reports the time.
  const [open, setOpen] = useState<{ id: string; mode: 'details' | 'complete' } | null>(null);

  useEffect(() => {
    if (!openId) return;
    setOpen({ id: openId, mode: 'details' });
    onOpenHandled?.();
  }, [openId, onOpenHandled]);

  const cols = isAdmin ? 8 : 6;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <table className="w-full min-w-[60rem] border-collapse">
        <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800/70">
          <tr className="border-b border-slate-200 dark:border-slate-700">
            <th className={`${TH} w-9`}>
              <span className="sr-only">Done</span>
            </th>
            <th className={TH}>Task</th>
            {isAdmin && <th className={`${TH} w-32`}>Assignee</th>}
            <th className={`${TH} w-32`}>Due</th>
            <th className={`${TH} w-28`}>Priority</th>
            <th className={`${TH} w-32`}>Status</th>
            <th className={`${TH} w-40`}>Completed</th>
            <th className={`${TH} w-14`}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <TaskRow
              key={task._id}
              task={task}
              isAdmin={isAdmin}
              people={people}
              cols={cols}
              open={open?.id === task._id ? open.mode : null}
              onToggle={(mode) =>
                setOpen((cur) => (cur?.id === task._id && cur.mode === mode ? null : { id: task._id, mode }))
              }
              onClose={() => setOpen(null)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskRow({
  task,
  isAdmin,
  people,
  cols,
  open,
  onToggle,
  onClose,
}: {
  task: Task;
  isAdmin: boolean;
  people: User[];
  cols: number;
  open: 'details' | 'complete' | null;
  onToggle: (mode: 'details' | 'complete') => void;
  onClose: () => void;
}) {
  const update = useUpdateTask();
  const updateStatus = useUpdateTaskStatus();
  const del = useDeleteTask();

  const assignee = task.assignedTo as User | undefined;
  const overdue = isTaskOverdue(task);
  const isOpen = task.status === 'pending' || task.status === 'in_progress';
  const done = task.status === 'completed';

  /** Instant save for the in-cell selects. */
  async function patch(payload: { assignedTo?: string; priority?: Task['priority'] }) {
    try {
      await update.mutateAsync({ id: task._id, ...payload });
    } catch (e) {
      toast.error(apiError(e));
    }
  }

  async function setStatus(status: TaskStatus) {
    // Completing needs a time, so it opens the inline strip instead of firing.
    if (status === 'completed') return onToggle('complete');
    try {
      await updateStatus.mutateAsync({ id: task._id, status });
      toast.success(status === 'pending' ? 'Reopened' : `Marked ${TASK_STATUS_LABELS[status].toLowerCase()}`);
    } catch (e) {
      toast.error(apiError(e));
    }
  }

  async function remove() {
    if (!confirm(`Delete "${task.title}"? The assignee will no longer see it.`)) return;
    try {
      await del.mutateAsync(task._id);
      toast.success('Task deleted');
    } catch (e) {
      toast.error(apiError(e));
    }
  }

  return (
    <>
      <tr
        className={`border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40 ${
          open ? 'bg-slate-50 dark:bg-slate-800/40' : ''
        }`}
      >
        <td className="px-2.5 py-2 align-top">
          <button
            onClick={() => (isOpen ? onToggle('complete') : setStatus('pending'))}
            title={isOpen ? 'Mark as done' : 'Reopen this task'}
            aria-label={isOpen ? `Mark ${task.title} as done` : `Reopen ${task.title}`}
            className={`rounded-full p-1 transition-colors ${
              done
                ? 'text-emerald-500 hover:text-emerald-600'
                : 'text-slate-300 hover:text-emerald-500 dark:text-slate-600 dark:hover:text-emerald-400'
            }`}
          >
            {done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
          </button>
        </td>

        <td className="min-w-[14rem] px-2.5 py-2 align-top">
          <button onClick={() => onToggle('details')} className="block w-full text-left" title={task.title}>
            <span
              className={`line-clamp-2 text-sm font-medium ${
                done ? 'text-slate-400 line-through dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'
              }`}
            >
              {task.title}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400 dark:text-slate-500">
              {task.type !== 'custom' && <span>{TASK_TYPE_LABELS[task.type]}</span>}
              {task.description && <span className="line-clamp-1 max-w-md">{task.description}</span>}
              {task.relatedLead && typeof task.relatedLead === 'object' && (
                <span className="inline-flex items-center gap-1">
                  <Link2 size={10} /> {(task.relatedLead as Lead).name}
                </span>
              )}
            </span>
          </button>
        </td>

        {isAdmin && (
          <td className="px-2.5 py-2 align-top">
            <select
              aria-label={`Assignee for ${task.title}`}
              value={assignee?._id ?? ''}
              onChange={(e) => patch({ assignedTo: e.target.value })}
              className={`${CELL} w-full`}
            >
              {!assignee && <option value="">Unassigned</option>}
              {people.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </td>
        )}

        <td className="px-2.5 py-2 align-top">
          <span
            className={`text-xs tabular-nums ${
              overdue ? 'font-semibold text-rose-500' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {fmtDueLabel(task.dueDate)}
          </span>
        </td>

        <td className="px-2.5 py-2 align-top">
          {isAdmin ? (
            <select
              aria-label={`Priority for ${task.title}`}
              value={task.priority}
              onChange={(e) => patch({ priority: e.target.value as Task['priority'] })}
              className={`${CELL} w-full`}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          ) : (
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${PRIORITY_COLORS[task.priority]}`}
            >
              {task.priority}
            </span>
          )}
        </td>

        <td className="px-2.5 py-2 align-top">
          <select
            aria-label={`Status for ${task.title}`}
            value={task.status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
            className={`${CELL} w-full font-medium`}
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            {isAdmin && <option value="cancelled">Cancelled</option>}
          </select>
        </td>

        <td className="px-2.5 py-2 align-top">
          {done && task.completedAt ? (
            <span className="whitespace-nowrap text-xs tabular-nums text-emerald-600 dark:text-emerald-400">
              {fmtStamp(task.completedAt)}
              {task.timeSpentMin ? (
                <span className="block text-[11px] text-slate-400">took {fmtMinutes(task.timeSpentMin)}</span>
              ) : null}
            </span>
          ) : task.status === 'cancelled' ? (
            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
              <XCircle size={12} /> Cancelled
            </span>
          ) : (
            <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
          )}
        </td>

        <td className="px-2.5 py-2 align-top">
          <div className="flex items-center justify-end gap-0.5">
            <button
              onClick={() => onToggle('details')}
              aria-label={`Details for ${task.title}`}
              aria-expanded={open === 'details'}
              className="rounded p-1 text-slate-400 transition-transform hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            >
              <ChevronDown size={15} className={open === 'details' ? 'rotate-180' : ''} />
            </button>
            {isAdmin && (
              <button
                onClick={remove}
                aria-label={`Delete ${task.title}`}
                className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </td>
      </tr>

      {open === 'complete' && (
        <tr className="border-b border-slate-100 bg-emerald-50/50 dark:border-slate-800 dark:bg-emerald-500/5">
          <td colSpan={cols} className="px-3 py-3">
            <CompletionStrip task={task} onClose={onClose} />
          </td>
        </tr>
      )}

      {open === 'details' && (
        <tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/30">
          <td colSpan={cols} className="px-3 py-3">
            <DetailsPanel task={task} isAdmin={isAdmin} onClose={onClose} />
          </td>
        </tr>
      )}
    </>
  );
}

/** Inline "when did you actually do it?" — the completion flow, without a dialog. */
function CompletionStrip({ task, onClose }: { task: Task; onClose: () => void }) {
  const updateStatus = useUpdateTaskStatus();
  const [when, setWhen] = useState(localDateTimeInput());
  const [mins, setMins] = useState(task.timeSpentMin ? String(task.timeSpentMin) : '');
  const [note, setNote] = useState(task.completionNote ?? '');
  const [error, setError] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => ref.current?.focus(), []);

  const created = new Date(task.createdAt).getTime();

  async function submit() {
    const at = new Date(when);
    if (Number.isNaN(at.getTime())) return setError('Pick when you did this.');
    if (at.getTime() > Date.now() + 60_000) return setError("That's in the future.");
    // 60s grace: the input is minute-precision, so "now" on a fresh task rounds down.
    if (at.getTime() < created - 60_000) {
      return setError(`This task only exists since ${fmtDateTime(task.createdAt)}.`);
    }
    setError('');
    try {
      await updateStatus.mutateAsync({
        id: task._id,
        status: 'completed',
        completedAt: at.toISOString(),
        completionNote: note.trim(),
        timeSpentMin: mins ? Number(mins) : undefined,
      });
      toast.success('Marked done');
      onClose();
    } catch (e) {
      toast.error(apiError(e));
    }
  }

  const quick = [
    { label: 'Now', mins: 0 },
    { label: '1h ago', mins: 60 },
    { label: '3h ago', mins: 180 },
  ].filter((q) => Date.now() - q.mins * 60_000 >= created - 60_000);

  return (
    <div className="flex flex-wrap items-start gap-3">
      <div>
        <label htmlFor={`when-${task._id}`} className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
          When did you do it?
        </label>
        <input
          id={`when-${task._id}`}
          ref={ref}
          type="datetime-local"
          value={when}
          max={localDateTimeInput()}
          onChange={(e) => setWhen(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          className={`${CELL} w-52 py-1.5`}
        />
        <div className="mt-1 flex gap-1">
          {quick.map((q) => (
            <button
              key={q.label}
              onClick={() => setWhen(localDateTimeInput(new Date(), q.mins))}
              className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500 hover:bg-white dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor={`mins-${task._id}`} className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
          Time spent
        </label>
        <div className="relative">
          <input
            id={`mins-${task._id}`}
            type="number"
            min={0}
            max={1440}
            value={mins}
            onChange={(e) => setMins(e.target.value)}
            placeholder="0"
            className={`${CELL} w-24 py-1.5 pr-8 tabular-nums`}
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
            min
          </span>
        </div>
      </div>

      <div className="min-w-48 flex-1">
        <label htmlFor={`note-${task._id}`} className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
          Note back to admin (optional)
        </label>
        <input
          id={`note-${task._id}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="What happened…"
          className={`${CELL} w-full py-1.5`}
        />
      </div>

      <div className="flex gap-2 pt-[22px]">
        <button
          onClick={onClose}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={updateStatus.isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          <CheckCircle2 size={14} /> Mark done
        </button>
      </div>

      {error && (
        <p role="alert" className="w-full text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}

/** Expanded row: the full record, editable in place for the admin. */
function DetailsPanel({ task, isAdmin, onClose }: { task: Task; isAdmin: boolean; onClose: () => void }) {
  const update = useUpdateTask();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [due, setDue] = useState(toDateTimeInput(task.dueDate));
  const [type, setType] = useState<TaskType>(task.type);

  const dirty =
    title !== task.title ||
    description !== (task.description ?? '') ||
    due !== toDateTimeInput(task.dueDate) ||
    type !== task.type;

  async function save() {
    if (!title.trim()) return toast.error('Title cannot be empty.');
    try {
      await update.mutateAsync({
        id: task._id,
        title: title.trim(),
        description: description.trim(),
        type,
        dueDate: due ? new Date(due).toISOString() : null,
      });
      toast.success('Task updated');
      onClose();
    } catch (e) {
      toast.error(apiError(e));
    }
  }

  const lead = task.relatedLead && typeof task.relatedLead === 'object' ? (task.relatedLead as Lead) : null;
  const nameOf = (r?: User | string | null) => (r && typeof r === 'object' ? r.name : '—');

  return (
    <div className="space-y-3">
      {isAdmin ? (
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-56 flex-1">
            <label htmlFor={`t-${task._id}`} className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Title
            </label>
            <input id={`t-${task._id}`} value={title} onChange={(e) => setTitle(e.target.value)} className={`${CELL} w-full py-1.5`} />
          </div>
          <div className="min-w-56 flex-[2]">
            <label htmlFor={`d-${task._id}`} className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Details
            </label>
            <input
              id={`d-${task._id}`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Anything the user should know"
              className={`${CELL} w-full py-1.5`}
            />
          </div>
          <div>
            <label htmlFor={`due-${task._id}`} className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Due
            </label>
            <input id={`due-${task._id}`} type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className={`${CELL} w-48 py-1.5`} />
          </div>
          <div>
            <label htmlFor={`ty-${task._id}`} className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Type
            </label>
            <select id={`ty-${task._id}`} value={type} onChange={(e) => setType(e.target.value as TaskType)} className={`${CELL} w-28 py-1.5`}>
              {(Object.keys(TASK_TYPE_LABELS) as TaskType[]).map((t) => (
                <option key={t} value={t}>
                  {TASK_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={save}
            disabled={!dirty || update.isPending}
            className="mt-[22px] rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {update.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      ) : (
        task.description && <p className="text-sm text-slate-600 dark:text-slate-300">{task.description}</p>
      )}

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-slate-400 dark:text-slate-500">
        <span>Assigned by {nameOf(task.assignedBy)}</span>
        <span>Created {fmtDateTime(task.createdAt)}</span>
        {task.startedAt && task.startedAt !== task.completedAt && <span>Started {fmtDateTime(task.startedAt)}</span>}
        {lead && (
          <span className="inline-flex items-center gap-1">
            <Link2 size={11} /> {lead.name} · {formatPhoneDisplay(lead.phone, lead.country)}
          </span>
        )}
      </div>

      {task.status === 'completed' && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-500/25 dark:bg-emerald-500/10">
          <p className="flex flex-wrap items-center gap-x-2 text-xs font-medium text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 size={13} /> Done {task.completedAt ? fmtDateTime(task.completedAt) : ''} by{' '}
            {nameOf(task.completedBy ?? task.assignedTo)}
            {task.timeSpentMin ? ` · took ${fmtMinutes(task.timeSpentMin)}` : ''}
          </p>
          {task.completionNote && (
            <p className="mt-1 text-xs text-emerald-900 dark:text-emerald-200">“{task.completionNote}”</p>
          )}
        </div>
      )}
    </div>
  );
}
