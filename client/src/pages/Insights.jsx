import { useState, useEffect } from 'react';
import { format, subDays } from 'date-fns';
import DateRangePicker from '../components/shared/DateRangePicker';
import { useInsightsRuns, useInsightsRun, useInsightsStatus, useRunInsights } from '../hooks/useInsights';
import { useQueryClient } from '@tanstack/react-query';

const CHANNELS = ['all', 'web', 'email', 'voice', 'chat', 'api', 'mobile'];

const TONE_COLORS = {
  frustrated: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
  angry: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
  disappointed: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
  upset: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
  confused: { bg: 'rgba(234,179,8,0.15)', text: '#eab308' },
  uncertain: { bg: 'rgba(234,179,8,0.15)', text: '#eab308' },
  anxious: { bg: 'rgba(249,115,22,0.15)', text: '#f97316' },
  worried: { bg: 'rgba(249,115,22,0.15)', text: '#f97316' },
  appreciative: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
  satisfied: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
  happy: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
  grateful: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
};

const PRIORITY_COLORS = {
  high: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', label: 'High' },
  medium: { bg: 'rgba(234,179,8,0.15)', text: '#eab308', label: 'Medium' },
  low: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e', label: 'Low' },
};

function ToneBadge({ tone }) {
  const t = tone?.toLowerCase() || '';
  const colors = TONE_COLORS[t] || { bg: 'rgba(148,163,184,0.15)', text: '#94a3b8' };
  return (
    <span style={{
      fontSize: '11px', padding: '2px 8px', borderRadius: '4px',
      background: colors.bg, color: colors.text, fontWeight: 600,
      textTransform: 'capitalize', whiteSpace: 'nowrap',
    }}>
      {tone}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const p = priority?.toLowerCase() || 'medium';
  const colors = PRIORITY_COLORS[p] || PRIORITY_COLORS.medium;
  return (
    <span style={{
      fontSize: '11px', padding: '2px 8px', borderRadius: '4px',
      background: colors.bg, color: colors.text, fontWeight: 600,
      textTransform: 'uppercase',
    }}>
      {colors.label}
    </span>
  );
}

function ProgressBar({ progress, total, phase }) {
  const pct = total > 0 ? Math.min(100, Math.round((progress / total) * 100)) : 0;
  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-muted)', marginBottom: '6px' }}>
        <span>{phase}</span>
        <span>{progress} / {total}</span>
      </div>
      <div style={{ height: '6px', background: 'var(--color-border)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: 'var(--color-primary)', borderRadius: '3px',
          transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  );
}

export default function Insights() {
  const qc = useQueryClient();
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [channel, setChannel] = useState('all');
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [runError, setRunError] = useState('');
  const [polling, setPolling] = useState(false);

  const { data: status } = useInsightsStatus(polling);
  const { data: runs, refetch: refetchRuns } = useInsightsRuns();
  const { data: runDetail, isLoading: isLoadingDetail } = useInsightsRun(selectedRunId);
  const { mutate: runAnalysis, isPending: isStarting } = useRunInsights();

  const isRunning = status?.status === 'running';

  // Watch status while polling — surface completed or failed state
  useEffect(() => {
    if (!polling) return;
    if (status?.status === 'completed' && status?.runId) {
      setPolling(false);
      refetchRuns();
      qc.invalidateQueries({ queryKey: ['insights-run', status.runId] });
      setSelectedRunId(status.runId);
    } else if (status?.status === 'failed') {
      setPolling(false);
      setRunError(status.error || 'Analysis failed. See Past Runs for details.');
      refetchRuns();
    }
  }, [status?.status, status?.runId, polling]);

  // Default to most recent completed run when list loads
  useEffect(() => {
    if (runs && runs.length > 0 && !selectedRunId) {
      const latest = runs.find((r) => r.status === 'completed');
      if (latest) setSelectedRunId(latest.id);
    }
  }, [runs]);

  function handleRun() {
    setRunError('');
    runAnalysis(
      { date_from: from, date_to: to, channel: channel === 'all' ? undefined : channel },
      {
        onSuccess: () => setPolling(true),
        onError: (err) => setRunError(err.response?.data?.error || 'Failed to start analysis.'),
      }
    );
  }

  const sentiments = runDetail?.top_sentiments || [];
  const recommendations = runDetail?.recommendations || [];

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '22px', marginBottom: '4px' }}>Sentiment Insights</h1>
        <p className="text-muted" style={{ fontSize: '13px' }}>
          Analyze requester comments to surface top sentiment themes and improvement recommendations for your support team.
        </p>
      </div>

      {/* Run panel */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <p className="section-title" style={{ marginBottom: '0.75rem' }}>Run Analysis</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            disabled={isRunning || isStarting}
            style={{ fontSize: '13px', padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', cursor: 'pointer' }}
          >
            {CHANNELS.map((c) => (
              <option key={c} value={c}>{c === 'all' ? 'All Channels' : c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
          <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
          <button
            className="btn btn-primary"
            onClick={handleRun}
            disabled={isRunning || isStarting}
            style={{ whiteSpace: 'nowrap' }}
          >
            {isRunning ? 'Analyzing…' : isStarting ? 'Starting…' : 'Run Analysis'}
          </button>
        </div>

        {isRunning && status && (
          <ProgressBar progress={status.progress} total={status.total} phase={status.phase} />
        )}

        {runError && (
          <p style={{ color: 'var(--color-negative)', fontSize: '13px', marginTop: '0.5rem' }}>{runError}</p>
        )}
      </div>

      {/* Results */}
      {isLoadingDetail && <p className="text-muted">Loading results…</p>}

      {runDetail && runDetail.status === 'completed' && (
        <>
          {/* Summary */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <p className="section-title" style={{ marginBottom: '0.5rem' }}>Executive Summary</p>
                <p style={{ fontSize: '14px', lineHeight: 1.6 }}>{runDetail.summary || 'No summary available.'}</p>
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', fontSize: '13px', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-primary-light)' }}>{runDetail.ticket_count}</div>
                  <div>tickets</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-primary-light)' }}>{runDetail.comment_count}</div>
                  <div>comments</div>
                </div>
              </div>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--color-muted)', marginTop: '0.75rem' }}>
              {runDetail.date_from} → {runDetail.date_to}
              {runDetail.channel ? ` · ${runDetail.channel}` : ' · all channels'}
              {' · '}analyzed {format(new Date(runDetail.completed_at), 'MMM d, yyyy h:mm a')}
            </p>
          </div>

          {/* Sentiments + Recommendations side by side */}
          <div className="grid-2" style={{ marginBottom: '1rem', alignItems: 'start' }}>
            {/* Top Sentiments */}
            <div className="card">
              <p className="section-title" style={{ marginBottom: '0.75rem' }}>Top Customer Sentiments</p>
              {sentiments.length === 0 ? (
                <p className="text-muted" style={{ fontSize: '13px' }}>No sentiment data available.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {sentiments.map((s) => (
                    <div key={s.rank} style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-muted)', minWidth: '18px' }}>
                          #{s.rank}
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: 600, flex: 1 }}>{s.theme}</span>
                        <ToneBadge tone={s.tone} />
                      </div>
                      <div style={{ paddingLeft: '26px' }}>
                        <p style={{ fontSize: '12px', color: 'var(--color-muted)', marginBottom: '4px' }}>
                          ~{s.count} ticket{s.count !== 1 ? 's' : ''}
                        </p>
                        <p style={{ fontSize: '13px', lineHeight: 1.5, marginBottom: '4px' }}>{s.description}</p>
                        {s.example_quote && (
                          <p style={{ fontSize: '12px', color: 'var(--color-muted)', fontStyle: 'italic', borderLeft: '2px solid var(--color-border)', paddingLeft: '8px' }}>
                            "{s.example_quote}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recommendations */}
            <div className="card">
              <p className="section-title" style={{ marginBottom: '0.75rem' }}>Recommendations</p>
              {recommendations.length === 0 ? (
                <p className="text-muted" style={{ fontSize: '13px' }}>No recommendations available.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {recommendations.map((r, i) => (
                    <div key={i} style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <PriorityBadge priority={r.priority} />
                        <span style={{ fontSize: '14px', fontWeight: 600 }}>{r.title}</span>
                      </div>
                      <p style={{ fontSize: '13px', lineHeight: 1.5, marginBottom: '6px' }}>{r.description}</p>
                      {r.impact && (
                        <p style={{ fontSize: '12px', color: 'var(--color-muted)', display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
                          <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Expected impact:</span>
                          {r.impact}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Past Runs */}
      {runs && runs.length > 0 && (
        <div className="card">
          <p className="section-title" style={{ marginBottom: '0.75rem' }}>Past Runs</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--color-muted)', fontWeight: 500 }}>Date Range</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--color-muted)', fontWeight: 500 }}>Channel</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--color-muted)', fontWeight: 500 }}>Tickets</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--color-muted)', fontWeight: 500 }}>Comments</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--color-muted)', fontWeight: 500 }}>Run At</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--color-muted)', fontWeight: 500 }}>Status</th>
                <th style={{ padding: '6px 8px' }}></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr
                  key={run.id}
                  style={{
                    borderBottom: '1px solid var(--color-border)',
                    background: run.id === selectedRunId ? 'rgba(99,102,241,0.07)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '7px 8px' }}>{run.date_from} → {run.date_to}</td>
                  <td style={{ padding: '7px 8px', color: 'var(--color-muted)' }}>{run.channel || 'all'}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'right' }}>{run.ticket_count}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'right' }}>{run.comment_count}</td>
                  <td style={{ padding: '7px 8px', color: 'var(--color-muted)' }}>
                    {run.started_at ? format(new Date(run.started_at), 'MMM d, h:mm a') : '—'}
                  </td>
                  <td style={{ padding: '7px 8px' }}>
                    <span style={{
                      fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: 600,
                      background: run.status === 'completed' ? 'rgba(34,197,94,0.15)'
                        : run.status === 'failed' ? 'rgba(239,68,68,0.15)'
                        : 'rgba(234,179,8,0.15)',
                      color: run.status === 'completed' ? '#22c55e'
                        : run.status === 'failed' ? '#ef4444'
                        : '#eab308',
                    }}>
                      {run.status}
                    </span>
                  </td>
                  <td style={{ padding: '7px 8px' }}>
                    {run.status === 'completed' && (
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '12px', padding: '3px 10px' }}
                        onClick={() => setSelectedRunId(run.id)}
                      >
                        {run.id === selectedRunId ? 'Viewing' : 'View'}
                      </button>
                    )}
                    {run.status === 'failed' && (
                      <span style={{ fontSize: '12px', color: 'var(--color-negative)' }} title={run.error}>
                        {run.error?.slice(0, 40)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(!runs || runs.length === 0) && !isRunning && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: 'var(--color-muted)', fontSize: '14px' }}>
            No analyses have been run yet. Select a date range above and click <strong>Run Analysis</strong> to get started.
          </p>
        </div>
      )}
    </div>
  );
}
