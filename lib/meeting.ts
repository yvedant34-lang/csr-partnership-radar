// The first email always proposes a 20 minute call at 3 pm IST the next day (configurable).
// The slot is worked out when Ananya opens the draft to send it, not when the draft was written.
import { istParts } from "@/lib/week";

const IST_MS = 330 * 60_000;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MEETING_MARKER = "[[MEETING_ASK]]";

/** Next day at `hourIst`:00 IST (as a UTC Date). With skipWeekends, Saturday and Sunday move to Monday. */
export function nextDaySlot(from: Date, hourIst = 15, skipWeekends = false): Date {
  const p = istParts(from);
  let slot = new Date(Date.UTC(p.y, p.m - 1, p.d + 1, hourIst, 0) - IST_MS);
  if (skipWeekends) {
    const dow = istParts(slot).dow; // Mon=1..Sun=7
    if (dow === 6) slot = new Date(slot.getTime() + 2 * 86_400_000);
    if (dow === 7) slot = new Date(slot.getTime() + 86_400_000);
  }
  return slot;
}

export function formatSlot(slot: Date): string {
  const t = new Date(slot.getTime() + IST_MS);
  const h = t.getUTCHours(), m = t.getUTCMinutes();
  const time = `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`;
  return `${DAYS[t.getUTCDay()]} ${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]} at ${time} IST`;
}

export function meetingAsk(slot: Date, opts: { minutes?: number; schedulingUrl?: string | null; from?: Date } = {}): string {
  const from = opts.from ?? new Date();
  const tomorrow = istParts(new Date(from.getTime() + 86_400_000));
  const s = istParts(slot);
  const when = s.d === tomorrow.d && s.m === tomorrow.m ? `tomorrow, ${formatSlot(slot)}` : formatSlot(slot);
  const fallback = opts.schedulingUrl ? ` If another time suits you better, please pick one here: ${opts.schedulingUrl}` : "";
  return `Could we speak for ${opts.minutes ?? 20} minutes ${when}?${fallback}`;
}

/** Put the meeting ask into a draft: replace the marker, or place it just before the sign-off. */
export function withMeetingAsk(body: string, ask: string): string {
  if (body.includes(MEETING_MARKER)) return body.replace(MEETING_MARKER, ask);
  const lines = body.split("\n");
  const signOff = lines.findIndex((l) => /^\s*(ananya|best|regards|warm regards|thanks|thank you|sincerely)\b/i.test(l));
  if (signOff > 0) {
    // Drop an earlier generic ask in the paragraph above the sign-off, if there is one.
    const before = lines.slice(0, signOff).join("\n").replace(/\s*(Could|Would|Do|Can) (we|you)[^?]*\?\s*$/i, "").trimEnd();
    return `${before}\n\n${ask}\n\n${lines.slice(signOff).join("\n")}`;
  }
  return `${body.trimEnd()}\n\n${ask}`;
}
