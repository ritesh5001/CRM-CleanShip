import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { patchListItem, removeListItem, restoreSnapshots } from '@/lib/queryPatch';
import type { Paginated, Task, TaskStatus } from '@/types';

export interface TaskQuery {
  status?: string;
  priority?: string;
  assignedTo?: string;
  page?: number;
  limit?: number;
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

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Task> & { assignedTo: string }) =>
      (await api.post('/tasks', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useUpdateTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) =>
      (await api.patch(`/tasks/${id}/status`, { status })).data,
    // Reflect the new status instantly; reconcile with the server on settle.
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const snapshots = patchListItem<Task>(qc, ['tasks'], id, (t) => ({
        ...t,
        status,
        completedAt: status === 'completed' ? new Date().toISOString() : undefined,
      }));
      return { snapshots };
    },
    onError: (_e, _v, ctx) => restoreSnapshots(qc, ctx?.snapshots),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['my-stats'] });
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
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}
