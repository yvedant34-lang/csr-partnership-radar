// Reads the real article behind a Google News RSS link so Gemini analyses the full story,
// not the headline. The Google redirect link is still what we store as post_link.
// Google News decoding uses the same unofficial endpoint the news.google.com page calls;
// if it changes, we fall back to headline-only extraction (marked low confidence).

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";

export function googleArticleId(link: string): string | null {
  const m = /news\.google\.com\/(?:rss\/)?articles\/([^?/#]+)/.exec(link);
  return m ? m[1] : null;
}

/** Resolve a news.google.com/rss/articles/<id> link to the publisher URL. */
export async function resolveGoogleNewsUrl(link: string, timeoutMs = 10_000): Promise<string | null> {
  const id = googleArticleId(link);
  if (!id) return link;
  const page = await fetch(`https://news.google.com/rss/articles/${id}`, {
    headers: { "User-Agent": UA }, signal: AbortSignal.timeout(timeoutMs), redirect: "follow",
  });
  const html = await page.text();
  const sg = /data-n-a-sg="([^"]+)"/.exec(html)?.[1];
  const ts = /data-n-a-ts="([^"]+)"/.exec(html)?.[1];
  if (!sg || !ts) return null;
  const inner = `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${id}",${ts},"${sg}"]`;
  const body = "f.req=" + encodeURIComponent(JSON.stringify([[["Fbv4je", inner, null, "generic"]]]));
  const res = await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "User-Agent": UA },
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  const json = text.replace(/^\)\]\}'\s*/, "").split("\n\n")[0];
  try {
    const outer = JSON.parse(json);
    const payload = JSON.parse(outer[0][2]);
    const url = payload?.[1];
    return typeof url === "string" && url.startsWith("http") ? url : null;
  } catch {
    return null;
  }
}

const ENTITIES: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&lt;": "<", "&gt;": ">", "&rsquo;": "'", "&lsquo;": "'", "&ldquo;": '"', "&rdquo;": '"', "&ndash;": "-", "&mdash;": "-", "&#8217;": "'", "&#8216;": "'", "&#8220;": '"', "&#8221;": '"', "&#8211;": "-", "&#8377;": "Rs " };

function decode(s: string): string {
  return s.replace(/&[#a-z0-9]+;/gi, (e) => ENTITIES[e.toLowerCase()] ?? (e.startsWith("&#") ? String.fromCharCode(Number(e.slice(2, -1)) || 32) : " "));
}

/** Main text of an article page: paragraphs inside <article> if present, else all <p>. */
export function extractArticleText(html: string): { title: string | null; text: string } {
  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(nav|header|footer|aside|form)[\s\S]*?<\/\1>/gi, " ");
  const title = decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? "") || null;
  const paragraphs = (scope: string) => [...scope.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => decode(m[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 40 && !/cookie|subscribe|newsletter|all rights reserved|follow us/i.test(p))
    .join("\n");
  const article = /<article[\s\S]*?<\/article>/i.exec(clean)?.[0];
  let text = article ? paragraphs(article) : "";
  if (text.length < 200) text = paragraphs(clean);
  if (text.length < 200) {
    // JSON-LD articleBody, then the page description.
    const ld = [...html.matchAll(/"articleBody"\s*:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => {
      try { return JSON.parse(`"${m[1]}"`) as string; } catch { return ""; }
    }).join("\n");
    if (ld.length > text.length) text = decode(ld.replace(/<[^>]+>/g, " "));
  }
  if (text.length < 200) {
    const desc = /<meta[^>]+(?:property="og:description"|name="description")[^>]+content="([^"]+)"/i.exec(html)?.[1];
    if (desc && desc.length > text.length) text = decode(desc);
  }
  return { title, text: text.slice(0, 15_000) };
}

export interface ArticleResult {
  url: string | null; // publisher URL
  text: string | null;
  error?: string;
}

/** Never fetches LinkedIn (terms of service): those come in through Paste a link as text. */
export async function readArticle(link: string, timeoutMs = 12_000): Promise<ArticleResult> {
  try {
    const url = await resolveGoogleNewsUrl(link, timeoutMs);
    if (!url) return { url: null, text: null, error: "could not resolve Google News link" };
    if (/linkedin\.com/i.test(url)) return { url, text: null, error: "LinkedIn is not fetched" };
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
    if (!res.ok) return { url, text: null, error: `publisher HTTP ${res.status}` };
    const { text } = extractArticleText(await res.text());
    return text.length >= 120 ? { url, text } : { url, text: null, error: "no article text found" };
  } catch (e) {
    return { url: null, text: null, error: (e as Error).message.slice(0, 160) };
  }
}
