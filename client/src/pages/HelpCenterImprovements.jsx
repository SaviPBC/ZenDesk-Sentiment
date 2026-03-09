import { useState } from 'react';
import { useHcImprovements, useUpdateImprovement, usePublishImprovement, useHcImprovement } from '../hooks/useHelpCenter';

const STATUS_STYLES = {
  pending: { background: '#f59e0b22', color: '#f59e0b' },
  approved: { background: '#22c55e22', color: '#22c55e' },
  rejected: { background: '#ef444422', color: '#ef4444' },
  published: { background: '#6366f122', color: '#6366f1' },
};

function DiffView({ original, improved }) {
  const [view, setView] = useState('improved');
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {['improved', 'original'].map((v) => (
          <button key={v} onClick={() => setView(v)}
            style={{
              padding: '4px 12px', borderRadius: 5, border: '1px solid var(--color-border)',
              background: view === v ? 'var(--color-primary)' : 'transparent',
              color: view === v ? '#fff' : 'var(--color-text)', cursor: 'pointer', fontSize: 12,
            }}>
            {v === 'improved' ? 'Improved' : 'Original'}
          </button>
        ))}
      </div>
      <div style={{
        border: '1px solid var(--color-border)', borderRadius: 6, padding: 16,
        background: '#00000008', maxHeight: 400, overflowY: 'auto', fontSize: 13,
        lineHeight: 1.6,
      }}
        dangerouslySetInnerHTML={{ __html: view === 'improved' ? (improved || '') : (original || '') }}
      />
    </div>
  );
}

function ImprovementDetail({ id, onClose }) {
  const { data: imp } = useHcImprovement(id);
  const updateImp = useUpdateImprovement();
  const publishImp = usePublishImprovement();

  if (!imp) return null;

  async function handleAction(action) {
    if (action === 'approved' || action === 'rejected') {
      await updateImp.mutateAsync({ id, status: action });
    } else if (action === 'publish') {
      if (!window.confirm('Publish this improvement to Zendesk Guide? This will overwrite the live article.')) return;
      try {
        await publishImp.mutateAsync(id);
        alert('Published successfully!');
      } catch (err) {
        alert('Publish failed: ' + (err.response?.data?.error || err.message));
      }
    }
    onClose();
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 10, padding: 28, maxWidth: 800, width: '100%', maxHeight: '90vh',
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{imp.suggested_title || imp.original_title}</h2>
            {imp.article_url && (
              <a href={imp.article_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--color-primary)' }}>
                View live article →
              </a>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--color-muted)' }}>×</button>
        </div>

        {imp.improvement_notes && (
          <div style={{ background: '#6366f115', border: '1px solid #6366f133', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--color-text)' }}>
            <strong>Changes made:</strong> {imp.improvement_notes}
          </div>
        )}

        <DiffView original={imp.original_body} improved={imp.improved_body} />

        {imp.status === 'pending' && (
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button onClick={() => handleAction('approved')}
              style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>
              Approve
            </button>
            <button onClick={() => handleAction('rejected')}
              style={{ padding: '8px 20px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', cursor: 'pointer' }}>
              Reject
            </button>
          </div>
        )}
        {imp.status === 'approved' && (
          <div style={{ marginTop: 20 }}>
            <button onClick={() => handleAction('publish')}
              style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>
              Publish to Zendesk
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HelpCenterImprovements() {
  const { data: improvements = [], isLoading } = useHcImprovements();
  const [selectedId, setSelectedId] = useState(null);

  return (
    <div style={{ padding: 32, maxWidth: 1000 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Article Improvements</h1>
        <p style={{ color: 'var(--color-muted)', fontSize: 14 }}>
          AI-generated rewrites ready for review. Approve → publish directly to Zendesk Guide.
        </p>
      </div>

      {isLoading ? (
        <div style={{ color: 'var(--color-muted)', padding: 40, textAlign: 'center' }}>Loading...</div>
      ) : improvements.length === 0 ? (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 40, textAlign: 'center', color: 'var(--color-muted)' }}>
          No improvements yet. Go to Article Audit and click "Improve" on any article.
        </div>
      ) : (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', background: '#00000010' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600 }}>Article</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600 }}>Suggested Title</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600 }}>Generated</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {improvements.map((imp, i) => {
                const s = STATUS_STYLES[imp.status] || STATUS_STYLES.pending;
                return (
                  <tr key={imp.id} style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? 'transparent' : '#00000008' }}>
                    <td style={{ padding: '10px 16px' }}>
                      {imp.article_url
                        ? <a href={imp.article_url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)' }}>{imp.original_title || `#${imp.article_id}`}</a>
                        : (imp.original_title || `Article #${imp.article_id}`)
                      }
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--color-text)' }}>{imp.suggested_title || '—'}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      <span style={{ ...s, fontSize: 11, padding: '2px 10px', borderRadius: 12, fontWeight: 500 }}>
                        {imp.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: 'var(--color-muted)' }}>
                      {new Date(imp.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      <button onClick={() => setSelectedId(imp.id)}
                        style={{
                          padding: '5px 12px', borderRadius: 5, border: '1px solid var(--color-border)',
                          background: 'transparent', color: 'var(--color-primary)', cursor: 'pointer', fontSize: 12,
                        }}>
                        Review
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedId && <ImprovementDetail id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
