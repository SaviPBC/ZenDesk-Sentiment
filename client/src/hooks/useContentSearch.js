import { useMutation } from '@tanstack/react-query';
import client from '../api/client';

export function useContentSearch() {
  return useMutation({
    mutationFn: (payload) => client.post('/content-search', payload).then((r) => r.data),
  });
}
