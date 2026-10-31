import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Show } from "./types";
import { Poster } from "./Poster";

export function TopBar() {
  return (
    <header className="topbar">
      <Link to="/" className="logo">TV CENTER</Link>
    </header>
  );
}

function year(show: Show) {
  return show.first_air_date ? show.first_air_date.slice(0, 4) : null;
}

export default function App() {
  const [shows, setShows] = useState<Show[] | null>(null);

  useEffect(() => {
    fetch("/api/shows")
      .then((r) => r.json())
      .then(setShows);
  }, []);

  if (shows === null) {
    return (
      <div>
        <TopBar />
        <div className="grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton" />
          ))}
        </div>
      </div>
    );
  }

  const featured = shows.find((s) => s.backdrop_url || s.poster_url);

  return (
    <div>
      <TopBar />

      {shows.length === 0 && (
        <p className="empty">
          No shows yet — make sure your media folder is connected, then use
          File → Rescan Current Folder, or File → Change Media Folder… to pick a
          different one.
        </p>
      )}

      {featured && (
        <section
          className="feature"
          style={{ backgroundImage: `url(${featured.backdrop_url || featured.poster_url})` }}
        >
          <div className="feature-shade">
            <span className="eyebrow">Featured</span>
            <h1>{featured.title}</h1>
            <div className="meta">
              {year(featured) && <span>{year(featured)}</span>}
              {featured.season_count ? (
                <span>
                  {featured.season_count} season{featured.season_count > 1 ? "s" : ""}
                </span>
              ) : null}
              {featured.episode_count ? <span>{featured.episode_count} episodes</span> : null}
            </div>
            {featured.overview && <p className="clamp">{featured.overview}</p>}
            <Link to={`/show/${featured.id}`} className="btn primary">▶ Watch now</Link>
          </div>
        </section>
      )}

      {shows.length > 0 && (
        <>
          <h2 className="section-title">Your library</h2>
          <div className="grid">
            {shows.map((show) => (
              <Link key={show.id} to={`/show/${show.id}`} className="card">
                <div className="card-art">
                  <Poster className="poster" title={show.title} src={show.poster_url} />
                  <div className="card-hover">
                    <span className="play">▶</span>
                    {show.episode_count ? <span>{show.episode_count} episodes</span> : null}
                  </div>
                </div>
                <div className="card-title">{show.title}</div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
