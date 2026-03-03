import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const CHANNEL_COLORS = [
  '#6366f1', '#22c55e', '#eab308', '#ef4444', '#06b6d4', '#f97316', '#a855f7',
];

export default function CorrelationChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="card">
        <p className="section-title">Resolution Time vs Sentiment (by Channel)</p>
        <p className="text-muted" style={{ marginTop: '1rem', fontSize: '13px' }}>No data yet.</p>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    channel: d.channel,
    x: Math.round(d.avg_resolution || 0),
    y: Math.round((d.avg_sentiment || 0) * 100),
  }));

  return (
    <div className="card">
      <p className="section-title">Resolution Time vs Sentiment (by Channel)</p>
      <ResponsiveContainer width="100%" height={220}>
        <ScatterChart margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="x"
            name="Avg Resolution (min)"
            type="number"
            tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            label={{ value: 'Avg Resolution (min)', position: 'insideBottom', offset: -2, fill: 'var(--color-text-muted)', fontSize: 11 }}
          />
          <YAxis
            dataKey="y"
            name="Sentiment Score"
            unit="%"
            tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              color: 'var(--color-text)',
            }}
            cursor={{ strokeDasharray: '3 3' }}
            formatter={(value, name) => [
              name === 'Avg Resolution (min)' ? `${value} min` : `${value}%`,
              name,
            ]}
          />
          <Scatter data={chartData} name="Channels">
            {chartData.map((entry, index) => (
              <Cell key={entry.channel} fill={CHANNEL_COLORS[index % CHANNEL_COLORS.length]} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
        {chartData.map((d, i) => (
          <span
            key={d.channel}
            style={{
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: CHANNEL_COLORS[i % CHANNEL_COLORS.length],
                display: 'inline-block',
              }}
            />
            <span className="text-muted">{d.channel}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
