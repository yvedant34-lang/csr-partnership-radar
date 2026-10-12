import Link from "next/link";
import { SettingsForm } from "@/app/settings/SettingsForm";
import { getConfig, lushaCreditsThisMonth } from "@/lib/data";
import { isAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Settings() {
  const [cfg, admin, credits] = await Promise.all([getConfig(), isAdmin(), lushaCreditsThisMonth()]);
  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-stone-600">Every weight and rule the score uses. Gemini never sets the score or the tier.</p>
        {!admin && <p className="mt-1 text-sm"><Link href="/login?next=/settings" className="underline">Enter the passcode</Link> to change these.</p>}
      </div>
      <SettingsForm cfg={cfg} disabled={!admin} credits={credits} />
    </div>
  );
}
