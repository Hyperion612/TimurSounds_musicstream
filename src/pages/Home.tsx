import { Link } from "react-router-dom";
import { fmtDate, fmtNum, pluralRu } from "../lib/data";
import type { NewsItem, NewsTag, Upcoming } from "../lib/data";
import { usePlayer } from "../lib/player";
import { useStore } from "../lib/store";
import { useWave } from "../lib/wave";
import { Countdown, Monogram, Reveal, SectionHead } from "../components/ui";
import { ArtistCard, PlayIcon, TRACK_GRID, TrackRow } from "../components/cards";

const TAG_COLOR: Record<NewsTag, string> = {
  релиз: "text-sky border-blue/40 bg-blue/15",
  обновление: "text-paper/70 border-linehi bg-white/[0.04]",
  событие: "text-blue border-blue/50 bg-blue/10",
};

function LogoHero() {
  const { playing } = usePlayer();
  const canvasRef = useWave(playing);
  return (
    <section className="relative overflow-hidden border-b border-line">
      <div className="absolute inset-0 bg-grid" />
      <div className="absolute -top-40 -left-40 w-[560px] h-[560px] rounded-full bg-blue/20 blur-[130px] pointer-events-none" />
      <div className="absolute -bottom-52 right-0 w-[480px] h-[480px] rounded-full bg-blue/10 blur-[120px] pointer-events-none" />
      <div className="relative max-w-6xl mx-auto px-4 md:px-8 pt-14 md:pt-20 pb-10">
        <div className="grid lg:grid-cols-[1fr_320px] gap-10 items-center">
          <div>
            <Reveal>
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <span className="text-[11px] tracking-[0.3em] text-sky font-semibold border border-line rounded-full px-3.5 py-1.5 bg-coal/70">
                  СТРИМИНГОВАЯ ПЛОЩАДКА ЛЕЙБЛА
                </span>
                <span className="flex items-center gap-2 text-xs text-paper/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue live-dot" />
                  {pluralRu(3, "чёрный", "чёрных", "чёрных")} · синий · белый
                </span>
              </div>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="font-display font-black uppercase leading-[0.95] tracking-tight text-[13vw] sm:text-7xl lg:text-[92px]">
                <span className="block">TIMUR</span>
                <span className="block text-blue">SOUNDS</span>
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-6 max-w-xl text-paper/60 text-base md:text-lg leading-relaxed">
                Дом звука продюсера <span className="text-paper font-semibold">TIMUR</span> и страница с релизами{" "}
                <span className="text-paper font-semibold">INSTASAMKA</span>. Релизы, новости и премьеры — в одном месте,
                в трёх цветах.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/tracks"
                  className="group flex items-center gap-3 bg-blue hover:bg-bluehi text-paper font-display font-bold text-sm tracking-wider px-7 py-4 rounded-lg transition-all hover:-translate-y-0.5 active:scale-95 shadow-[0_10px_36px_-10px_rgba(31,91,255,0.7)]"
                >
                  <span className="w-7 h-7 rounded-full bg-ink/25 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <PlayIcon size={13} className="translate-x-px" />
                  </span>
                  СЛУШАТЬ
                </Link>
                <Link
                  to="/music"
                  className="border border-linehi hover:border-blue px-7 py-4 rounded-lg font-display font-bold text-sm tracking-wider transition-all hover:-translate-y-0.5 hover:bg-blue/10"
                >
                  КАТАЛОГ РЕЛИЗОВ
                </Link>
              </div>
            </Reveal>
            <Reveal delay={320}>
              <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-[11px] tracking-[0.2em] text-paper/35 uppercase">
                <span>Основано · 2026</span>
                <span>Жанры · techno / phonk / synthwave/electronic/pop/rap</span>
                <span> TimurSounds / NaMneCash Music</span>
              </div>
            </Reveal>
          </div>
          <Reveal delay={200}>
            <div className="relative hidden lg:block">
              <div className="absolute inset-0 bg-blue/15 blur-[70px] rounded-full" />
              <Monogram seed={13} text="TS" className="relative w-full max-w-[320px] mx-auto border border-line shadow-[0_30px_80px_-20px_rgba(31,91,255,0.55)]" />
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] tracking-[0.35em] text-paper/40 uppercase">
                label · streaming · community
              </div>
            </div>
          </Reveal>
        </div>
        <Reveal delay={380}>
          <canvas ref={canvasRef} className="mt-12 w-full h-24 md:h-28 block" aria-hidden />
        </Reveal>
      </div>
    </section>
  );
}

