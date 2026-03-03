function formatTime(minutes) {
  if (minutes === null || minutes === undefined) return '—';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function StatCard({ label, value }) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <p className="section-title">{label}</p>
      <p style={{ fontSize: '36px', fontWeight: 700, marginTop: '0.75rem', color: 'var(--color-primary-light)' }}>
        {value}
      </p>
    </div>
  );
}

export default function PerformanceCards({ avgResolutionTime, avgFirstReplyTime, totalTickets }) {
  return (
    <>
      <StatCard label="Total Tickets" value={totalTickets ?? '—'} />
      <StatCard label="Avg Resolution (Biz Hrs)" value={formatTime(avgResolutionTime)} />
      <StatCard label="Avg First Reply (Biz Hrs)" value={formatTime(avgFirstReplyTime)} />
    </>
  );
}
