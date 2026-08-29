"""Thin wrapper around the TMDb API for TV show/episode metadata."""
import os
import requests

API_KEY = os.getenv("TMDB_API_KEY")
BASE_URL = "https://api.themoviedb.org/3"
IMAGE_BASE = "https://image.tmdb.org/t/p/w500"


def search_show(title: str):
    """Return the best-matching TV show result from TMDb, or None."""
    if not API_KEY:
        return None
    resp = requests.get(
        f"{BASE_URL}/search/tv",
        params={"api_key": API_KEY, "query": title},
        timeout=10,
    )
    resp.raise_for_status()
    results = resp.json().get("results", [])
    return results[0] if results else None


def get_episode(tmdb_show_id: int, season: int, episode: int):
    """Return episode metadata (title, overview, still image) or None."""
    if not API_KEY:
        return None
    url = f"{BASE_URL}/tv/{tmdb_show_id}/season/{season}/episode/{episode}"
    resp = requests.get(url, params={"api_key": API_KEY}, timeout=10)
    if resp.status_code != 200:
        return None
    return resp.json()


def image_url(path: str | None):
    return f"{IMAGE_BASE}{path}" if path else None
