"use strict";

const path = require("node:path");
const ptt = require("parse-torrent-title");

const SEASON_FOLDER_RE = /(?:season|עונה)\s*(\d+)/i;
const EPISODE_FILE_RE = /(?:episode|ep|פרק)\s*(\d+)/i;
const TRAILING_NUMBER_RE = /(\d+)(?!.*\d)/;

function titleCase(s) {
  return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

/**
 * Fallback for filenames the torrent-title parser can't handle (e.g. Hebrew
 * "עונה"/"פרק" naming). Expects: <show name>/<... season N ...>/<file>
 */
function parseFromFolders(filePath) {
  const seasonFolder = path.basename(path.dirname(filePath));
  const showFolder = path.basename(path.dirname(path.dirname(filePath)));
  const filename = path.basename(filePath, path.extname(filePath));

  const seasonMatch = SEASON_FOLDER_RE.exec(seasonFolder);
  if (!seasonMatch || !showFolder) return null;

  const epMatch = EPISODE_FILE_RE.exec(filename) || TRAILING_NUMBER_RE.exec(filename);

  return {
    title: titleCase(showFolder.trim()),
    season: Number(seasonMatch[1]),
    episode: epMatch ? Number(epMatch[1]) : null,
  };
}

/**
 * Returns { title, season, episode } or null.
 *
 * When the file sits in <Show>/<... season N ...>/ the folder names are the
 * most reliable source for the show title and season (filenames are often
 * localized or full of release junk like "1080p"). The filename parser still
 * supplies the episode number when it can read one.
 */
function parseEpisode(filePath) {
  const g = ptt.parse(path.basename(filePath));
  const fb = parseFromFolders(filePath);

  let title = fb ? fb.title : g.title;
  let season = g.season != null ? g.season : fb && fb.season;
  let episode = g.episode != null ? g.episode : fb && fb.episode;

  if (!title || season == null || episode == null) return null;
  return { title: String(title).trim(), season, episode };
}

module.exports = { parseEpisode };
