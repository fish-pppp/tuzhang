import type { ExpensePhoto } from "./types";

export const MAX_EXPENSE_PHOTOS = 9;

/**
 * Cache-busting token that stays inside `safePhotoUrl`'s allowed charset.
 * `loadGroup` used to pass Postgres `timestamptz::text` (spaces, colons, `+00`),
 * which the allow-list dropped — so saved bills showed a photo count but no
 * images after you opened them.
 */
export function photoVersionToken(version: string | number | Date): string {
  if (version instanceof Date && !Number.isNaN(version.getTime())) {
    return String(version.getTime());
  }
  const raw = String(version).trim();
  if (!raw) return "1";
  if (/^[A-Za-z0-9._-]+$/.test(raw)) return raw;
  let normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  // Postgres `timestamptz::text` often uses `+00` instead of `+00:00`.
  normalized = normalized.replace(/([+-]\d{2})$/, "$1:00");
  const ms = Date.parse(normalized);
  if (Number.isFinite(ms)) return String(ms);
  return raw.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "1";
}

/** Public URL stored on the expense. Bytes live in `group_expense_photos`. */
export function expensePhotoPublicUrl(
  photoId: string,
  version: string | number | Date,
): string {
  return `/api/expense-photo/${encodeURIComponent(photoId)}?v=${photoVersionToken(version)}`;
}

export const PHOTO_ID_RE = /^[A-Za-z0-9_-]{8,80}$/;

export function isExpensePhotoId(value: string): boolean {
  return PHOTO_ID_RE.test(value);
}

export const PHOTO_MAX_BASE64 = 180_000;
export const PHOTO_MAX_BYTES = 135_000;

function bytesFromBase64(base64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return Uint8Array.from(Buffer.from(base64, "base64"));
  }
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/** Decode + check JPEG SOI. Throws a Chinese message on bad input. */
export function decodeExpenseJpeg(base64: string): Uint8Array {
  if (base64.length < 80 || base64.length > PHOTO_MAX_BASE64) {
    throw new Error("图片太大了，请换一张");
  }
  if (!/^[A-Za-z0-9+/]+=*$/.test(base64)) {
    throw new Error("请上传有效的图片");
  }
  const raw = bytesFromBase64(base64);
  if (raw.length < 24 || raw.length > PHOTO_MAX_BYTES) {
    throw new Error("图片太大了，请换一张");
  }
  if (raw[0] !== 0xff || raw[1] !== 0xd8 || raw[2] !== 0xff) {
    throw new Error("请上传有效的图片");
  }
  return raw;
}

/**
 * Only allow same-origin photo paths, demo avatars, or compressed JPEG data
 * URLs. Anything else (javascript:, remote http) is dropped before <img src>.
 */
export function safePhotoUrl(url: string): string | null {
  if (
    url.startsWith("data:image/jpeg;base64,") ||
    url.startsWith("data:image/jpg;base64,")
  ) {
    return url;
  }
  const photoMatch = /^\/api\/expense-photo\/([A-Za-z0-9_-]{8,80})(\?.*)?$/.exec(
    url,
  );
  if (photoMatch) {
    const id = photoMatch[1];
    const query = photoMatch[2] ?? "";
    const versionPair = query.startsWith("?")
      ? query.slice(1).split("&").find((part) => part.startsWith("v="))
      : undefined;
    if (!versionPair) return `/api/expense-photo/${id}`;
    try {
      return expensePhotoPublicUrl(id, decodeURIComponent(versionPair.slice(2)));
    } catch {
      return `/api/expense-photo/${id}`;
    }
  }
  if (/^\/avatars\/[A-Za-z0-9._-]+$/.test(url)) {
    return url;
  }
  return null;
}

export function normalizeExpensePhotos(
  photos: ExpensePhoto[] | undefined | null,
): ExpensePhoto[] | undefined {
  if (!photos || photos.length === 0) return undefined;
  const out: ExpensePhoto[] = [];
  const seen = new Set<string>();
  for (const photo of photos) {
    if (!photo || !isExpensePhotoId(photo.id) || seen.has(photo.id)) continue;
    const url = safePhotoUrl(photo.url);
    if (!url) continue;
    seen.add(photo.id);
    out.push({ id: photo.id, url });
    if (out.length >= MAX_EXPENSE_PHOTOS) break;
  }
  return out.length > 0 ? out : undefined;
}

/**
 * Browser-only: shrink to a readable receipt JPEG. Keeps aspect ratio and
 * retries at smaller sizes / qualities so the payload fits a server function
 * and the `group_expense_photos.data` text column.
 */
export async function compressExpensePhoto(file: File): Promise<string> {
  if (file.type && !file.type.startsWith("image/")) {
    throw new Error("请选择一张图片");
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error("图片太大，请选 12MB 以内的");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("请上传有效的图片");
  }
  try {
    const sides = [1280, 960, 720];
    const qualities = [0.78, 0.68, 0.58, 0.48];
    for (const maxSide of sides) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("这台设备没法处理图片，请换一张或换个浏览器");
      ctx.fillStyle = "#fffdf8";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);
      for (const quality of qualities) {
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const base64 = dataUrl.split(",")[1];
        if (!base64) continue;
        if (base64.length > PHOTO_MAX_BASE64) continue;
        decodeExpenseJpeg(base64);
        return base64;
      }
    }
    throw new Error("图片太大了，请换一张");
  } finally {
    bitmap.close();
  }
}
