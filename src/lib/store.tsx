import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { emptyState } from "./data";
import type { Artist, ArtistId, NewsItem, Release, State, Track, Upcoming } from "./data";
import { delAudio } from "./db";
import { SYNC_MODE, sync } from "./sync";

const LS_AUTH = "ts_admin_authed";
const LS_FAV = "ts_favs";
export const ADMIN_PASSWORD = "timursounds";

interface StoreCtx extends State {
  ready: boolean;
  syncMode: "cloud" | "local";
  online: number;
  isAdmin: boolean;
  login: (pw: string) => boolean;
  logout: () => void;
  mutate: (fn: (s: State) => State) => void;
  playsOf: (trackId: string) => number;
  artistPlays: (artistId: ArtistId) => number;
  artist: (id: ArtistId) => Artist;
  addTrack: (t: Track) => void;
  deleteTrack: (id: string) => void;
  addRelease: (r: Release) => void;
  deleteRelease: (id: string) => void;
  addNews: (n: NewsItem) => void;
  deleteNews: (id: string) => void;
  addUpcoming: (u: Upcoming) => void;
  removeUpcoming: (id: string) => void;
  saveArtist: (a: Artist) => void;
  incPlays: (trackId: string) => void;
  resetAll: () => void;
  favs: string[];
  toggleFav: (id: string) => void;
  getTrack: (id: string) => Track | undefined;
  getRelease: (id: string) => Release | undefined;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(() => emptyState());
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(1);
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(LS_AUTH) === "1";
    } catch {
      return false;
    }
  });
  const [favs, setFavs] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_FAV) ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let alive = true;
    void sync.init().then((s) => {
      if (!alive) return;
      setState(s);
      stateRef.current = s;
      setReady(true);
    });
    const unSub = sync.subscribe((next) => {
      if (!alive) return;
      setState(next);
      stateRef.current = next;
    });
    const unOnline = sync.watchOnline((n) => alive && setOnline(n));
    return () => {
      alive = false;
      unSub();
      unOnline();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_FAV, JSON.stringify(favs));
  }, [favs]);

  const login = useCallback((pw: string) => {
    if (pw.trim() === ADMIN_PASSWORD) {
      setIsAdmin(true);
      try {
        sessionStorage.setItem(LS_AUTH, "1");
      } catch {
        /* noop */
      }
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setIsAdmin(false);
    try {
      sessionStorage.removeItem(LS_AUTH);
    } catch {
      /* noop */
    }
  }, []);

  const mutate = useCallback((fn: (s: State) => State) => {
    const next = fn(stateRef.current);
    stateRef.current = next;
    setState(next);
    void sync.write(() => next);
  }, []);

  const value = useMemo<StoreCtx>(
    () => ({
      ...state,
      ready,
      syncMode: SYNC_MODE,
      online,
      isAdmin,
      login,
      logout,
      favs,
      toggleFav: (id) => setFavs((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id])),
      mutate,
      playsOf: (trackId) => state.plays[trackId] ?? 0,
      artistPlays: (artistId) =>
        state.tracks.reduce((sum, t) => (t.artistId === artistId ? sum + (state.plays[t.id] ?? 0) : sum), 0),
      artist: (id) => state.artists[id],
      addTrack: (t) => mutate((s) => ({ ...s, tracks: [t, ...s.tracks] })),
      deleteTrack: (id) => {
        mutate((s) => ({ ...s, tracks: s.tracks.filter((t) => t.id !== id) }));
        setFavs((f) => f.filter((x) => x !== id));
        void delAudio(id);
      },
      addRelease: (r) => mutate((s) => ({ ...s, releases: [r, ...s.releases] })),
      deleteRelease: (id) =>
        mutate((s) => ({
          ...s,
          releases: s.releases.filter((r) => r.id !== id),
          tracks: s.tracks.map((t) => (t.releaseId === id ? { ...t, releaseId: undefined } : t)),
        })),
      addNews: (n) => mutate((s) => ({ ...s, news: [n, ...s.news] })),
      deleteNews: (id) => mutate((s) => ({ ...s, news: s.news.filter((n) => n.id !== id) })),
      addUpcoming: (u) => mutate((s) => ({ ...s, upcoming: [...s.upcoming, u].sort((a, b) => a.date - b.date) })),
      removeUpcoming: (id) => mutate((s) => ({ ...s, upcoming: s.upcoming.filter((u) => u.id !== id) })),
      saveArtist: (a) => mutate((s) => ({ ...s, artists: { ...s.artists, [a.id]: a } })),
      incPlays: (trackId) =>
        mutate((s) => ({ ...s, plays: { ...s.plays, [trackId]: (s.plays[trackId] ?? 0) + 1 } })),
      resetAll: () => mutate(() => emptyState()),
      getTrack: (id) => state.tracks.find((t) => t.id === id),
      getRelease: (id) => state.releases.find((r) => r.id === id),
    }),
    [state, ready, online, isAdmin, login, logout, favs, mutate]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore outside provider");
  return v;
}
