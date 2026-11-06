import type {
  FeedPage,
  FriendRequests,
  MyAchievements,
  ReactionInput,
  ReactionSummary,
  Suggestion,
  UserCard,
  UserProfileView,
} from '@pace/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

/** Everything social shares this prefix, so any change refreshes all of it. */
const SOCIAL = ['social'] as const;

export type Friend = UserCard & { weekMinutes: number | null };

export const useFriends = () =>
  useQuery({ queryKey: [...SOCIAL, 'friends'], queryFn: () => api<Friend[]>('/friends') });

export const useFriendRequests = () =>
  useQuery({
    queryKey: [...SOCIAL, 'requests'],
    queryFn: () => api<FriendRequests>('/friends/requests'),
  });

export const useSuggestions = () =>
  useQuery({
    queryKey: [...SOCIAL, 'suggestions'],
    queryFn: () => api<Suggestion[]>('/friends/suggestions'),
  });

export const useUserSearch = (q: string) =>
  useQuery({
    queryKey: [...SOCIAL, 'search', q],
    queryFn: () => api<UserCard[]>(`/users/search?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
  });

export const useUserProfile = (username: string) =>
  useQuery({
    queryKey: [...SOCIAL, 'profile', username],
    queryFn: () => api<UserProfileView>(`/users/by-username/${encodeURIComponent(username)}`),
    retry: false,
  });

export const useFeed = () =>
  useInfiniteQuery({
    queryKey: [...SOCIAL, 'feed'],
    queryFn: ({ pageParam }) => api<FeedPage>(`/feed${pageParam ? `?cursor=${pageParam}` : ''}`),
    initialPageParam: '',
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });

export const useMyAchievements = () =>
  useQuery({
    // Under 'training': saving a session can award one.
    queryKey: ['training', 'achievements'],
    queryFn: () => api<MyAchievements>('/achievements'),
  });

/** Request, accept, decline, cancel and unfriend all refresh the social data. */
export function useFriendAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (action: {
      kind: 'request' | 'accept' | 'decline' | 'cancel' | 'remove';
      userId: string;
      requestId?: string | null;
    }) => {
      switch (action.kind) {
        case 'request':
          return api('/friends/requests', { method: 'POST', body: { userId: action.userId } });
        case 'accept':
          return api(`/friends/requests/${action.requestId}/accept`, { method: 'POST' });
        case 'decline':
          return api(`/friends/requests/${action.requestId}/decline`, { method: 'POST' });
        case 'cancel':
          return api(`/friends/requests/${action.requestId}`, { method: 'DELETE' });
        case 'remove':
          return api(`/friends/${action.userId}`, { method: 'DELETE' });
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: SOCIAL }),
  });
}

export function useReact() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ on, ...input }: ReactionInput & { on: boolean }) =>
      on
        ? api<ReactionSummary>('/reactions', { method: 'PUT', body: input })
        : api<ReactionSummary>(`/reactions/${input.targetType}/${input.targetId}/${input.type}`, {
            method: 'DELETE',
          }),
    onSuccess: () => client.invalidateQueries({ queryKey: SOCIAL }),
  });
}
