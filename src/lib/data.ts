export type ArtistId = "timur" | "instasamka";
export type ReleaseKind = "album" | "single" | "ep";
export type NewsTag = "релиз" | "обновление" | "событие";

export interface Artist {
  id: ArtistId;
  name: string;
  label: string;
  role: string;
  bio: string;
}

export interface Release {
  id: string;
  title: string;
  artistId: ArtistId;
  kind: ReleaseKind;
  year: number;
  coverSeed: number;
  cover?: string; // dataURL своей обложки (если задана — вместо генеративной)
}

export interface Track {
  id: string;
  title: string;
  artistId: ArtistId;
  feat?: ArtistId;
  releaseId?: string;
  duration: number; // seconds
  bpm: number;
  seed: number;
  kind: "synth" | "file";
  addedAt: number;
  cover?: string; // dataURL своей обложки (из файла или из метаданных аудио)
  /** Публичный URL аудио в облачном хранилище (Supabase Storage) — чтобы трек играл на любом устройстве. */
  audioUrl?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  body: string;
  tag: NewsTag;
  date: number;
}

export interface Upcoming {
  id: string;
  title: string;
  kind: string;
  artistId: ArtistId;
  date: number;
  note: string;
}

export interface UserAccount {
  id: string;
  email: string;
  nick: string;
  salt: string;
  hash: string;
  favs: string[];
  createdAt: number;
}

export interface AdminCreds {
  salt: string;
  hash: string;
}

export interface State {
  v: number;
  artists: Record<ArtistId, Artist>;
  tracks: Track[];
  releases: Release[];
  news: NewsItem[];
  upcoming: Upcoming[];
  plays: Record<string, number>;
  users: UserAccount[];
  admin: AdminCreds | null; // null — пароль ещё не создан: нужна первичная настройка в админке
}

export const STATE_VERSION = 1;

export const DEFAULT_ARTISTS: Record<ArtistId, Artist> = {
  timur: {
    id: "timur",
    name: "TIMUR",
    label: "TimurSounds",
    role: "саунд-продюсер · основатель TimurSounds",
    bio: "Основатель лейбла TimurSounds. Пишет холодную электронику на стыке техно, фонка и синтвейва: ночные пульсации, аналоговые басы и сигналы из глубины города. Каждый трек на площадке спродюсирован им лично.",
  },
  instasamka: {
    id: "instasamka",
    name: "INSTASAMKA",
    label: "NaMneCash Music",
    role: "певица · NaMneCash Music",
    bio: "Российская поп- и рэп-исполнительница, блогер. Изначально получила известность как инстаблогер с провокационным контентом, а затем — как музыкальная артистка; к началу 2020-х стала одним из заметных имён российского стримингового мейнстрима. Поворотными для её музыкальной карьеры стали релизы Moneydealer и Popstar, а песни «Lipsi Ha» и «За деньги да» достигали высоких позиций в чартах и на стриминговых платформах.",
  },
};

export function emptyState(): State {
  return {
    v: STATE_VERSION,
    artists: JSON.parse(JSON.stringify(DEFAULT_ARTISTS)) as Record<ArtistId, Artist>,
    tracks: [],
    releases: [],
    news: [],
    upcoming: [],
    plays: {},
    users: [],
    admin: null,
  };
}

export function fmtTime(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

export function fmtNum(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(".", ",") + " млн";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(".", ",") + " тыс";
  return String(n);
}

export function pluralRu(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export const KIND_LABEL: Record<ReleaseKind, string> = {
  album: "АЛЬБОМ",
  single: "СИНГЛ",
  ep: "EP",
};
