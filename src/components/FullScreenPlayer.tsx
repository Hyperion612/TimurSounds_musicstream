import { useState } from "react";
import { fmtTime } from "../lib/data";
import { usePlayer } from "../lib/player";
import { useStore } from "../lib/store";
import { Cover } from "./ui";
import { HeartIcon, PauseIcon, PlayIcon } from "./cards";

interface FullScreenPlayerProps {
  isOpen: boolean;
  onClose: () => void;
}

function ShuffleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
    </svg>
  );
}

function RepeatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function SkipIcon({ back = false, size = 24 }: { back?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden style={back ? { transform: "scaleX(-1)" } : undefined}>
      <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
    </svg>
  );
}

function CastIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2" />
      <line x1="2" y1="20" x2="2" y2="20" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}

export function FullScreenPlayer({ isOpen, onClose }: FullScreenPlayerProps) {
  const { track, playing, position, toggle, next, prev, seek, repeat, toggleRepeat, queue, qIndex } = usePlayer();
  const { favs, toggleFav, artist: getArtist } = useStore();
  const [shuffle, setShuffle] = useState(false);

  const dur = track?.duration ?? 0;
  const artist = track ? getArtist(track.artistId) : null;
  const feat = track?.feat ? getArtist(track.feat) : null;

  if (!track) return null;

  const progress = dur ? (position / dur) * 100 : 0;

  return (
    <div
      className={`fixed inset-0 z-[100] transition-transform duration-300 ease-out ${
        isOpen ? "translate-y-0" : "translate-y-full"
      }`}
      style={{
        background: "linear-gradient(180deg, #0a0c14 0%, #05060a 100%)",
      }}
    >
      <div className="h-full flex flex-col px-6 py-4 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onClose}
            className="p-2 text-paper/60 hover:text-paper transition-colors"
            aria-label="Закрыть"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 text-paper/70 text-xs font-medium hover:bg-white/10 transition-colors">
              <DownloadIcon />
              <span>Скачанное</span>
            </button>
            <button className="p-2 text-paper/60 hover:text-paper transition-colors" aria-label="Cast">
              <CastIcon />
            </button>
            <button className="p-2 text-paper/60 hover:text-paper transition-colors" aria-label="Меню">
              <MenuIcon />
            </button>
          </div>
        </div>

        {/* Cover */}
        <div className="flex-1 flex items-center justify-center mb-8">
          <div className="w-full max-w-[400px] aspect-square">
            <Cover
              seed={track.seed}
              title={track.title}
              cover={track.cover}
              className="w-full h-full rounded-2xl shadow-2xl"
            />
          </div>
        </div>

        {/* Track Info */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-paper truncate">{track.title}</h2>
              <p className="text-sm text-paper/60 truncate">
                {artist?.name}
                {feat && <span className="text-sky"> feat. {feat.name}</span>}
              </p>
            </div>
            <button
              onClick={() => toggleFav(track.id)}
              className={`ml-4 p-2 rounded-full transition-all hover:scale-110 ${
                favs.includes(track.id) ? "text-blue" : "text-paper/40 hover:text-paper"
              }`}
              aria-label={favs.includes(track.id) ? "Убрать из избранного" : "В избранное"}
            >
              <HeartIcon filled={favs.includes(track.id)} />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="relative h-1 bg-white/10 rounded-full overflow-hidden mb-2">
            <div
              className="absolute left-0 top-0 h-full bg-blue rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-paper/50 tabular-nums">
            <span>{fmtTime(position)}</span>
            <span>{fmtTime(dur)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={toggleRepeat}
            className={`p-3 rounded-full transition-all hover:scale-110 ${
              repeat ? "text-blue" : "text-paper/60 hover:text-paper"
            }`}
            aria-label="Повтор"
          >
            <RepeatIcon />
          </button>
          
          <button
            onClick={prev}
            className="p-3 text-paper/80 hover:text-paper transition-all hover:scale-110"
            aria-label="Предыдущий"
          >
            <SkipIcon back size={28} />
          </button>
          
          <button
            onClick={toggle}
            className="w-16 h-16 rounded-full bg-blue text-paper flex items-center justify-center hover:bg-bluehi hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_rgba(31,91,255,0.6)]"
            aria-label={playing ? "Пауза" : "Играть"}
          >
            {playing ? <PauseIcon size={28} /> : <PlayIcon size={28} className="translate-x-[3px]" />}
          </button>
          
          <button
            onClick={next}
            className="p-3 text-paper/80 hover:text-paper transition-all hover:scale-110"
            aria-label="Следующий"
          >
            <SkipIcon size={28} />
          </button>
          
          <button
            onClick={() => setShuffle(!shuffle)}
            className={`p-3 rounded-full transition-all hover:scale-110 ${
              shuffle ? "text-blue" : "text-paper/60 hover:text-paper"
            }`}
            aria-label="Перемешать"
          >
            <ShuffleIcon />
          </button>
        </div>

        {/* Bottom Pills */}
        <div className="flex items-center justify-center gap-3">
          <button className="px-4 py-2 rounded-full bg-white/5 text-paper/70 text-xs font-medium hover:bg-white/10 transition-colors">
            Текст песни
          </button>
          <button className="px-4 py-2 rounded-full bg-white/5 text-paper/70 text-xs font-medium hover:bg-white/10 transition-colors">
            Похожие треки
          </button>
          <button className="px-4 py-2 rounded-full bg-white/5 text-paper/70 text-xs font-medium hover:bg-white/10 transition-colors">
            Поделиться
          </button>
        </div>
      </div>
    </div>
  );
}
