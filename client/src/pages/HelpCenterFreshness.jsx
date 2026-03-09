import { useState } from 'react';
import { useHcFreshness, useStartFreshnessCheck, useFreshnessStatus, useResolveFreshnessAlert } from '../hooks/useHelpCenter';

const ALERT_STYLES = {
  stale: { label: 'Stale', color: '#f59e0b' },
  ticket_spike: { label: 'Ticket Spike', color: '#ef4444' },
};

export default function HelpCenterFreshness() {
  const [showResolved, setShowResolved] = useState(false);
  const [staleThreshold, setStaleThreshold] = useState(180);

  const { data: alerts = [], isLoading, refetch } = useHcFreshness(showResolved);
  const freshnessStatus = useFreshnessStatus();
  const startFreshness = useStartFreshnessCheck();
  const resolveAlert = useResolveFreshnessAlert();

  const isRunning = freshnessStatus.data?.status === 'running';

  async function handleResolve(id) {
    await resolveAlert.mutateAsync(id);
    refetch();
  }

  return (
    <div style={{ padding: 32, maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Freshness Monitor</h1>
          <p style={{ color: 'var(--color-muted)', fontSize: 14 }}>
            Articles that are stale or seeing ticket spikes that suggest outdated content.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 13, color: 'var(--color-muted)' }}>Stale after</label>
            <input
              type="number"
              value={staleThreshold}
              onChange={(e) => setStaleThreshold(parseInt(e.target.value) || 180)}
              style={{
                width: 60, padding: '6px 8px', borderRadius: 5, border: '1px solid var(--color-border)',
                background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13,
              }}
            />
            <label style={{ fontSize: 13, color: 'var(--color-muted)' }}>days</label>
          </div>
          <button
            onClick={() => startFreshness.mutate({ stale_threshold_days: staleThreshold })}
            disabled={isRunning}
            style={{
              padding: '9px 18px', borderRadius: 6, border: 'none',
              background: 'var(--color-primary)', color: '#fff', cursor: 'pointer',
              fontWeight: 500, opacity: isRunning ? 0.5 : 1,
            }}
          >
            {isRunning ? `Checking... ${freshnessStatus.data?.progress || 0}/${freshnessStatus.data?.total || 0}` : 'Run Check'}
          </button>
        </div>
      </div>

      {freshnessStatus.data?.status === 'error' && (
        <div style={{ background: '#ef444422', border: '1px solid #ef4444', borderRadius: 6, padding: '10px 14px', marginBottom: 20, color: '#ef4444', fontSize: 13 }}>
          {freshnessStatus.data.error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button
          onClick={() => setShowResolved(false)}
          style={{
            padding: '6px 16px', borderRadius: 6, border: '1px solid var(--color-border)',
            background: !showResolved ? 'var(--color-primary)' : 'transparent',
            color: !showResolved ? '#fff' : 'var(--color-text)', cursor: 'pointer', fontSize: 13,
          }}
        >
          Open Alerts
        </button>
        <button
          onClick={() => setShowResolved(true)}
          style={{
            padding: '6px 16px', borderRadius: 6, border: '1px solid var(--color-border)',
            background: showResolved ? 'var(--color-primary)' : 'transparent',
            color: showResolved ? '#fff' : 'var(--color-text)', cursor: 'pointer', fontSize: 13,
          }}
        >
          Resolved
        </button>
      </div>

      {isLoading ? (
        <div style={{ color: 'var(--color-muted)', padding: 40, textAlign: 'center' }}>Loading...</div>
      ) : alerts.length === 0 ? (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 40, textAlign: 'center', color: 'var(--color-muted)' }}>
          {showResolved ? 'No resolved alerts.' : 'No open alerts. Run a freshness check above.'}
        </div>
      ) : (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', background: '#00000010' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600 }}>Article</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600 }}>Type</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600 }}>Details</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600 }}>Last Updated</th>
                {!showResolved && <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600 }}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert, i) => {
                const meta = ALERT_STYLES[alert.alert_type] || { label: alert.alert_type, color: '#6b7280' };
                return (
                  <tr key={alert.id} style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? 'transparent' : '#00000008' }}>
                    <td style={{ padding: '10px 16px' }}>
                      {alert.article_url
                        ? <a href={alert.article_url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>{alert.article_title || `Article #${alert.article_id}`}</a>
                        : <span style={{ fontWeight: 500 }}>{alert.article_title || `Article #${alert.article_id}`}</span>
                      }
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 12, background: meta.color + '22', color: meta.color, fontWeight: 500 }}>
                        {meta.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--color-muted)', maxWidth: 340 }}>
                      {alert.details}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: 'var(--color-muted)' }}>
                      {alert.article_updated_at
                        ? new Date(alert.article_updated_at).toLocaleDateString()
                        : '—'}
                      {alert.days_since_updated > 0 && (
                        <div style={{ fontSize: 11, color: '#f59e0b' }}>{alert.days_since_updated}d ago</div>
                      )}
                    </td>
                    {!showResolved && (
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleResolve(alert.id)}
                          style={{
                            padding: '5px 12px', borderRadius: 5, border: '1px solid var(--color-border)',
                            background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', fontSize: 12,
                          }}
                        >
                          Resolve
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
