import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { KIND_LABEL, fmtDate, fmtTime, pluralRu } from "../lib/data";
import type { Artist, ArtistId, NewsTag, ReleaseKind, Track } from "../lib/data";
import { SynthSource } from "../lib/audio";
import { putAudio } from "../lib/db";
import { ADMIN_PASSWORD, useStore } from "../lib/store";
import { SYNC_MODE } from "../lib/sync";
import { Countdown, Cover, Reveal } from "../components/ui";
import { PauseIcon, PlayIcon } from "../components/cards";
import { useRef } from "react";

/* ================= login ================= */
function Login() {
  const { login } = useStore();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);

  const submit = (e: FormEvent) => {
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
            Доступ только для владельца площадки TimurSounds. Введите пароль, чтобы управлять треками, релизами, анонсами и новостями.
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
const msgCls = "text-xs text-sky border border-blue/40 bg-blue/10 rounded-lg px-3 py-2";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

function ArtistSelect({ value, onChange }: { value: ArtistId; onChange: (v: ArtistId) => void }) {
  const { artists } = useStore();
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as ArtistId)} className={inputCls}>
      <option value="timur">{artists.timur.name} · {artists.timur.label}</option>
      <option value="instasamka">{artists.instasamka.name} · {artists.instasamka.label}</option>
    </select>
  );
}

