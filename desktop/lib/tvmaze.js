"use strict";

/**
 * Zero-setup metadata lookup via the TVmaze API — no key, no account.
 * https://www.tvmaze.com/api
 */

const BASE = "https://api.tvmaze.com";

function stripHtml(text) {
  return text ? text.replace(/<[^>]+>/g, "").trim() : null;
}

async function getJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function searchShow(title) {
  return getJson(`${BASE}/singlesearch/shows?q=${encodeURIComponent(title)}`);
}

/** Best wide artwork for a show (1920x1080 "background", else banner). */
async function bestBackdrop(showId) {
  const images = await getJson(`${BASE}/shows/${showId}/images`);
  if (!Array.isArray(images)) return null;
  const url = (img) => (img && img.resolutions && img.resolutions.original ? img.resolutions.original.url : null);
  const pick = (type) => {
    const ofType = images.filter((i) => i.type === type);
    return url(ofType.find((i) => i.main) || ofType[0]);
  };
  return pick("background") || pick("banner");
}

/** { id, poster, backdrop, overview, first_air_date } or null */
async function showMeta(title) {
  const show = await searchShow(title);
  if (!show) return null;
  const image = show.image || {};
  const poster = image.original || image.medium || null;
  const wide = await bestBackdrop(show.id);
  return {
    id: show.id,
    poster,
    backdrop: wide || poster,
    overview: stripHtml(show.summary),
    first_air_date: show.premiered || null,
  };
}

/** { title, overview, thumbnail } — fields may be null */
async function episodeMeta(tvmazeShowId, season, number) {
  if (!tvmazeShowId) return { title: null, overview: null, thumbnail: null };
  const ep = await getJson(
    `${BASE}/shows/${tvmazeShowId}/episodebynumber?season=${season}&number=${number}`
  );
  if (!ep) return { title: null, overview: null, thumbnail: null };
  const image = ep.image || {};
  return {
    title: ep.name || null,
    overview: stripHtml(ep.summary),
    thumbnail: image.original || image.medium || null,
  };
}

module.exports = { showMeta, episodeMeta };
