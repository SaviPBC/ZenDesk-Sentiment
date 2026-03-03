export default function TopIssues({ topics }) {
  if (!topics || topics.length === 0) {
    return (
      <div className="card">
        <p className="section-title">Top Issues</p>
        <p className="text-muted" style={{ marginTop: '1rem', fontSize: '13px' }}>
          No topic data yet. Run a sync to analyze recurring issues.
        </p>
      </div>
    );
  }

  const max = topics[0]?.ticket_count || 1;

  return (
    <div className="card">
      <p className="section-title">Top Issues</p>
      <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '0.5rem' }}>
        {topics.map((topic, i) => (
          <li key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '13px', fontWeight: 500 }}>{topic.topic_label}</span>
              <span className="text-muted" style={{ fontSize: '12px' }}>{topic.ticket_count}</span>
            </div>
            <div
              style={{
                height: '4px',
                borderRadius: '2px',
                background: 'var(--color-border)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  borderRadius: '2px',
                  background: 'var(--color-primary)',
                  width: `${(topic.ticket_count / max) * 100}%`,
                }}
              />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
