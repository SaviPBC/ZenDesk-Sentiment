const { getCredentials, buildClient, requestWithRateLimit } = require('./zendeskClient');

/**
 * Fetch all Help Center categories.
 */
async function fetchCategories() {
  const credentials = getCredentials();
  const client = buildClient(credentials);
  const categories = [];
  let url = '/help_center/categories.json';
  let params = { per_page: 100 };

  while (url) {
    const response = await requestWithRateLimit(client, { method: 'GET', url, params });
    const data = response.data;
    categories.push(...(data.categories || []));
    if (data.next_page) {
      url = data.next_page;
      params = {};
    } else {
      url = null;
    }
  }
  return categories;
}

/**
 * Fetch all Help Center sections.
 */
async function fetchSections() {
  const credentials = getCredentials();
  const client = buildClient(credentials);
  const sections = [];
  let url = '/help_center/sections.json';
  let params = { per_page: 100 };

  while (url) {
    const response = await requestWithRateLimit(client, { method: 'GET', url, params });
    const data = response.data;
    sections.push(...(data.sections || []));
    if (data.next_page) {
      url = data.next_page;
      params = {};
    } else {
      url = null;
    }
  }
  return sections;
}

/**
 * Fetch all Help Center articles with pagination.
 * Yields arrays of article objects.
 */
async function* fetchArticles() {
  const credentials = getCredentials();
  const client = buildClient(credentials);
  let url = '/help_center/articles.json';
  let params = { per_page: 30, sort_by: 'created_at', sort_order: 'asc' };

  while (url) {
    const response = await requestWithRateLimit(client, { method: 'GET', url, params });
    const data = response.data;
    if (data.articles && data.articles.length > 0) {
      yield data.articles;
    }
    if (data.next_page) {
      url = data.next_page;
      params = {};
    } else {
      url = null;
    }
  }
}

/**
 * Update an article's title and/or body via the Guide Translations API.
 */
async function updateArticle(articleId, locale, title, body) {
  const credentials = getCredentials();
  const client = buildClient(credentials);

  const response = await requestWithRateLimit(client, {
    method: 'PUT',
    url: `/help_center/articles/${articleId}/translations/${locale}.json`,
    data: { translation: { title, body } },
  });
  return response.data.translation;
}

module.exports = {
  fetchCategories,
  fetchSections,
  fetchArticles,
  updateArticle,
};
