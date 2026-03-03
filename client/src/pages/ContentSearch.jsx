import { useState } from 'react';
import { format, subDays } from 'date-fns';
import DateRangePicker from '../components/shared/DateRangePicker';
import SentimentBadge from '../components/shared/SentimentBadge';
import { useContentSearch } from '../hooks/useContentSearch';

const MODES = [
  { value: 'text', label: 'Text Search', hint: 'Search for an exact word or phrase across ticket subjects, descriptions, and comments.' },
  { value: 'ai', label: 'AI Analysis', hint: 'Describe what you\'re looking for in natural language and Claude will find semantically relevant tickets.' },
];

export default function ContentSearch() {
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [mode, setMode] = useState('text');
  const [query, setQuery] = useState('');

  const { mutate: runSearch, data: results, isPending, error, reset } = useContentSearch();

  const currentMode = MODES.find((m) => m.value === mode);

  function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    runSearch({ from, to, query: query.trim(), mode });
  }

  function handleModeChange(val) {
    setMode(val);
    reset();
  }

  const matches = results?.matches || [];
  const hasResults = results && !isPending;

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '22px', marginBottom: '4px' }}>Content Search</h1>
        <p className="text-muted" style={{ fontSize: '13px' }}>
          Search ticket content within a timeframe using keywords or AI-powered natural language analysis.
        </p>
      </div>

      {/* Search form */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <p className="section-title" style={{ marginBottom: '0.75rem' }}>Search</p>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => handleModeChange(m.value)}
              style={{
                fontSize: '13px',
                padding: '5px 16px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: mode === m.value ? 'var(--color-primary)' : 'var(--color-border)',
                background: mode === m.value ? 'var(--color-primary)' : 'var(--color-surface)',
                color: mode === m.value ? '#fff' : 'var(--color-text)',
                cursor: 'pointer',
                fontWeight: mode === m.value ? 600 : 400,
                transition: 'all 0.15s',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        <p style={{ fontSize: '12px', color: 'var(--color-muted)', marginBottom: '0.75rem' }}>
          {currentMode.hint}
        </p>

        {/* Date range */}
        <div style={{ marginBottom: '0.75rem' }}>
          <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
        </div>

        {/* Query input */}
        <form onSubmit={handleSearch}>
          {mode === 'text' ? (
            <input
              type="text"
              className="form-control"
              placeholder='e.g. "refund" or "login error"'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ width: '100%', fontSize: '14px', marginBottom: '0.75rem' }}
              disabled={isPending}
            />
          ) : (
            <textarea
              className="form-control"
              placeholder='e.g. "customers frustrated about slow response times" or "tickets mentioning billing confusion"'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={3}
              style={{ width: '100%', fontSize: '14px', marginBottom: '0.75rem', resize: 'vertical', fontFamily: 'inherit' }}
              disabled={isPending}
            />
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isPending || !query.trim()}
          >
            {isPending ? (mode === 'ai' ? 'Analyzing…' : 'Searching…') : 'Search'}
          </button>
        </form>

        {/* AI loading detail */}
        {isPending && mode === 'ai' && (
          <p style={{ fontSize: '12px', color: 'var(--color-muted)', marginTop: '0.5rem' }}>
            Claude is reviewing all tickets in the selected timeframe. Time varies with ticket volume — large date ranges may take a minute or more.
          </p>
        )}

        {/* API error */}
        {error && (
          <p style={{ color: 'var(--color-negative)', fontSize: '13px', marginTop: '0.5rem' }}>
            {error.response?.data?.error || 'Search failed. Please try again.'}
          </p>
        )}
      </div>

      {/* Results */}
      {hasResults && (
        <>
          {/* Stats row */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '1rem', fontSize: '13px', color: 'var(--color-muted)' }}>
            <span>
              <strong style={{ color: 'var(--color-text)' }}>{matches.length}</strong> match{matches.length !== 1 ? 'es' : ''}
              {results.total_scanned != null ? ` from ${results.total_scanned} tickets scanned` : ''}
            </span>
            <span>·</span>
            <span>
              {results.mode === 'ai' ? 'AI Analysis' : 'Text Search'} for <em>"{results.query}"</em>
            </span>
            <span>·</span>
            <span>{from} → {to}</span>
          </div>

          {/* AI summary */}
          {results.summary && (
            <div className="card" style={{ marginBottom: '1rem', borderLeft: '3px solid var(--color-primary)' }}>
              <p className="section-title" style={{ marginBottom: '0.5rem' }}>AI Summary</p>
              <p style={{ fontSize: '14px', lineHeight: 1.65 }}>{results.summary}</p>
            </div>
          )}

          {/* Matches table */}
          {matches.length > 0 ? (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                    <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-muted)', fontWeight: 500 }}>ID</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-muted)', fontWeight: 500 }}>Subject</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-muted)', fontWeight: 500 }}>Channel</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-muted)', fontWeight: 500 }}>Sentiment</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-muted)', fontWeight: 500 }}>Date</th>
                    {results.mode === 'ai' && (
                      <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-muted)', fontWeight: 500 }}>Match Reason</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {matches.map((ticket) => (
                    <tr key={ticket.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '10px 14px', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                        #{ticket.id}
                      </td>
                      <td style={{ padding: '10px 14px', maxWidth: '280px' }}>
                        <span style={{ fontWeight: 500 }}>{ticket.subject || '(no subject)'}</span>
                        {ticket.status && (
                          <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--color-muted)', textTransform: 'capitalize' }}>
                            {ticket.status}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--color-muted)', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                        {ticket.channel || '—'}
                      </td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <SentimentBadge sentiment={ticket.sentiment} />
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                        {ticket.created_at ? format(new Date(ticket.created_at), 'MMM d, yyyy') : '—'}
                      </td>
                      {results.mode === 'ai' && (
                        <td style={{ padding: '10px 14px', color: 'var(--color-muted)', fontSize: '12px', maxWidth: '260px' }}>
                          {ticket.match_reason || '—'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '2.5rem' }}>
              <p style={{ color: 'var(--color-muted)', fontSize: '14px' }}>
                No tickets matched your {results.mode === 'ai' ? 'prompt' : 'search term'} in the selected timeframe.
              </p>
              <p style={{ color: 'var(--color-muted)', fontSize: '13px', marginTop: '0.5rem' }}>
                Try a different query or expand your date range.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
