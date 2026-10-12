// Runs tier actions (hot: task + drafts; Lusha contact lookup) for leads that are missing them.
// Run: npx tsx --conditions=react-server --env-file=.env.local scripts/hot-actions.ts
import { loadConfig, onTierReached } from "@/lib/pipeline";
import { db } from "@/lib/supabase/server";

const cfg = await loadConfig();
const { data: leads } = await db().from("leads").select("id, company_name, poc_name, tier").eq("tier", "hot");
for (const l of leads ?? []) {
  await onTierReached(l.id, l.company_name, l.poc_name, l.tier, cfg);
  const { data: t } = await db().from("tasks").select("title, due_date, outreach_channel, drafted_model, email_subject").eq("lead_id", l.id);
  const { data: c } = await db().from("lead_contacts").select("source, match, name, title, email").eq("lead_id", l.id);
  console.log(l.company_name, JSON.stringify({ tasks: t, contacts: c?.map((x) => ({ ...x, email: x.email ? "revealed" : null })) }, null, 1));
}
