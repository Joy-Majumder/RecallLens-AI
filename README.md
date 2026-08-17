# RecallLens AI

Recall verification and monitoring platform. Reads lot codes, batch stamps, and dates off product photos with Gemini, then runs a deterministic matcher against structured recall criteria from CPSC, FDA, USDA, and NHTSA. Stores user product history and proactively notifies them when a new recall matches something they already scanned.

## Architecture

```
apps/web          Next.js 14 app router (consumer UI)
packages/matcher  Rule-based matching engine (core IP)
packages/extraction  Gemini client + prompts + Zod schemas
packages/ingestion   Recall feed sync (CPSC/FDA/USDA/NHTSA)
packages/db          Supabase schema + RLS migrations
packages/notifications  Background match + email dispatch
packages/types        Shared TypeScript types
```

The matcher is intentionally deterministic — Gemini only reads what's in the photo, the matcher makes the actual safety call. Every match result includes a per-rule trace for auditability.

## Quick start

```bash
pnpm install
cp .env.local.example .env.local
# Fill in your keys

# Run unit tests (matcher)
pnpm --filter @recalllens/matcher test

# Run dev app
npm run dev
```

See `linked-doodling-raccoon.md` (in `.puku-cli/plans/`) for the full design doc.

## Verification tool, not a certified safety authority

Every result links to the original official recall notice. The verification framing is shown above match language, not buried in a footer.# RecallLens-AI
# RecallLens-AI
