const express = require('express');
const router = express.Router();
const db = require('../db');
const Anthropic = require('@anthropic-ai/sdk');

const MODEL = 'claude-haiku-4-5-20251001';

function getApiKey() {
  const row = db.prepare("SELECT value FROM settings WHERE key='anthropic_api_key'").get();
  if (row && row.value) return row.value;
  return process.env.ANTHROPIC_API_KEY || null;
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

function fetchTicketsForDisplay(ids) {
  if (!ids.length) return [];
  const rows = [];
  const ID_CHUNK = 900;
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const slice = ids.slice(i, i + ID_CHUNK);
    const ph = slice.map(() => '?').join(',');
    const chunk = db.prepare(`
      SELECT t.id, t.subject, t.status, t.channel, t.created_at,
             sr.sentiment, rat.score as csat_score
      FROM tickets t
      LEFT JOIN sentiment_results sr ON sr.ticket_id = t.id
      LEFT JOIN satisfaction_ratings rat ON rat.ticket_id = t.id
      WHERE t.id IN (${ph})
      ORDER BY t.created_at DESC
    `).all(...slice);
    rows.push(...chunk);
  }
  return rows;
}

// POST /api/content-search
router.post('/', async (req, res) => {
  const { from, to, query, mode } = req.body;

  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'query is required' });
  }
  if (!mode || !['text', 'ai'].includes(mode)) {
    return res.status(400).json({ error: 'mode must be "text" or "ai"' });
  }

  const dateFrom = from || '2000-01-01';
  const dateTo = to ? `${to}T23:59:59` : '2099-12-31';

  // ── Text mode ──────────────────────────────────────────────────────────────
  if (mode === 'text') {
    const like = `%${query.trim()}%`;
    const rows = db.prepare(`
      SELECT DISTINCT t.id, t.subject, t.status, t.channel, t.created_at,
             sr.sentiment, rat.score as csat_score
      FROM tickets t
      LEFT JOIN sentiment_results sr ON sr.ticket_id = t.id
      LEFT JOIN satisfaction_ratings rat ON rat.ticket_id = t.id
      LEFT JOIN ticket_comments tc ON tc.ticket_id = t.id
      WHERE t.created_at >= ? AND t.created_at <= ?
        AND (t.subject LIKE ? OR t.description LIKE ? OR tc.body LIKE ?)
      ORDER BY t.created_at DESC
      LIMIT 200
    `).all(dateFrom, dateTo, like, like, like);

    return res.json({
      mode: 'text',
      query: query.trim(),
      total_scanned: null,
      matches: rows.map((r) => ({ ...r, match_reason: null })),
      summary: null,
    });
  }

  // ── AI mode ────────────────────────────────────────────────────────────────
  const apiKey = getApiKey();
  if (!apiKey) {
    return res.status(400).json({ error: 'Anthropic API key is required for AI Analysis mode. Configure it in Settings.' });
  }

  // Fetch all tickets in range with first public comment snippet
  const tickets = db.prepare(`
    SELECT t.id, t.subject, t.description
    FROM tickets t
    WHERE t.created_at >= ? AND t.created_at <= ?
    ORDER BY t.created_at DESC
  `).all(dateFrom, dateTo);

  if (!tickets.length) {
    return res.json({ mode: 'ai', query: query.trim(), total_scanned: 0, matches: [], summary: null });
  }

  // Pull first public comment snippet for each ticket
  // Chunked in batches of 900 to stay under SQLite's 999 bind-variable limit
  const commentMap = {};
  const allIds = tickets.map((t) => t.id);
  const ID_CHUNK = 900;
  for (let i = 0; i < allIds.length; i += ID_CHUNK) {
    const idSlice = allIds.slice(i, i + ID_CHUNK);
    const ph = idSlice.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT ticket_id, body
      FROM ticket_comments
      WHERE ticket_id IN (${ph}) AND is_public = 1
      ORDER BY ticket_id, created_at ASC
    `).all(...idSlice);
    for (const c of rows) {
      if (!commentMap[c.ticket_id]) commentMap[c.ticket_id] = c.body?.slice(0, 300) || '';
    }
  }

  const client = new Anthropic({ apiKey });
  const chunks = chunkArray(tickets, 200);
  const matchMap = {}; // ticket_id → reason

  for (const chunk of chunks) {
    const lines = chunk.map((t) => {
      const text = (commentMap[t.id] || t.description || t.subject || '').slice(0, 300);
      return `ID ${t.id} | Subject: ${(t.subject || '').slice(0, 100)} | Content: ${text}`;
    });

    const prompt = `You are a support ticket analyst. A user wants to find tickets relevant to this search query:

"${query.trim()}"

Analyze each ticket below and determine if it is relevant to the query. Be liberal in what you consider relevant — include tickets that partially match or relate to the topic.

Tickets:
${lines.join('\n')}

Respond with ONLY a valid JSON array (no markdown, no explanation):
[{"ticket_id": 123, "relevant": true, "reason": "one-sentence explanation"}]`;

    try {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = message.content[0]?.text || '';
      const jsonText = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();

      let parsed;
      try { parsed = JSON.parse(jsonText); } catch { continue; }

      for (const item of parsed) {
        if (item.relevant && item.ticket_id) {
          matchMap[item.ticket_id] = item.reason || '';
        }
      }
    } catch (err) {
      console.warn('[ContentSearch] Claude chunk error:', err.message);
    }
  }

  const matchedIds = Object.keys(matchMap).map(Number);
  const displayRows = fetchTicketsForDisplay(matchedIds);

  // Attach reasons in DB-returned order
  const matches = displayRows.map((r) => ({
    ...r,
    match_reason: matchMap[r.id] || null,
  }));

  // Synthesize summary if there are matches
  let summary = null;
  if (matches.length > 0) {
    const bulletLines = matches.slice(0, 15).map((m) => `- #${m.id}: ${m.subject || ''} (${m.match_reason || ''})`);
    const summaryPrompt = `A support team searched their tickets for: "${query.trim()}"

Here are the matching tickets found:
${bulletLines.join('\n')}

Write a concise 2–3 sentence summary of what these tickets have in common and any notable patterns or insights. Be direct and analytical.`;

    try {
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 512,
        messages: [{ role: 'user', content: summaryPrompt }],
      });
      summary = msg.content[0]?.text?.trim() || null;
    } catch (err) {
      console.warn('[ContentSearch] Summary error:', err.message);
    }
  }

  res.json({
    mode: 'ai',
    query: query.trim(),
    total_scanned: tickets.length,
    matches,
    summary,
  });
});

module.exports = router;
