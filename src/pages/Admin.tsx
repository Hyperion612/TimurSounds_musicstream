import { useMemo, useRef, useState } from "react";
import { ARTISTS, KIND_LABEL, fmtDate, fmtTime } from "../lib/data";
import type { ArtistId, NewsTag, ReleaseKind, Track } from "../lib/data";
import { SynthSource } from "../lib/audio";
import { putAudio } from "../lib/db";
import { useStore } from "../lib/store";
import { Countdown, Cover, Reveal } from "../components/ui";
import { PauseIcon, PlayIcon } from "../components/cards";

/* ================= login ================= */
function Login() {
  const { login } = useStore();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!login(pw)) {
      setErr(true);
      setPw("");
      setTimeout(() => setErr(false), 450);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className={`w-full max-w-md border border-line rounded-2xl bg-coal p-8 md:p-10 relative overflow-hidden ${err ? "shake" : ""}`}>
        <div className="absolute inset-0 bg-scan pointer-events-none opacity-50" />
        <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-blue/20 blur-[70px] pointer-events-none" />
        <div className="relative">
          <div className="w-14 h-14 rounded-xl bg-blue/15 border border-blue/40 flex items-center justify-center mb-6">
            <svg width="26" height="26" viewBox="0 0 17 17" fill="none" stroke="#8fb0ff" strokeWidth="1.6" strokeLinecap="round">
              <rect x="3.5" y="7.5" width="10" height="7" rx="1.6" />
              <path d="M5.8 7.5V5.6a2.7 2.7 0 0 1 5.4 0v1.9" />
            </svg>
          </div>
          <h1 className="font-display font-black text-2xl uppercase tracking-tight">Админ-панель</h1>
          <p className="text-sm text-paper/50 mt-2 leading-relaxed">
            Доступ только для владельца площадки TimurSounds. Введите пароль, чтобы управлять треками, релизами и новостями.
          </p>
          <form onSubmit={submit} className="mt-6 space-y-3">
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Пароль администратора"
              autoFocus
              className="w-full bg-ink border border-line focus:border-blue outline-none rounded-lg px-4 py-3.5 text-sm placeholder:text-paper/30 transition-colors"
            />
            {err && <div className="text-xs text-sky border border-blue/40 bg-blue/10 rounded-lg px-3 py-2">Неверный пароль. Попробуйте ещё раз.</div>}
            <button type="submit" className="w-full bg-blue hover:bg-bluehi text-paper font-display font-bold text-sm tracking-wider py-3.5 rounded-lg transition-all hover:-translate-y-0.5 active:scale-[0.98]">
              ВОЙТИ
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ================= form atoms ================= */
const inputCls =
  "w-full bg-ink border border-line focus:border-blue outline-none rounded-lg px-3.5 py-2.5 text-sm placeholder:text-paper/30 transition-colors";
const labelCls = "block text-[10px] tracking-[0.25em] text-paper/40 font-semibold mb-1.5 uppercase";
const btnPrimary =
  "bg-blue hover:bg-bluehi text-paper font-display font-bold text-xs tracking-wider px-5 py-3 rounded-lg transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-40";
const btnGhost =
  "border border-line hover:border-bluehi text-paper/70 hover:text-paper font-display font-bold text-xs tracking-wider px-5 py-3 rounded-lg transition-all hover:-translate-y-0.5";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

/* ================= track form ================= */
function TrackForm() {
  const { releases, addTrack } = useStore();
  const [title, setTitle] = useState("");
  const [artistId, setArtistId] = useState<ArtistId>("timur");
  const [feat, setFeat] = useState<"" | ArtistId>("");
  const [releaseId, setReleaseId] = useState("");
  const [bpm, setBpm] = useState(120);
  const [mode, setMode] = useState<"synth" | "file">("synth");
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 9000) + 1000);
  const [duration, setDuration] = useState(175);
  const [file, setFile] = useState<File | null>(null);
  const [fileDur, setFileDur] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const previewRef = useRef<SynthSource | null>(null);

  const onFile = (f: File | null) => {
    setFile(f);
    setFileDur(null);
    if (!f) return;
    const url = URL.createObjectURL(f);
    const a = new Audio();
    a.preload = "metadata";
    a.onloadedmetadata = () => {
      if (Number.isFinite(a.duration)) setFileDur(Math.round(a.duration));
      URL.revokeObjectURL(url);
    };
    a.src = url;
  };

  const preview = () => {
    if (previewing) {
      previewRef.current?.stop();
      previewRef.current = null;
      setPreviewing(false);
      return;
    }
    const src = new SynthSource({ bpm, seed, duration: 30 });
    previewRef.current = src;
    src.start(0);
    setPreviewing(true);
    setTimeout(() => {
      src.stop();
      if (previewRef.current === src) {
        previewRef.current = null;
        setPreviewing(false);
      }
    }, 5000);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    const id = `u${Date.now().toString(36)}`;
    try {
      if (mode === "file" && file) {
        await putAudio(id, file);
      }
      const t: Track = {
        id,
        title: title.trim().toUpperCase(),
        artistId,
        feat: feat || undefined,
        releaseId: releaseId || undefined,
        duration: mode === "file" ? fileDur ?? duration : duration,
        bpm,
        seed,
        kind: mode === "file" && file ? "file" : "synth",
        plays: 0,
        addedAt: Date.now(),
      };
      addTrack(t);
      setMsg(`Трек «${t.title}» опубликован на площадке`);
      setTitle("");
      setFile(null);
      setFileDur(null);
      setSeed(Math.floor(Math.random() * 9000) + 1000);
    } catch {
      setMsg("Не удалось сохранить аудиофайл — попробуйте файл поменьше");
    }
    setBusy(false);
    setTimeout(() => setMsg(""), 3500);
  };

  return (
    <form onSubmit={submit} className="border border-line rounded-xl bg-coal/60 p-6 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-5 h-[3px] bg-blue" />
        <h3 className="font-display font-bold text-sm tracking-wider uppercase">Загрузить трек</h3>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Название">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: СИНИЙ КОД" className={inputCls} required />
        </Field>
        <Field label="Артист">
          <select value={artistId} onChange={(e) => setArtistId(e.target.value as ArtistId)} className={inputCls}>
            <option value="timur">TIMUR · TimurSounds</option>
            <option value="instasamka">INSTASAMKA · NaMneCash Music</option>
          </select>
        </Field>
        <Field label="Feat. (необязательно)">
          <select value={feat} onChange={(e) => setFeat(e.target.value as "" | ArtistId)} className={inputCls}>
            <option value="">— без фита —</option>
            <option value="timur">TIMUR</option>
            <option value="instasamka">INSTASAMKA</option>
          </select>
        </Field>
        <Field label="Релиз (необязательно)">
          <select value={releaseId} onChange={(e) => setReleaseId(e.target.value)} className={inputCls}>
            <option value="">— вне релиза —</option>
            {releases.map((r) => (
              <option key={r.id} value={r.id}>{r.title} · {ARTISTS[r.artistId].name}</option>
            ))}
          </select>
        </Field>
      </div>

      <div>
        <span className={labelCls}>Источник звука</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => setMode("synth")} className={`${mode === "synth" ? "bg-blue border-blue text-paper" : "border-line text-paper/55 hover:text-paper"} font-display text-[11px] font-bold tracking-wider px-4 py-2.5 rounded-lg border transition-all`}>
            СИНТЕЗ TIMURSOUNDS
          </button>
          <button type="button" onClick={() => setMode("file")} className={`${mode === "file" ? "bg-blue border-blue text-paper" : "border-line text-paper/55 hover:text-paper"} font-display text-[11px] font-bold tracking-wider px-4 py-2.5 rounded-lg border transition-all`}>
            АУДИОФАЙЛ
          </button>
        </div>
      </div>

      {mode === "synth" ? (
        <div className="grid md:grid-cols-3 gap-4 items-end">
          <Field label={`Темп · ${bpm} BPM`}>
            <input type="range" min={80} max={150} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className="vol w-full" style={{ ["--fill" as string]: `${((bpm - 80) / 70) * 100}%` }} />
          </Field>
          <Field label="Длительность, сек">
            <input type="number" min={60} max={420} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={inputCls} />
          </Field>
          <div className="flex gap-2">
            <button type="button" onClick={() => setSeed(Math.floor(Math.random() * 9000) + 1000)} className={`${btnGhost} flex-1`}>
              НОВЫЙ ЗВУК · {seed}
            </button>
            <button type="button" onClick={preview} className={`${previewing ? "bg-paper text-ink border-paper" : btnGhost} flex items-center justify-center gap-2`}>
              {previewing ? <PauseIcon size={12} /> : <PlayIcon size={12} />}
              {previewing ? "СТОП" : "5 СЕК"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-line hover:border-blue rounded-xl p-8 cursor-pointer transition-colors text-center">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#8fb0ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4m0 0 4 4m-4-4-4 4" />
              <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
            </svg>
            <span className="text-sm text-paper/60">{file ? file.name : "Нажмите, чтобы выбрать аудиофайл (MP3 / WAV / OGG)"}</span>
            {fileDur && <span className="text-xs text-sky tabular-nums">длительность: {fmtTime(fileDur)}</span>}
            <input type="file" accept="audio/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
          </label>
          {!file && (
            <p className="text-xs text-paper/35">Если файл не выбран, трек будет опубликован со звуком синтеза TimurSounds.</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button type="submit" disabled={busy || !title.trim()} className={btnPrimary}>
          {busy ? "ПУБЛИКАЦИЯ…" : "ОПУБЛИКОВАТЬ НА ПЛОЩАДКЕ"}
        </button>
        {msg && <span className="text-xs text-sky border border-blue/40 bg-blue/10 rounded-lg px-3 py-2">{msg}</span>}
      </div>
    </form>
  );
}

/* ================= release form ================= */
function ReleaseForm() {
  const { addRelease } = useStore();
  const [title, setTitle] = useState("");
  const [artistId, setArtistId] = useState<ArtistId>("timur");
  const [kind, setKind] = useState<ReleaseKind>("single");
  const [year, setYear] = useState(new Date().getFullYear());
  const [msg, setMsg] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    addRelease({
      id: `r${Date.now().toString(36)}`,
      title: title.trim().toUpperCase(),
      artistId,
      kind,
      year,
      coverSeed: Math.floor(Math.random() * 500) + 200,
    });
    setMsg(`Релиз «${title.trim().toUpperCase()}» создан`);
    setTitle("");
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <form onSubmit={submit} className="border border-line rounded-xl bg-coal/60 p-6 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-5 h-[3px] bg-blue" />
        <h3 className="font-display font-bold text-sm tracking-wider uppercase">Создать релиз</h3>
      </div>
      <div className="grid md:grid-cols-4 gap-4">
        <div className="md:col-span-2">
          <Field label="Название">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="NOCTURNE II" className={inputCls} required />
          </Field>
        </div>
        <Field label="Артист">
          <select value={artistId} onChange={(e) => setArtistId(e.target.value as ArtistId)} className={inputCls}>
            <option value="timur">TIMUR</option>
            <option value="instasamka">INSTASAMKA</option>
          </select>
        </Field>
        <Field label="Тип">
          <select value={kind} onChange={(e) => setKind(e.target.value as ReleaseKind)} className={inputCls}>
            <option value="single">Сингл</option>
            <option value="album">Альбом</option>
            <option value="ep">EP</option>
          </select>
        </Field>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Год">
          <input type="number" min={2000} max={2100} value={year} onChange={(e) => setYear(Number(e.target.value))} className={`${inputCls} w-28`} />
        </Field>
        <button type="submit" className={btnPrimary}>СОЗДАТЬ РЕЛИЗ</button>
        {msg && <span className="text-xs text-sky border border-blue/40 bg-blue/10 rounded-lg px-3 py-2">{msg}</span>}
      </div>
    </form>
  );
}

/* ================= news form ================= */
function NewsForm() {
  const { addNews } = useStore();
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState<NewsTag>("релиз");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    addNews({ id: `n${Date.now().toString(36)}`, title: title.trim(), body: body.trim(), tag, date: Date.now() });
    setMsg("Новость опубликована в ленте");
    setTitle("");
    setBody("");
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <form onSubmit={submit} className="border border-line rounded-xl bg-coal/60 p-6 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-5 h-[3px] bg-blue" />
        <h3 className="font-display font-bold text-sm tracking-wider uppercase">Написать новость</h3>
      </div>
      <div className="grid md:grid-cols-[1fr_180px] gap-4">
        <Field label="Заголовок">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Скоро: новый сингл TIMUR" className={inputCls} required />
        </Field>
        <Field label="Категория">
          <select value={tag} onChange={(e) => setTag(e.target.value as NewsTag)} className={inputCls}>
            <option value="релиз">Релиз</option>
            <option value="обновление">Обновление</option>
            <option value="событие">Событие</option>
          </select>
        </Field>
      </div>
      <Field label="Текст">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Что случилось на площадке…" className={`${inputCls} resize-y`} required />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={btnPrimary}>ОПУБЛИКОВАТЬ</button>
        {msg && <span className="text-xs text-sky border border-blue/40 bg-blue/10 rounded-lg px-3 py-2">{msg}</span>}
      </div>
    </form>
  );
}

/* ================= upcoming form ================= */
function UpcomingForm() {
  const { upcoming, setUpcoming } = useStore();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("сингл");
  const [artistId, setArtistId] = useState<ArtistId>("timur");
  const [dateStr, setDateStr] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dateStr) return;
    setUpcoming({ title: title.trim().toUpperCase(), kind, artistId, date: new Date(dateStr).getTime(), note: note.trim() || "Премьера на TimurSounds." });
    setMsg("Дата ближайшего релиза обновлена");
    setTitle("");
    setNote("");
    setDateStr("");
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <form onSubmit={submit} className="border border-line rounded-xl bg-coal/60 p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-5 h-[3px] bg-blue" />
          <h3 className="font-display font-bold text-sm tracking-wider uppercase">Дата ближайшего релиза</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Название">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="СИНИЙ КОД: DELUXE" className={inputCls} required />
            </Field>
          </div>
          <Field label="Формат">
            <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls}>
              <option value="сингл">Сингл</option>
              <option value="альбом">Альбом</option>
              <option value="EP">EP</option>
              <option value="клип">Клип</option>
            </select>
          </Field>
          <Field label="Артист">
            <select value={artistId} onChange={(e) => setArtistId(e.target.value as ArtistId)} className={inputCls}>
              <option value="timur">TIMUR</option>
              <option value="instasamka">INSTASAMKA</option>
            </select>
          </Field>
          <Field label="Дата и время премьеры">
            <input type="datetime-local" value={dateStr} onChange={(e) => setDateStr(e.target.value)} className={inputCls} required />
          </Field>
          <Field label="Заметка">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Пара слов о премьере" className={inputCls} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={btnPrimary}>ОБНОВИТЬ АНОНС</button>
          {upcoming && (
            <button type="button" onClick={() => setUpcoming(null)} className={btnGhost}>
              СКРЫТЬ БЛОК
            </button>
          )}
          {msg && <span className="text-xs text-sky border border-blue/40 bg-blue/10 rounded-lg px-3 py-2">{msg}</span>}
        </div>
      </form>

      <div className="border border-line rounded-xl bg-gradient-to-br from-navy to-coal p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-scan opacity-50 pointer-events-none" />
        <div className="relative">
          <div className="text-[10px] tracking-[0.3em] text-sky font-semibold mb-4">ТАК ЭТО ВИДЯТ СЛУШАТЕЛИ</div>
          {upcoming ? (
            <>
              <div className="font-display font-black text-2xl uppercase">{upcoming.title}</div>
              <div className="text-blue font-display font-bold mt-1">{ARTISTS[upcoming.artistId].name} · {upcoming.kind}</div>
              <div className="mt-5">
                <Countdown date={upcoming.date} />
              </div>
              <div className="mt-4 text-xs text-paper/45">{fmtDate(upcoming.date)}</div>
            </>
          ) : (
            <div className="text-paper/40 text-sm py-10 text-center">Блок с ближайшим релизом сейчас скрыт.</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================= dashboard ================= */
type Tab = "tracks" | "releases" | "news" | "upcoming";

function Dashboard() {
  const { tracks, releases, news, upcoming, deleteTrack, deleteRelease, deleteNews, logout, resetDemo } = useStore();
  const [tab, setTab] = useState<Tab>("tracks");

  const tabs = useMemo(
    () =>
      [
        { id: "tracks" as Tab, label: "ТРЕКИ", count: tracks.length },
        { id: "releases" as Tab, label: "РЕЛИЗЫ", count: releases.length },
        { id: "news" as Tab, label: "НОВОСТИ", count: news.length },
        { id: "upcoming" as Tab, label: "АНОНС", count: upcoming ? 1 : 0 },
      ],
    [tracks.length, releases.length, news.length, upcoming]
  );

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 pt-10 md:pt-14">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-[3px] bg-blue" />
            <span className="text-[11px] tracking-[0.3em] text-sky font-semibold">ПУЛЬТ УПРАВЛЕНИЯ</span>
          </div>
          <h1 className="font-display text-3xl md:text-5xl font-black uppercase tracking-tight">Админ-панель</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (window.confirm("Сбросить все данные к демо-версии площадки?")) resetDemo();
            }}
            className={btnGhost}
          >
            СБРОС К ДЕМО
          </button>
          <button onClick={logout} className={btnGhost}>
            ВЫЙТИ
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`font-display text-xs font-bold tracking-wider px-4 py-2.5 rounded-lg border transition-all ${
              tab === t.id ? "bg-blue border-blue text-paper" : "border-line text-paper/55 hover:text-paper hover:border-linehi"
            }`}
          >
            {t.label}
            <span className="ml-2 tabular-nums opacity-60">{t.count}</span>
          </button>
        ))}
      </div>

      {tab === "tracks" && (
        <div className="space-y-6">
          <TrackForm />
          <div className="border border-line rounded-xl bg-coal/40 divide-y divide-line/60 overflow-hidden">
            {tracks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors">
                <Cover seed={t.seed} title={t.title} className="w-10 h-10 rounded-md border border-line shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{t.title}</div>
                  <div className="text-xs text-paper/40 truncate">
                    {ARTISTS[t.artistId].name}
                    {t.feat && ` feat. ${ARTISTS[t.feat].name}`} · {t.kind === "file" ? "аудиофайл" : `синтез · ${t.bpm} BPM`} · {fmtTime(t.duration)} · {fmtDate(t.addedAt)}
                  </div>
                </div>
                <span className="hidden sm:block text-xs text-paper/40 tabular-nums">{t.plays} стримов</span>
                <button
                  onClick={() => {
                    if (window.confirm(`Удалить трек «${t.title}»?`)) deleteTrack(t.id);
                  }}
                  className="text-paper/30 hover:text-blue border border-line hover:border-blue rounded-lg px-3 py-2 text-xs font-display font-bold tracking-wider transition-all"
                >
                  УДАЛИТЬ
                </button>
              </div>
            ))}
            {!tracks.length && <div className="p-10 text-center text-paper/40">Треков пока нет.</div>}
          </div>
        </div>
      )}

      {tab === "releases" && (
        <div className="space-y-6">
          <ReleaseForm />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {releases.map((r) => (
              <div key={r.id} className="flex items-center gap-3 border border-line rounded-xl bg-coal/60 p-3">
                <Cover seed={r.coverSeed} title={r.title} className="w-14 h-14 rounded-lg border border-line shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-display font-bold text-sm uppercase truncate">{r.title}</div>
                  <div className="text-xs text-paper/40">
                    {ARTISTS[r.artistId].name} · {KIND_LABEL[r.kind]} · {r.year}
                  </div>
                  <div className="text-xs text-paper/30">{tracks.filter((t) => t.releaseId === r.id).length} треков</div>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm(`Удалить релиз «${r.title}»? Треки останутся вне релиза.`)) deleteRelease(r.id);
                  }}
                  className="self-start text-paper/30 hover:text-blue border border-line hover:border-blue rounded-lg px-2.5 py-1.5 text-[11px] font-display font-bold transition-all"
                >
                  ✕
                </button>
              </div>
            ))}
            {!releases.length && <div className="col-span-full border border-dashed border-line rounded-xl p-10 text-center text-paper/40">Релизов пока нет.</div>}
          </div>
        </div>
      )}

      {tab === "news" && (
        <div className="space-y-6">
          <NewsForm />
          <div className="space-y-3">
            {news.map((n) => (
              <div key={n.id} className="border border-line rounded-xl bg-coal/60 p-5 flex gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-[10px] font-display font-bold tracking-[0.2em] uppercase bg-blue/15 text-sky border border-blue/30 px-2 py-1 rounded">{n.tag}</span>
                    <time className="text-xs text-paper/40">{fmtDate(n.date)}</time>
                  </div>
                  <div className="font-semibold">{n.title}</div>
                  <p className="text-sm text-paper/50 mt-1.5 leading-relaxed">{n.body}</p>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm("Удалить новость?")) deleteNews(n.id);
                  }}
                  className="self-start shrink-0 text-paper/30 hover:text-blue border border-line hover:border-blue rounded-lg px-3 py-2 text-xs font-display font-bold tracking-wider transition-all"
                >
                  УДАЛИТЬ
                </button>
              </div>
            ))}
            {!news.length && <div className="border border-dashed border-line rounded-xl p-10 text-center text-paper/40">Лента пуста — напишите первую новость.</div>}
          </div>
        </div>
      )}

      {tab === "upcoming" && <UpcomingForm />}

      <Reveal>
        <div className="mt-10 border border-line rounded-xl bg-coal/40 p-5 text-xs text-paper/35 leading-relaxed">
          Все изменения сохраняются в браузере площадки и сразу видны слушателям: на главной, в музыке, в треках и на страницах артистов.
          Аудиофайлы хранятся локально (IndexedDB), синтезированные треки генерируются звуковым движком TimurSounds в реальном времени.
        </div>
      </Reveal>
    </div>
  );
}

export function Admin() {
  const { isAdmin } = useStore();
  return isAdmin ? <Dashboard /> : <Login />;
}
