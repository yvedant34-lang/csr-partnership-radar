// Free, no-API meeting booking: a Google Calendar "add event" link with the time, agenda and guest
// filled in. Ananya clicks Save in her own calendar and Google sends the invite.

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

export function googleCalendarLink(input: {
  title: string; start: Date; minutes: number; details?: string; guests?: (string | null | undefined)[]; location?: string;
}): string {
  const end = new Date(input.start.getTime() + input.minutes * 60_000);
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates: `${stamp(input.start)}/${stamp(end)}`,
    ctz: "Asia/Kolkata",
  });
  if (input.details) p.set("details", input.details);
  if (input.location) p.set("location", input.location);
  const guests = (input.guests ?? []).filter(Boolean) as string[];
  if (guests.length) p.set("add", guests.join(","));
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export function meetingTitle(company: string, ngo: string): string {
  return `${ngo} x ${company}: CSR partnership call`;
}
