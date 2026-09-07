/*
 * Хранилище аудио в MEGA.
 *
 * MEGA поддерживает шифрование на стороне клиента — файлы хранятся безопасно.
 * Для подключения нужны email и пароль аккаунта MEGA.
 * Файлы загружаются в папку /TimurSounds/audio/{trackId}
 */

import { Storage } from "megajs";

export interface MegaCfg {
  email: string;
  password: string;
}

const LS_MEGA = "timursounds_mega_cfg";
const MEGA_FOLDER = "TimurSounds";

export function getMegaCfg(): MegaCfg | null {
  try {
    const raw = localStorage.getItem(LS_MEGA);
    if (raw) {
      const c = JSON.parse(raw) as MegaCfg;
      if (c && c.email && c.password) {
        return { email: c.email.trim(), password: c.password };
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function setMegaCfg(cfg: MegaCfg) {
  localStorage.setItem(LS_MEGA, JSON.stringify(cfg));
}

export function clearMegaCfg() {
  localStorage.removeItem(LS_MEGA);
}

let storageCache: Storage | null = null;
let storageCacheKey = "";

async function getStorage(): Promise<Storage> {
  const cfg = getMegaCfg();
  if (!cfg) throw new Error("MEGA не настроен");
  const key = `${cfg.email}:${cfg.password}`;
  if (storageCache && storageCacheKey === key) return storageCache;
  const storage = new Storage({ email: cfg.email, password: cfg.password });
  await storage.ready;
  storageCache = storage;
  storageCacheKey = key;
  return storage;
}

async function ensureFolder(storage: Storage): Promise<any> {
  const root = storage.root;
  const rootChildren = root.children || [];
  let folder = rootChildren.find((c: any) => c.name === MEGA_FOLDER && c.directory);
  if (!folder) {
    folder = await root.mkdir(MEGA_FOLDER);
  }
  const folderChildren = folder.children || [];
  let audioFolder = folderChildren.find((c: any) => c.name === "audio" && c.directory);
  if (!audioFolder) {
    audioFolder = await folder.mkdir("audio");
  }
  return audioFolder;
}

function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error("не удалось прочитать файл"));
    reader.readAsArrayBuffer(file);
  });
}

/** Загружает аудио в MEGA и возвращает публичную ссылку. */
export async function uploadMegaAudio(trackId: string, file: File): Promise<string> {
  const storage = await getStorage();
  const audioFolder = await ensureFolder(storage);
  
  // Удаляем старый файл с тем же именем, если есть
  const folderChildren = audioFolder.children || [];
  const oldFile = folderChildren.find((c: any) => c.name === trackId);
  if (oldFile) {
    await oldFile.delete();
  }
  
  const buffer = await fileToArrayBuffer(file);
  const uploaded = await audioFolder.upload({ name: trackId, size: buffer.byteLength }, new Uint8Array(buffer));
  await uploaded.complete;
  
  // Получаем публичную ссылку
  const link = uploaded.link();
  return link;
}

/** Удаляет аудио из MEGA (best effort). */
export async function deleteMegaAudio(trackId: string): Promise<void> {
  try {
    const storage = await getStorage();
    const audioFolder = await ensureFolder(storage);
    const file = audioFolder.children.find((c: any) => c.name === trackId);
    if (file) {
      await file.delete();
    }
  } catch {
    /* файл мог не загружаться */
  }
}

/** Проверка доступа до сохранения конфигурации. */
export async function testMega(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const e = email.trim();
    const p = password;
    if (!e || !p) return { ok: false, error: "Нужны email и пароль" };
    const storage = new Storage({ email: e, password: p });
    await storage.ready;
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Не удалось подключиться к MEGA";
    if (msg.includes("Login failed") || msg.includes("incorrect")) {
      return { ok: false, error: "Неверный email или пароль" };
    }
    return { ok: false, error: msg };
  }
}
