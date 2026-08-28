import { Link } from "react-router-dom";
import { KIND_LABEL, fmtNum, fmtTime } from "../lib/data";
import { usePlayer } from "../lib/player";
import { useStore } from "../lib/store";
import { Cover } from "./ui";
import type { Release, Track } from "../lib/data";

/**
 * Единая сетка таблицы треков. Используют и шапки страниц, и TrackRow —
 * поэтому колонки «Плеи» и «Время» всегда стоят ровно под заголовками.
 */
export const TRACK_GRID = "md:grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,11rem)_5rem_3.5rem_2rem]";

export function PlayIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" className={className} aria-hidden>
      <path d="M3 1.8v10.4c0 .5.55.8.98.55l8.2-5.2a.65.65 0 0 0 0-1.1L3.98 1.25A.65.65 0 0 0 3 1.8z" fill="currentColor" />
    </svg>
  );
}

export function PauseIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden>
      <rect x="2.6" y="1.8" width="3.2" height="10.4" rx="1" fill="currentColor" />
      <rect x="8.2" y="1.8" width="3.2" height="10.4" rx="1" fill="currentColor" />
    </svg>
  );
}

export function HeartIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 14c1.5-1.5 2.5-3.2 2.5-5.2A5.3 5.3 0 0 0 12 5.6 5.3 5.3 0 0 0 2.5 8.8c0 2 1 3.7 2.5 5.2l7 6.8z" />
    </svg>
  );
}

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
  const { playTrack, track: current, playing, prefetchTrack } = usePlayer();
  const { favs, toggleFav, artist, playsOf, getRelease } = useStore();
  const active = current?.id === track.id;
  const rel = track.releaseId ? getRelease(track.releaseId) : undefined;
  const a = artist(track.artistId);
  const feat = track.feat ? artist(track.feat) : undefined;
  const plays = playsOf(track.id);

  return (
    <div
      onMouseEnter={() => prefetchTrack(track)}
      className={`group grid grid-cols-[2.25rem_minmax(0,1fr)_3.5rem_2rem] ${TRACK_GRID} gap-3 items-center px-3 py-2.5 rounded-lg transition-colors ${
        active ? "bg-blue/10 border border-blue/25" : "hover:bg-white/[0.04] border border-transparent"
      }`}
    >
      <button
        onClick={() => playTrack(track.id, queue)}
        className="relative w-9 h-9 flex items-center justify-center text-paper/35 group-hover:text-paper transition-colors"
        aria-label={`Играть ${track.title}`}
      >
        {active && playing ? (
          <span className="eq">
            <span /><span /><span /><span />
          </span>
        ) : (
          <>
            <span className={`text-sm tabular-nums transition-opacity ${active ? "opacity-0" : "group-hover:opacity-0"}`}>{index + 1}</span>
            <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 text-blue transition-opacity">
              <PlayIcon />
            </span>
          </>
        )}
      </button>

      <div className="flex items-center gap-3 min-w-0">
        <Cover
          seed={track.seed}
          title={track.title}
          cover={track.cover}
          className="hidden sm:block w-10 h-10 rounded-md border border-line shrink-0"
        />
        <div className="min-w-0">
          <div className={`font-medium truncate leading-tight ${active ? "text-bluehi" : "text-paper"}`}>{track.title}</div>
          <div className="text-xs text-paper/45 truncate mt-0.5">
            <Link to={`/artist/${track.artistId}`} className="hover:text-sky transition-colors">{a.name}</Link>
            {feat && <span> feat. <Link to={`/artist/${track.feat}`} className="hover:text-sky transition-colors">{feat.name}</Link></span>}
            {track.kind === "file" && <span className="text-sky/70"> · аудио</span>}
          </div>
        </div>
      </div>

      {/* колонка «РЕЛИЗ» — ячейка есть всегда, иначе едут «Плеи» и «Время» */}
      <div className="hidden md:block min-w-0">
        {showRelease &&
          (rel ? (
            <Link to={`/release/${rel.id}`} className="text-xs text-paper/40 hover:text-sky truncate block transition-colors">
              {rel.title}
            </Link>
          ) : (
            <span className="text-xs text-paper/25">—</span>
          ))}
      </div>

      <div className="hidden md:block text-right text-xs text-paper/35 tabular-nums">{plays > 0 ? fmtNum(plays) : "—"}</div>
      <div className="text-right text-xs text-paper/50 tabular-nums">{fmtTime(track.duration)}</div>

      <button
        onClick={() => toggleFav(track.id)}
        className={`justify-self-end p-1 rounded transition-all hover:scale-125 ${favs.includes(track.id) ? "text-blue opacity-100" : "text-paper/30 opacity-0 group-hover:opacity-100 hover:text-paper"}`}
        aria-label="В избранное"
      >
        <HeartIcon filled={favs.includes(track.id)} />
      </button>
    </div>
  );
}

