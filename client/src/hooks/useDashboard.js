import { useQuery } from '@tanstack/react-query';
import client from '../api/client';

export function useDashboard(from, to, channel) {
  return useQuery({
    queryKey: ['dashboard', from, to, channel],
    queryFn: () =>
      client.get('/dashboard', { params: { from, to, channel } }).then((r) => r.data),
    enabled: true,
  });
}
