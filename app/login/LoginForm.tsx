"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <label className="block text-sm">
        <span className="font-medium">Passcode</span>
        <input name="passcode" type="password" autoComplete="current-password" required className="mt-1 w-full rounded-md bg-surface px-3 py-2 border border-line" />
      </label>
      <button disabled={pending} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg disabled:opacity-50">Unlock</button>
      {state && !state.ok && <p role="alert" className="text-sm text-hot">{state.message}</p>}
    </form>
  );
}
