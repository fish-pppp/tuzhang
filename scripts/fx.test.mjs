import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_FX_FEE_RATE,
  actualFxRate,
  formatCurrencyAmount,
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
