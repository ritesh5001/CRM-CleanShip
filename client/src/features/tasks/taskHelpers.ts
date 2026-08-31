import { isPast, isToday, isTomorrow } from 'date-fns';
import type { Task, TaskType } from '@/types';

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  call: 'Call',
  follow_up: 'Follow-up',
  custom: 'To-do',
};

export const OPEN_STATUSES = ['pending', 'in_progress'] as const;

export function isOpen(task: Task) {
  return task.status === 'pending' || task.status === 'in_progress';
}

/**
 * A due date carrying a time is overdue the moment it passes; a date-only due
 * date (midnight) only goes overdue once the day is over.
 */
export function isTaskOverdue(task: Task) {
  if (!task.dueDate || !isOpen(task)) return false;
  const due = new Date(task.dueDate);
  const dateOnly = due.getHours() === 0 && due.getMinutes() === 0;
  return dateOnly ? isPast(due) && !isToday(due) : isPast(due);
}

export type Bucket = 'overdue' | 'today' | 'tomorrow' | 'later' | 'undated' | 'closed';

export const BUCKET_LABELS: Record<Bucket, string> = {
  overdue: 'Overdue',
  today: 'Due today',
  tomorrow: 'Due tomorrow',
  later: 'Upcoming',
  undated: 'No due date',
  closed: 'Finished',
};

/** Which group a task belongs to in the grouped list view. */
export function bucketOf(task: Task): Bucket {
  if (!isOpen(task)) return 'closed';
  if (isTaskOverdue(task)) return 'overdue';
  if (!task.dueDate) return 'undated';
  const due = new Date(task.dueDate);
  if (isToday(due)) return 'today';
  if (isTomorrow(due)) return 'tomorrow';
  return 'later';
}

export const BUCKET_ORDER: Bucket[] = ['overdue', 'today', 'tomorrow', 'later', 'undated', 'closed'];

/** Groups a page of tasks into due-date buckets, preserving the server's ordering. */
export function groupByBucket(tasks: Task[]): [Bucket, Task[]][] {
  const groups = new Map<Bucket, Task[]>();
  tasks.forEach((t) => {
    const b = bucketOf(t);
    const list = groups.get(b);
    if (list) list.push(t);
    else groups.set(b, [t]);
  });
  return BUCKET_ORDER.filter((b) => groups.has(b)).map((b) => [b, groups.get(b)!]);
}

/** `yyyy-MM-ddTHH:mm` for a datetime-local input, offset by `minutes` from now. */
export function localDateTimeInput(date = new Date(), minutesAgo = 0) {
  const d = new Date(date.getTime() - minutesAgo * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
