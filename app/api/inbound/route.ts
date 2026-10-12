import { timingSafeEqual } from "node:crypto";
import { intake } from "@/lib/intake";
import { loadConfig } from "@/lib/pipeline";
import { handleReply } from "@/lib/replies";
import { db } from "@/lib/supabase/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Real-time entry point for posts from any platform. Point an automation (Zapier, Make, IFTTT,
// a Google Alert or LinkedIn alert email parser) at:
//   POST /api/inbound   Authorization: Bearer <INBOUND_SECRET>
//   { "url": "...", "text": "post text (required for LinkedIn)", "title": "...", "source": "LinkedIn" }
// Each new lead lands on Ananya's dashboard as a notification with its next actions.
//
// Replies to the first email (for example a Gmail filter forwarding to Zapier):
//   { "kind": "reply", "from": "name@company.com", "text": "Yes, 3 pm works", "lead_id": "<optional>" }
// A clear yes books the proposed 3 pm slot in Google Calendar; anything else waits for Ananya.
function authorised(req: Request) {
  const secret = process.env.INBOUND_SECRET || process.env.CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  return !!secret && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export async function POST(req: Request) {
  if (!authorised(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return Response.json({ error: "send JSON" }, { status: 400 }); }
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).slice(0, 20_000) : null);

  if (body.kind === "reply") {
    const text = str("text");
    const from = str("from");
    if (!text) return Response.json({ ok: false, message: "text is required" }, { status: 422 });
    let leadId = str("lead_id");
    const email = from?.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0]?.toLowerCase();
    if (!leadId && email) {
      const { data: c } = await db().from("lead_contacts").select("lead_id").ilike("email", email).limit(1).maybeSingle();
      const { data: m } = c ? { data: null } : await db().from("meetings").select("lead_id").ilike("invitee_email", email).order("created_at", { ascending: false }).limit(1).maybeSingle();
      leadId = c?.lead_id ?? m?.lead_id ?? null;
    }
    if (!leadId) return Response.json({ ok: false, message: "no lead matches that sender; send lead_id" }, { status: 404 });
    const r = await handleReply(leadId, text, await loadConfig(), { from });
    return Response.json({ ok: true, reply: r });
  }
  const r = await intake({ url: str("url"), text: str("text"), title: str("title"), source: str("source"), via: "inbound" });
  if (!r.ok) return Response.json({ ok: false, message: r.message }, { status: 422 });
  return Response.json({ ok: true, outcome: r.outcome });
}
