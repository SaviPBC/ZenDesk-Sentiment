import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => client.get('/settings').then((r) => r.data),
  });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => client.put('/settings', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });
}

export function useTestConnection() {
  return useMutation({
    mutationFn: (data) => client.post('/settings/test', data).then((r) => r.data),
  });
}
