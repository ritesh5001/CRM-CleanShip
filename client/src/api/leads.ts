import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { patchLeadInLists } from './calls';
import { useAuthStore } from '@/store/auth';
import type { Lead, Paginated } from '@/types';

export interface LeadQuery {
  search?: string;
  status?: string;
  priority?: string;
  assignedTo?: string;
  qualified?: string;
  callStatus?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface LeadStats {
  total: number;
  notCalled: number;
  done: number;
  notDone: number;
  leads: number;
}

export function useLeadStats(params: LeadQuery = {}) {
  // Stats ignore callStatus/page/limit (server recomputes per chip within the scope).
  const { callStatus: _c, page: _p, limit: _l, ...scope } = params;
  return useQuery({
    queryKey: ['lead-stats', scope],
    queryFn: async () => (await api.get<{ stats: LeadStats }>('/leads/stats', { params: scope })).data.stats,
  });
}

export async function fetchLeadsForExport(params: LeadQuery): Promise<Lead[]> {
  const { page: _p, limit: _l, ...rest } = params;
  const { data } = await api.get<{ data: Lead[] }>('/leads/export', { params: rest });
  return data.data;
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

/** Contacts are the full list (no qualified filter); Leads are the qualified subset. */
export const useContacts = useLeads;

export function useAddRemark() {
  const qc = useQueryClient();
  const user = useAuthStore.getState().user;
  return useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) =>
      (await api.post(`/leads/${id}/remarks`, { text })).data,
    onMutate: async ({ id, text }) => {
      await qc.cancelQueries({ queryKey: ['leads'] });
      const snapshots = patchLeadInLists(qc, id, (l) => ({
        ...l,
        remarks: [
          ...(l.remarks ?? []),
          { text, byName: user?.name, byRole: user?.role, createdAt: new Date().toISOString() },
        ],
      }));
      return { snapshots };
    },
    onError: (_e, _v, ctx) => ctx?.snapshots?.forEach(([key, data]) => qc.setQueryData(key, data)),
    onSettled: (_d, _e, v) => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['lead', v.id] });
    },
  });
}

export function useScheduleFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, scheduledAt, notes }: { id: string; scheduledAt: string; notes?: string }) =>
      (await api.post(`/leads/${id}/followup`, { scheduledAt, notes })).data,
    onMutate: async ({ id, scheduledAt }) => {
      await qc.cancelQueries({ queryKey: ['leads'] });
      const snapshots = patchLeadInLists(qc, id, (l) => ({ ...l, nextFollowUpAt: scheduledAt }));
      return { snapshots };
    },
    onError: (_e, _v, ctx) => ctx?.snapshots?.forEach(([key, data]) => qc.setQueryData(key, data)),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['followups'] });
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
    mutationFn: async ({ id, assignedTo }: { id: string; assignedTo: string; assignedToName?: string }) =>
      (await api.patch(`/leads/${id}/assign`, { assignedTo })).data,
    onMutate: async ({ id, assignedTo, assignedToName }) => {
      await qc.cancelQueries({ queryKey: ['leads'] });
      const snapshots = patchLeadInLists(qc, id, (l) => ({
        ...l,
        assignedTo: { _id: assignedTo, name: assignedToName ?? '' } as Lead['assignedTo'],
        status: l.status === 'new' ? 'assigned' : l.status,
      }));
      return { snapshots };
    },
    onError: (_e, _v, ctx) => ctx?.snapshots?.forEach(([key, data]) => qc.setQueryData(key, data)),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['lead-stats'] });
    },
  });
}

export function useBulkAssignLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadIds, assignedTo }: { leadIds: string[]; assignedTo: string; assignedToName?: string }) =>
      (await api.patch('/leads/bulk-assign', { leadIds, assignedTo })).data,
    onMutate: async ({ leadIds, assignedTo, assignedToName }) => {
      await qc.cancelQueries({ queryKey: ['leads'] });
      const ids = new Set(leadIds);
      const snapshots = qc.getQueriesData<{ data: Lead[] }>({ queryKey: ['leads'] });
      qc.setQueriesData<{ data: Lead[] }>({ queryKey: ['leads'] }, (old) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((l) =>
            ids.has(l._id)
              ? { ...l, assignedTo: { _id: assignedTo, name: assignedToName ?? '' } as Lead['assignedTo'], status: l.status === 'new' ? 'assigned' : l.status }
              : l
          ),
        };
      });
      return { snapshots };
    },
    onError: (_e, _v, ctx) => ctx?.snapshots?.forEach(([key, data]) => qc.setQueryData(key, data)),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['lead-stats'] });
    },
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
