"""
Walks MEDIA_ROOT, identifies TV episodes from filenames using guessit,
fetches metadata from TMDb, and writes everything into the shared SQLite DB.

Run this whenever you add new episodes to your media folder.
"""
import os
import re
import sys
from dotenv import load_dotenv

load_dotenv()

# Windows consoles often default to cp1252, which chokes on filenames with
# non-ASCII characters (curly quotes, accents, etc). Force UTF-8 for stdout.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from guessit import guessit  # noqa: E402
from db import get_connection, init_db  # noqa: E402
import tmdb  # noqa: E402
import tvmaze  # noqa: E402
import google_images  # noqa: E402

MEDIA_ROOT = os.getenv("MEDIA_ROOT", ".")
VIDEO_EXTENSIONS = {".mp4", ".mkv", ".avi", ".mov", ".m4v", ".webm"}


def find_video_files(root):
    for dirpath, _dirs, files in os.walk(root):
        for name in files:
            if os.path.splitext(name)[1].lower() in VIDEO_EXTENSIONS:
                yield os.path.join(dirpath, name)


SEASON_FOLDER_RE = re.compile(r"(?:season|עונה)\s*(\d+)", re.IGNORECASE)
EPISODE_FILE_RE = re.compile(r"(?:episode|ep|פרק)\s*(\d+)", re.IGNORECASE)
TRAILING_NUMBER_RE = re.compile(r"(\d+)(?!.*\d)")


def parse_from_folders(path: str):
    """
    Fallback for filenames guessit can't parse (e.g. non-English episode
    naming like Hebrew "עונה"/"פרק"). Expects a layout like:
        <show name>/<show name> season <N>/<file>.mp4
    Season comes from the parent folder name, episode from the filename,
    show title from the grandparent folder name.
    """
    season_folder = os.path.basename(os.path.dirname(path))
    show_folder = os.path.basename(os.path.dirname(os.path.dirname(path)))
    filename = os.path.splitext(os.path.basename(path))[0]

    season_match = SEASON_FOLDER_RE.search(season_folder)
    if not season_match:
        return None, None, None

    episode_match = EPISODE_FILE_RE.search(filename) or TRAILING_NUMBER_RE.search(filename)
    if not episode_match:
        return None, None, None

    title = show_folder.strip().title() if show_folder else None
    if not title:
        return None, None, None

    return title, int(season_match.group(1)), int(episode_match.group(1))


def get_or_create_show(conn, title: str):
    cur = conn.execute("SELECT * FROM shows WHERE title = ?", (title,))
    row = cur.fetchone()
    if row:
        return row[0]

    meta = tmdb.search_show(title)
    tmdb_id = meta["id"] if meta else None
    overview = meta.get("overview") if meta else None
    poster = tmdb.image_url(meta.get("poster_path")) if meta else None
    backdrop = tmdb.image_url(meta.get("backdrop_path")) if meta else None
    first_air = meta.get("first_air_date") if meta else None

    source = "TMDb"
    if not meta:
        # TMDb had no match (or no TMDb key is configured) — TVmaze needs no
        # API key/signup at all, so try that first.
        poster, backdrop = tvmaze.poster_and_banner(title)
        source = "TVmaze" if (poster or backdrop) else None

        if not poster and not backdrop:
            # Last resort: Google Custom Search, only if those keys are set.
            poster = google_images.search_poster(title)
            backdrop = google_images.search_banner(title)
            source = "Google" if (poster or backdrop) else "none"

    cur = conn.execute(
        """INSERT INTO shows (title, tmdb_id, overview, poster_url, backdrop_url, first_air_date)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (title, tmdb_id, overview, poster, backdrop, first_air),
    )
    conn.commit()
    print(f"  + Added show: {title} (poster source: {source})")
    return cur.lastrowid


def upsert_episode(conn, show_id, show_title, tmdb_show_id, season, episode, file_path):
    cur = conn.execute(
        "SELECT id FROM episodes WHERE file_path = ?", (file_path,)
    )
    if cur.fetchone():
        return  # already scanned

    # Another file already claims this show/season/episode slot (e.g. a
    # duplicate rip in a different quality/language) — skip rather than crash.
    existing = conn.execute(
        "SELECT file_path FROM episodes WHERE show_id = ? AND season = ? AND episode = ?",
        (show_id, season, episode),
    ).fetchone()
    if existing:
        print(f"    ! Skipping duplicate S{season:02d}E{episode:02d}: {file_path}")
        print(f"      (already have: {existing[0]})")
        return

    ep_meta = tmdb.get_episode(tmdb_show_id, season, episode) if tmdb_show_id else None
    title = ep_meta.get("name") if ep_meta else None
    overview = ep_meta.get("overview") if ep_meta else None
    thumb = tmdb.image_url(ep_meta.get("still_path")) if ep_meta else None

    if not title and not overview and not thumb:
        # TMDb had nothing (or no key configured) — TVmaze needs no key at all.
        title, overview, thumb = tvmaze.get_episode(show_title, season, episode)

    conn.execute(
        """INSERT INTO episodes (show_id, season, episode, title, overview, file_path, thumbnail_url)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (show_id, season, episode, title, overview, file_path, thumb),
    )
    conn.commit()
    print(f"    - S{season:02d}E{episode:02d}: {title or '(untitled)'}")


def prune_stale(conn):
    """
    Drop episodes whose file is gone or no longer lives under MEDIA_ROOT
    (e.g. after switching to a different media folder), then drop any show
    left with no episodes. watch_progress rows cascade automatically.
    """
    root = os.path.normcase(os.path.abspath(MEDIA_ROOT)) + os.sep
    removed = 0
    for ep_id, file_path in conn.execute("SELECT id, file_path FROM episodes").fetchall():
        p = os.path.normcase(os.path.abspath(file_path))
        if not p.startswith(root) or not os.path.isfile(file_path):
            conn.execute("DELETE FROM episodes WHERE id = ?", (ep_id,))
            removed += 1
    conn.execute(
        "DELETE FROM shows WHERE id NOT IN (SELECT DISTINCT show_id FROM episodes)"
    )
    conn.commit()
    if removed:
        print(f"Pruned {removed} episode(s) no longer in {MEDIA_ROOT}")


def main():
    if not os.path.isdir(MEDIA_ROOT):
        print(f"MEDIA_ROOT does not exist: {MEDIA_ROOT}")
        print("Set it in python/.env")
        return

    init_db()
    conn = get_connection()

    show_tmdb_cache = {}
    count = 0

    for path in find_video_files(MEDIA_ROOT):
        guess = guessit(os.path.basename(path))
        title = guess.get("title")
        season = guess.get("season")
        episode = guess.get("episode")

        if not title or season is None or episode is None:
            title, season, episode = parse_from_folders(path)

        if not title or season is None or episode is None:
            print(f"Skipping (couldn't parse show/season/episode): {path}")
            continue

        show_id = get_or_create_show(conn, title)
        if show_id not in show_tmdb_cache:
            row = conn.execute(
                "SELECT tmdb_id FROM shows WHERE id = ?", (show_id,)
            ).fetchone()
            show_tmdb_cache[show_id] = row[0]

        upsert_episode(conn, show_id, title, show_tmdb_cache[show_id], season, episode, path)
        count += 1

    prune_stale(conn)

    conn.close()
    print(f"\nDone. Processed {count} episode file(s).")


if __name__ == "__main__":
    main()
