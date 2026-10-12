// Google News RSS search (unofficial, no key). Keep to these lanes and a few runs a day.
// Item links are Google redirect URLs: stored as they are.
import { XMLParser } from "fast-xml-parser";

export const QUERIES: Record<string, string> = {
  skilling_centre: "CSR skill development centre",
  education: "CSR education NGO partner",
  digital_literacy: "CSR digital literacy youth",
  youth_employment: 'CSR youth employability OR placement OR "job readiness"',
  unspent_csr: '"unspent CSR"',
  csr_spend: "CSR spends crore FY 2025-26",
  maharashtra: "CSR Pune OR Maharashtra skilling OR education",
  partner_search: 'CSR "NGO partner" OR "implementing agency" OR "expression of interest" OR "call for proposals"',
  policy: 'CSR "Ministry of Corporate Affairs" OR NCCSR OR "CSR rules" OR "Schedule VII"',
};

export function feedUrl(query: string): string {
  const q = encodeURIComponent(`${query} when:7d`);
  return `https://news.google.com/rss/search?q=${q}&hl=en-IN&gl=IN&ceid=IN:en`;
}

export interface RssItem {
  lane: string;
  title: string; // headline without the trailing " - Source"
  title_norm: string;
  link: string;
  source_name: string | null;
  snippet: string | null;
  published_at: string | null;
}

export interface FeedResult {
  lane: string;
  ok: boolean;
  items: RssItem[];
  error?: string;
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text" });

const text = (v: unknown): string =>
  v == null ? "" : typeof v === "object" ? String((v as Record<string, unknown>)["#text"] ?? "") : String(v);

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** Dedupe key: lowercase, punctuation stripped, source suffix removed. */
export function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function parseFeed(lane: string, xml: string): RssItem[] {
  const doc = parser.parse(xml);
  const raw = doc?.rss?.channel?.item;
  const items: unknown[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return items.map((it) => {
    const i = it as Record<string, unknown>;
    const source = text(i.source) || null;
    let title = text(i.title);
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    const snippet = stripHtml(text(i.description));
    const pub = text(i.pubDate);
    return {
      lane,
      title,
      title_norm: normaliseTitle(title),
      link: text(i.link),
      source_name: source,
      // Google's description is usually just the headline again; keep it only if it adds something.
      snippet: snippet && normaliseTitle(snippet) !== normaliseTitle(`${title} ${source ?? ""}`) ? snippet : null,
      published_at: pub ? new Date(pub).toISOString() : null,
    };
  });
}

export async function fetchFeed(lane: string, query: string, timeoutMs = 15_000): Promise<FeedResult> {
  try {
    const res = await fetch(feedUrl(query), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CSRPartnershipRadar/0.1)" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!res.ok) return { lane, ok: false, items: [], error: `HTTP ${res.status}` };
    return { lane, ok: true, items: parseFeed(lane, await res.text()) };
  } catch (e) {
    return { lane, ok: false, items: [], error: (e as Error).message };
  }
}

/** Fetch every lane in parallel and dedupe across lanes by normalised title (first lane wins). */
export async function fetchAllLanes(queries = QUERIES) {
  const results = await Promise.all(Object.entries(queries).map(([lane, q]) => fetchFeed(lane, q)));
  const seen = new Set<string>();
  const items: RssItem[] = [];
  for (const r of results) {
    for (const it of r.items) {
      if (!it.title_norm || seen.has(it.title_norm)) continue;
      seen.add(it.title_norm);
      items.push(it);
    }
  }
  return { results, items };
}
