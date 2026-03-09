import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';

// ── Overview ──────────────────────────────────────────────────────────────────

export function useHcOverview() {
  return useQuery({
    queryKey: ['hc-overview'],
    queryFn: () => client.get('/help-center/overview').then((r) => r.data),
  });
}

// ── Sync ──────────────────────────────────────────────────────────────────────

export function useHcSyncStatus() {
  return useQuery({
    queryKey: ['hc-sync-status'],
    queryFn: () => client.get('/help-center/sync/status').then((r) => r.data),
    refetchInterval: (query) => (query.state.data?.status === 'running' ? 2000 : false),
  });
}

export function useStartHcSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => client.post('/help-center/sync').then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hc-sync-status'] });
      qc.invalidateQueries({ queryKey: ['hc-overview'] });
    },
  });
}

// ── Articles ──────────────────────────────────────────────────────────────────

export function useHcArticles(params = {}) {
  return useQuery({
    queryKey: ['hc-articles', params],
    queryFn: () => client.get('/help-center/articles', { params }).then((r) => r.data),
  });
}

// ── Audit ─────────────────────────────────────────────────────────────────────

export function useAuditStatus() {
  return useQuery({
    queryKey: ['hc-audit-status'],
    queryFn: () => client.get('/help-center/audit/status').then((r) => r.data),
    refetchInterval: (query) => (query.state.data?.status === 'running' ? 2000 : false),
  });
}

export function useStartAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => client.post('/help-center/audit').then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hc-audit-status'] });
      qc.invalidateQueries({ queryKey: ['hc-articles'] });
      qc.invalidateQueries({ queryKey: ['hc-overview'] });
    },
  });
}

// ── Gap Analysis ──────────────────────────────────────────────────────────────

export function useGapStatus() {
  return useQuery({
    queryKey: ['hc-gap-status'],
    queryFn: () => client.get('/help-center/gap-analysis/status').then((r) => r.data),
    refetchInterval: (query) => (query.state.data?.status === 'running' ? 2000 : false),
  });
}

export function useStartGapAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => client.post('/help-center/gap-analysis').then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hc-gap-status'] });
      qc.invalidateQueries({ queryKey: ['hc-gaps'] });
      qc.invalidateQueries({ queryKey: ['hc-overview'] });
    },
  });
}

export function useHcGaps() {
  return useQuery({
    queryKey: ['hc-gaps'],
    queryFn: () => client.get('/help-center/gaps').then((r) => r.data),
  });
}

// ── Improvements ──────────────────────────────────────────────────────────────

export function useHcImprovements() {
  return useQuery({
    queryKey: ['hc-improvements'],
    queryFn: () => client.get('/help-center/improvements').then((r) => r.data),
  });
}

export function useHcImprovement(id) {
  return useQuery({
    queryKey: ['hc-improvement', id],
    queryFn: () => client.get(`/help-center/improvements/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useGenerateImprovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ articleId, referenceUrl }) =>
      client.post(`/help-center/articles/${articleId}/improve`, { reference_url: referenceUrl || undefined }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hc-improvements'] });
      qc.invalidateQueries({ queryKey: ['hc-overview'] });
    },
  });
}

export function useUpdateImprovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => client.put(`/help-center/improvements/${id}`, { status }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hc-improvements'] }),
  });
}

export function usePublishImprovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => client.post(`/help-center/improvements/${id}/publish`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hc-improvements'] });
      qc.invalidateQueries({ queryKey: ['hc-articles'] });
    },
  });
}

// ── Discoverability ───────────────────────────────────────────────────────────

export function useDiscoverabilityStatus() {
  return useQuery({
    queryKey: ['hc-disc-status'],
    queryFn: () => client.get('/help-center/discoverability/status').then((r) => r.data),
    refetchInterval: (query) => (query.state.data?.status === 'running' ? 2000 : false),
  });
}

export function useStartDiscoverability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => client.post('/help-center/discoverability').then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hc-disc-status'] });
      qc.invalidateQueries({ queryKey: ['hc-discoverability'] });
      qc.invalidateQueries({ queryKey: ['hc-overview'] });
    },
  });
}

export function useHcDiscoverability() {
  return useQuery({
    queryKey: ['hc-discoverability'],
    queryFn: () => client.get('/help-center/discoverability').then((r) => r.data),
  });
}

// ── Freshness ─────────────────────────────────────────────────────────────────

export function useFreshnessStatus() {
  return useQuery({
    queryKey: ['hc-freshness-status'],
    queryFn: () => client.get('/help-center/freshness/status').then((r) => r.data),
    refetchInterval: (query) => (query.state.data?.status === 'running' ? 2000 : false),
  });
}

export function useStartFreshnessCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload = {}) => client.post('/help-center/freshness/run', payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hc-freshness-status'] });
      qc.invalidateQueries({ queryKey: ['hc-freshness'] });
      qc.invalidateQueries({ queryKey: ['hc-overview'] });
    },
  });
}

export function useHcFreshness(resolved = false) {
  return useQuery({
    queryKey: ['hc-freshness', resolved],
    queryFn: () => client.get('/help-center/freshness', { params: { resolved: resolved ? '1' : '0' } }).then((r) => r.data),
  });
}

export function useResolveFreshnessAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => client.put(`/help-center/freshness/${id}/resolve`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hc-freshness'] });
      qc.invalidateQueries({ queryKey: ['hc-overview'] });
    },
  });
}
