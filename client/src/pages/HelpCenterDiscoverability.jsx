import { useHcDiscoverability, useStartDiscoverability, useDiscoverabilityStatus } from '../hooks/useHelpCenter';

export default function HelpCenterDiscoverability() {
  const { data: suggestions = [], isLoading } = useHcDiscoverability();
  const discStatus = useDiscoverabilityStatus();
  const startDisc = useStartDiscoverability();

  const isRunning = discStatus.data?.status === 'running';

  return (
    <div style={{ padding: 32, maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Discoverability Agent</h1>
          <p style={{ color: 'var(--color-muted)', fontSize: 14 }}>
            Suggests better titles, labels, and related article links based on how customers phrase questions.
          </p>
        </div>
        <button
          onClick={() => startDisc.mutate()}
          disabled={isRunning}
          style={{
            padding: '9px 18px', borderRadius: 6, border: 'none',
            background: 'var(--color-primary)', color: '#fff', cursor: 'pointer',
            fontWeight: 500, opacity: isRunning ? 0.5 : 1, flexShrink: 0,
          }}
        >
          {isRunning
            ? `Analyzing... ${discStatus.data?.progress || 0}/${discStatus.data?.total || 0}`
            : 'Run Analysis'}
        </button>
      </div>

      {discStatus.data?.status === 'error' && (
        <div style={{ background: '#ef444422', border: '1px solid #ef4444', borderRadius: 6, padding: '10px 14px', marginBottom: 20, color: '#ef4444', fontSize: 13 }}>
          {discStatus.data.error}
        </div>
      )}

      {isLoading ? (
        <div style={{ color: 'var(--color-muted)', padding: 40, textAlign: 'center' }}>Loading...</div>
      ) : suggestions.length === 0 ? (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 40, textAlign: 'center', color: 'var(--color-muted)' }}>
          No suggestions yet. Run the analysis above (requires Help Center sync and ticket data).
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {suggestions.map((s) => (
            <div key={s.id} style={{
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 8, padding: '16px 20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                {s.article_url
                  ? <a href={s.article_url} target="_blank" rel="noreferrer" style={{ fontWeight: 600, color: 'var(--color-primary)', fontSize: 15 }}>{s.current_title}</a>
                  : <span style={{ fontWeight: 600, fontSize: 15 }}>{s.current_title}</span>
                }
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, fontSize: 13 }}>
                {s.suggested_title && (
                  <div>
                    <div style={{ color: 'var(--color-muted)', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Better Title</div>
                    <div style={{ color: '#22c55e', fontWeight: 500 }}>{s.suggested_title}</div>
                  </div>
                )}

                {s.suggested_labels?.length > 0 && (
                  <div>
                    <div style={{ color: 'var(--color-muted)', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Add Labels</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {s.suggested_labels.map((l) => (
                        <span key={l} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: '#6366f122', color: '#6366f1', fontWeight: 500 }}>
                          {l}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {s.suggested_related_ids?.length > 0 && (
                  <div>
                    <div style={{ color: 'var(--color-muted)', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Link Related</div>
                    <div style={{ color: 'var(--color-muted)' }}>Article IDs: {s.suggested_related_ids.join(', ')}</div>
                  </div>
                )}
              </div>

              {s.reasoning && (
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-muted)', fontStyle: 'italic' }}>
                  {s.reasoning}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
