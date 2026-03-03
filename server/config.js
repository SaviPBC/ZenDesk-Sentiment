require('dotenv').config();

function required(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function optional(name, fallback) {
  return process.env[name] || fallback;
}

module.exports = {
  port: parseInt(optional('PORT', '3001'), 10),
  dbPath: optional('DB_PATH', './data/analytics.db'),
  // These can be bootstrapped from env, but are also stored in DB settings table
  zendesk: {
    subdomain: optional('ZENDESK_SUBDOMAIN', ''),
    email: optional('ZENDESK_EMAIL', ''),
    apiToken: optional('ZENDESK_API_TOKEN', ''),
  },
  anthropicApiKey: optional('ANTHROPIC_API_KEY', ''),
};
