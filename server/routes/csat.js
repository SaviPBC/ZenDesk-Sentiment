const express = require('express');
const router = express.Router();
const db = require('../db');

const VALID_CHANNELS = ['web', 'email', 'voice', 'chat', 'api', 'mobile'];

// GET /api/csat?from=&to=&channel=
router.get('/', (req, res) => {
  const { from, to, channel } = req.query;

  const conditions = [`sr.score IN ('good','bad')`];
  const params = [];

  if (from) {
    conditions.push(`t.created_at >= ?`);
    params.push(from);
  }
  if (to) {
    conditions.push(`t.created_at <= ?`);
    params.push(`${to}T23:59:59`);
  }
  if (channel && VALID_CHANNELS.includes(channel)) {
    conditions.push(`t.channel = ?`);
    params.push(channel);
  }

  const where = conditions.join(' AND ');

  // Overall stats
  const overall = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN sr.score='good' THEN 1 ELSE 0 END) as good,
      SUM(CASE WHEN sr.score='bad' THEN 1 ELSE 0 END) as bad
    FROM satisfaction_ratings sr
    JOIN tickets t ON t.id = sr.ticket_id
    WHERE ${where}
  `).get(...params);

  // Trend by week (group by ISO week)
  const trendRows = db.prepare(`
    SELECT
      strftime('%Y-%W', t.created_at) as week,
      COUNT(*) as total,
      SUM(CASE WHEN sr.score='good' THEN 1 ELSE 0 END) as good
    FROM satisfaction_ratings sr
    JOIN tickets t ON t.id = sr.ticket_id
    WHERE ${where}
    GROUP BY week
    ORDER BY week ASC
  `).all(...params);

  const csatPct = overall.total > 0
    ? Math.round((overall.good / overall.total) * 1000) / 10
    : null;

  const trend = trendRows.map((r) => ({
    week: r.week,
    csat: r.total > 0 ? Math.round((r.good / r.total) * 1000) / 10 : 0,
    total: r.total,
  }));

  // Comments from bad ratings
  const badConditions = [`sr.score='bad'`, `sr.comment IS NOT NULL`, `sr.comment != ''`];
  const badParams = [];
  if (from) { badConditions.push(`t.created_at >= ?`); badParams.push(from); }
  if (to) { badConditions.push(`t.created_at <= ?`); badParams.push(`${to}T23:59:59`); }
  if (channel && VALID_CHANNELS.includes(channel)) { badConditions.push(`t.channel = ?`); badParams.push(channel); }

  const badComments = db.prepare(`
    SELECT sr.comment, t.id as ticket_id, t.subject
    FROM satisfaction_ratings sr
    JOIN tickets t ON t.id = sr.ticket_id
    WHERE ${badConditions.join(' AND ')}
    ORDER BY sr.created_at DESC
    LIMIT 10
  `).all(...badParams);

  res.json({
    overall: {
      csatPct,
      total: overall.total,
      good: overall.good,
      bad: overall.bad,
    },
    trend,
    recentBadComments: badComments,
  });
});

module.exports = router;
