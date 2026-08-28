/*
 * Облачное хранилище аудио TimurSounds.
 *
 * Приоритет: Cloudflare R2 (быстрый CDN, нулевой egress) → Supabase Storage → локально.
 * R2 подключается из админки без пересборки: нужны URL воркера (пресайн)
 * и публичный URL бакета. Загрузка идёт через пресайн-PUT, секреты в браузер не попадают.
 */

import { deleteCloudAudio, getSyncMode, uploadCloudAudio } from "./sync";

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

export type AudioBackend = "r2" | "supabase" | "local";

export function audioBackend(): AudioBackend {
  if (getR2Cfg()) return "r2";
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
export async function uploadRemoteAudio(trackId: string, file: File): Promise<{ url: string | null; backend: AudioBackend }> {
  const backend = audioBackend();
  if (backend === "r2") {
    try {
      return { url: await uploadR2Audio(trackId, file), backend };
    } catch {
      /* пробуем запасной вариант ниже */
    }
  }
  if (backend !== "local") {
    try {
      const url = await uploadCloudAudio(trackId, file);
      if (url) return { url, backend: "supabase" };
    } catch {
      /* локальная копия уже сохранена — трек не пропадёт */
    }
  }
  return { url: null, backend: "local" };
}

/** Удаляет облачное аудио трека из того бэкенда, где оно лежит. */
export async function deleteRemoteAudio(trackId: string, audioUrl?: string): Promise<void> {
  if (audioUrl && getR2Cfg() && audioUrl.startsWith(getR2Cfg()!.publicBase)) {
    await deleteR2Audio(trackId);
    return;
  }
  if (audioUrl && audioUrl.includes("supabase")) {
    await deleteCloudAudio(trackId);
    return;
  }
  // конфигурация могла смениться — чистим оба хранилища
  await deleteR2Audio(trackId);
  await deleteCloudAudio(trackId);
}
