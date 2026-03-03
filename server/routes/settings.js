const express = require('express');
const router = express.Router();
const db = require('../db');
const { testConnection, getCredentials, buildClient } = require('../services/zendeskClient');

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'
  ).run(key, value);
}

// GET /api/settings
router.get('/', (req, res) => {
  const subdomain = getSetting('zendesk_subdomain') || '';
  const email = getSetting('zendesk_email') || '';
  const rawToken = getSetting('zendesk_api_token') || '';
  const anthropicKey = getSetting('anthropic_api_key') || '';

  // Mask API tokens
  const maskedToken = rawToken.length > 4 ? '•'.repeat(rawToken.length - 4) + rawToken.slice(-4) : rawToken;
  const maskedAnthropicKey = anthropicKey.length > 4
    ? '•'.repeat(Math.min(20, anthropicKey.length - 4)) + anthropicKey.slice(-4)
    : anthropicKey;

  res.json({
    zendesk_subdomain: subdomain,
    zendesk_email: email,
    zendesk_api_token: maskedToken,
    anthropic_api_key: maskedAnthropicKey,
    has_zendesk_token: rawToken.length > 0,
    has_anthropic_key: anthropicKey.length > 0,
    category_field_id: getSetting('category_field_id') || '',
    subcategory_field_id: getSetting('subcategory_field_id') || '',
    bh_start_hour: getSetting('bh_start_hour') || '9',
    bh_end_hour: getSetting('bh_end_hour') || '17',
    bh_work_days: getSetting('bh_work_days') || '1,2,3,4,5',
    bh_timezone: getSetting('bh_timezone') || 'UTC',
  });
});

// PUT /api/settings
router.put('/', (req, res) => {
  const {
    zendesk_subdomain, zendesk_email, zendesk_api_token, anthropic_api_key,
    category_field_id, subcategory_field_id,
    bh_start_hour, bh_end_hour, bh_work_days, bh_timezone,
  } = req.body;

  if (zendesk_subdomain !== undefined) setSetting('zendesk_subdomain', zendesk_subdomain);
  if (zendesk_email !== undefined) setSetting('zendesk_email', zendesk_email);
  if (zendesk_api_token !== undefined && !zendesk_api_token.includes('•')) {
    setSetting('zendesk_api_token', zendesk_api_token);
  }
  if (anthropic_api_key !== undefined && !anthropic_api_key.includes('•')) {
    setSetting('anthropic_api_key', anthropic_api_key);
  }
  if (category_field_id !== undefined) setSetting('category_field_id', category_field_id);
  if (subcategory_field_id !== undefined) setSetting('subcategory_field_id', subcategory_field_id);
  if (bh_start_hour !== undefined) setSetting('bh_start_hour', String(bh_start_hour));
  if (bh_end_hour !== undefined) setSetting('bh_end_hour', String(bh_end_hour));
  if (bh_work_days !== undefined) setSetting('bh_work_days', bh_work_days);
  if (bh_timezone !== undefined) setSetting('bh_timezone', bh_timezone);

  res.json({ success: true });
});

// POST /api/settings/test
router.post('/test', async (req, res, next) => {
  try {
    // Allow passing credentials directly (before saving) or use stored ones
    const { zendesk_subdomain, zendesk_email, zendesk_api_token } = req.body;

    let credentials;
    if (zendesk_subdomain && zendesk_email && zendesk_api_token && !zendesk_api_token.includes('•')) {
      credentials = {
        subdomain: zendesk_subdomain,
        email: zendesk_email,
        apiToken: zendesk_api_token,
      };
    } else {
      credentials = getCredentials();
    }

    const result = await testConnection(credentials);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
