"use strict";

const express = require("express");
const fs = require("node:fs");
const path = require("node:path");

const MIME = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
};

/**
 * Builds the HTTP server: REST API + video streaming, plus the built React
 * app served as static files with SPA fallback. Listens on a random free
 * port on localhost. Resolves to { server, port }.
 */
function createServer(db, staticDir) {
  const app = express();
  app.use(express.json());

  // --- Shows -------------------------------------------------------------
  app.get("/api/shows", (_req, res) => {
    res.json(db.prepare("SELECT * FROM shows ORDER BY title").all());
  });

  app.get("/api/shows/:id", (req, res) => {
    const show = db.prepare("SELECT * FROM shows WHERE id = ?").get(req.params.id);
    if (!show) return res.status(404).json({ error: "Show not found" });
    res.json(show);
  });

  app.get("/api/shows/:id/episodes", (req, res) => {
    res.json(
      db
        .prepare("SELECT * FROM episodes WHERE show_id = ? ORDER BY season, episode")
        .all(req.params.id)
    );
  });

  // --- Episodes --------------------------------------------------------
  app.get("/api/episodes/:id", (req, res) => {
    const ep = db.prepare("SELECT * FROM episodes WHERE id = ?").get(req.params.id);
    if (!ep) return res.status(404).json({ error: "Episode not found" });
    res.json(ep);
  });

  // --- Streaming (HTTP range requests, so seeking works) ---------------
  app.get("/api/stream/:episodeId", (req, res) => {
    const ep = db.prepare("SELECT * FROM episodes WHERE id = ?").get(req.params.episodeId);
    if (!ep) return res.status(404).json({ error: "Episode not found" });
    if (!fs.existsSync(ep.file_path)) {
      return res.status(404).json({ error: "File missing on disk" });
    }

    const { size } = fs.statSync(ep.file_path);
    const type = MIME[path.extname(ep.file_path).toLowerCase()] || "video/mp4";
    const range = req.headers.range;

    if (!range) {
      res.writeHead(200, { "Content-Length": size, "Content-Type": type });
      return fs.createReadStream(ep.file_path).pipe(res);
    }

    const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
    const start = parseInt(startStr, 10);
    const end = endStr ? parseInt(endStr, 10) : size - 1;

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": end - start + 1,
      "Content-Type": type,
    });
    fs.createReadStream(ep.file_path, { start, end }).pipe(res);
  });

  // --- Watch progress -------------------------------------------------
  app.post("/api/progress/:episodeId", (req, res) => {
    const { position_seconds, watched } = req.body;
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

  // --- Static React app + SPA fallback -------------------------------
  if (staticDir && fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.use((req, res, next) => {
      if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }

  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      resolve({ server, port: server.address().port });
    });
  });
}

module.exports = { createServer };
