# ZenDesk Sentiment Analytics — CLAUDE.md

## Project Overview

A full-stack analytics dashboard for ZenDesk support data. Syncs tickets from ZenDesk, runs AI-powered sentiment analysis and topic clustering using Claude, and presents metrics through an interactive dashboard. Features include CSAT tracking, business-hour-adjusted performance metrics, natural language content search, and deep insights reports.

## Stack

- **Frontend:** React 18 + Vite, React Router v6, TanStack React Query, Recharts, Axios
- **Backend:** Express.js, SQLite (`node-sqlite3-wasm` — pure WASM, no native build), Anthropic SDK (`@anthropic-ai/sdk`)
- **AI:** Claude Haiku (sentiment, topic clustering, AI search), Claude Sonnet (insights synthesis)
- **Other:** `sentiment` npm package (local AFINN-based fallback if no Anthropic key)

## Running the App

```bash
# Install all dependencies
npm run install:all

# Start both server and client in dev mode
npm run dev
```

- **Server:** http://localhost:3002 (set via `PORT` in `server/.env`)
- **Client:** http://localhost:5173 (Vite proxy → server)

## Environment Variables

Create `server/.env` (see `.env.example`):

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | Server port |
| `DB_PATH` | `./data/analytics.db` | SQLite database path |
| `ZENDESK_SUBDOMAIN` | — | ZenDesk account subdomain (e.g. `mycompany`) |
| `ZENDESK_EMAIL` | — | ZenDesk agent email |
| `ZENDESK_API_TOKEN` | — | ZenDesk API token |
| `ANTHROPIC_API_KEY` | — | Claude API key (required for AI features) |

All credentials can also be saved at runtime via the Settings UI — they are stored in the `settings` DB table and bootstrap from env vars on first startup.

> **Note:** This project's `server/.env` currently sets `PORT=3002`. The Vite proxy in `client/vite.config.js` must match this port.

## Project Structure

```
zendesk-analytics/
├── package.json              # Root — concurrently dev scripts
├── .env.example
├── server/
│   ├── index.js              # Express entry point
│   ├── config.js             # Env var config
│   ├── db.js                 # node-sqlite3-wasm adapter (better-sqlite3 API)
│   ├── schema.sql            # Database schema + migrations
│   ├── routes/
│   │   ├── settings.js       # Credentials + business hours config
│   │   ├── sync.js           # Trigger & poll ticket sync
│   │   ├── dashboard.js      # Analytics metrics endpoint
│   │   ├── tickets.js        # Paginated ticket listing
│   │   ├── csat.js           # CSAT metrics + trend
│   │   ├── insights.js       # Insights analysis runs
│   │   └── search.js         # Text + AI content search
│   ├── services/
│   │   ├── syncService.js    # 6-phase ZenDesk sync pipeline
│   │   ├── zendeskClient.js  # ZenDesk API client (rate-limit handling)
│   │   ├── analysisService.js # Sentiment + topic clustering (Claude)
│   │   └── insightsService.js # Insights batch processing (Claude)
│   ├── middleware/
│   │   └── errorHandler.js
│   └── data/                 # SQLite DB stored here (gitignored)
└── client/
    └── src/
        ├── pages/
        │   ├── Dashboard.jsx       # Main analytics dashboard
        │   ├── Tickets.jsx         # Paginated ticket browser
        │   ├── Insights.jsx        # AI insights analysis
        │   ├── ContentSearch.jsx   # Text + AI search
        │   └── Settings.jsx        # Config + sync controls
        ├── components/
        │   ├── dashboard/          # Charts and metric cards
        │   ├── layout/AppShell.jsx # Nav sidebar + layout
        │   └── shared/             # DateRangePicker, SentimentBadge, SyncButton
        ├── hooks/                  # TanStack Query data hooks
        └── api/client.js           # Axios instance
```

## Database Schema

| Table | Purpose |
|---|---|
| `settings` | Key-value store for credentials + business hours config |
| `sync_runs` | History of sync jobs (status, date range, ticket count) |
| `tickets` | Core ticket data (subject, description, status, channel, category) |
| `ticket_comments` | All ticket comments (public + internal) |
| `ticket_metrics` | Resolution time, first reply time, reply count per ticket |
| `satisfaction_ratings` | CSAT survey responses (good/bad + comment) |
| `sentiment_results` | Claude sentiment output per ticket (positive/neutral/negative + confidence) |
| `topic_clusters` | Topic clusters per sync run (label, ticket count, example IDs) |
| `insights_runs` | Full insights analysis results (summary, themes, recommendations) |

