import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_FX_FEE_RATE,
  actualFxRate,
  allocateByWeights,
  formatCurrencyAmount,
  formatCurrencyInput,
  formatFeePercent,
  parseCurrencyAmount,
  parseFeePercent,
  toCnyCents,
} from "../src/lib/split/fx.mjs";

test("default bank fee is 0.5 percent", () => {
  assert.equal(DEFAULT_FX_FEE_RATE, "0.005");
  assert.equal(formatFeePercent(DEFAULT_FX_FEE_RATE), "0.5");
});

test("actual rate is mid times one plus the fee ratio", () => {
  assert.equal(actualFxRate("4.717529", "0.005"), "4.741116645");
  assert.equal(actualFxRate("0.000258", "0.005"), "0.00025929");
  assert.equal(actualFxRate("3.79", "0"), "3.79");
});

test("fee percent parses as a ratio and rejects out of range", () => {
  assert.equal(parseFeePercent("0.5"), "0.005");
  assert.equal(parseFeePercent("0.50%"), "0.005");
  assert.equal(parseFeePercent("0"), "0");
  assert.equal(parseFeePercent("10"), "0.1");
  assert.equal(parseFeePercent("1.25"), "0.0125");
  assert.equal(parseFeePercent("10.01"), null);
  assert.equal(parseFeePercent("-1"), null);
  assert.equal(parseFeePercent("0.555"), null);
});

test("AUD and NZD keep two decimals and VND stays an integer", () => {
  assert.equal(parseCurrencyAmount("80.50", "AUD"), 8050);
  assert.equal(parseCurrencyAmount("80.5", "NZD"), 8050);
  assert.equal(parseCurrencyAmount("80.555", "AUD"), null);
  assert.equal(parseCurrencyAmount("100000", "VND"), 100000);
  assert.equal(parseCurrencyAmount("100.5", "VND"), null);
  assert.equal(parseCurrencyAmount("₫1,000", "VND"), 1000);
  assert.equal(formatCurrencyAmount("AUD", 8050), "A$80.50");
  assert.equal(formatCurrencyAmount("VND", 100000), "₫100,000");
});

test("foreign amounts convert to CNY cents with half-up rounding", () => {
  assert.equal(toCnyCents(10000, "AUD", "4.741116645"), 47411);
  assert.equal(toCnyCents(1_000_000, "VND", "0.00025929"), 25929);
  assert.equal(toCnyCents(1, "AUD", "0.5"), 1);
});

test("zero is allowed only when custom shares ask for it", () => {
  assert.equal(parseCurrencyAmount("0", "AUD"), null);
  assert.equal(parseCurrencyAmount("0.00", "NZD", { allowZero: true }), 0);
  assert.equal(parseCurrencyAmount("0", "VND", { allowZero: true }), 0);
  assert.equal(parseCurrencyAmount("0.5", "VND", { allowZero: true }), null);
});

test("currency input text keeps the currency's precision", () => {
  assert.equal(formatCurrencyInput("AUD", 8050), "80.50");
  assert.equal(formatCurrencyInput("CNY", 100), "1.00");
  assert.equal(formatCurrencyInput("VND", 100000), "100000");
});

test("custom shares in another currency allocate CNY cents that still add up", () => {
  const total = toCnyCents(1000, "AUD", "4.741116645");
  assert.equal(total, 4741);
  const parts = allocateByWeights(total, [600, 400]);
  assert.deepEqual(parts, [2845, 1896]);
  assert.equal(
    parts.reduce((sum, cents) => sum + cents, 0),
    total,
  );
  assert.deepEqual(allocateByWeights(10, [1, 1, 1]), [4, 3, 3]);
  assert.deepEqual(allocateByWeights(3, [1, 1, 1]), [1, 1, 1]);
  assert.deepEqual(allocateByWeights(100, [0, 5]), [0, 100]);
});
