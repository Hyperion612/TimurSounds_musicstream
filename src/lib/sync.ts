/*
 * Слой синхронизации TimurSounds.
 *
 * Режим «cloud» (Supabase) включается двумя способами:
 *  1. Прямо из админ-панели (вкладка «Синхронизация»): URL и anon-ключ
 *     сохраняются в браузере — пересборка сайта не нужна.
 *  2. Переменными сборки VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
 *
 * В облачном режиме любые изменения (треки, релизы, анонсы, новости,
 * аккаунты, прослушивания) мгновенно видны всем пользователям на всех
 * устройствах (Realtime), а онлайн-счётчик считает реальных посетителей
 * (Presence).
 *
 * Без подключения работает режим «local»: данные живут в браузере и
 * синхронизируются между всеми открытыми вкладками (BroadcastChannel).
 */

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { STATE_VERSION, emptyState } from "./data";
import type { State } from "./data";

const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env ?? {};
const LS_CFG = "timursounds_cloud_cfg";

export interface CloudCfg {
  url: string;
  key: string;
}

export function getCloudCfg(): CloudCfg | null {
  try {
    const raw = localStorage.getItem(LS_CFG);
    if (raw) {
      const c = JSON.parse(raw) as CloudCfg;
      if (c && c.url && c.key) return c;
    }
  } catch {
    /* ignore */
  }
  if (env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY) {
    return { url: env.VITE_SUPABASE_URL, key: env.VITE_SUPABASE_ANON_KEY };
  }
  return null;
}

export function configureCloud(url: string, key: string) {
  localStorage.setItem(LS_CFG, JSON.stringify({ url, key }));
}

export function disconnectCloud() {
  localStorage.removeItem(LS_CFG);
}

export type SyncMode = "cloud" | "local";
export const getSyncMode = (): SyncMode => (getCloudCfg() ? "cloud" : "local");

/* ---------- предупреждения слоя синхронизации (видны в UI) ---------- */
type WarnCb = (msg: string | null) => void;
const warnListeners = new Set<WarnCb>();

export function onSyncWarn(cb: WarnCb): () => void {
  warnListeners.add(cb);
  return () => {
    warnListeners.delete(cb);
  };
}

function emitWarn(msg: string | null) {
  warnListeners.forEach((cb) => cb(msg));
}

const LS_KEY = "timursounds_state_v1";
const SESSION_KEY = "timursounds_session";

export const sessionId = (() => {
  try {
    let s = sessionStorage.getItem(SESSION_KEY);
    if (!s) {
      s = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      sessionStorage.setItem(SESSION_KEY, s);
    }
    return s;
  } catch {
    return Math.random().toString(36).slice(2);
  }
})();

export interface SyncProvider {
  init(): Promise<State>;
  subscribe(cb: (next: State) => void): () => void;
  write(mutator: (s: State) => State): Promise<void>;
  watchOnline(cb: (n: number) => void): () => void;
}

export function normalize(raw: unknown): State {
  const base = emptyState();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<State>;
  return {
    ...base,
    ...r,
    v: STATE_VERSION,
    artists: { ...base.artists, ...(r.artists ?? {}) },
    tracks: Array.isArray(r.tracks) ? r.tracks : [],
    releases: Array.isArray(r.releases) ? r.releases : [],
    news: Array.isArray(r.news) ? r.news : [],
    upcoming: Array.isArray(r.upcoming) ? r.upcoming : [],
    users: Array.isArray(r.users) ? r.users : [],
    admin: r.admin && typeof r.admin === "object" ? r.admin : null,
    plays: r.plays && typeof r.plays === "object" ? (r.plays as Record<string, number>) : {},
  };
}

/* ================= LOCAL ================= */
class LocalSync implements SyncProvider {
  private bc: BroadcastChannel | null = null;
  private listeners = new Set<(s: State) => void>();
  private onlineListeners = new Set<(n: number) => void>();
  private peers = new Map<string, number>();
  private hb: ReturnType<typeof setInterval> | null = null;

