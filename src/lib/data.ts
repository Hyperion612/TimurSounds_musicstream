export type ArtistId = "timur" | "instasamka";
export type ReleaseKind = "album" | "single" | "ep";
export type NewsTag = "релиз" | "обновление" | "событие";

export interface Artist {
  id: ArtistId;
  name: string;
  label: string;
  role: string;
  bio: string;
  listeners: number;
}

export interface Release {
  id: string;
  title: string;
  artistId: ArtistId;
  kind: ReleaseKind;
  year: number;
  coverSeed: number;
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
  plays: number;
  addedAt: number;
}

export interface NewsItem {
  id: string;
  title: string;
  body: string;
  tag: NewsTag;
  date: number;
}

export interface Upcoming {
  title: string;
  kind: string;
  artistId: ArtistId;
  date: number;
  note: string;
}

export const ARTISTS: Record<ArtistId, Artist> = {
  timur: {
    id: "timur",
    name: "TIMUR",
    label: "TimurSounds",
    role: "саунд-продюсер · основатель TimurSounds",
    bio: "Основатель лейбла TimurSounds. Пишет холодную электронику на стыке техно, фонка и синтвейва: ночные пульсации, аналоговые басы и сигналы из глубины города. Каждый трек на площадке спродюсирован им лично.",
    listeners: 1284502,
  },
  instasamka: {
    id: "instasamka",
    name: "INSTASAMKA",
    label: "NaMneCash Music",
    role: "певица · NaMneCash Music",
    bio: "Певица лейбла NaMneCash Music. Дерзкий поп-рэп, блеск и максимальная громкость. На TimurSounds представлена официальная страница с синглами и коллаборацией с TIMUR.",
    listeners: 3876114,
  },
};

export const artistName = (id: ArtistId) => ARTISTS[id].name;

const D = 86400000;

