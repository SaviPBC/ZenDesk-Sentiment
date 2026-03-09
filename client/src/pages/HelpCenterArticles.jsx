import { useState } from 'react';
import { useHcArticles, useStartAudit, useAuditStatus, useGenerateImprovement } from '../hooks/useHelpCenter';

const FLAG_LABELS = {
  low_vote_ratio: { label: 'Low vote ratio', color: '#ef4444' },
  no_votes: { label: 'No votes', color: '#6b7280' },
  stale: { label: 'Stale', color: '#f59e0b' },
  high_ticket_volume: { label: 'High tickets', color: '#8b5cf6' },
};

function FlagBadge({ flag }) {
  const meta = FLAG_LABELS[flag] || { label: flag, color: '#6b7280' };
  return (
    <span style={{
      fontSize: 11, padding: '2px 8px', borderRadius: 12,
      background: meta.color + '22', color: meta.color, fontWeight: 500,
    }}>
      {meta.label}
    </span>
  );
}

function QualityBar({ score }) {
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 60, height: 6, background: 'var(--color-border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{Math.round(score)}</span>
    </div>
  );
}

export default function HelpCenterArticles() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [flagFilter, setFlagFilter] = useState('');
  const [generatingId, setGeneratingId] = useState(null);

  const { data, isLoading } = useHcArticles({ page, limit: 25, search: search || undefined, flag: flagFilter || undefined });
  const auditStatus = useAuditStatus();
  const startAudit = useStartAudit();
  const generateImprovement = useGenerateImprovement();

  const isAuditing = auditStatus.data?.status === 'running';
  const articles = data?.articles || [];
  const total = data?.total || 0;

  async function handleImprove(articleId) {
    setGeneratingId(articleId);
    try {
      await generateImprovement.mutateAsync(articleId);
      alert('Improvement generated! Check the Improvements page to review and publish.');
    } catch (err) {
      alert('Error: ' + (err.response?.data?.error || err.message));
    } finally {
      setGeneratingId(null);
    }
  }

  return (
    <div style={{ padding: 32, maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Article Audit</h1>
          <p style={{ color: 'var(--color-muted)', fontSize: 14 }}>
            {total} articles — sorted by quality score (lowest first)
          </p>
        </div>
        <button
          onClick={() => startAudit.mutate()}
          disabled={isAuditing}
          style={{
            padding: '9px 18px', borderRadius: 6, border: 'none',
            background: 'var(--color-primary)', color: '#fff', cursor: 'pointer',
            fontWeight: 500, opacity: isAuditing ? 0.5 : 1,
          }}
        >
          {isAuditing ? `Scoring... ${auditStatus.data?.progress || 0}/${auditStatus.data?.total || 0}` : 'Re-run Audit'}
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search articles..."
          style={{
            padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-border)',
            background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 14, width: 260,
          }}
        />
        <select
          value={flagFilter}
          onChange={(e) => { setFlagFilter(e.target.value); setPage(1); }}
          style={{
            padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-border)',
            background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 14,
          }}
        >
          <option value="">All articles</option>
          <option value="low_vote_ratio">Low vote ratio</option>
          <option value="no_votes">No votes</option>
          <option value="stale">Stale</option>
          <option value="high_ticket_volume">High ticket volume</option>
        </select>
      </div>

      {isLoading ? (
        <div style={{ color: 'var(--color-muted)', padding: 40, textAlign: 'center' }}>Loading articles...</div>
      ) : (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', background: '#00000010' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600 }}>Article</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600 }}>Section</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600 }}>Votes</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600 }}>Vote Ratio</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600 }}>Quality</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600 }}>Flags</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((a, i) => (
                <tr key={a.id} style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? 'transparent' : '#00000008' }}>
                  <td style={{ padding: '10px 16px', maxWidth: 280 }}>
                    <a href={a.url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>
                      {a.title || `Article #${a.id}`}
                    </a>
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--color-muted)' }}>
                    {a.category_title ? `${a.category_title} / ` : ''}{a.section_title || '—'}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <span style={{ color: '#22c55e' }}>↑{a.thumbs_up}</span>{' '}
                    <span style={{ color: '#ef4444' }}>↓{a.thumbs_down}</span>
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    {a.vote_count > 0 ? `${Math.round((a.thumbs_up / a.vote_count) * 100)}%` : <span style={{ color: 'var(--color-muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    {a.quality_score != null ? <QualityBar score={a.quality_score} /> : <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>Not scored</span>}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(a.flags || []).map((f) => <FlagBadge key={f} flag={f} />)}
                    </div>
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <button
                      onClick={() => handleImprove(a.id)}
                      disabled={generatingId === a.id}
                      style={{
                        padding: '5px 12px', borderRadius: 5, border: '1px solid var(--color-border)',
                        background: 'transparent', color: 'var(--color-primary)', cursor: 'pointer',
                        fontSize: 12, fontWeight: 500,
                        opacity: generatingId === a.id ? 0.5 : 1,
                      }}
                    >
                      {generatingId === a.id ? 'Generating...' : 'Improve'}
                    </button>
                  </td>
                </tr>
              ))}
              {articles.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--color-muted)' }}>No articles found. Sync Help Center first.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {total > 25 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20 }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', cursor: 'pointer' }}>
            Previous
          </button>
          <span style={{ padding: '6px 12px', color: 'var(--color-muted)', fontSize: 13 }}>
            Page {page} of {Math.ceil(total / 25)}
          </span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 25)}
            style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', cursor: 'pointer' }}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
