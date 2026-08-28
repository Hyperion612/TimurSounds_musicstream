/*
 * Хранилище аудио в GitHub Releases.
 *
 * Загрузка идёт через GitHub REST API с fine-grained PAT
 * (права: Contents — read & write на один репозиторий).
 * Скачивание — публичные URL вида
 * https://github.com/{owner}/{repo}/releases/download/{tag}/{name}
 * (раздача через CDN GitHub, токен не нужен).
 */

export interface GhCfg {
  owner: string;
  repo: string;
  token: string;
  tag: string;
}

const LS_GH = "timursounds_gh_cfg";

export function getGhCfg(): GhCfg | null {
  try {
    const raw = localStorage.getItem(LS_GH);
    if (raw) {
      const c = JSON.parse(raw) as GhCfg;
      if (c && c.owner && c.repo && c.token && c.tag) {
        return { ...c, owner: c.owner.trim(), repo: c.repo.trim(), tag: c.tag.trim() };
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function setGhCfg(cfg: GhCfg) {
  localStorage.setItem(LS_GH, JSON.stringify(cfg));
}

export function clearGhCfg() {
  localStorage.removeItem(LS_GH);
}

const headers = (token: string, contentType?: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(contentType ? { "Content-Type": contentType } : {}),
});

interface GhAsset {
  id: number;
  name: string;
}
interface GhRelease {
  id: number;
  assets: GhAsset[];
}

async function getReleaseByTag(cfg: GhCfg): Promise<GhRelease | null> {
  const res = await fetch(
    `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/releases/tags/${encodeURIComponent(cfg.tag)}`,
    { headers: headers(cfg.token) }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API: ${res.status}`);
  return (await res.json()) as GhRelease;
}

async function ensureRelease(cfg: GhCfg): Promise<GhRelease> {
  const existing = await getReleaseByTag(cfg);
  if (existing) return existing;
  const res = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}/releases`, {
    method: "POST",
    headers: headers(cfg.token, "application/json"),
    body: JSON.stringify({
      tag_name: cfg.tag,
      name: "Хранилище аудио TimurSounds",
      body: "Аудиофайлы треков площадки. Управляется автоматически — не удаляйте ассеты вручную.",
      draft: false,
      prerelease: false,
    }),
  });
  if (!res.ok) throw new Error(`не удалось создать release: ${res.status}`);
  return (await res.json()) as GhRelease;
}

function assetName(trackId: string, file: File): string {
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : ".mp3";
  return `${trackId}${ext}`;
}

export function downloadUrl(cfg: GhCfg, name: string): string {
  return `https://github.com/${cfg.owner}/${cfg.repo}/releases/download/${cfg.tag}/${encodeURIComponent(name)}`;
}

/** Загружает аудио как ассет релиза и возвращает публичный URL. */
export async function uploadGitHubAudio(trackId: string, file: File): Promise<string> {
  const cfg = getGhCfg();
  if (!cfg) throw new Error("GitHub не настроен");
  const name = assetName(trackId, file);
  const release = await ensureRelease(cfg);

  // GitHub не умеет перезаписывать ассеты — удаляем старый с тем же именем
  const old = release.assets.find((a) => a.name === name);
  if (old) {
    await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}/releases/assets/${old.id}`, {
      method: "DELETE",
      headers: headers(cfg.token),
    });
  }

  const res = await fetch(
    `https://uploads.github.com/repos/${cfg.owner}/${cfg.repo}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`,
    { method: "POST", headers: headers(cfg.token, file.type || "application/octet-stream"), body: file }
  );
  if (!res.ok) throw new Error(`GitHub отклонил загрузку файла (${res.status})`);
  return downloadUrl(cfg, name);
}

/** Удаляет ассет трека из релиза (best effort). */
export async function deleteGitHubAudio(trackId: string, audioUrl?: string): Promise<void> {
  const cfg = getGhCfg();
  if (!cfg) return;
  try {
    const release = await getReleaseByTag(cfg);
    if (!release) return;
    let name: string | null = null;
    if (audioUrl) {
      try {
        name = decodeURIComponent(audioUrl.split("/").pop() ?? "");
      } catch {
        name = null;
      }
    }
    const targets = release.assets.filter((a) => (name ? a.name === name : a.name.startsWith(`${trackId}.`)));
    for (const a of targets) {
      await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}/releases/assets/${a.id}`, {
        method: "DELETE",
        headers: headers(cfg.token),
      });
    }
  } catch {
    /* ассет мог не загружаться */
  }
}

/** Проверка доступа до сохранения конфигурации. */
export async function testGitHub(owner: string, repo: string, token: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const o = owner.trim();
    const r = repo.trim();
    if (!o || !r || o.includes("/") || r.includes("/")) return { ok: false, error: "Проверьте владельца и репозиторий" };
    const res = await fetch(`https://api.github.com/repos/${o}/${r}`, { headers: headers(token.trim()) });
    if (res.status === 401) return { ok: false, error: "Токен недействителен (401)" };
    if (res.status === 403) return { ok: false, error: "Токену не хватает прав (403)" };
    if (res.status === 404) return { ok: false, error: "Репозиторий не найден или токен без доступа к нему (404)" };
    if (!res.ok) return { ok: false, error: `GitHub API: ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Не удалось связаться с GitHub" };
  }
}
