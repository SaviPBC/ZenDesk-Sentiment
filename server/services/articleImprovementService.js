const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
const db = require('../db');
const { updateArticle } = require('./guideService');

/**
 * Fetch a URL and return plain text (HTML tags stripped).
 * Returns null if the fetch fails rather than throwing.
 */
async function fetchPageText(url) {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HelpCenterBot/1.0)' },
      maxContentLength: 500000,
    });
    const html = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    // Strip HTML tags and collapse whitespace
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .substring(0, 8000);
  } catch (err) {
    console.warn(`[Improvement] Could not fetch reference URL ${url}: ${err.message}`);
    return null;
  }
}

/**
 * Generate an AI-improved version of an article.
 * Fetches related support tickets to understand what users are confused about.
 * Optionally fetches a reference URL for accuracy context.
 */
async function generateImprovement(articleId, referenceUrl = null) {
  const article = db.prepare('SELECT * FROM hc_articles WHERE id=?').get(articleId);
  if (!article) throw new Error(`Article ${articleId} not found. Sync Help Center first.`);

  const apiKeyRow = db.prepare("SELECT value FROM settings WHERE key='anthropic_api_key'").get();
  if (!apiKeyRow) throw new Error('Anthropic API key not configured');

  // Find related tickets by keyword matching article title
  const titleWords = (article.title || '').toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  let relatedTickets = [];
  if (titleWords.length > 0) {
    const likeClause = titleWords.map(() => 'LOWER(t.subject) LIKE ?').join(' OR ');
    const params = titleWords.map((w) => `%${w}%`);
    relatedTickets = db.prepare(`
      SELECT t.id, t.subject, tc.body as comment
      FROM tickets t
      LEFT JOIN ticket_comments tc ON tc.ticket_id = t.id AND tc.is_public = 1
      WHERE (${likeClause})
      ORDER BY t.created_at DESC
      LIMIT 20
    `).all(...params);
  }

  const client = new Anthropic({ apiKey: apiKeyRow.value });

  // Optionally fetch reference URL for accuracy context
  let referenceContext = '';
  if (referenceUrl) {
    const pageText = await fetchPageText(referenceUrl);
    if (pageText) {
      referenceContext = `\n\nREFERENCE URL FOR ACCURACY (${referenceUrl}):\n${pageText}\n\nUse the above as the authoritative source for facts, steps, and current information.`;
    } else {
      referenceContext = `\n\n(Note: Reference URL ${referenceUrl} could not be fetched — proceeding without it.)`;
    }
  }

  const ticketContext = relatedTickets.length > 0
    ? `\n\nRELATED SUPPORT TICKETS (showing what customers are confused about):\n` +
      relatedTickets.map((t) => `- [#${t.id}] ${t.subject}${t.comment ? ': ' + t.comment.substring(0, 200) : ''}`).join('\n')
    : '';

  const prompt = `You are a technical writer improving a Help Center article. Make it clearer, more complete, and easier to scan.

CURRENT ARTICLE TITLE: ${article.title}

CURRENT ARTICLE BODY (HTML):
${(article.body || '').substring(0, 6000)}${referenceContext}${ticketContext}

Your task:
1. Rewrite the article body as clean HTML. Use <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong> tags. Keep it professional and concise.
2. Suggest an improved title if the current one could be clearer.
3. List 2-4 specific improvements you made.${referenceUrl ? '\n4. Where you used the reference URL to correct or update information, note it specifically.' : ''}

Respond with valid JSON only:
{
  "suggested_title": "...",
  "improved_body": "<h2>...</h2>...",
  "improvement_notes": "1. Added step-by-step format. 2. ..."
}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  });

  let result;
  try {
    const text = response.content[0].text.trim();
    result = JSON.parse(text);
  } catch {
    const match = response.content[0].text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Failed to parse AI response');
    result = JSON.parse(match[0]);
  }

  // Save improvement record
  const insert = db.prepare(`
    INSERT INTO hc_improvements (article_id, original_title, suggested_title, original_body, improved_body, improvement_notes, status, created_at)
    VALUES (?,?,?,?,?,?,'pending',?)
  `);
  const info = insert.run(
    articleId,
    article.title,
    result.suggested_title || article.title,
    article.body,
    result.improved_body,
    result.improvement_notes,
    new Date().toISOString()
  );

  return db.prepare('SELECT * FROM hc_improvements WHERE id=?').get(info.lastInsertRowid);
}

/**
 * Publish an approved improvement back to Zendesk Guide.
 */
async function publishImprovement(improvementId) {
  const imp = db.prepare('SELECT * FROM hc_improvements WHERE id=?').get(improvementId);
  if (!imp) throw new Error('Improvement not found');
  if (imp.status !== 'approved') throw new Error('Only approved improvements can be published');

  const article = db.prepare('SELECT * FROM hc_articles WHERE id=?').get(imp.article_id);
  if (!article) throw new Error('Article not found');

  await updateArticle(article.id, article.locale || 'en-us', imp.suggested_title, imp.improved_body);

  db.prepare("UPDATE hc_improvements SET status='published', reviewed_at=? WHERE id=?").run(
    new Date().toISOString(), improvementId
  );

  // Update local article record
  db.prepare('UPDATE hc_articles SET title=?, body=?, updated_at=? WHERE id=?').run(
    imp.suggested_title, imp.improved_body, new Date().toISOString(), article.id
  );

  return { success: true };
}

module.exports = { generateImprovement, publishImprovement };