  constructor() {
    if (typeof BroadcastChannel !== "undefined") {
      this.bc = new BroadcastChannel("timursounds_sync");
      this.bc.onmessage = (e: MessageEvent) => {
        const msg = e.data as { type?: string; state?: State; id?: string };
        if (!msg) return;
        if (msg.type === "state" && msg.state) {
          this.listeners.forEach((cb) => cb(msg.state as State));
        } else if (msg.type === "ping" && msg.id) {
          this.peers.set(msg.id, Date.now());
          this.emitOnline();
        }
      };
    }
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (e) => {
        if (e.key === LS_KEY && e.newValue) {
          try {
            const s = normalize(JSON.parse(e.newValue));
            this.listeners.forEach((cb) => cb(s));
          } catch {
            /* ignore */
          }
        }
      });
    }
  }

  read(): State {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(LS_KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch {
      // повреждённые данные — сохраняем резервную копию, чтобы не потерять безвозвратно
      try {
        if (raw) localStorage.setItem(`${LS_KEY}_broken_backup`, raw);
      } catch {
        /* ignore */
      }
    }
    return emptyState();
  }

  private save(s: State) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(s));
      emitWarn(null);
    } catch {
      // QuotaExceededError: данные в памяти есть, но после перезагрузки страницы
      // они будут утеряны — обязательно сообщаем пользователю.
      emitWarn(
        "Хранилище браузера переполнено: последние изменения не сохранятся после закрытия страницы. Удалите часть треков с обложками или подключите облачную синхронизацию."
      );
    }
  }

  private emitOnline() {
    const now = Date.now();
    for (const [id, t] of this.peers) if (now - t > 9000) this.peers.delete(id);
    const n = this.peers.size + 1;
    this.onlineListeners.forEach((cb) => cb(n));
  }

  async init(): Promise<State> {
    this.hb = setInterval(() => {
      this.bc?.postMessage({ type: "ping", id: sessionId });
      this.emitOnline();
    }, 3000);
    this.bc?.postMessage({ type: "ping", id: sessionId });
    return this.read();
  }

  subscribe(cb: (next: State) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  async write(mutator: (s: State) => State): Promise<void> {
    const next = mutator(this.read());
    this.save(next);
    this.listeners.forEach((cb) => cb(next));
    this.bc?.postMessage({ type: "state", state: next });
  }

  watchOnline(cb: (n: number) => void): () => void {
    this.onlineListeners.add(cb);
    cb(this.peers.size + 1);
    return () => {
      this.onlineListeners.delete(cb);
    };
  }
}

/* ================= CLOUD (Supabase) ================= */
class SupaSync implements SyncProvider {
  private client: SupabaseClient | null = null;
  private listeners = new Set<(s: State) => void>();
  private onlineListeners = new Set<(n: number) => void>();
  private local = new LocalSync();
  private presence: RealtimeChannel | null = null;
  private url: string;
  private key: string;

  constructor(url: string, key: string) {
    this.url = url;
    this.key = key;
  }

  private async ensure(): Promise<SupabaseClient> {
    if (this.client) return this.client;
    const mod = await import("@supabase/supabase-js");
    this.client = mod.createClient(this.url, this.key);
    return this.client;
  }

  private async fetchState(sb: SupabaseClient): Promise<State | null> {
    const { data, error } = await sb.from("platform_state").select("data").eq("id", 1).maybeSingle();
    if (error) throw new Error(error.message);
    const row = data as { data?: unknown } | null;
    return row && row.data ? normalize(row.data) : null;
  }

