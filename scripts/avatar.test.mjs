import assert from "node:assert/strict";
import test from "node:test";

const AVATAR_USER_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

test("avatar user ids reject path traversal", () => {
  assert.equal(AVATAR_USER_ID_RE.test("abc_12-Z"), true);
  assert.equal(AVATAR_USER_ID_RE.test("../etc/passwd"), false);
  assert.equal(AVATAR_USER_ID_RE.test("a/b"), false);
  assert.equal(AVATAR_USER_ID_RE.test(""), false);
});
