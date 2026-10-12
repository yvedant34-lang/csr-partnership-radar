import "server-only";

// Gemini Flash over REST. Temperature 0, JSON schema output. Gemini extracts facts only:
// it never returns a score, tier or probability (lib/scoring.ts does that in plain code).

const API = "https://generativelanguage.googleapis.com/v1beta/models";

export const SIGNAL_TYPES = [
  "partner_search", "csr_tender_or_eoi", "new_initiative", "unspent_csr",
  "new_csr_head", "event_or_vlog", "annual_report_mention", "other",
] as const;

export const FOCUS_AREAS = ["Education", "Skill Development", "Digital Literacy", "Youth Employment", "Other"] as const;

export const GEMINI_PROMPT = `You read Indian CSR (corporate social responsibility) news for an education NGO in Pune that serves school dropouts and first generation job seekers. Its sectors: education, skill development, digital literacy, youth employment.

Extract facts from the item below into the JSON schema. Rules:
- Use only what the text says. If a field is not stated, return null (or [] for lists). Never guess.
- relevant = true only if a company (or its foundation) is funding, launching, spending on, or seeking partners for work in the NGO's sectors in India, or if the item is an Indian CSR policy or regulation change. Awards, ads, sport, stock news and foreign news are not relevant.
- is_policy = true for CSR law, rules, MCA notices, NCCSR or regulator guidance. Then fill policy_impact and policy_action and leave company fields null.
- company_name: the funding company, not the NGO or the implementing partner. Use its common name (e.g. "BASF India", "Zeta").
- signal_type:
  partner_search = the company publicly asks for NGO or implementation partners;
  csr_tender_or_eoi = a formal tender, EOI or call for proposals;
  new_initiative = a new centre, programme or project launched or announced;
  unspent_csr = money moved to an Unspent CSR Account or unspent CSR obligation;
  new_csr_head = a new head of CSR or CSR committee chair appointed;
  event_or_vlog = interview, panel, award, opinion piece;
  annual_report_mention = CSR spend figures from an annual report with no unspent amount;
  other = anything else.
- csr_focus_area: the closest of the allowed values.
- city, state: where this activity happens. geo_scope: city | state | pan_india | other (other = a specific place outside the NGO's state, Maharashtra).
- programme_states: every Indian state the text says this company's programme already runs in (e.g. other centres already live).
- poc_name, poc_designation: only a person named in the text as speaking for the company. Copy the name exactly as written. If nobody is named, null. Never invent a contact.
- implementation_partner: the NGO or agency delivering the work, as named. If the company runs it itself, write "<name> (in house)". If not named, null.
- budget_inr_cr: the amount in crore rupees if stated (convert lakh: 50 lakh = 0.5). Else null.
- summary: two plain sentences, facts only, Indian formats (Rs, crore, lakh).
- why_now: one plain sentence for the NGO's partnerships head: is there a reason to contact this company now, and why. If the article shows no opening (partner chosen, outside Maharashtra, one-off event), say so plainly. No hype.
- people: everyone the text names who speaks for, leads, or decides for the company or its CSR (name exactly as written, their designation, and role: spokesperson | csr_head | committee | executive | partner_org). Never invent a person.
- outreach: a specific cold outreach plan for this company, tied to the exact signal in the text (the centre, the spend, the new role, the stated need):
  channel = the best first channel (email | linkedin | warm_intro | event | phone);
  angle = one sentence on what the NGO offers that fits this signal (school dropouts and first generation job seekers in Pune);
  first_line = the opening line of the first message, referencing the signal concretely, under 30 words, no flattery;
  ask = one small ask (for example a 20 minute call).`;

