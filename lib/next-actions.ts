// Specific next actions for one lead, worked out in plain code from its tier, stage, contacts,
// drafts and score. Each action says why (the metric behind it). Ticking one records a task row
// with the same action_key, so the list remembers what is done.
import type { RadarConfig } from "@/lib/config";
import { estimateConfidence, gateWords } from "@/lib/scoring";
import { comingMonday, istParts } from "@/lib/week";

export type ActionCta = "draft" | "find_contact" | "reveal_email" | "open_source" | null;

export interface NextAction {
  key: string;
  title: string;
  why: string;
  due: string | null; // YYYY-MM-DD (IST)
  cta: ActionCta;
  contactId?: string;
  done: boolean;
  rank: number; // lower = more urgent
}

export interface ActionLead {
  id: string;
  company_name: string;
  tier: "hot" | "warm" | "cold";
  priority_score: number;
  probability_of_conversion_pct: number;
  signal_type: string;
  pipeline_stage: string;
  proven_funder: boolean;
  score_geo_fit: number;
  article_read: boolean;
  poc_name: string | null;
  budget_inr_cr: number | null;
  hot_gate_fails: string[];
  flags: string[];
  outreach_channel: string | null;
  post_link: string | null;
}

export interface ActionContact {
  id: string;
  source: "source_text" | "lusha";
  match?: string | null; // same_as_source | csr_role | adjacent_role
  name: string;
  email: string | null;
  linkedin: string | null;
  can_reveal: string[];
}

export interface ActionTask {
  action_key: string | null;
  kind: string;
  status: string;
  email_draft: string | null;
}

const DAY = 86_400_000;
const ymd = (d: Date) => {
  const p = istParts(d);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
};
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
/** Friday of the current IST week (or today if it is the weekend already). */
const thisFriday = (now: Date) => {
  const dow = istParts(now).dow;
  return ymd(dow <= 5 ? addDays(now, 5 - dow) : now);
};

export function nextFy(now: Date): string {
  const p = istParts(now);
  const fyEnd = p.m >= 4 ? p.y + 1 : p.y;
  return `FY${String((fyEnd + 1) % 100).padStart(2, "0")}`;
}

