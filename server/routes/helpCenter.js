const express = require('express');
const router = express.Router();
const db = require('../db');
const { startHcSync, getHcSyncStatus, startAudit, getAuditStatus } = require('../services/contentAuditService');
const { startGapAnalysis, getGapStatus } = require('../services/gapAnalysisService');
const { generateImprovement, publishImprovement } = require('../services/articleImprovementService');
const { startDiscoverabilityAnalysis, getDiscoverabilityStatus } = require('../services/discoverabilityService');
const { startFreshnessCheck, getFreshnessStatus } = require('../services/freshnessService');

// ── HC Article Sync ────────────────────────────────────────────────────────────

router.post('/sync', async (req, res, next) => {
  try {
    await startHcSync();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/sync/status', (req, res) => {
  res.json(getHcSyncStatus() || { status: 'idle' });
});

// ── Articles ───────────────────────────────────────────────────────────────────

router.get('/articles', (req, res) => {
  const { page = 1, limit = 25, flag, search } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = [];
  let params = [];

  if (flag) {
    where.push("s.flags LIKE ?");
    params.push(`%${flag}%`);
  }
  if (search) {
    where.push("(a.title LIKE ? OR a.section_title LIKE ? OR a.category_title LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const total = db.prepare(`
    SELECT COUNT(*) as c FROM hc_articles a
    LEFT JOIN hc_article_scores s ON s.article_id = a.id
    ${whereClause}
  `).get(...params).c;

  const articles = db.prepare(`
    SELECT a.*, s.vote_ratio, s.related_ticket_count, s.matched_topics,
           s.quality_score, s.flags, s.last_scored_at
    FROM hc_articles a
    LEFT JOIN hc_article_scores s ON s.article_id = a.id
    ${whereClause}
    ORDER BY s.quality_score ASC NULLS LAST
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({
    articles: articles.map((a) => ({
      ...a,
      label_names: JSON.parse(a.label_names || '[]'),
      matched_topics: JSON.parse(a.matched_topics || '[]'),
      flags: JSON.parse(a.flags || '[]'),
    })),
    total,
    page: parseInt(page),
    limit: parseInt(limit),
  });
});

// ── Content Audit ──────────────────────────────────────────────────────────────

router.post('/audit', async (req, res, next) => {
  try {
    await startAudit();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/audit/status', (req, res) => {
  res.json(getAuditStatus() || { status: 'idle' });
});

// ── Gap Analysis ───────────────────────────────────────────────────────────────

router.post('/gap-analysis', async (req, res, next) => {
  try {
    await startGapAnalysis();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/gap-analysis/status', (req, res) => {
  res.json(getGapStatus() || { status: 'idle' });
});

router.get('/gaps', (req, res) => {
  const gaps = db.prepare('SELECT * FROM hc_gaps ORDER BY gap_score DESC').all();
  res.json(gaps.map((g) => ({
    ...g,
    related_article_ids: JSON.parse(g.related_article_ids || '[]'),
  })));
});

// ── Article Improvements ───────────────────────────────────────────────────────

router.post('/articles/:id/improve', async (req, res, next) => {
  try {
    const { reference_url } = req.body;
    const improvement = await generateImprovement(parseInt(req.params.id), reference_url || null);
    res.json(improvement);
  } catch (err) {
    next(err);
  }
});

router.get('/improvements', (req, res) => {
  const improvements = db.prepare(`
    SELECT i.*, a.title as article_current_title, a.url as article_url
    FROM hc_improvements i
    LEFT JOIN hc_articles a ON a.id = i.article_id
    ORDER BY i.created_at DESC
  `).all();
  res.json(improvements);
});

router.get('/improvements/:id', (req, res) => {
  const improvement = db.prepare(`
    SELECT i.*, a.title as article_current_title, a.url as article_url
    FROM hc_improvements i
    LEFT JOIN hc_articles a ON a.id = i.article_id
    WHERE i.id = ?
  `).get(parseInt(req.params.id));
  if (!improvement) return res.status(404).json({ error: 'Not found' });
  res.json(improvement);
});

router.put('/improvements/:id', (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'status must be approved or rejected' });
    }
    db.prepare("UPDATE hc_improvements SET status=?, reviewed_at=? WHERE id=?").run(
      status, new Date().toISOString(), parseInt(req.params.id)
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/improvements/:id/publish', async (req, res, next) => {
  try {
    const result = await publishImprovement(parseInt(req.params.id));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── Discoverability ────────────────────────────────────────────────────────────

router.post('/discoverability', async (req, res, next) => {
  try {
    await startDiscoverabilityAnalysis();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/discoverability/status', (req, res) => {
  res.json(getDiscoverabilityStatus() || { status: 'idle' });
});

router.get('/discoverability', (req, res) => {
  const suggestions = db.prepare(`
    SELECT d.*, a.url as article_url
    FROM hc_discoverability d
    LEFT JOIN hc_articles a ON a.id = d.article_id
    ORDER BY d.created_at DESC
  `).all();
  res.json(suggestions.map((s) => ({
    ...s,
    suggested_labels: JSON.parse(s.suggested_labels || '[]'),
    suggested_related_ids: JSON.parse(s.suggested_related_ids || '[]'),
  })));
});

// ── Freshness Monitor ──────────────────────────────────────────────────────────

router.post('/freshness/run', async (req, res, next) => {
  try {
    const { stale_threshold_days = 180 } = req.body;
    await startFreshnessCheck(stale_threshold_days);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/freshness/status', (req, res) => {
  res.json(getFreshnessStatus() || { status: 'idle' });
});

router.get('/freshness', (req, res) => {
  const { resolved = '0' } = req.query;
  const alerts = db.prepare(`
    SELECT f.*, a.title as article_title, a.url as article_url, a.updated_at as article_updated_at
    FROM hc_freshness_alerts f
    LEFT JOIN hc_articles a ON a.id = f.article_id
    WHERE f.resolved = ?
    ORDER BY f.created_at DESC
  `).all(resolved === '1' ? 1 : 0);
  res.json(alerts);
});

router.put('/freshness/:id/resolve', (req, res, next) => {
  try {
    db.prepare('UPDATE hc_freshness_alerts SET resolved=1 WHERE id=?').run(parseInt(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── Overview Stats ─────────────────────────────────────────────────────────────

router.get('/overview', (req, res) => {
  const totalArticles = db.prepare('SELECT COUNT(*) as c FROM hc_articles WHERE draft=0').get().c;
  const scoredArticles = db.prepare('SELECT COUNT(*) as c FROM hc_article_scores').get().c;
  const avgQuality = db.prepare('SELECT AVG(quality_score) as v FROM hc_article_scores').get().v;
  const flagged = db.prepare(
    "SELECT COUNT(*) as c FROM hc_article_scores WHERE flags != '[]' AND flags IS NOT NULL"
  ).get().c;
  const gaps = db.prepare('SELECT COUNT(*) as c FROM hc_gaps').get().c;
  const pendingImprovements = db.prepare("SELECT COUNT(*) as c FROM hc_improvements WHERE status='pending'").get().c;
  const freshAlerts = db.prepare('SELECT COUNT(*) as c FROM hc_freshness_alerts WHERE resolved=0').get().c;
  const discoverability = db.prepare('SELECT COUNT(*) as c FROM hc_discoverability').get().c;
  const avgVoteRatio = db.prepare(
    'SELECT AVG(vote_ratio) as v FROM hc_article_scores WHERE vote_ratio IS NOT NULL'
  ).get().v;

  const lastSync = db.prepare('SELECT synced_at FROM hc_articles ORDER BY synced_at DESC LIMIT 1').get();

  res.json({
    totalArticles,
    scoredArticles,
    avgQuality: avgQuality ? Math.round(avgQuality) : null,
    flaggedArticles: flagged,
    contentGaps: gaps,
    pendingImprovements,
    freshnessAlerts: freshAlerts,
    discoverabilityCount: discoverability,
    avgVoteRatio: avgVoteRatio ? Math.round(avgVoteRatio * 100) : null,
    lastSyncedAt: lastSync ? lastSync.synced_at : null,
  });
});

module.exports = router;
