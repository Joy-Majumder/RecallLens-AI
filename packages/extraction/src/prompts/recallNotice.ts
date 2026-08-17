/**
 * Prompt for extracting structured criteria from a recall notice image
 * or screenshot. The user might paste a photo of a CPSC page, a PDF
 * screenshot, or a paper notice.
 *
 * We normalize to the same shape the ingestion pipeline produces, so the
 * matcher doesn't need to distinguish "official source" from "user-uploaded".
 */
export const RECALL_NOTICE_PROMPT = `You are extracting structured information from a product recall notice (image, screenshot, or photo of paper notice).

Return STRICT JSON, no extra prose:

{
  "brand": string | null,
  "product_name": string | null,
  "category": string | null,
  "description": string,
  "criteria": [
    {
      "field": "brand" | "product_name" | "lot_code" | "serial" | "mfg_date",
      "operator": "eq" | "prefix" | "contains" | "range" | "regex",
      "value": string | {"min": string, "max": string},
      "raw_text": string
    }
  ],
  "source_url": string | null,
  "notes": string
}

Rules for criteria extraction — this is the most important part:

1. For LOT NUMBERS:
   - "Lot codes A100 through A299" → field:"lot_code", operator:"range", value:{"min":"A100","max":"A299"}
   - "Lot code ABC-12345" → field:"lot_code", operator:"eq", value:"ABC-12345"
   - "All lots beginning with BATCH24" → field:"lot_code", operator:"prefix", value:"BATCH24"
   - "Lots containing 2024-03" → field:"lot_code", operator:"contains", value:"2024-03"

2. For SERIAL NUMBERS: same operators as lot codes, but field:"serial".

3. For MANUFACTURING DATES:
   - "Manufactured between January 2024 and March 2024" → field:"mfg_date", operator:"range", value:{"min":"2024-01-01","max":"2024-03-31"}
   - "Manufactured on March 15, 2024" → field:"mfg_date", operator:"eq", value:"2024-03-15"

4. Always include raw_text — the original phrase from the notice that the criterion came from. This is for audit.

5. If the notice mentions a brand but no specific identifiers, include one criterion with field:"brand", operator:"eq", value:"Acme".

6. If a recall covers ALL units of a product line (no specific lot/serial/date), include a brand criterion and a product_name criterion.

7. Do NOT invent criteria that aren't in the notice. If the notice is vague ("some units"), note that in "notes" and include only what you can extract.

Category should be a short snake_case string like "infant_formula", "peanut_butter", "hair_dryer", "car_seat".

Description should be a 1-3 sentence summary of what the recall is about.

If the notice has a URL (agency page, press release), include it as source_url.`;