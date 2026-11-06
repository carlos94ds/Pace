import type { Me } from '@pace/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext } from 'react';
import { api, ApiError } from '../../lib/api';

export const ME_KEY = ['me'] as const;

/** The logged-in user, or null when there's no session. */
export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await api<Me>('/me');
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60_000,
  });
}

/**
 * Provided by RequireAuth. Pages read the user from here rather than from the query cache,
 * so they never render with a missing user while a logout is redirecting.
 */
export const CurrentUserContext = createContext<Me | null>(null);

/** For pages behind RequireAuth, where the user is always loaded. */
export function useCurrentUser(): Me {
  const me = useContext(CurrentUserContext);
  if (!me) throw new Error('useCurrentUser used outside RequireAuth');
  return me;
}

/** A mutation whose response is the updated account. */
export function useMeMutation<V>(request: (vars: V) => Promise<Me>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: (me) => queryClient.setQueryData(ME_KEY, me),
  });
}

export function useLogout(all = false) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api(all ? '/auth/logout-all' : '/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(ME_KEY, null);
    },
  });
}
