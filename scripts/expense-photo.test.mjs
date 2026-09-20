import assert from "node:assert/strict";
import test from "node:test";

const PHOTO_ID_RE = /^[A-Za-z0-9_-]{8,80}$/;
const MAX_EXPENSE_PHOTOS = 9;

function isExpensePhotoId(value) {
  return PHOTO_ID_RE.test(value);
}

function safePhotoUrl(url) {
  if (
    url.startsWith("data:image/jpeg;base64,") ||
    url.startsWith("data:image/jpg;base64,")
  ) {
    return url;
  }
  if (/^\/api\/expense-photo\/[A-Za-z0-9_-]{8,80}(\?v=[A-Za-z0-9._-]+)?$/.test(url)) {
    return url;
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
