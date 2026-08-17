import { describe, it, expect } from "vitest";
import { matchLotCode } from "../src/rules/lotCode.js";

describe("matchLotCode", () => {
  describe("eq operator", () => {
    it("matches exact lot code", () => {
      const r = matchLotCode("A100", "eq", "A100");
      expect(r.passed).toBe(true);
    });

    it("matches normalized (case + punctuation)", () => {
      const r = matchLotCode("a-100", "eq", "A100");
      expect(r.passed).toBe(true);
    });

    it("fails on different code", () => {
      const r = matchLotCode("A100", "eq", "A200");
      expect(r.passed).toBe(false);
    });
  });

  describe("prefix operator", () => {
    it("matches code starting with prefix", () => {
      const r = matchLotCode("ABC-12345", "prefix", "ABC");
      expect(r.passed).toBe(true);
    });

    it("fails when prefix doesn't match", () => {
      const r = matchLotCode("XYZ-12345", "prefix", "ABC");
      expect(r.passed).toBe(false);
    });
  });

  describe("contains operator", () => {
    it("matches when code contains substring", () => {
      const r = matchLotCode("BATCH-XYZ-2024", "contains", "XYZ");
      expect(r.passed).toBe(true);
    });

    it("fails when substring is absent", () => {
      const r = matchLotCode("BATCH-2024", "contains", "XYZ");
      expect(r.passed).toBe(false);
    });
  });

  describe("range operator", () => {
    it("matches numeric in range", () => {
      const r = matchLotCode("A150", "range", { min: "A100", max: "A200" });
      expect(r.passed).toBe(true);
    });

    it("matches at range boundaries", () => {
      const r1 = matchLotCode("A100", "range", { min: "A100", max: "A200" });
      const r2 = matchLotCode("A200", "range", { min: "A100", max: "A200" });
      expect(r1.passed).toBe(true);
      expect(r2.passed).toBe(true);
    });

    it("rejects below range", () => {
      const r = matchLotCode("A050", "range", { min: "A100", max: "A200" });
      expect(r.passed).toBe(false);
    });

    it("rejects above range", () => {
      const r = matchLotCode("A999", "range", { min: "A100", max: "A200" });
      expect(r.passed).toBe(false);
    });

    it("handles plain numeric range", () => {
      const r = matchLotCode("12345", "range", { min: "10000", max: "20000" });
      expect(r.passed).toBe(true);
    });

    it("flags malformed range as unevaluated", () => {
      const r = matchLotCode("A100", "range", { min: 100, max: 200 });
      expect(r.evaluated).toBe(false);
    });
  });

  describe("missing data", () => {
    it("is unevaluated when product lot is missing", () => {
      const r = matchLotCode(undefined, "eq", "A100");
      expect(r.evaluated).toBe(false);
    });
  });
});