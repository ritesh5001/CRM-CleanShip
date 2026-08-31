import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Link2,
  Pencil,
  PlayCircle,
  RotateCcw,
  Trash2,
  UserRound,
  XCircle,
} from 'lucide-react';
import type { ReactNode } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge, Spinner } from '@/components/ui/Misc';
import { useDeleteTask, useTask, useUpdateTaskStatus } from '@/api/tasks';
import { apiError } from '@/api/client';
import { PRIORITY_COLORS, TASK_STATUS_COLORS, TASK_STATUS_LABELS } from '@/lib/constants';
import { fmtDateTime, fmtMinutes, fmtRelative } from '@/lib/format';
import { formatPhoneDisplay } from '@/lib/phone';
import { TASK_TYPE_LABELS, isTaskOverdue } from './taskHelpers';
import type { Lead, Task, User } from '@/types';

interface Props {
  taskId: string | null;
  /** Row already in the list — rendered instantly while the full record loads. */
  fallback?: Task | null;
  isAdmin: boolean;
  onClose: () => void;
  onEdit: (task: Task) => void;
  onComplete: (task: Task) => void;
}

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2.5 py-1.5">
      <span className="mt-0.5 shrink-0 text-slate-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
        <div className="text-sm text-slate-700 dark:text-slate-200">{children}</div>
      </div>
    </div>
  );
}

const nameOf = (ref?: User | string | null) => (ref && typeof ref === 'object' ? ref.name : '—');

export function TaskDetailModal({ taskId, fallback, isAdmin, onClose, onEdit, onComplete }: Props) {
  const { data, isLoading } = useTask(taskId);
  const updateStatus = useUpdateTaskStatus();
  const del = useDeleteTask();
  const task = data ?? fallback ?? null;

  async function setStatus(status: Task['status'], message: string) {
    if (!task) return;
    try {
      await updateStatus.mutateAsync({ id: task._id, status });
      toast.success(message);
    } catch (e) {
      toast.error(apiError(e));
    }
  }

  async function handleDelete() {
    if (!task || !confirm('Delete this task? The assignee will no longer see it.')) return;
    try {
      await del.mutateAsync(task._id);
      toast.success('Task deleted');
      onClose();
    } catch (e) {
      toast.error(apiError(e));
    }
  }

  const lead = task?.relatedLead && typeof task.relatedLead === 'object' ? (task.relatedLead as Lead) : null;
  const overdue = task ? isTaskOverdue(task) : false;
  const open = task?.status === 'pending' || task?.status === 'in_progress';

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Task details"
      footer={
        task && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isAdmin && (
              <>
                <Button size="sm" variant="ghost" onClick={handleDelete}>
                  <Trash2 size={14} className="text-rose-500" /> Delete
                </Button>
                <Button size="sm" variant="secondary" onClick={() => onEdit(task)}>
                  <Pencil size={14} /> Edit
                </Button>
              </>
            )}
            {open && (
              <>
                {isAdmin && (
                  <Button size="sm" variant="secondary" onClick={() => setStatus('cancelled', 'Task cancelled')}>
                    <XCircle size={14} /> Cancel task
                  </Button>
                )}
                {task.status === 'pending' && (
                  <Button size="sm" variant="secondary" onClick={() => setStatus('in_progress', 'Marked in progress')}>
                    <PlayCircle size={14} /> Start
                  </Button>
                )}
                <Button size="sm" variant="success" onClick={() => onComplete(task)}>
                  <CheckCircle2 size={14} /> Mark done
                </Button>
              </>
            )}
            {!open && (
              <Button size="sm" variant="secondary" onClick={() => setStatus('pending', 'Task reopened')}>
                <RotateCcw size={14} /> Reopen
              </Button>
            )}
          </div>
        )
      }
    >
      {!task ? (
        isLoading ? (
          <Spinner />
        ) : (
          <p className="py-8 text-center text-sm text-slate-400">This task no longer exists.</p>
        )
      ) : (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">{task.title}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge className={TASK_STATUS_COLORS[task.status]}>{TASK_STATUS_LABELS[task.status]}</Badge>
              <Badge className={PRIORITY_COLORS[task.priority]}>{task.priority} priority</Badge>
              <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {TASK_TYPE_LABELS[task.type]}
              </Badge>
              {overdue && <Badge className="bg-rose-100 text-rose-700">Overdue</Badge>}
            </div>
          </div>

          {task.description && (
            <p className="whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {task.description}
            </p>
          )}

          <div className="grid gap-x-6 sm:grid-cols-2">
            <Row icon={<UserRound size={15} />} label="Assigned to">
              {nameOf(task.assignedTo)}
            </Row>
            <Row icon={<UserRound size={15} />} label="Assigned by">
              {nameOf(task.assignedBy)} · {fmtRelative(task.createdAt)}
            </Row>
            <Row icon={<CalendarClock size={15} />} label="Due">
              <span className={overdue ? 'font-medium text-rose-600' : ''}>
                {task.dueDate ? fmtDateTime(task.dueDate) : 'No due date'}
              </span>
            </Row>
            {/* Only meaningful when the task was actually started before being completed. */}
            {task.startedAt && task.startedAt !== task.completedAt && (
              <Row icon={<PlayCircle size={15} />} label="Started">
                {fmtDateTime(task.startedAt)}
              </Row>
            )}
            {lead && (
              <Row icon={<Link2 size={15} />} label="Linked contact">
                {lead.name}
                <span className="block text-xs text-slate-400">{formatPhoneDisplay(lead.phone, lead.country)}</span>
              </Row>
            )}
          </div>

          {task.status === 'completed' && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 size={15} /> Done {task.completedAt ? fmtDateTime(task.completedAt) : ''}
              </p>
              <p className="mt-0.5 text-xs text-emerald-700/80 dark:text-emerald-400/80">
                by {nameOf(task.completedBy ?? task.assignedTo)}
                {task.timeSpentMin ? ` · took ${fmtMinutes(task.timeSpentMin)}` : ''}
              </p>
              {task.completionNote && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-emerald-900 dark:text-emerald-200">
                  “{task.completionNote}”
                </p>
              )}
            </div>
          )}

          {task.status === 'cancelled' && (
            <p className="flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              <XCircle size={15} /> This task was cancelled.
            </p>
          )}

          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <Clock size={12} /> Created {fmtDateTime(task.createdAt)}
          </p>
        </div>
      )}
    </Modal>
  );
}
