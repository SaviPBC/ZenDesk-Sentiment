const express = require('express');
const router = express.Router();
const db = require('../db');
const { startRun, getStatus } = require('../services/insightsService');

// GET /api/insights/status
router.get('/status', (req, res) => {
  res.json(getStatus());
});

// GET /api/insights — list past runs, most recent first
router.get('/', (req, res) => {
  const runs = db.prepare(`
    SELECT id, started_at, completed_at, status, date_from, date_to, channel,
           ticket_count, comment_count, summary, error
    FROM insights_runs
    ORDER BY started_at DESC
    LIMIT 20
  `).all();
  res.json(runs);
});

// GET /api/insights/:id — full results for a specific run
router.get('/:id', (req, res) => {
  const run = db.prepare(`SELECT * FROM insights_runs WHERE id = ?`).get(req.params.id);
  if (!run) return res.status(404).json({ error: 'Run not found' });

  res.json({
    ...run,
    top_sentiments: JSON.parse(run.top_sentiments || '[]'),
    recommendations: JSON.parse(run.recommendations || '[]'),
  });
});

// POST /api/insights — trigger a new analysis run
router.post('/', async (req, res, next) => {
  try {
    const { date_from, date_to, channel } = req.body;
    if (!date_from || !date_to) {
      return res.status(400).json({ error: 'date_from and date_to are required' });
    }

    // Pre-flight: verify Anthropic API key is configured before starting
    const keyRow = db.prepare("SELECT value FROM settings WHERE key='anthropic_api_key'").get();
    const apiKey = keyRow?.value || process.env.ANTHROPIC_API_KEY || null;
    if (!apiKey) {
      return res.status(400).json({
        error: 'Anthropic API key not configured. Go to Settings → Anthropic and add your API key before running analysis.',
      });
    }

    const runId = await startRun(date_from, date_to, channel || null);
    res.json({ runId });
  } catch (err) {
    if (err.message.includes('already in progress')) {
      return res.status(409).json({ error: err.message });
    }
    next(err);
  }
});

module.exports = router;
