const db = require('../db');
const {
  fetchTickets,
  fetchTicketComments,
  fetchTicketMetricsBatch,
  fetchSatisfactionRatings,
} = require('./zendeskClient');
const { analyzeSentimentBatch, clusterTopics } = require('./analysisService');

// In-memory singleton sync state
let currentSync = {
  runId: null,
  status: 'idle', // idle | running | completed | failed
  progress: 0,
  total: 0,
  phase: '',
  error: null,
  startedAt: null,
};

function getSyncStatus() {
  return { ...currentSync };
}

const upsertTicket = db.prepare(`
  INSERT INTO tickets (id, subject, description, status, channel, created_at, updated_at, solved_at,
    requester_id, assignee_id, tags, category, subcategory, synced_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    subject=excluded.subject,
    description=excluded.description,
    status=excluded.status,
    channel=excluded.channel,
    updated_at=excluded.updated_at,
    solved_at=excluded.solved_at,
    requester_id=excluded.requester_id,
    assignee_id=excluded.assignee_id,
    tags=excluded.tags,
    category=excluded.category,
    subcategory=excluded.subcategory,
    synced_at=excluded.synced_at
`);

const upsertComment = db.prepare(`
  INSERT INTO ticket_comments (id, ticket_id, body, author_id, created_at, is_public)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    body=excluded.body,
    is_public=excluded.is_public
`);

const upsertMetrics = db.prepare(`
  INSERT INTO ticket_metrics (ticket_id, resolution_time_minutes, first_reply_time_minutes, reply_count, reopens)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(ticket_id) DO UPDATE SET
    resolution_time_minutes=excluded.resolution_time_minutes,
    first_reply_time_minutes=excluded.first_reply_time_minutes,
    reply_count=excluded.reply_count,
    reopens=excluded.reopens
`);

const upsertRating = db.prepare(`
  INSERT INTO satisfaction_ratings (id, ticket_id, score, comment, created_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    score=excluded.score,
    comment=excluded.comment
`);

const upsertSentiment = db.prepare(`
  INSERT INTO sentiment_results (ticket_id, sentiment, confidence, analyzed_at, model_used)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(ticket_id) DO UPDATE SET
    sentiment=excluded.sentiment,
    confidence=excluded.confidence,
    analyzed_at=excluded.analyzed_at,
    model_used=excluded.model_used
`);

function extractChannel(ticket) {
  return ticket.via?.channel || ticket.channel || 'unknown';
}

function getCustomFieldValue(ticket, fieldId) {
  if (!fieldId || !ticket.custom_fields) return null;
  const field = ticket.custom_fields.find((f) => String(f.id) === String(fieldId));
  return field?.value || null;
}

async function startSync(dateFrom, dateTo) {
  if (currentSync.status === 'running') {
    throw new Error('A sync is already in progress.');
  }

  const now = new Date().toISOString();

  // Create sync_runs record
  const result = db.prepare(
    `INSERT INTO sync_runs (started_at, status, date_from, date_to) VALUES (?, 'running', ?, ?)`
  ).run(now, dateFrom, dateTo);

  const runId = result.lastInsertRowid;

  currentSync = {
    runId,
    status: 'running',
    progress: 0,
    total: 0,
    phase: 'Fetching tickets',
    error: null,
    startedAt: now,
  };

  // Run pipeline asynchronously (don't await)
  runPipeline(runId, dateFrom, dateTo).catch((err) => {
    console.error('[Sync] Pipeline failed:', err.message);
    currentSync.status = 'failed';
    currentSync.error = err.message;
    db.prepare(
      `UPDATE sync_runs SET status='failed', completed_at=?, error=? WHERE id=?`
    ).run(new Date().toISOString(), err.message, runId);
  });

  return runId;
}

