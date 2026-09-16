/* Обложки и метаданные: сжатие изображений + чтение ID3-тегов (название, артист, обложка APIC). */

export async function imageToCoverDataUrl(src: Blob | File, size = 512): Promise<string> {
  const url = URL.createObjectURL(src);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("bad image"));
      el.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - s) / 2;
    const sy = (img.naturalHeight - s) / 2;
    ctx.fillStyle = "#0a0c14";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface AudioMeta {
  title?: string;
  artist?: string;
  cover?: Blob;
}

function syncsafe(dv: DataView, off: number) {
  return (
    ((dv.getUint8(off) & 0x7f) << 21) |
    ((dv.getUint8(off + 1) & 0x7f) << 14) |
    ((dv.getUint8(off + 2) & 0x7f) << 7) |
    (dv.getUint8(off + 3) & 0x7f)
  );
}

function decodeText(body: Uint8Array): string | undefined {
  if (body.length < 2) return undefined;
  const enc = body[0];
  const rest = body.subarray(1);
  let out = "";
  try {
    if (enc === 1) out = new TextDecoder("utf-16").decode(rest);
    else if (enc === 2) out = new TextDecoder("utf-16be").decode(rest);
    else if (enc === 3) out = new TextDecoder("utf-8").decode(rest);
    else {
      // encoding 0: формально latin1, но русские теги часто в cp1251 — пробуем utf-8, затем cp1251
      try {
        out = new TextDecoder("utf-8", { fatal: true }).decode(rest);
      } catch {
        try {
          out = new TextDecoder("windows-1251").decode(rest);
        } catch {
          out = Array.from(rest).map((c) => String.fromCharCode(c)).join("");
        }
      }
    }
  } catch {
    return undefined;
  }
  out = out.replace(/\0+$/g, "").trim();
  return out || undefined;
}

function parseApic(body: Uint8Array): Blob | undefined {
  if (body.length < 4) return undefined;
  const enc = body[0];
  let i = 1;
  let mime = "";
  while (i < body.length && body[i] !== 0) {
    mime += String.fromCharCode(body[i]);
    i++;
  }
  i++; // нулевой терминатор mime
  i++; // тип изображения
  if (enc === 1 || enc === 2) {
    // utf-16: описание заканчивается двойным нулём по чётной границе
    while (i + 1 < body.length && !(body[i] === 0 && body[i + 1] === 0)) i += 2;
    i += 2;
  } else {
    while (i < body.length && body[i] !== 0) i++;
    i++;
  }
  const img = body.subarray(i);
  if (img.length < 64) return undefined;
  return new Blob([img as unknown as ArrayBuffer], { type: mime || "image/jpeg" });
}

export async function readAudioMeta(file: File): Promise<AudioMeta> {
  const meta: AudioMeta = {};
  try {
    const buf = await file.slice(0, Math.min(file.size, 1536 * 1024)).arrayBuffer();
    const u8 = new Uint8Array(buf);
    const dv = new DataView(buf);
    if (u8.length < 10 || u8[0] !== 0x49 || u8[1] !== 0x44 || u8[2] !== 0x33) return meta;
    const ver = u8[3];
    if (ver < 3) return meta;
    const flags = u8[5];
    const tagSize = syncsafe(dv, 6);
    let pos = 10;
    if (flags & 0x40) {
      pos += ver >= 4 ? syncsafe(dv, 10) : dv.getUint32(10) + 4;
    }
    const end = Math.min(10 + tagSize, u8.length);
    while (pos + 10 <= end) {
      const id = String.fromCharCode(u8[pos], u8[pos + 1], u8[pos + 2], u8[pos + 3]);
      if (!/^[A-Z0-9]{4}$/.test(id)) break;
      const size = ver >= 4 ? syncsafe(dv, pos + 4) : dv.getUint32(pos + 4);
      if (size <= 0 || pos + 10 + size > end) break;
      const body = u8.subarray(pos + 10, pos + 10 + size);
      try {
        if (id === "APIC" && !meta.cover) meta.cover = parseApic(body);
        if (id === "TIT2" && !meta.title) meta.title = decodeText(body);
        if (id === "TPE1" && !meta.artist) meta.artist = decodeText(body);
      } catch {
        /* повреждённый фрейм — пропускаем */
      }
      pos += 10 + size;
    }
  } catch {
    /* не ID3 или нет доступа */
  }
  return meta;
}
