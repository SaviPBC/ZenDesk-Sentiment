import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

export default function CsatTrend({ overall, trend }) {
  const csatPct = overall?.csatPct;

  return (
    <div className="card">
      <p className="section-title">CSAT Overview</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '1rem' }}>
        <span style={{ fontSize: '40px', fontWeight: 800, color: 'var(--color-primary-light)' }}>
          {csatPct !== null && csatPct !== undefined ? `${csatPct}%` : '—'}
        </span>
        {overall?.total > 0 && (
          <span className="text-muted" style={{ fontSize: '13px' }}>
            good / {overall.total} rated
          </span>
        )}
      </div>

      {trend && trend.length > 0 ? (
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={trend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="week"
              tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
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
              formatter={(v) => [`${v}%`, 'CSAT']}
            />
            <Line
              type="monotone"
              dataKey="csat"
              stroke="var(--color-primary)"
              strokeWidth={2}
              dot={{ fill: 'var(--color-primary)', r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-muted" style={{ fontSize: '13px' }}>No CSAT data in this range.</p>
      )}
    </div>
  );
}
