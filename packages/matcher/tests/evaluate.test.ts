import { describe, it, expect } from "vitest";
import { evaluate } from "../src/evaluate.js";
import type { MatchInput, Recall } from "../src/types.js";

function makeRecall(overrides: Partial<Recall> = {}): Recall {
  return {
    id: "r1",
    source: "cpsc",
    title: "Test Recall",
    sourceUrl: "https://example.gov/recall/r1",
    criteria: [],
    ...overrides,
  };
}

function makeInput(overrides: Partial<MatchInput> = {}): MatchInput {
  return {
    product: {
      brand: "Acme",
      productName: "Infant Car Seat",
      lotCode: "A100",
      mfgDate: "2024-02-15",
    },
    photoType: "full_product",
    productConfidence: 0.95,
    lotConfidence: 0.95,
    ...overrides,
  };
}

describe("evaluate — potential_match", () => {
  it("returns potential_match when brand, product, and lot all match", () => {
    const recall = makeRecall({
      brand: "Acme",
      productName: "Infant Car Seat",
      criteria: [
        { field: "brand", operator: "eq", value: "Acme" },
        { field: "product_name", operator: "eq", value: "Infant Car Seat" },
        { field: "lot_code", operator: "range", value: { min: "A100", max: "A299" } },
      ],
    });
    const input = makeInput();
    const r = evaluate(input, recall);

    expect(r.outcome).toBe("potential_match");
    expect(r.confidence).toBeGreaterThan(0.7);
    expect(r.missingFields).toHaveLength(0);
  });

  it("matches by lot prefix", () => {
    const recall = makeRecall({
      criteria: [
        { field: "lot_code", operator: "prefix", value: "BATCH2024" },
      ],
    });
    const input = makeInput({ product: { lotCode: "BATCH2024-MAR" } });
    const r = evaluate(input, recall);
    expect(r.outcome).toBe("potential_match");
  });

  it("matches by manufacturing date range", () => {
    const recall = makeRecall({
      criteria: [
        {
          field: "mfg_date",
          operator: "range",
          value: { min: "2024-01-01", max: "2024-03-31" },
        },
      ],
    });
    const input = makeInput({ product: { mfgDate: "2024-02-15" } });
    const r = evaluate(input, recall);
    expect(r.outcome).toBe("potential_match");
  });
});

describe("evaluate — no_match", () => {
  it("returns no_match when brand matches but lot is outside recalled range", () => {
    const recall = makeRecall({
      criteria: [
        { field: "brand", operator: "eq", value: "Acme" },
        { field: "lot_code", operator: "range", value: { min: "A100", max: "A199" } },
      ],
    });
    const input = makeInput({ product: { brand: "Acme", lotCode: "A500" } });
    const r = evaluate(input, recall);

    expect(r.outcome).toBe("no_match");
    expect(r.missingFields).toHaveLength(0);
  });

  it("returns no_match when mfg date is well outside range", () => {
    const recall = makeRecall({
      criteria: [
        {
          field: "mfg_date",
          operator: "range",
          value: { min: "2024-01-01", max: "2024-03-31" },
        },
      ],
    });
    const input = makeInput({ product: { mfgDate: "2023-06-15" } });
    const r = evaluate(input, recall);
    expect(r.outcome).toBe("no_match");
  });
});

describe("evaluate — more_info_needed", () => {
  it("returns more_info_needed when front_only photo has no lot code", () => {
    const recall = makeRecall({
      criteria: [
        { field: "lot_code", operator: "range", value: { min: "A100", max: "A299" } },
      ],
    });
    const input = makeInput({
      photoType: "front_only",
      product: { brand: "Acme" }, // no lot code
    });
    const r = evaluate(input, recall);

    expect(r.outcome).toBe("more_info_needed");
    expect(r.missingFields).toContain("lot_code");
  });

  it("returns more_info_needed when product confidence is low", () => {
    const recall = makeRecall({
      criteria: [{ field: "brand", operator: "eq", value: "Acme" }],
    });
    const input = makeInput({ productConfidence: 0.5 });
    const r = evaluate(input, recall);

    expect(r.outcome).toBe("more_info_needed");
    expect(r.missingFields).toContain("product_identity");
  });

  it("returns more_info_needed when lot code can't be read", () => {
    const recall = makeRecall({
      criteria: [
        { field: "lot_code", operator: "range", value: { min: "A100", max: "A299" } },
      ],
    });
    const input = makeInput({
      product: { brand: "Acme" /* no lot code */ },
    });
    const r = evaluate(input, recall);

    expect(r.outcome).toBe("more_info_needed");
    expect(r.missingFields).toContain("lot_code");
  });
});

describe("evaluate — unable_to_verify", () => {
  it("returns unable_to_verify when recall has no criteria", () => {
    const recall = makeRecall({ criteria: [] });
    const input = makeInput();
    const r = evaluate(input, recall);
    expect(r.outcome).toBe("unable_to_verify");
  });

  it("returns unable_to_verify when all criteria are malformed", () => {
    const recall = makeRecall({
      criteria: [
        { field: "lot_code", operator: "range", value: { min: 100, max: 200 } },
      ],
    });
    const input = makeInput({ product: { lotCode: "A100" } });
    const r = evaluate(input, recall);
    expect(r.outcome).toBe("unable_to_verify");
  });
});

describe("evaluate — auditability", () => {
  it("includes per-rule trace in result", () => {
    const recall = makeRecall({
      criteria: [
        { field: "brand", operator: "eq", value: "Acme" },
        { field: "lot_code", operator: "range", value: { min: "A100", max: "A299" } },
      ],
    });
    const input = makeInput({ product: { brand: "Acme", lotCode: "A100" } });
    const r = evaluate(input, recall);

    expect(r.rules).toHaveLength(2);
    const brandRule = r.rules.find((x) => x.field === "brand");
    const lotRule = r.rules.find((x) => x.field === "lot_code");
    expect(brandRule?.passed).toBe(true);
    expect(lotRule?.passed).toBe(true);
    expect(brandRule?.reason).toBeTruthy();
    expect(lotRule?.reason).toBeTruthy();
  });

  it("includes recall id in result", () => {
    const recall = makeRecall({
      id: "recall-xyz",
      criteria: [{ field: "brand", operator: "eq", value: "Acme" }],
    });
    const input = makeInput();
    const r = evaluate(input, recall);
    expect(r.recallId).toBe("recall-xyz");
  });
});

describe("evaluate — safety-critical front-only case", () => {
  it("NEVER returns no_match from a front_only photo even if brand matches", () => {
    // This is the failure mode the spec calls out: a false "no match"
    // from a safety tool is unacceptable.
    const recall = makeRecall({
      criteria: [
        { field: "brand", operator: "eq", value: "Acme" },
        { field: "lot_code", operator: "range", value: { min: "A100", max: "A199" } },
      ],
    });
    const input = makeInput({
      photoType: "front_only",
      product: { brand: "Acme" }, // no lot code visible
    });
    const r = evaluate(input, recall);

    expect(r.outcome).not.toBe("no_match");
    expect(r.outcome).toBe("more_info_needed");
  });
});