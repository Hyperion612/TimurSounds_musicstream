import { useMemo, useState } from "react";
import { ARTISTS } from "../lib/data";
import type { ArtistId } from "../lib/data";
import { usePlayer } from "../lib/player";
import { useStore } from "../lib/store";
import { Reveal, SectionHead } from "../components/ui";
import { PlayIcon, TrackRow } from "../components/cards";

type ArtistFilter = "all" | ArtistId;
type Sort = "new" | "top";

export function Tracks() {
  const { tracks } = useStore();
  const { playTrack } = usePlayer();
  const [q, setQ] = useState("");
  const [artist, setArtist] = useState<ArtistFilter>("all");
  const [sort, setSort] = useState<Sort>("new");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = tracks.filter((t) => {
      if (artist !== "all" && t.artistId !== artist && t.feat !== artist) return false;
      if (!query) return true;
      const feat = t.feat ? ARTISTS[t.feat].name : "";
      return (
        t.title.toLowerCase().includes(query) ||
        ARTISTS[t.artistId].name.toLowerCase().includes(query) ||
        feat.toLowerCase().includes(query)
      );
    });
    list = [...list].sort((a, b) => (sort === "new" ? b.addedAt - a.addedAt : b.plays - a.plays));
    return list;
  }, [tracks, q, artist, sort]);

  const queue = filtered.map((t) => t.id);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 pt-10 md:pt-14">
      <SectionHead
        kicker="Всё, что можно включить"
        title="Треки"
        action={
          <button
            onClick={() => filtered[0] && playTrack(filtered[0].id, queue)}
            disabled={!filtered.length}
            className="flex items-center gap-2.5 bg-blue hover:bg-bluehi disabled:opacity-30 text-paper font-display font-bold text-xs tracking-wider px-5 py-3 rounded-lg transition-all hover:-translate-y-0.5 active:scale-95"
          >
            <PlayIcon size={13} className="translate-x-px" />
            ИГРАТЬ ВСЁ
          </button>
        }
      />

      {/* controls */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <label className="relative flex-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-paper/35">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по названию или артисту…"
            className="w-full bg-coal border border-line focus:border-blue outline-none rounded-lg pl-10 pr-4 py-3 text-sm placeholder:text-paper/30 transition-colors"
          />
        </label>
        <div className="flex gap-2">
          {([
            { id: "all", label: "ВСЕ АРТИСТЫ" },
            { id: "timur", label: "TIMUR" },
            { id: "instasamka", label: "INSTASAMKA" },
          ] as { id: ArtistFilter; label: string }[]).map((a) => (
            <button
              key={a.id}
              onClick={() => setArtist(a.id)}
              className={`font-display text-[11px] font-bold tracking-wider px-4 rounded-lg border transition-all ${
                artist === a.id ? "bg-paper text-ink border-paper" : "border-line text-paper/55 hover:text-paper hover:border-linehi"
              }`}
            >
              {a.label}
            </button>
          ))}
          <button
            onClick={() => setSort((s) => (s === "new" ? "top" : "new"))}
            className="font-display text-[11px] font-bold tracking-wider px-4 rounded-lg border border-line text-sky hover:border-blue transition-all whitespace-nowrap"
            title="Переключить сортировку"
          >
            {sort === "new" ? "СНАЧАЛА НОВЫЕ" : "СНАЧАЛА ПОПУЛЯРНЫЕ"}
          </button>
        </div>
      </div>

      <div className="text-xs text-paper/40 mb-3">
        Найдено: <span className="text-paper font-semibold tabular-nums">{filtered.length}</span>
      </div>

      <Reveal>
        <div className="border border-line rounded-xl bg-coal/40 p-2 md:p-3 divide-y divide-line/60">
          <div className="hidden md:grid grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,11rem)_5rem_3.5rem_2rem] gap-3 px-3 pb-2 text-[10px] tracking-[0.25em] text-paper/30 font-semibold">
            <span className="text-center">#</span>
            <span>ТРЕК</span>
            <span>РЕЛИЗ</span>
            <span className="text-right">ПЛЕИ</span>
            <span className="text-right">ВРЕМЯ</span>
            <span />
          </div>
          {filtered.length ? (
            filtered.map((t, i) => <TrackRow key={t.id} track={t} index={i} queue={queue} />)
          ) : (
            <div className="p-12 text-center text-paper/40">Ничего не нашлось. Попробуйте другой запрос.</div>
          )}
        </div>
      </Reveal>
    </div>
  );
}
