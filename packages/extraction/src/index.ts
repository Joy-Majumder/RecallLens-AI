import { extractFromImage } from "./gemini.js";
import {
  ProductPhotoExtractionSchema,
  RecallNoticeExtractionSchema,
  type ProductPhotoExtraction,
  type RecallNoticeExtraction,
} from "./schemas.js";
import { PRODUCT_PHOTO_PROMPT } from "./prompts/productPhoto.js";
import { RECALL_NOTICE_PROMPT } from "./prompts/recallNotice.js";

export { getGemini, DEFAULT_MODEL } from "./gemini.js";
export {
  ProductPhotoExtractionSchema,
  RecallNoticeExtractionSchema,
} from "./schemas.js";
export type {
  ProductPhotoExtraction,
  RecallNoticeExtraction,
  Criterion,
} from "./schemas.js";
export { PRODUCT_PHOTO_PROMPT, RECALL_NOTICE_PROMPT } from "./prompts/index.js";

export async function extractProductFromPhoto(args: {
  imageBytes: Uint8Array;
  mimeType: string;
}): Promise<ProductPhotoExtraction> {
  return extractFromImage({
    imageBytes: args.imageBytes,
    mimeType: args.mimeType,
    prompt: PRODUCT_PHOTO_PROMPT,
    schema: ProductPhotoExtractionSchema,
  });
}

export async function extractRecallFromNotice(args: {
  imageBytes: Uint8Array;
  mimeType: string;
}): Promise<RecallNoticeExtraction> {
  return extractFromImage({
    imageBytes: args.imageBytes,
    mimeType: args.mimeType,
    prompt: RECALL_NOTICE_PROMPT,
    schema: RecallNoticeExtractionSchema,
  });
}