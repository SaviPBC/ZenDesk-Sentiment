const Anthropic = require('@anthropic-ai/sdk');
const db = require('../db');

let currentDisc = null;

function getDiscoverabilityStatus() {
  return currentDisc;
}

/**
 * Analyze article titles against how users phrase support tickets.
 * Suggests better titles, additional labels, and related article links.
 */
async function startDiscoverabilityAnalysis() {
  if (currentDisc && currentDisc.status === 'running') {
    throw new Error('Discoverability analysis already running');
  }
  currentDisc = { status: 'running', phase: 'Loading data', progress: 0, total: 0, error: null };

  setImmediate(async () => {
    try {
      const apiKeyRow = db.prepare("SELECT value FROM settings WHERE key='anthropic_api_key'").get();
      if (!apiKeyRow) throw new Error('Anthropic API key not configured');

      const articles = db.prepare('SELECT * FROM hc_articles WHERE draft=0').all();
      if (!articles.length) throw new Error('No articles found. Sync Help Center first.');

      // Get ticket subjects as proxy for user search language
      const ticketSubjects = db.prepare('SELECT subject FROM tickets ORDER BY created_at DESC LIMIT 500').all()
        .map((t) => t.subject).filter(Boolean);

      // Get latest topic clusters
      const latestSync = db.prepare(
        "SELECT id FROM sync_runs WHERE status='completed' ORDER BY completed_at DESC LIMIT 1"
      ).get();
      const clusters = latestSync
        ? db.prepare('SELECT topic_label, ticket_count FROM topic_clusters WHERE sync_run_id=?').all(latestSync.id)
        : [];

      currentDisc.total = articles.length;
      currentDisc.phase = 'Analyzing discoverability';

      const client = new Anthropic({ apiKey: apiKeyRow.value });

      // Process in batches of 10 articles
      const BATCH = 10;
      const allSuggestions = [];

      for (let i = 0; i < articles.length; i += BATCH) {
        const batch = articles.slice(i, i + BATCH);
        const articleList = batch.map((a) => ({
          id: a.id,
          title: a.title,
          labels: JSON.parse(a.label_names || '[]'),
          section: a.section_title,
          category: a.category_title,
        }));

        const sampleSubjects = ticketSubjects.slice(0, 100).join('\n');
        const clusterList = clusters.map((c) => `"${c.topic_label}" (${c.ticket_count} tickets)`).join('\n');

        const prompt = `You are a Help Center SEO and UX specialist. Analyze these Help Center articles for discoverability issues.

ARTICLES TO ANALYZE:
${JSON.stringify(articleList, null, 2)}

HOW CUSTOMERS PHRASE THEIR QUESTIONS (recent ticket subjects):
${sampleSubjects}

TOP SUPPORT TOPICS (ticket clusters):
${clusterList}

For each article, assess:
1. Does the title match how customers phrase questions?
2. Are labels/tags missing that would improve search?
3. Which other articles should be linked as "related"?

Return JSON array (one object per article):
[{
  "article_id": 123,
  "current_title": "...",
  "suggested_title": "..." or null if fine,
  "suggested_labels": ["label1", "label2"] or [],
  "suggested_related_ids": [456, 789] or [],
  "reasoning": "One sentence explanation of changes"
}]

Only suggest changes where there is a clear improvement. Respond ONLY with valid JSON array, no markdown.`;

        const response = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        });

        let suggestions = [];
        try {
          const text = response.content[0].text.trim();
          suggestions = JSON.parse(text);
        } catch {
          const match = response.content[0].text.match(/\[[\s\S]*\]/);
          if (match) suggestions = JSON.parse(match[0]);
        }

        allSuggestions.push(...suggestions);
        currentDisc.progress = Math.min(i + BATCH, articles.length);
      }

      currentDisc.phase = 'Saving suggestions';

      // Clear old and insert new
      db.prepare('DELETE FROM hc_discoverability').run();
      const insert = db.prepare(`
        INSERT INTO hc_discoverability
          (article_id, current_title, suggested_title, suggested_labels, suggested_related_ids, reasoning, created_at)
        VALUES (?,?,?,?,?,?,?)
      `);
      const insertAll = db.transaction((rows) => {
        for (const s of rows) {
          // Only save if there are actual suggestions
          const hasChanges = s.suggested_title || (s.suggested_labels && s.suggested_labels.length > 0) || (s.suggested_related_ids && s.suggested_related_ids.length > 0);
          if (hasChanges) {
            insert.run(
              s.article_id, s.current_title, s.suggested_title || null,
              JSON.stringify(s.suggested_labels || []),
              JSON.stringify(s.suggested_related_ids || []),
              s.reasoning || '',
              new Date().toISOString()
            );
          }
        }
      });
      insertAll(allSuggestions);

      currentDisc.status = 'complete';
      currentDisc.phase = 'Done';
      console.log(`[Discoverability] Generated suggestions for ${allSuggestions.length} articles`);
    } catch (err) {
      console.error('[Discoverability] Error:', err.message);
      currentDisc.status = 'error';
      currentDisc.error = err.message;
    }
  });

  return currentDisc;
}

module.exports = { startDiscoverabilityAnalysis, getDiscoverabilityStatus };
