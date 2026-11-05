CREATE TABLE groups (
 code TEXT PRIMARY KEY,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);
INSERT INTO groups(code) SELECT DISTINCT group_name FROM lessons;
