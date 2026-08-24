import { Link, useParams } from "react-router-dom";
import { ARTISTS, KIND_LABEL, fmtNum } from "../lib/data";
import { usePlayer } from "../lib/player";
import { useStore } from "../lib/store";
import { Cover, Reveal } from "../components/ui";
import { PlayIcon, TrackRow } from "../components/cards";

export function ReleasePage() {
  const { id } = useParams();
  const { getRelease, tracks } = useStore();
  const { playTrack } = usePlayer();
  const rel = id ? getRelease(id) : undefined;

  if (!rel) {
    return (
      <div className="max-w-3xl mx-auto px-4 pt-24 text-center">
        <div className="font-display font-black text-5xl text-blue mb-4">404</div>
        <p className="text-paper/55 mb-8">Такого релиза на площадке нет.</p>
        <Link to="/music" className="text-sky font-semibold hover:text-bluehi transition-colors">← Вернуться к музыке</Link>
      </div>
    );
  }

  const relTracks = tracks.filter((t) => t.releaseId === rel.id);
  const queue = relTracks.map((t) => t.id);
  const artist = ARTISTS[rel.artistId];
  const totalPlays = relTracks.reduce((s, t) => s + t.plays, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 pt-10 md:pt-14">
      <Link to="/music" className="inline-flex items-center gap-2 text-sm text-paper/45 hover:text-sky transition-colors mb-8">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
        Вся музыка
      </Link>

      <Reveal>
        <div className="relative overflow-hidden rounded-2xl border border-line bg-coal p-6 md:p-10 mb-10">
          <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-blue/15 blur-[80px] pointer-events-none" />
          <div className="relative grid md:grid-cols-[240px_1fr] gap-8 items-center">
            <div className="relative group">
              <Cover seed={rel.coverSeed} title={rel.title} className="w-full max-w-[240px] aspect-square rounded-xl border border-line shadow-[0_24px_60px_-20px_rgba(31,91,255,0.4)]" />
              <span className="spin-slow absolute -bottom-3 -right-3 w-12 h-12 rounded-full bg-blue flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f2f5ff" strokeWidth="2"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2" fill="#f2f5ff" /></svg>
              </span>
            </div>
            <div>
              <span className="text-[10px] font-display font-bold tracking-[0.25em] bg-blue text-paper px-2.5 py-1 rounded">{KIND_LABEL[rel.kind]}</span>
              <h1 className="font-display font-black text-4xl md:text-6xl uppercase tracking-tight mt-4">{rel.title}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-paper/55">
                <Link to={`/artist/${rel.artistId}`} className="text-paper font-semibold hover:text-bluehi transition-colors">{artist.name}</Link>
                <span>·</span>
                <span>{rel.year}</span>
                <span>·</span>
                <span>{relTracks.length} трек{relTracks.length === 1 ? "" : relTracks.length < 5 ? "а" : "ов"}</span>
                <span>·</span>
                <span className="tabular-nums">{fmtNum(totalPlays)} прослушиваний</span>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => relTracks[0] && playTrack(relTracks[0].id, queue)}
                  disabled={!relTracks.length}
                  className="group flex items-center gap-3 bg-blue hover:bg-bluehi disabled:opacity-30 text-paper font-display font-bold text-sm tracking-wider px-6 py-3.5 rounded-lg transition-all hover:-translate-y-0.5 active:scale-95 shadow-[0_10px_36px_-10px_rgba(31,91,255,0.7)]"
                >
                  <span className="w-7 h-7 rounded-full bg-ink/25 flex items-center justify-center"><PlayIcon size={13} className="translate-x-px" /></span>
                  СЛУШАТЬ ПОДРЯД
                </button>
                <Link
                  to={`/artist/${rel.artistId}`}
                  className="border border-linehi hover:border-blue px-6 py-3.5 rounded-lg font-display font-bold text-sm tracking-wider transition-all hover:-translate-y-0.5 hover:bg-blue/10"
                >
                  СТРАНИЦА АРТИСТА
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal delay={120}>
        <div className="border border-line rounded-xl bg-coal/40 p-2 md:p-3 divide-y divide-line/60">
          <div className="hidden md:grid grid-cols-[2.25rem_minmax(0,1fr)_5rem_3.5rem_2rem] gap-3 px-3 pb-2 text-[10px] tracking-[0.25em] text-paper/30 font-semibold">
            <span className="text-center">#</span>
            <span>ТРЕК</span>
            <span className="text-right">ПЛЕИ</span>
            <span className="text-right">ВРЕМЯ</span>
            <span />
          </div>
          {relTracks.length ? (
            relTracks.map((t, i) => <TrackRow key={t.id} track={t} index={i} queue={queue} showRelease={false} />)
          ) : (
            <div className="p-10 text-center text-paper/40">Треки этого релиза скоро появятся — администратор уже загружает их.</div>
          )}
        </div>
      </Reveal>
    </div>
  );
}
