import { after } from "next/server";
import { isCron } from "@/lib/auth";
import { ingest } from "@/lib/ingest";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Daily at 23:30 UTC (05:00 IST). Fetches feeds, then hands extraction to up to 3 separate invocations.
export async function GET(req: Request) {
  if (!isCron(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const result = await ingest();
  const origin = new URL(req.url).origin;
  after(async () => {
    await fetch(`${origin}/api/extract?chain=3`, { headers: { authorization: req.headers.get("authorization")! } });
  });
  return Response.json(result);
}

