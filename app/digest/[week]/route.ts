import { db } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// The published digest, exactly as emailed (already mobile friendly). "latest" = most recent week.
export async function GET(_: Request, { params }: { params: Promise<{ week: string }> }) {
  const { week } = await params;
  const q = db().from("digests").select("html");
  const { data } = week === "latest"
    ? await q.order("week", { ascending: false }).limit(1).maybeSingle()
    : /^\d{4}-W\d{2}$/.test(week) ? await q.eq("week", week).maybeSingle() : { data: null };
  if (!data) {
    return new Response("<!doctype html><meta name=viewport content='width=device-width'><p style='font-family:sans-serif;padding:16px'>No digest for that week yet. <a href='/'>Open the radar</a></p>", {
      status: 404, headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  return new Response(data.html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
