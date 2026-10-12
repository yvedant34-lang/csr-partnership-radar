// Re-drafts outreach for a lead's open task (same as the drawer's Draft email button).
// Run: npx tsx --conditions=react-server --env-file=.env.local scripts/redraft.ts <lead_id>
import { draftOutreach, saveDraftTask } from "@/lib/drafts";
import { loadConfig } from "@/lib/pipeline";
import { db } from "@/lib/supabase/server";

const code = process.argv[2];
const { data: lead } = await db().from("leads").select("id, company_name").eq("lead_id", code).single();
if (!lead) throw new Error(`no lead ${code}`);
const { draft, model } = await draftOutreach(lead.id, await loadConfig());
await saveDraftTask(lead.id, lead.company_name, draft, model);
const words = draft.email_body.split(/\s+/).filter(Boolean).length;
console.log(`model ${model} · ${words} words · channel ${draft.channel}\n\nSubject: ${draft.email_subject}\n\n${draft.email_body}\n\nLinkedIn: ${draft.linkedin_note}\n\nCall opener: ${draft.call_opener}`);
