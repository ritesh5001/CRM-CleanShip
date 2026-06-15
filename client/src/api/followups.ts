import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { FollowUp, Paginated } from '@/types';

export function useFollowUps(params: { scope?: string; telecaller?: string; page?: number } = {}) {
  return useQuery({
    queryKey: ['followups', params],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean } & Paginated<FollowUp>>('/followups', { params });
      return data;
    },
  });
}

export function useMarkFollowUpDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.patch(`/followups/${id}/done`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['followups'] });
      qc.invalidateQueries({ queryKey: ['my-stats'] });
    },
  });
}
