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
  if (!seasonMatch) return null;

  const epMatch = EPISODE_FILE_RE.exec(filename) || TRAILING_NUMBER_RE.exec(filename);
  if (!epMatch) return null;

  if (!showFolder) return null;

  return {
    title: titleCase(showFolder.trim()),
    season: Number(seasonMatch[1]),
    episode: Number(epMatch[1]),
  };
}

/** Returns { title, season, episode } or null. */
function parseEpisode(filePath) {
  const g = ptt.parse(path.basename(filePath));
  let title = g.title;
  let season = g.season;
  let episode = g.episode;

  if (!title || season == null || episode == null) {
    const fb = parseFromFolders(filePath);
    if (fb) {
      title = title || fb.title;
      season = season == null ? fb.season : season;
      episode = episode == null ? fb.episode : episode;
    }
  }

  if (!title || season == null || episode == null) return null;
  return { title: String(title).trim(), season, episode };
}

module.exports = { parseEpisode };
