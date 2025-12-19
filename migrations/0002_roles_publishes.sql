-- 0002_roles_publishes.sql
CREATE TABLE IF NOT EXISTS publishes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  publish_id TEXT NOT NULL UNIQUE,
  note TEXT,
  created_by_email TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_publishes_created_at ON publishes(created_at);

CREATE TABLE IF NOT EXISTS admin_roles (
  email TEXT PRIMARY KEY,
  role TEXT NOT NULL, -- admin/editor/viewer
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
