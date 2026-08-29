# TV Center

A self-hosted, Netflix-style library for your own downloaded TV shows.

## Architecture

- **`server/`** — Node.js + Express (TypeScript) API and video streaming server
- **`python/`** — Python scanner: walks your media folder, parses filenames, fetches metadata (TMDb), writes to the shared database
- **`frontend/`** — React app (Netflix-style browsing UI)
- **`data/db.sqlite`** — shared SQLite database (created automatically)
- **`media_test/`** — drop a few test video files here while developing

## How it fits together

1. Run the Python scanner → it scans your TV folder, matches files to shows/episodes, pulls posters/descriptions from TMDb, writes rows into `data/db.sqlite`.
2. Run the Node server → it reads that same database and exposes a REST API (`/api/shows`, `/api/shows/:id/episodes`, `/api/stream/:episodeId`) and streams video files with proper seek support (HTTP range requests).
3. The React frontend calls the API and renders the show grid + video player.

## Getting started

### 1. Python scanner setup

```bash
cd python
python -m venv venv
venv\Scripts\activate      # Windows
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and add your free TMDb API key (https://www.themoviedb.org/settings/api).

Then edit `MEDIA_ROOT` in `.env` to point at your TV shows folder, and run:

```bash
python scan.py
```

### 2. Node server setup

```bash
cd server
npm install
npm run dev
```

Server starts on http://localhost:4000

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Frontend starts on http://localhost:5173 (Vite default) and talks to the API on port 4000.
