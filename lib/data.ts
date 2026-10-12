import "server-only";
import { normaliseConfig, type RadarConfig } from "@/lib/config";
import { db } from "@/lib/supabase/server";
import { isoWeek, thisWeekCutoff, weekLabelToDate, weekStartIst } from "@/lib/week";

// Pipeline stages in board order. The lifecycle chart ranks them from Ghosted (lowest) to Invoice signed (highest).
export const STAGES = ["new", "contacted", "meeting", "proposal", "won", "invoice_signed", "lost", "ghosted", "parked"] as const;
export type Stage = (typeof STAGES)[number];
const STAGE_NAMES: Record<string, string> = {
  new: "New", contacted: "Contacted", meeting: "Meeting", proposal: "Proposal", won: "Won",
  invoice_signed: "Invoice signed", lost: "Lost", ghosted: "Ghosted", parked: "Parked",
};
export const CLOSED_STAGES: string[] = ["won", "invoice_signed", "lost", "ghosted", "parked"];

export interface Lead {
  id: string;
  lead_id: string;
  company_name: string;
  industry: string | null;
  csr_focus_area: string | null;
  city: string | null;
  state: string | null;
  geo_scope: string | null;
  programme_states: string[];
  poc_name: string | null;
  poc_designation: string | null;
  contact_source: string | null;
  source_type: string | null;
  source_name: string | null;
  post_link: string | null;
  source_url: string | null;
  article_read: boolean;
  signal_type: string;
  budget_inr_cr: number | null;
  posted_at: string;
  implementation_partner: string | null;
  beneficiaries: string | null;
  summary: string | null;
  why_now: string | null;
  extraction_confidence: string;
  priority_score: number;
  probability_of_conversion_pct: number;
  tier: "hot" | "warm" | "cold";
  score_signal: number;
  score_recency: number;
  score_sector_fit: number;
  score_geo_fit: number;
  score_budget_fit: number;
  flags: string[];
  hot_gate_fails: string[];
  proven_funder: boolean;
  recommended_action: string | null;
  pipeline_stage: Stage;
  feedback: string | null;
  is_synthetic: boolean;
  outreach_channel: string | null;
  outreach_angle: string | null;
  outreach_first_line: string | null;
  outreach_ask: string | null;
  people: { name: string; designation: string | null; role: string }[];
}

const num = (v: unknown) => (v == null ? null : Number(v));
const toLead = (r: Record<string, unknown>) => ({ ...r, budget_inr_cr: num(r.budget_inr_cr), probability_of_conversion_pct: Number(r.probability_of_conversion_pct) }) as Lead;

export async function getConfig(): Promise<RadarConfig> {
  const { data } = await db().from("radar_config").select("config").eq("id", 1).maybeSingle();
  return normaliseConfig(data?.config ?? {});
}

export async function getLeads(opts: { sample: boolean; thisWeek?: boolean; provenOnly?: boolean } ) {
  let q = db().from("leads").select("*").order("priority_score", { ascending: false }).order("posted_at", { ascending: false });
  if (!opts.sample) q = q.eq("is_synthetic", false);
  if (opts.thisWeek) q = q.gte("posted_at", thisWeekCutoff().toISOString());
  if (opts.provenOnly) q = q.eq("proven_funder", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(toLead);
}

export async function getLead(id: string) {
  const { data } = await db().from("leads").select("*").eq("id", id).maybeSingle();
  return data ? toLead(data) : null;
}

export interface Contact {
  id: string;
  source: "source_text" | "lusha";
  match: string | null;
  name: string;
  title: string | null;
  city: string | null;
  linkedin: string | null;
  email: string | null;
  can_reveal: string[];
  found_at: string;
}

export async function getContacts(leadId: string): Promise<Contact[]> {
  const { data } = await db().from("lead_contacts").select("*").eq("lead_id", leadId).order("source", { ascending: false });
  return (data ?? []) as Contact[];
}

export async function getTasks(leadId?: string) {
  let q = db().from("tasks").select("*, leads(company_name, tier, lead_id, id, is_synthetic)").order("due_date", { ascending: true });
  if (leadId) q = q.eq("lead_id", leadId);
  const { data } = await q;
  return data ?? [];
}

export async function getCoverage() {
  const { data: run } = await db().from("ingestion_runs").select("*").eq("kind", "ingest")
    .order("started_at", { ascending: false }).limit(1).maybeSingle();
  const { count: queued } = await db().from("raw_items").select("id", { count: "exact", head: true })
    .eq("status", "new").eq("prefilter_pass", true);
  return { run, queued: queued ?? 0 };
}

export async function getPolicies(sample: boolean) {
  let q = db().from("policy_updates").select("*").order("published_at", { ascending: false });
  if (!sample) q = q.eq("is_synthetic", false);
  const { data } = await q;
  return data ?? [];
}

export async function lushaCreditsThisMonth() {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { data } = await db().from("lusha_spend").select("credits").gte("spent_at", start.toISOString());
  return (data ?? []).reduce((n, r) => n + (r.credits ?? 0), 0);
}

/** Weekly stage entries for the conversion chart (last `weeks` IST weeks). */
export async function getConversionSeries(sample: boolean, weeks = 12) {
  const now = new Date();
  const labels: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) labels.push(isoWeek(new Date(now.getTime() - i * 7 * 86_400_000)));
  const from = weekLabelToDate(labels[0])!;

  let q = db().from("lead_stage_events").select("to_stage, changed_at, leads!inner(is_synthetic)").gte("changed_at", from.toISOString());
  if (!sample) q = q.eq("leads.is_synthetic", false);
  const { data: events } = await q;

  const ladder = ["new", "contacted", "meeting", "proposal", "won", "invoice_signed"] as const;
  const series = Object.fromEntries(ladder.map((s) => [s, labels.map(() => 0)])) as Record<(typeof ladder)[number], number[]>;
  for (const e of events ?? []) {
    const idx = labels.indexOf(isoWeek(new Date(e.changed_at)));
    if (idx >= 0 && (ladder as readonly string[]).includes(e.to_stage)) series[e.to_stage as (typeof ladder)[number]][idx]++;
  }

  let lq = db().from("leads").select("pipeline_stage, probability_of_conversion_pct");
  if (!sample) lq = lq.eq("is_synthetic", false);
  const { data: leads } = await lq;
  const all = leads ?? [];
  const reached = (stages: string[]) => all.filter((l) => stages.includes(l.pipeline_stage)).length;
  const open = all.filter((l) => !CLOSED_STAGES.includes(l.pipeline_stage));
  const totals = {
    found: all.length,
    contacted: reached(["contacted", "meeting", "proposal", "won", "invoice_signed", "lost", "ghosted"]),
    meeting: reached(["meeting", "proposal", "won", "invoice_signed"]),
    won: reached(["won", "invoice_signed"]),
    lost: reached(["lost", "ghosted"]),
    avgEstimate: open.length ? open.reduce((n, l) => n + Number(l.probability_of_conversion_pct), 0) / open.length : 0,
  };
  return { labels, weekStarts: labels.map((l) => weekLabelToDate(l)!.toISOString()), series, totals };
}

