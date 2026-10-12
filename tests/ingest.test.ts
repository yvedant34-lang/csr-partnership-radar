import { describe, expect, it } from "vitest";
import { pocFromSource } from "@/lib/poc";
import { prefilter } from "@/lib/prefilter";
import { normaliseTitle, parseFeed } from "@/lib/rss";

const XML = `<?xml version="1.0"?><rss><channel>
<item><title>Zeta inaugurates Hyderabad skilling centre to help underprivileged youth - Newspatrolling</title>
<link>https://news.google.com/rss/articles/CBMiABC?oc=5</link><pubDate>Mon, 12 Oct 2026 04:00:00 GMT</pubDate>
<description>&lt;a href="https://news.google.com/rss/articles/CBMiABC"&gt;Zeta inaugurates Hyderabad skilling centre to help underprivileged youth&lt;/a&gt;&amp;nbsp;&amp;nbsp;&lt;font color="#6f6f6f"&gt;Newspatrolling&lt;/font&gt;</description>
<source url="https://newspatrolling.com">Newspatrolling</source></item>
</channel></rss>`;

describe("rss", () => {
  const [item] = parseFeed("skilling_centre", XML);
  it("strips the source suffix from the title", () => expect(item.title).toBe("Zeta inaugurates Hyderabad skilling centre to help underprivileged youth"));
  it("keeps the Google redirect link as is", () => expect(item.link).toBe("https://news.google.com/rss/articles/CBMiABC?oc=5"));
  it("drops a snippet that only repeats the headline", () => expect(item.snippet).toBeNull());
  it("reads source and date", () => {
    expect(item.source_name).toBe("Newspatrolling");
    expect(item.published_at).toBe("2026-10-12T04:00:00.000Z");
  });
  it("normalises titles for dedupe", () =>
    expect(normaliseTitle("Zeta’s  Skilling-Centre!")).toBe(normaliseTitle("zeta's skilling centre")));
});

describe("prefilter", () => {
  it("passes CSR skilling news", () => expect(prefilter("Zeta inaugurates skilling centre for youth under CSR").pass).toBe(true));
  it("passes unspent CSR", () => expect(prefilter("Bharat Electronics transfers Rs 75 crore to Unspent CSR Account").pass).toBe(true));
  it("passes CSR spend with no sector named", () => expect(prefilter("Bhansali Engineering Polymers spends Rs 9.42 crore on CSR in FY 2025-26").pass).toBe(true));
  it("drops sport", () => expect(prefilter("Sourav Ganguly appointed head coach of Delhi Capitals for IPL 2027").pass).toBe(false));
  it("drops foreign CSR", () => expect(prefilter("407 graduate as MTN Foundation digital skills programme expands in Uganda").pass).toBe(false));
  it("passes policy", () => expect(prefilter("MCA notifies CSR rules amendment").pass).toBe(true));
});

describe("contacts come only from the source text", () => {
  const ex = (poc_name: string | null) => ({ poc_name, poc_designation: "President" });
  it("keeps a name that is in the text", () =>
    expect(pocFromSource(ex("Sivaram Kowta"), "Sivaram Kowta, President, Zeta India, said").name).toBe("Sivaram Kowta"));
  it("drops a name that is not in the text", () =>
    expect(pocFromSource(ex("Rahul Sharma"), "Zeta inaugurates Hyderabad skilling centre")).toEqual({ name: null, designation: null }));
  it("drops the designation with the name", () => expect(pocFromSource(ex(null), "anything").designation).toBeNull());
});
