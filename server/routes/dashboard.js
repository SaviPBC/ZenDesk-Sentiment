const express = require('express');
const router = express.Router();
const db = require('../db');

function calcHealthScore(positive, neutral, negative) {
  const total = positive + neutral + negative;
  if (total === 0) return 0;
  return Math.round(((positive * 100 + neutral * 50 + negative * 0) / total) * 10) / 10;
}

/**
 * Calculate the number of business minutes between two ISO timestamps,
 * respecting the configured timezone. bhStart/bhEnd are local hours (e.g. 9, 17).
 * workDays is an array of day-of-week integers where 0=Sun, 1=Mon … 6=Sat.
 */
function calcBusinessMinutes(startISO, endISO, bhStart, bhEnd, workDays, timezone) {
  if (!startISO || !endISO) return null;
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (!(end > start)) return 0;

  // Returns the offset "local - UTC" in ms for a given instant in the timezone.
  // Uses the toLocaleString trick which handles DST correctly.
  function tzShiftMs(d) {
    try {
      const utcMs = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' })).getTime();
      const localMs = new Date(d.toLocaleString('en-US', { timeZone: timezone || 'UTC' })).getTime();
      return localMs - utcMs;
    } catch { return 0; }
  }

  let total = 0;
  const cur = new Date(start);

  while (cur < end) {
    const shift = tzShiftMs(cur);
    // Shift cur into "local space" so getUTCDay/getUTCHours reflect local time
    const localCur = new Date(cur.getTime() + shift);
    const dow = localCur.getUTCDay();

    if (workDays.includes(dow)) {
      // Build UTC timestamps for the local business-hour window this day
      const localBhStart = new Date(localCur);
      localBhStart.setUTCHours(bhStart, 0, 0, 0);
      const bhStartUtc = new Date(localBhStart.getTime() - shift);

      const localBhEnd = new Date(localCur);
      localBhEnd.setUTCHours(bhEnd, 0, 0, 0);
      const bhEndUtc = new Date(localBhEnd.getTime() - shift);

      const sliceStart = cur > bhStartUtc ? cur : bhStartUtc;
      const sliceEnd = end < bhEndUtc ? end : bhEndUtc;

      if (sliceEnd > sliceStart) {
        total += (sliceEnd - sliceStart) / 60000;
      }
    }

    // Advance cur to start of next local calendar day (handles DST transitions)
    const localNextMidnight = new Date(localCur);
    localNextMidnight.setUTCDate(localNextMidnight.getUTCDate() + 1);
    localNextMidnight.setUTCHours(0, 0, 0, 0);
    const nextApproxUtc = new Date(localNextMidnight.getTime() - shift);
    const newShift = tzShiftMs(nextApproxUtc);
    cur.setTime(localNextMidnight.getTime() - newShift);
  }

  return Math.round(total);
}

function getBhConfig() {
  const get = (key) => db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value;
  const bhStart = parseInt(get('bh_start_hour') || '9', 10);
  const bhEnd = parseInt(get('bh_end_hour') || '17', 10);
  const workDays = (get('bh_work_days') || '1,2,3,4,5').split(',').map(Number);
  const timezone = get('bh_timezone') || 'UTC';
  return { bhStart, bhEnd, workDays, timezone };
}

const VALID_CHANNELS = ['web', 'email', 'voice', 'chat', 'api', 'mobile'];

