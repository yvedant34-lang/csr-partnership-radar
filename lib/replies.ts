import "server-only";
import { meetingTitle } from "@/lib/calendar-link";
import { connection, createEvent, isFree } from "@/lib/gcal";
import type { RadarConfig } from "@/lib/config";
import { generate } from "@/lib/gemini";
import { formatSlot } from "@/lib/meeting";
import { notifyLead } from "@/lib/notify";
import { db } from "@/lib/supabase/server";

// A lead's reply to the first email. Gemini only reads it; plain code decides whether to book.
// Booking is the one step where something reaches the company: Google Calendar sends the invite, and only
// after the lead has said yes in their own words.

export const REPLY_SCHEMA = {
  type: "OBJECT",
  properties: {
    intent: { type: "STRING", enum: ["accept_proposed", "propose_other_time", "decline", "unclear"] },
    proposed_time_ist: { type: "STRING", nullable: true, description: "YYYY-MM-DDTHH:MM in IST, only if the reply names a specific date and time" },
    confidence: { type: "NUMBER" },
    summary: { type: "STRING" },
  },
  required: ["intent", "confidence", "summary"],
  propertyOrdering: ["intent", "proposed_time_ist", "confidence", "summary"],
} as const;

export interface ReplyReading {
  intent: "accept_proposed" | "propose_other_time" | "decline" | "unclear";
  proposed_time_ist: string | null;
  confidence: number;
  summary: string;
}

export async function readReply(text: string, proposed: Date | null, now = new Date()): Promise<{ reading: ReplyReading; model: string }> {
  const ist = new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
  const prompt = `Today is ${formatSlot(now).replace(/ at .*/, "")} ${ist.slice(0, 4)} (date ${ist}, IST). Use this year unless the reply says otherwise. We emailed a company asking for a ${proposed ? `call on ${formatSlot(proposed)}` : "short call"}.
Their reply is below. Classify it:
- accept_proposed: they agree to that exact slot ("yes", "3 pm works", "see you tomorrow").
- propose_other_time: they suggest a specific different date and time. Give it as proposed_time_ist (YYYY-MM-DDTHH:MM, IST), resolving words like "Thursday" or "next Monday" from today's date. If they give only a day or a vague time ("next week", "afternoon"), use unclear.
- decline: not interested, not now, or they already have a partner.
- unclear: anything else, including questions without a yes.
confidence: 0 to 1, how sure you are. summary: one plain sentence.

Reply:
"""${text.slice(0, 6000)}"""`;
  const { text: out, model } = await generate(prompt, { schema: REPLY_SCHEMA });
  return { reading: JSON.parse(out) as ReplyReading, model };
}

