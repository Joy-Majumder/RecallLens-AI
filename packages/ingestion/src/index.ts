export { fetchCPSC } from "./sources/cpsc.js";
export { fetchFDA } from "./sources/fda.js";
export { fetchUSDA } from "./sources/usda.js";
export { fetchNHTSA } from "./sources/nhtsa.js";
export { syncSource, runFullSync } from "./sync.js";
export { getServiceClient } from "./client.js";
export type { IngestedRecall, SyncResult, IngestedCriterion } from "./types.js";