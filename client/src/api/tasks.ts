import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/tasks/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}
