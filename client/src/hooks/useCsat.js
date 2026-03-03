import { useQuery } from '@tanstack/react-query';
import client from '../api/client';

export function useCsat(from, to, channel) {
  return useQuery({
    queryKey: ['csat', from, to, channel],
    queryFn: () =>
      client.get('/csat', { params: { from, to, channel } }).then((r) => r.data),
  });
}
