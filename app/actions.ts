"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { normaliseConfig, type GateName, type RadarConfig } from "@/lib/config";
import { STAGES, type Stage } from "@/lib/data";
import { draftOutreach, saveDraftTask } from "@/lib/drafts";
import { intake } from "@/lib/intake";
import { formatSlot, nextDaySlot } from "@/lib/meeting";
import { bookSlot, handleReply, recordBooked } from "@/lib/replies";
import { connection, disconnect } from "@/lib/gcal";
import { findContacts, revealEmail } from "@/lib/lusha";
import { loadConfig, rescoreAll } from "@/lib/pipeline";
import { isAdmin, login, logout, requireAdmin } from "@/lib/session";
import { db } from "@/lib/supabase/server";
import { comingMonday } from "@/lib/week";

export type ActionResult = { ok: boolean; message: string };

const done = (message: string): ActionResult => {
  revalidatePath("/", "layout");
  return { ok: true, message };
};
const fail = (e: unknown): ActionResult => ({ ok: false, message: (e as Error).message ?? String(e) });

export async function loginAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const ok = await login(String(form.get("passcode") ?? ""));
  if (!ok) return { ok: false, message: "That passcode is not right." };
  redirect(String(form.get("next") || "/"));
}

export async function logoutAction() {
  await logout();
  redirect("/");
}

export async function toggleSample(on: boolean) {
  (await cookies()).set("radar_sample", on ? "1" : "0", { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  revalidatePath("/", "layout");
}

export async function setFeedback(leadId: string, value: "useful" | "not_useful"): Promise<ActionResult> {
  try {
    await requireAdmin();
    await db().from("leads").update({ feedback: value }).eq("id", leadId);
    return done(value === "useful" ? "Marked useful." : "Marked not useful.");
  } catch (e) { return fail(e); }
}

export async function moveStage(leadId: string, stage: Stage): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (!STAGES.includes(stage)) throw new Error("Unknown stage");
    const { data: lead } = await db().from("leads").select("pipeline_stage").eq("id", leadId).single();
    if (lead?.pipeline_stage === stage) return { ok: true, message: "Already there." };
    await db().from("leads").update({ pipeline_stage: stage, updated_at: new Date().toISOString() }).eq("id", leadId);
    await db().from("lead_stage_events").insert({ lead_id: leadId, from_stage: lead?.pipeline_stage ?? null, to_stage: stage });
    return done(`Moved to ${stage}.`);
  } catch (e) { return fail(e); }
}

export async function createCallTask(leadId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const { data: lead } = await db().from("leads").select("company_name").eq("id", leadId).single();
    const { count } = await db().from("tasks").select("id", { count: "exact", head: true }).eq("lead_id", leadId).eq("status", "open");
    if (count) return { ok: true, message: "There is already an open call task." };
    await db().from("tasks").insert({ lead_id: leadId, kind: "call", title: `Call ${lead?.company_name}`, due_date: comingMonday() });
    return done(`Call task added for Monday ${comingMonday()}.`);
  } catch (e) { return fail(e); }
}

export async function draftEmail(leadId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const cfg = await loadConfig();
    const { data: lead } = await db().from("leads").select("company_name").eq("id", leadId).single();
    const { draft, model } = await draftOutreach(leadId, cfg);
    await saveDraftTask(leadId, lead?.company_name ?? "", draft, model);
    return done("Draft ready on the Tasks page. Nothing was sent.");
  } catch (e) { return fail(e); }
}

export async function findContactAction(leadId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const cfg = await loadConfig();
    const { data: lead } = await db().from("leads").select("id, company_name, poc_name").eq("id", leadId).single();
    const r = await findContacts(lead!, cfg);
    if ("skipped" in r && r.skipped) return { ok: false, message: r.skipped };
    return done(r.found ? `Found ${r.found} contact${r.found > 1 ? "s" : ""} in Lusha.` : "Lusha has no CSR contact for this company.");
  } catch (e) { return fail(e); }
}

export async function revealEmailAction(contactId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const r = await revealEmail(contactId, await loadConfig());
    return r.ok ? done("Email revealed (1 Lusha credit).") : { ok: false, message: r.reason ?? "No email found." };
  } catch (e) { return fail(e); }
}

