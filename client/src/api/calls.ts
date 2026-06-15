import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { CallLog, CallStatus, Disposition, Paginated } from '@/types';

export function useCalls(params: { lead?: string; telecaller?: string; page?: number } = {}) {
  return useQuery({
    queryKey: ['calls', params],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean } & Paginated<CallLog>>('/calls', { params });
      return data;
    },
  });
}

export function useLogCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      lead: string;
      callStatus: CallStatus;
      disposition?: Disposition;
      notes?: string;
      remark?: string;
      durationSec?: number;
      nextFollowUpAt?: string;
    }) => (await api.post('/calls', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calls'] });
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['followups'] });
      qc.invalidateQueries({ queryKey: ['my-stats'] });
    },
  });
}