async function runPipeline(runId, dateFrom, dateTo) {
  // ── Phase 1: Fetch & store tickets ─────────────────────────────────────
  currentSync.phase = 'Fetching tickets';
  const allTickets = [];

  const categoryFieldId = db.prepare("SELECT value FROM settings WHERE key='category_field_id'").get()?.value || null;
  const subcategoryFieldId = db.prepare("SELECT value FROM settings WHERE key='subcategory_field_id'").get()?.value || null;

  for await (const page of fetchTickets(dateFrom, dateTo)) {
    const saveTickets = db.transaction((tickets) => {
      for (const t of tickets) {
        upsertTicket.run(
          t.id,
          t.subject,
          t.description,
          t.status,
          extractChannel(t),
          t.created_at,
          t.updated_at,
          t.solved_at || null,
          t.requester_id || null,
          t.assignee_id || null,
          JSON.stringify(t.tags || []),
          getCustomFieldValue(t, categoryFieldId),
          getCustomFieldValue(t, subcategoryFieldId),
          new Date().toISOString()
        );
      }
    });
    saveTickets(page);
    allTickets.push(...page);
    currentSync.progress = allTickets.length;
  }

  currentSync.total = allTickets.length;
  db.prepare(`UPDATE sync_runs SET tickets_fetched=? WHERE id=?`).run(allTickets.length, runId);

  // ── Phase 2: Fetch & store comments ────────────────────────────────────
  currentSync.phase = 'Fetching comments';
  currentSync.progress = 0;

  for (let i = 0; i < allTickets.length; i++) {
    const ticket = allTickets[i];
    try {
      const comments = await fetchTicketComments(ticket.id);
      const saveComments = db.transaction((cmts) => {
        for (const c of cmts) {
          upsertComment.run(
            c.id,
            ticket.id,
            c.body,
            c.author_id || null,
            c.created_at,
            c.public ? 1 : 0
          );
        }
      });
      saveComments(comments);
    } catch (err) {
      console.warn(`[Sync] Could not fetch comments for ticket ${ticket.id}:`, err.message);
    }
    currentSync.progress = i + 1;
  }

  // ── Phase 3: Fetch & store ticket metrics ──────────────────────────────
  currentSync.phase = 'Fetching metrics';
  currentSync.progress = 0;

  const ticketIds = allTickets.map((t) => t.id);
  const METRICS_BATCH = 50; // fetch metrics in smaller batches to manage rate limits

  for (let i = 0; i < ticketIds.length; i += METRICS_BATCH) {
    const batch = ticketIds.slice(i, i + METRICS_BATCH);
    const metrics = await fetchTicketMetricsBatch(batch);
    const saveMetrics = db.transaction((mList) => {
      for (const m of mList) {
        upsertMetrics.run(
          m.ticket_id,
          m.full_resolution_time_in_minutes?.calendar ?? null,
          m.reply_time_in_minutes?.calendar ?? null,
          m.replies ?? null,
          m.reopens ?? null
        );
      }
    });
    saveMetrics(metrics);
    currentSync.progress = Math.min(i + METRICS_BATCH, ticketIds.length);
  }

  // ── Phase 4: Fetch & store satisfaction ratings ────────────────────────
  currentSync.phase = 'Fetching satisfaction ratings';
  currentSync.progress = 0;

  try {
    for await (const page of fetchSatisfactionRatings(dateFrom, dateTo)) {
      const saveRatings = db.transaction((ratings) => {
        for (const r of ratings) {
          upsertRating.run(r.id, r.ticket_id || null, r.score, r.comment || null, r.created_at);
        }
      });
      saveRatings(page);
      currentSync.progress += page.length;
    }
  } catch (err) {
    // Satisfaction ratings may not be available on all plans
    console.warn('[Sync] Could not fetch satisfaction ratings:', err.message);
  }

  // ── Phase 5: Sentiment analysis ────────────────────────────────────────
  currentSync.phase = 'Analyzing sentiment';
  currentSync.progress = 0;

  // Build ticket list with latest public comment
  const ticketsForAnalysis = allTickets.map((t) => {
    const latestComment = db.prepare(`
      SELECT body FROM ticket_comments
      WHERE ticket_id=? AND is_public=1
      ORDER BY created_at DESC LIMIT 1
    `).get(t.id);
    return {
      id: t.id,
      subject: t.subject,
      latestPublicComment: latestComment?.body || '',
    };
  });

  const sentimentResults = await analyzeSentimentBatch(ticketsForAnalysis);
  const now = new Date().toISOString();

  const saveSentiments = db.transaction((results) => {
    for (const r of results) {
      upsertSentiment.run(r.ticket_id, r.sentiment, r.confidence, now, 'claude-haiku-4-5-20251001');
    }
  });
  saveSentiments(sentimentResults);
  currentSync.progress = sentimentResults.length;

  // ── Phase 6: Topic clustering ──────────────────────────────────────────
  currentSync.phase = 'Clustering topics';
  currentSync.progress = 0;

  const clusters = await clusterTopics(allTickets);

  // Delete old clusters for this sync run and insert new ones
  db.prepare(`DELETE FROM topic_clusters WHERE sync_run_id=?`).run(runId);
  const saveClusters = db.transaction((cls) => {
    for (const c of cls) {
      db.prepare(`
        INSERT INTO topic_clusters (sync_run_id, topic_label, ticket_count, example_ticket_ids, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        runId,
        c.topic_label,
        c.ticket_count,
        JSON.stringify(c.example_ticket_ids || []),
        new Date().toISOString()
      );
    }
  });
  saveClusters(clusters);

  // ── Complete ────────────────────────────────────────────────────────────
  const completedAt = new Date().toISOString();
  db.prepare(
    `UPDATE sync_runs SET status='completed', completed_at=?, tickets_fetched=? WHERE id=?`
  ).run(completedAt, allTickets.length, runId);

  currentSync.status = 'completed';
  currentSync.phase = 'Done';
  currentSync.progress = allTickets.length;
  currentSync.total = allTickets.length;

  console.log(`[Sync] Completed run ${runId}: ${allTickets.length} tickets`);
}

module.exports = { startSync, getSyncStatus };
