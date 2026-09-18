import assert from "node:assert/strict";
import test from "node:test";

function normalizeDeleteReason(raw) {
  const text = raw.trim().replace(/\s+/g, " ");
  if (text.length < 2) {
    throw new Error("请写清楚删除原因，至少 2 个字");
  }
  if (text.length > 80) {
    throw new Error("删除原因请控制在 80 字以内");
  }
  return text;
}

test("delete reason rejects empty and keeps a readable line", () => {
  assert.throws(() => normalizeDeleteReason("  "), /至少 2/);
  assert.throws(() => normalizeDeleteReason("啊"), /至少 2/);
  assert.equal(normalizeDeleteReason("  记错了  "), "记错了");
  assert.equal(normalizeDeleteReason("重复\n记账"), "重复 记账");
});
