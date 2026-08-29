import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Show } from "./types";
import { Poster } from "./Poster";

export default function App() {
  const [shows, setShows] = useState<Show[]>([]);

  useEffect(() => {
    fetch("/api/shows")
      .then((r) => r.json())
      .then(setShows);
  }, []);

  return (
    <div>
      <div className="topbar">TV Center</div>
      {shows.length === 0 && (
        <p style={{ padding: "0 40px", opacity: 0.6 }}>
          No shows yet — run the Python scanner to add your media.
        </p>
      )}
      <div className="grid">
        {shows.map((show) => (
          <Link key={show.id} to={`/show/${show.id}`} className="card">
            <Poster className="poster" title={show.title} src={show.poster_url} />
            <div className="card-title">{show.title}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