export { weekStartIst };

/** Contacts and tasks for many leads at once, grouped by lead id (for tables and the action list). */
export async function getLeadExtras(leadIds: string[]) {
  const ids = leadIds.length ? leadIds : ["00000000-0000-0000-0000-000000000000"];
  const [{ data: contacts }, { data: tasks }] = await Promise.all([
    db().from("lead_contacts").select("id, lead_id, source, match, name, email, linkedin, can_reveal").in("lead_id", ids),
    db().from("tasks").select("id, lead_id, action_key, kind, status, email_draft, due_date").in("lead_id", ids),
  ]);
  const by = <T extends { lead_id: string }>(rows: T[] | null) => {
    const m = new Map<string, T[]>();
    for (const r of rows ?? []) m.set(r.lead_id, [...(m.get(r.lead_id) ?? []), r]);
    return m;
  };
  return { contacts: by(contacts as never), tasks: by(tasks as never) } as {
    contacts: Map<string, { id: string; lead_id: string; source: "source_text" | "lusha"; match: string | null; name: string; email: string | null; linkedin: string | null; can_reveal: string[] }[]>;
    tasks: Map<string, { id: string; lead_id: string; action_key: string | null; kind: string; status: string; email_draft: string | null; due_date: string | null }[]>;
  };
}

export interface ActivityItem { at: string; text: string }

/** Timeline for a lead record: found, stage moves, tasks, contacts found and revealed. */
export async function getActivity(leadId: string, createdAt: string): Promise<ActivityItem[]> {
  const [{ data: events }, { data: tasks }, { data: contacts }] = await Promise.all([
    db().from("lead_stage_events").select("from_stage, to_stage, changed_at").eq("lead_id", leadId),
    db().from("tasks").select("title, status, created_at, drafted_model, email_draft").eq("lead_id", leadId),
    db().from("lead_contacts").select("name, source, found_at, revealed_at, email").eq("lead_id", leadId),
  ]);
  const items: ActivityItem[] = [];
  const label = (k: string) => STAGE_NAMES[k] ?? k;
  for (const e of events ?? []) items.push({ at: e.changed_at, text: e.from_stage ? `Moved from ${label(e.from_stage)} to ${label(e.to_stage)}` : "Found by the radar" });
  for (const t of tasks ?? []) {
    items.push({ at: t.created_at, text: `${t.title}${t.status !== "open" ? ` (${t.status})` : ""}` });
    if (t.email_draft && t.drafted_model) items.push({ at: t.created_at, text: `Email draft written by ${t.drafted_model}` });
  }
  for (const c of contacts ?? []) {
    if (c.source === "lusha") items.push({ at: c.found_at, text: `Contact found in Lusha: ${c.name}` });
    if (c.revealed_at && c.email) items.push({ at: c.revealed_at, text: `Email revealed for ${c.name}` });
  }
  if (!items.length) items.push({ at: createdAt, text: "Found by the radar" });
  return items.sort((a, b) => +new Date(b.at) - +new Date(a.at));
}

export async function getStageEvents(leadId: string) {
  const { data } = await db().from("lead_stage_events").select("to_stage, changed_at").eq("lead_id", leadId).order("changed_at");
  return (data ?? []).map((e) => ({ stage: e.to_stage as string, at: e.changed_at as string }));
}

export interface Notification {
  id: string; lead_id: string | null; kind: string; source: string | null; title: string; body: string | null;
  tier: string | null; created_at: string; read_at: string | null;
}

export async function getNotifications(opts: { unreadOnly?: boolean; limit?: number } = {}) {
  let q = db().from("notifications").select("*").order("created_at", { ascending: false }).limit(opts.limit ?? 20);
  if (opts.unreadOnly) q = q.is("read_at", null);
  const { data } = await q;
  return (data ?? []) as Notification[];
}

export async function unreadNotificationCount() {
  const { count } = await db().from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  return count ?? 0;
}
