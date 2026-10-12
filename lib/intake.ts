import "server-only";
import { extractArticleText, readArticle } from "@/lib/article";
import { loadConfig, processItem, type Outcome } from "@/lib/pipeline";

// One way in for anything that is not the daily RSS run: Paste a link, and the inbound webhook
// (Zapier, Make, IFTTT, Google Alerts or LinkedIn alert emails forwarded by an automation).
// LinkedIn pages are never fetched (their terms): LinkedIn posts must arrive as text.
export async function intake(input: { url?: string | null; text?: string | null; title?: string | null; source?: string | null; via: "paste" | "inbound" }):
  Promise<{ ok: true; outcome: Outcome } | { ok: false; message: string }> {
  const url = input.url?.trim() || "";
  const pasted = input.text?.trim() || "";
  if (!url && !pasted) return { ok: false, message: "Send a link, the post text, or both." };
  const isLinkedIn = /linkedin\.com/i.test(url) || /linkedin/i.test(input.source ?? "");

  let body = pasted;
  let sourceUrl: string | null = url || null;
  let title = input.title?.trim() || "";
  if (url && !isLinkedIn && !pasted) {
    if (/news\.google\.com/.test(url)) {
      const r = await readArticle(url);
      if (!r.text) return { ok: false, message: `Could not read that page (${r.error}). Send the text instead.` };
      body = r.text;
      sourceUrl = r.url;
    } else {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 CSRPartnershipRadar" }, signal: AbortSignal.timeout(12_000) });
      if (!res.ok) return { ok: false, message: `That page returned ${res.status}. Send the text instead.` };
      const page = extractArticleText(await res.text());
      if (page.text.length < 120) return { ok: false, message: "No readable text on that page. Send the text instead." };
      body = page.text;
      title = title || page.title || "";
    }
  }
  if (isLinkedIn && !pasted) return { ok: false, message: "LinkedIn pages are not fetched (their terms). Send the post text with the link." };
  if (!title) title = body.split(/\n|\. /)[0].slice(0, 160);

  let host = "Pasted text";
  try { if (url) host = new URL(url).hostname.replace(/^www\./, ""); } catch { /* keep default */ }
  const { outcome } = await processItem({
    title, body, link: url || "pasted text", source_url: sourceUrl,
    source_name: isLinkedIn ? "LinkedIn" : input.source || host,
    source_type: input.via === "inbound" ? "inbound" : isLinkedIn ? "linkedin" : "paste",
    published_at: new Date().toISOString(),
  }, await loadConfig());
  return { ok: true, outcome };
}
