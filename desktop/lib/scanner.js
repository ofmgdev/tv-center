"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { parseEpisode } = require("./parse");
const tvmaze = require("./tvmaze");

const VIDEO_EXTENSIONS = new Set([".mp4", ".mkv", ".avi", ".mov", ".m4v", ".webm"]);

function* walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      yield full;
    }
  }
}

async function getOrCreateShow(db, cache, title, log) {
  if (cache.has(title)) return cache.get(title);

  const existing = db.prepare("SELECT id FROM shows WHERE title = ?").get(title);
  if (existing) {
    // Look up the TVmaze id once so episode metadata can be fetched.
    const meta = await tvmaze.showMeta(title);
    const rec = { id: existing.id, tvmazeId: meta ? meta.id : null };
    cache.set(title, rec);
    return rec;
  }

  const meta = await tvmaze.showMeta(title);
  const info = db
    .prepare(
      `INSERT INTO shows (title, tmdb_id, overview, poster_url, backdrop_url, first_air_date)
       VALUES (?, NULL, ?, ?, ?, ?)`
    )
    .run(
      title,
      meta ? meta.overview : null,
      meta ? meta.poster : null,
      meta ? meta.backdrop : null,
      meta ? meta.first_air_date : null
    );
  log(`  + Added show: ${title}${meta ? "" : " (no metadata match)"}`);
  const rec = { id: Number(info.lastInsertRowid), tvmazeId: meta ? meta.id : null };
  cache.set(title, rec);
  return rec;
}

async function upsertEpisode(db, show, showTitle, season, episode, filePath, log) {
  if (db.prepare("SELECT id FROM episodes WHERE file_path = ?").get(filePath)) return;

  const clash = db
    .prepare("SELECT file_path FROM episodes WHERE show_id = ? AND season = ? AND episode = ?")
    .get(show.id, season, episode);
  if (clash) {
    log(
      `    ! Skipping duplicate S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}: ${filePath}`
    );
    return;
  }

  const meta = await tvmaze.episodeMeta(show.tvmazeId, season, episode);
  db.prepare(
    `INSERT INTO episodes (show_id, season, episode, title, overview, file_path, thumbnail_url)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(show.id, season, episode, meta.title, meta.overview, filePath, meta.thumbnail);

  log(
    `    - S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}: ${meta.title || "(untitled)"}`
  );
}

/**
 * Drop episodes whose file is gone or no longer lives under mediaRoot (e.g.
 * after switching media folders), then drop shows left with no episodes.
 */
function pruneStale(db, mediaRoot, log) {
  const root = path.resolve(mediaRoot).toLowerCase() + path.sep;
  const rows = db.prepare("SELECT id, file_path FROM episodes").all();
  let removed = 0;
  const del = db.prepare("DELETE FROM episodes WHERE id = ?");
  for (const row of rows) {
    const resolved = path.resolve(row.file_path).toLowerCase();
    if (!resolved.startsWith(root) || !fs.existsSync(row.file_path)) {
      del.run(row.id);
      removed++;
    }
  }
  db.prepare("DELETE FROM shows WHERE id NOT IN (SELECT DISTINCT show_id FROM episodes)").run();
  if (removed) log(`Pruned ${removed} episode(s) no longer in ${mediaRoot}`);
}

async function scan(db, mediaRoot, onLog) {
  const log = onLog || (() => {});
  if (!fs.existsSync(mediaRoot) || !fs.statSync(mediaRoot).isDirectory()) {
    log(`Media folder not found: ${mediaRoot}`);
    return;
  }

  log(`Scanning: ${mediaRoot}`);
  const cache = new Map();
  let count = 0;

  for (const filePath of walk(mediaRoot)) {
    const parsed = parseEpisode(filePath);
    if (!parsed) {
      log(`Skipping (couldn't parse show/season/episode): ${filePath}`);
      continue;
    }
    const show = await getOrCreateShow(db, cache, parsed.title, log);
    await upsertEpisode(db, show, parsed.title, parsed.season, parsed.episode, filePath, log);
    count++;
  }

  pruneStale(db, mediaRoot, log);
  log(`\nDone. Processed ${count} episode file(s).`);
}

module.exports = { scan };
