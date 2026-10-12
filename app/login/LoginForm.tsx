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
        <input name="passcode" type="password" autoComplete="current-password" required className="mt-1 w-full rounded-md bg-white px-3 py-2 ring-1 ring-stone-300" />
      </label>
      <button disabled={pending} className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Unlock</button>
      {state && !state.ok && <p role="alert" className="text-sm text-red-700">{state.message}</p>}
    </form>
  );
}
