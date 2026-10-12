import { describe, expect, it } from "vitest";
import { formatDate, formatDateTimeIst, formatInr } from "@/lib/format";
import { comingMonday, isActionPlanSeason, isoWeek, weekLabelToDate, weekStartIst } from "@/lib/week";

describe("week (IST)", () => {
  it("12 Oct 2026 is ISO week 42", () => expect(isoWeek(new Date("2026-10-12T18:00:00+05:30"))).toBe("2026-W42"));
  it("Sunday 23:30 IST is still the previous week", () =>
    expect(isoWeek(new Date("2026-10-11T23:30:00+05:30"))).toBe("2026-W41"));
  it("Monday 00:10 IST is the new week even though it is Sunday in UTC", () =>
    expect(isoWeek(new Date("2026-10-12T00:10:00+05:30"))).toBe("2026-W42"));
  it("coming Monday from a Monday is the same day", () => expect(comingMonday(new Date("2026-10-12T05:00:00+05:30"))).toBe("2026-10-12"));
  it("coming Monday from a Wednesday", () => expect(comingMonday(new Date("2026-10-14T20:00:00+05:30"))).toBe("2026-10-19"));
  it("coming Monday from Sunday late night IST", () => expect(comingMonday(new Date("2026-10-18T23:59:00+05:30"))).toBe("2026-10-19"));
  it("week start is Monday 00:00 IST", () =>
    expect(weekStartIst(new Date("2026-10-15T10:00:00+05:30")).toISOString()).toBe("2026-10-11T18:30:00.000Z"));
  it("week label round trip", () => expect(weekLabelToDate("2026-W42")!.toISOString()).toBe("2026-10-11T18:30:00.000Z"));
  it("action plan season is Jan to Mar", () => {
    expect(isActionPlanSeason(new Date("2027-02-01T10:00:00+05:30"))).toBe(true);
    expect(isActionPlanSeason(new Date("2026-10-12T10:00:00+05:30"))).toBe(false);
  });
});

describe("format", () => {
  it("crore", () => expect(formatInr(8.86)).toBe("Rs 8.86 Cr"));
  it("lakh", () => expect(formatInr(0.4995)).toBe("Rs 49.95 lakh"));
  it("round lakh", () => expect(formatInr(0.28)).toBe("Rs 28 lakh"));
  it("unknown budget", () => expect(formatInr(null)).toBe("Not stated"));
  it("date", () => expect(formatDate("2026-09-15T00:00:00+05:30")).toBe("15 Sep 2026"));
  it("date and IST time", () => expect(formatDateTimeIst("2026-10-11T23:34:00Z")).toBe("12 Oct 2026, 05:04 IST"));
});
