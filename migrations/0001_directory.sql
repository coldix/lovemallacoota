CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  slug TEXT,
  payload TEXT NOT NULL,
  email TEXT NOT NULL,
  entity_type TEXT,
  official INTEGER DEFAULT 0,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  photo_key TEXT
);

CREATE INDEX submissions_slug ON submissions (slug);
CREATE INDEX submissions_status ON submissions (status);

CREATE TABLE codes (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE INDEX codes_submission ON codes (submission_id);

CREATE TABLE tokens (
  id TEXT PRIMARY KEY,
  listing_slug TEXT NOT NULL,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  purpose TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX tokens_hash ON tokens (token_hash);
CREATE INDEX tokens_slug ON tokens (listing_slug);

CREATE TABLE audit (
  id TEXT PRIMARY KEY,
  listing_slug TEXT,
  submission_id TEXT,
  action TEXT NOT NULL,
  actor TEXT,
  detail TEXT,
  created_at TEXT NOT NULL
);