/* ================= track form ================= */
function TrackForm() {
  const { releases, addTrack, artists } = useStore();
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

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    const id = `u${Date.now().toString(36)}`;
    try {
      if (mode === "file" && file) await putAudio(id, file);
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
        addedAt: Date.now(),
      };
      addTrack(t);
      setMsg(`Трек «${t.title}» опубликован — у всех слушателей`);
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
          <ArtistSelect value={artistId} onChange={setArtistId} />
        </Field>
        <Field label="Feat. (необязательно)">
          <select value={feat} onChange={(e) => setFeat(e.target.value as "" | ArtistId)} className={inputCls}>
            <option value="">— без фита —</option>
            <option value="timur">{artists.timur.name}</option>
            <option value="instasamka">{artists.instasamka.name}</option>
          </select>
        </Field>
        <Field label="Релиз (необязательно)">
          <select value={releaseId} onChange={(e) => setReleaseId(e.target.value)} className={inputCls}>
            <option value="">— вне релиза —</option>
            {releases.map((r) => (
              <option key={r.id} value={r.id}>{r.title} · {artists[r.artistId].name}</option>
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
          {!file && <p className="text-xs text-paper/35">Если файл не выбран, трек будет опубликован со звуком синтеза TimurSounds.</p>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button type="submit" disabled={busy || !title.trim()} className={btnPrimary}>
          {busy ? "ПУБЛИКАЦИЯ…" : "ОПУБЛИКОВАТЬ НА ПЛОЩАДКЕ"}
        </button>
        {msg && <span className={msgCls}>{msg}</span>}
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

  const submit = (e: FormEvent) => {
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
          <ArtistSelect value={artistId} onChange={setArtistId} />
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
        {msg && <span className={msgCls}>{msg}</span>}
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

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    addNews({ id: `n${Date.now().toString(36)}`, title: title.trim(), body: body.trim(), tag, date: Date.now() });
    setMsg("Новость опубликована — видна всем слушателям");
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
        {msg && <span className={msgCls}>{msg}</span>}
      </div>
    </form>
  );
}

/* ================= upcoming (анонсы) ================= */
function UpcomingTab() {
  const { upcoming, addUpcoming, removeUpcoming, artist } = useStore();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("сингл");
  const [artistId, setArtistId] = useState<ArtistId>("timur");
  const [dateStr, setDateStr] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dateStr) return;
    addUpcoming({
      id: `u${Date.now().toString(36)}`,
      title: title.trim().toUpperCase(),
      kind,
      artistId,
      date: new Date(dateStr).getTime(),
      note: note.trim() || "Премьера на TimurSounds.",
    });
    setMsg("Анонс опубликован на главной странице");
    setTitle("");
    setNote("");
    setDateStr("");
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="border border-line rounded-xl bg-coal/60 p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-5 h-[3px] bg-blue" />
          <h3 className="font-display font-bold text-sm tracking-wider uppercase">Добавить анонс релиза</h3>
        </div>
        <p className="text-xs text-paper/40 -mt-1">
          Анонсы показываются на главной странице с живым обратным отсчётом. Можно добавлять релизы обоих артистов — TIMUR и INSTASAMKA.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Название">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="СИНИЙ КОД: DELUXE" className={inputCls} required />
            </Field>
          </div>
          <Field label="Артист">
            <ArtistSelect value={artistId} onChange={setArtistId} />
          </Field>
          <Field label="Формат">
            <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls}>
              <option value="сингл">Сингл</option>
              <option value="альбом">Альбом</option>
              <option value="EP">EP</option>
              <option value="клип">Клип</option>
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
          <button type="submit" className={btnPrimary}>ОПУБЛИКОВАТЬ АНОНС</button>
          {msg && <span className={msgCls}>{msg}</span>}
        </div>
      </form>

      {upcoming.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {upcoming.map((u) => {
            const a = artist(u.artistId);
            return (
              <div key={u.id} className="border border-line rounded-xl bg-gradient-to-br from-navy to-coal p-5 relative overflow-hidden">
                <div className="absolute inset-0 bg-scan opacity-40 pointer-events-none" />
                <div className="relative">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] tracking-[0.25em] text-sky font-semibold">{a.name} · {u.kind}</div>
                      <div className="font-display font-black text-xl uppercase mt-1">{u.title}</div>
                    </div>
                    <button
                      onClick={() => {
                        if (window.confirm(`Убрать анонс «${u.title}»?`)) removeUpcoming(u.id);
                      }}
                      className="text-paper/30 hover:text-blue border border-line hover:border-blue rounded-lg px-2.5 py-1.5 text-[11px] font-display font-bold transition-all"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="mt-4 scale-75 origin-left"><Countdown date={u.date} /></div>
                  <div className="mt-3 text-xs text-paper/45">{fmtDate(u.date)} · {u.note}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {upcoming.length === 0 && (
        <div className="border border-dashed border-line rounded-xl p-10 text-center text-paper/40">
          Анонсов нет — добавьте ближайший релиз TIMUR или INSTASAMKA, и он появится на главной.
        </div>
      )}
    </div>
  );
}

/* ================= artist info editor ================= */
function ArtistTab() {
  const { artists, saveArtist } = useStore();
  const [sel, setSel] = useState<ArtistId>("instasamka");
  const [form, setForm] = useState<Artist | null>(null);
  const [msg, setMsg] = useState("");
  const current = form && form.id === sel ? form : artists[sel];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    saveArtist(current);
    setMsg("Информация обновлена на всех страницах артиста");
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <form onSubmit={submit} className="border border-line rounded-xl bg-coal/60 p-6 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-5 h-[3px] bg-blue" />
        <h3 className="font-display font-bold text-sm tracking-wider uppercase">Информация об артисте</h3>
      </div>
      <div className="flex gap-2">
        {(["timur", "instasamka"] as ArtistId[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setSel(id);
              setForm(null);
            }}
            className={`${sel === id ? "bg-blue border-blue text-paper" : "border-line text-paper/55 hover:text-paper"} font-display text-[11px] font-bold tracking-wider px-4 py-2.5 rounded-lg border transition-all`}
          >
            {artists[id].name}
          </button>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Имя / проект">
          <input value={current.name} onChange={(e) => setForm({ ...current, name: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Лейбл">
          <input value={current.label} onChange={(e) => setForm({ ...current, label: e.target.value })} className={inputCls} />
        </Field>
      </div>
      <Field label="Роль / подпись">
        <input value={current.role} onChange={(e) => setForm({ ...current, role: e.target.value })} className={inputCls} />
      </Field>
      <Field label="Биография">
        <textarea value={current.bio} onChange={(e) => setForm({ ...current, bio: e.target.value })} rows={6} className={`${inputCls} resize-y leading-relaxed`} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={btnPrimary}>СОХРАНИТЬ</button>
        {msg && <span className={msgCls}>{msg}</span>}
      </div>
    </form>
  );
}

/* ================= sync & danger zone ================= */
function SyncTab() {
  const { online, resetAll, syncMode } = useStore();

  return (
    <div className="space-y-6">
      <div className={`relative overflow-hidden border rounded-xl p-6 ${syncMode === "cloud" ? "border-blue/50 bg-gradient-to-br from-navy to-coal" : "border-line bg-coal/60"}`}>
        <div className="absolute inset-0 bg-scan opacity-40 pointer-events-none" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`w-2.5 h-2.5 rounded-full ${syncMode === "cloud" ? "bg-blue glow" : "bg-sky"} live-dot`} />
            <span className="font-display font-bold text-sm tracking-wider uppercase">
              {syncMode === "cloud" ? "Облачная синхронизация · Supabase" : "Локальный режим · этот браузер"}
            </span>
          </div>
          <p className="mt-3 text-sm text-paper/55 leading-relaxed max-w-2xl">
            {syncMode === "cloud"
              ? "Все изменения (треки, релизы, анонсы, новости, прослушивания) мгновенно видны каждому пользователю на любом устройстве. Онлайн-счётчик показывает реальных посетителей площадки прямо сейчас."
              : "Данные сохраняются в этом браузере и мгновенно синхронизируются между всеми открытыми вкладками. Онлайн-счётчик показывает посетителей этого устройства. Чтобы изменения видели все пользователи на всех устройствах — подключите бесплатный Supabase (инструкция ниже)."}
          </p>
          <div className="mt-4 flex flex-wrap gap-6 text-sm">
            <div>
              <div className="font-display font-black text-2xl tabular-nums">{online}</div>
              <div className="text-[10px] tracking-[0.2em] text-paper/40 uppercase mt-1">сейчас на площадке</div>
            </div>
            <div>
              <div className="font-display font-black text-2xl">{syncMode === "cloud" ? "Realtime + Presence" : "BroadcastChannel"}</div>
              <div className="text-[10px] tracking-[0.2em] text-paper/40 uppercase mt-1">транспорт синхронизации</div>
            </div>
          </div>
        </div>
      </div>

      {syncMode === "local" && (
        <div className="border border-line rounded-xl bg-coal/60 p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-5 h-[3px] bg-blue" />
            <h3 className="font-display font-bold text-sm tracking-wider uppercase">Как включить синхронизацию для всех устройств</h3>
          </div>
          <ol className="space-y-3 text-sm text-paper/60 leading-relaxed list-none">
            {[
              <>Создайте бесплатный проект на <span className="text-sky">supabase.com</span> (тариф Free подходит).</>,
              <>Откройте SQL Editor и выполните скрипт <span className="text-sky">supabase.sql</span> из корня этого репозитория — он создаст таблицу состояния, политики доступа и realtime-канал.</>,
              <>Скопируйте URL проекта и ключ <span className="text-sky">anon public key</span> (Settings → API).</>,
              <>В GitHub: Settings → Secrets → добавьте <span className="text-sky">VITE_SUPABASE_URL</span> и <span className="text-sky">VITE_SUPABASE_ANON_KEY</span>. Workflow сборки подхватит их автоматически.</>,
              <>Запушьте любой коммит — Pages пересоберётся, и площадка перейдёт в облачный режим: общий контент, живые счётчики и реальный онлайн для всех.</>,
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded bg-blue/15 border border-blue/40 text-sky font-display font-bold text-xs flex items-center justify-center">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="border border-line rounded-xl bg-coal/60 p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-5 h-[3px] bg-blue" />
          <h3 className="font-display font-bold text-sm tracking-wider uppercase">Сброс данных</h3>
        </div>
        <p className="text-sm text-paper/50 leading-relaxed mb-4">
          Полностью очищает площадку: треки, релизы, анонсы, новости и счётчики прослушиваний. Изменение сразу увидят все слушатели.
        </p>
        <button
          onClick={() => {
            if (window.confirm("Точно очистить всю площадку? Отменить это нельзя.")) resetAll();
          }}
          className={btnGhost}
        >
          ОЧИСТИТЬ ПЛОЩАДКУ
        </button>
        <span className="ml-3 text-xs text-paper/35">Пароль администратора: {ADMIN_PASSWORD} (хранится в коде, при желании замените его там)</span>
      </div>
    </div>
  );
}

/* ================= dashboard ================= */
type Tab = "tracks" | "releases" | "upcoming" | "news" | "artists" | "sync";

function Dashboard() {
  const { tracks, releases, news, upcoming, deleteTrack, deleteRelease, deleteNews, logout, playsOf, artists } = useStore();
  const [tab, setTab] = useState<Tab>("tracks");

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "tracks", label: "ТРЕКИ", count: tracks.length },
    { id: "releases", label: "РЕЛИЗЫ", count: releases.length },
    { id: "upcoming", label: "АНОНСЫ", count: upcoming.length },
    { id: "news", label: "НОВОСТИ", count: news.length },
    { id: "artists", label: "АРТИСТЫ", count: 2 },
    { id: "sync", label: "СИНХРОНИЗАЦИЯ", count: SYNC_MODE === "cloud" ? 1 : 0 },
  ];

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
        <button onClick={logout} className={btnGhost}>ВЫЙТИ</button>
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
                    {artists[t.artistId].name}
                    {t.feat && ` feat. ${artists[t.feat].name}`} · {t.kind === "file" ? "аудиофайл" : `синтез · ${t.bpm} BPM`} · {fmtTime(t.duration)} · {fmtDate(t.addedAt)}
                  </div>
                </div>
                <span className="hidden sm:block text-xs text-paper/40 tabular-nums">{playsOf(t.id)} {pluralRu(playsOf(t.id), "стрим", "стрима", "стримов")}</span>
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
            {!tracks.length && <div className="p-10 text-center text-paper/40">Треков пока нет — загрузите первый выше.</div>}
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
                    {artists[r.artistId].name} · {KIND_LABEL[r.kind]} · {r.year}
                  </div>
                  <div className="text-xs text-paper/30">{tracks.filter((t) => t.releaseId === r.id).length} {pluralRu(tracks.filter((t) => t.releaseId === r.id).length, "трек", "трека", "треков")}</div>
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
            {!releases.length && <div className="col-span-full border border-dashed border-line rounded-xl p-10 text-center text-paper/40">Релизов пока нет — создайте первый выше.</div>}
          </div>
        </div>
      )}

      {tab === "upcoming" && <UpcomingTab />}

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

      {tab === "artists" && <ArtistTab />}
      {tab === "sync" && <SyncTab />}

      <Reveal>
        <div className="mt-10 border border-line rounded-xl bg-coal/40 p-5 text-xs text-paper/35 leading-relaxed">
          Все изменения сохраняются и сразу видны слушателям: на главной, в музыке, в треках и на страницах артистов.
          Аудиофайлы хранятся локально (IndexedDB), синтезированные треки генерируются звуковым движком TimurSounds в реальном времени.
          Счётчики прослушиваний и онлайна — настоящие: они растут только от реальных действий слушателей.
        </div>
      </Reveal>
    </div>
  );
}

export function Admin() {
  const { isAdmin } = useStore();
  return isAdmin ? <Dashboard /> : <Login />;
}
