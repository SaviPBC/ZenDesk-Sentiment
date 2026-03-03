import { useQuery } from '@tanstack/react-query';
import client from '../api/client';

export function useTickets({ from, to, sentiment, channel, page, limit }) {
  return useQuery({
    queryKey: ['tickets', from, to, sentiment, channel, page, limit],
    queryFn: () =>
      client
        .get('/tickets', { params: { from, to, sentiment, channel, page, limit } })
        .then((r) => r.data),
  });
}
