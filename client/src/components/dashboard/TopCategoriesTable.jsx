export default function TopCategoriesTable({ categories }) {
  if (!categories || categories.length === 0) {
    return (
      <div className="card">
        <p className="section-title" style={{ marginBottom: '0.75rem' }}>Top Categories</p>
        <p className="text-muted" style={{ fontSize: '13px' }}>
          No category data. Configure Category / Subcategory field IDs in Settings and re-sync.
        </p>
      </div>
    );
  }

  const total = categories.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="card">
      <p className="section-title" style={{ marginBottom: '0.75rem' }}>Top Categories</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
            <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--color-muted)', fontWeight: 500 }}>Category</th>
            <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--color-muted)', fontWeight: 500 }}>Subcategory</th>
            <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--color-muted)', fontWeight: 500 }}>Tickets</th>
            <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--color-muted)', fontWeight: 500 }}>%</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((row, i) => (
            <tr
              key={i}
              style={{ borderBottom: '1px solid var(--color-border)', opacity: 0.9 }}
            >
              <td style={{ padding: '7px 8px' }}>{row.category || '—'}</td>
              <td style={{ padding: '7px 8px', color: 'var(--color-muted)' }}>{row.subcategory || '—'}</td>
              <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 600 }}>{row.count}</td>
              <td style={{ padding: '7px 8px', textAlign: 'right', color: 'var(--color-muted)' }}>
                {total > 0 ? `${Math.round((row.count / total) * 100)}%` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
