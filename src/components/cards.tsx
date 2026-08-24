import { Link } from "react-router-dom";
import { ARTISTS, KIND_LABEL, fmtNum, fmtTime } from "../lib/data";
import type { Track } from "../lib/data";
import { usePlayer } from "../lib/player";
import { useStore } from "../lib/store";
import { Cover, Eq } from "./ui";

export function PlayIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden>
      <path d="M4 2.5v11l9-5.5-9-5.5z" fill="currentColor" />
    </svg>
  );
}

export function PauseIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden>
      <rect x="3.5" y="2.5" width="3.4" height="11" rx="1" fill="currentColor" />
      <rect x="9.1" y="2.5" width="3.4" height="11" rx="1" fill="currentColor" />
    </svg>
  );
}

export function HeartIcon({ filled, size = 16 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      <path
        d="M8 13.6S2.2 10 2.2 6.2C2.2 4.3 3.7 3 5.4 3 6.6 3 7.6 3.7 8 4.6 8.4 3.7 9.4 3 10.6 3c1.7 0 3.2 1.3 3.2 3.2C13.8 10 8 13.6 8 13.6z"
        fill={filled ? "#1f5bff" : "none"}
        stroke={filled ? "#1f5bff" : "currentColor"}
        strokeWidth="1.4"
      />
    </svg>
  );
}

/* ---------- track row ---------- */
export function TrackRow({
  track,
  index,
  queue,
  showRelease = true,
}: {
  track: Track;
  index: number;
  queue: string[];
  showRelease?: boolean;
}) {
  const { track: current, playing, playTrack, toggle } = usePlayer();
  const { favs, toggleFav, getRelease } = useStore();
  const isCurrent = current?.id === track.id;
  const rel = track.releaseId ? getRelease(track.releaseId) : undefined;
  const artist = ARTISTS[track.artistId];
  const feat = track.feat ? ARTISTS[track.feat] : null;
  const fav = favs.includes(track.id);

  const onPlay = () => {
    if (isCurrent) toggle();
    else playTrack(track.id, queue);
  };

  return (
    <div
      className={`group grid items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer border border-transparent
        ${isCurrent ? "bg-blue/10 border-line" : "hover:bg-white/[0.04]"}
        grid-cols-[2.25rem_minmax(0,1fr)_3rem_2rem] md:grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,11rem)_5rem_3.5rem_2rem]`}
      onClick={onPlay}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onPlay()}
    >
      <div className="relative w-9 h-6 flex items-center">
        {isCurrent && playing ? (
          <Eq active className="mx-auto" />
        ) : (
          <>
            <span className={`w-full text-center text-sm tabular-nums text-paper/30 group-hover:opacity-0 transition-opacity ${isCurrent ? "text-blue" : ""}`}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-paper">
              {isCurrent ? <PauseIcon /> : <PlayIcon />}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-3 min-w-0">
        <Cover seed={track.seed} title={track.title} className="w-10 h-10 rounded-md shrink-0 border border-line" />
        <div className="min-w-0">
          <div className={`font-semibold truncate leading-tight ${isCurrent ? "text-bluehi" : "text-paper"}`}>{track.title}</div>
          <div className="text-xs text-paper/45 truncate">
            {artist.name}
            {feat && <span className="text-sky"> feat. {feat.name}</span>}
            {track.kind === "file" && <span className="ml-1.5 text-[10px] uppercase tracking-wider text-sky/80 border border-line rounded px-1 py-px">загружен админом</span>}
          </div>
        </div>
      </div>

      {showRelease && (
        <div className="hidden md:block text-sm text-paper/45 truncate">
          {rel ? (
            <Link to={`/release/${rel.id}`} onClick={(e) => e.stopPropagation()} className="hover:text-sky transition-colors">
              {rel.title}
            </Link>
          ) : (
            "вне альбома"
          )}
        </div>
      )}

      <div className="hidden md:block text-sm text-paper/45 tabular-nums text-right">{fmtNum(track.plays)}</div>

      <div className="text-sm text-paper/45 tabular-nums text-right">{fmtTime(track.duration)}</div>

      <button
        className={`justify-self-end p-1.5 rounded transition-all hover:scale-110 ${fav ? "text-blue" : "text-paper/30 hover:text-paper"}`}
        onClick={(e) => {
          e.stopPropagation();
          toggleFav(track.id);
        }}
        aria-label="В избранное"
      >
        <HeartIcon filled={fav} />
      </button>
    </div>
  );
}

/* ---------- release card ---------- */
export function ReleaseCard({ releaseId, delay = 0 }: { releaseId: string; delay?: number }) {
  const { getRelease, tracks } = useStore();
  const { playTrack } = usePlayer();
  const rel = getRelease(releaseId);
  if (!rel) return null;
  const relTracks = tracks.filter((t) => t.releaseId === rel.id);
  const artist = ARTISTS[rel.artistId];

  return (
    <Link to={`/release/${rel.id}`} className="group block focus:outline-none" style={{ transitionDelay: `${delay}ms` }}>
      <div className="relative overflow-hidden rounded-xl border border-line transition-all duration-300 group-hover:border-blue group-hover:-translate-y-1 group-hover:shadow-[0_18px_50px_-18px_rgba(31,91,255,0.55)]">
        <Cover seed={rel.coverSeed} title={rel.title} className="w-full aspect-square block transition-transform duration-500 group-hover:scale-[1.04]" />
        <span className="absolute top-3 left-3 text-[10px] font-display font-bold tracking-[0.2em] bg-ink/85 border border-line text-sky px-2 py-1 rounded">
          {KIND_LABEL[rel.kind]}
        </span>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (relTracks.length) playTrack(relTracks[0].id, relTracks.map((t) => t.id));
          }}
          className="absolute bottom-3 right-3 w-11 h-11 rounded-full bg-blue text-paper flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 hover:bg-bluehi"
          aria-label="Слушать релиз"
        >
          <PlayIcon size={18} className="translate-x-[1px]" />
        </button>
      </div>
      <div className="mt-3 px-1">
        <div className="font-display font-bold text-sm md:text-base uppercase tracking-wide truncate group-hover:text-bluehi transition-colors">{rel.title}</div>
        <div className="text-xs text-paper/45 mt-1">
          {artist.name} · {rel.year} · {relTracks.length} трек{relTracks.length === 1 ? "" : relTracks.length < 5 ? "а" : "ов"}
        </div>
      </div>
    </Link>
  );
}