export const GEMINI_SCHEMA = {
  type: "OBJECT",
  properties: {
    relevant: { type: "BOOLEAN" },
    is_policy: { type: "BOOLEAN" },
    company_name: { type: "STRING", nullable: true },
    industry: { type: "STRING", nullable: true },
    csr_focus_area: { type: "STRING", enum: [...FOCUS_AREAS], nullable: true },
    signal_type: { type: "STRING", enum: [...SIGNAL_TYPES], nullable: true },
    city: { type: "STRING", nullable: true },
    state: { type: "STRING", nullable: true },
    geo_scope: { type: "STRING", enum: ["city", "state", "pan_india", "other"], nullable: true },
    programme_states: { type: "ARRAY", items: { type: "STRING" } },
    poc_name: { type: "STRING", nullable: true },
    poc_designation: { type: "STRING", nullable: true },
    implementation_partner: { type: "STRING", nullable: true },
    budget_inr_cr: { type: "NUMBER", nullable: true },
    beneficiaries: { type: "STRING", nullable: true },
    summary: { type: "STRING" },
    why_now: { type: "STRING" },
    policy_impact: { type: "STRING", nullable: true },
    policy_action: { type: "STRING", nullable: true },
    people: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          designation: { type: "STRING", nullable: true },
          role: { type: "STRING", enum: ["spokesperson", "csr_head", "committee", "executive", "partner_org"] },
        },
        required: ["name", "role"],
      },
    },
    outreach: {
      type: "OBJECT",
      nullable: true,
      properties: {
        channel: { type: "STRING", enum: ["email", "linkedin", "warm_intro", "event", "phone"] },
        angle: { type: "STRING" },
        first_line: { type: "STRING" },
        ask: { type: "STRING" },
      },
      required: ["channel", "angle", "first_line", "ask"],
    },
  },
  required: ["relevant", "is_policy", "summary", "why_now", "programme_states", "people"],
  propertyOrdering: [
    "relevant", "is_policy", "company_name", "industry", "csr_focus_area", "signal_type", "city", "state",
    "geo_scope", "programme_states", "poc_name", "poc_designation", "implementation_partner", "budget_inr_cr",
    "beneficiaries", "summary", "why_now", "policy_impact", "policy_action", "people", "outreach",
  ],
} as const;

export interface Extraction {
  relevant: boolean;
  is_policy: boolean;
  company_name: string | null;
  industry: string | null;
  csr_focus_area: (typeof FOCUS_AREAS)[number] | null;
  signal_type: (typeof SIGNAL_TYPES)[number] | null;
  city: string | null;
  state: string | null;
  geo_scope: "city" | "state" | "pan_india" | "other" | null;
  programme_states: string[];
  poc_name: string | null;
  poc_designation: string | null;
  implementation_partner: string | null;
  budget_inr_cr: number | null;
  beneficiaries: string | null;
  summary: string;
  why_now: string;
  policy_impact: string | null;
  policy_action: string | null;
  people: { name: string; designation: string | null; role: string }[];
  outreach: { channel: string; angle: string; first_line: string; ask: string } | null;
}

export class GeminiError extends Error {
  constructor(message: string, readonly status?: number, readonly retryAfterMs?: number) {
    super(message);
  }
}

interface GenerateOptions {
  system?: string;
  schema?: object;
  timeoutMs?: number;
  deadline?: number; // epoch ms: no retry that would end after this
}

// Free tier allows roughly 10 requests a minute: one call at a time, spaced out.
const MIN_INTERVAL_MS = Number(process.env.GEMINI_MIN_INTERVAL_MS ?? 6500);
let gate: Promise<void> = Promise.resolve();
let lastCallAt = 0;

function throttle(): Promise<void> {
  const next = gate.then(async () => {
    const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
  });
  gate = next.catch(() => undefined);
  return next;
}

/** RetryInfo.retryDelay ("17s", "41079.6s") in ms, or null. */
function retryDelayMs(body: string): number | null {
  try {
    const details: { "@type"?: string; retryDelay?: string }[] = JSON.parse(body).error?.details ?? [];
    const d = details.find((x) => x["@type"]?.endsWith("RetryInfo"))?.retryDelay;
    return d ? Math.ceil(parseFloat(d) * 1000) : null;
  } catch {
    return null;
  }
}