// GET /api/dashboard?from=&to=&channel=
router.get('/', (req, res) => {
  const { from, to, channel } = req.query;

  const dateFilter = from && to
    ? `AND t.created_at >= '${from}' AND t.created_at <= '${to}T23:59:59'`
    : '';

  const channelFilter = channel && VALID_CHANNELS.includes(channel)
    ? `AND t.channel = '${channel}'`
    : '';

  // Sentiment breakdown
  const sentimentRows = db.prepare(`
    SELECT sr.sentiment, COUNT(*) as count
    FROM sentiment_results sr
    JOIN tickets t ON t.id = sr.ticket_id
    WHERE 1=1 ${dateFilter} ${channelFilter}
    GROUP BY sr.sentiment
  `).all();

  const sentimentMap = { positive: 0, neutral: 0, negative: 0 };
  for (const row of sentimentRows) {
    if (sentimentMap[row.sentiment] !== undefined) {
      sentimentMap[row.sentiment] = row.count;
    }
  }

  const healthScore = calcHealthScore(
    sentimentMap.positive,
    sentimentMap.neutral,
    sentimentMap.negative
  );

  // Total tickets
  const totalTickets = db.prepare(`
    SELECT COUNT(*) as count FROM tickets t WHERE 1=1 ${dateFilter} ${channelFilter}
  `).get();

  // CSAT average
  const csatRow = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN sr.score='good' THEN 1 ELSE 0 END) as good
    FROM satisfaction_ratings sr
    JOIN tickets t ON t.id = sr.ticket_id
    WHERE sr.score IN ('good','bad') ${dateFilter} ${channelFilter}
  `).get();

  const csatAvg = csatRow.total > 0
    ? Math.round((csatRow.good / csatRow.total) * 1000) / 10
    : null;

  // Volume by channel
  const channelRows = db.prepare(`
    SELECT channel, COUNT(*) as count
    FROM tickets t
    WHERE channel IS NOT NULL ${dateFilter} ${channelFilter}
    GROUP BY channel
    ORDER BY count DESC
  `).all();

  // Performance metrics — compute in business hours from timestamps
  const { bhStart, bhEnd, workDays, timezone } = getBhConfig();

  const ticketTimestamps = db.prepare(`
    SELECT t.created_at, t.solved_at, tm.first_reply_time_minutes
    FROM tickets t
    LEFT JOIN ticket_metrics tm ON tm.ticket_id = t.id
    WHERE t.solved_at IS NOT NULL ${dateFilter} ${channelFilter}
  `).all();

  let resolutionBhMinutes = null;
  let firstReplyBhMinutes = null;

  if (ticketTimestamps.length > 0) {
    const resTimes = ticketTimestamps
      .map((r) => calcBusinessMinutes(r.created_at, r.solved_at, bhStart, bhEnd, workDays, timezone))
      .filter((v) => v !== null && v >= 0);

    if (resTimes.length > 0) {
      resolutionBhMinutes = Math.round(resTimes.reduce((a, b) => a + b, 0) / resTimes.length);
    }

    const replyTimes = ticketTimestamps
      .filter((r) => r.first_reply_time_minutes !== null && r.first_reply_time_minutes >= 0)
      .map((r) => {
        const firstReplyAt = new Date(new Date(r.created_at).getTime() + r.first_reply_time_minutes * 60000).toISOString();
        return calcBusinessMinutes(r.created_at, firstReplyAt, bhStart, bhEnd, workDays, timezone);
      })
      .filter((v) => v !== null && v >= 0);

    if (replyTimes.length > 0) {
      firstReplyBhMinutes = Math.round(replyTimes.reduce((a, b) => a + b, 0) / replyTimes.length);
    }
  }

  // Top categories / subcategories
  const topCategories = db.prepare(`
    SELECT
      category,
      subcategory,
      COUNT(*) as count
    FROM tickets t
    WHERE category IS NOT NULL AND category != '' ${dateFilter} ${channelFilter}
    GROUP BY category, subcategory
    ORDER BY count DESC
    LIMIT 10
  `).all();

  // Top topics (from latest sync run in date range)
  const latestRun = db.prepare(`
    SELECT id FROM sync_runs
    WHERE status='completed'
    ORDER BY completed_at DESC LIMIT 1
  `).get();

  let topTopics = [];
  if (latestRun) {
    topTopics = db.prepare(`
      SELECT topic_label, ticket_count, example_ticket_ids
      FROM topic_clusters
      WHERE sync_run_id=?
      ORDER BY ticket_count DESC
      LIMIT 10
    `).all(latestRun.id);
  }

  // Correlation data: per-channel avg resolution vs avg sentiment score
  const correlationRows = db.prepare(`
    SELECT
      t.channel,
      AVG(tm.resolution_time_minutes) as avg_resolution,
      AVG(CASE sr.sentiment WHEN 'positive' THEN 1.0 WHEN 'neutral' THEN 0.5 ELSE 0.0 END) as avg_sentiment
    FROM tickets t
    LEFT JOIN ticket_metrics tm ON tm.ticket_id = t.id
    LEFT JOIN sentiment_results sr ON sr.ticket_id = t.id
    WHERE t.channel IS NOT NULL ${dateFilter} ${channelFilter}
    GROUP BY t.channel
    HAVING COUNT(*) >= 2
  `).all();

  res.json({
    healthScore,
    sentimentBreakdown: sentimentMap,
    csatAvg,
    volumeByChannel: channelRows,
    avgResolutionTime: resolutionBhMinutes,
    avgFirstReplyTime: firstReplyBhMinutes,
    topTopics: topTopics.map((t) => ({
      ...t,
      example_ticket_ids: JSON.parse(t.example_ticket_ids || '[]'),
    })),
    topCategories,
    totalTickets: totalTickets.count,
    correlationData: correlationRows,
  });
});

module.exports = router;
