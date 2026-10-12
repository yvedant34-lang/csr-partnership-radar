import { describe, expect, it } from "vitest";
import { nextFyLabel, renderHtml, renderText, type DigestPayload } from "@/lib/digest";

const base: DigestPayload = {
  week: "2026-W42", weekOf: "12 Oct", subject: "CSR Radar, week of 12 Oct: 0 calls, 1 to warm up, 0 policy items",
  hot: [], warm: [{ id: "x", company: "BASF India", tier: "warm", score: 70, line: "Unspent CSR · Nashik", why: "Rs 8.86 Cr unspent, no partner named.", contact: "Bahram Vakil", estimate: "20.6%" }],
  funders: [{ id: "f", company: "Sona Comstar", place: "Chakan, Pune", note: "" }], policy: [], tasks: [],
  coverage: "9 of 9 feeds ran · 115 items", nextFy: "FY28", url: "https://radar.example",
};

describe("digest", () => {
  it("says so plainly when there are no calls", () => {
    expect(renderText(base)).toContain("None this week. Paste any LinkedIn calls you have seen.");
    expect(renderHtml(base)).toContain("No calls this week.");
  });
  it("links each lead to the radar", () => expect(renderText(base)).toContain("https://radar.example/?lead=x"));
  it("escapes HTML in lead text", () => {
    const html = renderHtml({ ...base, warm: [{ ...base.warm[0], company: "A <b>B</b>" }] });
    expect(html).toContain("A &lt;b&gt;B&lt;/b&gt;");
  });
  it("labels the next financial year (April to March)", () => {
    expect(nextFyLabel(new Date("2026-10-12T06:00:00+05:30"))).toBe("FY28");
    expect(nextFyLabel(new Date("2027-02-01T06:00:00+05:30"))).toBe("FY28");
    expect(nextFyLabel(new Date("2027-04-02T06:00:00+05:30"))).toBe("FY29");
  });
});