## Key API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET/PUT` | `/api/settings` | Get or save credentials + config |
| `POST` | `/api/settings/test` | Test ZenDesk connection |
| `POST` | `/api/sync` | Trigger sync (`{ date_from, date_to }`) |
| `GET` | `/api/sync/status` | Poll sync progress (phase, %, error) |
| `GET` | `/api/dashboard` | All dashboard metrics (`?from=&to=&channel=`) |
| `GET` | `/api/tickets` | Paginated tickets (`?from=&to=&sentiment=&channel=&page=&limit=`) |
| `GET` | `/api/csat` | CSAT % + weekly trend + recent bad comments |
| `GET` | `/api/insights` | List past insights runs |
| `GET` | `/api/insights/:id` | Full results for an insights run |
| `POST` | `/api/insights` | Trigger new insights analysis (`{ date_from, date_to, channel? }`) |
| `POST` | `/api/content-search` | Search tickets (`{ from, to, query, mode: 'text'|'ai' }`) |

## ZenDesk Sync Pipeline

The sync runs in 6 sequential phases (`syncService.js`):

1. **Fetch Tickets** — Cursor-based incremental export (no 1000-item limit). Extracts channel, category/subcategory from custom fields. Upserts into `tickets`.
2. **Fetch Comments** — Per-ticket comment fetch; stores in `ticket_comments` with `is_public` flag.
3. **Fetch Metrics** — Batched 50 tickets at a time via `/tickets/{id}/metrics.json`.
4. **Fetch Satisfaction Ratings** — Paginated CSAT ratings for the date range.
5. **Sentiment Analysis** — Batches of 30 tickets sent to Claude Haiku. Falls back to local AFINN scoring if no API key.
6. **Topic Clustering** — Up to 200 ticket subjects sent to Claude Haiku in one call; returns 5–10 topic clusters.

**Rate limiting:** Proactively checks `x-rate-limit-remaining` header; sleeps until reset if < 5 remaining. Handles 429 responses with `retry-after`.

Sync runs asynchronously. Frontend polls `/api/sync/status` every 2s.

## How Claude AI Is Used

### Sentiment Analysis (`analysisService.js`)
- **Model:** `claude-haiku-4-5-20251001`
- **Batch size:** 30 tickets per call
- **Input:** ticket subject + latest public comment
- **Output:** `positive | neutral | negative` + confidence score (0.0–1.0)
- **Fallback:** Local AFINN-based `sentiment` package if no Anthropic key

### Topic Clustering (`analysisService.js`)
- **Model:** `claude-haiku-4-5-20251001`
- **Input:** Up to 200 ticket subjects in one prompt
- **Output:** 5–10 clusters with label, ticket count, example IDs

### Insights Analysis (`insightsService.js`)
- **Phase 1 (batch):** Claude Haiku processes batches of 40 tickets via Anthropic Message Batch API — identifies sentiment themes (label, tone, count, representative quote)
- **Phase 2 (synthesis):** Claude Sonnet consolidates all themes, deduplicates, ranks by frequency, generates 5–8 prioritized recommendations with expected impact
- Polls batch status every 5s until `processing_status === 'ended'`

### AI Content Search (`routes/search.js`)
- **Model:** `claude-haiku-4-5-20251001`
- Batches 200 tickets per prompt; Claude scores relevance to natural language query
- Final step: Claude synthesizes a summary of common themes across matched results
- Falls back to text search if mode is `"text"`

## Business Hours Calculation

Resolution time and first reply time are adjusted for business hours (`dashboard.js`):
- Configurable start/end hour, work days (day-of-week), and IANA timezone
- Handles DST correctly
- Default: Mon–Fri, 9am–5pm UTC

## Important Implementation Notes

### Database Adapter
`server/db.js` wraps `node-sqlite3-wasm` with a synchronous `better-sqlite3`-compatible API. This is required because Node v24 cannot build native addons without a complete Windows SDK. **Do not switch to `better-sqlite3`.**

### Port Configuration
The `server/.env` sets `PORT=3002`. The Vite proxy in `client/vite.config.js` must target the same port. If you change the port, update both files.

### Credentials Storage
ZenDesk and Anthropic credentials are stored in the SQLite `settings` table and masked in the UI (only last 4 characters shown). Env vars bootstrap the DB on first startup but the UI can update them at runtime.

### Stale Database Lock
If the server crashes without cleanly shutting down, a stale `analytics.db.lock` directory may remain in `server/data/`. Delete it manually to unblock the next startup:
```bash
rmdir server/data/analytics.db.lock
```
