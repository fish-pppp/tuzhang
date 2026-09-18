/** Public URL stored on the Better Auth user + group_members.avatar_url. */
export function avatarPublicUrl(userId: string, version: string | number): string {
  return `/api/avatar/${encodeURIComponent(userId)}?v=${version}`;
}

export const AVATAR_USER_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

export function isAvatarUserId(value: string): boolean {
  return AVATAR_USER_ID_RE.test(value);
}

const JPEG_MAX_BASE64 = 80_000;
const JPEG_MAX_BYTES = 60_000;

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
export function decodeJpegBase64(base64: string): Uint8Array {
  if (base64.length < 80 || base64.length > JPEG_MAX_BASE64) {
    throw new Error("图片太大了，请换一张");
  }
  if (!/^[A-Za-z0-9+/]+=*$/.test(base64)) {
    throw new Error("请上传有效的图片");
  }
  const raw = bytesFromBase64(base64);
  if (raw.length < 24 || raw.length > JPEG_MAX_BYTES) {
    throw new Error("图片太大了，请换一张");
  }
  if (raw[0] !== 0xff || raw[1] !== 0xd8 || raw[2] !== 0xff) {
    throw new Error("请上传有效的图片");
  }
  return raw;
}

/**
 * Browser-only: center-crop to 256×256 JPEG. Keeps the payload small enough
 * for a server function and for the `user_avatars.data` text column.
 */
export async function compressAvatarFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("请选择一张图片");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("图片太大，请选 8MB 以内的");
  }
  const bitmap = await createImageBitmap(file);
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("这台设备没法处理图片，请换一张或换个浏览器");
  ctx.fillStyle = "#ece4d6";
  ctx.fillRect(0, 0, size, size);
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  const base64 = dataUrl.split(",")[1];
  if (!base64) throw new Error("处理图片失败，请再试一次");
  decodeJpegBase64(base64);
  return base64;
}
