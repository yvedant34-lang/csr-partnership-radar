import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authUrl, googleConfigured } from "@/lib/gcal";
import { isAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

// Start the Google Calendar connection. Passcode holders only; a random state cookie guards the callback.
export async function GET() {
  if (!(await isAdmin())) redirect("/login?next=/settings");
  if (!googleConfigured()) redirect("/settings?google=not_configured");
  const state = randomBytes(24).toString("hex");
  (await cookies()).set("radar_google_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  redirect(authUrl(state));
}
