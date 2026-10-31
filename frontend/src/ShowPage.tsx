import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Episode, Show } from "./types";
import { Poster } from "./Poster";
import { TopBar } from "./App";

const code = (ep: Episode) =>
  `S${String(ep.season).padStart(2, "0")}E${String(ep.episode).padStart(2, "0")}`;

export default function ShowPage() {
  const { id } = useParams();
  const [show, setShow] = useState<Show | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [season, setSeason] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/shows/${id}`).then((r) => r.json()).then(setShow);
    fetch(`/api/shows/${id}/episodes`)
      .then((r) => r.json())
      .then((eps: Episode[]) => {
        setEpisodes(eps);
        setSeason(eps.length ? eps[0].season : null);
      });
  }, [id]);

  const seasons = useMemo(
    () => Array.from(new Set(episodes.map((e) => e.season))).sort((a, b) => a - b),
    [episodes]
  );

  if (!show) return null;

  const visible = episodes.filter((e) => e.season === season);
  const art = show.backdrop_url || show.poster_url;

  return (
    <div>
      <TopBar />
      <section className="show-hero" style={art ? { backgroundImage: `url(${art})` } : undefined}>
        <div className="show-hero-shade">
          <Link to="/" className="back-link">← Library</Link>
          <h1>{show.title}</h1>
          <div className="meta">
            {show.first_air_date && <span>{show.first_air_date.slice(0, 4)}</span>}
            <span>{seasons.length} season{seasons.length === 1 ? "" : "s"}</span>
            <span>{episodes.length} episodes</span>
          </div>
          {show.overview && <p className="clamp">{show.overview}</p>}
          {episodes.length > 0 && (
            <Link to={`/watch/${episodes[0].id}`} className="btn primary">
              ▶ Play {code(episodes[0])}
            </Link>
          )}
        </div>
      </section>

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
          <Link key={ep.id} to={`/watch/${ep.id}`} className="episode-row">
            <span className="ep-num">{ep.episode}</span>
            <div className="thumb-wrap">
              <Poster className="episode-thumb" title={show.title} src={ep.thumbnail_url} aspect="16 / 9" showLabel={false} />
              <span className="thumb-play">▶</span>
            </div>
            <div className="ep-info">
              <div className="ep-title">{ep.title || `Episode ${ep.episode}`}</div>
              {ep.overview && <div className="ep-overview">{ep.overview}</div>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
