import { formatDateTimeIst } from "@/lib/format";

type Run = { finished_at: string | null; started_at: string; feeds_ok: number; feeds_total: number; feeds_failed: number; items_fetched: number; items_relevant: number; errors: { lane: string; error: string }[] } | null;

export function CoverageStrip({ run, queued }: { run: Run; queued: number }) {
  if (!run) return <p className="text-xs text-stone-500">No ingestion run yet. The daily run is at 05:00 IST.</p>;
  const failed = run.feeds_failed > 0;
  return (
    <details className="text-xs text-stone-600">
      <summary className="cursor-pointer list-none">
        <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${failed ? "bg-amber-500" : "bg-emerald-600"}`} aria-hidden />
        Last run {formatDateTimeIst(run.finished_at ?? run.started_at)} · {run.feeds_ok} of {run.feeds_total} feeds
        {failed ? ` (${run.feeds_failed} failed)` : ""} · {run.items_fetched} items · {run.items_relevant} past the filter
        {queued > 0 ? ` · ${queued} waiting for Gemini` : ""}
      </summary>
      <div className="mt-2 rounded-md bg-white p-3 ring-1 ring-stone-200">
        <p>Google News RSS, 9 search lanes, last 7 days, India edition. Gemini reads the full article where the publisher allows it; otherwise the lead is marked headline only.</p>
        {failed && <ul className="mt-1 list-disc pl-4">{run.errors.map((e) => <li key={e.lane}>{e.lane}: {e.error}</li>)}</ul>}
      </div>
    </details>
  );
}
