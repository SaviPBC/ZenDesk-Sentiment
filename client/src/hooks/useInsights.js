import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';

export function useInsightsRuns() {
  return useQuery({
    queryKey: ['insights-runs'],
    queryFn: () => client.get('/insights').then((r) => r.data),
  });
}

export function useInsightsRun(id) {
  return useQuery({
    queryKey: ['insights-run', id],
    queryFn: () => client.get(`/insights/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useInsightsStatus(polling = false) {
  return useQuery({
    queryKey: ['insights-status'],
    queryFn: () => client.get('/insights/status').then((r) => r.data),
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return (s === 'running' || polling) ? 2000 : false;
    },
  });
}

export function useRunInsights() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => client.post('/insights', payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['insights-status'] });
      qc.invalidateQueries({ queryKey: ['insights-runs'] });
    },
  });
}
