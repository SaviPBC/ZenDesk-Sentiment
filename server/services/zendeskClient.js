const axios = require('axios');
const db = require('../db');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCredentials() {
  const subdomain = db.prepare("SELECT value FROM settings WHERE key='zendesk_subdomain'").get();
  const email = db.prepare("SELECT value FROM settings WHERE key='zendesk_email'").get();
  const apiToken = db.prepare("SELECT value FROM settings WHERE key='zendesk_api_token'").get();

  if (!subdomain || !email || !apiToken) {
    throw new Error('ZenDesk credentials not configured. Please save settings first.');
  }

  return {
    subdomain: subdomain.value,
    email: email.value,
    apiToken: apiToken.value,
  };
}

function buildClient(credentials) {
  const { subdomain, email, apiToken } = credentials;
  const auth = Buffer.from(`${email}/token:${apiToken}`).toString('base64');

  return axios.create({
    baseURL: `https://${subdomain}.zendesk.com/api/v2`,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  });
}

async function requestWithRateLimit(client, config) {
  while (true) {
    try {
      const response = await client(config);

      // Check rate limit headers proactively
      const remaining = response.headers['x-rate-limit-remaining'];
      const resetAt = response.headers['x-rate-limit-reset'];
      if (remaining !== undefined && parseInt(remaining, 10) < 5 && resetAt) {
        const resetTime = parseInt(resetAt, 10) * 1000;
        const waitMs = resetTime - Date.now() + 500;
        if (waitMs > 0) {
          console.log(`[ZenDesk] Rate limit nearly exhausted, waiting ${waitMs}ms`);
          await sleep(waitMs);
        }
      }

      return response;
    } catch (err) {
      if (err.response && err.response.status === 429) {
        const retryAfter = parseInt(err.response.headers['retry-after'] || '60', 10);
        console.log(`[ZenDesk] 429 received, retrying after ${retryAfter}s`);
        await sleep(retryAfter * 1000);
        // retry loop continues
      } else {
        console.error(`[ZenDesk] ${err.response?.status} on ${config.method} ${config.url}`, JSON.stringify(err.response?.data));
        throw err;
      }
    }
  }
}

/**
 * Test the ZenDesk connection by fetching the current user.
 */
async function testConnection(credentials) {
  const client = buildClient(credentials);
  try {
    const response = await requestWithRateLimit(client, { method: 'GET', url: '/users/me.json' });
    return { success: true, user: response.data.user };
  } catch (err) {
    const message = err.response?.data?.error || err.message;
    return { success: false, error: message };
  }
}

/**
 * Fetch all tickets in the given date range using the incremental cursor export.
 * The search API is capped at 1000 results; incremental export has no such limit.
 * Yields arrays of ticket objects page by page, filtered to the requested date range.
 */
async function* fetchTickets(dateFrom, dateTo) {
  const credentials = getCredentials();
  const client = buildClient(credentials);

  const startTime = Math.floor(new Date(dateFrom).getTime() / 1000);
  const endTime = Math.floor(new Date(dateTo + 'T23:59:59').getTime() / 1000);

  let url = `/incremental/tickets/cursor.json`;
  let params = { start_time: startTime };

  while (url) {
    const response = await requestWithRateLimit(client, { method: 'GET', url, params });
    const data = response.data;

    const tickets = (data.tickets || []).filter((t) => {
      const created = Math.floor(new Date(t.created_at).getTime() / 1000);
      return created <= endTime;
    });

    if (tickets.length > 0) {
      yield tickets;
    }

    // If we've passed the end date, stop paginating
    const allPastEnd = (data.tickets || []).every((t) => {
      const created = Math.floor(new Date(t.created_at).getTime() / 1000);
      return created > endTime;
    });

    if (data.end_of_stream || allPastEnd || !data.after_cursor) {
      url = null;
    } else {
      url = `/incremental/tickets/cursor.json`;
      params = { cursor: data.after_cursor };
    }
  }
}

/**
 * Fetch comments for a single ticket.
 */
async function fetchTicketComments(ticketId) {
  const credentials = getCredentials();
  const client = buildClient(credentials);

  const response = await requestWithRateLimit(client, {
    method: 'GET',
    url: `/tickets/${ticketId}/comments.json`,
  });

  return response.data.comments || [];
}

/**
 * Fetch ticket metrics for tickets in the date range.
 * Uses incremental export which paginates by cursor.
 */
async function* fetchTicketMetrics(dateFrom, dateTo) {
  const credentials = getCredentials();
  const client = buildClient(credentials);

  // Ticket metrics are fetched alongside tickets via the ticket_metric endpoint
  // We'll use the search results for ticket IDs, then fetch metrics for each batch
  // For large sets, use the incremental export

  let url = `/incremental/ticket_metric_events.json`;
  const startTime = Math.floor(new Date(dateFrom).getTime() / 1000);
  let params = { start_time: startTime };

  while (url) {
    const response = await requestWithRateLimit(client, { method: 'GET', url, params });
    const data = response.data;

    if (data.ticket_metric_events && data.ticket_metric_events.length > 0) {
      yield data.ticket_metric_events;
    }

    if (!data.end_of_stream && data.next_page) {
      url = data.next_page;
      params = {};
    } else {
      url = null;
    }
  }
}

/**
 * Fetch ticket metric records for specific ticket IDs.
 */
async function fetchTicketMetricsBatch(ticketIds) {
  const credentials = getCredentials();
  const client = buildClient(credentials);

  const metrics = [];
  // Fetch in batches of 100
  for (let i = 0; i < ticketIds.length; i += 100) {
    const batch = ticketIds.slice(i, i + 100);
    for (const ticketId of batch) {
      try {
        const response = await requestWithRateLimit(client, {
          method: 'GET',
          url: `/tickets/${ticketId}/metrics.json`,
        });
        if (response.data.ticket_metric) {
          metrics.push(response.data.ticket_metric);
        }
      } catch (err) {
        // Skip tickets where metrics aren't available
        console.warn(`[ZenDesk] Could not fetch metrics for ticket ${ticketId}:`, err.message);
      }
    }
  }
  return metrics;
}

/**
 * Fetch satisfaction ratings in the date range using cursor-based pagination.
 */
async function* fetchSatisfactionRatings(dateFrom, dateTo) {
  const credentials = getCredentials();
  const client = buildClient(credentials);

  let url = `/satisfaction_ratings.json`;
  let params = {
    start_time: Math.floor(new Date(dateFrom).getTime() / 1000),
    end_time: Math.floor(new Date(dateTo).getTime() / 1000),
  };

  while (url) {
    const response = await requestWithRateLimit(client, { method: 'GET', url, params });
    const data = response.data;

    if (data.satisfaction_ratings && data.satisfaction_ratings.length > 0) {
      yield data.satisfaction_ratings;
    }

    if (data.next_page) {
      url = data.next_page;
      params = {};
    } else {
      url = null;
    }
  }
}

module.exports = {
  testConnection,
  getCredentials,
  buildClient,
  requestWithRateLimit,
  fetchTickets,
  fetchTicketComments,
  fetchTicketMetricsBatch,
  fetchSatisfactionRatings,
};
