const Anthropic = require('@anthropic-ai/sdk');
const db = require('../db');

const HAIKU = 'claude-haiku-4-5-20251001';
const SONNET = 'claude-sonnet-4-6';
const BATCH_SIZE = 40;          // tickets per prompt
const POLL_INTERVAL_MS = 5000;  // how often to check batch status

let currentRun = {
  runId: null,
  status: 'idle',
  progress: 0,
  total: 0,
  phase: '',
  error: null,
  startedAt: null,
};

function getStatus() {
  return { ...currentRun };
}

function getApiKey() {
  const row = db.prepare("SELECT value FROM settings WHERE key='anthropic_api_key'").get();
  if (row && row.value) return row.value;
  return process.env.ANTHROPIC_API_KEY || null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startRun(dateFrom, dateTo, channel) {
  if (currentRun.status === 'running') {
    throw new Error('An insights analysis is already in progress.');
  }

  const now = new Date().toISOString();
  const result = db.prepare(
    `INSERT INTO insights_runs (started_at, status, date_from, date_to, channel) VALUES (?, 'running', ?, ?, ?)`
  ).run(now, dateFrom, dateTo, channel || null);

  const runId = result.lastInsertRowid;

  currentRun = {
    runId,
    status: 'running',
    progress: 0,
    total: 0,
    phase: 'Fetching requester comments',
    error: null,
    startedAt: now,
  };

  // Defer pipeline so the HTTP response is sent before any heavy synchronous work starts
  setImmediate(() => {
    runPipeline(runId, dateFrom, dateTo, channel).catch((err) => {
      console.error('[Insights] Pipeline failed:', err.message);
      currentRun.status = 'failed';
      currentRun.error = err.message;
      db.prepare(
        `UPDATE insights_runs SET status='failed', completed_at=?, error=? WHERE id=?`
      ).run(new Date().toISOString(), err.message, runId);
    });
  });

  return runId;
}

async function runPipeline(runId, dateFrom, dateTo, channel) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Anthropic API key not configured. Please add it in Settings.');
  }

  const client = new Anthropic({ apiKey });

  // ── Phase 1: Fetch requester comments ──────────────────────────────────
  currentRun.phase = 'Fetching requester comments';

  const conditions = ['t.requester_id IS NOT NULL'];
  const params = [];
  if (dateFrom && dateTo) {
    conditions.push(`t.created_at >= ? AND t.created_at <= ?`);
    params.push(dateFrom, `${dateTo}T23:59:59`);
  }
  if (channel) {
    conditions.push(`t.channel = ?`);
    params.push(channel);
  }

  const tickets = db.prepare(`
    SELECT t.id, t.subject, t.requester_id
    FROM tickets t
    WHERE ${conditions.join(' AND ')}
    ORDER BY t.created_at DESC
  `).all(...params);

  if (tickets.length === 0) {
    complete(runId, 0, 0, [], [], 'No tickets found in the selected date range and filters.');
    return;
  }

  // Fetch all requester comments in a single JOIN query (avoids N+1 per ticket)
  const commentRows = db.prepare(`
    SELECT t.id, t.subject, tc.body
    FROM tickets t
    JOIN ticket_comments tc
      ON tc.ticket_id = t.id
      AND tc.author_id = t.requester_id
      AND tc.is_public = 1
    WHERE ${conditions.join(' AND ')}
    ORDER BY t.id, tc.created_at ASC
  `).all(...params);

  // Group comments by ticket
  const byTicket = new Map();
  for (const row of commentRows) {
    if (!byTicket.has(row.id)) {
      byTicket.set(row.id, { id: row.id, subject: row.subject || '(no subject)', bodies: [] });
    }
    byTicket.get(row.id).bodies.push((row.body || '').trim());
  }

  const ticketData = [];
  for (const t of byTicket.values()) {
    const text = t.bodies.filter(Boolean).map((b) => b.slice(0, 400)).join(' | ');
    if (text) ticketData.push({ id: t.id, subject: t.subject, text });
  }

  const commentCount = ticketData.length;

  if (commentCount === 0) {
    complete(runId, tickets.length, 0, [], [], 'No requester comments found for the selected tickets.');
    return;
  }

  // ── Phase 2: Build all prompts and submit as a single Message Batch ────
  currentRun.phase = 'Submitting analysis batch';

  const batchRequests = [];
  for (let i = 0; i < ticketData.length; i += BATCH_SIZE) {
    const chunk = ticketData.slice(i, i + BATCH_SIZE);
    const lines = chunk.map((t) => `[#${t.id}] ${t.subject}: ${t.text}`);

    batchRequests.push({
      custom_id: `chunk-${i}`,
      params: {
        model: HAIKU,
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `You are a customer support insights analyst. Analyze these customer comments from support tickets and identify the recurring sentiment themes present.

Requester comments:
${lines.join('\n')}

Identify up to 8 distinct sentiment themes. For each theme provide:
- theme: a concise, specific label (e.g. "Frustration with slow response times", "Confusion about billing charges")
- count: how many of the above comments reflect this theme
- tone: the primary emotion (e.g. frustrated, confused, appreciative, anxious, disappointed, satisfied)
- quote: a short verbatim or paraphrased representative quote

Return ONLY a valid JSON array, no markdown, no explanation:
[{"theme": "...", "count": N, "tone": "...", "quote": "..."}]`,
        }],
      },
    });
  }

  const totalChunks = batchRequests.length;
  currentRun.total = totalChunks;
  currentRun.progress = 0;

  console.log(`[Insights] Submitting ${totalChunks} requests as a single Message Batch`);
  const messageBatch = await client.messages.batches.create({ requests: batchRequests });

  // ── Phase 3: Poll for batch completion ─────────────────────────────────
  currentRun.phase = 'Processing batch';

  let batchStatus = messageBatch;
  while (batchStatus.processing_status !== 'ended') {
    await sleep(POLL_INTERVAL_MS);
    batchStatus = await client.messages.batches.retrieve(messageBatch.id);
    const counts = batchStatus.request_counts || {};
    currentRun.progress = (counts.succeeded || 0) + (counts.errored || 0);
    currentRun.phase = `Processing batch (${currentRun.progress}/${totalChunks} done)`;
  }

  // ── Phase 4: Collect results ────────────────────────────────────────────
  currentRun.phase = 'Collecting results';

  const rawThemes = [];
  const resultsStream = await client.messages.batches.results(messageBatch.id);
  for await (const result of resultsStream) {
    if (result.result.type === 'succeeded') {
      const content = result.result.message.content[0]?.text || '';
      const jsonText = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      try {
        const themes = JSON.parse(jsonText);
        if (Array.isArray(themes)) rawThemes.push(...themes);
      } catch {
        console.warn('[Insights] Failed to parse themes JSON for chunk', result.custom_id);
      }
    } else {
      console.warn('[Insights] Chunk failed:', result.custom_id, result.result.type);
    }
  }

  // ── Phase 5: Synthesize themes + generate recommendations (Sonnet) ────
  currentRun.phase = 'Generating recommendations';

  const synthesisPrompt = `You are a customer support director. You have analyzed ${commentCount} requester comments across ${tickets.length} support tickets.

The following sentiment themes were identified across batches of those comments:
${JSON.stringify(rawThemes, null, 2)}

Your tasks:
1. Consolidate and merge similar/duplicate themes, summing their counts. Rank by total frequency.
2. Return the top 10 most significant customer sentiment themes.
3. Generate 5–8 specific, actionable recommendations for the customer support team to improve CSAT and user sentiment.

For each sentiment theme:
- rank: 1–10
- theme: clear descriptive label
- count: total estimated tickets affected (merge duplicates)
- tone: primary emotional tone
- description: 1–2 sentences on what customers are experiencing
- example_quote: the best representative quote from the raw data

For each recommendation:
- priority: "high", "medium", or "low"
- title: short action-oriented title (max 8 words)
- description: 2–3 sentences explaining the action and rationale
- impact: 1 sentence on expected improvement to CSAT or sentiment

Return ONLY valid JSON, no markdown, no explanation:
{
  "summary": "2–3 sentence executive summary of the overall customer sentiment picture",
  "top_sentiments": [...],
  "recommendations": [...]
}`;

  let topSentiments = [];
  let recommendations = [];
  let summary = '';

  const synthMessage = await client.messages.create({
    model: SONNET,
    max_tokens: 4096,
    messages: [{ role: 'user', content: synthesisPrompt }],
  });

  const synthContent = synthMessage.content[0]?.text || '';
  const synthJson = synthContent.replace(/```json?\n?/g, '').replace(/```/g, '').trim();

  try {
    const parsed = JSON.parse(synthJson);
    topSentiments = parsed.top_sentiments || [];
    recommendations = parsed.recommendations || [];
    summary = parsed.summary || '';
  } catch {
    console.warn('[Insights] Failed to parse synthesis JSON');
    throw new Error('Failed to parse synthesis response from Claude.');
  }

  // ── Complete ────────────────────────────────────────────────────────────
  complete(runId, tickets.length, commentCount, topSentiments, recommendations, summary);
  console.log(`[Insights] Run ${runId} complete — ${tickets.length} tickets, ${commentCount} comments, ${totalChunks} batch requests`);
}

function complete(runId, ticketCount, commentCount, topSentiments, recommendations, summary) {
  db.prepare(`
    UPDATE insights_runs
    SET status='completed', completed_at=?, ticket_count=?, comment_count=?,
        top_sentiments=?, recommendations=?, summary=?
    WHERE id=?
  `).run(
    new Date().toISOString(),
    ticketCount,
    commentCount,
    JSON.stringify(topSentiments),
    JSON.stringify(recommendations),
    summary,
    runId,
  );

  currentRun.status = 'completed';
  currentRun.phase = 'Done';
  currentRun.progress = currentRun.total;
}

module.exports = { startRun, getStatus };
