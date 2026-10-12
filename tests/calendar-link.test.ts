import { describe, expect, it } from "vitest";
import { googleCalendarLink, meetingTitle } from "@/lib/calendar-link";

describe("Google Calendar link", () => {
  const url = new URL(googleCalendarLink({
    title: meetingTitle("Bharat Electronics", "Welfare for Youth"),
    start: new Date("2026-10-13T15:00:00+05:30"), minutes: 20,
    details: "Agenda: operators for your sites & 84% retention", guests: ["a.b@bel.co.in", null],
  }));
  it("opens the add-event page", () => {
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
  });
  it("uses UTC times for 3 pm IST and the call length", () => expect(url.searchParams.get("dates")).toBe("20261013T093000Z/20261013T095000Z"));
  it("adds the guest, title and agenda", () => {
    expect(url.searchParams.get("add")).toBe("a.b@bel.co.in");
    expect(url.searchParams.get("text")).toBe("Welfare for Youth x Bharat Electronics: CSR partnership call");
    expect(url.searchParams.get("details")).toContain("84% retention");
    expect(url.searchParams.get("ctz")).toBe("Asia/Kolkata");
  });
});
