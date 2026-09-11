/*
 * Облачное хранилище аудио TimurSounds.
 *
 * Приоритет: Cloudflare R2 → GitHub Releases → Supabase Storage → локально.
 * Всё подключается из админки без пересборки сайта:
 *  · R2 — URL воркера (пресайн) + публичный URL бакета, секреты живут в воркере;
 *  · GitHub — владелец, репозиторий и fine-grained PAT (Contents: read & write),
 *    файлы попадают в релиз, раздача — публичные ссылки через CDN GitHub.
 */

import { deleteCloudAudio, deleteStateAudio, getSyncMode, uploadCloudAudio, uploadStateAudio } from "./sync";
import { deleteGitHubAudio, getGhCfg, uploadGitHubAudio } from "./github";
import { deleteMegaAudio, getMegaCfg, uploadMegaAudio } from "./mega";
import { deletePCloudAudio, getPCloudCfg, uploadPCloudAudio } from "./pcloud";

export interface R2Cfg {
  signUrl: string; // https://timursounds-r2-sign.….workers.dev
  publicBase: string; // https://pub-xxxx.r2.dev
}

const LS_R2 = "timursounds_r2_cfg";

export function getR2Cfg(): R2Cfg | null {
  try {
    const raw = localStorage.getItem(LS_R2);
    if (raw) {
      const c = JSON.parse(raw) as R2Cfg;
      if (c && c.signUrl && c.publicBase) return { signUrl: c.signUrl.replace(/\/+$/, ""), publicBase: c.publicBase.replace(/\/+$/, "") };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function setR2Cfg(cfg: R2Cfg) {
  localStorage.setItem(LS_R2, JSON.stringify(cfg));
}

export function clearR2Cfg() {
  localStorage.removeItem(LS_R2);
}

export type AudioBackend = "pcloud" | "r2" | "github" | "mega" | "state" | "supabase" | "local";

export function audioBackend(): AudioBackend {
  if (getGhCfg()) return "github";
  if (getR2Cfg()) return "r2";
  if (getPCloudCfg()) return "pcloud";
  if (getMegaCfg()) return "mega";
  if (getSyncMode() === "cloud") return "supabase";
  return "local";
}

async function sign(cfg: R2Cfg, kind: "sign-put" | "sign-delete", name: string) {
  const res = await fetch(`${cfg.signUrl}/${kind}?name=${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`воркер ответил ${res.status}`);
  return (await res.json()) as Record<string, string>;
}

/** Загружает аудио в R2, возвращает публичный URL. */
export async function uploadR2Audio(trackId: string, file: File): Promise<string> {
  const cfg = getR2Cfg();
  if (!cfg) throw new Error("R2 не настроен");
  const { uploadUrl, publicUrl } = await sign(cfg, "sign-put", trackId);
  if (!uploadUrl || !publicUrl) throw new Error("воркер не вернул URL");
  const res = await fetch(uploadUrl, { method: "PUT", body: file });
  if (!res.ok) throw new Error(`R2 отклонил загрузку (${res.status})`);
  return publicUrl;
}

/** Удаляет аудио из R2 (best effort). */
export async function deleteR2Audio(trackId: string): Promise<void> {
  const cfg = getR2Cfg();
  if (!cfg) return;
  try {
    const { deleteUrl } = await sign(cfg, "sign-delete", trackId);
    if (deleteUrl) await fetch(deleteUrl, { method: "DELETE" });
  } catch {
    /* файл мог не загружаться в R2 */
  }
}

/** Проверка воркера перед сохранением конфигурации. */
export async function testR2(signUrlRaw: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const signUrl = signUrlRaw.trim().replace(/\/+$/, "");
    const res = await fetch(`${signUrl}/health`);
    if (!res.ok) return { ok: false, error: `воркер ответил ${res.status}` };
    const j = (await res.json()) as { ok?: boolean; bucket?: string };
    if (!j.ok) return { ok: false, error: "воркер не подтвердил готовность" };
    return { ok: true, error: j.bucket };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "не удалось связаться с воркером (CORS/сеть)" };
  }
}

/* ---------- единый API для плеера/админки ---------- */

/**
 * Загружает аудиофайл в облако (R2 → Supabase Storage).
 * Возвращает публичный URL или null, если облако не подключено/ошиблось.
 */
export async function uploadRemoteAudio(
  trackId: string,
  file: File
): Promise<{ url: string | null; shared: boolean; backend: AudioBackend; error?: string }> {
  console.log(`[UPLOAD] Начало загрузки трека ${trackId}`);
  const startTime = Date.now();
  
  // GitHub Releases → R2 → pCloud → MEGA → Supabase Storage → локально.
  // Локальная копия в IndexedDB сохранена всегда — трек не пропадёт в любом случае.
  let error: string | undefined;
  
  // Приоритет 1: GitHub Releases (самое стабильное для аудио)
  if (getGhCfg()) {
    console.log("[UPLOAD] Попытка загрузки в GitHub...");
    try {
      const url = await uploadGitHubAudio(trackId, file);
      console.log(`[UPLOAD] ✓ GitHub загрузка успешна за ${Date.now() - startTime}ms`);
      return { url, shared: true, backend: "github" };
    } catch (e) {
      error = `GitHub: ${e instanceof Error ? e.message : "ошибка загрузки"}`;
      console.error(`[UPLOAD] ✗ GitHub ошибка за ${Date.now() - startTime}ms:`, error);
    }
  } else {
    console.log("[UPLOAD] GitHub не настроен, пропускаем");
  }
  
  // Приоритет 2: R2
  if (getR2Cfg()) {
    console.log("[UPLOAD] Попытка загрузки в R2...");
    try {
      const url = await uploadR2Audio(trackId, file);
      console.log(`[UPLOAD] ✓ R2 загрузка успешна за ${Date.now() - startTime}ms`);
      return { url, shared: true, backend: "r2" };
    } catch (e) {
      error = `R2: ${e instanceof Error ? e.message : "ошибка загрузки"}`;
      console.error(`[UPLOAD] ✗ R2 ошибка за ${Date.now() - startTime}ms:`, error);
    }
  } else {
    console.log("[UPLOAD] R2 не настроен, пропускаем");
  }
  
  // Приоритет 3: pCloud
  if (getPCloudCfg()) {
    console.log("[UPLOAD] Попытка загрузки в pCloud...");
    try {
      const url = await uploadPCloudAudio(trackId, file);
      console.log(`[UPLOAD] ✓ pCloud загрузка успешна за ${Date.now() - startTime}ms`);
      return { url, shared: true, backend: "pcloud" };
    } catch (e) {
      error = `pCloud: ${e instanceof Error ? e.message : "ошибка загрузки"}`;
      console.error(`[UPLOAD] ✗ pCloud ошибка за ${Date.now() - startTime}ms:`, error);
    }
  } else {
    console.log("[UPLOAD] pCloud не настроен, пропускаем");
  }
  
  // Приоритет 4: MEGA (может быть нестабилен)
  if (getMegaCfg()) {
    console.log("[UPLOAD] Попытка загрузки в MEGA...");
    try {
      const url = await uploadMegaAudio(trackId, file);
      console.log(`[UPLOAD] ✓ MEGA загрузка успешна за ${Date.now() - startTime}ms`);
      return { url, shared: true, backend: "mega" };
    } catch (e) {
      error = `MEGA: ${e instanceof Error ? e.message : "ошибка загрузки"}`;
      console.error(`[UPLOAD] ✗ MEGA ошибка за ${Date.now() - startTime}ms:`, error);
    }
  } else {
    console.log("[UPLOAD] MEGA не настроен, пропускаем");
  }
  
  // Fallback: Supabase Storage (если бакет настроен)
  if (getSyncMode() === "cloud") {
    console.log("[UPLOAD] Попытка загрузки в Supabase Storage...");
    try {
      const url = await uploadCloudAudio(trackId, file);
      if (url) {
        console.log(`[UPLOAD] ✓ Supabase Storage загрузка успешна за ${Date.now() - startTime}ms`);
        return { url, shared: true, backend: "supabase" };
      }
    } catch (e) {
      console.error(`[UPLOAD] ✗ Supabase Storage ошибка за ${Date.now() - startTime}ms:`, e);
    }
  }
  
  console.log(`[UPLOAD] ✗ Все облачные хранилища недоступны, используем локальное хранилище за ${Date.now() - startTime}ms`);
  return { url: null, shared: false, backend: "local", error };
}

/** Удаляет облачное аудио трека из того бэкенда, где оно лежит. */
export async function deleteRemoteAudio(trackId: string, audioUrl?: string): Promise<void> {
  const u = audioUrl ?? "";
  if (u.includes("pcloud.com") || u.includes("pcloud.link")) {
    await deletePCloudAudio(trackId);
    return;
  }
  if (u.includes("mega.nz") || u.includes("mega.io")) {
    await deleteMegaAudio(trackId);
    return;
  }
  if (u.includes("github.com") || u.includes("githubusercontent.com")) {
    await deleteGitHubAudio(trackId, audioUrl);
    return;
  }
  const r2 = getR2Cfg();
  if (r2 && u.startsWith(r2.publicBase)) {
    await deleteR2Audio(trackId);
    return;
  }
  if (u.includes("supabase")) {
    await deleteCloudAudio(trackId);
    return;
  }
  // конфигурация могла смениться — чистим все хранилища (best effort)
  await deletePCloudAudio(trackId);
  await deleteMegaAudio(trackId);
  await deleteR2Audio(trackId);
  await deleteGitHubAudio(trackId, undefined);
  await deleteCloudAudio(trackId);
  await deleteStateAudio(trackId);
}
