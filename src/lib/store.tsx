import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { emptyState } from "./data";
import type { Artist, ArtistId, NewsItem, Release, State, Track, Upcoming, UserAccount } from "./data";
import { delAudio } from "./db";
import { createSync, getSyncMode, onSyncWarn } from "./sync";
import { deleteRemoteAudio } from "./r2";
import type { SyncMode, SyncProvider } from "./sync";

const LS_AUTH = "ts_admin_authed";
const LS_FAV = "ts_favs";
const LS_USER = "ts_current_user";

// Пароль администратора нигде не хранится в открытом виде: в состоянии площадки
// лежит только пара «соль + SHA-256-хэш». Пока запись не создана (admin === null),
// админ-панель предлагает задать пароль при первом входе — дефолтного пароля нет.

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const makeSalt = () => Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
const EMAIL_RE = /^\S+@\S+\.\S+$/;

interface StoreCtx extends State {
  ready: boolean;
  syncMode: SyncMode;
  online: number;
  reconnect: () => void;

  isAdmin: boolean;
  /** false, пока пароль администратора не создан при первом входе */
  adminConfigured: boolean;
  login: (pw: string) => Promise<boolean>;
  logout: () => void;
  /** Первичная настройка: создаёт хэш пароля (возвращает текст ошибки или null). */
  setupAdmin: (pw: string, confirm: string) => Promise<string | null>;
  changeAdminPw: (oldPw: string, newPw: string) => Promise<string | null>;
  /** Предупреждение слоя синхронизации (переполнение хранилища, облако недоступно и т.п.) */
  syncWarning: string | null;

  currentUser: UserAccount | null;
  userLogin: (email: string, pw: string) => Promise<string | null>;
  userRegister: (email: string, nick: string, pw: string) => Promise<string | null>;
  userLogout: () => void;
  deleteUser: (id: string) => void;

