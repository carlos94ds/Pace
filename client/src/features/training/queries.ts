import type {
  SessionInput,
  SessionPage,
  Sport,
  SportInput,
  TrainingSession,
  TrainingStats,
} from '@pace/shared';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { api } from '../../lib/api';

/** Everything derived from sessions shares this prefix, so one invalidation refreshes it all. */
const TRAINING = ['training'] as const;
export const SPORTS_KEY = ['sports'] as const;

export interface HistoryFilters {
  sportId?: string;
  punctuality?: 'on_time' | 'late';
  from?: string;
  to?: string;
}

const query = (params: Record<string, string | undefined>) =>
  new URLSearchParams(
    Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])),
  ).toString();

export const useSports = () =>
  useQuery({ queryKey: SPORTS_KEY, queryFn: () => api<Sport[]>('/sports'), staleTime: 60_000 });

export const useCalendarSessions = (from: string, to: string) =>
  useQuery({
    queryKey: [...TRAINING, 'calendar', from, to],
    queryFn: () => api<TrainingSession[]>(`/sessions/calendar?${query({ from, to })}`),
    placeholderData: (previous) => previous,
  });

export const useStats = (from: string, to: string) =>
  useQuery({
    queryKey: [...TRAINING, 'stats', from, to],
    queryFn: () => api<TrainingStats>(`/stats/summary?${query({ from, to })}`),
    placeholderData: (previous) => previous,
  });

export const useHistory = (filters: HistoryFilters) =>
  useInfiniteQuery({
    queryKey: [...TRAINING, 'history', filters],
    queryFn: ({ pageParam }) =>
      api<SessionPage>(`/sessions?${query({ ...filters, cursor: pageParam, limit: '25' })}`),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });

const refreshTraining = (client: QueryClient) => client.invalidateQueries({ queryKey: TRAINING });

export function useSaveSession() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: SessionInput }) =>
      api<TrainingSession>(id ? `/sessions/${id}` : '/sessions', {
        method: id ? 'PUT' : 'POST',
        body: input,
      }),
    onSuccess: () => refreshTraining(client),
  });
}

export function useDeleteSession() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/sessions/${id}`, { method: 'DELETE' }),
    onSuccess: () => refreshTraining(client),
  });
}

export function useSaveSport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: SportInput }) =>
      api<Sport>(id ? `/sports/${id}` : '/sports', { method: id ? 'PUT' : 'POST', body: input }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: SPORTS_KEY });
      // Renamed sports appear inside session data and the profile.
      await refreshTraining(client);
      await client.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function useDeleteSport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/sports/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: SPORTS_KEY });
      await client.invalidateQueries({ queryKey: ['me'] });
    },
  });
}
