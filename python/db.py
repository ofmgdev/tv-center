"""Shared SQLite schema/helpers used by the scanner (and readable by the Node server)."""
import os
import sqlite3

DB_PATH = os.getenv("DB_PATH", "../data/db.sqlite")


def get_connection():
    os.makedirs(os.path.dirname(os.path.abspath(DB_PATH)), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


SCHEMA = """
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
"""


def init_db():
    conn = get_connection()
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()


if __name__ == "__main__":
    init_db()
    print(f"Database initialized at {os.path.abspath(DB_PATH)}")