export function ReleaseCard({ releaseId }: { releaseId: string }) {
  const { getRelease, tracks, playsOf, artist } = useStore();
  const rel = getRelease(releaseId);
  if (!rel) return null;
  const count = tracks.filter((t) => t.releaseId === rel.id).length;
  const streams = tracks.reduce((s: number, t: Track) => (t.releaseId === rel.id ? s + playsOf(t.id) : s), 0);
  const a = artist(rel.artistId);

  return (
    <Link to={`/release/${rel.id}`} className="group block">
      <div className="relative overflow-hidden rounded-xl border border-line group-hover:border-blue transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-[0_18px_44px_-18px_rgba(31,91,255,0.55)]">
        <Cover
          seed={rel.coverSeed}
          title={rel.title}
          cover={rel.cover}
          className="w-full aspect-square transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <span className="absolute top-2.5 left-2.5 text-[10px] font-display font-bold tracking-[0.18em] bg-ink/85 border border-line text-sky px-2 py-1 rounded">
          {KIND_LABEL[rel.kind]}
        </span>
        <span className="absolute bottom-2.5 right-2.5 w-9 h-9 rounded-full bg-blue text-paper flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
          <PlayIcon className="translate-x-[1px]" />
        </span>
      </div>
      <div className="mt-3 px-0.5">
        <div className="font-display font-bold text-sm uppercase tracking-wide truncate group-hover:text-bluehi transition-colors">{rel.title}</div>
        <div className="text-xs text-paper/40 mt-0.5">{a.name} · {rel.year}</div>
        <div className="text-[11px] text-paper/30 mt-0.5 tabular-nums">{count} трек(ов) · {fmtNum(streams)} стримов</div>
      </div>
    </Link>
  );
}

export function ArtistCard({ artistId }: { artistId: "timur" | "instasamka" }) {
  const { artist, artistPlays, tracks } = useStore();
  const a = artist(artistId);
  const main = artistId === "timur";
  const plays = artistPlays(artistId);
  const trackCount = tracks.filter((t) => t.artistId === artistId || t.feat === artistId).length;

  return (
    <Link
      to={`/artist/${artistId}`}
      className="group relative block overflow-hidden rounded-xl border border-line bg-coal p-6 transition-all duration-300 hover:-translate-y-1.5 hover:border-blue hover:shadow-[0_20px_50px_-20px_rgba(31,91,255,0.5)]"
    >
      <div className="absolute inset-0 bg-grid opacity-40 group-hover:opacity-80 transition-opacity" />
      <div className={`absolute -top-16 w-44 h-44 rounded-full bg-blue/15 blur-[60px] transition-all duration-500 group-hover:bg-blue/30 ${main ? "-right-16" : "-left-16"}`} />
      <div className="relative">
        <div className="flex items-start justify-between">
          <MonogramMini main={main} />
          {main && (
            <span className="text-[9px] font-display font-bold tracking-[0.2em] bg-blue text-paper px-2 py-1 rounded">ОСНОВНОЙ АРТИСТ</span>
          )}
        </div>
        <div className="mt-8 font-display font-black text-2xl md:text-3xl uppercase tracking-tight group-hover:text-bluehi transition-colors">{a.name}</div>
        <div className="text-xs text-sky mt-1.5">{a.label}</div>
        <div className="text-xs text-paper/45 mt-3 leading-relaxed line-clamp-2">{a.role}</div>
        <div className="mt-5 flex items-center gap-2 text-[11px] text-paper/40 tabular-nums">
          <span className="w-1.5 h-1.5 rounded-full bg-blue live-dot" />
          {trackCount} трек(ов) · {fmtNum(plays)} прослушиваний
        </div>
      </div>
    </Link>
  );
}

function MonogramMini({ main }: { main: boolean }) {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden className="transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
      <rect x="1" y="1" width="50" height="50" rx="10" fill="#0e1220" stroke="#2a3352" />
      <rect x="1" y="1" width="50" height="50" rx="10" fill="url(#mg-a)" opacity="0.5" />
      <defs>
        <linearGradient id="mg-a" x1="0" y1="0" x2="52" y2="52">
          <stop stopColor="#1f5bff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#1f5bff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <text
        x="26"
        y="34"
        textAnchor="middle"
        fontFamily="Unbounded, sans-serif"
        fontWeight="800"
        fontSize={main ? 22 : 15}
        fill={main ? "#f2f5ff" : "#8fb0ff"}
      >
        {main ? "T" : "IS"}
      </text>
    </svg>
  );
}
