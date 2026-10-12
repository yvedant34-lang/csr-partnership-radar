import "server-only";
import type { RadarConfig } from "@/lib/config";
import { generate } from "@/lib/gemini";
import { db } from "@/lib/supabase/server";
import { comingMonday } from "@/lib/week";

// Drafts are saved to tasks for Ananya to copy. Nothing is ever sent to a company.

export const DRAFT_SCHEMA = {
  type: "OBJECT",
  properties: {
    channel: { type: "STRING", enum: ["email", "linkedin", "warm_intro", "event", "phone"] },
    email_subject: { type: "STRING" },
    email_body: { type: "STRING" },
    linkedin_note: { type: "STRING" },
    call_opener: { type: "STRING" },
  },
  required: ["channel", "email_subject", "email_body", "linkedin_note", "call_opener"],
  propertyOrdering: ["channel", "email_subject", "email_body", "linkedin_note", "call_opener"],
} as const;

export interface Draft {
  channel: string;
  email_subject: string;
  email_body: string;
  linkedin_note: string;
  call_opener: string;
}

const OUTCOME_PLACEHOLDER = "[one outcome from our programme: add it in Settings]";

export function draftPrompt(lead: Record<string, unknown>, cfg: RadarConfig, contactName: string | null): string {
  const outcome = cfg.ngo_outcome?.trim() || OUTCOME_PLACEHOLDER;
  return `You draft cold outreach for ${cfg.ngo_name}, an education NGO in ${cfg.home_city}, ${cfg.home_state}, serving school dropouts and first generation job seekers (education, skill development, digital literacy, youth employment).

Company: ${lead.company_name}
Signal: ${lead.signal_type}. ${lead.summary ?? ""}
Why now: ${lead.why_now ?? ""}
Place: ${[lead.city, lead.state].filter(Boolean).join(", ") || "not stated"}
Implementation partner already named: ${lead.implementation_partner ?? "none"}
Budget: ${lead.budget_inr_cr == null ? "not stated" : `Rs ${lead.budget_inr_cr} Cr`}
Recipient: ${contactName ?? "the CSR head (name not published)"}
Our outcome to cite (use exactly this, do not invent numbers): ${outcome}

Write:
- email_subject: under 9 words, names the exact signal.
- email_body: under 120 words. Warm, specific, plain English. Open with the exact signal (the centre, the spend, the new role). One sentence on how our work fits it. Cite the outcome above exactly. If a partner is already selected, pitch the next cycle or an adjacent site, not this project. End with one small ask, such as a 20 minute call. No flattery, no generic CSR language, no hype words. Sign off as "Ananya, Head of Corporate Partnerships".
- linkedin_note: under 280 characters, for a connection request.
- call_opener: exactly two lines: who we are and why we are calling about this signal; then one question.
- channel: the best first channel for this company and signal.`;
}

export async function draftOutreach(leadId: string, cfg: RadarConfig): Promise<{ draft: Draft; model: string }> {
  const { data: lead, error } = await db().from("leads").select("*").eq("id", leadId).single();
  if (error || !lead) throw new Error(`lead ${leadId} not found`);
  const { data: contact } = await db().from("lead_contacts").select("name, source, match").eq("lead_id", leadId)
    .order("source", { ascending: false }).limit(1).maybeSingle();
  const { text, model } = await generate(draftPrompt(lead, cfg, lead.poc_name ?? contact?.name ?? null), { schema: DRAFT_SCHEMA });
  return { draft: JSON.parse(text) as Draft, model };
}

/** Save a draft on the lead's open task (creating a call task due the coming Monday if none). */
export async function saveDraftTask(leadId: string, company: string, draft: Draft, model: string, now = new Date()) {
  const { data: open } = await db().from("tasks").select("id").eq("lead_id", leadId).eq("status", "open").limit(1).maybeSingle();
  const fields = {
    email_subject: draft.email_subject,
    email_draft: `${draft.email_body}\n\n---\nLinkedIn note: ${draft.linkedin_note}`,
    call_opener: draft.call_opener,
    outreach_channel: draft.channel,
    drafted_model: model,
  };
  if (open) {
    await db().from("tasks").update(fields).eq("id", open.id);
    return open.id as string;
  }
  const { data, error } = await db().from("tasks").insert({
    lead_id: leadId, kind: "call", title: `Call ${company}`, due_date: comingMonday(now), ...fields,
  }).select("id").single();
  if (error) throw new Error(`tasks insert: ${error.message}`);
  return data.id as string;
}
