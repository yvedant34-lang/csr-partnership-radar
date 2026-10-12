import Link from "next/link";
import { SettingsForm } from "@/app/settings/SettingsForm";
import { connection, googleConfigured, redirectUri } from "@/lib/gcal";
import { getConfig, lushaCreditsThisMonth } from "@/lib/data";
import { isAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Settings({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const { google: googleResult } = await searchParams;
  const [cfg, admin, credits] = await Promise.all([getConfig(), isAdmin(), lushaCreditsThisMonth()]);
  const conn = await connection();
  const google = { configured: googleConfigured(), connected: !!conn, account: conn?.account_email ?? null, redirect: redirectUri() };
  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-fg-2">Every weight and rule the score uses. Gemini never sets the score or the tier.</p>
        {!admin && <p className="mt-1 text-sm"><Link href="/login?next=/settings" className="underline">Enter the passcode</Link> to change these.</p>}
      </div>
      {googleResult && (
        <p className={`rounded-xl border px-4 py-2 text-sm ${googleResult === "connected" ? "border-good text-good" : "border-warm text-warm"}`}>
          {googleResult === "connected" ? "Google Calendar connected." : googleResult === "not_configured" ? "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first (see below)." : `Google Calendar: ${googleResult}`}
        </p>
      )}
      <SettingsForm cfg={cfg} disabled={!admin} credits={credits} google={google} />
    </div>
  );
}
