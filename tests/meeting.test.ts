import { describe, expect, it } from "vitest";
import { formatSlot, meetingAsk, nextDaySlot, withMeetingAsk } from "@/lib/meeting";

describe("meeting slot", () => {
  it("is 3 pm IST the next day", () => {
    const slot = nextDaySlot(new Date("2026-10-12T22:30:00+05:30"));
    expect(slot.toISOString()).toBe("2026-10-13T09:30:00.000Z");
    expect(formatSlot(slot)).toBe("Tuesday 13 Oct at 3 pm IST");
  });
  it("uses the IST date even late at night UTC", () => {
    expect(nextDaySlot(new Date("2026-10-12T00:10:00+05:30")).toISOString()).toBe("2026-10-13T09:30:00.000Z");
  });
  it("can skip weekends", () => {
    expect(formatSlot(nextDaySlot(new Date("2026-10-16T10:00:00+05:30"), 15, true))).toBe("Monday 19 Oct at 3 pm IST");
    expect(formatSlot(nextDaySlot(new Date("2026-10-16T10:00:00+05:30"), 15, false))).toBe("Saturday 17 Oct at 3 pm IST");
  });
  it("asks for tomorrow with the booking page fallback", () => {
    const from = new Date("2026-10-12T22:30:00+05:30");
    expect(meetingAsk(nextDaySlot(from), { from, schedulingUrl: "https://calendar.app.google/abc123" }))
      .toBe("Could we speak for 20 minutes tomorrow, Tuesday 13 Oct at 3 pm IST? If another time suits you better, please pick one here: https://calendar.app.google/abc123");
  });
  it("replaces the marker, or replaces the old ask before the sign-off", () => {
    expect(withMeetingAsk("Hi.\n\n[[MEETING_ASK]]\n\nAnanya", "ASK")).toBe("Hi.\n\nASK\n\nAnanya");
    expect(withMeetingAsk("Hi Manoj.\n\nCould we have a 20 minute call next week?\n\nAnanya, Head", "ASK")).toBe("Hi Manoj.\n\nASK\n\nAnanya, Head");
    expect(withMeetingAsk("No sign off here.", "ASK")).toBe("No sign off here.\n\nASK");
  });
});
