/**
 * Prompt for extracting identifiers from a product photo.
 *
 * Designed to be conservative — Gemini should say "null" rather than guess
 * when it can't read something. The two confidence scores are tracked
 * independently because a photo might show the brand clearly but not the
 * lot code, or vice versa.
 */
export const PRODUCT_PHOTO_PROMPT = `You are extracting product identifiers from a photo for a recall-safety matching system. Your job is to read what's actually visible — never invent values you can't see.

Return STRICT JSON matching this exact shape, no extra prose:

{
  "photo_type": "full_product" | "front_only" | "back_only" | "unclear",
  "brand": string | null,
  "product_name": string | null,
  "variant": string | null,
  "category": string | null,
  "lot_code": string | null,
  "mfg_date": "YYYY-MM-DD" | null,
  "expiry_date": "YYYY-MM-DD" | null,
  "product_confidence": number 0.0..1.0,
  "lot_confidence": number 0.0..1.0,
  "notes": string
}

Field-by-field guidance:
- photo_type: classify the photo. "full_product" = whole product visible from a typical consumer angle. "front_only" = only the front-facing label is clearly visible, the back/bottom is not. "back_only" = only the back, side, or bottom (where lot codes usually live) is visible, the brand isn't. "unclear" = can't tell.
- brand: the brand/manufacturer name as printed. If it's trademarked (™, ®, ©), include just the word.
- product_name: the full product name as printed. If the box lists "Acme Infant Formula Stage 1", return exactly that.
- variant: size, color, flavor, model number — anything that distinguishes this SKU from others. null if not visible.
- category: a short snake_case category like "infant_formula", "peanut_butter", "infant_car_seat", "hair_dryer", "lip_balm". null if uncertain.
- lot_code: ANY printed identifier that looks like a lot, batch, or serial number. This is the most important field. Look at the bottom of cans, the back of bottles, under barcodes, on stickers. Read characters carefully — "8" vs "B", "0" vs "O", "1" vs "I" matter. null if nothing visible.
- mfg_date: manufacturing date in YYYY-MM-DD. Accept "JAN 2024", "01/2024", "2024-01" and convert to the first of the month if day is missing. null if not visible.
- expiry_date: same format rules as mfg_date. null if not visible.
- product_confidence: how confident are you that this is the actual product (brand + name match)? 1.0 = certain, 0.5 = could be a different SKU, 0.0 = can't tell.
- lot_confidence: how confident are you that you read the lot code correctly? 1.0 = printed clearly, 0.5 = partially obscured or ambiguous, 0.0 = nothing readable.
- notes: anything ambiguous a human should know (e.g. "lot code partially obscured by sticker").

CRITICAL RULES:
1. If you can't read a field with confidence, return null for that field. Never guess.
2. Never return values for fields you cannot see in the photo.
3. Keep brand and product_name separate — many products have a different brand and product name.
4. Dates are YYYY-MM-DD. If the date is partially obscured, lower lot_confidence but still return what you can read.
5. The lot code is the highest-value field for safety. Spend the most effort there.`;