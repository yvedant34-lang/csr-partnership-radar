"use client";

import { useState, useTransition } from "react";
import { moveStage } from "@/app/actions";
import type { Stage } from "@/lib/data";

const STAGES: Stage[] = ["new", "contacted", "meeting", "proposal", "won", "lost", "parked"];
const LABEL: Record<Stage, string> = { new: "New", contacted: "Contacted", meeting: "Meeting", proposal: "Proposal", won: "Won", lost: "Lost", parked: "Parked" };

export function StageSelect({ leadId, stage, disabled }: { leadId: string; stage: Stage; disabled?: boolean }) {
  const [value, setValue] = useState(stage);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="text-fg-3">Stage</span>
      <select
        value={value}
        disabled={disabled || pending}
        onChange={(e) => {
          const next = e.target.value as Stage;
          setValue(next);
          start(async () => {
            const r = await moveStage(leadId, next);
            setMsg(r.ok ? null : r.message);
            if (!r.ok) setValue(stage);
          });
        }}
        className="rounded-md border border-line bg-surface px-2 py-1 text-fg disabled:opacity-60"
      >
        {STAGES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
      </select>
      {msg && <span className="text-xs text-hot">{msg}</span>}
    </label>
  );
}
