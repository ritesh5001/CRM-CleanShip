import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { Lead, Paginated } from '@/types';

export interface LeadQuery {
  search?: string;
  status?: string;
  priority?: string;
  assignedTo?: string;
  page?: number;
  limit?: number;
}

export function useLeads(params: LeadQuery = {}) {
  return useQuery({
    queryKey: ['leads', params],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean } & Paginated<Lead>>('/leads', { params });
      return data;
    },
  });
}

export function useLead(id?: string) {
  return useQuery({
    queryKey: ['lead', id],
    enabled: !!id,
    queryFn: async () => (await api.get<{ lead: Lead }>(`/leads/${id}`)).data.lead,
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Lead>) => (await api.post('/leads', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<Lead>) =>
      (await api.put(`/leads/${id}`, payload)).data,
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['lead', v.id] });
    },
  });
}

export function useAssignLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, assignedTo }: { id: string; assignedTo: string }) =>
      (await api.patch(`/leads/${id}/assign`, { assignedTo })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });
}

export function useBulkAssignLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadIds, assignedTo }: { leadIds: string[]; assignedTo: string }) =>
      (await api.patch('/leads/bulk-assign', { leadIds, assignedTo })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/leads/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });
}

export function useImportLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, assignedTo }: { file: File; assignedTo?: string }) => {
      const fd = new FormData();
      fd.append('file', file);
      if (assignedTo) fd.append('assignedTo', assignedTo);
      const { data } = await api.post('/leads/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.result as { totalRows: number; successCount: number; errorCount: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });
}
