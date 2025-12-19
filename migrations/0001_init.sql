-- 0001_init.sql
-- Core schema for download-center (D1 / SQLite dialect)

CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  site_name TEXT,
  site_description TEXT,
  announcement TEXT,
  contact_json TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_series (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  device_category TEXT NOT NULL,
  cover_image_url TEXT,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  device_category TEXT NOT NULL,
  series_id INTEGER,
  cover_image_url TEXT,
  remark TEXT,
  description TEXT,
  tags_json TEXT,
  is_published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (series_id) REFERENCES product_series(id)
);

CREATE TABLE IF NOT EXISTS software (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  device_category TEXT NOT NULL,
  cover_image_url TEXT,
  remark TEXT,
  description TEXT,
  is_published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS file_resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_id TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  device_category TEXT NOT NULL,
  file_category TEXT NOT NULL,
  file_size_bytes INTEGER,
  sha256 TEXT,
  platform TEXT,
  arch TEXT,
  version TEXT,
  release_notes TEXT,
  storage_type TEXT NOT NULL, -- R2 | EXTERNAL
  r2_bucket TEXT,
  r2_key TEXT,
  content_type TEXT,
  external_url TEXT,
  is_published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS software_resources (
  software_id INTEGER NOT NULL,
  resource_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (software_id, resource_id),
  FOREIGN KEY (software_id) REFERENCES software(id),
  FOREIGN KEY (resource_id) REFERENCES file_resources(id)
);

CREATE TABLE IF NOT EXISTS product_software (
  product_id INTEGER NOT NULL,
  software_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, software_id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (software_id) REFERENCES software(id)
);

CREATE TABLE IF NOT EXISTS product_resources (
  product_id INTEGER NOT NULL,
  resource_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, resource_id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (resource_id) REFERENCES file_resources(id)
);

CREATE TABLE IF NOT EXISTS download_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_id INTEGER,
  resource_slug TEXT,
  storage_type TEXT,
  outcome TEXT,
  ip TEXT,
  user_agent TEXT,
  referer TEXT,
  country TEXT,
  colo TEXT,
  access_email TEXT,
  access_sub TEXT,
  bytes_sent INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS download_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  max_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  created_by_email TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (resource_id) REFERENCES file_resources(id)
);

CREATE INDEX IF NOT EXISTS idx_resources_slug ON file_resources(slug);
CREATE INDEX IF NOT EXISTS idx_resources_pub ON file_resources(is_published, updated_at);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_software_slug ON software(slug);
CREATE INDEX IF NOT EXISTS idx_series_slug ON product_series(slug);
CREATE INDEX IF NOT EXISTS idx_audit_resource_time ON download_audit(resource_slug, created_at);