function istToDate(local: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2})?/.exec(local.trim());
  return m ? new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+05:30`) : null;
}

export interface ReplyOutcome { status: "booked" | "needs_review" | "declined"; message: string; meetingId: string }

/** Read a reply, then book, flag for review, or record a no. */
export async function handleReply(leadId: string, text: string, cfg: RadarConfig, opts: { from?: string | null; now?: Date } = {}): Promise<ReplyOutcome> {
  const now = opts.now ?? new Date();
  const { data: lead } = await db().from("leads").select("id, company_name, signal_type, tier, poc_name, pipeline_stage").eq("id", leadId).single();
  if (!lead) throw new Error("lead not found");
  const { data: open } = await db().from("meetings").select("*").eq("lead_id", leadId)
    .in("status", ["proposed", "needs_review"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const proposed = open?.proposed_start ? new Date(open.proposed_start) : null;
  const { reading } = await readReply(text, proposed, now);

  // Who to invite: the address that replied, else the contact we emailed.
  const { data: contacts } = await db().from("lead_contacts").select("name, email, match").eq("lead_id", leadId);
  const fromEmail = opts.from?.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? null;
  const known = (contacts ?? []).find((c) => c.email && fromEmail && c.email.toLowerCase() === fromEmail.toLowerCase());
  const best = known ?? (contacts ?? []).find((c) => c.email && c.match !== "adjacent_role") ?? (contacts ?? []).find((c) => c.email);
  const email = fromEmail ?? open?.invitee_email ?? best?.email ?? null;
  const name = known?.name ?? best?.name ?? lead.poc_name ?? lead.company_name;

  const base = {
    lead_id: leadId, reply_text: text.slice(0, 6000), reply_intent: reading.intent, reply_confidence: reading.confidence,
    invitee_email: email, invitee_name: name, proposed_start: open?.proposed_start ?? null, updated_at: now.toISOString(),
  };
  const save = async (fields: Record<string, unknown>) => {
    if (open) {
      await db().from("meetings").update({ ...base, ...fields }).eq("id", open.id);
      return open.id as string;
    }
    const { data } = await db().from("meetings").insert({ ...base, ...fields }).select("id").single();
    return data!.id as string;
  };

  if (reading.intent === "decline") {
    const id = await save({ status: "declined" });
    await notifyLead({ leadId, kind: "inbound", source: "reply", company: lead.company_name, signalType: lead.signal_type, tier: lead.tier,
      why: `Reply: ${reading.summary} Consider moving to Lost or Parked.` });
    return { status: "declined", message: `Read as a no: ${reading.summary}`, meetingId: id };
  }

  const target = reading.intent === "accept_proposed" ? proposed
    : reading.intent === "propose_other_time" && reading.proposed_time_ist ? istToDate(reading.proposed_time_ist) : null;
  const google = await connection();
  const why = !target ? (reading.intent === "accept_proposed" ? "no proposed slot was recorded for this lead" : "no specific time in the reply")
    : target.getTime() < now.getTime() + 30 * 60_000 ? "the time has already passed or is too close"
    : reading.confidence < cfg.auto_book_min_confidence ? `not sure enough (${Math.round(reading.confidence * 100)}%)`
    : !email ? "no email address for the invite"
    : !google ? "Google Calendar is not connected, so add it with one click"
    : null;

  if (why || !target) {
    const id = await save({ status: "needs_review", start_time: target?.toISOString() ?? null, error: why });
    await notifyLead({ leadId, kind: "inbound", source: "reply", company: lead.company_name, signalType: lead.signal_type, tier: lead.tier,
      why: `Reply needs you: ${reading.summary}${target ? ` Suggested time ${formatSlot(target)}.` : ""} Not booked automatically: ${why}.` });
    return { status: "needs_review", message: `Not booked automatically: ${why}. ${reading.summary}`, meetingId: id };
  }
  return bookSlot(leadId, target, { name, email: email!, cfg, save, summary: reading.summary, now });
}

/** Mark a lead as having a meeting at `start`: stage to Meeting, a task, a notification. */
export async function recordBooked(leadId: string, start: Date, name: string, via: string, now = new Date()) {
  const { data: lead } = await db().from("leads").select("company_name, signal_type, tier, pipeline_stage").eq("id", leadId).single();
  if (lead && ["new", "contacted"].includes(lead.pipeline_stage)) {
    await db().from("leads").update({ pipeline_stage: "meeting", updated_at: now.toISOString() }).eq("id", leadId);
    await db().from("lead_stage_events").insert({ lead_id: leadId, from_stage: lead.pipeline_stage, to_stage: "meeting" });
  }
  await db().from("tasks").insert({ lead_id: leadId, kind: "meeting", title: `Meeting with ${name} (${lead?.company_name})`,
    due_date: new Date(start.getTime() + 330 * 60_000).toISOString().slice(0, 10), action_key: "meeting_booked" });
  await notifyLead({ leadId, kind: "inbound", source: "reply", company: lead!.company_name, signalType: lead!.signal_type, tier: lead!.tier,
    why: `Meeting booked ${via} for ${formatSlot(start)} with ${name}.` });
}

/** Book a slot in Ananya's Google Calendar (free/busy checked, Meet link, invite emailed by Google). */
export async function bookSlot(leadId: string, start: Date, o: {
  name: string; email: string; cfg: RadarConfig; summary?: string; now?: Date;
  save: (fields: Record<string, unknown>) => Promise<string>;
}): Promise<ReplyOutcome> {
  const now = o.now ?? new Date();
  const { data: lead } = await db().from("leads").select("company_name, signal_type, tier, why_now").eq("id", leadId).single();
  try {
    if (!(await isFree(start, o.cfg.meeting_minutes))) {
      const id = await o.save({ status: "needs_review", start_time: start.toISOString(), error: "you already have something in your calendar then" });
      await notifyLead({ leadId, kind: "inbound", source: "reply", company: lead!.company_name, signalType: lead!.signal_type, tier: lead!.tier,
        why: `They said yes to ${formatSlot(start)}, but your Google Calendar is busy then. Offer another time.` });
      return { status: "needs_review", message: `Your calendar is busy at ${formatSlot(start)}.`, meetingId: id };
    }
    const ev = await createEvent({
      title: meetingTitle(lead!.company_name, o.cfg.ngo_name),
      start, minutes: o.cfg.meeting_minutes, guestEmail: o.email, guestName: o.name,
      description: [`CSR partnership call with ${o.name} (${lead!.company_name}).`, lead!.why_now ?? "", o.cfg.ngo_outcome ? `Our outcome: ${o.cfg.ngo_outcome}` : ""].filter(Boolean).join("\n\n"),
    });
    const id = await o.save({ status: "booked", start_time: start.toISOString(), google_event_id: ev.id, event_link: ev.htmlLink, meet_link: ev.hangoutLink ?? null, error: null });
    await recordBooked(leadId, start, o.name, "in Google Calendar", now);
    return { status: "booked", message: `Booked ${formatSlot(start)} with ${o.name}. Google sent the invite${ev.hangoutLink ? " with a Meet link" : ""}.`, meetingId: id };
  } catch (e) {
    const id = await o.save({ status: "needs_review", start_time: start.toISOString(), error: (e as Error).message.slice(0, 300) });
    return { status: "needs_review", message: (e as Error).message, meetingId: id };
  }
}
