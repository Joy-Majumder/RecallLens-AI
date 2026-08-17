/**
 * Zod schemas for Gemini output. Both prompts return JSON; these
 * schemas validate the parsed result before it reaches the matcher.
 *
 * Validation failures are surfaced as "more info needed" with the
 * specific offending field rather than letting bad data silently
 * flow into the matcher.
 */
import { z } from "zod";

export const PhotoTypeSchema = z.enum([
  "full_product",
  "front_only",
  "back_only",
  "unclear",
]);

export const ProductPhotoExtractionSchema = z.object({
  photo_type: PhotoTypeSchema,
  brand: z.string().optional().nullable(),
  product_name: z.string().optional().nullable(),
  variant: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  lot_code: z.string().optional().nullable(),
  mfg_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable()
    .or(z.literal("").transform(() => undefined)),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable()
    .or(z.literal("").transform(() => undefined)),
  product_confidence: z.number().min(0).max(1),
  lot_confidence: z.number().min(0).max(1),
  notes: z.string().optional(),
});

export type ProductPhotoExtraction = z.infer<typeof ProductPhotoExtractionSchema>;

export const CriterionSchema = z.object({
  field: z.enum(["brand", "product_name", "lot_code", "serial", "mfg_date"]),
  operator: z.enum(["eq", "prefix", "contains", "range", "regex"]),
  value: z.union([
    z.string(),
    z.object({ min: z.string(), max: z.string() }),
  ]),
  raw_text: z.string().optional(),
});

export const RecallNoticeExtractionSchema = z.object({
  brand: z.string().optional().nullable(),
  product_name: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  description: z.string(),
  criteria: z.array(CriterionSchema),
  source_url: z.string().optional().nullable(),
  notes: z.string().optional(),
});

export type RecallNoticeExtraction = z.infer<typeof RecallNoticeExtractionSchema>;
export type Criterion = z.infer<typeof CriterionSchema>;