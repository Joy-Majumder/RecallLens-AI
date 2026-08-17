/**
 * CLI: run a one-shot sync against all sources.
 *
 * Usage: pnpm sync
 *
 * Requires .env.local with Supabase and source API keys.
 */
import "dotenv/config";
import { runFullSync, getServiceClient } from "../src/index.js";

async function main() {
  console.log("[sync] starting full recall ingestion...");
  const start = Date.now();

  const client = getServiceClient();
  const results = await runFullSync(client);

  for (const r of results) {
    console.log(
      `[sync] ${r.source}: fetched=${r.fetched} inserted=${r.inserted} updated=${r.updated} errors=${r.errors} (${r.durationMs}ms)`
    );
  }

  const totalInserted = results.reduce((s, r) => s + r.inserted, 0);
  const totalUpdated = results.reduce((s, r) => s + r.updated, 0);
  const totalErrors = results.reduce((s, r) => s + r.errors, 0);
  console.log(
    `[sync] done in ${Date.now() - start}ms — ${totalInserted} new, ${totalUpdated} updated, ${totalErrors} errors`
  );

  if (totalErrors > 0) process.exit(1);
}

main().catch((err) => {
  console.error("[sync] fatal:", err);
  process.exit(1);
});