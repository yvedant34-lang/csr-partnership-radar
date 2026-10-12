import "server-only";
import { db } from "@/lib/supabase/server";
import { SIGNAL_LABEL } from "@/lib/ui";

// In-app notifications for Ananya: every new signal (news, pasted post, inbound webhook) and every
// lead that moves up to warm or hot. The dashboard shows each with the lead's next actions as checkboxes.
export async function notifyLead(input: {
  leadId: string;
  kind: "new_lead" | "tier_up" | "inbound";
  source: string | null;
  company: string;
  signalType: string;
  why: string | null;
  tier: string;
}) {
  const label = SIGNAL_LABEL[input.signalType] ?? input.signalType;
  const title = input.kind === "tier_up"
    ? `${input.company} is now ${input.tier}`
    : `${input.company}: ${label.toLowerCase()}`;
  await db().from("notifications").insert({
    lead_id: input.leadId, kind: input.kind, source: input.source, title, body: input.why, tier: input.tier,
  });
}
