"""
Fallback poster/banner lookup using the Google Custom Search JSON API.
Used only when TMDb has no match for a show.

Requires (free) setup:
  1. API key: https://console.cloud.google.com/apis/credentials
     (enable "Custom Search API" for the project first)
  2. Search engine ID: https://programmablesearchengine.google.com/
     - create a search engine, set it to "Search the entire web"
     - turn ON "Image search" in its settings
     - copy the "Search engine ID"

Free tier: 100 queries/day. Beyond that it's billed per query.
"""
import os
import requests

API_KEY = os.getenv("GOOGLE_API_KEY")
CSE_ID = os.getenv("GOOGLE_CSE_ID")
BASE_URL = "https://www.googleapis.com/customsearch/v1"


def _image_search(query: str, extra_terms: str = ""):
    if not API_KEY or not CSE_ID:
        return None

    resp = requests.get(
        BASE_URL,
        params={
            "key": API_KEY,
            "cx": CSE_ID,
            "q": f"{query} {extra_terms}".strip(),
            "searchType": "image",
            "num": 1,
            "safe": "active",
        },
        timeout=10,
    )
    if resp.status_code != 200:
        return None

    items = resp.json().get("items", [])
    return items[0]["link"] if items else None


def search_poster(show_title: str):
    """Best-effort poster image for a show title, or None."""
    return _image_search(show_title, "tv series poster")


def search_banner(show_title: str):
    """Best-effort banner/backdrop image for a show title, or None."""
    return _image_search(show_title, "tv series banner")