/** Tick or untick one of a lead's suggested next actions. Stored as a task row with the same action_key. */
export async function completeAction(leadId: string, key: string, title: string, finished: boolean): Promise<ActionResult> {
  try {
    await requireAdmin();
    const status = finished ? "done" : "open";
    const { data: byKey } = await db().from("tasks").select("id").eq("lead_id", leadId).eq("action_key", key).limit(1).maybeSingle();
    if (byKey) {
      await db().from("tasks").update({ status }).eq("id", byKey.id);
    } else if (key === "call") {
      const { data: call } = await db().from("tasks").select("id").eq("lead_id", leadId).eq("kind", "call").is("action_key", null).limit(1).maybeSingle();
      if (call) await db().from("tasks").update({ status, action_key: "call" }).eq("id", call.id);
      else await db().from("tasks").insert({ lead_id: leadId, kind: "call", title, status, action_key: key, due_date: comingMonday() });
    } else {
      await db().from("tasks").insert({ lead_id: leadId, kind: "action", title, status, action_key: key });
    }
    return done(finished ? "Done." : "Reopened.");
  } catch (e) { return fail(e); }
}

/** Ananya sent the draft from her own mailbox: tick the email action and move a new lead to Contacted. */
export async function markEmailSent(leadId: string, to?: string | null, toName?: string | null): Promise<ActionResult> {
  try {
    await requireAdmin();
    const r = await completeAction(leadId, "email", "Intro email sent", true);
    if (!r.ok) return r;
    // The email proposed tomorrow at the configured hour: remember that slot so a "yes" can be booked.
    const cfg = await loadConfig();
    const slot = nextDaySlot(new Date(), cfg.meeting_hour_ist, cfg.meeting_skip_weekends);
    await db().from("meetings").insert({ lead_id: leadId, status: "proposed", proposed_start: slot.toISOString(), invitee_email: to ?? null, invitee_name: toName ?? null });
    const { data: lead } = await db().from("leads").select("pipeline_stage").eq("id", leadId).single();
    if (lead?.pipeline_stage === "new") {
      await db().from("leads").update({ pipeline_stage: "contacted", updated_at: new Date().toISOString() }).eq("id", leadId);
      await db().from("lead_stage_events").insert({ lead_id: leadId, from_stage: "new", to_stage: "contacted" });
    }
    return done(`${lead?.pipeline_stage === "new" ? "Logged as sent, moved to Contacted." : "Logged as sent."} Proposed ${formatSlot(slot)}.`);
  } catch (e) { return fail(e); }
}

export async function markNotificationRead(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await db().from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    return done("Cleared.");
  } catch (e) { return fail(e); }
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  try {
    await requireAdmin();
    await db().from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
    return done("All cleared.");
  } catch (e) { return fail(e); }
}

/** Ananya pastes the lead's reply: read it, and book in Google Calendar if it is a clear yes. */
export async function logReply(leadId: string, _: ActionResult | null, form: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const text = String(form.get("reply") ?? "").trim();
    if (text.length < 2) return { ok: false, message: "Paste the reply first." };
    const r = await handleReply(leadId, text, await loadConfig(), { from: String(form.get("from") ?? "") || null });
    if (r.status === "booked") return done(r.message);
    revalidatePath("/", "layout");
    return { ok: true, message: r.message };
  } catch (e) { return fail(e); }
}

/** One click to book a reviewed slot (or the original proposal). */
export async function bookMeeting(meetingId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const { data: m } = await db().from("meetings").select("*").eq("id", meetingId).single();
    if (!m) return { ok: false, message: "Meeting not found." };
    const start = m.start_time ?? m.proposed_start;
    if (!start) return { ok: false, message: "No time to book. Paste a reply with a time." };
    if (!m.invitee_email) return { ok: false, message: "No email address for the invite. Find or reveal the contact first." };
    if (!(await connection())) return { ok: false, message: "Google Calendar is not connected. Use Add to Google Calendar, then I added it." };
    const cfg = await loadConfig();
    const r = await bookSlot(m.lead_id, new Date(start), {
      name: m.invitee_name ?? "Guest", email: m.invitee_email, cfg,
      save: async (fields) => { await db().from("meetings").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", meetingId); return meetingId; },
    });
    return r.status === "booked" ? done(r.message) : { ok: false, message: r.message };
  } catch (e) { return fail(e); }
}

/** Ananya added the meeting with the one-click Google Calendar link: record it as booked. */
export async function confirmCalendarAdded(meetingId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const { data: m } = await db().from("meetings").select("*").eq("id", meetingId).single();
    if (!m) return { ok: false, message: "Meeting not found." };
    const start = new Date(m.start_time ?? m.proposed_start);
    await db().from("meetings").update({ status: "booked", start_time: start.toISOString(), error: null, updated_at: new Date().toISOString() }).eq("id", meetingId);
    await recordBooked(m.lead_id, start, m.invitee_name ?? "the contact", "from Google Calendar");
    return done(`Recorded: meeting ${formatSlot(start)}.`);
  } catch (e) { return fail(e); }
}

export async function disconnectGoogle(): Promise<ActionResult> {
  try {
    await requireAdmin();
    await disconnect();
    return done("Google Calendar disconnected.");
  } catch (e) { return fail(e); }
}

