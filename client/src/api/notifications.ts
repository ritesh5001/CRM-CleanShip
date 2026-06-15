import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { Notification, Paginated } from '@/types';

export function useNotifications(params: { unread?: string; page?: number } = {}) {
  return useQuery({
    queryKey: ['notifications', params],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; unreadCount: number } & Paginated<Notification>>(
        '/notifications',
        { params }
      );
      return data;
    },
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.patch(`/notifications/${id}/read`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.patch('/notifications/read-all')).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
