"""
Zero-setup poster/banner lookup using the TVmaze API.
No API key, no account, no signup required — just a plain HTTP request.

Used as a fallback when TMDb has no match (or no TMDb key is configured at all).
https://www.tvmaze.com/api
"""
import requests

BASE_URL = "https://api.tvmaze.com"


def search_show(title: str):
    """Return TVmaze's best-matching show record for a title, or None."""
    try:
        resp = requests.get(
            f"{BASE_URL}/singlesearch/shows", params={"q": title}, timeout=10
        )
    except requests.RequestException:
        return None

    if resp.status_code != 200:
        return None
    return resp.json()


def poster_and_banner(title: str):
    """
    Returns (poster_url, banner_url) for a show title using TVmaze.
    banner_url falls back to the same image if TVmaze has no separate backdrop
    (it usually only has one poster-shaped image).
    """
    show = search_show(title)
    if not show:
        return None, None

    image = show.get("image") or {}
    poster = image.get("original") or image.get("medium")
    return poster, poster


def _strip_html(text: str | None):
    if not text:
        return None
    import re

    return re.sub(r"<[^>]+>", "", text).strip()


def get_episode(show_title: str, season: int, episode: int):
    """
    Look up a single episode's thumbnail + description via TVmaze, using the
    show title (TVmaze doesn't need TMDb's numeric show id).
    Returns (title, overview, thumbnail_url) — any of which may be None.
    """
    show = search_show(show_title)
    if not show:
        return None, None, None

    try:
        resp = requests.get(
            f"{BASE_URL}/shows/{show['id']}/episodebynumber",
            params={"season": season, "number": episode},
            timeout=10,
        )
    except requests.RequestException:
        return None, None, None

    if resp.status_code != 200:
        return None, None, None

    ep = resp.json()
    image = ep.get("image") or {}
    thumb = image.get("original") or image.get("medium")
    return ep.get("name"), _strip_html(ep.get("summary")), thumb
