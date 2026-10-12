"use client";

import { useState } from "react";

// A lead's life cycle as a step line: x = time, y = stage, ranked from Ghosted (lowest)
// to Invoice signed (highest). One point per stage change; the line runs on to today.
export const LIFECYCLE = [
  { key: "ghosted", label: "Ghosted" },
  { key: "lost", label: "Lost" },
  { key: "parked", label: "Parked" },
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "meeting", label: "Meeting" },
  { key: "proposal", label: "Proposal" },
  { key: "won", label: "Won" },
  { key: "invoice_signed", label: "Invoice signed" },
] as const;

const level = (stage: string) => Math.max(0, LIFECYCLE.findIndex((s) => s.key === stage));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const short = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 330 * 60_000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

export function LifecycleChart({ events, now }: { events: { stage: string; at: string }[]; now: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const pts = [...events].sort((a, b) => +new Date(a.at) - +new Date(b.at));
  if (!pts.length) return <p className="text-sm text-fg-3">No stage history yet.</p>;

  const W = 600, H = 270, pad = { l: 104, r: 16, t: 12, b: 26 };
  const t0 = +new Date(pts[0].at);
  const t1 = Math.max(+new Date(now), t0 + 86_400_000);
  const x = (t: number) => pad.l + ((t - t0) / (t1 - t0)) * (W - pad.l - pad.r);
  const y = (lvl: number) => H - pad.b - (lvl / (LIFECYCLE.length - 1)) * (H - pad.t - pad.b);

  // Step path: hold each stage until the next change, then on to today.
  let d = "";
  pts.forEach((p, i) => {
    const px = x(+new Date(p.at)), py = y(level(p.stage));
    d += i === 0 ? `M${px},${py}` : `H${px}V${py}`;
  });
  d += `H${x(t1)}`;
  const current = pts[pts.length - 1];
  const up = level(current.stage) >= level("new");

  return (
    <figure>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
          aria-label={`Life cycle: ${pts.map((p) => LIFECYCLE[level(p.stage)].label).join(", then ")}. Now ${LIFECYCLE[level(current.stage)].label}.`}>
          {LIFECYCLE.map((s, i) => (
            <g key={s.key}>
              <line x1={pad.l} x2={W - pad.r} y1={y(i)} y2={y(i)} stroke="var(--line)" strokeWidth={1} strokeDasharray={s.key === "new" ? "4 4" : undefined} />
              <text x={pad.l - 10} y={y(i) + 4} textAnchor="end" fontSize={12.5}
                fill={s.key === current.stage ? "var(--fg)" : "var(--fg-3)"} fontWeight={s.key === current.stage ? 600 : 400}>{s.label}</text>
            </g>
          ))}
          <text x={pad.l} y={H - 6} fontSize={11.5} fill="var(--fg-3)">{short(pts[0].at)}</text>
          <text x={W - pad.r} y={H - 6} fontSize={11.5} fill="var(--fg-3)" textAnchor="end">Today</text>
          <path d={d} fill="none" stroke={up ? "var(--chart-3)" : "var(--hot)"} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {pts.map((p, i) => (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <circle cx={x(+new Date(p.at))} cy={y(level(p.stage))} r={12} fill="transparent" />
              <circle cx={x(+new Date(p.at))} cy={y(level(p.stage))} r={i === pts.length - 1 ? 6 : 4.5}
                fill={up ? "var(--chart-3)" : "var(--hot)"} stroke="var(--surface)" strokeWidth={2} />
            </g>
          ))}
        </svg>
        {hover != null && (
          <div className="pointer-events-none absolute rounded-2xl border border-line bg-surface px-2.5 py-1.5 text-xs shadow-lg"
            style={{ left: `${Math.min(75, (x(+new Date(pts[hover].at)) / W) * 100)}%`, top: `${(y(level(pts[hover].stage)) / H) * 100 - 18}%` }}>
            <span className="font-medium text-fg">{LIFECYCLE[level(pts[hover].stage)].label}</span>
            <span className="text-fg-3"> · {short(pts[hover].at)}</span>
          </div>
        )}
      </div>
      <figcaption className="mt-1 text-xs text-fg-3">
        {pts.length} stage {pts.length === 1 ? "event" : "events"} · now <span className="text-fg">{LIFECYCLE[level(current.stage)].label}</span> since {short(current.at)}.
        Higher is closer to a signed invoice; Ghosted is the lowest.
      </figcaption>
    </figure>
  );
}
