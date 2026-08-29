import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Episode, Show } from "./types";
import { Poster } from "./Poster";

export default function ShowPage() {
  const { id } = useParams();
  const [show, setShow] = useState<Show | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);

  useEffect(() => {
    fetch(`/api/shows/${id}`).then((r) => r.json()).then(setShow);
    fetch(`/api/shows/${id}/episodes`).then((r) => r.json()).then(setEpisodes);
  }, [id]);

  if (!show) return null;

  return (
    <div>
      <div className="hero">
        <Poster
          className="hero-banner"
          title={show.title}
          src={show.backdrop_url || show.poster_url}
          aspect="21 / 6"
          showLabel={false}
        />
        <div className="hero-overlay">
          <Link to="/" className="back-link" style={{ padding: 0 }}>&larr; Back</Link>
          <h1 className="hero-title">{show.title}</h1>
          {show.overview && <p className="hero-overview">{show.overview}</p>}
        </div>
      </div>
      <div>
        {episodes.map((ep) => (
          <Link key={ep.id} to={`/watch/${ep.id}`} className="episode-row">
            <Poster
              className="episode-thumb"
              title={show.title}
              src={ep.thumbnail_url}
              aspect="16 / 9"
              showLabel={false}
            />
            <div>
              <div style={{ fontWeight: 600 }}>
                S{String(ep.season).padStart(2, "0")}E{String(ep.episode).padStart(2, "0")}
                {ep.title ? ` — ${ep.title}` : ""}
              </div>
              {ep.overview && (
                <div style={{ fontSize: 13, opacity: 0.7, maxWidth: 600 }}>{ep.overview}</div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
