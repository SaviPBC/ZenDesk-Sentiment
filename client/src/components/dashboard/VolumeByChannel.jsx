import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

export default function VolumeByChannel({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="card">
        <p className="section-title">Volume by Channel</p>
        <p className="text-muted" style={{ marginTop: '1rem', fontSize: '13px' }}>No data yet.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <p className="section-title">Volume by Channel</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="channel"
            tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
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
          />
          <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
