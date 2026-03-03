import { useState } from 'react';
import { format, subDays } from 'date-fns';
import { useTickets } from '../hooks/useTickets';
import DateRangePicker from '../components/shared/DateRangePicker';
import SentimentBadge from '../components/shared/SentimentBadge';

const CHANNELS = ['all', 'web', 'email', 'voice', 'chat', 'api', 'mobile'];
const SENTIMENTS = ['all', 'positive', 'neutral', 'negative'];
const PAGE_SIZE = 25;

export default function Tickets() {
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [sentiment, setSentiment] = useState('all');
  const [channel, setChannel] = useState('all');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useTickets({
    from,
    to,
    sentiment,
    channel,
    page,
    limit: PAGE_SIZE,
  });

  function resetPage() {
    setPage(1);
  }

  return (
    <div>
      <h1 style={{ fontSize: '22px', marginBottom: '1.5rem' }}>Tickets</h1>

      {/* Filter bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          marginBottom: '1.25rem',
          padding: '1rem',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)',
        }}
      >
        <DateRangePicker
          from={from}
          to={to}
          onChange={(f, t) => { setFrom(f); setTo(t); resetPage(); }}
        />

        <select
          className="form-control"
          style={{ width: 'auto', fontSize: '13px' }}
          value={sentiment}
          onChange={(e) => { setSentiment(e.target.value); resetPage(); }}
        >
          {SENTIMENTS.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? 'All Sentiments' : s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>

        <select
          className="form-control"
          style={{ width: 'auto', fontSize: '13px' }}
          value={channel}
          onChange={(e) => { setChannel(e.target.value); resetPage(); }}
        >
          {CHANNELS.map((c) => (
            <option key={c} value={c}>
              {c === 'all' ? 'All Channels' : c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p style={{ color: 'var(--color-negative)', fontSize: '13px', marginBottom: '1rem' }}>
          Error loading tickets. Is the server running?
        </p>
      )}

      {isLoading ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '13px',
              }}
            >
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['ID', 'Subject', 'Channel', 'Sentiment', 'CSAT', 'Created'].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        padding: '8px 12px',
                        color: 'var(--color-text-muted)',
                        fontWeight: 600,
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.tickets?.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      No tickets found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  data?.tickets?.map((ticket) => (
                    <tr
                      key={ticket.id}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                        #{ticket.id}
                      </td>
                      <td style={{ padding: '10px 12px', maxWidth: '300px' }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ticket.subject || '(no subject)'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'var(--color-text-muted)' }}>
                        {ticket.channel || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        <SentimentBadge sentiment={ticket.sentiment} />
                      </td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        {ticket.csat_score ? (
                          <span
                            style={{
                              color: ticket.csat_score === 'good' ? 'var(--color-positive)' : 'var(--color-negative)',
                              fontWeight: 600,
                              fontSize: '12px',
                            }}
                          >
                            {ticket.csat_score}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'var(--color-text-muted)' }}>
                        {ticket.created_at ? ticket.created_at.slice(0, 10) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.pages > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '1rem',
                fontSize: '13px',
                color: 'var(--color-text-muted)',
              }}
            >
              <span>
                {data.total} tickets · Page {data.page} of {data.pages}
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '12px', padding: '5px 12px' }}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '12px', padding: '5px 12px' }}
                  onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                  disabled={page >= data.pages}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
