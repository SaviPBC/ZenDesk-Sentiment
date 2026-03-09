const db = require('../db');

let currentFreshness = null;

function getFreshnessStatus() {
  return currentFreshness;
}

/**
 * Scan all articles for staleness and ticket spikes.
 * - Stale: not updated in configurable days (default 180)
 * - Ticket spike: article topic had significant ticket volume in the last 30 days
 */
async function startFreshnessCheck(staleThresholdDays = 180) {
  if (currentFreshness && currentFreshness.status === 'running') {
    throw new Error('Freshness check already running');
  }
  currentFreshness = { status: 'running', phase: 'Checking staleness', progress: 0, total: 0, error: null };

  setImmediate(async () => {
    try {
      const articles = db.prepare('SELECT * FROM hc_articles WHERE draft=0').all();
      currentFreshness.total = articles.length;

      // Get ticket clusters from the last 30 days for spike detection
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const recentTickets = db.prepare(
        'SELECT subject FROM tickets WHERE created_at >= ? LIMIT 1000'
      ).all(thirtyDaysAgo);

      // Topic cluster data
      const latestSync = db.prepare(
        "SELECT id FROM sync_runs WHERE status='completed' ORDER BY completed_at DESC LIMIT 1"
      ).get();
      const clusters = latestSync
        ? db.prepare('SELECT * FROM topic_clusters WHERE sync_run_id=?').all(latestSync.id)
        : [];

      const now = Date.now();
      const staleMs = staleThresholdDays * 24 * 60 * 60 * 1000;

      // Clear old unresolved alerts
      db.prepare('DELETE FROM hc_freshness_alerts WHERE resolved=0').run();

      const insertAlert = db.prepare(`
        INSERT INTO hc_freshness_alerts
          (article_id, alert_type, days_since_updated, ticket_spike_count, matched_topic, details, resolved, created_at)
        VALUES (?,?,?,?,?,?,0,?)
      `);

      const insertAll = db.transaction((arts) => {
        for (const article of arts) {
          const updatedAt = article.updated_at ? new Date(article.updated_at).getTime() : 0;
          const daysSinceUpdated = Math.floor((now - updatedAt) / (24 * 60 * 60 * 1000));

          // Check staleness
          if (now - updatedAt > staleMs) {
            insertAlert.run(
              article.id, 'stale', daysSinceUpdated, 0, null,
              `Article has not been updated in ${daysSinceUpdated} days.`,
              new Date().toISOString()
            );
          }

          // Check ticket spikes: does this article's topic have high recent ticket volume?
          const titleWords = (article.title || '').toLowerCase().split(/\s+/).filter((w) => w.length > 3);
          for (const cluster of clusters) {
            const label = cluster.topic_label.toLowerCase();
            const matches = titleWords.some((w) => label.includes(w));
            if (matches && cluster.ticket_count > 5) {
              // Verify recent tickets also match
              const recentMatches = recentTickets.filter((t) =>
                titleWords.some((w) => (t.subject || '').toLowerCase().includes(w))
              );
              if (recentMatches.length > 3) {
                insertAlert.run(
                  article.id, 'ticket_spike', daysSinceUpdated, recentMatches.length,
                  cluster.topic_label,
                  `${recentMatches.length} recent tickets relate to "${cluster.topic_label}" — article may need updating.`,
                  new Date().toISOString()
                );
              }
            }
          }

          currentFreshness.progress++;
        }
      });

      insertAll(articles);

      const alertCount = db.prepare('SELECT COUNT(*) as c FROM hc_freshness_alerts WHERE resolved=0').get().c;
      currentFreshness.status = 'complete';
      currentFreshness.phase = 'Done';
      console.log(`[Freshness] Generated ${alertCount} alerts for ${articles.length} articles`);
    } catch (err) {
      console.error('[Freshness] Error:', err.message);
      currentFreshness.status = 'error';
      currentFreshness.error = err.message;
    }
  });

  return currentFreshness;
}

module.exports = { startFreshnessCheck, getFreshnessStatus };
