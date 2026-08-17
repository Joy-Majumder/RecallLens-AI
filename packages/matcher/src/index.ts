export * from "./types.js";
export { evaluate, outcomeRank } from "./evaluate.js";
export { PHOTO_TYPE_BEHAVIOR } from "./photoType.js";
export { normalizeString, normalizeCode, similarity } from "./normalize.js";
export {
  matchBrand,
  matchProductName,
  matchLotCode,
  matchSerial,
  matchMfgDate,
} from "./rules/index.js";