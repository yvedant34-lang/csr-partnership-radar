"use client";

import { useActionState, useState } from "react";
import { rescoreAction, saveSettings } from "@/app/actions";
import { ActionButton } from "@/app/components/ActionButton";
import type { RadarConfig } from "@/lib/config";

const SECTORS = ["Education", "Skill Development", "Digital Literacy", "Youth Employment"];
const GATES: { key: string; label: string }[] = [
  { key: "too_old", label: "Older than the age limit" },
  { key: "outside_footprint", label: "Outside our footprint" },
  { key: "partner_already_selected", label: "Partner already selected" },
  { key: "implemented_in_house", label: "Runs it in house" },
];
const SIGNALS: Record<string, string> = {
  partner_search: "Partner search", csr_tender_or_eoi: "Tender or EOI", new_initiative: "New initiative", unspent_csr: "Unspent CSR",
  new_csr_head: "New CSR head", event_or_vlog: "Interview or event", annual_report_mention: "Annual report", other: "Other",
};

function Slider({ name, label, value, max }: { name: string; label: string; value: number; max: number }) {
  const [v, setV] = useState(value);
  return (
    <label className="grid grid-cols-[9rem_1fr_2.5rem] items-center gap-2 text-sm">
      <span className="text-stone-700">{label}</span>
      <input type="range" name={name} min={0} max={max} value={v} onChange={(e) => setV(Number(e.target.value))} className="accent-stone-700" />
      <span className="text-right tabular-nums">{v}</span>
    </label>
  );
}

function Fieldset({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-2 rounded-lg bg-white p-4 ring-1 ring-stone-200">
      <legend className="px-1 text-sm font-semibold text-stone-800">{title}</legend>
      {children}
    </fieldset>
  );
}

export function SettingsForm({ cfg, disabled, credits }: { cfg: RadarConfig; disabled: boolean; credits: number }) {
  const [state, action, pending] = useActionState(saveSettings, null);
  return (
    <form action={action} className="space-y-4">
      <Fieldset title="Focus and footprint">
        <div className="flex flex-wrap gap-3 text-sm">
          {SECTORS.map((s) => (
            <label key={s} className="inline-flex items-center gap-1.5">
              <input type="checkbox" name="focus_sectors" value={s} defaultChecked={cfg.focus_sectors.includes(s)} className="accent-stone-700" />{s}
            </label>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Home city<input name="home_city" defaultValue={cfg.home_city} className="mt-1 w-full rounded-md px-2 py-1.5 ring-1 ring-stone-300" /></label>
          <label className="text-sm">Home state<input name="home_state" defaultValue={cfg.home_state} className="mt-1 w-full rounded-md px-2 py-1.5 ring-1 ring-stone-300" /></label>
        </div>
        <label className="block text-sm">Places that count as the home city (comma separated)
          <input name="home_city_aliases" defaultValue={cfg.home_city_aliases.join(", ")} className="mt-1 w-full rounded-md px-2 py-1.5 ring-1 ring-stone-300" />
        </label>
      </Fieldset>

      <Fieldset title="Signal weights">
        {Object.entries(cfg.signal_points).map(([k, v]) => <Slider key={k} name={`signal_${k}`} label={SIGNALS[k] ?? k} value={v} max={40} />)}
      </Fieldset>
      <Fieldset title="Sector, geography and budget weights">
        {Object.entries(cfg.sector_points).map(([k, v]) => <Slider key={k} name={`sector_${k}`} label={k} value={v} max={25} />)}
        <Slider name="geo_home_city" label="Home city" value={cfg.geo_points.home_city} max={30} />
        <Slider name="geo_home_state" label="Home state" value={cfg.geo_points.home_state} max={30} />
        <Slider name="geo_programme_in_home_state" label="Programme in home state" value={cfg.geo_points.programme_in_home_state} max={30} />
        <Slider name="geo_pan_india" label="Pan-India" value={cfg.geo_points.pan_india} max={30} />
        <Slider name="budget_unknown" label="Budget not stated" value={cfg.budget_points.unknown} max={20} />
        <Slider name="budget_under_1_cr" label="Under Rs 1 Cr" value={cfg.budget_points.under_1_cr} max={20} />
        <Slider name="budget_from_1_to_10_cr" label="Rs 1 to 10 Cr" value={cfg.budget_points.from_1_to_10_cr} max={20} />
        <Slider name="budget_over_10_cr" label="Rs 10 Cr or more" value={cfg.budget_points.over_10_cr} max={20} />
        <Slider name="partner_penalty" label="Partner chosen (minus)" value={cfg.partner_penalty} max={30} />
      </Fieldset>

      <Fieldset title="Tiers and hot gates">
        <Slider name="hot_min" label="Hot from" value={cfg.tiers.hot_min} max={100} />
        <Slider name="warm_min" label="Warm from" value={cfg.tiers.warm_min} max={100} />
        <p className="text-xs text-stone-500">A lead is hot only if it passes every gate below.</p>
        {GATES.map((g) => (
          <label key={g.key} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="gates" value={g.key} defaultChecked={cfg.gates.enabled.includes(g.key as never)} className="accent-stone-700" />{g.label}
          </label>
        ))}
        <Slider name="too_old_days" label="Age limit (days)" value={cfg.gates.too_old_days} max={60} />
      </Fieldset>

      <Fieldset title="Drafts and contacts">
        <label className="block text-sm">NGO name<input name="ngo_name" defaultValue={cfg.ngo_name} className="mt-1 w-full rounded-md px-2 py-1.5 ring-1 ring-stone-300" /></label>
        <label className="block text-sm">One real programme outcome to cite in emails
          <input name="ngo_outcome" defaultValue={cfg.ngo_outcome} placeholder="e.g. 7 of 10 learners in last year's batch were placed within 3 months" className="mt-1 w-full rounded-md px-2 py-1.5 ring-1 ring-stone-300" />
          <span className="text-xs text-stone-500">Left empty, drafts show a placeholder. Gemini is told never to invent numbers.</span>
        </label>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="text-stone-700">Find contacts in Lusha automatically for:</span>
          {(["hot", "warm", "cold"] as const).map((t) => (
            <label key={t} className="inline-flex items-center gap-1.5 capitalize">
              <input type="checkbox" name="lusha_auto_tiers" value={t} defaultChecked={cfg.lusha_auto_tiers.includes(t)} className="accent-stone-700" />{t}
            </label>
          ))}
        </div>
        <Slider name="lusha_monthly_cap" label="Lusha credits a month" value={cfg.lusha_monthly_cap} max={100} />
        <p className="text-xs text-stone-500">{credits} Lusha credits used this month. Email reveal 1 credit, phone 5 (phones are never revealed automatically).</p>
      </Fieldset>

      <div className="flex flex-wrap items-start gap-3">
        <button disabled={disabled || pending} className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{pending ? "Saving…" : "Save settings"}</button>
        <ActionButton action={rescoreAction} label="Rescore all leads" pendingLabel="Rescoring…" disabled={disabled} />
      </div>
      {state && <p role="status" className={`text-sm ${state.ok ? "text-stone-800" : "text-red-700"}`}>{state.message}</p>}
    </form>
  );
}
