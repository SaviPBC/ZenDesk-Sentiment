const db = require('../db');
const { fetchArticles, fetchCategories, fetchSections } = require('./guideService');

// In-memory state for the HC sync + audit jobs
let currentHcSync = null;
let currentAudit = null;

function getHcSyncStatus() {
  return currentHcSync;
}

function getAuditStatus() {
  return currentAudit;
}

/**
 * Sync all Help Center articles from Zendesk Guide into hc_articles table.
 */
async function startHcSync() {
  if (currentHcSync && currentHcSync.status === 'running') {
    throw new Error('HC sync already running');
  }

  currentHcSync = { status: 'running', phase: 'Fetching categories', progress: 0, total: 0, error: null };

  setImmediate(async () => {
    try {
      // Build lookup maps for section/category names
      currentHcSync.phase = 'Fetching categories & sections';
      const [categories, sections] = await Promise.all([fetchCategories(), fetchSections()]);
      const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));
      const secMap = Object.fromEntries(sections.map((s) => [s.id, s]));

      currentHcSync.phase = 'Fetching articles';

      const upsert = db.prepare(`
        INSERT INTO hc_articles
          (id, title, body, url, section_id, section_title, category_id, category_title,
           vote_sum, vote_count, thumbs_up, thumbs_down, label_names, draft, locale,
           created_at, updated_at, edited_at, synced_at)
        VALUES
          (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET
          title=excluded.title, body=excluded.body, url=excluded.url,
          section_id=excluded.section_id, section_title=excluded.section_title,
          category_id=excluded.category_id, category_title=excluded.category_title,
          vote_sum=excluded.vote_sum, vote_count=excluded.vote_count,
          thumbs_up=excluded.thumbs_up, thumbs_down=excluded.thumbs_down,
          label_names=excluded.label_names, draft=excluded.draft, locale=excluded.locale,
          created_at=excluded.created_at, updated_at=excluded.updated_at,
          edited_at=excluded.edited_at, synced_at=excluded.synced_at
      `);

      let count = 0;
      for await (const batch of fetchArticles()) {
        const insertBatch = db.transaction((articles) => {
          for (const a of articles) {
            const thumbsUp = Math.round((a.vote_count + a.vote_sum) / 2);
            const thumbsDown = Math.round((a.vote_count - a.vote_sum) / 2);
            const section = secMap[a.section_id] || {};
            const category = catMap[section.category_id] || {};
            upsert.run(
              a.id, a.title, a.body, a.html_url,
              a.section_id || null, section.name || null,
              section.category_id || null, category.name || null,
              a.vote_sum || 0, a.vote_count || 0, thumbsUp, thumbsDown,
              JSON.stringify(a.label_names || []),
              a.draft ? 1 : 0, a.locale || 'en-us',
              a.created_at, a.updated_at, a.edited_at || a.updated_at,
              new Date().toISOString()
            );
          }
        });
        insertBatch(batch);
        count += batch.length;
        currentHcSync.progress = count;
      }

      currentHcSync.status = 'complete';
      currentHcSync.phase = 'Done';
      currentHcSync.progress = count;
      console.log(`[HC Sync] Synced ${count} articles`);
    } catch (err) {
      console.error('[HC Sync] Error:', err.message);
      currentHcSync.status = 'error';
      currentHcSync.error = err.message;
    }
  });

  return currentHcSync;
}

/**
 * Score all articles and populate hc_article_scores.
 * Crosses articles against existing topic_clusters to find related ticket volume.
 */
async function startAudit() {
  if (currentAudit && currentAudit.status === 'running') {
    throw new Error('Audit already running');
  }
  currentAudit = { status: 'running', phase: 'Scoring articles', progress: 0, total: 0, error: null };

  setImmediate(async () => {
    try {
      const articles = db.prepare('SELECT * FROM hc_articles').all();
      currentAudit.total = articles.length;

      // Get the latest topic clusters to cross-reference
      const latestSync = db.prepare(
        "SELECT id FROM sync_runs WHERE status='completed' ORDER BY completed_at DESC LIMIT 1"
      ).get();
      const clusters = latestSync
        ? db.prepare('SELECT * FROM topic_clusters WHERE sync_run_id=?').all(latestSync.id)
        : [];

      const now = Date.now();
      const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;

      const upsertScore = db.prepare(`
        INSERT INTO hc_article_scores
          (article_id, vote_ratio, related_ticket_count, matched_topics, quality_score, flags, last_scored_at)
        VALUES (?,?,?,?,?,?,?)
        ON CONFLICT(article_id) DO UPDATE SET
          vote_ratio=excluded.vote_ratio,
          related_ticket_count=excluded.related_ticket_count,
          matched_topics=excluded.matched_topics,
          quality_score=excluded.quality_score,
          flags=excluded.flags,
          last_scored_at=excluded.last_scored_at
      `);

      const scoreAll = db.transaction((arts) => {
        for (const article of arts) {
          const voteRatio = article.vote_count > 0
            ? article.thumbs_up / article.vote_count
            : null; // null = no votes yet

          // Find matching topic clusters by keyword overlap
          const titleWords = (article.title || '').toLowerCase().split(/\s+/);
          const matchedTopics = clusters.filter((c) => {
            const label = c.topic_label.toLowerCase();
            return titleWords.some((w) => w.length > 3 && label.includes(w));
          });
          const relatedTicketCount = matchedTopics.reduce((sum, c) => sum + c.ticket_count, 0);

          // Flags
          const flags = [];
          if (article.vote_count === 0) flags.push('no_votes');
          if (voteRatio !== null && voteRatio < 0.6) flags.push('low_vote_ratio');
          const updatedAt = article.updated_at ? new Date(article.updated_at).getTime() : 0;
          if (now - updatedAt > SIX_MONTHS_MS) flags.push('stale');
          if (relatedTicketCount > 10) flags.push('high_ticket_volume');

          // Quality score (0–100):
          // 40% vote ratio (default 0.5 if no votes), 30% ticket coverage (inverse), 20% freshness, 10% has votes
          const vrScore = (voteRatio !== null ? voteRatio : 0.5) * 40;
          const ticketPenalty = Math.min(relatedTicketCount / 50, 1) * 30; // more tickets = more penalty
          const freshnessScore = Math.max(0, 1 - (now - updatedAt) / (365 * 24 * 60 * 60 * 1000)) * 20;
          const hasVotesScore = article.vote_count > 0 ? 10 : 0;
          const qualityScore = vrScore - ticketPenalty + freshnessScore + hasVotesScore;

          upsertScore.run(
            article.id,
            voteRatio,
            relatedTicketCount,
            JSON.stringify(matchedTopics.map((c) => c.topic_label)),
            Math.max(0, Math.min(100, qualityScore)),
            JSON.stringify(flags),
            new Date().toISOString()
          );

          currentAudit.progress++;
        }
      });

      scoreAll(articles);
      currentAudit.status = 'complete';
      currentAudit.phase = 'Done';
      console.log(`[Audit] Scored ${articles.length} articles`);
    } catch (err) {
      console.error('[Audit] Error:', err.message);
      currentAudit.status = 'error';
      currentAudit.error = err.message;
    }
  });

  return currentAudit;
}

module.exports = {
  startHcSync,
  getHcSyncStatus,
  startAudit,
  getAuditStatus,
};
