import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { patchListItem, removeListItem, restoreSnapshots } from '@/lib/queryPatch';
import type { Paginated, Task, TaskStatus, TaskType } from '@/types';

export interface TaskQuery {
  search?: string;
  status?: string;
  priority?: string;
  type?: string;
  assignedTo?: string;
  /** Due-date window: today | overdue | upcoming | undated | all. */
  scope?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface TaskStats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  overdue: number;
  dueToday: number;
}

/** Payload shared by the create/edit form. */
export interface TaskFormPayload {
  title: string;
  description?: string;
  type: TaskType;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string | null;
  relatedLead?: string | null;
}

export interface CompletionPayload {
  completedAt?: string;
  completionNote?: string;
  timeSpentMin?: number;
}

export function useTasks(params: TaskQuery = {}) {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean } & Paginated<Task>>('/tasks', { params });
      return data;
    },
  });
}

/** Single task — used by the detail view, which may be deep-linked to a task outside the current page. */
export function useTask(id?: string | null) {
  return useQuery({
    queryKey: ['task', id],
    enabled: Boolean(id),
    queryFn: async () => (await api.get<{ task: Task }>(`/tasks/${id}`)).data.task,
  });
}

/** Counts for the status tabs. Ignores `status`/paging — the server recomputes each tab in scope. */
export function useTaskStats(params: TaskQuery = {}) {
  const { status: _s, page: _p, limit: _l, ...scope } = params;
  return useQuery({
    queryKey: ['task-stats', scope],
    queryFn: async () => (await api.get<{ stats: TaskStats }>('/tasks/stats', { params: scope })).data.stats,
  });
}

function invalidateTasks(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['tasks'] });
  qc.invalidateQueries({ queryKey: ['task'] });
  qc.invalidateQueries({ queryKey: ['task-stats'] });
  qc.invalidateQueries({ queryKey: ['my-stats'] });
  qc.invalidateQueries({ queryKey: ['overview'] });
}

/** Creates one task per selected assignee (the server fans it out). */
export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TaskFormPayload & { assignedTo: string[] }) =>
      (await api.post<{ tasks: Task[]; count: number }>('/tasks', payload)).data,
    onSuccess: () => invalidateTasks(qc),
  });
}

/** Inline cell edits patch the row immediately so the table never flickers. */
export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<TaskFormPayload> & { assignedTo?: string; status?: TaskStatus; completedAt?: string }) =>
      (await api.put<{ task: Task }>(`/tasks/${id}`, payload)).data.task,
    onMutate: async ({ id, ...payload }) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const snapshots = patchListItem<Task>(qc, ['tasks'], id, (t) => ({
        ...t,
        ...(payload.title !== undefined && { title: payload.title }),
        ...(payload.description !== undefined && { description: payload.description }),
        ...(payload.type !== undefined && { type: payload.type }),
        ...(payload.priority !== undefined && { priority: payload.priority }),
        ...(payload.status !== undefined && { status: payload.status }),
        ...(payload.dueDate !== undefined && { dueDate: payload.dueDate ?? undefined }),
      }));
      return { snapshots };
    },
    onError: (_e, _v, ctx) => restoreSnapshots(qc, ctx?.snapshots),
    onSettled: () => invalidateTasks(qc),
  });
}

export function useUpdateTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, ...rest }: { id: string; status: TaskStatus } & CompletionPayload) =>
      (await api.patch<{ task: Task }>(`/tasks/${id}/status`, { status, ...rest })).data.task,
    // Reflect the new status instantly; reconcile with the server on settle.
    onMutate: async ({ id, status, completedAt, completionNote, timeSpentMin }) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const done = status === 'completed';
      const snapshots = patchListItem<Task>(qc, ['tasks'], id, (t) => ({
        ...t,
        status,
        completedAt: done ? completedAt ?? new Date().toISOString() : undefined,
        completionNote: done ? completionNote ?? t.completionNote : '',
        timeSpentMin: done ? timeSpentMin ?? t.timeSpentMin : undefined,
      }));
      return { snapshots };
    },
    onError: (_e, _v, ctx) => restoreSnapshots(qc, ctx?.snapshots),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task'] });
      qc.invalidateQueries({ queryKey: ['task-stats'] });
      qc.invalidateQueries({ queryKey: ['my-stats'] });
      qc.invalidateQueries({ queryKey: ['overview'] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/tasks/${id}`)).data,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const snapshots = removeListItem<Task>(qc, ['tasks'], id);
      return { snapshots };
    },
    onError: (_e, _v, ctx) => restoreSnapshots(qc, ctx?.snapshots),
    onSettled: () => invalidateTasks(qc),
  });
}
