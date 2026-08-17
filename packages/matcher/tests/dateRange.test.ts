import { describe, it, expect } from "vitest";
import { matchMfgDate } from "../src/rules/dateRange.js";

describe("matchMfgDate", () => {
  it("matches date inside range", () => {
    const r = matchMfgDate("2024-02-15", "range", {
      min: "2024-01-01",
      max: "2024-03-31",
    });
    expect(r.passed).toBe(true);
  });

  it("matches date at range boundary", () => {
    const r = matchMfgDate("2024-01-01", "range", {
      min: "2024-01-01",
      max: "2024-03-31",
    });
    expect(r.passed).toBe(true);
  });

  it("rejects date before range", () => {
    const r = matchMfgDate("2023-12-31", "range", {
      min: "2024-01-01",
      max: "2024-03-31",
    });
    expect(r.passed).toBe(false);
  });

  it("rejects date after range", () => {
    const r = matchMfgDate("2024-04-01", "range", {
      min: "2024-01-01",
      max: "2024-03-31",
    });
    expect(r.passed).toBe(false);
  });

  it("matches on exact date eq", () => {
    const r = matchMfgDate("2024-02-15", "eq", "2024-02-15");
    expect(r.passed).toBe(true);
  });

  it("is unevaluated when product mfg date missing", () => {
    const r = matchMfgDate(undefined, "range", {
      min: "2024-01-01",
      max: "2024-03-31",
    });
    expect(r.evaluated).toBe(false);
  });

  it("is unevaluated when date is malformed", () => {
    const r = matchMfgDate("Feb 15 2024", "range", {
      min: "2024-01-01",
      max: "2024-03-31",
    });
    expect(r.evaluated).toBe(false);
  });

  it("flags malformed range as unevaluated", () => {
    const r = matchMfgDate("2024-02-15", "range", {
      min: "junk",
      max: "more junk",
    });
    expect(r.evaluated).toBe(false);
  });
});