import { describe, it, expect } from "vitest";
import { evaluate } from "../src/evaluate.js";
import type { MatchInput, Recall } from "../src/types.js";

describe("evaluate — photo type behavior", () => {
  const recall: Recall = {
    id: "r1",
    source: "cpsc",
    title: "T",
    sourceUrl: "u",
    criteria: [
      { field: "lot_code", operator: "range", value: { min: "A100", max: "A299" } },
    ],
  };

  it("full_product photo with lot code can produce a match", () => {
    const input: MatchInput = {
      product: { brand: "Acme", lotCode: "A150" },
      photoType: "full_product",
      productConfidence: 0.9,
      lotConfidence: 0.9,
    };
    expect(evaluate(input, recall).outcome).toBe("potential_match");
  });

  it("front_only photo without lot code triggers more_info_needed, never no_match", () => {
    const input: MatchInput = {
      product: { brand: "Acme" }, // lot code absent
      photoType: "front_only",
      productConfidence: 0.9,
      lotConfidence: 0.9,
    };
    const r = evaluate(input, recall);
    expect(r.outcome).toBe("more_info_needed");
    expect(r.missingFields).toContain("lot_code");
  });

  it("unclear photo triggers more_info_needed", () => {
    const input: MatchInput = {
      product: { brand: "Acme" },
      photoType: "unclear",
      productConfidence: 0.9,
      lotConfidence: 0.9,
    };
    const r = evaluate(input, recall);
    expect(r.outcome).toBe("more_info_needed");
  });

  it("back_only photo with lot code visible produces a match", () => {
    const input: MatchInput = {
      product: { brand: "Acme", lotCode: "A150" },
      photoType: "back_only",
      productConfidence: 0.9,
      lotConfidence: 0.9,
    };
    expect(evaluate(input, recall).outcome).toBe("potential_match");
  });

  it("back_only photo without lot code triggers more_info_needed", () => {
    const input: MatchInput = {
      product: { brand: "Acme" },
      photoType: "back_only",
      productConfidence: 0.9,
      lotConfidence: 0.9,
    };
    const r = evaluate(input, recall);
    expect(r.outcome).toBe("more_info_needed");
  });
});

describe("evaluate — confidence thresholds", () => {
  it("low product confidence triggers more_info_needed", () => {
    const recall: Recall = {
      id: "r1",
      source: "cpsc",
      title: "T",
      sourceUrl: "u",
      criteria: [{ field: "brand", operator: "eq", value: "Acme" }],
    };
    const r = evaluate(
      {
        product: { brand: "Acme" },
        photoType: "full_product",
        productConfidence: 0.3,
        lotConfidence: 0.9,
      },
      recall
    );
    expect(r.outcome).toBe("more_info_needed");
    expect(r.missingFields).toContain("product_identity");
  });

  it("low lot confidence with lot-required recall triggers more_info_needed", () => {
    const recall: Recall = {
      id: "r1",
      source: "cpsc",
      title: "T",
      sourceUrl: "u",
      criteria: [
        { field: "lot_code", operator: "range", value: { min: "A100", max: "A200" } },
      ],
    };
    const r = evaluate(
      {
        product: { brand: "Acme", lotCode: "A150" },
        photoType: "full_product",
        productConfidence: 0.95,
        lotConfidence: 0.4,
      },
      recall
    );
    expect(r.outcome).toBe("more_info_needed");
    expect(r.missingFields).toContain("lot_code");
  });
});