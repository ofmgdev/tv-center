"use strict";

const Database = require("better-sqlite3");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS shows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    tmdb_id INTEGER,
    overview TEXT,
    poster_url TEXT,
    backdrop_url TEXT,
    first_air_date TEXT,
    UNIQUE(title)
);

CREATE TABLE IF NOT EXISTS episodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    show_id INTEGER NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
    season INTEGER NOT NULL,
    episode INTEGER NOT NULL,
    title TEXT,
    overview TEXT,
    file_path TEXT NOT NULL UNIQUE,
    duration_seconds INTEGER,
    thumbnail_url TEXT,
    UNIQUE(show_id, season, episode)
);

CREATE TABLE IF NOT EXISTS watch_progress (
    episode_id INTEGER PRIMARY KEY REFERENCES episodes(id) ON DELETE CASCADE,
    position_seconds INTEGER NOT NULL DEFAULT 0,
    watched INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`;

function openDb(file) {
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

module.exports = { openDb };