export function seedDB() {
  const now = Date.now();

  const releases: Release[] = [
    { id: "r1", title: "NOCTURNE", artistId: "timur", kind: "album", year: 2025, coverSeed: 11 },
    { id: "r2", title: "MIDNIGHT TAPE", artistId: "timur", kind: "ep", year: 2025, coverSeed: 27 },
    { id: "r3", title: "COLD CIRCUIT", artistId: "timur", kind: "single", year: 2024, coverSeed: 43 },
    { id: "r4", title: "ГРАВИТАЦИЯ", artistId: "timur", kind: "single", year: 2024, coverSeed: 58 },
    { id: "r5", title: "ЗОЛОТО", artistId: "instasamka", kind: "single", year: 2025, coverSeed: 71 },
    { id: "r6", title: "ДРАМА", artistId: "instasamka", kind: "single", year: 2024, coverSeed: 83 },
    { id: "r7", title: "POPSTAR", artistId: "instasamka", kind: "single", year: 2024, coverSeed: 96 },
    { id: "r8", title: "ХОЛОД", artistId: "instasamka", kind: "single", year: 2025, coverSeed: 108 },
  ];

  const tracks: Track[] = [
    { id: "t1", title: "ИМПУЛЬС", artistId: "timur", releaseId: "r1", duration: 184, bpm: 124, seed: 101, kind: "synth", plays: 48211, addedAt: now - 6 * D },
    { id: "t2", title: "СИНИЙ КОД", artistId: "timur", releaseId: "r1", duration: 172, bpm: 128, seed: 202, kind: "synth", plays: 61043, addedAt: now - 6 * D },
    { id: "t3", title: "03:00", artistId: "timur", releaseId: "r1", duration: 201, bpm: 96, seed: 303, kind: "synth", plays: 39980, addedAt: now - 6 * D },
    { id: "t4", title: "НЕОН", artistId: "timur", releaseId: "r1", duration: 165, bpm: 122, seed: 404, kind: "synth", plays: 27415, addedAt: now - 6 * D },
    { id: "t5", title: "ХРУСТАЛЬ", artistId: "timur", releaseId: "r1", duration: 190, bpm: 104, seed: 505, kind: "synth", plays: 21330, addedAt: now - 6 * D },
    { id: "t6", title: "ПОЛУНОЧНЫЙ", artistId: "timur", releaseId: "r2", duration: 178, bpm: 118, seed: 606, kind: "synth", plays: 18902, addedAt: now - 20 * D },
    { id: "t7", title: "КАССЕТА", artistId: "timur", releaseId: "r2", duration: 161, bpm: 132, seed: 707, kind: "synth", plays: 15210, addedAt: now - 20 * D },
    { id: "t8", title: "СНЫ В 4K", artistId: "timur", releaseId: "r2", duration: 185, bpm: 100, seed: 808, kind: "synth", plays: 12754, addedAt: now - 20 * D },
    { id: "t9", title: "COLD CIRCUIT", artistId: "timur", releaseId: "r3", duration: 169, bpm: 126, seed: 909, kind: "synth", plays: 30112, addedAt: now - 90 * D },
    { id: "t10", title: "ГРАВИТАЦИЯ", artistId: "timur", releaseId: "r4", duration: 192, bpm: 110, seed: 111, kind: "synth", plays: 26887, addedAt: now - 120 * D },
    { id: "t11", title: "ЗОЛОТО", artistId: "instasamka", releaseId: "r5", duration: 164, bpm: 120, seed: 121, kind: "synth", plays: 88431, addedAt: now - 4 * D },
    { id: "t12", title: "ДРАМА", artistId: "instasamka", releaseId: "r6", duration: 158, bpm: 124, seed: 131, kind: "synth", plays: 64209, addedAt: now - 60 * D },
    { id: "t13", title: "POPSTAR", artistId: "instasamka", releaseId: "r7", duration: 176, bpm: 118, seed: 141, kind: "synth", plays: 71508, addedAt: now - 80 * D },
    { id: "t14", title: "ХОЛОД", artistId: "instasamka", feat: "timur", releaseId: "r8", duration: 181, bpm: 112, seed: 151, kind: "synth", plays: 96344, addedAt: now - 2 * D },
  ];

  const news: NewsItem[] = [
    {
      id: "n1",
      tag: "релиз",
      title: "Коллаборация TIMUR × INSTASAMKA — трек «ХОЛОД» уже на площадке",
      body: "Совместный сингл лейблов TimurSounds и NaMneCash Music. Продюсерский бит TIMUR и вокал INSTASAMKA — самое горячее, что выходило на площадке этой зимой. Слушайте в разделе треков.",
      date: now - 2 * D,
    },
    {
      id: "n2",
      tag: "событие",
      title: "INSTASAMKA получила официальную страницу на TimurSounds",
      body: "По договорённости с лейблом NaMneCash Music на платформе открыта страница артистки: синглы «ЗОЛОТО», «ДРАМА», «POPSTAR» и новый «ХОЛОД». Раздел «Музыка» обновлён.",
      date: now - 4 * D,
    },
    {
      id: "n3",
      tag: "релиз",
      title: "Альбом NOCTURNE полностью доступен для прослушивания",
      body: "Пять ночных треков от TIMUR: «ИМПУЛЬС», «СИНИЙ КОД», «03:00», «НЕОН» и «ХРУСТАЛЬ». Альбом сведён в единый звуковой код — слушайте подряд, как задумано продюсером.",
      date: now - 6 * D,
    },
    {
      id: "n4",
      tag: "обновление",
      title: "Обновление платформы: плеер, страницы артистов, лента новостей",
      body: "Запущена новая версия TimurSounds. Постоянный плеер внизу экрана, очереди воспроизведения, страницы TIMUR и INSTASAMKA, а также эта лента — новости пишет администратор площадки.",
      date: now - 9 * D,
    },
  ];

  const upcoming: Upcoming = {
    title: "СИНИЙ КОД: DELUXE",
    kind: "альбом",
    artistId: "timur",
    date: now + 12 * D + 7 * 3600000,
    note: "Расширенное издание альбома NOCTURNE: три новых трека, инструменталы и ремикс от гостей лейбла. Премьера ровно в 00:00 по МСК.",
  };

  return { v: 3, tracks, releases, news, upcoming };
}

export interface DB {
  v: number;
  tracks: Track[];
  releases: Release[];
  news: NewsItem[];
  upcoming: Upcoming | null;
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

export const KIND_LABEL: Record<ReleaseKind, string> = {
  album: "АЛЬБОМ",
  single: "СИНГЛ",
  ep: "EP",
};
