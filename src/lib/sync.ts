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
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch {
      /* повреждённые данные */
    }
    return emptyState();
  }

  private save(s: State) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(s));
    } catch {
      /* переполнение */
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
    const sb = await this.ensure();
    let state = await this.fetchState(sb);
    if (!state) {
      // Первое подключение: поднимаем в облако контент этого устройства,
      // чтобы уже загруженные треки и новости не потерялись.
      state = this.local.read();
      const hasContent = state.tracks.length > 0 || state.news.length > 0 || state.releases.length > 0;
      const toPush = hasContent ? state : emptyState();
      await sb.from("platform_state").upsert({ id: 1, data: toPush });
      state = toPush;
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
    const sb = await this.ensure();
    const base = (await this.fetchState(sb)) ?? this.local.read();
    const next = mutator(base);
    const { error } = await sb.from("platform_state").upsert({ id: 1, data: next });
    if (error) throw new Error(error.message);
    this.listeners.forEach((cb) => cb(next));
    void this.local.write(() => next);
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
