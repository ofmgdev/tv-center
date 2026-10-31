import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Episode } from "./types";
import { Poster } from "./Poster";

const code = (ep: Episode) =>
  `S${String(ep.season).padStart(2, "0")}E${String(ep.episode).padStart(2, "0")}`;

export default function PlayerPage() {
  const { episodeId } = useParams();
  const navigate = useNavigate();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [showTitle, setShowTitle] = useState("");
  const [season, setSeason] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/episodes/${episodeId}`)
      .then((r) => r.json())
      .then((ep: Episode) => {
        setEpisode(ep);
        setSeason(ep.season);
        fetch(`/api/shows/${ep.show_id}`)
          .then((r) => r.json())
          .then((show) => setShowTitle(show.title));
        fetch(`/api/shows/${ep.show_id}/episodes`)
          .then((r) => r.json())
          .then(setEpisodes);
      });
  }, [episodeId]);

  const seasons = useMemo(
    () => Array.from(new Set(episodes.map((e) => e.season))).sort((a, b) => a - b),
    [episodes]
  );
  const visible = episodes.filter((e) => e.season === season);

  const index = episodes.findIndex((e) => String(e.id) === episodeId);
  const next = index >= 0 ? episodes[index + 1] : undefined;

  return (
    <div>
      <div className="player-bar">
        <button onClick={() => navigate(-1)} className="back-btn">← Back</button>
        <span className="logo small">TV CENTER</span>
      </div>

      <video
        key={episodeId}
        controls
        autoPlay
        src={`/api/stream/${episodeId}`}
        onEnded={() => next && navigate(`/watch/${next.id}`)}
      />

      {episode && (
        <div className="now-playing">
          <div className="eyebrow">{showTitle}</div>
          <h2>
            {code(episode)}
            {episode.title ? ` · ${episode.title}` : ""}
          </h2>
          {episode.overview && <p>{episode.overview}</p>}
          {next && (
            <Link to={`/watch/${next.id}`} className="btn ghost">
              Next: {code(next)} ▶
            </Link>
          )}
        </div>
      )}

      <h3 className="section-title">More episodes</h3>
      {seasons.length > 1 && (
        <div className="tabs">
          {seasons.map((s) => (
            <button key={s} className={s === season ? "tab active" : "tab"} onClick={() => setSeason(s)}>
              Season {s}
            </button>
          ))}
        </div>
      )}
      <div className="episodes">
        {visible.map((ep) => (
          <Link
            key={ep.id}
            to={`/watch/${ep.id}`}
            className={String(ep.id) === episodeId ? "episode-row current" : "episode-row"}
          >
            <span className="ep-num">{ep.episode}</span>
            <div className="thumb-wrap">
              <Poster className="episode-thumb" title={showTitle} src={ep.thumbnail_url} aspect="16 / 9" showLabel={false} />
              <span className="thumb-play">▶</span>
            </div>
            <div className="ep-info">
              <div className="ep-title">
                {code(ep)} · {ep.title || `Episode ${ep.episode}`}
                {String(ep.id) === episodeId ? "  — playing" : ""}
              </div>
              {ep.overview && <div className="ep-overview">{ep.overview}</div>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
