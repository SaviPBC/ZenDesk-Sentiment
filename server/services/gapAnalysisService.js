const Anthropic = require('@anthropic-ai/sdk');
const db = require('../db');

let currentGap = null;

function getGapStatus() {
  return currentGap;
}

/**
 * Cross-reference ticket topic clusters against HC article titles to find gaps.
 * Uses Claude to suggest article titles and outlines for uncovered topics.
 */
async function startGapAnalysis() {
  if (currentGap && currentGap.status === 'running') {
    throw new Error('Gap analysis already running');
  }
  currentGap = { status: 'running', phase: 'Loading data', progress: 0, total: 0, error: null };

  setImmediate(async () => {
    try {
      // Get latest topic clusters
      const latestSync = db.prepare(
        "SELECT id FROM sync_runs WHERE status='completed' ORDER BY completed_at DESC LIMIT 1"
      ).get();

      if (!latestSync) {
        throw new Error('No completed ticket sync found. Sync tickets first.');
      }

      const apiKeyRow = db.prepare("SELECT value FROM settings WHERE key='anthropic_api_key'").get();
      if (!apiKeyRow) throw new Error('Anthropic API key not configured');
      const client = new Anthropic({ apiKey: apiKeyRow.value });

      let clusters = db.prepare('SELECT * FROM topic_clusters WHERE sync_run_id=?').all(latestSync.id);

      // No pre-built clusters — derive them on the fly from raw ticket subjects
      if (!clusters.length) {
        currentGap.phase = 'Clustering ticket subjects (no prior topic analysis found)';
        const subjects = db.prepare('SELECT subject FROM tickets WHERE subject IS NOT NULL ORDER BY created_at DESC LIMIT 300').all()
          .map((t) => t.subject);

        if (!subjects.length) throw new Error('No tickets found. Sync tickets first.');

        const clusterPrompt = `You are a customer support analyst. Identify 8-15 distinct topic clusters from these support ticket subjects.

${subjects.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Return ONLY a JSON array:
[{"topic_label": "Billing Issues", "ticket_count": 15, "example_ticket_ids": []}]`;

        const clusterResp = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
          messages: [{ role: 'user', content: clusterPrompt }],
        });

        try {
          const text = clusterResp.content[0].text.trim();
          clusters = JSON.parse(text);
        } catch {
          const match = clusterResp.content[0].text.match(/\[[\s\S]*\]/);
          if (match) clusters = JSON.parse(match[0]);
        }
      }

      if (!clusters.length) throw new Error('Could not determine ticket topics.');

      currentGap.total = clusters.length;
      currentGap.phase = 'Comparing to Help Center articles';

      const articles = db.prepare('SELECT id, title, label_names FROM hc_articles WHERE draft=0').all();
      const articleTitles = articles.map((a) => ({
        id: a.id,
        title: a.title || '',
        labels: JSON.parse(a.label_names || '[]'),
      }));

      // Build a text summary of existing article coverage
      const coverageText = articleTitles
        .map((a) => `[${a.id}] ${a.title} (labels: ${a.labels.join(', ')})`)
        .join('\n');

      const clusterText = clusters
        .map((c) => `- "${c.topic_label}" (${c.ticket_count} tickets)`)
        .join('\n');

      currentGap.phase = 'Running AI gap analysis';

      const prompt = `You are a Help Center content strategist. Below are support ticket topics from our customers, and a list of existing Help Center articles.

TICKET TOPICS (sorted by volume):
${clusterText}

EXISTING HELP CENTER ARTICLES:
${coverageText || '(none)'}

For each ticket topic, determine if it is adequately covered by an existing article. A topic is covered if an article's title or labels clearly address it.

Return a JSON array of gap objects. Only include topics that are NOT adequately covered (gaps). For each gap:
{
  "topic_label": "...",
  "ticket_count": 123,
  "related_article_ids": [array of existing article IDs that partially cover it, or empty],
  "gap_score": 0-100 (ticket_count normalized, 100 = highest volume),
  "suggested_title": "...",
  "suggested_outline": "Brief 2-3 sentence description of what the article should cover"
}

Sort by gap_score descending. Respond ONLY with valid JSON array, no markdown.`;

      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      });

      let gaps = [];
      try {
        const text = response.content[0].text.trim();
        gaps = JSON.parse(text);
      } catch {
        const match = response.content[0].text.match(/\[[\s\S]*\]/);
        if (match) gaps = JSON.parse(match[0]);
      }

      currentGap.phase = 'Saving gaps';

      // Clear old gaps and insert new
      db.prepare('DELETE FROM hc_gaps').run();
      const insert = db.prepare(`
        INSERT INTO hc_gaps (topic_label, ticket_count, related_article_ids, gap_score, suggested_title, suggested_outline, created_at)
        VALUES (?,?,?,?,?,?,?)
      `);
      const insertAll = db.transaction((rows) => {
        for (const g of rows) {
          insert.run(
            g.topic_label,
            g.ticket_count,
            JSON.stringify(g.related_article_ids || []),
            g.gap_score || 0,
            g.suggested_title || '',
            g.suggested_outline || '',
            new Date().toISOString()
          );
        }
      });
      insertAll(gaps);

      currentGap.status = 'complete';
      currentGap.phase = 'Done';
      currentGap.progress = gaps.length;
      console.log(`[Gap Analysis] Found ${gaps.length} gaps`);
    } catch (err) {
      console.error('[Gap Analysis] Error:', err.message);
      currentGap.status = 'error';
      currentGap.error = err.message;
    }
  });

  return currentGap;
}

module.exports = { startGapAnalysis, getGapStatus };
