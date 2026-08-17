import { describe, it, expect } from "vitest";
import { matchBrand } from "../src/rules/brand.js";

describe("matchBrand", () => {
  it("passes on exact normalized match", () => {
    const r = matchBrand("Acme Corp", "ACME CORP");
    expect(r.passed).toBe(true);
    expect(r.evaluated).toBe(true);
    expect(r.score).toBe(1);
  });

  it("passes on case-insensitive match after punctuation stripping", () => {
    const r = matchBrand("Acme-Corp", "acme corp");
    expect(r.passed).toBe(true);
  });

  it("passes on fuzzy match for minor OCR error", () => {
    const r = matchBrand("Acne Corp", "Acme Corp"); // 'm' → 'n'
    expect(r.passed).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(0.85);
  });

  it("fails on clearly different brand", () => {
    const r = matchBrand("Acme Corp", "Globex Industries");
    expect(r.passed).toBe(false);
    expect(r.evaluated).toBe(true);
  });

  it("is unevaluated when product brand is missing", () => {
    const r = matchBrand(undefined, "Acme Corp");
    expect(r.evaluated).toBe(false);
    expect(r.passed).toBe(false);
  });

  it("is unevaluated when recall has no brand value", () => {
    const r = matchBrand("Acme Corp", "");
    expect(r.evaluated).toBe(false);
  });
});