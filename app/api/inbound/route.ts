import { timingSafeEqual } from "node:crypto";
import { intake } from "@/lib/intake";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Real-time entry point for posts from any platform. Point an automation (Zapier, Make, IFTTT,
// a Google Alert or LinkedIn alert email parser) at:
//   POST /api/inbound   Authorization: Bearer <INBOUND_SECRET>
//   { "url": "...", "text": "post text (required for LinkedIn)", "title": "...", "source": "LinkedIn" }
// Each new lead lands on Ananya's dashboard as a notification with its next actions.
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
  const r = await intake({ url: str("url"), text: str("text"), title: str("title"), source: str("source"), via: "inbound" });
  if (!r.ok) return Response.json({ ok: false, message: r.message }, { status: 422 });
  return Response.json({ ok: true, outcome: r.outcome });
}
