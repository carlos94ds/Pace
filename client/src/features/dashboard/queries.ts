import type { Dashboard, Goal, GoalInput, ReportListItem, WeeklyReport } from '@pace/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

// Under the 'training' prefix, so saving a session refreshes the dashboard too.
export const useDashboard = (from: string, to: string) =>
  useQuery({
    queryKey: ['training', 'dashboard', from, to],
    queryFn: () => api<Dashboard>(`/stats/dashboard?from=${from}&to=${to}`),
    placeholderData: (previous) => previous,
  });

export const useGoals = () =>
  useQuery({ queryKey: ['training', 'goals'], queryFn: () => api<Goal[]>('/goals') });

function useGoalMutation<V>(request: (vars: V) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: () => client.invalidateQueries({ queryKey: ['training'] }),
  });
}

export const useSaveGoal = () =>
  useGoalMutation(({ id, input }: { id?: string; input: GoalInput }) =>
    api<Goal>(id ? `/goals/${id}` : '/goals', { method: id ? 'PUT' : 'POST', body: input }),
  );

export const useDeleteGoal = () =>
  useGoalMutation((id: string) => api(`/goals/${id}`, { method: 'DELETE' }));

export const useReports = () =>
  useQuery({ queryKey: ['reports'], queryFn: () => api<ReportListItem[]>('/reports') });

export function useReport(weekStart: string) {
  const client = useQueryClient();
  return useQuery({
    queryKey: ['reports', weekStart],
    queryFn: async () => {
      const report = await api<WeeklyReport>(`/reports/${weekStart}`);
      // Opening a report marks it as viewed: refresh the list's "new" badges.
      void client.invalidateQueries({ queryKey: ['reports'], exact: true });
      return report;
    },
  });
}
