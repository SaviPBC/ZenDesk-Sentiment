const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/tickets?from=&to=&sentiment=&channel=&page=&limit=
router.get('/', (req, res) => {
  const { from, to, sentiment, channel, page = 1, limit = 25 } = req.query;

  const conditions = ['1=1'];
  const params = [];

  if (from) {
    conditions.push(`t.created_at >= ?`);
    params.push(from);
  }
  if (to) {
    conditions.push(`t.created_at <= ?`);
    params.push(`${to}T23:59:59`);
  }
  if (sentiment && sentiment !== 'all') {
    conditions.push(`sr.sentiment = ?`);
    params.push(sentiment);
  }
  if (channel && channel !== 'all') {
    conditions.push(`t.channel = ?`);
    params.push(channel);
  }

  const where = conditions.join(' AND ');
  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const countRow = db.prepare(`
    SELECT COUNT(*) as total
    FROM tickets t
    LEFT JOIN sentiment_results sr ON sr.ticket_id = t.id
    LEFT JOIN satisfaction_ratings rat ON rat.ticket_id = t.id
    WHERE ${where}
  `).get(...params);

  const rows = db.prepare(`
    SELECT
      t.id,
      t.subject,
      t.status,
      t.channel,
      t.created_at,
      t.tags,
      sr.sentiment,
      sr.confidence,
      rat.score as csat_score
    FROM tickets t
    LEFT JOIN sentiment_results sr ON sr.ticket_id = t.id
    LEFT JOIN satisfaction_ratings rat ON rat.ticket_id = t.id
    WHERE ${where}
    ORDER BY t.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit, 10), offset);

  res.json({
    tickets: rows,
    total: countRow.total,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    pages: Math.ceil(countRow.total / parseInt(limit, 10)),
  });
});

module.exports = router;
