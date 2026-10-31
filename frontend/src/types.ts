export interface Show {
  id: number;
  title: string;
  tmdb_id: number | null;
  overview: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  first_air_date: string | null;
  episode_count?: number;
  season_count?: number;
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
