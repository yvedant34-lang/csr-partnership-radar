// Lusha contact lookup for one lead (same as the drawer's "Find CSR contact" button).
// Run: npx tsx --conditions=react-server --env-file=.env.local scripts/find-contact.ts <lead_id> [--reveal]
import { findContacts, revealEmail } from "@/lib/lusha";
import { loadConfig } from "@/lib/pipeline";
import { db } from "@/lib/supabase/server";

const [code, flag] = process.argv.slice(2);
const cfg = await loadConfig();
const { data: lead } = await db().from("leads").select("id, company_name, poc_name").eq("lead_id", code).single();
if (!lead) throw new Error(`no lead ${code}`);
console.log(await findContacts(lead, cfg));
const { data: cs } = await db().from("lead_contacts").select("id, name, title, match, city").eq("lead_id", lead.id).eq("source", "lusha");
console.log(cs);
if (flag === "--reveal" && cs?.length) {
  const best = cs.find((c) => /csr|social|foundation|community/i.test(c.title ?? "")) ?? cs[0];
  const r = await revealEmail(best.id, cfg);
  console.log(best.name, r.ok ? "email revealed" : r.reason);
}
