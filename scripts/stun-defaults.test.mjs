import assert from "node:assert/strict";
import test from "node:test";

const DEFAULT_STUN = [
  "stun:stun.qq.com:3478",
  "stun:stun.miwifi.com:3478",
  "stun:stun.cloudflare.com:3478",
];

test("default STUN list does not depend on Google (blocked in CN)", () => {
  assert.equal(
    DEFAULT_STUN.some((url) => url.includes("google.com")),
    false,
  );
  assert.equal(
    DEFAULT_STUN.some((url) => url.includes("qq.com") || url.includes("miwifi.com")),
    true,
  );
});
