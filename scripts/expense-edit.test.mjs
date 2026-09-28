import assert from "node:assert/strict";
import test from "node:test";

function formatMoney(cents) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function isShareSnapshot(value) {
  if (!value || typeof value !== "object") return false;
  return (
    typeof value.memberId === "string" &&
    value.memberId.length > 0 &&
    (value.cents === null || (typeof value.cents === "number" && Number.isInteger(value.cents)))
  );
}

function asShareSnapshots(value) {
  if (Array.isArray(value)) return value.filter(isShareSnapshot);
  if (isShareSnapshot(value)) return [value];
  if (value && typeof value === "object") {
    return Object.values(value).filter(isShareSnapshot);
  }
  return [];
}

function formatShareSnapshot(shares, nameOf) {
  if (typeof shares === "string") {
    const text = shares.trim();
    return text || "无人分摊";
  }
  const rows = asShareSnapshots(shares);
  if (rows.length === 0) return "无人分摊";
  const equal = rows.every((share) => share.cents == null);
  if (equal) {
    return `${rows.map((share) => nameOf(share.memberId)).join("、")}（平均）`;
  }
  return rows
    .map((share) => `${nameOf(share.memberId)} ${formatMoney(share.cents ?? 0)}`)
    .join("、");
}

function formatExpenseChange(change, nameOf) {
  if (change.field === "shares") {
    return {
      label: "分摊",
      before: formatShareSnapshot(change.before, nameOf),
      after: formatShareSnapshot(change.after, nameOf),
    };
  }
  return {
    label: "改动",
    before: change.before == null ? "—" : String(change.before),
    after: change.after == null ? "—" : String(change.after),
  };
}

function asChangeItems(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && "field" in raw) return [raw];
  return [];
}

function parseExpenseChanges(raw) {
  const changes = [];
  for (const item of asChangeItems(raw)) {
    if (!item || item.field !== "shares") continue;
    const before = asShareSnapshots(item.before);
    const after = asShareSnapshots(item.after);
    if (
      Array.isArray(item.before) ||
      Array.isArray(item.after) ||
      isShareSnapshot(item.before) ||
      isShareSnapshot(item.after) ||
      before.length > 0 ||
      after.length > 0
    ) {
      changes.push({ field: "shares", before, after });
    }
  }
  return changes;
}

const nameOf = (id) => ({ yeah: "yeah", xinxin: "欣欣" })[id] ?? id;

test("equal AA share snapshots stay a readable list", () => {
  assert.equal(
    formatShareSnapshot(
      [
        { memberId: "yeah", cents: null },
        { memberId: "xinxin", cents: null },
      ],
      nameOf,
    ),
    "yeah、欣欣（平均）",
  );
});

test("a keyed share map does not throw when opening 全部", () => {
  assert.doesNotThrow(() =>
    formatShareSnapshot(
      {
        yeah: { memberId: "yeah", cents: null },
        xinxin: { memberId: "xinxin", cents: null },
      },
      nameOf,
    ),
  );
  const text = formatShareSnapshot(
    {
      yeah: { memberId: "yeah", cents: null },
      xinxin: { memberId: "xinxin", cents: null },
    },
    nameOf,
  );
  assert.match(text, /平均/);
});

test("a single share object, a label, or missing data still formats", () => {
  assert.equal(formatShareSnapshot({ memberId: "yeah", cents: 5800 }, nameOf), "yeah ¥58.00");
  assert.equal(formatShareSnapshot("yeah、欣欣（平均）", nameOf), "yeah、欣欣（平均）");
  assert.equal(formatShareSnapshot(undefined, nameOf), "无人分摊");
  assert.equal(formatShareSnapshot(null, nameOf), "无人分摊");
});

test("formatExpenseChange does not assume every change is a share array", () => {
  const shares = formatExpenseChange(
    {
      field: "shares",
      before: { yeah: { memberId: "yeah", cents: null } },
      after: { yeah: { memberId: "yeah", cents: 1000 } },
    },
    nameOf,
  );
  assert.equal(shares.label, "分摊");
  assert.match(shares.before, /平均/);
  assert.match(shares.after, /¥10.00/);

  const unknown = formatExpenseChange({ field: "currency", before: "CNY", after: "AUD" }, nameOf);
  assert.equal(unknown.label, "改动");
  assert.equal(unknown.before, "CNY");
});

test("parseExpenseChanges accepts a single object or a keyed share map", () => {
  const one = parseExpenseChanges({
    field: "shares",
    before: { memberId: "yeah", cents: null },
    after: [{ memberId: "yeah", cents: 1000 }],
  });
  assert.equal(one[0]?.before[0]?.cents, null);
  assert.equal(one[0]?.after[0]?.cents, 1000);

  const mapped = parseExpenseChanges([
    {
      field: "shares",
      before: { yeah: { memberId: "yeah", cents: null } },
      after: { yeah: { memberId: "yeah", cents: 2000 } },
    },
  ]);
  assert.equal(mapped[0]?.after[0]?.cents, 2000);
});
