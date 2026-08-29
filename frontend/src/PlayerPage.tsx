import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Episode } from "./types";
import { Poster } from "./Poster";

export default function PlayerPage() {
  const { episodeId } = useParams();
  const navigate = useNavigate();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [showTitle, setShowTitle] = useState("");

  useEffect(() => {
    fetch(`/api/episodes/${episodeId}`)
      .then((r) => r.json())
      .then((ep: Episode) => {
        setEpisode(ep);
        fetch(`/api/shows/${ep.show_id}`)
          .then((r) => r.json())
          .then((show) => setShowTitle(show.title));
        fetch(`/api/shows/${ep.show_id}/episodes`)
          .then((r) => r.json())
          .then(setEpisodes);
      });
  }, [episodeId]);

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="back-link"
        style={{ background: "none", border: "none", cursor: "pointer", color: "#fff" }}
      >
        &larr; Back
      </button>
      <video key={episodeId} controls autoPlay src={`/api/stream/${episodeId}`} />

      {episode && (
        <div style={{ padding: "16px 40px" }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {showTitle} — S{String(episode.season).padStart(2, "0")}E
            {String(episode.episode).padStart(2, "0")}
            {episode.title ? `: ${episode.title}` : ""}
          </div>
          {episode.overview && (
            <p style={{ opacity: 0.8, maxWidth: 700 }}>{episode.overview}</p>
          )}
        </div>
      )}

      <div style={{ padding: "8px 40px 0", fontSize: 18, fontWeight: 600 }}>
        More episodes
      </div>
      <div>
        {episodes.map((ep) => (
          <Link
            key={ep.id}
            to={`/watch/${ep.id}`}
            className="episode-row"
            style={
              String(ep.id) === episodeId
                ? { background: "#1f1f1f" }
                : undefined
            }
          >
            <Poster
              className="episode-thumb"
              title={showTitle}
              src={ep.thumbnail_url}
              aspect="16 / 9"
              showLabel={false}
            />
            <div>
              <div style={{ fontWeight: 600 }}>
                S{String(ep.season).padStart(2, "0")}E{String(ep.episode).padStart(2, "0")}
                {ep.title ? ` — ${ep.title}` : ""}
                {String(ep.id) === episodeId ? "  (playing)" : ""}
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
