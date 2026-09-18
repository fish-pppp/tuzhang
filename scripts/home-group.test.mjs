import assert from "node:assert/strict";
import test from "node:test";

const DEFAULT_HOME_GROUP_NAME = "我的账本";

function homeGroupName(displayName) {
  const name = displayName?.trim().replace(/\s+/g, " ") ?? "";
  if (!name) return DEFAULT_HOME_GROUP_NAME;
  return `${name.slice(0, 20)}的账本`;
}

function pickHomeGroup(groups, userId) {
  return groups.find((g) => g.createdBy === userId);
}

test("home group name uses the person's name", () => {
  assert.equal(homeGroupName(null), "我的账本");
  assert.equal(homeGroupName("  "), "我的账本");
  assert.equal(homeGroupName("小明"), "小明的账本");
  assert.equal(homeGroupName("  途 友  "), "途 友的账本");
  assert.equal(homeGroupName("a".repeat(25)), `${"a".repeat(20)}的账本`);
});

test("home group is the newest one the user created, not one they only joined", () => {
  const groups = [
    { id: "joined", createdBy: "other" },
    { id: "mine-new", createdBy: "me" },
    { id: "mine-old", createdBy: "me" },
  ];
  assert.equal(pickHomeGroup(groups, "me")?.id, "mine-new");
  assert.equal(pickHomeGroup(groups, "nobody"), undefined);
});
