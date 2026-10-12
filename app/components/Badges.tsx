import type { Tier } from "@/lib/config";
import { STAGE_LABEL, TIER_STYLE } from "@/lib/ui";

export function TierBadge({ tier, score }: { tier: Tier; score?: number }) {
  const t = TIER_STYLE[tier];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide tabular ${t.badge}`}>
      {t.label}{score != null ? ` ${score}` : ""}
    </span>
  );
}

export function StageBadge({ stage }: { stage: string }) {
  return <span className="inline-flex whitespace-nowrap rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-fg-2">{STAGE_LABEL[stage] ?? stage}</span>;
}

export function SampleBadge() {
  return <span className="rounded bg-sample-bg px-1 text-[11px] text-sample">Sample</span>;
}

export function Kpi({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: Tier }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="label">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tracking-tight tabular ${tone ? TIER_STYLE[tone].text : "text-fg"}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-fg-3">{hint}</p>}
    </div>
  );
}

export function Card({ title, action, children, className = "" }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-surface ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-2 border-b border-line px-5 py-3">
          <h2 className="label">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
