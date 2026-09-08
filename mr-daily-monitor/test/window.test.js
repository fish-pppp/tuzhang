import assert from "node:assert/strict";
import { test } from "node:test";
import { calendarDateInZone, isMergedInWindow, resolveWindow } from "../src/window.js";

test("calendarDateInZone uses Asia/Shanghai", () => {
  const utcMorning = new Date("2026-09-07T16:30:00.000Z");
  assert.equal(calendarDateInZone(utcMorning, "Asia/Shanghai"), "2026-09-08");
});

test("since yesterday covers the previous Shanghai day", () => {
  const now = new Date("2026-09-08T03:00:00.000Z");
  const window = resolveWindow({ since: "yesterday", timeZone: "Asia/Shanghai", now });
  assert.equal(window.date, "2026-09-07");
  assert.equal(window.start.toISOString(), "2026-09-06T16:00:00.000Z");
  assert.equal(window.end.toISOString(), "2026-09-07T16:00:00.000Z");
  assert.equal(isMergedInWindow({ merged_at: "2026-09-07T10:15:00+08:00" }, window.start, window.end), true);
  assert.equal(isMergedInWindow({ merged_at: "2026-09-06T10:00:00+08:00" }, window.start, window.end), false);
});

test("since today starts at local midnight and ends now", () => {
  const now = new Date("2026-09-08T03:00:00.000Z");
  const window = resolveWindow({ since: "today", timeZone: "Asia/Shanghai", now });
  assert.equal(window.date, "2026-09-08");
  assert.equal(window.start.toISOString(), "2026-09-07T16:00:00.000Z");
  assert.equal(window.end.toISOString(), now.toISOString());
});

test("since a calendar day is that local day", () => {
  const window = resolveWindow({ since: "2026-09-07", timeZone: "Asia/Shanghai" });
  assert.equal(window.start.toISOString(), "2026-09-06T16:00:00.000Z");
  assert.equal(window.end.toISOString(), "2026-09-07T16:00:00.000Z");
});

test("from/to override since", () => {
  const window = resolveWindow({
    from: "2026-09-07T00:00:00+08:00",
    to: "2026-09-08T00:00:00+08:00",
    timeZone: "Asia/Shanghai",
  });
  assert.equal(window.start.toISOString(), "2026-09-06T16:00:00.000Z");
  assert.equal(window.end.toISOString(), "2026-09-07T16:00:00.000Z");
});
