import { useState } from 'react';
import { Plus, Trash2, CheckCircle2, PlayCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTasks, useUpdateTaskStatus, useDeleteTask } from '@/api/tasks';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { Badge, Card, EmptyState, Spinner } from '@/components/ui/Misc';
import { PRIORITY_COLORS, TASK_STATUS_COLORS, TASK_STATUS_LABELS } from '@/lib/constants';
import { fmtDate, isOverdue } from '@/lib/format';
import { TaskFormModal } from '@/features/tasks/TaskFormModal';
import { apiError } from '@/api/client';
import type { TaskStatus, User } from '@/types';

export function TasksPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'superadmin';

  const [status, setStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading } = useTasks({ status });
  const updateStatus = useUpdateTaskStatus();
  const del = useDeleteTask();

  async function changeStatus(id: string, s: TaskStatus) {
    try {
      await updateStatus.mutateAsync({ id, status: s });
      toast.success('Task updated');
    } catch (e) {
      toast.error(apiError(e));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">{isAdmin ? 'Tasks' : 'My Tasks'}</h1>
        {isAdmin && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus size={16} /> Assign task
          </Button>
        )}
      </div>

      <Select className="w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">All statuses</option>
        <option value="pending">Pending</option>
        <option value="in_progress">In Progress</option>
        <option value="completed">Completed</option>
        <option value="cancelled">Cancelled</option>
      </Select>

      <Card>
        {isLoading ? (
          <Spinner />
        ) : !data?.data.length ? (
          <EmptyState title="No tasks" hint={isAdmin ? 'Assign a task to a telecaller.' : 'You have no tasks right now.'} />
        ) : (
          <div className="divide-y divide-slate-100">
            {data.data.map((task) => {
              const assignee = task.assignedTo as User | undefined;
              const overdue = task.status !== 'completed' && isOverdue(task.dueDate);
              return (
                <div key={task._id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-800">{task.title}</p>
                      <Badge className={TASK_STATUS_COLORS[task.status]}>
                        {TASK_STATUS_LABELS[task.status]}
                      </Badge>
                      <Badge className={PRIORITY_COLORS[task.priority]}>{task.priority}</Badge>
                    </div>
                    {task.description && <p className="text-sm text-slate-500">{task.description}</p>}
                    <p className="text-xs text-slate-400">
                      {isAdmin && assignee ? `${assignee.name} · ` : ''}
                      {task.dueDate && (
                        <span className={overdue ? 'font-medium text-rose-500' : ''}>
                          Due {fmtDate(task.dueDate)}
                          {overdue ? ' (overdue)' : ''}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex gap-1.5">
                    {task.status !== 'completed' && (
                      <>
                        {task.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => changeStatus(task._id, 'in_progress')}
                          >
                            <PlayCircle size={14} /> Start
                          </Button>
                        )}
                        <Button size="sm" variant="success" onClick={() => changeStatus(task._id, 'completed')}>
                          <CheckCircle2 size={14} /> Done
                        </Button>
                      </>
                    )}
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm('Delete this task?')) del.mutate(task._id);
                        }}
                      >
                        <Trash2 size={14} className="text-rose-500" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <TaskFormModal open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}
