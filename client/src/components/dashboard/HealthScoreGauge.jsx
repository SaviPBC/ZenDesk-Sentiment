export default function HealthScoreGauge({ score }) {
  const color =
    score >= 70 ? 'var(--color-positive)' :
    score >= 40 ? 'var(--color-neutral)' :
    'var(--color-negative)';

  const label =
    score >= 70 ? 'Healthy' :
    score >= 40 ? 'Fair' :
    score !== null ? 'At Risk' : 'No Data';

  return (
    <div className="card" style={{ textAlign: 'center', padding: '2rem 1.25rem' }}>
      <p className="section-title">Sentiment Health Score</p>
      <div
        style={{
          fontSize: '72px',
          fontWeight: 800,
          color,
          lineHeight: 1,
          margin: '1rem 0 0.5rem',
          letterSpacing: '-2px',
        }}
      >
        {score !== null ? score.toFixed(1) : '—'}
      </div>
      <p style={{ fontSize: '13px', color, fontWeight: 600 }}>{label}</p>
      <p className="text-muted" style={{ fontSize: '11px', marginTop: '0.5rem' }}>
        0 = all negative · 100 = all positive
      </p>
    </div>
  );
}
