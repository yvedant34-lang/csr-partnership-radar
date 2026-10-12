import { isCron } from "@/lib/auth";
import { runDigest } from "@/lib/digest";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Mondays 00:00 UTC (05:30 IST); Hobby crons fire within the hour, so it lands before 06:30 IST.
// ?force=1 resends a digest already sent this week. ?send=0 builds and saves without emailing.
export async function GET(req: Request) {
  if (!isCron(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const result = await runDigest({ send: url.searchParams.get("send") !== "0", force: url.searchParams.get("force") === "1" });
  return Response.json(result);
}
