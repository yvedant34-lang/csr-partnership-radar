"use client";

import { useMemo, useState } from "react";

// Weekly stage entries as lines. Stages are ordered, so one blue ramp (light = early stage,
// dark = won) rather than unrelated hues. Five series: a legend, no per-point numbers,
// a crosshair tooltip, and a table view for exact values.
const STAGES = [
  { key: "new", label: "Found", color: "#86b6ef" },
  { key: "contacted", label: "Contacted", color: "#5598e7" },
  { key: "meeting", label: "Meeting", color: "#2a78d6" },
  { key: "proposal", label: "Proposal", color: "#1c5cab" },
  { key: "won", label: "Won", color: "#0d366b" },
] as const;

type Key = (typeof STAGES)[number]["key"];

export interface ConversionData {
  labels: string[];
  weekStarts: string[];
  series: Record<Key, number[]>;
  totals: { found: number; contacted: number; meeting: number; won: number; lost: number; avgEstimate: number };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const short = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 330 * 60_000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "0%");

export function ConversionChart({ data, compact = false, measuredAfter = 50 }: { data: ConversionData; compact?: boolean; measuredAfter?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = compact ? 120 : 220;
  const pad = { l: 28, r: 12, t: 12, b: compact ? 8 : 26 };
  const n = data.labels.length;
  const max = useMemo(() => Math.max(1, ...STAGES.flatMap((s) => data.series[s.key])), [data]);
  const yMax = max <= 4 ? 4 : Math.ceil(max / 4) * 4; // multiple of 4 keeps the mid tick a whole number
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, n - 1);
  const y = (v: number) => H - pad.b - (v / yMax) * (H - pad.t - pad.b);
  const ticks = [0, yMax / 2, yMax];
  const closed = data.totals.won + data.totals.lost;

  return (
    <figure className="w-full">
      {!compact && (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600" aria-label="Legend">
          {STAGES.map((s) => (
            <li key={s.key} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded" style={{ background: s.color }} />{s.label}
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Leads entering each pipeline stage per week, last ${n} weeks`}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const px = ((e.clientX - r.left) / r.width) * W;
            const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (n - 1));
            setHover(Math.max(0, Math.min(n - 1, i)));
          }}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e7e5e4" strokeWidth={1} />
              <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" className="fill-stone-400" fontSize={10}>{t}</text>
            </g>
          ))}
          {!compact && data.weekStarts.map((w, i) => (i % 2 === (n - 1) % 2 ? (
            <text key={w} x={x(i)} y={H - 8} textAnchor={i === n - 1 ? "end" : i === 0 ? "start" : "middle"} className="fill-stone-400" fontSize={10}>{short(w)}</text>
          ) : null))}
          {STAGES.map((s) => (
            <polyline
              key={s.key}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={data.series[s.key].map((v, i) => `${x(i)},${y(v)}`).join(" ")}
            />
          ))}
          {hover != null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="#a8a29e" strokeWidth={1} strokeDasharray="3 3" />
              {STAGES.map((s) => (
                <circle key={s.key} cx={x(hover)} cy={y(data.series[s.key][hover])} r={4} fill={s.color} stroke="#fafaf9" strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
        {hover != null && (
          <div
            className="pointer-events-none absolute top-0 rounded-md bg-white px-2.5 py-2 text-xs shadow-md ring-1 ring-stone-200"
            style={{ left: `${Math.min(70, Math.max(0, (x(hover) / W) * 100 - 10))}%` }}
          >
            <div className="mb-1 font-medium text-stone-800">Week of {short(data.weekStarts[hover])}</div>
            {STAGES.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-4 text-stone-600">
                <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}</span>
                <span className="tabular-nums text-stone-900">{data.series[s.key][hover]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <figcaption className="mt-2 space-y-1 text-xs text-stone-600">
        <p>
          Found to contacted: <strong className="text-stone-900">{data.totals.contacted} of {data.totals.found}</strong> ({pct(data.totals.contacted, data.totals.found)})
          {" · "}to meeting: <strong className="text-stone-900">{data.totals.meeting}</strong>
          {" · "}won: <strong className="text-stone-900">{data.totals.won}</strong>
        </p>
        <p>
          Win rate: <strong className="text-stone-900">estimate {data.totals.avgEstimate.toFixed(1)}%</strong>, the average formula prior across open leads.
          It becomes a measured rate after {measuredAfter} closed outcomes ({closed} recorded so far).
        </p>
      </figcaption>
      {!compact && (
        <details className="mt-2 text-xs text-stone-600">
          <summary className="cursor-pointer">Table view</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left tabular-nums">
              <thead><tr><th className="pr-3 font-medium">Week of</th>{STAGES.map((s) => <th key={s.key} className="pr-3 font-medium">{s.label}</th>)}</tr></thead>
              <tbody>
                {data.weekStarts.map((w, i) => (
                  <tr key={w} className="border-t border-stone-100"><td className="pr-3">{short(w)}</td>{STAGES.map((s) => <td key={s.key} className="pr-3">{data.series[s.key][i]}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  );
}
