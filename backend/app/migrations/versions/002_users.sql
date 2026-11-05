CREATE TABLE users (
 id INTEGER PRIMARY KEY,
 login TEXT NOT NULL COLLATE NOCASE UNIQUE,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('admin','teacher')),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
 teacher_name TEXT REFERENCES teachers(name) ON UPDATE CASCADE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE sessions (
 token_hash TEXT PRIMARY KEY,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL
);
