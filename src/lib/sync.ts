/*
 * Слой синхронизации TimurSounds.
 *
 * Режим «cloud» (Supabase) включается автоматически, если при сборке заданы
 * VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY (см. supabase.sql и вкладку «Синхронизация» в админке).
 * В этом режиме любые изменения видны всем пользователям на всех устройствах
 * в реальном времени, а онлайн-счётчик считает реальных посетителей (presence).
 *
 * Без ключей работает режим «local»: данные живут в браузере и мгновенно
 * синхронизируются между всеми открытыми вкладками (BroadcastChannel + storage).
 */

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { STATE_VERSION, emptyState } from "./data";
import type { State } from "./data";

const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env ?? {};
const SB_URL = env.VITE_SUPABASE_URL;
const SB_KEY = env.VITE_SUPABASE_ANON_KEY;

export const SYNC_MODE: "cloud" | "local" = SB_URL && SB_KEY ? "cloud" : "local";

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

  private read(): State {
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
  private local = new LocalSync();
  private presence: RealtimeChannel | null = null;

  private async ensure(): Promise<SupabaseClient> {
    if (this.client) return this.client;
    const mod = await import("@supabase/supabase-js");
    this.client = mod.createClient(SB_URL as string, SB_KEY as string);
    return this.client;
  }

  private async fetchState(sb: SupabaseClient): Promise<State> {
    const { data } = await sb.from("platform_state").select("data").eq("id", 1).maybeSingle();
    const row = data as { data?: unknown } | null;
    return row && row.data ? normalize(row.data) : emptyState();
  }

  async init(): Promise<State> {
    const sb = await this.ensure();
    let state = await this.fetchState(sb);
    const { data } = await sb.from("platform_state").select("id").eq("id", 1).maybeSingle();
    if (!data) {
      await sb.from("platform_state").insert({ id: 1, data: state });
    }

    // realtime-подписка: изменения прилетают всем клиентам мгновенно
    const ch = sb
      .channel("platform-state-changes")
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "platform_state" } as never,
        () => {
          void this.fetchState(sb).then((s) => this.listeners.forEach((cb) => cb(s)));
        }
      )
      .subscribe();
    void ch;

    // presence — реальные посетители онлайн
    const pc = sb.channel("timursounds-online", { config: { presence: { key: sessionId } } });
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

    state = await this.fetchState(sb);
    return state;
  }

  private onlineListeners = new Set<(n: number) => void>();

  subscribe(cb: (next: State) => void): () => void {
    this.listeners.add(cb);
    const unLocal = this.local.subscribe(cb);
    return () => {
      this.listeners.delete(cb);
      unLocal();
    };
  }

  async write(mutator: (s: State) => State): Promise<void> {
    const sb = await this.ensure();
    const base = await this.fetchState(sb);
    const next = mutator(base);
    await sb.from("platform_state").upsert({ id: 1, data: next });
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

export const sync: SyncProvider = SYNC_MODE === "cloud" ? new SupaSync() : new LocalSync();
