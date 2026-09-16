/*
 * Хранилище аудио в pCloud.
 *
 * pCloud поддерживает OAuth 2.0 аутентификацию и имеет CDN для быстрой раздачи.
 * Бесплатный тариф: 10 ГБ.
 * Файлы загружаются в папку /TimurSounds/audio/
 */

export interface PCloudCfg {
  accessToken: string;
  hostname: string; // api.pcloud.com или eapi.pcloud.com
  uid: string;
}

const LS_PCLOUD = "timursounds_pcloud_cfg";
const PCLOUD_FOLDER = "/TimurSounds/audio";

export function getPCloudCfg(): PCloudCfg | null {
  try {
    const raw = localStorage.getItem(LS_PCLOUD);
    if (raw) {
      const c = JSON.parse(raw) as PCloudCfg;
      if (c && c.accessToken && c.hostname && c.uid) {
        return c;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function setPCloudCfg(cfg: PCloudCfg) {
  localStorage.setItem(LS_PCLOUD, JSON.stringify(cfg));
}

export function clearPCloudCfg() {
  localStorage.removeItem(LS_PCLOUD);
}

let folderIdCache: number | null = null;

/**
 * Создаёт папку /TimurSounds/audio если её нет, возвращает folderid.
 */
async function ensureFolder(cfg: PCloudCfg): Promise<number> {
  if (folderIdCache !== null) return folderIdCache;

  console.log("[pCloud] Создание папки /TimurSounds/audio...");
  
  // Создаём /TimurSounds
  const res1 = await fetch(
    `https://${cfg.hostname}/createfolderifnotexists?access_token=${cfg.accessToken}&path=/TimurSounds`
  );
  const json1 = await res1.json();
  if (json1.result !== 0) {
    throw new Error(`Не удалось создать папку /TimurSounds: ${json1.result}`);
  }

  // Создаём /TimurSounds/audio
  const res2 = await fetch(
    `https://${cfg.hostname}/createfolderifnotexists?access_token=${cfg.accessToken}&path=/TimurSounds/audio`
  );
  const json2 = await res2.json();
  if (json2.result !== 0) {
    throw new Error(`Не удалось создать папку /TimurSounds/audio: ${json2.result}`);
  }

  const id = json2.metadata.folderid;
  folderIdCache = id;
  console.log(`[pCloud] Папка готова (folderid: ${id})`);
  return id;
}

/**
 * Загружает аудио в pCloud и возвращает fileid.
 */
export async function uploadPCloudAudio(trackId: string, file: File): Promise<string> {
  console.log(`[pCloud] Начало загрузки трека ${trackId} (${(file.size / 1024 / 1024).toFixed(2)} МБ)`);
  
  const cfg = getPCloudCfg();
  if (!cfg) throw new Error("pCloud не настроен");

  const folderId = await ensureFolder(cfg);

  console.log("[pCloud] Загрузка файла...");
  const formData = new FormData();
  formData.append("file", file, trackId);

  const res = await fetch(
    `https://${cfg.hostname}/uploadfile?access_token=${cfg.accessToken}&folderid=${folderId}&filename=${encodeURIComponent(trackId)}&nopartial=1`,
    {
      method: "POST",
      body: formData,
    }
  );

  const json = await res.json();
  if (json.result !== 0) {
    throw new Error(`Ошибка загрузки: ${json.result}`);
  }

  const fileId = json.fileids[0];
  console.log(`[pCloud] Файл загружен (fileid: ${fileId})`);

  // Получаем публичную ссылку
  console.log("[pCloud] Получение публичной ссылки...");
  const linkRes = await fetch(
    `https://${cfg.hostname}/getfilepublink?access_token=${cfg.accessToken}&fileid=${fileId}`
  );
  const linkJson = await linkRes.json();
  
  if (linkJson.result !== 0) {
    throw new Error(`Не удалось получить публичную ссылку: ${linkJson.result}`);
  }

  // Формируем прямую ссылку на скачивание
  const downloadUrl = `https://${cfg.hostname}/getlink?access_token=${cfg.accessToken}&fileid=${fileId}`;
  
  console.log(`[pCloud] Загрузка завершена: ${downloadUrl}`);
  return downloadUrl;
}

/**
 * Удаляет аудио из pCloud (best effort).
 */
export async function deletePCloudAudio(trackId: string): Promise<void> {
  try {
    console.log(`[pCloud] Удаление трека ${trackId}...`);
    const cfg = getPCloudCfg();
    if (!cfg) return;

    const folderId = await ensureFolder(cfg);

    // Ищем файл по имени
    const listRes = await fetch(
      `https://${cfg.hostname}/listfolder?access_token=${cfg.accessToken}&folderid=${folderId}`
    );
    const listJson = await listRes.json();
    
    if (listJson.result !== 0) {
      console.warn("[pCloud] Не удалось получить список файлов");
      return;
    }

    const file = listJson.metadata.contents?.find((f: any) => f.name === trackId);
    if (!file) {
      console.log("[pCloud] Файл не найден");
      return;
    }

    // Удаляем файл
    const delRes = await fetch(
      `https://${cfg.hostname}/deletefile?access_token=${cfg.accessToken}&fileid=${file.fileid}`
    );
    const delJson = await delRes.json();
    
    if (delJson.result !== 0) {
      console.warn(`[pCloud] Ошибка удаления: ${delJson.result}`);
    } else {
      console.log("[pCloud] Файл удалён");
    }
  } catch (e) {
    console.warn("[pCloud] Ошибка удаления:", e);
  }
}

/**
 * Проверка доступа до сохранения конфигурации.
 */
export async function testPCloud(accessToken: string, hostname: string): Promise<{ ok: boolean; error?: string; uid?: string }> {
  try {
    console.log("[pCloud] Проверка подключения...");
    
    const res = await fetch(
      `https://${hostname}/userinfo?access_token=${accessToken}`
    );
    const json = await res.json();
    
    if (json.result !== 0) {
      return { ok: false, error: `Неверный токен или хост (${json.result})` };
    }

    console.log("[pCloud] Подключение успешно");
    return { ok: true, uid: String(json.userid) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Не удалось подключиться к pCloud";
    console.error("[pCloud] Ошибка подключения:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Начинает OAuth 2.0 авторизацию в pCloud.
 */
export function startPCloudAuth(clientId: string, redirectUri: string): void {
  const authUrl = `https://my.pcloud.com/oauth2/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}`;
  window.open(authUrl, "_blank", "width=600,height=700");
}

/**
 * Извлекает access_token из URL после OAuth 2.0 авторизации.
 */
export function extractPCloudTokenFromUrl(): PCloudCfg | null {
  const hash = window.location.hash;
  if (!hash || !hash.includes("access_token=")) return null;

  const params = new URLSearchParams(hash.slice(1));
  const accessToken = params.get("access_token");
  const hostname = params.get("hostname") || "api.pcloud.com";
  const uid = params.get("uid");

  if (!accessToken || !uid) return null;

  // Очищаем hash из URL
  window.history.replaceState(null, "", window.location.pathname + window.location.search);

  return { accessToken, hostname, uid };
}
