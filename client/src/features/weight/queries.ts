import type { WeightEntry } from '@pace/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

const KEY = ['weights'] as const;

export const useWeights = () =>
  useQuery({ queryKey: KEY, queryFn: () => api<WeightEntry[]>('/weights') });

export function useAddWeight() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) => api<WeightEntry>('/weights', { method: 'POST', body: form }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteWeight() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/weights/${id}`, { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}
