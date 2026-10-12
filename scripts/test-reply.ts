// Reads a reply for a lead without needing the UI (same as the lead page's Read reply).
// Run: npx tsx --conditions=react-server --env-file=.env.local scripts/test-reply.ts <lead_id> "<reply text>"
import { loadConfig } from "@/lib/pipeline";
import { handleReply } from "@/lib/replies";
import { db } from "@/lib/supabase/server";

const [code, text] = process.argv.slice(2);
const { data: lead } = await db().from("leads").select("id").eq("lead_id", code).single();
if (!lead) throw new Error(`no lead ${code}`);
console.log(await handleReply(lead.id, text, await loadConfig()));
