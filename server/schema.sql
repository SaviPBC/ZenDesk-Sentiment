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
