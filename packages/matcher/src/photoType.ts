import type { PhotoType } from "./types.js";

/**
 * Per photo-type confidence floors and behavioral modifiers.
 *
 * The two confidence scores are tracked independently:
 *   - productConfidence: how sure we are which product this is
 *   - lotConfidence:     how sure we are about the lot code read
 *
 * These floors reflect what is realistically readable from each photo type.
 * A front_only shot almost never shows a lot code, so lotConfidence is 0
 * by default — the matcher will ask the user for a clearer shot rather
 * than guess.
 */
export interface PhotoTypeBehavior {
  productFloor: number;
  lotFloor: number;
  /** If true, lot code absence triggers more_info_needed even if recall has no lot range */
  requireLotForConfidentNoMatch: boolean;
}

export const PHOTO_TYPE_BEHAVIOR: Record<PhotoType, PhotoTypeBehavior> = {
  full_product: {
    productFloor: 0.6,
    lotFloor: 0.5,
    requireLotForConfidentNoMatch: false,
  },
  back_only: {
    productFloor: 0.4,
    lotFloor: 0.6,
    requireLotForConfidentNoMatch: false,
  },
  front_only: {
    productFloor: 0.7,
    lotFloor: 0.0,
    requireLotForConfidentNoMatch: true,
  },
  unclear: {
    productFloor: 0.3,
    lotFloor: 0.3,
    requireLotForConfidentNoMatch: true,
  },
};