import assert from "node:assert/strict";
import test from "node:test";

const PHOTO_ID_RE = /^[A-Za-z0-9_-]{8,80}$/;
const MAX_EXPENSE_PHOTOS = 9;

function isExpensePhotoId(value) {
  return PHOTO_ID_RE.test(value);
}

function photoVersionToken(version) {
  if (version instanceof Date && !Number.isNaN(version.getTime())) {
    return String(version.getTime());
  }
  const raw = String(version).trim();
  if (!raw) return "1";
  if (/^[A-Za-z0-9._-]+$/.test(raw)) return raw;
  let normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  normalized = normalized.replace(/([+-]\d{2})$/, "$1:00");
  const ms = Date.parse(normalized);
  if (Number.isFinite(ms)) return String(ms);
  return raw.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "1";
}

function expensePhotoPublicUrl(photoId, version) {
  return `/api/expense-photo/${encodeURIComponent(photoId)}?v=${photoVersionToken(version)}`;
}

function safePhotoUrl(url) {
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

function normalizeExpensePhotos(photos) {
  if (!photos || photos.length === 0) return undefined;
  const out = [];
  const seen = new Set();
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

function expensePhotoLine(expense) {
  const photoCount = expense.photos?.length ?? 0;
  return photoCount > 0 ? `- 照片证明：${photoCount} 张` : null;
}

test("photo ids accept uuid and reject path traversal", () => {
  assert.equal(isExpensePhotoId("550e8400-e29b-41d4-a716-446655440000"), true);
  assert.equal(isExpensePhotoId("id_abcd1234"), true);
  assert.equal(isExpensePhotoId("../etc/passwd"), false);
  assert.equal(isExpensePhotoId("a/b"), false);
  assert.equal(isExpensePhotoId("short"), false);
});

test("safe photo urls only allow same-origin, demo avatars, or jpeg data", () => {
  assert.equal(
    safePhotoUrl("/api/expense-photo/550e8400-e29b-41d4-a716-446655440000?v=1"),
    "/api/expense-photo/550e8400-e29b-41d4-a716-446655440000?v=1",
  );
  assert.equal(safePhotoUrl("/avatars/bei.jpg"), "/avatars/bei.jpg");
  assert.equal(
    safePhotoUrl("data:image/jpeg;base64,/9j/xxxx"),
    "data:image/jpeg;base64,/9j/xxxx",
  );
  assert.equal(safePhotoUrl("javascript:alert(1)"), null);
  assert.equal(safePhotoUrl("https://evil.example/x.jpg"), null);
  assert.equal(safePhotoUrl("/api/expense-photo/../secret"), null);
});

test("postgres timestamptz cache tokens still render as photos", () => {
  const id = "550e8400-e29b-41d4-a716-446655440000";
  const pgText = expensePhotoPublicUrl(id, "2026-09-20 07:05:12.123456+00");
  const iso = expensePhotoPublicUrl(id, "2026-09-20T07:05:12.123Z");
  assert.match(pgText, /^\/api\/expense-photo\/550e8400-e29b-41d4-a716-446655440000\?v=\d+$/);
  assert.match(iso, /^\/api\/expense-photo\/550e8400-e29b-41d4-a716-446655440000\?v=\d+$/);
  assert.equal(safePhotoUrl(pgText), pgText);
  assert.equal(safePhotoUrl(`/api/expense-photo/${id}?v=2026-09-20 07:05:12.123456+00`), pgText);
  const normalized = normalizeExpensePhotos([
    { id, url: `/api/expense-photo/${id}?v=2026-09-20 07:05:12.123456+00` },
  ]);
  assert.equal(normalized?.length, 1);
  assert.equal(normalized?.[0]?.url, pgText);
});

test("normalize photos drops junk, duplicates, and caps at 9", () => {
  const photos = Array.from({ length: 12 }, (_, i) => ({
    id: `photo-id-${i}`,
    url: `/api/expense-photo/photo-id-${i}`,
  }));
  photos.push({ id: "photo-id-0", url: "/api/expense-photo/photo-id-0" });
  photos.push({ id: "bad", url: "https://evil.example/x.jpg" });
  const normalized = normalizeExpensePhotos(photos);
  assert.equal(normalized?.length, 9);
  assert.equal(normalized?.[0]?.id, "photo-id-0");
  assert.equal(normalizeExpensePhotos([]), undefined);
  assert.equal(normalizeExpensePhotos(undefined), undefined);
});

test("export mentions photo count only when photos exist", () => {
  assert.equal(expensePhotoLine({ photos: [{ id: "a" }, { id: "b" }] }), "- 照片证明：2 张");
  assert.equal(expensePhotoLine({}), null);
});
