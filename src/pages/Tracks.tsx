import { useMemo, useState } from "react";
import { fmtNum, pluralRu } from "../lib/data";
import type { ArtistId } from "../lib/data";
import { useStore } from "../lib/store";
import { Reveal } from "../components/ui";
import { TrackRow } from "../components/cards";

export function Tracks() {
  const { tracks, playsOf, artist } = useStore();
  const [q, setQ] = useState("");
  const [artistFilter, setArtistFilter] = useState<"all" | ArtistId>("all");
  const [sort, setSort] = useState<"new" | "popular" | "az">("new");

  const filtered = useMemo(() => {
    let list = [...tracks];
    if (artistFilter !== "all") list = list.filter((t) => t.artistId === artistFilter || t.feat === artistFilter);
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter((t) => {
        const featName = t.feat ? artist(t.feat).name : "";
        return (
          t.title.toLowerCase().includes(query) ||
          artist(t.artistId).name.toLowerCase().includes(query) ||
          featName.toLowerCase().includes(query)
        );
      });
    }
    if (sort === "popular") list.sort((a, b) => playsOf(b.id) - playsOf(a.id));
    else if (sort === "az") list.sort((a, b) => a.title.localeCompare(b.title, "ru"));
    else list.sort((a, b) => b.addedAt - a.addedAt);
    return list;
  }, [tracks, q, artistFilter, sort, playsOf, artist]);

  const queue = filtered.map((t) => t.id);
  const totalStreams = tracks.reduce((s, t) => s + playsOf(t.id), 0);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 pt-10 md:pt-14">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-[3px] bg-blue" />
              <span className="text-[11px] tracking-[0.3em] text-sky font-semibold">ВСЁ, ЧТО МОЖНО ВКЛЮЧИТЬ</span>
            </div>
            <h1 className="font-display text-3xl md:text-5xl font-black uppercase tracking-tight">Треки</h1>
            <p className="mt-2 text-paper/45 text-sm tabular-nums">
              {tracks.length} {pluralRu(tracks.length, "трек", "трека", "треков")} · {fmtNum(totalStreams)} {pluralRu(totalStreams, "реальное прослушивание", "реальных прослушивания", "реальных прослушиваний")}
            </p>
          </div>
        </div>
      </Reveal>

      <Reveal delay={100}>
        <div className="flex flex-col md:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-paper/30" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск по названию или артисту…"
              className="w-full bg-coal border border-line focus:border-blue outline-none rounded-lg pl-11 pr-4 py-3 text-sm placeholder:text-paper/30 transition-colors"
            />
          </div>
          <div className="flex gap-3">
            <select value={artistFilter} onChange={(e) => setArtistFilter(e.target.value as "all" | ArtistId)} className="bg-coal border border-line focus:border-blue outline-none rounded-lg px-4 py-3 text-sm transition-colors">
              <option value="all">Все артисты</option>
              <option value="timur">TIMUR</option>
              <option value="instasamka">INSTASAMKA</option>
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as "new" | "popular" | "az")} className="bg-coal border border-line focus:border-blue outline-none rounded-lg px-4 py-3 text-sm transition-colors">
              <option value="new">Сначала новые</option>
              <option value="popular">Сначала популярные</option>
              <option value="az">По алфавиту</option>
            </select>
          </div>
        </div>
      </Reveal>

      <Reveal delay={160}>
        {filtered.length ? (
          <div className="border border-line rounded-xl bg-coal/40 p-2 md:p-3 divide-y divide-line/60">
            <div className="hidden md:grid grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,11rem)_5rem_3.5rem_2rem] gap-3 px-3 pb-2 text-[10px] tracking-[0.25em] text-paper/30 font-semibold">
              <span className="text-center">#</span>
              <span>ТРЕК</span>
              <span>РЕЛИЗ</span>
              <span className="text-right">ПЛЕИ</span>
              <span className="text-right">ВРЕМЯ</span>
              <span />
            </div>
            {filtered.map((t, i) => (
              <TrackRow key={t.id} track={t} index={i} queue={queue} />
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-line rounded-xl p-12 md:p-16 text-center bg-coal/30">
            <div className="eq mx-auto mb-5 paused"><span /><span /><span /><span /></div>
            <div className="font-display font-black text-2xl uppercase text-paper/70">
              {tracks.length === 0 ? "Тишина в эфире" : "Ничего не найдено"}
            </div>
            <p className="mt-3 text-paper/40 text-sm max-w-md mx-auto leading-relaxed">
              {tracks.length === 0
                ? "Администратор ещё не загрузил треки на площадку. Как только загрузит — они появятся здесь у всех слушателей."
                : "Попробуйте изменить запрос или сбросить фильтры."}
            </p>
          </div>
        )}
      </Reveal>
    </div>
  );
}