function NewsCard({ n, big = false }: { n: NewsItem; big?: boolean }) {
  return (
    <article
      className={`group relative border border-line rounded-xl bg-coal/70 p-6 transition-all hover:-translate-y-1 hover:border-blue ${
        big ? "md:row-span-2 bg-gradient-to-br from-panel via-coal to-navy p-7 md:p-8" : ""
      }`}
    >
      <div className="flex items-center gap-3 text-[11px] text-paper/40 mb-4">
        <span className={`font-display font-bold tracking-[0.2em] uppercase border px-2 py-1 rounded ${TAG_COLOR[n.tag]}`}>{n.tag}</span>
        <time>{fmtDate(n.date)}</time>
      </div>
      <h3 className={`font-semibold leading-snug ${big ? "text-xl md:text-2xl" : "text-base"} group-hover:text-bluehi transition-colors`}>
        {n.title}
      </h3>
      <p className={`mt-3 text-paper/50 leading-relaxed text-sm ${big ? "" : "line-clamp-3"}`}>{n.body}</p>
      <div className="mt-5 text-[10px] tracking-[0.25em] uppercase text-paper/30">Администратор TimurSounds</div>
    </article>
  );
}

function CountdownBlock({ u }: { u: Upcoming }) {
  const { artist } = useStore();
  const a = artist(u.artistId);
  const future = u.date > Date.now();
  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-gradient-to-br from-navy via-coal to-coal p-6 md:p-8">
      <div className="absolute inset-0 bg-scan opacity-60 pointer-events-none" />
      <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-blue/25 blur-[80px] pointer-events-none" />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] tracking-[0.3em] text-sky font-semibold">БЛИЖАЙШИЙ РЕЛИЗ</div>
          <span className="text-[10px] tracking-[0.2em] uppercase text-paper/45 border border-line rounded-full px-3 py-1 bg-ink/60">
            {a.name} · {u.kind}
          </span>
        </div>
        <div className="mt-4 min-w-0">
          <div className="font-display font-black uppercase text-3xl md:text-5xl leading-none break-words">{u.title}</div>
          <p className="mt-4 text-paper/55 max-w-xl text-sm leading-relaxed">{u.note}</p>
        </div>
        <div className="mt-6">
          <Countdown date={u.date} />
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <div className="text-xs text-paper/40 tabular-nums">Премьера · {fmtDate(u.date)}</div>
          {future && (
            <Link
              to={`/artist/${u.artistId}`}
              className="text-xs font-display font-bold tracking-wider text-paper bg-blue/15 border border-blue/40 hover:bg-blue px-4 py-2 rounded-lg transition-all hover:-translate-y-0.5"
            >
              СТРАНИЦА АРТИСТА
            </Link>
          )}
          {!future && <span className="text-xs font-display font-bold tracking-wider text-blue">УЖЕ НА ПЛОЩАДКЕ</span>}
        </div>
      </div>
    </div>
  );
}

