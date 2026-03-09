import { useHcOverview, useStartHcSync, useHcSyncStatus, useStartAudit, useAuditStatus } from '../hooks/useHelpCenter';
import { Link } from 'react-router-dom';

const CARD_STYLE = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  padding: '20px 24px',
};

function StatCard({ label, value, sub, to, accent }) {
  const inner = (
    <div style={{ ...CARD_STYLE, borderLeft: accent ? `3px solid ${accent}` : undefined }}>
      <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-text)' }}>
        {value ?? '—'}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
  return to ? <Link to={to} style={{ textDecoration: 'none' }}>{inner}</Link> : inner;
}

function AgentCard({ title, description, status, onRun, runLabel = 'Run', disabled }) {
  const isRunning = status?.status === 'running';
  return (
    <div style={{ ...CARD_STYLE, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.5 }}>{description}</div>
      {isRunning && (
        <div style={{ fontSize: 12, color: 'var(--color-primary)' }}>
          {status.phase} {status.total > 0 ? `(${status.progress}/${status.total})` : ''}
        </div>
      )}
      {status?.status === 'error' && (
        <div style={{ fontSize: 12, color: 'var(--color-negative)' }}>{status.error}</div>
      )}
      <button
        onClick={onRun}
        disabled={disabled || isRunning}
        style={{
          marginTop: 4, padding: '8px 16px', borderRadius: 6, border: 'none',
          background: 'var(--color-primary)', color: '#fff', cursor: 'pointer',
          fontSize: 13, fontWeight: 500, alignSelf: 'flex-start',
          opacity: (disabled || isRunning) ? 0.5 : 1,
        }}
      >
        {isRunning ? 'Running...' : runLabel}
      </button>
    </div>
  );
}

export default function HelpCenter() {
  const { data: overview } = useHcOverview();
  const syncStatus = useHcSyncStatus();
  const auditStatus = useAuditStatus();
  const startSync = useStartHcSync();
  const startAudit = useStartAudit();

  const isSyncing = syncStatus.data?.status === 'running';
  const hasArticles = (overview?.totalArticles || 0) > 0;

  return (
    <div style={{ padding: 32, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Help Center Agents</h1>
      <p style={{ color: 'var(--color-muted)', marginBottom: 28, fontSize: 14 }}>
        Improve article quality, increase thumbs-up, reduce support contacts.
        {overview?.lastSyncedAt && (
          <span> Last synced: {new Date(overview.lastSyncedAt).toLocaleString()}</span>
        )}
      </p>

      {/* Metrics strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard label="Total Articles" value={overview?.totalArticles} to="/help-center/articles" />
        <StatCard label="Avg Quality Score" value={overview?.avgQuality != null ? `${overview.avgQuality}/100` : null} to="/help-center/articles" accent={overview?.avgQuality < 60 ? 'var(--color-negative)' : 'var(--color-positive)'} />
        <StatCard label="Avg Vote Ratio" value={overview?.avgVoteRatio != null ? `${overview.avgVoteRatio}%` : null} sub="thumbs up %" accent={overview?.avgVoteRatio < 70 ? 'var(--color-negative)' : 'var(--color-positive)'} />
        <StatCard label="Flagged Articles" value={overview?.flaggedArticles} to="/help-center/articles?flag=true" accent={overview?.flaggedArticles > 0 ? '#f59e0b' : undefined} />
        <StatCard label="Content Gaps" value={overview?.contentGaps} to="/help-center/gaps" accent={overview?.contentGaps > 0 ? 'var(--color-negative)' : undefined} />
        <StatCard label="Pending Improvements" value={overview?.pendingImprovements} to="/help-center/improvements" />
        <StatCard label="Freshness Alerts" value={overview?.freshnessAlerts} to="/help-center/freshness" accent={overview?.freshnessAlerts > 0 ? '#f59e0b' : undefined} />
        <StatCard label="Disc. Suggestions" value={overview?.discoverabilityCount} to="/help-center/discoverability" />
      </div>

      {/* Step 1: Sync */}
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Step 1 — Sync Articles
      </h2>
      <div style={{ marginBottom: 28 }}>
        <AgentCard
          title="Sync Help Center Articles"
          description="Pulls all published articles from Zendesk Guide including vote counts, sections, and labels. Run this first before using any agents below."
          status={syncStatus.data}
          onRun={() => startSync.mutate()}
          runLabel="Sync Now"
        />
      </div>

      {/* Agents */}
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Step 2 — Run Agents
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        <AgentCard
          title="Content Audit Agent"
          description="Scores every article by vote ratio, ticket volume, and freshness. Flags articles with low thumbs-up, no votes, or staleness."
          status={auditStatus.data}
          onRun={() => startAudit.mutate()}
          runLabel="Run Audit"
          disabled={!hasArticles}
        />
        <div style={{ ...CARD_STYLE, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontWeight: 600 }}>Gap Analysis Agent</div>
          <div style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.5 }}>
            Cross-references ticket topics against article coverage to find missing content. Suggests titles and outlines for new articles.
          </div>
          <Link to="/help-center/gaps" style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 500 }}>Open Gap Analysis →</Link>
        </div>
        <div style={{ ...CARD_STYLE, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontWeight: 600 }}>Article Improvement Agent</div>
          <div style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.5 }}>
            Uses Claude Sonnet to rewrite low-quality articles using related support tickets as context. Human review before publishing.
          </div>
          <Link to="/help-center/articles" style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 500 }}>Browse Articles →</Link>
        </div>
        <div style={{ ...CARD_STYLE, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontWeight: 600 }}>Discoverability Agent</div>
          <div style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.5 }}>
            Analyzes article titles against how customers phrase questions. Suggests better titles, labels, and related article links.
          </div>
          <Link to="/help-center/discoverability" style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 500 }}>Open Discoverability →</Link>
        </div>
        <div style={{ ...CARD_STYLE, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontWeight: 600 }}>Freshness Monitor</div>
          <div style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.5 }}>
            Flags articles not updated in 180+ days and articles where ticket spikes suggest outdated content.
          </div>
          <Link to="/help-center/freshness" style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 500 }}>Open Freshness Monitor →</Link>
        </div>
      </div>
    </div>
  );
}
