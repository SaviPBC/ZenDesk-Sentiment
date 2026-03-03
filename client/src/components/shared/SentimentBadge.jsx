const COLORS = {
  positive: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
  neutral: { bg: 'rgba(234,179,8,0.15)', text: '#eab308' },
  negative: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
};

export default function SentimentBadge({ sentiment }) {
  if (!sentiment) return <span className="text-muted">—</span>;
  const style = COLORS[sentiment] || { bg: 'rgba(255,255,255,0.1)', text: '#e2e8f0' };
  return (
    <span
      style={{
        background: style.bg,
        color: style.text,
        padding: '2px 10px',
        borderRadius: '99px',
        fontSize: '12px',
        fontWeight: 600,
        textTransform: 'capitalize',
        display: 'inline-block',
      }}
    >
      {sentiment}
    </span>
  );
}
