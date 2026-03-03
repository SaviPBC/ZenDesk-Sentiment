import { format, subDays } from 'date-fns';

const PRESETS = [
  { label: 'Last 7d', days: 7 },
  { label: 'Last 30d', days: 30 },
  { label: 'Last 90d', days: 90 },
];

export default function DateRangePicker({ from, to, onChange }) {
  function applyPreset(days) {
    const toDate = format(new Date(), 'yyyy-MM-dd');
    const fromDate = format(subDays(new Date(), days), 'yyyy-MM-dd');
    onChange(fromDate, toDate);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      {PRESETS.map((p) => (
        <button
          key={p.label}
          className="btn btn-secondary"
          style={{ fontSize: '12px', padding: '5px 12px' }}
          onClick={() => applyPreset(p.days)}
        >
          {p.label}
        </button>
      ))}
      <input
        type="date"
        className="form-control"
        style={{ width: 'auto', fontSize: '13px' }}
        value={from || ''}
        onChange={(e) => onChange(e.target.value, to)}
      />
      <span className="text-muted">to</span>
      <input
        type="date"
        className="form-control"
        style={{ width: 'auto', fontSize: '13px' }}
        value={to || ''}
        onChange={(e) => onChange(from, e.target.value)}
      />
    </div>
  );
}