export async function setTheme(theme: "light" | "dark" | "system") {
  (await cookies()).set("radar_theme", theme, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}

export async function setTaskStatus(taskId: string, status: "open" | "done" | "dropped"): Promise<ActionResult> {
  try {
    await requireAdmin();
    await db().from("tasks").update({ status }).eq("id", taskId);
    return done(status === "done" ? "Task done." : "Task updated.");
  } catch (e) { return fail(e); }
}

/** Paste a link or text: same extract and score path as the daily ingest. LinkedIn is never fetched. */
export async function pasteAction(_: ActionResult | null, form: FormData): Promise<ActionResult & { leadId?: string }> {
  try {
    await requireAdmin();
    const r = await intake({ url: String(form.get("url") ?? ""), text: String(form.get("text") ?? ""), via: "paste" });
    if (!r.ok) return { ok: false, message: r.message };
    const outcome = r.outcome;
    if (outcome.kind === "lead") {
      revalidatePath("/", "layout");
      return { ok: true, message: `${outcome.created ? "New" : "Updated"} lead: ${outcome.tier} ${outcome.score}.`, leadId: outcome.id };
    }
    if (outcome.kind === "policy") return done("Saved as a policy update.");
    return { ok: false, message: `Not saved: ${outcome.reason}.` };
  } catch (e) { return fail(e); }
}

const numberField = (form: FormData, key: string, fallback: number) => {
  const v = Number(form.get(key));
  return Number.isFinite(v) ? v : fallback;
};

export async function saveSettings(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const cur = await loadConfig();
    const list = (key: string) => String(form.get(key) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const next: RadarConfig = normaliseConfig({
      ...cur,
      home_city: String(form.get("home_city") || cur.home_city),
      home_state: String(form.get("home_state") || cur.home_state),
      home_city_aliases: list("home_city_aliases").length ? list("home_city_aliases") : cur.home_city_aliases,
      focus_sectors: form.getAll("focus_sectors").map(String),
      signal_points: Object.fromEntries(Object.entries(cur.signal_points).map(([k, v]) => [k, numberField(form, `signal_${k}`, v)])),
      sector_points: Object.fromEntries(Object.entries(cur.sector_points).map(([k, v]) => [k, numberField(form, `sector_${k}`, v)])),
      geo_points: Object.fromEntries(Object.entries(cur.geo_points).map(([k, v]) => [k, numberField(form, `geo_${k}`, v)])) as RadarConfig["geo_points"],
      budget_points: Object.fromEntries(Object.entries(cur.budget_points).map(([k, v]) => [k, numberField(form, `budget_${k}`, v)])) as RadarConfig["budget_points"],
      partner_penalty: numberField(form, "partner_penalty", cur.partner_penalty),
      tiers: { hot_min: numberField(form, "hot_min", cur.tiers.hot_min), warm_min: numberField(form, "warm_min", cur.tiers.warm_min) },
      gates: { enabled: form.getAll("gates").map(String) as GateName[], too_old_days: numberField(form, "too_old_days", cur.gates.too_old_days) },
      ngo_name: String(form.get("ngo_name") ?? cur.ngo_name).trim() || cur.ngo_name,
      ngo_outcome: String(form.get("ngo_outcome") ?? "").trim(),
      lusha_monthly_cap: numberField(form, "lusha_monthly_cap", cur.lusha_monthly_cap),
      lusha_auto_tiers: form.getAll("lusha_auto_tiers").map(String) as RadarConfig["lusha_auto_tiers"],
      meeting_hour_ist: numberField(form, "meeting_hour_ist", cur.meeting_hour_ist),
      meeting_minutes: numberField(form, "meeting_minutes", cur.meeting_minutes),
      meeting_skip_weekends: form.get("meeting_skip_weekends") === "on",
      auto_book_min_confidence: numberField(form, "auto_book_pct", Math.round(cur.auto_book_min_confidence * 100)) / 100,
      booking_page_url: String(form.get("booking_page_url") ?? cur.booking_page_url ?? "").trim(),
    });
    if (next.tiers.warm_min >= next.tiers.hot_min) return { ok: false, message: "The warm threshold must be below the hot threshold." };
    await db().from("radar_config").update({ config: next, updated_at: new Date().toISOString() }).eq("id", 1);
    return done("Settings saved. Use Rescore all leads to apply them to existing leads.");
  } catch (e) { return fail(e); }
}

export async function rescoreAction(): Promise<ActionResult> {
  try {
    await requireAdmin();
    const r = await rescoreAll(await loadConfig());
    return done(`Rescored ${r.rescored} leads; ${r.changedTier} changed tier.`);
  } catch (e) { return fail(e); }
}

export async function adminState() {
  return isAdmin();
}
