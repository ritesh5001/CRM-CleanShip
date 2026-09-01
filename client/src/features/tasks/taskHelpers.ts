import { isPast, isToday } from 'date-fns';
import type { Task, TaskType } from '@/types';

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  custom: 'To-do',
  call: 'Call',
  follow_up: 'Follow-up',
};

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

/** `yyyy-MM-ddTHH:mm` for a datetime-local input, offset by `minutesAgo` from `date`. */
export function localDateTimeInput(date = new Date(), minutesAgo = 0) {
  const d = new Date(date.getTime() - minutesAgo * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
