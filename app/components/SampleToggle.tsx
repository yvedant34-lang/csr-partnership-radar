"use client";

import { useTransition } from "react";
import { toggleSample } from "@/app/actions";

export function SampleToggle({ on }: { on: boolean }) {
  const [pending, start] = useTransition();
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-stone-600">
      <input
        type="checkbox"
        checked={on}
        disabled={pending}
        onChange={(e) => start(() => toggleSample(e.target.checked))}
        className="h-3.5 w-3.5 accent-stone-700"
      />
      Sample data
    </label>
  );
}