export function Home() {
  const { tracks, news, upcoming, online, syncMode, playsOf, artist, ready } = useStore();
  const fresh = [...tracks].sort((a, b) => b.addedAt - a.addedAt).slice(0, 5);
  const queue = fresh.map((t) => t.id);
  const streamsAll = tracks.reduce((s, t) => s + playsOf(t.id), 0);

  return (
    <div className="pb-10">
      <LogoHero />

      {/* live ticker */}
      <div className="border-b border-line bg-coal/60 overflow-hidden">
        <div className="marquee-track py-3">
          {[0, 1].map((k) => (
            <div key={k} className="flex shrink-0 items-center" aria-hidden={k === 1}>
              {[
                `${online} ${pluralRu(online, "человек слушает", "человека слушают", "человек слушают")} прямо сейчас`,
                `${fmtNum(streamsAll)} ${pluralRu(streamsAll, "реальное прослушивание", "реальных прослушивания", "реальных прослушиваний")} на площадке`,
                `${artist("timur").name} × ${artist("instasamka").name} — две страницы, одна сцена`,
                "новости пишет администратор — без ботов и пресс-релизов",
                syncMode === "cloud" ? "синхронизация в реальном времени · cloud" : "мгновенная синхронизация вкладок · local",
              ].map((t, i) => (
                <span key={i} className="flex items-center gap-6 pr-6 whitespace-nowrap text-[11px] tracking-[0.25em] uppercase text-paper/40">
                  <span>{t}</span>
                  <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden>
                    <rect width="9" height="9" transform="rotate(45 4.5 4.5)" fill="#1f5bff" />
                  </svg>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8">
        {/* countdown to upcoming releases */}
        {upcoming.length > 0 && (
          <section className="pt-14">
            <SectionHead
              kicker="Премьеры на подходе"
              title="Скоро на площадке"
              action={<span className="text-xs text-paper/40 border border-line rounded-full px-3 py-1.5">{upcoming.length} {pluralRu(upcoming.length, "анонс", "анонса", "анонсов")}</span>}
            />
            <div className="grid gap-5 md:grid-cols-2">
              {upcoming.map((u, i) => (
                <Reveal key={u.id} delay={(i % 2) * 90}>
                  <CountdownBlock u={u} />
                </Reveal>
              ))}
            </div>
          </section>
        )}

        {/* fresh tracks */}
        <section className="pt-14">
          <SectionHead
            kicker="Свежие треки"
            title="Сейчас в эфире"
            action={<Link to="/tracks" className="text-xs font-display font-bold tracking-wider text-sky hover:text-bluehi transition-colors">ВСЕ ТРЕКИ →</Link>}
          />
          {ready && fresh.length > 0 ? (
            <Reveal>
              <div className="border border-line rounded-xl bg-coal/40 p-2 md:p-3 divide-y divide-line/60">
                <div className={`hidden md:grid ${TRACK_GRID} gap-3 px-3 pb-2 text-[10px] tracking-[0.25em] text-paper/30 font-semibold`}>
                  <span className="text-center">#</span>
                  <span>ТРЕК</span>
                  <span>РЕЛИЗ</span>
                  <span className="text-right">ПЛЕИ</span>
                  <span className="text-right">ВРЕМЯ</span>
                  <span />
                </div>
                {fresh.map((t, i) => (
                  <TrackRow key={t.id} track={t} index={i} queue={queue} />
                ))}
              </div>
            </Reveal>
          ) : (
            <Reveal>
              <div className="border border-dashed border-line rounded-xl p-10 md:p-14 text-center bg-coal/30">
                <div className="eq mx-auto mb-5 paused"><span /><span /><span /><span /></div>
                <div className="font-display font-black text-2xl md:text-3xl uppercase">Площадка в режиме тишины</div>
                <p className="mt-3 text-paper/45 max-w-md mx-auto text-sm leading-relaxed">
                  Администратор ещё не загрузил треки. Как только они появятся — они заиграют здесь. Загляните в новости или админ-панель.
                </p>
                <Link to="/admin" className="inline-block mt-6 text-xs font-display font-bold tracking-wider text-paper bg-blue hover:bg-bluehi px-5 py-3 rounded-lg transition-all hover:-translate-y-0.5">
                  Я АДМИН — ЗАГРУЗИТЬ ТРЕКИ
                </Link>
              </div>
            </Reveal>
          )}
        </section>

        {/* artists */}
        <section className="pt-14">
          <SectionHead
            kicker="Две страницы — один лейбл-дом"
            title="Артисты площадки"
            action={<span className="text-xs text-paper/40 border border-line rounded-full px-3 py-1.5">TimurSounds × NaMneCash Music</span>}
          />
          <div className="grid md:grid-cols-2 gap-5">
            <Reveal><ArtistCard artistId="timur" /></Reveal>
            <Reveal delay={120}><ArtistCard artistId="instasamka" /></Reveal>
          </div>
        </section>

        {/* news */}
        <section className="pt-14">
          <SectionHead
            kicker="Лента"
            title="Новости лейбла"
            action={<span className="text-xs text-paper/40 border border-line rounded-full px-3 py-1.5">пишет администратор · {news.length}</span>}
          />
          {news.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-5">
              {news.slice(0, 5).map((n, i) => (
                <Reveal key={n.id} delay={(i % 2) * 90}>
                  <NewsCard n={n} big={i === 0} />
                </Reveal>
              ))}
            </div>
          ) : (
            <Reveal>
              <div className="border border-dashed border-line rounded-xl p-10 text-center bg-coal/30">
                <div className="font-display font-bold text-xl uppercase text-paper/60">Новостей пока нет</div>
                <p className="mt-2 text-paper/40 text-sm">Администратор напишет первую — она появится здесь у всех слушателей.</p>
              </div>
            </Reveal>
          )}
        </section>
      </div>
    </div>
  );
}
