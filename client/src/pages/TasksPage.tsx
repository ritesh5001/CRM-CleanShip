import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Circle,
  Link2,
  ListChecks,
  Pencil,
  PlayCircle,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserRound,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTaskStats, useTasks, useUpdateTaskStatus, useDeleteTask } from '@/api/tasks';
import { useTelecallers } from '@/api/users';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Badge, Card, EmptyState, Spinner } from '@/components/ui/Misc';
import { PRIORITY_COLORS, TASK_STATUS_COLORS, TASK_STATUS_LABELS } from '@/lib/constants';
import { fmtDueLabel, fmtMinutes, fmtDateTime } from '@/lib/format';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { TaskFormModal } from '@/features/tasks/TaskFormModal';
import { CompleteTaskModal } from '@/features/tasks/CompleteTaskModal';
import { TaskDetailModal } from '@/features/tasks/TaskDetailModal';
import { BUCKET_LABELS, TASK_TYPE_LABELS, groupByBucket, isTaskOverdue } from '@/features/tasks/taskHelpers';
import { apiError } from '@/api/client';
import type { Lead, Task, User } from '@/types';

/** Status tabs. `value` is what the API receives ('' = everything). */
const TABS = [
  { key: 'open', label: 'To do', value: 'pending,in_progress' },
  { key: 'completed', label: 'Done', value: 'completed' },
  { key: 'cancelled', label: 'Cancelled', value: 'cancelled' },
  { key: 'all', label: 'All', value: '' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const SCOPES = [
  { value: 'all', label: 'Any due date' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'undated', label: 'No due date' },
];

export function TasksPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'superadmin';

  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<TabKey>('open');
  const [scope, setScope] = useState('all');
  const [assignedTo, setAssignedTo] = useState('');
  const [priority, setPriority] = useState('');
  const [term, setTerm] = useState('');
  const search = useDebouncedValue(term, 300);
  const [page, setPage] = useState(1);

  const [formTask, setFormTask] = useState<Task | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [completing, setCompleting] = useState<Task | null>(null);
  const detailId = params.get('task');

  const query = useMemo(
    () => ({
      status: TABS.find((t) => t.key === tab)!.value,
      scope,
      assignedTo: isAdmin ? assignedTo : '',
      priority,
      search,
      page,
      limit: 25,
    }),
    [tab, scope, assignedTo, priority, search, page, isAdmin]
  );

  const { data, isLoading } = useTasks(query);
  const { data: stats } = useTaskStats(query);
  const { data: telecallers } = useTelecallers({ isActive: 'true', limit: 200 }, { enabled: isAdmin });
  const updateStatus = useUpdateTaskStatus();
  const del = useDeleteTask();

  // Filters change the result set — go back to the first page.
  useEffect(() => setPage(1), [tab, scope, assignedTo, priority, search]);

  function openDetail(id: string) {
    params.set('task', id);
    setParams(params, { replace: true });
  }
  function closeDetail() {
    params.delete('task');
    setParams(params, { replace: true });
  }

  async function setStatus(task: Task, status: Task['status'], message: string) {
    try {
      await updateStatus.mutateAsync({ id: task._id, status });
      toast.success(message);
    } catch (e) {
      toast.error(apiError(e));
    }
  }

  async function remove(task: Task) {
    if (!confirm(`Delete "${task.title}"? The assignee will no longer see it.`)) return;
    try {
      await del.mutateAsync(task._id);
      toast.success('Task deleted');
    } catch (e) {
      toast.error(apiError(e));
    }
  }

  const tasks = data?.data ?? [];
  const groups = groupByBucket(tasks);
  const totalPages = data?.pagination.totalPages ?? 1;
  const filtered = Boolean(search || priority || assignedTo || scope !== 'all');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{isAdmin ? 'Tasks' : 'My Tasks'}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isAdmin
              ? 'Assign work to your users and see exactly when it got done.'
              : 'Everything assigned to you. Mark it done and say when you did it.'}
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => {
              setFormTask(null);
              setFormOpen(true);
            }}
          >
            <Plus size={16} /> Assign task
          </Button>
        )}
      </div>

      {/* Headline counts — each one is a shortcut into the matching view. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <CountCard
          label="To do"
          value={(stats?.pending ?? 0) + (stats?.in_progress ?? 0)}
          icon={<ListChecks size={16} />}
          active={tab === 'open' && scope === 'all'}
          onClick={() => {
            setTab('open');
            setScope('all');
          }}
        />
        <CountCard
          label="Overdue"
          value={stats?.overdue ?? 0}
          icon={<AlertTriangle size={16} />}
          tone={stats?.overdue ? 'danger' : undefined}
          active={scope === 'overdue'}
          onClick={() => {
            setTab('open');
            setScope('overdue');
          }}
        />
        <CountCard
          label="Due today"
          value={stats?.dueToday ?? 0}
          icon={<CalendarClock size={16} />}
          active={scope === 'today'}
          onClick={() => {
            setTab('open');
            setScope('today');
          }}
        />
        <CountCard
          label="Completed"
          value={stats?.completed ?? 0}
          icon={<CheckCircle2 size={16} />}
          active={tab === 'completed'}
          onClick={() => {
            setTab('completed');
            setScope('all');
          }}
        />
      </div>

      {/* Tabs + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-brand-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-40 flex-1">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
          <Input
            className="pl-9"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search tasks…"
          />
        </div>

        {/* Select carries its own w-full, so the widths live on wrappers. */}
        {isAdmin && (
          <div className="w-40 shrink-0">
            <Select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
              <option value="">Everyone</option>
              {telecallers?.data.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="w-36 shrink-0">
          <Select value={scope} onChange={(e) => setScope(e.target.value)}>
            {SCOPES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-32 shrink-0">
          <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">Any priority</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
        </div>
      </div>

      <Card>
        {isLoading && !data ? (
          <Spinner />
        ) : !tasks.length ? (
          <EmptyState
            title={filtered ? 'Nothing matches those filters' : tab === 'open' ? 'All caught up 🎉' : 'No tasks here'}
            hint={
              filtered
                ? 'Try clearing the search or filters.'
                : isAdmin
                  ? 'Assign a task to get your users moving.'
                  : 'New tasks from your admin will show up here.'
            }
          />
        ) : (
          <div>
            {groups.map(([bucket, items]) => (
              <div key={bucket}>
                <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-1.5 dark:border-slate-800 dark:bg-slate-800/40">
                  <span
                    className={`text-xs font-semibold uppercase tracking-wide ${
                      bucket === 'overdue' ? 'text-rose-600' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {BUCKET_LABELS[bucket]}
                  </span>
                  <span className="text-xs text-slate-400">{items.length}</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((task) => (
                    <TaskRow
                      key={task._id}
                      task={task}
                      isAdmin={isAdmin}
                      onOpen={() => openDetail(task._id)}
                      onStart={() => setStatus(task, 'in_progress', 'Marked in progress')}
                      onComplete={() => setCompleting(task)}
                      onReopen={() => setStatus(task, 'pending', 'Task reopened')}
                      onEdit={() => {
                        setFormTask(task);
                        setFormOpen(true);
                      }}
                      onDelete={() => remove(task)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {data?.pagination.page ?? page} / {totalPages}
          </span>
          <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      {isAdmin && (
        <TaskFormModal open={formOpen} task={formTask} onClose={() => setFormOpen(false)} />
      )}
      <CompleteTaskModal task={completing} onClose={() => setCompleting(null)} />
      {detailId && (
        <TaskDetailModal
          taskId={detailId}
          fallback={tasks.find((t) => t._id === detailId) ?? null}
          isAdmin={isAdmin}
          onClose={closeDetail}
          onEdit={(t) => {
            setFormTask(t);
            setFormOpen(true);
            closeDetail();
          }}
          onComplete={(t) => {
            setCompleting(t);
            closeDetail();
          }}
        />
      )}
    </div>
  );
}

function CountCard({
  label,
  value,
  icon,
  active,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  active?: boolean;
  tone?: 'danger';
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition-colors ${
        active
          ? 'border-brand-500 bg-brand-50 dark:border-brand-500 dark:bg-brand-500/10'
          : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
      }`}
    >
      <span
        className={`rounded-lg p-2 ${
          tone === 'danger'
            ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400'
            : 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-bold leading-tight text-slate-800 dark:text-slate-100">{value}</span>
        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{label}</span>
      </span>
    </button>
  );
}

function TaskRow({
  task,
  isAdmin,
  onOpen,
  onStart,
  onComplete,
  onReopen,
  onEdit,
  onDelete,
}: {
  task: Task;
  isAdmin: boolean;
  onOpen: () => void;
  onStart: () => void;
  onComplete: () => void;
  onReopen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const assignee = task.assignedTo as User | undefined;
  const lead = task.relatedLead && typeof task.relatedLead === 'object' ? (task.relatedLead as Lead) : null;
  const overdue = isTaskOverdue(task);
  const open = task.status === 'pending' || task.status === 'in_progress';
  const done = task.status === 'completed';

  return (
    <div className="flex items-start gap-3 p-3 sm:p-4">
      {/* The tick is the primary action: one tap opens "when did you do it?". */}
      <button
        onClick={open ? onComplete : onReopen}
        title={open ? 'Mark as done' : 'Reopen this task'}
        className={`mt-0.5 shrink-0 rounded-full p-0.5 transition-colors ${
          done ? 'text-emerald-500 hover:text-emerald-600' : 'text-slate-300 hover:text-emerald-500 dark:text-slate-600'
        }`}
      >
        {done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
      </button>

      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`font-medium ${
              done ? 'text-slate-400 line-through dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'
            }`}
          >
            {task.title}
          </span>
          {task.priority === 'high' && open && (
            <Badge className={PRIORITY_COLORS.high}>High</Badge>
          )}
          {task.status === 'in_progress' && (
            <Badge className={TASK_STATUS_COLORS.in_progress}>{TASK_STATUS_LABELS.in_progress}</Badge>
          )}
          {task.status === 'cancelled' && (
            <Badge className={TASK_STATUS_COLORS.cancelled}>{TASK_STATUS_LABELS.cancelled}</Badge>
          )}
        </div>

        {task.description && (
          <p className="mt-0.5 line-clamp-1 text-sm text-slate-500 dark:text-slate-400">{task.description}</p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 dark:text-slate-500">
          {isAdmin && assignee && (
            <span className="inline-flex items-center gap-1">
              <UserRound size={12} /> {assignee.name}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <CalendarClock size={12} />
            <span className={overdue ? 'font-medium text-rose-500' : ''}>{fmtDueLabel(task.dueDate)}</span>
          </span>
          {task.type !== 'custom' && <span>{TASK_TYPE_LABELS[task.type]}</span>}
          {lead && (
            <span className="inline-flex items-center gap-1">
              <Link2 size={12} /> {lead.name}
            </span>
          )}
          {done && task.completedAt && (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={12} /> Done {fmtDateTime(task.completedAt)}
              {task.timeSpentMin ? ` · ${fmtMinutes(task.timeSpentMin)}` : ''}
            </span>
          )}
        </div>

        {done && task.completionNote && (
          <p className="mt-1 line-clamp-1 text-xs italic text-slate-500 dark:text-slate-400">“{task.completionNote}”</p>
        )}
      </button>

      <div className="flex shrink-0 items-center gap-1">
        {task.status === 'pending' && (
          <Button size="sm" variant="secondary" onClick={onStart} title="Start working on this">
            <PlayCircle size={14} />
            <span className="hidden sm:inline">Start</span>
          </Button>
        )}
        {open && (
          <Button size="sm" variant="success" onClick={onComplete}>
            <CheckCircle2 size={14} />
            <span className="hidden sm:inline">Done</span>
          </Button>
        )}
        {!open && (
          <Button size="sm" variant="ghost" onClick={onReopen} title="Reopen">
            <RotateCcw size={14} />
          </Button>
        )}
        {isAdmin && (
          <>
            <Button size="sm" variant="ghost" onClick={onEdit} title="Edit task">
              <Pencil size={14} />
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete} title="Delete task">
              <Trash2 size={14} className="text-rose-500" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
