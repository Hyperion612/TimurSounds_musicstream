import { useMemo, useState } from "react";
import type { ReleaseKind } from "../lib/data";
import { useStore } from "../lib/store";
import { Reveal, SectionHead } from "../components/ui";
import { ReleaseCard } from "../components/cards";

type Filter = "all" | ReleaseKind;

const TABS: { id: Filter; label: string }[] = [
  { id: "all", label: "ВСЕ" },
  { id: "album", label: "АЛЬБОМЫ" },
  { id: "single", label: "СИНГЛЫ" },
  { id: "ep", label: "EP" },
];

export function Music() {
  const { releases, tracks } = useStore();
  const [filter, setFilter] = useState<Filter>("all");

  const sorted = useMemo(
    () =>
      [...releases]
        .filter((r) => filter === "all" || r.kind === filter)
        .sort((a, b) => b.year - a.year || a.title.localeCompare(b.title, "ru")),
    [releases, filter]
  );

  const count = (f: Filter) => (f === "all" ? releases.length : releases.filter((r) => r.kind === f).length);
  const totalTracks = tracks.length;

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 pt-10 md:pt-14">
      <SectionHead
        kicker="Каталог TimurSounds"
        title="Музыка"
        action={
          <span className="hidden md:block text-xs text-paper/40 border border-line rounded-full px-3 py-1.5">
            {releases.length} релизов · {totalTracks} треков
          </span>
        }
      />

      <div className="flex flex-wrap gap-2 mb-8">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={`font-display text-xs md:text-[13px] font-bold tracking-wider px-4 py-2.5 rounded-lg border transition-all ${
              filter === t.id
                ? "bg-blue border-blue text-paper shadow-[0_8px_26px_-8px_rgba(31,91,255,0.8)]"
                : "border-line text-paper/55 hover:text-paper hover:border-linehi hover:-translate-y-0.5"
            }`}
          >
            {t.label}
            <span className={`ml-2 tabular-nums ${filter === t.id ? "text-paper/70" : "text-paper/30"}`}>{count(t.id)}</span>
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <div className="border border-dashed border-line rounded-xl p-14 text-center text-paper/40">
          В этом разделе пока пусто — администратор скоро добавит релизы.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {sorted.map((r, i) => (
            <Reveal key={r.id} delay={(i % 4) * 70}>
              <ReleaseCard releaseId={r.id} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
