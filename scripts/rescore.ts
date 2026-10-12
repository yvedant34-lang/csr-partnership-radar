// Recompute every lead from radar_config (same as the Settings "Rescore all leads" button).
// Run: npx tsx --conditions=react-server --env-file=.env.local scripts/rescore.ts
import { loadConfig, rescoreAll } from "@/lib/pipeline";

console.log(await rescoreAll(await loadConfig()));
