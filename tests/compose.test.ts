import { describe, expect, it } from "vitest";
import { composeLinks, emailBodyFromDraft, linkedinNoteFromDraft } from "@/lib/compose";

const draft = "Hi Manoj,\n\nBharat Electronics moved Rs 75.21 crore & more.\n\nAnanya\n\n---\nLinkedIn note: Hello Manoj, short note.";

describe("compose", () => {
  it("separates the email from the LinkedIn note", () => {
    expect(emailBodyFromDraft(draft)).toBe("Hi Manoj,\n\nBharat Electronics moved Rs 75.21 crore & more.\n\nAnanya");
    expect(linkedinNoteFromDraft(draft)).toBe("Hello Manoj, short note.");
  });
  it("builds Gmail, Outlook and mailto links with everything encoded", () => {
    const l = composeLinks({ to: "a.b@bel-india.in", subject: "Rs 75.21 crore & next steps", body: emailBodyFromDraft(draft) });
    expect(l.gmail).toContain("to=a.b%40bel-india.in");
    expect(l.gmail).toContain("su=Rs%2075.21%20crore%20%26%20next%20steps");
    expect(decodeURIComponent(new URL(l.gmail).searchParams.get("body")!)).toContain("75.21 crore & more");
    expect(l.outlook.startsWith("https://outlook.office.com/mail/deeplink/compose?to=")).toBe(true);
    expect(l.mailto.startsWith("mailto:a.b@bel-india.in?subject=")).toBe(true);
    expect(l.mailto).not.toContain("LinkedIn note");
  });
  it("works without a known recipient", () => {
    expect(composeLinks({ to: null, subject: "s", body: "b" }).mailto).toBe("mailto:?subject=s&body=b");
  });
});