  mutate: (fn: (s: State) => State) => void;
  playsOf: (trackId: string) => number;
  artistPlays: (artistId: ArtistId) => number;
  artist: (id: ArtistId) => Artist;
  addTrack: (t: Track) => void;
  deleteTrack: (id: string) => void;
  addRelease: (r: Release) => void;
  updateRelease: (id: string, updates: Partial<Release>) => void;
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
  const [syncMode, setSyncMode] = useState<SyncMode>(() => getSyncMode());
  const [provider, setProvider] = useState<SyncProvider>(() => createSync());
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(LS_AUTH) === "1";
    } catch {
      return false;
    }
  });
  const [guestFavs, setGuestFavs] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_FAV) ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LS_USER);
    } catch {
      return null;
    }
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let alive = true;
    setReady(false);
    void provider.init().then((s) => {
      if (!alive) return;
      setState(s);
      stateRef.current = s;
      setReady(true);
    });
    const unSub = provider.subscribe((next: State) => {
      if (!alive) return;
      setState(next);
      stateRef.current = next;
    });
    const unOnline = provider.watchOnline((n: number) => alive && setOnline(n));
    return () => {
      alive = false;
      unSub();
      unOnline();
    };
  }, [provider]);

  useEffect(() => {
    localStorage.setItem(LS_FAV, JSON.stringify(guestFavs));
  }, [guestFavs]);

  /** Переподключение слоя синхронизации (после configureCloud / disconnectCloud). */
  const reconnect = useCallback(() => {
    setSyncMode(getSyncMode());
    setProvider(createSync());
  }, []);

  /* ---------- предупреждения синхронизации ---------- */
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  useEffect(() => onSyncWarn(setSyncWarning), []);

  /* ---------- админ ---------- */
  const verifyAdminPw = useCallback(async (pw: string): Promise<boolean> => {
    const admin = stateRef.current.admin;
    if (!admin) return false; // пароль ещё не создан — нужен первичный setup
    const h = await sha256(`${admin.salt}:${pw}`);
    return h === admin.hash;
  }, []);

  const setupAdmin = useCallback(
    async (pw: string, confirm: string): Promise<string | null> => {
      if (stateRef.current.admin) return "Пароль уже создан — воспользуйтесь входом";
      if (pw.length < 4) return "Пароль — минимум 4 символа";
      if (pw !== confirm) return "Пароли не совпадают";
      const salt = makeSalt();
      const hash = await sha256(`${salt}:${pw}`);
      mutateRef.current((s) => ({ ...s, admin: { salt, hash } }));
      return null;
    },
    []
  );

  const login = useCallback(
    async (pw: string): Promise<boolean> => {
      const ok = await verifyAdminPw(pw);
      if (ok) {
        setIsAdmin(true);
        try {
          sessionStorage.setItem(LS_AUTH, "1");
        } catch {
          /* noop */
        }
      }
      return ok;
    },
    [verifyAdminPw]
  );

  const logout = useCallback(() => {
    setIsAdmin(false);
    try {
      sessionStorage.removeItem(LS_AUTH);
    } catch {
      /* noop */
    }
  }, []);

  /* ---------- слушатели ---------- */
  const currentUser = useMemo(
    () => state.users.find((u) => u.id === currentUserId) ?? null,
    [state.users, currentUserId]
  );

  const setUser = useCallback((id: string | null) => {
    setCurrentUserId(id);
    try {
      if (id) localStorage.setItem(LS_USER, id);
      else localStorage.removeItem(LS_USER);
    } catch {
      /* noop */
    }
  }, []);

  const userRegister = useCallback(
    async (emailRaw: string, nickRaw: string, pw: string): Promise<string | null> => {
      const email = emailRaw.trim().toLowerCase();
      const nick = nickRaw.trim();
      if (!EMAIL_RE.test(email)) return "Похоже, в почте опечатка";
      if (nick.length < 2 || nick.length > 20) return "Ник — от 2 до 20 символов";
      if (pw.length < 4) return "Пароль — минимум 4 символа";
      if (stateRef.current.users.some((u) => u.email === email)) return "Эта почта уже зарегистрирована — войдите";
      const salt = makeSalt();
      const hash = await sha256(`${salt}:${pw}`);
      const acc: UserAccount = { id: `u${Date.now().toString(36)}`, email, nick, salt, hash, favs: guestFavs, createdAt: Date.now() };
      mutateRef.current((s) => ({ ...s, users: [...s.users, acc] }));
      setUser(acc.id);
      return null;
    },
    [guestFavs, setUser]
  );

  const userLogin = useCallback(
    async (emailRaw: string, pw: string): Promise<string | null> => {
      const email = emailRaw.trim().toLowerCase();
      const acc = stateRef.current.users.find((u) => u.email === email);
      if (!acc) return "Аккаунт с такой почтой не найден";
      const h = await sha256(`${acc.salt}:${pw}`);
      if (h !== acc.hash) return "Неверный пароль";
      setUser(acc.id);
      return null;
    },
    [setUser]
  );

  const userLogout = useCallback(() => setUser(null), [setUser]);

  /* ---------- мутации ---------- */
  const mutate = useCallback((fn: (s: State) => State) => {
    const next = fn(stateRef.current);
    stateRef.current = next;
    setState(next);
    void providerRef.current.write(() => next);
  }, []);
  const mutateRef = useRef(mutate);
  mutateRef.current = mutate;
  const providerRef = useRef(provider);
  providerRef.current = provider;

  const favs = currentUser ? currentUser.favs : guestFavs;

  const toggleFav = useCallback(
    (id: string) => {
      if (currentUser) {
        mutate((s) => ({
          ...s,
          users: s.users.map((u) =>
            u.id === currentUser.id
              ? { ...u, favs: u.favs.includes(id) ? u.favs.filter((x) => x !== id) : [...u.favs, id] }
              : u
          ),
        }));
      } else {
        setGuestFavs((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
      }
    },
    [currentUser, mutate]
  );

  const changeAdminPw = useCallback(
    async (oldPw: string, newPw: string): Promise<string | null> => {
      if (!(await verifyAdminPw(oldPw))) return "Текущий пароль указан неверно";
      if (newPw.length < 4) return "Новый пароль — минимум 4 символа";
      const salt = makeSalt();
      const hash = await sha256(`${salt}:${newPw}`);
      mutate((s) => ({ ...s, admin: { salt, hash } }));
      return null;
    },
    [mutate, verifyAdminPw]
  );

  const deleteUser = useCallback(
    (id: string) => {
      mutate((s) => ({ ...s, users: s.users.filter((u) => u.id !== id) }));
      if (currentUserId === id) setUser(null);
    },
    [mutate, currentUserId, setUser]
  );

  const value = useMemo<StoreCtx>(
    () => ({
      ...state,
      ready,
      syncMode,
      online,
      reconnect,
      isAdmin,
      adminConfigured: state.admin !== null,
      setupAdmin,
      syncWarning,
      login,
      logout,
      changeAdminPw,
      currentUser,
      userLogin,
      userRegister,
      userLogout,
      deleteUser,
      favs,
      toggleFav,
      mutate,
      playsOf: (trackId) => state.plays[trackId] ?? 0,
      artistPlays: (artistId) =>
        state.tracks.reduce((sum, t) => (t.artistId === artistId ? sum + (state.plays[t.id] ?? 0) : sum), 0),
      artist: (id) => state.artists[id],
      addTrack: (t) => mutate((s) => ({ ...s, tracks: [t, ...s.tracks] })),
      deleteTrack: (id) => {
        const t = stateRef.current.tracks.find((x) => x.id === id);
        mutate((s) => ({
          ...s,
          tracks: s.tracks.filter((x) => x.id !== id),
          users: s.users.map((u) => ({ ...u, favs: u.favs.filter((x) => x !== id) })),
        }));
        setGuestFavs((f) => f.filter((x) => x !== id));
        // целостность данных: вместе с треком удаляем аудиофайл из IndexedDB
        // и из облачного хранилища — R2 или Supabase Storage (если он туда загружался)
        void delAudio(id);
        if (t?.audioUrl) void deleteRemoteAudio(id, t.audioUrl);
      },
      addRelease: (r) => mutate((s) => ({ ...s, releases: [r, ...s.releases] })),
      updateRelease: (id, updates) =>
        mutate((s) => ({
          ...s,
          releases: s.releases.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        })),
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
      incPlays: (trackId) => mutate((s) => ({ ...s, plays: { ...s.plays, [trackId]: (s.plays[trackId] ?? 0) + 1 } })),
      resetAll: () => {
        const fresh = emptyState();
        // сохраняем админ-пароль и аккаунты слушателей
        mutate((s) => ({ ...fresh, admin: s.admin, users: s.users }));
      },
      getTrack: (id) => state.tracks.find((t) => t.id === id),
      getRelease: (id) => state.releases.find((r) => r.id === id),
    }),
    [
      state, ready, syncMode, online, reconnect, isAdmin, setupAdmin, syncWarning, login, logout, changeAdminPw,
      currentUser, userLogin, userRegister, userLogout, deleteUser, favs, toggleFav, mutate,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore outside provider");
  return v;
}
