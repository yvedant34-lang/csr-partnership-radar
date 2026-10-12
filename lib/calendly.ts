import "server-only";

// Calendly API v2 with a personal access token (CALENDLY_API_KEY). Booking uses the Scheduling API
// (POST /invitees, scope scheduled_events:write), which needs a Standard plan or above.
const API = "https://api.calendly.com";

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = process.env.CALENDLY_API_KEY;
  if (!token) throw new Error("Calendly is not connected: add CALENDLY_API_KEY.");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text.slice(0, 200);
    try {
      const j = JSON.parse(text);
      msg = [j.title, j.message, ...(j.details ?? []).map((d: { message?: string }) => d.message)].filter(Boolean).join(": ");
    } catch { /* keep raw */ }
    if (res.status === 403) msg += " (booking through the API needs a Calendly Standard plan or above)";
    throw new Error(`Calendly ${res.status}: ${msg}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export interface CalendlyUser { uri: string; name: string; email: string; scheduling_url: string; timezone: string }
export interface CalendlyEventType { uri: string; name: string; duration: number; scheduling_url: string; active: boolean; kind: string }

export async function me(): Promise<CalendlyUser> {
  return (await call<{ resource: CalendlyUser }>("/users/me")).resource;
}

export async function eventTypes(): Promise<CalendlyEventType[]> {
  const user = await me();
  const r = await call<{ collection: CalendlyEventType[] }>(`/event_types?user=${encodeURIComponent(user.uri)}&active=true&count=50`);
  return r.collection;
}

/** Is this exact start time bookable on the event type? */
export async function isAvailable(eventTypeUri: string, start: Date): Promise<boolean> {
  const from = new Date(start.getTime() - 60_000);
  const to = new Date(start.getTime() + 60 * 60_000);
  const r = await call<{ collection: { start_time: string; status: string }[] }>(
    `/event_type_available_times?event_type=${encodeURIComponent(eventTypeUri)}&start_time=${from.toISOString()}&end_time=${to.toISOString()}`,
  );
  return r.collection.some((s) => s.status === "available" && Math.abs(new Date(s.start_time).getTime() - start.getTime()) < 60_000);
}

export interface Booking { uri: string; event: string; reschedule_url: string; cancel_url: string; status: string }

export async function book(input: { eventTypeUri: string; start: Date; name: string; email: string; timezone?: string }): Promise<Booking> {
  const r = await call<{ resource: Booking }>("/invitees", {
    method: "POST",
    body: JSON.stringify({
      event_type: input.eventTypeUri,
      start_time: input.start.toISOString(),
      invitee: { name: input.name, email: input.email, timezone: input.timezone ?? "Asia/Kolkata" },
      tracking: { utm_source: "csr-radar", utm_campaign: "first-email" },
    }),
  });
  return r.resource;
}
