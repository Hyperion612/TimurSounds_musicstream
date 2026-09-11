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
let audioFolderCache: any = null;

async function getStorage(): Promise<Storage> {
  const cfg = getMegaCfg();
  if (!cfg) throw new Error("MEGA не настроен");
  const key = `${cfg.email}:${cfg.password}`;
  if (storageCache && storageCacheKey === key) return storageCache;
  console.log("[MEGA] Подключение к аккаунту...");
  const storage = new Storage({ email: cfg.email, password: cfg.password });
  await storage.ready;
  console.log("[MEGA] Подключено успешно");
  storageCache = storage;
  storageCacheKey = key;
  audioFolderCache = null; // сбрасываем кэш папки при переподключении
  return storage;
}

async function ensureFolder(storage: Storage): Promise<any> {
  if (audioFolderCache) return audioFolderCache;
  
  console.log("[MEGA] Поиск папки /TimurSounds/audio...");
  const root = storage.root;
  const rootChildren = root.children || [];
  let folder = rootChildren.find((c: any) => c.name === MEGA_FOLDER && c.directory);
  
  if (!folder) {
    console.log("[MEGA] Создание папки /TimurSounds...");
    folder = await root.mkdir(MEGA_FOLDER);
  }
  
  const folderChildren = folder.children || [];
  let audioFolder = folderChildren.find((c: any) => c.name === "audio" && c.directory);
  
  if (!audioFolder) {
    console.log("[MEGA] Создание папки /TimurSounds/audio...");
    audioFolder = await folder.mkdir("audio");
  }
  
  audioFolderCache = audioFolder;
  console.log("[MEGA] Папка готова");
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
  const startTime = Date.now();
  console.log(`[MEGA] Начало загрузки трека ${trackId} (${(file.size / 1024 / 1024).toFixed(2)} МБ)`);
  
  try {
    console.log("[MEGA] Получение хранилища...");
    const storage = await getStorage();
    console.log(`[MEGA] Хранилище получено за ${Date.now() - startTime}ms`);
    
    console.log("[MEGA] Поиск/создание папки...");
    const audioFolder = await ensureFolder(storage);
    console.log(`[MEGA] Папка готова за ${Date.now() - startTime}ms`);
    
    // Удаляем старый файл с тем же именем, если есть
    const folderChildren = audioFolder.children || [];
    const oldFile = folderChildren.find((c: any) => c.name === trackId);
    if (oldFile) {
      console.log("[MEGA] Удаление старого файла...");
      await oldFile.delete();
      console.log(`[MEGA] Старый файл удалён за ${Date.now() - startTime}ms`);
    }
    
    console.log("[MEGA] Чтение файла в память...");
    const buffer = await fileToArrayBuffer(file);
    console.log(`[MEGA] Файл прочитан за ${Date.now() - startTime}ms`);
    
    console.log("[MEGA] Начало загрузки в MEGA...");
    const uploaded = await audioFolder.upload(
      { name: trackId, size: buffer.byteLength },
      new Uint8Array(buffer)
    );
    
    console.log("[MEGA] Ожидание завершения загрузки...");
    await uploaded.complete;
    console.log(`[MEGA] Файл загружен за ${Date.now() - startTime}ms`);
    
    // Получаем публичную ссылку
    console.log("[MEGA] Получение публичной ссылки...");
    const link = await uploaded.link();
    
    if (!link) {
      throw new Error("Не удалось получить публичную ссылку на файл");
    }
    
    console.log(`[MEGA] ✓ Загрузка завершена за ${Date.now() - startTime}ms`);
    console.log(`[MEGA] Публичная ссылка: ${link}`);
    return link;
  } catch (error) {
    console.error(`[MEGA] ✗ Ошибка загрузки за ${Date.now() - startTime}ms:`, error);
    throw error;
  }
}

/** Удаляет аудио из MEGA (best effort). */
export async function deleteMegaAudio(trackId: string): Promise<void> {
  try {
    console.log(`[MEGA] Удаление трека ${trackId}...`);
    const storage = await getStorage();
    const audioFolder = await ensureFolder(storage);
    const folderChildren = audioFolder.children || [];
    const file = folderChildren.find((c: any) => c.name === trackId);
    if (file) {
      await file.delete();
      console.log("[MEGA] Файл удалён");
    } else {
      console.log("[MEGA] Файл не найден");
    }
  } catch (e) {
    console.warn("[MEGA] Ошибка удаления:", e);
    /* файл мог не загружаться */
  }
}

/** Проверка доступа до сохранения конфигурации. */
export async function testMega(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const e = email.trim();
    const p = password;
    if (!e || !p) return { ok: false, error: "Нужны email и пароль" };
    
    console.log("[MEGA] Проверка подключения...");
    const storage = new Storage({ email: e, password: p });
    await storage.ready;
    
    // Проверяем, что можем читать корневую папку
    const root = storage.root;
    if (!root) {
      return { ok: false, error: "Не удалось получить доступ к файлам" };
    }
    
    console.log("[MEGA] Подключение успешно");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Не удалось подключиться к MEGA";
    console.error("[MEGA] Ошибка подключения:", msg);
    
    if (msg.includes("Login failed") || msg.includes("incorrect")) {
      return { ok: false, error: "Неверный email или пароль" };
    }
    if (msg.includes("ENOTFOUND") || msg.includes("network")) {
      return { ok: false, error: "Нет соединения с серверами MEGA" };
    }
    return { ok: false, error: msg };
  }
}
