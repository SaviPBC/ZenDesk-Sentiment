import { useStartSync, useSyncStatus } from '../../hooks/useSync';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

export default function SyncButton({ from, to }) {
  const { data: syncStatus } = useSyncStatus();
  const { mutate: startSync, isPending } = useStartSync();
  const qc = useQueryClient();
  const isRunning = syncStatus?.status === 'running';

  // Invalidate dashboard/tickets/csat when sync completes
  useEffect(() => {
    if (syncStatus?.status === 'completed') {
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['csat'] });
    }
  }, [syncStatus?.status, qc]);

  function handleSync() {
    if (!from || !to) return alert('Select a date range first.');
    startSync({ date_from: from, date_to: to });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <button
        className="btn btn-primary"
        onClick={handleSync}
        disabled={isRunning || isPending}
      >
        {isRunning ? `Syncing… (${syncStatus.phase})` : 'Start Sync'}
      </button>

      {isRunning && (
        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
          <div
            style={{
              height: '4px',
              borderRadius: '2px',
              background: 'var(--color-border)',
              marginTop: '4px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                borderRadius: '2px',
                background: 'var(--color-primary)',
                width: syncStatus.total > 0
                  ? `${Math.round((syncStatus.progress / syncStatus.total) * 100)}%`
                  : '40%',
                transition: 'width 0.5s ease',
                animation: syncStatus.total === 0 ? 'pulse 1.5s infinite' : 'none',
              }}
            />
          </div>
          {syncStatus.total > 0
            ? `${syncStatus.progress} / ${syncStatus.total} tickets`
            : syncStatus.phase}
        </div>
      )}

      {syncStatus?.status === 'completed' && (
        <span style={{ fontSize: '12px', color: 'var(--color-positive)' }}>
          Sync completed — {syncStatus.total} tickets
        </span>
      )}

      {syncStatus?.status === 'failed' && (
        <span style={{ fontSize: '12px', color: 'var(--color-negative)' }}>
          Sync failed: {syncStatus.error}
        </span>
      )}
    </div>
  );
}
