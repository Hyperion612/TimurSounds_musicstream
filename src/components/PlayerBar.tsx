import { ARTISTS, fmtTime } from "../lib/data";
import { usePlayer } from "../lib/player";
import { useStore } from "../lib/store";
import { Cover, Eq } from "./ui";
import { HeartIcon, PauseIcon, PlayIcon } from "./cards";

function SkipIcon({ back = false }: { back?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden style={back ? { transform: "scaleX(-1)" } : undefined}>
      <path d="M3 3.5v11l7-5.5-7-5.5z" fill="currentColor" />
      <rect x="12.5" y="3.5" width="2.4" height="11" rx="1" fill="currentColor" />
    </svg>
  );
}

export function PlayerBar() {
  const { track, playing, position, toggle, next, prev, seek, volume, setVolume, repeat, toggleRepeat, queue, qIndex } = usePlayer();
  const { favs, toggleFav } = useStore();

  const dur = track?.duration ?? 0;
  const artist = track ? ARTISTS[track.artistId] : null;
  const feat = track?.feat ? ARTISTS[track.feat] : null;

  return (
    <footer className="fixed bottom-0 inset-x-0 z-50 border-t border-line bg-coal/95 backdrop-blur">
      {/* thin progress line for mobile */}
      <div className="lg:hidden h-[3px] bg-line">
        <div className="h-full bg-blue transition-[width] duration-300" style={{ width: dur ? `${(position / dur) * 100}%` : "0%" }} />
      </div>

      <div className="h-[72px] lg:h-[84px] px-3 lg:px-6 grid grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)_minmax(0,1fr)] items-center gap-3 lg:gap-6">
        {/* meta */}
        <div className="flex items-center gap-3 min-w-0">
          {track ? (
            <>
              <div className="relative shrink-0">
                <Cover seed={track.seed} title={track.title} className={`w-11 h-11 lg:w-12 lg:h-12 rounded-md border border-line ${playing ? "glow" : ""}`} />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate leading-tight">{track.title}</div>
                <div className="text-xs text-paper/45 truncate">
                  {artist?.name}
                  {feat && <span className="text-sky"> feat. {feat.name}</span>}
                </div>
              </div>
              <button
                onClick={() => toggleFav(track.id)}
                className={`hidden sm:block ml-1 p-1.5 rounded transition-all hover:scale-110 ${favs.includes(track.id) ? "text-blue" : "text-paper/30 hover:text-paper"}`}
                aria-label="В избранное"
              >
                <HeartIcon filled={favs.includes(track.id)} />
              </button>
            </>
          ) : (
            <div className="text-sm text-paper/35 hidden sm:block">Включите трек — звук появится здесь</div>
          )}
        </div>

        {/* controls */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 lg:gap-4">
            <button onClick={prev} disabled={!track} className="text-paper/55 hover:text-paper disabled:opacity-25 transition-all hover:scale-110" aria-label="Предыдущий">
              <SkipIcon back />
            </button>
            <button
              onClick={toggle}
              disabled={!track}
              className="w-11 h-11 lg:w-12 lg:h-12 rounded-full bg-blue text-paper flex items-center justify-center hover:bg-bluehi hover:scale-105 active:scale-95 transition-all disabled:opacity-25 disabled:hover:scale-100 shadow-[0_0_28px_rgba(31,91,255,0.5)]"
              aria-label={playing ? "Пауза" : "Играть"}
            >
              {playing ? <PauseIcon size={18} /> : <PlayIcon size={18} className="translate-x-[2px]" />}
            </button>
            <button onClick={next} disabled={!track} className="text-paper/55 hover:text-paper disabled:opacity-25 transition-all hover:scale-110" aria-label="Следующий">
              <SkipIcon />
            </button>
          </div>
          <div className="hidden lg:flex items-center gap-3 w-full max-w-xl">
            <span className="text-[11px] tabular-nums text-paper/40 w-9 text-right">{fmtTime(position)}</span>
            <input
              type="range"
              className="vol flex-1"
              min={0}
              max={Math.max(1, Math.floor(dur))}
              value={Math.min(position, dur)}
              onChange={(e) => seek(Number(e.target.value))}
              disabled={!track}
              style={{ ["--fill" as string]: dur ? `${(position / dur) * 100}%` : "0%" }}
              aria-label="Перемотка"
            />
            <span className="text-[11px] tabular-nums text-paper/40 w-9">{fmtTime(dur)}</span>
          </div>
        </div>

        {/* right side */}
        <div className="hidden lg:flex items-center justify-end gap-4">
          {playing && track && <Eq active />}
          <button
            onClick={toggleRepeat}
            className={`p-1.5 rounded transition-all hover:scale-110 ${repeat ? "text-blue" : "text-paper/40 hover:text-paper"}`}
            aria-label="Повтор"
            title="Повтор трека"
          >
            <svg width="17" height="17" viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.5 6.5v-2h10l-2-2M14.5 10.5v2h-10l2 2" />
              <path d="M12.5 2.5v4M4.5 14.5v-4" opacity="0" />
            </svg>
          </button>
          <div className="flex items-center gap-2 w-32">
            <svg width="17" height="17" viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-paper/50">
              <path d="M2.5 6.5h2.6L9 3.2v10.6L5.1 10.5H2.5z" fill="currentColor" stroke="none" />
              <path d="M11.5 6a3.6 3.6 0 0 1 0 5M13.4 4.2a6.2 6.2 0 0 1 0 8.6" />
            </svg>
            <input
              type="range"
              className="vol flex-1"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              onChange={(e) => setVolume(Number(e.target.value) / 100)}
              style={{ ["--fill" as string]: `${volume * 100}%` }}
              aria-label="Громкость"
            />
          </div>
          <div className="text-[11px] text-paper/35 tabular-nums border border-line rounded px-2 py-1">
            {track ? `${qIndex + 1} / ${queue.length}` : "— / —"}
          </div>
        </div>
      </div>
    </footer>
  );
}
