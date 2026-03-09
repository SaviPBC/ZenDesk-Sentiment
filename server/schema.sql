CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  tickets_fetched INTEGER DEFAULT 0,
  error TEXT
);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY,
  subject TEXT,
  description TEXT,
  status TEXT,
  channel TEXT,
  created_at TEXT,
  updated_at TEXT,
  solved_at TEXT,
  requester_id INTEGER,
  assignee_id INTEGER,
  tags TEXT,
  category TEXT,
  subcategory TEXT,
  synced_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ticket_comments (
  id INTEGER PRIMARY KEY,
  ticket_id INTEGER NOT NULL,
  body TEXT,
  author_id INTEGER,
  created_at TEXT,
  is_public INTEGER DEFAULT 1,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id)
);

CREATE TABLE IF NOT EXISTS ticket_metrics (
  ticket_id INTEGER PRIMARY KEY,
  resolution_time_minutes INTEGER,
  first_reply_time_minutes INTEGER,
  reply_count INTEGER,
  reopens INTEGER,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id)
);

CREATE TABLE IF NOT EXISTS satisfaction_ratings (
  id INTEGER PRIMARY KEY,
  ticket_id INTEGER,
  score TEXT,
  comment TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS sentiment_results (
  ticket_id INTEGER PRIMARY KEY,
  sentiment TEXT NOT NULL,
  confidence REAL,
  analyzed_at TEXT NOT NULL,
  model_used TEXT NOT NULL,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id)
);

CREATE TABLE IF NOT EXISTS topic_clusters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_run_id INTEGER,
  topic_label TEXT NOT NULL,
  ticket_count INTEGER NOT NULL,
  example_ticket_ids TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (sync_run_id) REFERENCES sync_runs(id)
);

CREATE TABLE IF NOT EXISTS insights_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  channel TEXT,
  ticket_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  top_sentiments TEXT,
  recommendations TEXT,
  summary TEXT,
  error TEXT
);

-- Help Center tables
CREATE TABLE IF NOT EXISTS hc_articles (
  id INTEGER PRIMARY KEY,
  title TEXT,
  body TEXT,
  url TEXT,
  section_id INTEGER,
  section_title TEXT,
  category_id INTEGER,
  category_title TEXT,
  vote_sum INTEGER DEFAULT 0,
  vote_count INTEGER DEFAULT 0,
  thumbs_up INTEGER DEFAULT 0,
  thumbs_down INTEGER DEFAULT 0,
  label_names TEXT,
  draft INTEGER DEFAULT 0,
  locale TEXT,
  created_at TEXT,
  updated_at TEXT,
  edited_at TEXT,
  synced_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hc_article_scores (
  article_id INTEGER PRIMARY KEY,
  vote_ratio REAL DEFAULT 0,
  related_ticket_count INTEGER DEFAULT 0,
  matched_topics TEXT,
  quality_score REAL DEFAULT 0,
  flags TEXT,
  last_scored_at TEXT,
  FOREIGN KEY (article_id) REFERENCES hc_articles(id)
);

CREATE TABLE IF NOT EXISTS hc_gaps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_label TEXT NOT NULL,
  ticket_count INTEGER DEFAULT 0,
  related_article_ids TEXT,
  gap_score REAL DEFAULT 0,
  suggested_title TEXT,
  suggested_outline TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hc_improvements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  original_title TEXT,
  suggested_title TEXT,
  original_body TEXT,
  improved_body TEXT,
  improvement_notes TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  FOREIGN KEY (article_id) REFERENCES hc_articles(id)
);

CREATE TABLE IF NOT EXISTS hc_discoverability (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  current_title TEXT,
  suggested_title TEXT,
  suggested_labels TEXT,
  suggested_related_ids TEXT,
  reasoning TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (article_id) REFERENCES hc_articles(id)
);

CREATE TABLE IF NOT EXISTS hc_freshness_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  alert_type TEXT NOT NULL,
  days_since_updated INTEGER,
  ticket_spike_count INTEGER,
  matched_topic TEXT,
  details TEXT,
  resolved INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (article_id) REFERENCES hc_articles(id)
);
