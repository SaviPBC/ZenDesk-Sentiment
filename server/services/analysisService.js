const Anthropic = require('@anthropic-ai/sdk');
const Sentiment = require('sentiment');
const db = require('../db');

const MODEL = 'claude-haiku-4-5-20251001';
const sentimentAnalyzer = new Sentiment();

function getApiKey() {
  // Try DB first, fallback to env
  const row = db.prepare("SELECT value FROM settings WHERE key='anthropic_api_key'").get();
  if (row && row.value) return row.value;
  return process.env.ANTHROPIC_API_KEY || null;
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Local AFINN-based sentiment scoring (no API required).
 * Returns { ticket_id, sentiment, confidence }.
 */
function scoreLocally(ticket) {
  const text = (ticket.latestPublicComment || ticket.subject || '').slice(0, 1000);
  const result = sentimentAnalyzer.analyze(text);

  // comparative score is normalized by word count: typically -5 to +5
  const score = result.comparative;
  let sentiment, confidence;

  if (score > 0.1) {
    sentiment = 'positive';
    confidence = Math.min(1, 0.5 + score * 0.1);
  } else if (score < -0.1) {
    sentiment = 'negative';
    confidence = Math.min(1, 0.5 + Math.abs(score) * 0.1);
  } else {
    sentiment = 'neutral';
    confidence = 0.6;
  }

  return { ticket_id: ticket.id, sentiment, confidence };
}

/**
 * Run batch sentiment analysis on an array of tickets.
 * Uses local AFINN scoring if no Anthropic API key is configured,
 * otherwise falls back to the Claude API.
 * Each ticket should have { id, subject, latestPublicComment }.
 * Returns array of { ticket_id, sentiment, confidence }.
 */
async function analyzeSentimentBatch(tickets) {
  const apiKey = getApiKey();

  // Use local scoring if no API key available
  if (!apiKey) {
    console.log('[Analysis] No Anthropic key — using local AFINN sentiment scoring');
    return tickets.map(scoreLocally);
  }

  const client = new Anthropic({ apiKey });
  const results = [];
  const chunks = chunkArray(tickets, 30);

  for (const chunk of chunks) {
    const ticketLines = chunk.map((t) => {
      const text = (t.latestPublicComment || t.subject || '').slice(0, 500);
      return `${t.id}: ${text}`;
    });

    const prompt = `You are a customer support sentiment analyzer. Analyze the sentiment of each customer support ticket excerpt below.

For each ticket (identified by its ID), classify the sentiment as exactly one of: positive, neutral, or negative.
Also provide a confidence score between 0.0 and 1.0.

Tickets:
${ticketLines.join('\n')}

Respond with ONLY a valid JSON array in this exact format (no explanation, no markdown, just JSON):
[{"ticket_id": 123, "sentiment": "positive", "confidence": 0.85}, ...]`;

    try {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = message.content[0]?.text || '';
      const jsonText = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();

      let parsed;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        console.warn('[Analysis] Failed to parse sentiment JSON, falling back to local scoring for chunk');
        results.push(...chunk.map(scoreLocally));
        continue;
      }

      for (const item of parsed) {
        if (item.ticket_id && item.sentiment) {
          results.push({
            ticket_id: item.ticket_id,
            sentiment: item.sentiment,
            confidence: item.confidence ?? 0.5,
          });
        }
      }
    } catch (err) {
      console.warn('[Analysis] Claude API error, falling back to local scoring for chunk:', err.message);
      results.push(...chunk.map(scoreLocally));
    }
  }

  return results;
}

/**
 * Run topic clustering on an array of ticket subjects.
 * Returns array of { topic_label, ticket_count, example_ticket_ids }.
 */
async function clusterTopics(tickets) {
  const apiKey = getApiKey();

  if (!apiKey) {
    console.log('[Analysis] No Anthropic key — skipping topic clustering');
    return [];
  }

  const client = new Anthropic({ apiKey });

  const subset = tickets.slice(0, 200);
  const lines = subset.map((t) => `${t.id}: ${(t.subject || '').slice(0, 150)}`);

  const prompt = `You are a customer support analyst. Analyze the following support ticket subjects and identify 5-10 distinct recurring topic clusters.

Tickets:
${lines.join('\n')}

For each topic cluster:
- Give it a clear, concise label (e.g., "Billing Issues", "Login Problems", "Feature Requests")
- Count how many tickets fall into it
- List up to 5 example ticket IDs from the list above

Respond with ONLY a valid JSON array in this exact format (no explanation, no markdown, just JSON):
[{"topic_label": "Billing Issues", "ticket_count": 15, "example_ticket_ids": [101, 102, 103]}, ...]`;

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0]?.text || '';
    const jsonText = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();

    try {
      return JSON.parse(jsonText);
    } catch {
      console.warn('[Analysis] Failed to parse topic cluster JSON');
      return [];
    }
  } catch (err) {
    console.error('[Analysis] Topic cluster error:', err.message);
    return [];
  }
}

module.exports = { analyzeSentimentBatch, clusterTopics };
