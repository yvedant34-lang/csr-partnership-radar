import "server-only";
import type { RadarConfig } from "@/lib/config";
import { getLeadExtras, type Lead } from "@/lib/data";
import { nextActions, type NextAction } from "@/lib/next-actions";
import { estimateConfidence } from "@/lib/scoring";
import { istParts } from "@/lib/week";
import type { LeadRow } from "@/app/components/LeadsTable";
import type { ChecklistItem } from "@/app/components/ActionChecklist";

export function todayIst(now = new Date()): string {
  const p = istParts(now);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

/** Table rows plus every lead's next actions, from one bulk read of contacts and tasks. */
export async function buildLeadViews(leads: Lead[], cfg: RadarConfig, now = new Date()) {
  const { contacts, tasks } = await getLeadExtras(leads.map((l) => l.id));
  const actions = new Map<string, NextAction[]>();
  const rows: LeadRow[] = leads.map((l) => {
    const cs = contacts.get(l.id) ?? [];
    const acts = nextActions(l, cs, tasks.get(l.id) ?? [], cfg, now);
    actions.set(l.id, acts);
    const conf = estimateConfidence({ ...l, has_contact_email: cs.some((c) => c.email) });
    const contact = cs.find((c) => c.email)?.name ?? l.poc_name ?? cs[0]?.name ?? null;
    return { lead: l, next: acts.find((a) => !a.done) ?? acts[0] ?? null, contact, confidence: conf.level };
  });
  return { rows, actions };
}

/** The open actions across leads that matter this week, most urgent first. */
export function actionQueue(leads: Lead[], actions: Map<string, NextAction[]>, limit = 12): ChecklistItem[] {
  const tierRank = { hot: 0, warm: 1, cold: 2 } as const;
  return leads
    .flatMap((l) => (actions.get(l.id) ?? [])
      .filter((a) => !a.done && a.key !== "nurture")
      .map((a) => ({ ...a, leadId: l.id, company: l.company_name, tier: l.tier, sourceUrl: l.source_url ?? l.post_link, sort: tierRank[l.tier] * 100 + a.rank })))
    .sort((a, b) => a.sort - b.sort || (a.due ?? "9").localeCompare(b.due ?? "9"))
    .slice(0, limit);
}
