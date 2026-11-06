import type { NotificationPage } from '@pace/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

const KEY = ['notifications'] as const;

/** Checked every minute and whenever the window gets focus. */
export const useUnreadCount = () =>
  useQuery({
    queryKey: [...KEY, 'unread'],
    queryFn: () => api<{ unread: number }>('/notifications/unread-count'),
    refetchInterval: 60_000,
    select: (d) => d.unread,
  });

export const useNotifications = () =>
  useInfiniteQuery({
    queryKey: [...KEY, 'list'],
    queryFn: ({ pageParam }) =>
      api<NotificationPage>(`/notifications${pageParam ? `?cursor=${pageParam}` : ''}`),
    initialPageParam: '',
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });

export function useMarkRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) =>
      api<{ unread: number }>('/notifications/read', { method: 'POST', body: ids ? { ids } : {} }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}
