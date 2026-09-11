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
import { deleteFromPCloud, getPCloudConfig, uploadToPCloud } from "./pcloud";

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
  if (getPCloudConfig()) return "pcloud";
  if (getMegaCfg()) return "mega";
  if (getR2Cfg()) return "r2";
  if (getGhCfg()) return "github";
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
  // pCloud → MEGA → R2 → GitHub Releases → общее облако данных Supabase → Supabase Storage → локально.
  // Локальная копия в IndexedDB сохранена всегда — трек не пропадёт в любом случае.
  let error: string | undefined;
  if (getPCloudConfig()) {
    try {
      return { url: await uploadToPCloud(trackId, file), shared: true, backend: "pcloud" };
    } catch (e) {
      error = `pCloud: ${e instanceof Error ? e.message : "ошибка загрузки"}`;
    }
  }
  if (getMegaCfg()) {
    try {
      return { url: await uploadMegaAudio(trackId, file), shared: true, backend: "mega" };
    } catch (e) {
      error = `MEGA: ${e instanceof Error ? e.message : "ошибка загрузки"}`;
    }
  }
  if (getR2Cfg()) {
    try {
      return { url: await uploadR2Audio(trackId, file), shared: true, backend: "r2" };
    } catch (e) {
      error = `R2: ${e instanceof Error ? e.message : "ошибка загрузки"}`;
    }
  }
  if (getGhCfg()) {
    try {
      return { url: await uploadGitHubAudio(trackId, file), shared: true, backend: "github" };
    } catch (e) {
      error = `GitHub: ${e instanceof Error ? e.message : "ошибка загрузки"}`;
    }
  }
  if (getSyncMode() === "cloud") {
    // Общее облако данных: работает без бакетов и токенов — раз данные синхронизируются,
    // то и аудио теперь будет доступно на всех устройствах.
    try {
      if (await uploadStateAudio(trackId, file)) return { url: null, shared: true, backend: "state" };
      error = "общее облако Supabase не приняло аудиофайл";
    } catch (e) {
      error = `общее облако: ${e instanceof Error ? e.message : "ошибка загрузки"}`;
    }
    try {
      const url = await uploadCloudAudio(trackId, file);
      if (url) return { url, shared: true, backend: "supabase" };
    } catch {
      /* бакет Storage может отсутствовать — общее облако выше уже попробовано */
    }
  }
  return { url: null, shared: false, backend: "local", error };
}

/** Удаляет облачное аудио трека из того бэкенда, где оно лежит. */
export async function deleteRemoteAudio(trackId: string, audioUrl?: string): Promise<void> {
  const u = audioUrl ?? "";
  if (u.includes("pcloud.com") || u.includes("pcloud.link")) {
    await deleteFromPCloud(trackId);
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
  await deleteMegaAudio(trackId);
  await deleteR2Audio(trackId);
  await deleteGitHubAudio(trackId, undefined);
  await deleteCloudAudio(trackId);
  await deleteStateAudio(trackId);
}
