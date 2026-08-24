import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { seedDB } from "./data";
import type { DB, NewsItem, Release, Track, Upcoming } from "./data";
import { delAudio } from "./db";

const LS_DB = "ts_db_v3";
const LS_AUTH = "ts_admin_authed";
const LS_FAV = "ts_favs";
const ADMIN_PASSWORD = "timursounds";

interface StoreCtx extends DB {
  isAdmin: boolean;
  login: (pw: string) => boolean;
  logout: () => void;
  addTrack: (t: Track) => void;
  deleteTrack: (id: string) => void;
  addRelease: (r: Release) => void;
  deleteRelease: (id: string) => void;
  addNews: (n: NewsItem) => void;
  deleteNews: (id: string) => void;
  setUpcoming: (u: Upcoming | null) => void;
  incPlays: (id: string) => void;
  favs: string[];
  toggleFav: (id: string) => void;
  resetDemo: () => void;
  getTrack: (id: string) => Track | undefined;
  getRelease: (id: string) => Release | undefined;
}

const Ctx = createContext<StoreCtx | null>(null);

function loadDB(): DB {
  try {
    const raw = localStorage.getItem(LS_DB);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed && parsed.v === 3 && Array.isArray(parsed.tracks)) return parsed;
    }
  } catch {
    /* повреждённые данные — пересеваем */
  }
  return seedDB();
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(loadDB);
  const [isAdmin, setIsAdmin] = useState<boolean>(() => sessionStorage.getItem(LS_AUTH) === "1");
  const [favs, setFavs] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_FAV) ?? "[]") as string[];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_DB, JSON.stringify(db));
    } catch {
      /* переполнение хранилища */
    }
  }, [db]);

  useEffect(() => {
    localStorage.setItem(LS_FAV, JSON.stringify(favs));
  }, [favs]);

  const login = useCallback((pw: string) => {
    if (pw.trim() === ADMIN_PASSWORD) {
      setIsAdmin(true);
      sessionStorage.setItem(LS_AUTH, "1");
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setIsAdmin(false);
    sessionStorage.removeItem(LS_AUTH);
  }, []);

  const value = useMemo<StoreCtx>(
    () => ({
      ...db,
      isAdmin,
      login,
      logout,
      favs,
      toggleFav: (id) => setFavs((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id])),
      addTrack: (t) => setDb((d) => ({ ...d, tracks: [t, ...d.tracks] })),
      deleteTrack: (id) => {
        setDb((d) => ({ ...d, tracks: d.tracks.filter((t) => t.id !== id) }));
        setFavs((f) => f.filter((x) => x !== id));
        void delAudio(id);
      },
      addRelease: (r) => setDb((d) => ({ ...d, releases: [r, ...d.releases] })),
      deleteRelease: (id) =>
        setDb((d) => ({
          ...d,
          releases: d.releases.filter((r) => r.id !== id),
          tracks: d.tracks.map((t) => (t.releaseId === id ? { ...t, releaseId: undefined } : t)),
        })),
      addNews: (n) => setDb((d) => ({ ...d, news: [n, ...d.news] })),
      deleteNews: (id) => setDb((d) => ({ ...d, news: d.news.filter((n) => n.id !== id) })),
      setUpcoming: (u) => setDb((d) => ({ ...d, upcoming: u })),
      incPlays: (id) =>
        setDb((d) => ({ ...d, tracks: d.tracks.map((t) => (t.id === id ? { ...t, plays: t.plays + 1 } : t)) })),
      resetDemo: () => setDb(seedDB()),
      getTrack: (id) => db.tracks.find((t) => t.id === id),
      getRelease: (id) => db.releases.find((r) => r.id === id),
    }),
    [db, isAdmin, login, logout, favs]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore outside provider");
  return v;
}
