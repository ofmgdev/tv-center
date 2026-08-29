// Deterministic, good-looking gradient placeholder for shows/episodes that
// don't have real poster/thumbnail art yet (no TMDb/Google key configured).
// Once a real image URL exists, that's used instead — this is just a fallback.

const PALETTES: [string, string][] = [
  ["#8E2DE2", "#4A00E0"],
  ["#e50914", "#b81d24"],
  ["#f7971e", "#ffd200"],
  ["#00b09b", "#96c93d"],
  ["#2193b0", "#6dd5ed"],
  ["#ee0979", "#ff6a00"],
  ["#654ea3", "#eaafc8"],
  ["#0f2027", "#2c5364"],
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function paletteFor(title: string): [string, string] {
  return PALETTES[hashString(title) % PALETTES.length];
}

export function Poster({
  title,
  src,
  className,
  aspect = "2 / 3",
  showLabel = true,
}: {
  title: string;
  src?: string | null;
  className?: string;
  aspect?: string;
  showLabel?: boolean;
}) {
  if (src) {
    return <img className={className} src={src} alt={title} style={{ aspectRatio: aspect }} />;
  }

  const [from, to] = paletteFor(title);

  return (
    <div
      className={className}
      style={{
        aspectRatio: aspect,
        background: `linear-gradient(160deg, ${from}, ${to})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: 12,
        borderRadius: 6,
        fontWeight: 700,
        color: "rgba(255,255,255,0.92)",
        textShadow: "0 1px 3px rgba(0,0,0,0.4)",
        lineHeight: 1.25,
      }}
    >
      {showLabel && title}
    </div>
  );
}