export function nextActions(
  lead: ActionLead,
  contacts: ActionContact[],
  tasks: ActionTask[],
  cfg: RadarConfig,
  now = new Date(),
): NextAction[] {
  const conf = estimateConfidence({
    article_read: lead.article_read, poc_name: lead.poc_name, budget_inr_cr: lead.budget_inr_cr,
    signal_type: lead.signal_type, has_contact_email: contacts.some((c) => c.email),
  });
  const metric = `${lead.tier} ${lead.priority_score}, estimate ${lead.probability_of_conversion_pct.toFixed(1)}% (${conf.level} confidence)`;
  const best = contacts.find((c) => c.email) ?? contacts.find((c) => c.source === "source_text") ?? contacts[0] ?? null;
  const who = best?.name ?? lead.poc_name ?? "the CSR head";
  const linked = contacts.find((c) => c.linkedin);
  const hasDraft = tasks.some((t) => t.email_draft && t.status !== "dropped");
  const isDone = (key: string) =>
    tasks.some((t) => t.status === "done" && (t.action_key === key || (key === "call" && t.kind === "call" && !t.action_key)));
  const partnerChosen = lead.flags.includes("partner_already_selected");
  const stage = lead.pipeline_stage;
  const out: Omit<NextAction, "done">[] = [];

  if (stage === "won") {
    out.push({ key: "invoice", title: "Send the invoice and get it signed", why: "A yes is not a grant until the invoice is signed. Then move to Invoice signed.", due: ymd(addDays(now, 7)), cta: null, rank: 15 });
    return out.map((a) => ({ ...a, done: isDone(a.key) }));
  }
  if (stage === "invoice_signed") {
    out.push({ key: "record_outcome", title: "Record the grant amount and start date", why: "Signed invoices feed the measured conversion rate.", due: null, cta: null, rank: 50 });
    return out.map((a) => ({ ...a, done: isDone(a.key) }));
  }
  if (stage === "ghosted") {
    out.push({ key: "last_try", title: `Try one different channel with ${lead.poc_name ?? "the CSR head"}, then park`, why: "No reply after follow up. One call or a warm intro, then stop.", due: ymd(addDays(now, 3)), cta: null, rank: 70 });
    return out.map((a) => ({ ...a, done: isDone(a.key) }));
  }
  if (["lost", "parked"].includes(stage)) return [];

  if (!lead.article_read && lead.post_link?.startsWith("http")) {
    out.push({ key: "read_source", title: "Read the source before reaching out", why: "Scored from the headline only, so the facts are unconfirmed.", due: ymd(now), cta: "open_source", rank: 5 });
  }

  // Contact first: no outreach without a person.
  if (lead.tier !== "cold" || lead.proven_funder) {
    if (contacts.length === 0) {
      out.push({ key: "find_contact", title: "Find the CSR contact", why: `No contact in the source. Lusha search costs about 1 credit. (${metric})`, due: ymd(now), cta: "find_contact", rank: 10 });
    } else {
      // Only spend a credit on someone who can say yes: the article's contact or a CSR role, not a related role.
      const revealable = contacts.find((c) => c.source === "lusha" && !c.email && c.can_reveal.includes("emails") && c.match !== "adjacent_role");
      if (!contacts.some((c) => c.email) && revealable) {
        out.push({ key: "reveal_email", title: `Reveal ${revealable.name}'s email`, why: "1 Lusha credit. Needed before the intro email.", due: ymd(now), cta: "reveal_email", contactId: revealable.id, rank: 12 });
      }
    }
  }

  if (stage === "new") {
    if (lead.tier === "hot") {
      out.push({ key: "email", title: `Send the intro email to ${who}`, why: hasDraft ? `Draft ready on the Tasks page. (${metric})` : `Draft it first. (${metric})`, due: ymd(now), cta: hasDraft ? null : "draft", rank: 20 });
      if (linked) out.push({ key: "linkedin", title: `Connect with ${linked.name} on LinkedIn`, why: "Same day as the email, with the short note from the draft.", due: ymd(now), cta: null, rank: 22 });
      out.push({ key: "call", title: `Call ${who}`, why: `Hot leads get a call this week. (${metric})`, due: comingMonday(now), cta: null, rank: 25 });
    } else if (lead.tier === "warm") {
      out.push({ key: "email", title: `Email ${who} this week`, why: hasDraft ? `Draft ready. (${metric})` : `Warm: email plus LinkedIn, no call yet. (${metric})`, due: thisFriday(now), cta: hasDraft ? null : "draft", rank: 30 });
      if (linked) out.push({ key: "linkedin", title: `Connect with ${linked.name} on LinkedIn`, why: "Warm up before any call.", due: thisFriday(now), cta: null, rank: 32 });
      out.push({ key: "call_if_reply", title: "Book a call slot next week if they reply", why: "Move to Contacted once you have written.", due: ymd(addDays(now, 7)), cta: null, rank: 35 });
    } else {
      const reasons = lead.hot_gate_fails.map((g) => gateWords(g as never, cfg).toLowerCase()).join(", ");
      out.push({ key: "nurture", title: "No outreach now: keep on the nurture list", why: reasons ? `Held back by: ${reasons}. Rescored daily; a new signal can lift it.` : `Score ${lead.priority_score} is below warm (${cfg.tiers.warm_min}).`, due: null, cta: null, rank: 80 });
    }
  }

  if (stage === "contacted") {
    out.push({ key: "follow_up", title: `Follow up with ${who} if there is no reply in 5 days`, why: `One follow up; still silent after that, mark Ghosted. (${metric})`, due: ymd(addDays(now, 5)), cta: null, rank: 20 });
  }
  if (stage === "meeting") {
    out.push({ key: "proposal", title: "Send a one page proposal after the meeting", why: `Lead with the outcome: ${cfg.ngo_outcome || "add it in Settings"}`, due: ymd(addDays(now, 3)), cta: null, rank: 20 });
  }
  if (stage === "proposal") {
    out.push({ key: "decision_date", title: "Ask for the decision date and the board meeting", why: "CSR committees approve in batches; know which one you are in.", due: ymd(addDays(now, 7)), cta: null, rank: 20 });
  }

  // Next-cycle pitch: companies already funding our work in our footprint, or warm ones whose
  // partner for this cycle is set. Out-of-footprint cold leads stay on the nurture list instead.
  if (lead.proven_funder || (partnerChosen && lead.score_geo_fit > 0 && lead.tier !== "cold")) {
    const fy = nextFy(now);
    out.push({
      key: "pitch_next_cycle",
      title: `Pitch ${lead.company_name} for ${fy} before January`,
      why: partnerChosen ? "This year's partner is set. Boards approve next year's CSR plans January to March." : "Already funds our kind of work in our footprint.",
      due: `${istParts(now).m >= 4 ? istParts(now).y : istParts(now).y - 1}-12-15`,
      cta: null,
      rank: lead.tier === "cold" ? 60 : 40,
    });
  }

  return out.sort((a, b) => a.rank - b.rank).map((a) => ({ ...a, done: isDone(a.key) }));
}