  async init(): Promise<State> {
    let sb: SupabaseClient;
    let state: State | null = null;
    try {
      sb = await this.ensure();
      state = await this.fetchState(sb);
      if (!state) {
        // Первое подключение: поднимаем в облако контент этого устройства,
        // чтобы уже загруженные треки и новости не потерялись.
        state = this.local.read();
        const hasContent = state.tracks.length > 0 || state.news.length > 0 || state.releases.length > 0;
        const toPush = hasContent ? state : emptyState();
        const { error } = await sb.from("platform_state").upsert({ id: 1, data: toPush });
        if (error) throw new Error(error.message);
        state = toPush;
      }
      emitWarn(null);
    } catch (e) {
      // Облако недоступно (неверный ключ, RLS, сеть): площадка продолжает
      // работать на локальных данных, а админ видит причину в UI.
      emitWarn(
        `Облако Supabase недоступно (${e instanceof Error ? e.message : "ошибка соединения"}). Показаны данные этого браузера; изменения не синхронизируются, пока соединение не восстановится.`
      );
      state = this.local.read();
      return state;
    }

    const ch = sb
      .channel(`platform-state-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "platform_state" } as never,
        () => {
          void this.fetchState(sb)
            .then((s) => {
              if (!s) return;
              this.listeners.forEach((cb) => cb(s));
              void this.local.write(() => s);
            })
            .catch(() => undefined);
        }
      )
      .subscribe();
    void ch;

    const pc = sb.channel(`timursounds-online-${Math.random().toString(36).slice(2)}`, {
      config: { presence: { key: sessionId } },
    });
    const emit = () => {
      const n = Math.max(1, Object.keys(pc.presenceState()).length);
      this.onlineListeners.forEach((cb) => cb(n));
    };
    pc.on("presence", { event: "sync" }, emit);
    pc.on("presence", { event: "join" }, emit);
    pc.on("presence", { event: "leave" }, emit);
    pc.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void pc.track({ online: true, at: Date.now() });
        emit();
      }
    });
    this.presence = pc;

    void this.local.write(() => state as State);
    return state;
  }

  subscribe(cb: (next: State) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  async write(mutator: (s: State) => State): Promise<void> {
    const next = mutator(this.local.read());
    // локальная копия сохраняется всегда — данные не пропадут с этого устройства
    void this.local.write(() => next);
    this.listeners.forEach((cb) => cb(next));
    try {
      const sb = await this.ensure();
      const { error } = await sb.from("platform_state").upsert({ id: 1, data: next });
      if (error) throw new Error(error.message);
      emitWarn(null);
    } catch (e) {
      emitWarn(
        `Не удалось сохранить изменения в облако (${e instanceof Error ? e.message : "ошибка соединения"}). Данные сохранены в этом браузере; повторная отправка произойдёт при следующем изменении.`
      );
    }
  }

  watchOnline(cb: (n: number) => void): () => void {
    this.onlineListeners.add(cb);
    cb(this.presence ? Math.max(1, Object.keys(this.presence.presenceState()).length) : 1);
    return () => {
      this.onlineListeners.delete(cb);
    };
  }
}

export function createSync(): SyncProvider {
  const cfg = getCloudCfg();
  return cfg ? new SupaSync(cfg.url, cfg.key) : new LocalSync();
}

/** Быстрая проверка соединения с Supabase (до сохранения конфигурации). */
export async function testCloud(url: string, key: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const mod = await import("@supabase/supabase-js");
    const sb = mod.createClient(url, key, { auth: { persistSession: false } });
    const { error } = await sb.from("platform_state").select("id").eq("id", 1).maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Не удалось подключиться" };
  }
}

/* ---------- облачное хранилище аудиофайлов (Supabase Storage, бакет ts-audio) ---------- */
const AUDIO_BUCKET = "ts-audio";

async function storageClient() {
  const cfg = getCloudCfg();
  if (!cfg) return null;
  const mod = await import("@supabase/supabase-js");
  return mod.createClient(cfg.url, cfg.key);
}

/**
 * Загружает аудиофайл в облако и возвращает публичный URL.
 * Возвращает null, если облако не подключено или загрузка не удалась —
 * тогда трек остаётся играбельным локально (IndexedDB).
 */
export async function uploadCloudAudio(trackId: string, file: File): Promise<string | null> {
  try {
    const sb = await storageClient();
    if (!sb) return null;
    // Используем trackId как имя файла без кодирования (Supabase сам кодирует при необходимости)
    const path = `${trackId}/${file.name}`;
    const { error } = await sb.storage.from(AUDIO_BUCKET).upload(path, file, {
      contentType: file.type || "audio/mpeg",
      upsert: true,
    });
    if (error) throw new Error(error.message);
    const { data } = sb.storage.from(AUDIO_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return null;
  }
}

/** Удаляет аудиофайл из облака при удалении трека (если он туда загружался). */
export async function deleteCloudAudio(trackId: string): Promise<void> {
  try {
    const sb = await storageClient();
    if (!sb) return;
    const { data } = await sb.storage.from(AUDIO_BUCKET).list(trackId);
    const paths = (data ?? []).map((f) => `${trackId}/${f.name}`);
    if (paths.length) await sb.storage.from(AUDIO_BUCKET).remove(paths);
  } catch {
    /* файл в облаке не найден или нет доступа — не критично */
  }
}

/* ---------- общее аудио в самой базе Supabase (строка id=2 таблицы platform_state) ----------
 * Работает без бакетов, воркеров и токенов: достаточно подключённого облака данных.
 * data = { [trackId]: "data:audio/...;base64,..." }
 * Слушатель скачивает только свой трек (PostgREST-оператор ->>), вся карта — только при записи.
 */
const AUDIO_ROW_ID = 2;

async function readAudioMap(sb: Awaited<ReturnType<typeof storageClient>>): Promise<Record<string, string>> {
  if (!sb) return {};
  const { data } = await sb.from("platform_state").select("data").eq("id", AUDIO_ROW_ID).maybeSingle();
  const row = data as { data?: unknown } | null;
  return row && row.data && typeof row.data === "object" ? (row.data as Record<string, string>) : {};
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("не удалось прочитать файл"));
    r.readAsDataURL(blob);
  });
}

/**
 * Кладёт аудио трека в общее облако данных. Возвращает true при успехе.
 * Если облако не подключено — false (трек остаётся локальным).
 */
export async function uploadStateAudio(trackId: string, blob: Blob): Promise<boolean> {
  const startTime = Date.now();
  console.log(`[STATE_AUDIO] Начало загрузки трека ${trackId} (${(blob.size / 1024 / 1024).toFixed(2)} МБ)`);
  
  try {
    console.log("[STATE_AUDIO] Получение клиента Supabase...");
    const sb = await storageClient();
    if (!sb) {
      console.log("[STATE_AUDIO] ✗ Supabase клиент не инициализирован");
      return false;
    }
    console.log(`[STATE_AUDIO] Клиент получен за ${Date.now() - startTime}ms`);
    
    if (blob.size > 12 * 1024 * 1024) {
      console.warn(`[STATE_AUDIO] аудио ${trackId} больше 12 МБ — общее хранилище может работать медленно`);
    }
    
    console.log("[STATE_AUDIO] Конвертация файла в data URL...");
    const dataUrl = await blobToDataUrl(blob);
    console.log(`[STATE_AUDIO] Data URL создан за ${Date.now() - startTime}ms (размер: ${(dataUrl.length / 1024 / 1024).toFixed(2)} МБ)`);
    
    console.log("[STATE_AUDIO] Чтение текущей карты аудио...");
    const map = await readAudioMap(sb);
    console.log(`[STATE_AUDIO] Карта прочитана за ${Date.now() - startTime}ms (${Object.keys(map).length} треков)`);
    
    console.log("[STATE_AUDIO] Добавление трека в карту...");
    map[trackId] = dataUrl;
    
    console.log("[STATE_AUDIO] Загрузка карты в Supabase...");
    const { error } = await sb.from("platform_state").upsert({ id: AUDIO_ROW_ID, data: map });
    if (error) {
      console.error(`[STATE_AUDIO] ✗ Ошибка Supabase за ${Date.now() - startTime}ms:`, error.message);
      throw new Error(error.message);
    }
    
    console.log(`[STATE_AUDIO] ✓ Трек загружен в общее облако за ${Date.now() - startTime}ms`);
    return true;
  } catch (e) {
    console.error(`[STATE_AUDIO] ✗ Ошибка загрузки за ${Date.now() - startTime}ms:`, e);
    return false;
  }
}

/** Скачивает аудио трека из общего облака (только один трек, не всю карту). */
export async function fetchStateAudio(trackId: string): Promise<string | null> {
  const startTime = Date.now();
  console.log(`[FETCH_AUDIO] Запрос трека ${trackId} из общего облака...`);
  
  try {
    const sb = await storageClient();
    if (!sb) {
      console.log("[FETCH_AUDIO] ✗ Supabase клиент не инициализирован");
      return null;
    }
    console.log(`[FETCH_AUDIO] Клиент получен за ${Date.now() - startTime}ms`);
    
    if (!/^[a-zA-Z0-9_-]+$/.test(trackId)) {
      console.log("[FETCH_AUDIO] ✗ Неверный формат trackId");
      return null;
    }
    
    console.log("[FETCH_AUDIO] Выполнение запроса к Supabase...");
    const { data, error } = await sb.from("platform_state").select(`audio:data->>${trackId}`).eq("id", AUDIO_ROW_ID).maybeSingle();
    
    if (error) {
      console.error(`[FETCH_AUDIO] ✗ Ошибка Supabase за ${Date.now() - startTime}ms:`, error.message);
      return null;
    }
    
    const row = data as Record<string, unknown> | null;
    const val = row ? Object.values(row)[0] : null;
    
    if (typeof val === "string" && val.startsWith("data:audio")) {
      console.log(`[FETCH_AUDIO] ✓ Трек получен за ${Date.now() - startTime}ms (размер: ${(val.length / 1024 / 1024).toFixed(2)} МБ)`);
      return val;
    } else {
      console.log(`[FETCH_AUDIO] ✗ Трек не найден в общем облаке за ${Date.now() - startTime}ms`);
      return null;
    }
  } catch (e) {
    console.error(`[FETCH_AUDIO] ✗ Ошибка за ${Date.now() - startTime}ms:`, e);
    return null;
  }
}

/** Удаляет аудио трека из общего облака данных. */
export async function deleteStateAudio(trackId: string): Promise<void> {
  try {
    const sb = await storageClient();
    if (!sb) return;
    const map = await readAudioMap(sb);
    if (!(trackId in map)) return;
    delete map[trackId];
    await sb.from("platform_state").upsert({ id: AUDIO_ROW_ID, data: map });
  } catch {
    /* best effort */
  }
}
