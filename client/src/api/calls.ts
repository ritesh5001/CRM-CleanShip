import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { useAuthStore } from '@/store/auth';
import type { CallLog, CallStatus, Disposition, Lead, Paginated } from '@/types';

export function useCalls(params: { lead?: string; telecaller?: string; page?: number } = {}) {
  return useQuery({
    queryKey: ['calls', params],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean } & Paginated<CallLog>>('/calls', { params });
      return data;
    },
  });
}

/** Whether in-app (Twilio) calling is configured on the server (+ default country code). */
export function useCallConfig() {
  return useQuery({
    queryKey: ['call-config'],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; enabled: boolean; defaultCountryCode?: string }>(
        '/calls/config'
      );
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Fetches a fresh Twilio Voice access token for the browser softphone. */
export async function fetchVoiceToken(): Promise<string> {
  const { data } = await api.get<{ success: boolean; token: string; identity: string }>('/calls/token');
  return data.token;
}

/** Downloads a call's recording (auth-proxied) and returns a playable object URL. */
export async function fetchRecordingObjectUrl(callId: string): Promise<string> {
  const { data } = await api.get(`/calls/${callId}/recording`, { responseType: 'blob' });
  return URL.createObjectURL(data as Blob);
}

// Mirror of the server's DISPOSITION_TO_LEAD_STATUS for optimistic row updates.
const DISPOSITION_TO_LEAD_STATUS: Record<Disposition, Lead['status']> = {
  interested: 'interested',
  callback: 'callback',
  not_interested: 'not_interested',
  busy: 'in_progress',
  switched_off: 'in_progress',
  wrong_number: 'not_interested',
  dnd: 'dnd',
  converted: 'converted',
};

interface LogCallVars {
  lead: string;
  callStatus: CallStatus;
  disposition?: Disposition;
  notes?: string;
  remark?: string;
  durationSec?: number;
  nextFollowUpAt?: string;
  twilioCallSid?: string;
  phone?: 'phone1' | 'phone2' | 'phone3';
  phoneNumber?: string;
}

/** Optimistically patch a single lead across every cached `['leads', …]` list. */
export function patchLeadInLists(
  qc: ReturnType<typeof useQueryClient>,
  id: string,
  update: (l: Lead) => Lead
) {
  const snapshots = qc.getQueriesData<{ data: Lead[] } & Record<string, unknown>>({ queryKey: ['leads'] });
  qc.setQueriesData<{ data: Lead[] } & Record<string, unknown>>({ queryKey: ['leads'] }, (old) => {
    if (!old?.data) return old;
    return { ...old, data: old.data.map((l) => (l._id === id ? update(l) : l)) };
  });
  return snapshots;
}

export function useLogCall() {
  const qc = useQueryClient();
  const user = useAuthStore.getState().user;

  return useMutation({
    mutationFn: async (payload: LogCallVars) => (await api.post('/calls', payload)).data,
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ['leads'] });
      const snapshots = patchLeadInLists(qc, vars.lead, (l) => {
        const next: Lead = { ...l };
        if (vars.callStatus === 'done' && vars.disposition) {
          next.callStatus = 'done';
          next.lastOutcome = vars.disposition;
          next.status = DISPOSITION_TO_LEAD_STATUS[vars.disposition];
          if (vars.disposition === 'interested' || vars.disposition === 'converted') next.qualified = true;
        } else if (vars.callStatus === 'not_done') {
          next.callStatus = 'not_done';
        }
        next.lastContactedAt = new Date().toISOString();
        if (vars.remark) {
          next.remarks = [
            ...(l.remarks ?? []),
            {
              text: vars.remark,
              byName: user?.name,
              byRole: user?.role,
              phone: vars.phone,
              createdAt: new Date().toISOString(),
            },
          ];
        }
        return next;
      });
      return { snapshots };
    },
    onError: (_e, _v, ctx) => {
      ctx?.snapshots?.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['lead-stats'] });
      qc.invalidateQueries({ queryKey: ['followups'] });
      qc.invalidateQueries({ queryKey: ['my-stats'] });
      qc.invalidateQueries({ queryKey: ['calls'] });
    },
  });
}
