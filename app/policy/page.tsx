import { getPolicies } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { showSample } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Policy() {
  const items = await getPolicies(await showSample());
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Policy and regulation: {items.length} item{items.length === 1 ? "" : "s"}</h1>
      {items.length === 0 && <p className="text-sm text-stone-600">No CSR policy changes found in the last runs.</p>}
      {items.map((p) => (
        <article key={p.id} className="rounded-lg bg-white p-4 ring-1 ring-stone-200">
          <p className="text-xs text-stone-500">{p.published_at ? formatDate(p.published_at) : ""} · {p.source_name}{p.is_synthetic ? " · Sample" : ""}</p>
          <h2 className="mt-0.5 font-semibold">{p.title}</h2>
          <p className="mt-1 text-sm text-stone-700">{p.summary}</p>
          <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-[8rem_1fr]">
            <dt className="text-stone-500">Impact on us</dt><dd>{p.impact_on_us ?? "Not stated"}</dd>
            <dt className="text-stone-500">Action</dt><dd className="font-medium">{p.action ?? "None needed"}</dd>
          </dl>
          {p.link?.startsWith("http") && <a href={p.link} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs underline">Source</a>}
        </article>
      ))}
    </div>
  );
}
