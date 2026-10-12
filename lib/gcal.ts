import "server-only";
import { randomUUID } from "node:crypto";
import { appUrl } from "@/lib/digest";
import { db } from "@/lib/supabase/server";

// Google Calendar API (free). Optional: without a connection the app offers a one-click
// "Add to Google Calendar" link instead. With it, a clear yes is booked automatically:
// free/busy is checked, the event is created with a Google Meet link, and Google emails the invite.
//
// Setup (once, free): Google Cloud Console > APIs and services > enable Google Calendar API >
// OAuth consent screen (publishing status "In production" so the connection does not expire after 7 days) >
// Credentials > OAuth client ID (Web) with redirect URI <APP_URL>/api/google/callback.
// Put GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the environment, then press Connect in Settings.

const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
];

export const redirectUri = () => `${appUrl()}/api/google/callback`;
export const googleConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export function authUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

async function token(params: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID ?? "", client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "", ...params }),
    signal: AbortSignal.timeout(15_000),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`Google sign-in: ${j.error_description ?? j.error ?? res.status}`);
  return j as { access_token: string; refresh_token?: string; scope?: string; id_token?: string };
}

/** OAuth callback: swap the code for tokens and remember the refresh token. */
export async function connect(code: string) {
  const t = await token({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
  if (!t.refresh_token) throw new Error("Google did not return a refresh token. Remove the app at myaccount.google.com/permissions and connect again.");
  const who = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${t.access_token}` } }).then((r) => r.json()).catch(() => ({}));
  await db().from("integrations").upsert({
    provider: "google_calendar", account_email: who.email ?? null, refresh_token: t.refresh_token, scope: t.scope ?? SCOPES.join(" "),
    connected_at: new Date().toISOString(),
  });
  return who.email as string | undefined;
}

export async function connection() {
  const { data } = await db().from("integrations").select("account_email, connected_at").eq("provider", "google_calendar").maybeSingle();
  return data as { account_email: string | null; connected_at: string } | null;
}

export async function disconnect() {
  await db().from("integrations").delete().eq("provider", "google_calendar");
}

async function accessToken(): Promise<string> {
  const { data } = await db().from("integrations").select("refresh_token").eq("provider", "google_calendar").maybeSingle();
  if (!data?.refresh_token) throw new Error("Google Calendar is not connected (Settings).");
  return (await token({ refresh_token: data.refresh_token, grant_type: "refresh_token" })).access_token;
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`Google Calendar ${res.status}: ${j.error?.message ?? "request failed"}`);
  return j as T;
}

/** True when Ananya's primary calendar has nothing in [start, start + minutes). */
export async function isFree(start: Date, minutes: number): Promise<boolean> {
  const end = new Date(start.getTime() + minutes * 60_000);
  const r = await api<{ calendars: Record<string, { busy: { start: string; end: string }[] }> }>("/freeBusy", {
    method: "POST",
    body: JSON.stringify({ timeMin: start.toISOString(), timeMax: end.toISOString(), timeZone: "Asia/Kolkata", items: [{ id: "primary" }] }),
  });
  return (r.calendars.primary?.busy ?? []).length === 0;
}

export interface CalendarEvent { id: string; htmlLink: string; hangoutLink?: string }

/** Create the event with a Meet link and email the invite to the guest (sendUpdates=all). */
export async function createEvent(input: { title: string; start: Date; minutes: number; description: string; guestEmail: string; guestName?: string }): Promise<CalendarEvent> {
  const end = new Date(input.start.getTime() + input.minutes * 60_000);
  return api<CalendarEvent>("/calendars/primary/events?sendUpdates=all&conferenceDataVersion=1", {
    method: "POST",
    body: JSON.stringify({
      summary: input.title,
      description: input.description,
      start: { dateTime: input.start.toISOString(), timeZone: "Asia/Kolkata" },
      end: { dateTime: end.toISOString(), timeZone: "Asia/Kolkata" },
      attendees: [{ email: input.guestEmail, displayName: input.guestName }],
      conferenceData: { createRequest: { requestId: randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } },
      reminders: { useDefault: true },
    }),
  });
}