async function callModel(model: string, prompt: string, opts: GenerateOptions, attempt = 0): Promise<string> {
  await throttle();
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("GEMINI_API_KEY is not set");
  const res = await fetch(`${API}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
    body: JSON.stringify({
      ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        ...(opts.schema ? { responseMimeType: "application/json", responseSchema: opts.schema } : {}),
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    const delay = retryDelayMs(body);
    // Short waits (per-minute limits, brief overload) are worth one retry on the same model.
    if ((res.status === 429 || res.status === 503) && attempt < 1 && (delay ?? 8000) <= 30_000
        && Date.now() + (delay ?? 8000) < (opts.deadline ?? Infinity)) {
      await new Promise((r) => setTimeout(r, (delay ?? 8000) + 500));
      return callModel(model, prompt, opts, attempt + 1);
    }
    let msg = body.slice(0, 200);
    try { msg = JSON.parse(body).error?.message?.split("\n")[0] ?? msg; } catch { /* keep raw */ }
    throw new GeminiError(`${model}: ${res.status} ${msg}`, res.status, delay ?? undefined);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  if (!text) throw new GeminiError(`${model}: empty response (${data?.candidates?.[0]?.finishReason ?? "no candidate"})`);
  return text;
}

// Free tier caps each model at about 20 requests a day. Step through the Flash family when a model
// is exhausted, overloaded or slow, and skip it until Google's stated reset time. The skip list lives in
// gemini_model_status so every serverless invocation knows, not just the one that hit the limit.
// (gemini-2.5-* answer 404 for keys created after their cut-off, so they are not in the default list.)
const DEFAULT_LADDER = [
  "gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3-flash-preview",
  "gemini-flash-latest", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-flash-lite-latest",
];
const downUntil = new Map<string, number>();
let statusLoadedAt = 0;

export function modelLadder(): string[] {
  const primary = process.env.GEMINI_MODEL?.trim();
  const extra = process.env.GEMINI_FALLBACK_MODELS?.split(",").map((m) => m.trim()).filter(Boolean) ?? DEFAULT_LADDER;
  return [...new Set([...(primary ? [primary] : []), ...extra])];
}

async function statusStore() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { db } = await import("@/lib/supabase/server");
  return db();
}

async function loadModelStatus() {
  if (Date.now() - statusLoadedAt < 60_000) return;
  statusLoadedAt = Date.now();
  try {
    const store = await statusStore();
    const { data } = (await store?.from("gemini_model_status").select("model, down_until").gt("down_until", new Date().toISOString())) ?? { data: [] };
    for (const r of data ?? []) downUntil.set(r.model, Math.max(downUntil.get(r.model) ?? 0, new Date(r.down_until).getTime()));
  } catch { /* the in-memory list still works */ }
}

async function markDown(model: string, ms: number, reason: string) {
  const until = Date.now() + ms;
  downUntil.set(model, until);
  try {
    const store = await statusStore();
    await store?.from("gemini_model_status").upsert({ model, down_until: new Date(until).toISOString(), reason: reason.slice(0, 200), updated_at: new Date().toISOString() });
  } catch { /* best effort */ }
}

export async function generate(prompt: string, opts: GenerateOptions = {}): Promise<{ text: string; model: string }> {
  await loadModelStatus();
  let lastError: unknown = null;
  for (const model of modelLadder()) {
    if ((downUntil.get(model) ?? 0) > Date.now()) continue;
    try {
      return { text: await callModel(model, prompt, opts), model };
    } catch (e) {
      lastError = e;
      const err = e as GeminiError;
      const timedOut = /timeout|aborted/i.test(err.message);
      const retryable = timedOut || err.status === 429 || err.status === 500 || err.status === 503 || err.status === 404;
      if (!retryable) throw e;
      // Daily cap: Google says how long (hours). Overload or timeout: rest the model for 10 minutes.
      await markDown(model, Math.max(err.retryAfterMs ?? 0, 10 * 60_000), err.message);
    }
  }
  throw lastError ?? new GeminiError("all Gemini Flash models are rate limited; items stay queued", 429);
}

export async function extract(
  item: { title: string; snippet?: string | null; source_name?: string | null; published_at?: string | null; body?: string | null },
  deadline?: number,
) {
  const lines = [
    `Headline: ${item.title}`,
    item.source_name ? `Publisher: ${item.source_name}` : "",
    item.published_at ? `Published: ${item.published_at}` : "",
    item.snippet ? `Snippet: ${item.snippet}` : "",
    item.body ? `Article text:\n${item.body.slice(0, 12_000)}` : "",
  ].filter(Boolean);
  const { text, model } = await generate(lines.join("\n"), { system: GEMINI_PROMPT, schema: GEMINI_SCHEMA, deadline });
  return { extraction: JSON.parse(text) as Extraction, model };
}
