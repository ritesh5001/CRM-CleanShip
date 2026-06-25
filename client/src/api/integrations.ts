import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

/** Client-safe Twilio settings (secrets reduced to `*Set` flags). */
export interface TwilioIntegration {
  enabled: boolean;
  configured: boolean;
  accountSid: string;
  apiKeySid: string;
  twimlAppSid: string;
  callerId: string;
  recordCalls: boolean;
  publicServerUrl: string;
  authTokenSet: boolean;
  apiKeySecretSet: boolean;
  voiceWebhookUrl: string;
}

export interface TwilioIntegrationUpdate {
  enabled?: boolean;
  accountSid?: string;
  authToken?: string;
  apiKeySid?: string;
  apiKeySecret?: string;
  twimlAppSid?: string;
  callerId?: string;
  recordCalls?: boolean;
  publicServerUrl?: string;
}

export function useTwilioIntegration() {
  return useQuery({
    queryKey: ['twilio-integration'],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: TwilioIntegration }>('/integrations/twilio');
      return data.data;
    },
  });
}

export function useUpdateTwilioIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TwilioIntegrationUpdate) =>
      (await api.put<{ success: boolean; data: TwilioIntegration }>('/integrations/twilio', payload)).data
        .data,
    onSuccess: (data) => {
      qc.setQueryData(['twilio-integration'], data);
      // The softphone availability may have changed — refresh it everywhere.
      qc.invalidateQueries({ queryKey: ['call-config'] });
    },
  });
}
