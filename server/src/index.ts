import express from "express";
import cors from "cors";
import fs from "node:fs";
import { db, Show, Episode } from "./db.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// --- Shows ---------------------------------------------------------------

app.get("/api/shows", (_req, res) => {
  const shows = db.prepare("SELECT * FROM shows ORDER BY title").all() as Show[];
  res.json(shows);
});

app.get("/api/shows/:id", (req, res) => {
  const show = db
    .prepare("SELECT * FROM shows WHERE id = ?")
    .get(req.params.id) as Show | undefined;
  if (!show) return res.status(404).json({ error: "Show not found" });
  res.json(show);
});

app.get("/api/shows/:id/episodes", (req, res) => {
  const episodes = db
    .prepare(
      "SELECT * FROM episodes WHERE show_id = ? ORDER BY season, episode"
    )
    .all(req.params.id) as Episode[];
  res.json(episodes);
});

// --- Episodes --------------------------------------------------------------

app.get("/api/episodes/:id", (req, res) => {
  const episode = db
    .prepare("SELECT * FROM episodes WHERE id = ?")
    .get(req.params.id) as Episode | undefined;
  if (!episode) return res.status(404).json({ error: "Episode not found" });
  res.json(episode);
});

// --- Streaming (supports seeking via HTTP range requests) -----------------

app.get("/api/stream/:episodeId", (req, res) => {
  const episode = db
    .prepare("SELECT * FROM episodes WHERE id = ?")
    .get(req.params.episodeId) as Episode | undefined;

  if (!episode) return res.status(404).json({ error: "Episode not found" });
  if (!fs.existsSync(episode.file_path)) {
    return res.status(404).json({ error: "File missing on disk" });
  }

  const stat = fs.statSync(episode.file_path);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (!range) {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": "video/mp4",
    });
    fs.createReadStream(episode.file_path).pipe(res);
    return;
  }

  const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
  const start = parseInt(startStr, 10);
  const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
  const chunkSize = end - start + 1;

  res.writeHead(206, {
    "Content-Range": `bytes ${start}-${end}/${fileSize}`,
    "Accept-Ranges": "bytes",
    "Content-Length": chunkSize,
    "Content-Type": "video/mp4",
  });
  fs.createReadStream(episode.file_path, { start, end }).pipe(res);
});

// --- Watch progress --------------------------------------------------------

app.post("/api/progress/:episodeId", (req, res) => {
  const { position_seconds, watched } = req.body as {
    position_seconds: number;
    watched?: boolean;
  };
  db.prepare(
    `INSERT INTO watch_progress (episode_id, position_seconds, watched, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(episode_id) DO UPDATE SET
       position_seconds = excluded.position_seconds,
       watched = excluded.watched,
       updated_at = CURRENT_TIMESTAMP`
  ).run(req.params.episodeId, position_seconds, watched ? 1 : 0);
  res.json({ ok: true });
});

app.get("/api/progress/:episodeId", (req, res) => {
  const row = db
    .prepare("SELECT * FROM watch_progress WHERE episode_id = ?")
    .get(req.params.episodeId);
  res.json(row || { episode_id: Number(req.params.episodeId), position_seconds: 0, watched: 0 });
});

app.listen(PORT, () => {
  console.log(`TV Center API running at http://localhost:${PORT}`);
});
