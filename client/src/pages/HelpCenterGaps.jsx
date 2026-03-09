import { useHcGaps, useStartGapAnalysis, useGapStatus } from '../hooks/useHelpCenter';

export default function HelpCenterGaps() {
  const { data: gaps = [], isLoading } = useHcGaps();
  const gapStatus = useGapStatus();
  const startGap = useStartGapAnalysis();

  const isRunning = gapStatus.data?.status === 'running';

  return (
    <div style={{ padding: 32, maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Gap Analysis</h1>
          <p style={{ color: 'var(--color-muted)', fontSize: 14 }}>
            Topics generating support tickets that lack Help Center coverage.
          </p>
        </div>
        <button
          onClick={() => startGap.mutate()}
          disabled={isRunning}
          style={{
            padding: '9px 18px', borderRadius: 6, border: 'none',
            background: 'var(--color-primary)', color: '#fff', cursor: 'pointer',
            fontWeight: 500, opacity: isRunning ? 0.5 : 1, flexShrink: 0,
          }}
        >
          {isRunning ? `Analyzing... ${gapStatus.data?.phase || ''}` : 'Run Gap Analysis'}
        </button>
      </div>

      {gapStatus.data?.status === 'error' && (
        <div style={{ background: '#ef444422', border: '1px solid #ef4444', borderRadius: 6, padding: '10px 14px', marginBottom: 20, color: '#ef4444', fontSize: 13 }}>
          {gapStatus.data.error}
        </div>
      )}

      {isLoading ? (
        <div style={{ color: 'var(--color-muted)', padding: 40, textAlign: 'center' }}>Loading gaps...</div>
      ) : gaps.length === 0 ? (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 40, textAlign: 'center', color: 'var(--color-muted)' }}>
          No gaps found yet. Run Gap Analysis above (requires ticket sync with AI topics + Help Center sync).
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {gaps.map((gap) => (
            <div key={gap.id} style={{
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 8, padding: '16px 20px',
              borderLeft: `3px solid ${gap.gap_score >= 70 ? '#ef4444' : gap.gap_score >= 40 ? '#f59e0b' : '#22c55e'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{gap.topic_label}</span>
                <span style={{
                  fontSize: 12, padding: '2px 10px', borderRadius: 12,
                  background: '#6366f122', color: '#6366f1', fontWeight: 500,
                }}>
                  {gap.ticket_count} tickets
                </span>
                <span style={{
                  fontSize: 12, padding: '2px 10px', borderRadius: 12,
                  background: '#00000015', color: 'var(--color-muted)',
                }}>
                  Gap score: {Math.round(gap.gap_score)}
                </span>
              </div>

              {gap.suggested_title && (
                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--color-muted)', marginRight: 6 }}>Suggested article:</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-primary)' }}>{gap.suggested_title}</span>
                </div>
              )}

              {gap.suggested_outline && (
                <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: 0, lineHeight: 1.5 }}>
                  {gap.suggested_outline}
                </p>
              )}

              {gap.related_article_ids?.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-muted)' }}>
                  Partially covered by article IDs: {gap.related_article_ids.join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
