import Link from "next/link";
import { SettingsForm } from "@/app/settings/SettingsForm";
import { eventTypes, me } from "@/lib/calendly";
import { getConfig, lushaCreditsThisMonth } from "@/lib/data";
import { isAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Settings() {
  const [cfg, admin, credits] = await Promise.all([getConfig(), isAdmin(), lushaCreditsThisMonth()]);
  let calendly: { connected: boolean; user?: string; error?: string; types: { uri: string; name: string; duration: number; url: string }[] } = { connected: false, types: [] };
  if (process.env.CALENDLY_API_KEY) {
    try {
      const [u, types] = await Promise.all([me(), eventTypes()]);
      calendly = { connected: true, user: `${u.name} (${u.email})`, types: types.map((t) => ({ uri: t.uri, name: t.name, duration: t.duration, url: t.scheduling_url })) };
    } catch (e) {
      calendly = { connected: false, error: (e as Error).message, types: [] };
    }
  }
  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-fg-2">Every weight and rule the score uses. Gemini never sets the score or the tier.</p>
        {!admin && <p className="mt-1 text-sm"><Link href="/login?next=/settings" className="underline">Enter the passcode</Link> to change these.</p>}
      </div>
      <SettingsForm cfg={cfg} disabled={!admin} credits={credits} calendly={calendly} />
    </div>
  );
}
