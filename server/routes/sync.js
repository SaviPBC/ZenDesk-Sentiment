const express = require('express');
const router = express.Router();
const { startSync, getSyncStatus } = require('../services/syncService');

// POST /api/sync
router.post('/', async (req, res, next) => {
  try {
    const { date_from, date_to } = req.body;
    if (!date_from || !date_to) {
      return res.status(400).json({ error: 'date_from and date_to are required' });
    }
    const runId = await startSync(date_from, date_to);
    res.json({ runId, status: 'running' });
  } catch (err) {
    next(err);
  }
});

// GET /api/sync/status
router.get('/status', (req, res) => {
  res.json(getSyncStatus());
});

module.exports = router;
