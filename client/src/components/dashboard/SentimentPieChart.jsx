import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = {
  positive: '#22c55e',
  neutral: '#eab308',
  negative: '#ef4444',
};

export default function SentimentPieChart({ breakdown }) {
  if (!breakdown) return null;

  const data = [
    { name: 'Positive', value: breakdown.positive || 0 },
    { name: 'Neutral', value: breakdown.neutral || 0 },
    { name: 'Negative', value: breakdown.negative || 0 },
  ].filter((d) => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="card">
      <p className="section-title">Sentiment Breakdown</p>
      {total === 0 ? (
        <p className="text-muted" style={{ marginTop: '1rem', fontSize: '13px' }}>
          No sentiment data yet. Run a sync to analyze tickets.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={COLORS[entry.name.toLowerCase()]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                color: 'var(--color-text)',
              }}
              formatter={(value, name) => [value, name]}
            />
            <Legend
              formatter={(value) => (
                <span style={{ color: 'var(--color-text)', fontSize: '12px' }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
