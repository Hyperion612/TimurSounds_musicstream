import { Link, useParams } from "react-router-dom";
import { fmtNum, pluralRu } from "../lib/data";
import type { ArtistId } from "../lib/data";
import { usePlayer } from "../lib/player";
import { useStore } from "../lib/store";
import { CountUp, Monogram, Reveal, SectionHead } from "../components/ui";
import { PlayIcon, ReleaseCard, TRACK_GRID, TrackRow } from "../components/cards";

export function ArtistPage() {
  const { id } = useParams();
  const { tracks, releases, artistPlays, artist, playsOf } = useStore();
  const { playTrack } = usePlayer();

  const artistId = (id === "timur" || id === "instasamka" ? id : undefined) as ArtistId | undefined;
  const a = artistId ? artist(artistId) : undefined;

  if (!a || !artistId) {
    return (
      <div className="max-w-3xl mx-auto px-4 pt-24 text-center">
        <div className="font-display font-black text-5xl text-blue mb-4">404</div>
        <p className="text-paper/55 mb-8">Такого артиста на площадке нет.</p>
        <Link to="/" className="text-sky font-semibold hover:text-bluehi transition-colors">← На главную</Link>
      </div>
    );
  }

  const artistTracks = [...tracks]
    .filter((t) => t.artistId === artistId || t.feat === artistId)
    .sort((x, y) => playsOf(y.id) - playsOf(x.id) || y.addedAt - x.addedAt);
  const queue = artistTracks.map((t) => t.id);
  const artistReleases = releases.filter((r) => r.artistId === artistId).sort((x, y) => y.year - x.year);
  const totalPlays = artistPlays(artistId);
  const isMain = artistId === "timur";

  return (
    <div>
      {/* banner */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 bg-grid opacity-70" />
        <div className={`absolute -top-32 w-[480px] h-[480px] rounded-full bg-blue/15 blur-[110px] pointer-events-none ${isMain ? "-right-32" : "-left-32"}`} />
        <div className="relative max-w-6xl mx-auto px-4 md:px-8 pt-12 md:pt-16 pb-10 grid md:grid-cols-[220px_1fr] gap-8 items-end">
          <Reveal>
            <div className="relative w-44 h-44 md:w-56 md:h-56">
              <Monogram seed={isMain ? 13 : 77} text={isMain ? "T" : "IS"} className="w-full h-full rounded-2xl border border-line shadow-[0_24px_70px_-20px_rgba(31,91,255,0.5)]" />
              {isMain && (
                <span className="absolute -top-3 -right-3 bg-blue text-paper text-[9px] font-display font-bold tracking-[0.2em] px-2.5 py-1.5 rounded">ОСНОВНОЙ АРТИСТ</span>
              )}
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="text-[10px] tracking-[0.3em] text-sky font-semibold border border-line rounded-full px-3 py-1.5 bg-coal/70">{a.label.toUpperCase()}</span>
                <span className="flex items-center gap-2 text-xs text-paper/50"><span className="w-1.5 h-1.5 rounded-full bg-blue live-dot" />на площадке</span>
              </div>
              <h1 className="font-display font-black text-5xl md:text-7xl uppercase tracking-tight leading-none">{a.name}</h1>
              <p className="mt-3 text-paper/55 text-sm md:text-base">{a.role}</p>
              <p className="mt-4 max-w-2xl text-paper/60 leading-relaxed text-sm md:text-[15px]">{a.bio}</p>
              <div className="mt-6 flex flex-wrap items-center gap-6">
                <button
                  onClick={() => artistTracks[0] && playTrack(artistTracks[0].id, queue)}
                  disabled={!artistTracks.length}
                  className="group flex items-center gap-3 bg-blue hover:bg-bluehi disabled:opacity-30 text-paper font-display font-bold text-sm tracking-wider px-6 py-3.5 rounded-lg transition-all hover:-translate-y-0.5 active:scale-95 shadow-[0_10px_36px_-10px_rgba(31,91,255,0.7)]"
                >
                  <span className="w-7 h-7 rounded-full bg-ink/25 flex items-center justify-center group-hover:scale-110 transition-transform"><PlayIcon size={13} className="translate-x-px" /></span>
                  СЛУШАТЬ
                </button>
                <div className="flex gap-6">
                  <div>
                    <div className="font-display font-bold text-xl"><CountUp to={totalPlays} /></div>
                    <div className="text-[10px] tracking-[0.2em] text-paper/40 uppercase mt-1">{pluralRu(totalPlays, "прослушивание", "прослушивания", "прослушиваний")}</div>
                  </div>
                  <div>
                    <div className="font-display font-bold text-xl">{artistTracks.length}</div>
                    <div className="text-[10px] tracking-[0.2em] text-paper/40 uppercase mt-1">{pluralRu(artistTracks.length, "трек", "трека", "треков")}</div>
                  </div>
                  <div>
                    <div className="font-display font-bold text-xl">{artistReleases.length}</div>
                    <div className="text-[10px] tracking-[0.2em] text-paper/40 uppercase mt-1">{pluralRu(artistReleases.length, "релиз", "релиза", "релизов")}</div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 md:px-8 pt-12">
        {/* popular tracks */}
        <SectionHead kicker="Самое громкое" title="Популярные треки" />
        <Reveal>
          {artistTracks.length ? (
            <div className="border border-line rounded-xl bg-coal/40 p-2 md:p-3 divide-y divide-line/60">
              <div className={`hidden md:grid ${TRACK_GRID} gap-3 px-3 pb-2 text-[10px] tracking-[0.25em] text-paper/30 font-semibold`}>
                <span className="text-center">#</span>
                <span>ТРЕК</span>
                <span>РЕЛИЗ</span>
                <span className="text-right">ПЛЕИ</span>
                <span className="text-right">ВРЕМЯ</span>
                <span />
              </div>
              {artistTracks.map((t, i) => <TrackRow key={t.id} track={t} index={i} queue={queue} />)}
            </div>
          ) : (
            <div className="border border-dashed border-line rounded-xl p-12 text-center bg-coal/30">
              <div className="font-display font-bold text-xl uppercase text-paper/60">Треков пока нет</div>
              <p className="mt-2 text-paper/40 text-sm max-w-md mx-auto">
                Администратор загрузит {pluralRu(0, "первый трек", "первые треки", "первые треки")} {a.name} — и они сразу появятся здесь.
              </p>
            </div>
          )}
        </Reveal>

        {/* releases */}
        <div className="pt-14">
          <SectionHead
            kicker="Дискография"
            title="Релизы"
            action={
              <span className="text-xs text-paper/40 border border-line rounded-full px-3 py-1.5 tabular-nums">
                {artistReleases.length} · суммарно {fmtNum(totalPlays)} {pluralRu(totalPlays, "стрим", "стрима", "стримов")}
              </span>
            }
          />
          {artistReleases.length ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 pb-6">
              {artistReleases.map((r, i) => (
                <Reveal key={r.id} delay={(i % 4) * 70}>
                  <ReleaseCard releaseId={r.id} />
                </Reveal>
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-line rounded-xl p-12 text-center bg-coal/30">
              <div className="font-display font-bold text-xl uppercase text-paper/60">Релизы скоро будут</div>
              <p className="mt-2 text-paper/40 text-sm">Администратор создаёт релизы в админ-панели — они появятся здесь у всех слушателей.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
