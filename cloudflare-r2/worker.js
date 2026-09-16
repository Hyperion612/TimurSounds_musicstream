/**
 * TimurSounds · R2 presign worker
 * --------------------------------
 * Выдаёт браузеру пресайн-URL (AWS SigV4) для загрузки/удаления аудио
 * в Cloudflare R2, не раскрывая секретные ключи.
 *
 * Деплой:
 *   cd cloudflare-r2
 *   wrangler deploy
 *   wrangler secret put R2_ACCESS_KEY_ID      (R2 → Manage R2 API Tokens)
 *   wrangler secret put R2_SECRET_ACCESS_KEY
 *
 * Переменные окружения (wrangler.toml → [vars]):
 *   ACCOUNT_ID   — ID аккаунта Cloudflare
 *   BUCKET       — имя бакета (например, ts-audio)
 *   PUBLIC_BASE  — публичный URL бакета (https://pub-xxxx.r2.dev или свой домен)
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });

/* ---------- AWS SigV4 (Web Crypto, без зависимостей) ---------- */
const enc = new TextEncoder();

const toHex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

const hmac = async (key, msg) => {
  const k = await crypto.subtle.importKey("raw", typeof key === "string" ? enc.encode(key) : key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, enc.encode(msg));
};

const sha256Hex = (msg) => crypto.subtle.digest("SHA-256", enc.encode(msg)).then(toHex);

const uriEnc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

async function presign({ method, host, path, expires = 900, env }) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dateStamp = amzDate.slice(0, 8);
  const region = "auto";
  const credential = `${env.R2_ACCESS_KEY_ID}/${dateStamp}/${region}/s3/aws4_request`;
  const params = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": "host",
  };
  const canonicalQuery = Object.keys(params)
    .sort()
    .map((k) => `${uriEnc(k)}=${uriEnc(params[k])}`)
    .join("&");
  const canonicalRequest = [method, path, canonicalQuery, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256Hex(canonicalRequest)].join("\n");
  let key = await hmac(`AWS4${env.R2_SECRET_ACCESS_KEY}`, dateStamp);
  key = await hmac(key, region);
  key = await hmac(key, "s3");
  key = await hmac(key, "aws4_request");
  const signature = toHex(await hmac(key, stringToSign));
  return `https://${host}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/* ---------- обработчик ---------- */
const NAME_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    try {
      if (url.pathname === "/health") {
        return json({ ok: true, bucket: env.BUCKET, publicBase: env.PUBLIC_BASE });
      }

      if (url.pathname === "/sign-put" || url.pathname === "/sign-delete") {
        const name = url.searchParams.get("name") || "";
        if (!NAME_RE.test(name)) return json({ error: "bad name" }, 400);
        if (!env.ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.BUCKET) {
          return json({ error: "worker is not configured: set ACCOUNT_ID, BUCKET and secrets" }, 500);
        }
        const host = `${env.ACCOUNT_ID}.r2.cloudflarestorage.com`;
        const path = `/${env.BUCKET}/${name}`;
        if (url.pathname === "/sign-put") {
          const uploadUrl = await presign({ method: "PUT", host, path, expires: 900, env });
          const publicUrl = `${String(env.PUBLIC_BASE).replace(/\/+$/, "")}/${name}`;
          return json({ uploadUrl, publicUrl, name });
        }
        const deleteUrl = await presign({ method: "DELETE", host, path, expires: 300, env });
        return json({ deleteUrl, name });
      }

      return json({ error: "not found" }, 404);
    } catch (e) {
      return json({ error: String((e && e.message) || e) }, 500);
    }
  },
};
