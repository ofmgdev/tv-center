import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Same shared database the Python scanner writes to.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "../../data/db.sqlite");

export const db = new Database(DB_PATH, { fileMustExist: false });
db.pragma("foreign_keys = ON");

export interface Show {
  id: number;
  title: string;
  tmdb_id: number | null;
  overview: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  first_air_date: string | null;
}

export interface Episode {
  id: number;
  show_id: number;
  season: number;
  episode: number;
  title: string | null;
  overview: string | null;
  file_path: string;
  duration_seconds: number | null;
  thumbnail_url: string | null;
}
