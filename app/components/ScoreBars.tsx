import type { RadarConfig } from "@/lib/config";
import type { Lead } from "@/lib/data";

/** The five parts of the score, each against its maximum in radar_config. */
export function ScoreBars({ lead, cfg }: { lead: Lead; cfg: RadarConfig }) {
  const parts = [
    { label: "Signal", v: lead.score_signal, max: Math.max(...Object.values(cfg.signal_points)) },
    { label: "Recency", v: lead.score_recency, max: Math.max(...cfg.recency_buckets.map((b) => b.points)) },
    { label: "Sector", v: lead.score_sector_fit, max: Math.max(...Object.values(cfg.sector_points)) },
    { label: "Geography", v: lead.score_geo_fit, max: Math.max(...Object.values(cfg.geo_points)) },
    { label: "Budget", v: lead.score_budget_fit, max: Math.max(...Object.values(cfg.budget_points)) },
  ];
  const penalty = lead.flags.includes("partner_already_selected") || lead.flags.includes("implemented_in_house") ? cfg.partner_penalty : 0;
  return (
    <div className="space-y-1.5">
      {parts.map((p) => (
        <div key={p.label} className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-2 text-xs">
          <span className="text-stone-600">{p.label}</span>
          <span className="h-2 rounded-full bg-stone-100">
            <span className="block h-2 rounded-full bg-stone-700" style={{ width: `${(p.v / p.max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums text-stone-800">{p.v}/{p.max}</span>
        </div>
      ))}
      {penalty > 0 && (
        <p className="text-xs text-stone-600">Minus {penalty}: {lead.flags.includes("implemented_in_house") ? "runs it in house" : "partner already selected"}.</p>
      )}
    </div>
  );
}
