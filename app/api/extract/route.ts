import { after } from "next/server";
import { isCron } from "@/lib/auth";
import { extractBatch } from "@/lib/ingest";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// One batch of at most 20 items per invocation. ?chain=n re-invokes itself n-1 more times while items remain.
export async function GET(req: Request) {
  if (!isCron(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const chain = Math.max(1, Math.min(3, Number(url.searchParams.get("chain") ?? 1)));
  const result = await extractBatch();
  if (chain > 1 && result.remaining > 0) {
    after(async () => {
      await fetch(`${url.origin}/api/extract?chain=${chain - 1}`, { headers: { authorization: req.headers.get("authorization")! } });
    });
  }
  return Response.json({ ...result, chained: chain > 1 && result.remaining > 0 });
}
