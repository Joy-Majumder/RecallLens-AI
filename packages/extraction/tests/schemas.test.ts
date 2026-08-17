import { describe, it, expect } from "vitest";
import {
  ProductPhotoExtractionSchema,
  RecallNoticeExtractionSchema,
} from "../src/schemas.js";

describe("ProductPhotoExtractionSchema", () => {
  it("accepts a well-formed extraction", () => {
    const r = ProductPhotoExtractionSchema.parse({
      photo_type: "full_product",
      brand: "Acme",
      product_name: "Infant Formula",
      lot_code: "A100",
      mfg_date: "2024-01-15",
      product_confidence: 0.9,
      lot_confidence: 0.8,
    });
    expect(r.brand).toBe("Acme");
  });

  it("rejects invalid photo_type", () => {
    expect(() =>
      ProductPhotoExtractionSchema.parse({
        photo_type: "side_only",
        product_confidence: 0.5,
        lot_confidence: 0.5,
      })
    ).toThrow();
  });

  it("rejects confidence out of range", () => {
    expect(() =>
      ProductPhotoExtractionSchema.parse({
        photo_type: "full_product",
        product_confidence: 1.5,
        lot_confidence: 0.5,
      })
    ).toThrow();
  });

  it("rejects malformed date", () => {
    expect(() =>
      ProductPhotoExtractionSchema.parse({
        photo_type: "full_product",
        mfg_date: "Jan 2024",
        product_confidence: 0.5,
        lot_confidence: 0.5,
      })
    ).toThrow();
  });

  it("accepts missing optional fields", () => {
    const r = ProductPhotoExtractionSchema.parse({
      photo_type: "front_only",
      product_confidence: 0.7,
      lot_confidence: 0.0,
    });
    expect(r.brand).toBeUndefined();
    expect(r.lot_code).toBeUndefined();
  });
});

describe("RecallNoticeExtractionSchema", () => {
  it("accepts range criterion", () => {
    const r = RecallNoticeExtractionSchema.parse({
      description: "Recall of Acme car seats",
      criteria: [
        {
          field: "lot_code",
          operator: "range",
          value: { min: "A100", max: "A299" },
          raw_text: "Lot codes A100 through A299",
        },
      ],
    });
    expect(r.criteria[0]?.operator).toBe("range");
  });

  it("accepts eq criterion with string value", () => {
    const r = RecallNoticeExtractionSchema.parse({
      description: "Single lot recall",
      criteria: [
        { field: "lot_code", operator: "eq", value: "ABC123", raw_text: "Lot ABC123" },
      ],
    });
    expect(r.criteria[0]?.value).toBe("ABC123");
  });

  it("rejects unknown operator", () => {
    expect(() =>
      RecallNoticeExtractionSchema.parse({
        description: "x",
        criteria: [
          { field: "lot_code", operator: "between" as "eq", value: "A", raw_text: "x" },
        ],
      })
    ).toThrow();
  });
});
