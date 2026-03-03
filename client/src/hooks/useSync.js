import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';

export function useSyncStatus() {
  return useQuery({
    queryKey: ['syncStatus'],
    queryFn: () => client.get('/sync/status').then((r) => r.data),
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.status === 'running' ? 2000 : false;
    },
  });
}

export function useStartSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => client.post('/sync', data).then((r) => r.data),
    onSuccess: () => {
      // Start polling
      qc.invalidateQueries({ queryKey: ['syncStatus'] });
    },
  });
}
