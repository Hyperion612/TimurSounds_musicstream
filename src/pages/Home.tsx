import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ARTISTS, fmtDate } from "../lib/data";
import type { NewsTag } from "../lib/data";
import { usePlayer } from "../lib/player";
import { useStore } from "../lib/store";
import { Countdown, CountUp, Cover, Marquee, Reveal, SectionHead } from "../components/ui";
import { PlayIcon, ReleaseCard, TrackRow } from "../components/cards";

/* живая волна, реагирующая на воспроизведение */
function AmbientWave() {
  const ref = useRef<HTMLCanvasElement>(null);
  const { playing } = usePlayer();
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      cv.width = cv.offsetWidth * dpr;
      cv.height = cv.offsetHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);
    let t = 0;
    const draw = () => {
      t += 0.02;
      const w = cv.width;
      const h = cv.height;
      ctx.clearRect(0, 0, w, h);
      const N = 96;
      const gap = w / N;
      const amp = playingRef.current ? 0.42 : 0.16;
      for (let i = 0; i < N; i++) {
        const v = Math.sin(i * 0.35 + t * 2.1) * Math.sin(i * 0.11 - t) * amp + Math.sin(i * 0.7 + t * 3.3) * amp * 0.4;
        const bh = Math.max(3 * dpr, Math.abs(v) * h * 0.9 + h * 0.06);
        const x = i * gap;
        ctx.fillStyle = i % 7 === 0 ? "#8fb0ff" : i % 3 === 0 ? "#1f5bff" : "rgba(242,245,255,0.28)";
        ctx.fillRect(x, (h - bh) / 2, gap * 0.55, bh);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="w-full h-24 md:h-32 block" aria-hidden />;
}

/* счётчик «сейчас слушают» */
function LiveListeners() {
  const [n, setN] = useState(1247);
  useEffect(() => {
    const iv = setInterval(() => setN((v) => Math.max(900, v + Math.round((Math.random() - 0.45) * 24))), 2000);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="flex items-center gap-2 text-sm text-paper/60">
      <span className="w-2 h-2 rounded-full bg-blue live-dot" />
      <span className="tabular-nums font-semibold text-paper">{n.toLocaleString("ru-RU")}</span> слушают прямо сейчас
    </div>
  );
}

const TAG_STYLE: Record<NewsTag, string> = {
  релиз: "bg-blue text-paper",
  обновление: "bg-paper text-ink",
  событие: "bg-transparent border border-blue text-sky",
};

export function Home() {
  const { tracks, releases, news, upcoming } = useStore();
  const { playTrack } = usePlayer();
  const [presaved, setPresaved] = useState(() => localStorage.getItem("ts_presave") === "1");

  const fresh = [...tracks].sort((a, b) => b.addedAt - a.addedAt).slice(0, 5);
  const freshIds = fresh.map((t) => t.id);
  const sortedReleases = [...releases].sort((a, b) => b.year - a.year).slice(0, 4);

  const presave = () => {
    const next = !presaved;
    setPresaved(next);
    localStorage.setItem("ts_presave", next ? "1" : "0");
  };

  return (
    <div>
      {/* ======= opening: label header ======= */}
      <section className="relative overflow-hidden border-b border-line bg-grid">
        <div className="absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full bg-blue/14 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-52 -left-32 w-[420px] h-[420px] rounded-full bg-bluedeep/30 blur-[110px] pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 md:px-8 pt-12 md:pt-20 pb-8">
          <div className="grid lg:grid-cols-[1.25fr_1fr] gap-10 items-end">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <span className="text-[11px] tracking-[0.35em] text-sky font-semibold border border-line rounded-full px-3 py-1.5 bg-coal/70">
                  СТРИМИНГОВАЯ ПЛОЩАДКА ЛЕЙБЛА
                </span>
                <LiveListeners />
              </div>
              <h1 className="font-display font-black uppercase leading-[0.92] tracking-tight">
                <span className="block text-[13vw] lg:text-[5.6rem] text-paper">TIMUR</span>
                <span className="block text-[13vw] lg:text-[5.6rem] text-transparent" style={{ WebkitTextStroke: "2px #1f5bff" }}>
                  SOUNDS
                </span>
              </h1>
              <p className="mt-6 max-w-xl text-paper/60 text-base md:text-lg leading-relaxed">
                Звук продюсера <span className="text-paper font-semibold">TIMUR</span> и официальная страница{" "}
                <span className="text-paper font-semibold">INSTASAMKA</span> — в одном месте. Слушайте релизы лейбла,
                следите за новостями и датами премьер.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  onClick={() => fresh[0] && playTrack(fresh[0].id, freshIds)}
                  className="group flex items-center gap-3 bg-blue hover:bg-bluehi text-paper font-display font-bold text-sm tracking-wider px-6 py-3.5 rounded-lg transition-all hover:-translate-y-0.5 shadow-[0_10px_36px_-10px_rgba(31,91,255,0.7)]"
                >
                  <span className="w-7 h-7 rounded-full bg-ink/25 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <PlayIcon size={13} className="translate-x-px" />
                  </span>
                  СЛУШАТЬ СВЕЖЕЕ
                </button>
                <Link
                  to="/music"
                  className="flex items-center gap-2 border border-linehi hover:border-blue text-paper font-display font-bold text-sm tracking-wider px-6 py-3.5 rounded-lg transition-all hover:-translate-y-0.5 hover:bg-blue/10"
                >
                  ВСЯ МУЗЫКА
                </Link>
              </div>
            </div>
            <div className="border border-line rounded-xl bg-coal/70 p-5 relative overflow-hidden">
              <div className="absolute inset-0 bg-scan pointer-events-none" />
              <div className="relative flex items-center justify-between mb-4">
                <span className="text-[10px] tracking-[0.3em] text-sky font-semibold">LIVE WAVE · 24/7</span>
                <span className="flex items-center gap-1.5 text-[10px] tracking-widest text-paper/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue live-dot" />ON AIR
                </span>
              </div>
              <AmbientWave />
              <div className="relative mt-4 grid grid-cols-3 gap-3 text-center">
                {[
                  { v: tracks.length, l: "треков" },
                  { v: releases.length, l: "релизов" },
                  { v: 2, l: "артиста" },
                ].map((s) => (
                  <div key={s.l} className="border border-line rounded-lg py-3 bg-ink/60">
                    <div className="font-display font-black text-2xl text-paper">
                      <CountUp to={s.v} duration={900} />
                    </div>
                    <div className="text-[10px] tracking-[0.2em] text-paper/40 uppercase mt-1">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <Marquee items={["TIMURSOUNDS", "НОВЫЙ ДРОП КАЖДУЮ НЕДЕЛЮ", "NaMneCash MUSIC × TIMURSOUNDS", "СЛУШАЙ В HD", "NOCTURNE — УЖЕ ЗДЕСЬ", "ХОЛОД feat. TIMUR"]} />
      </section>

      {/* ======= upcoming release countdown ======= */}
      {upcoming && (
        <section className="max-w-6xl mx-auto px-4 md:px-8 pt-14">
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl border border-blue/40 bg-gradient-to-br from-navy via-coal to-ink p-7 md:p-12">
              <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-blue/20 blur-[90px] pointer-events-none" />
              <div className="absolute inset-0 bg-scan pointer-events-none opacity-60" />
              <div className="relative grid lg:grid-cols-[1fr_auto] gap-8 items-center">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-2 h-2 rounded-full bg-blue live-dot" />
                    <span className="text-[11px] tracking-[0.35em] text-sky font-semibold">БЛИЖАЙШИЙ РЕЛИЗ · {upcoming.kind.toUpperCase()}</span>
                  </div>
                  <h2 className="font-display font-black text-3xl md:text-5xl uppercase tracking-tight">
                    {upcoming.title}
                    <span className="block text-blue mt-2 text-xl md:text-3xl">{ARTISTS[upcoming.artistId].name}</span>
                  </h2>
                  <p className="mt-4 max-w-lg text-paper/60 leading-relaxed text-sm md:text-base">{upcoming.note}</p>
                  <div className="mt-6 flex flex-wrap items-center gap-4">
                    <button
                      onClick={presave}
                      className={`font-display font-bold text-sm tracking-wider px-6 py-3 rounded-lg transition-all hover:-translate-y-0.5 active:scale-95 ${
                        presaved
                          ? "bg-paper text-ink"
                          : "bg-blue text-paper hover:bg-bluehi shadow-[0_10px_36px_-10px_rgba(31,91,255,0.7)]"
                      }`}
                    >
                      {presaved ? "✓ ВЫ В СПИСКЕ ПРЕСЕЙВА" : "ЗАБРАТЬ ПРЕСЕЙВ"}
                    </button>
                    <span className="text-sm text-paper/45">Премьера · {fmtDate(upcoming.date)}</span>
                  </div>
                </div>
                <Countdown date={upcoming.date} />
              </div>
            </div>
          </Reveal>
        </section>
      )}

      {/* ======= news feed ======= */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 pt-16">
        <SectionHead
          kicker="Лента площадки"
          title="Новости"
          action={
            <span className="text-xs text-paper/40 border border-line rounded-full px-3 py-1.5">
              пишет администратор · {news.length}
            </span>
          }
        />
        <div className="grid md:grid-cols-2 gap-4">
          {news.map((n, i) => (
            <Reveal key={n.id} delay={i * 70}>
              <article className="group h-full border border-line rounded-xl bg-coal/60 p-6 transition-all hover:border-linehi hover:-translate-y-1 hover:bg-coal relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[3px] bg-blue scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500" />
                <div className="flex items-center gap-3 mb-3">
                  <span className={`text-[10px] font-display font-bold tracking-[0.2em] uppercase px-2.5 py-1 rounded ${TAG_STYLE[n.tag]}`}>{n.tag}</span>
                  <time className="text-xs text-paper/40">{fmtDate(n.date)}</time>
                </div>
                <h3 className="font-display font-bold text-base md:text-lg leading-snug group-hover:text-bluehi transition-colors">{n.title}</h3>
                <p className="mt-3 text-sm text-paper/55 leading-relaxed">{n.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ======= fresh tracks ======= */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 pt-16">
        <SectionHead
          kicker="Только что добавлено"
          title="Свежие треки"
          action={
            <Link to="/tracks" className="text-sm text-sky hover:text-bluehi font-semibold transition-colors whitespace-nowrap">
              Все треки →
            </Link>
          }
        />
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
            {fresh.map((t, i) => (
              <TrackRow key={t.id} track={t} index={i} queue={freshIds} />
            ))}
          </div>
        </Reveal>
      </section>

      {/* ======= releases row ======= */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 pt-16">
        <SectionHead
          kicker="Каталог лейбла"
          title="Последние релизы"
          action={
            <Link to="/music" className="text-sm text-sky hover:text-bluehi font-semibold transition-colors whitespace-nowrap">
              Вся музыка →
            </Link>
          }
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {sortedReleases.map((r, i) => (
            <Reveal key={r.id} delay={i * 80}>
              <ReleaseCard releaseId={r.id} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ======= artists ======= */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 pt-16 pb-6">
        <SectionHead kicker="Два лейбла — одна сцена" title="Артисты" />
        <div className="grid md:grid-cols-2 gap-4 md:gap-6">
          {(["timur", "instasamka"] as const).map((id, i) => {
            const a = ARTISTS[id];
            return (
              <Reveal key={id} delay={i * 100}>
                <Link
                  to={`/artist/${id}`}
                  className="group relative block overflow-hidden rounded-2xl border border-line hover:border-blue transition-all hover:-translate-y-1 bg-coal"
                >
                  <div className="absolute inset-0 bg-grid opacity-60" />
                  <div className={`absolute -bottom-20 ${i === 0 ? "-right-20" : "-left-20"} w-64 h-64 rounded-full bg-blue/15 blur-[80px] pointer-events-none`} />
                  <div className="relative p-7 md:p-9 flex items-center gap-6">
                    <div className={`w-20 h-20 md:w-24 md:h-24 rounded-xl overflow-hidden border border-line shrink-0 transition-transform duration-500 group-hover:scale-105 ${i === 1 ? "order-2" : ""}`}>
                      <Cover seed={id === "timur" ? 501 : 702} title={id === "timur" ? "TIMUR" : "IS"} className="w-full h-full" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] tracking-[0.3em] text-sky font-semibold mb-2">{a.label.toUpperCase()}</div>
                      <div className="font-display font-black text-2xl md:text-3xl uppercase group-hover:text-bluehi transition-colors truncate">{a.name}</div>
                      <div className="mt-1 text-sm text-paper/50">{a.role}</div>
                      <div className="mt-3 text-xs text-paper/40">
                        <CountUp to={a.listeners} /> слушателей в месяц
                      </div>
                    </div>
                    <div className="ml-auto self-end text-blue opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-0 translate-x-2" aria-hidden>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </div>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </section>
    </div>
  );
}
