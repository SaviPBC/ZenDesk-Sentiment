import { useState } from 'react';
import { format, subDays } from 'date-fns';
import { useDashboard } from '../hooks/useDashboard';
import { useCsat } from '../hooks/useCsat';
import DateRangePicker from '../components/shared/DateRangePicker';
import HealthScoreGauge from '../components/dashboard/HealthScoreGauge';
import SentimentPieChart from '../components/dashboard/SentimentPieChart';
import VolumeByChannel from '../components/dashboard/VolumeByChannel';
import PerformanceCards from '../components/dashboard/PerformanceCards';
import CsatTrend from '../components/dashboard/CsatTrend';
import TopIssues from '../components/dashboard/TopIssues';
import CorrelationChart from '../components/dashboard/CorrelationChart';
import TopCategoriesTable from '../components/dashboard/TopCategoriesTable';

const CHANNELS = ['all', 'web', 'email', 'voice', 'chat', 'api', 'mobile'];

export default function Dashboard() {
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [channel, setChannel] = useState('all');

  const channelParam = channel === 'all' ? undefined : channel;
  const { data, isLoading, error } = useDashboard(from, to, channelParam);
  const { data: csatData } = useCsat(from, to, channelParam);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '22px' }}>Dashboard</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            style={{ fontSize: '13px', padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', cursor: 'pointer' }}
          >
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c === 'all' ? 'All Channels' : c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
          <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
        </div>
      </div>

      {error && (
        <div style={{ color: 'var(--color-negative)', marginBottom: '1rem', fontSize: '13px' }}>
          Error loading dashboard data. Is the server running?
        </div>
      )}

      {isLoading ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <>
          {/* Row 1: Health Score + Sentiment Breakdown + CSAT */}
          <div className="grid-3" style={{ marginBottom: '1rem' }}>
            <HealthScoreGauge score={data?.healthScore ?? null} />
            <SentimentPieChart breakdown={data?.sentimentBreakdown} />
            <CsatTrend overall={csatData?.overall} trend={csatData?.trend} />
          </div>

          {/* Row 2: Performance stats */}
          <div className="grid-3" style={{ marginBottom: '1rem' }}>
            <PerformanceCards
              totalTickets={data?.totalTickets}
              avgResolutionTime={data?.avgResolutionTime}
              avgFirstReplyTime={data?.avgFirstReplyTime}
            />
          </div>

          {/* Row 3: Volume by Channel + Top Issues */}
          <div className="grid-2" style={{ marginBottom: '1rem' }}>
            <VolumeByChannel data={data?.volumeByChannel} />
            <TopIssues topics={data?.topTopics} />
          </div>

          {/* Row 4: Top Categories + Correlation chart */}
          <div className="grid-2" style={{ marginBottom: '1rem' }}>
            <TopCategoriesTable categories={data?.topCategories} />
            <CorrelationChart data={data?.correlationData} />
          </div>
        </>
      )}
    </div>
  );
}
