PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('parent', 'learner')),
  parent_id TEXT REFERENCES users(id),
  code_hash TEXT NOT NULL,
  recovery_hash TEXT,
  credential_version INTEGER NOT NULL DEFAULT 1,
  disabled INTEGER NOT NULL DEFAULT 0 CHECK (disabled IN (0, 1)),
  created_at INTEGER NOT NULL,
  CHECK ((role = 'parent' AND parent_id IS NULL) OR (role = 'learner' AND parent_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS users_parent ON users(parent_id);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_version INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS progress (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rates_expiry ON rate_limits(expires_at);
CREATE TABLE IF NOT EXISTS setup_claim (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  parent_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);
