// Runs one extraction batch against the real database (same code as /api/extract).
// Run: npx tsx --conditions=react-server --env-file=.env.local scripts/run-extract.ts
import { extractBatch } from "@/lib/ingest";

const t0 = Date.now();
const r = await extractBatch();
console.log(JSON.stringify({ ...r, errors: r.errors.map((e) => e.error.slice(0, 120)), seconds: Math.round((Date.now() - t0) / 1000) }, null, 2));
