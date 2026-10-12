import "server-only";
import type { RadarConfig } from "@/lib/config";
import { db } from "@/lib/supabase/server";

// Lusha REST (v3). Every credit spent is logged to lusha_spend and checked against
// radar_config.lusha_monthly_cap. Contacts land in lead_contacts with source = 'lusha',
// kept apart from people named in the article.

const API = "https://api.lusha.com/v3";
const CSR_TITLES = ["CSR", "Corporate Social Responsibility", "Social Impact", "Sustainability", "Foundation", "Community"];

interface LushaPerson {
  id: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: { title?: string; seniority?: string };
  company?: { name?: string; domain?: string };
  location?: { city?: string; state?: string };
  socialLinks?: { linkedin?: string };
  canReveal?: { field: string; credits: number }[];
  emails?: { email: string; confidence?: string }[];
  error?: { code: string };
}

async function call<T>(path: string, body: unknown): Promise<T> {
  const key = process.env.LUSHA_API_KEY;
  if (!key) throw new Error("LUSHA_API_KEY is not set");
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", api_key: key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Lusha ${path}: ${res.status} ${text.slice(0, 160)}`);
  return JSON.parse(text) as T;
}

export async function creditsUsedThisMonth(): Promise<number> {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { data } = await db().from("lusha_spend").select("credits").gte("spent_at", start.toISOString());
  return (data ?? []).reduce((n, r) => n + (r.credits ?? 0), 0);
}

async function logSpend(action: string, credits: number, leadId: string | null, note: string) {
  if (credits > 0) await db().from("lusha_spend").insert({ action, credits, lead_id: leadId, note });
}

const name = (p: LushaPerson) => [p.firstName, p.lastName].filter(Boolean).join(" ");
const isCsrRole = (title = "") => /csr|social responsib|social impact|foundation|community|sustainab/i.test(title);
// A name match only counts if the person plausibly is the article's contact: a CSR role or a senior one.
// (Common names match the wrong person: "Manoj Jain" at BEL in Lusha is an engineer, not the CSR chair.)
const isPlausibleSource = (title = "") => isCsrRole(title) || /chair|director|board|president|chief|head|ceo|cfo|chro|vice president|vp\b|founder|trustee/i.test(title);

/**
 * Find the person behind a post. With a named source contact: look that person up.
 * Without one: search the company for CSR roles in India. Returns stored contact ids.
 */
export async function findContacts(lead: { id: string; company_name: string; poc_name: string | null }, cfg: RadarConfig) {
  if ((await creditsUsedThisMonth()) >= cfg.lusha_monthly_cap) return { found: 0, skipped: "monthly Lusha cap reached" };

  let people: LushaPerson[] = [];
  let credits = 0;
  let domain: string | null = null;
  let match: "same_as_source" | "csr_role" = "csr_role";

  const parts = lead.poc_name?.trim().split(/\s+/) ?? [];
  if (parts.length >= 2) {
    const r = await call<{ results: LushaPerson[]; billing?: { creditsCharged?: number } }>("/contacts/search", {
      contacts: [{ firstName: parts[0], lastName: parts.slice(1).join(" "), companyName: lead.company_name }],
    });
    credits += r.billing?.creditsCharged ?? 0;
    // Even a rejected match tells us the company's domain, which makes the company search exact.
    domain = (r.results ?? []).map((p) => p.company?.domain).find(Boolean)?.replace(/^www\./, "") ?? null;
    people = (r.results ?? []).filter((p) => !p.error && p.id && isPlausibleSource(p.jobTitle?.title));
    match = "same_as_source";
  }
  if (!people.length) {
    const r = await call<{ results: LushaPerson[]; billing?: { creditsCharged?: number } }>("/contacts/prospecting", {
      pagination: { page: 0, size: 10 },
      filters: {
        contacts: { include: { jobTitles: CSR_TITLES, countries: ["IN"] } },
        companies: {
          include: domain
            ? { domains: [domain] }
            : { names: [...new Set([lead.company_name, lead.company_name.replace(/\b(ltd|limited)\.?$/i, "").trim(), `${lead.company_name.replace(/\b(ltd|limited)\.?$/i, "").trim()} Limited`])] },
        },
      },
    });
    credits += r.billing?.creditsCharged ?? 0;
    people = (r.results ?? []).filter((p) => p.id && isCsrRole(p.jobTitle?.title)).slice(0, 3);
    match = "csr_role";
  }
  await logSpend("search", credits, lead.id, `${lead.company_name}: ${people.length} found`);

  const rows = people.map((p) => ({
    lead_id: lead.id,
    source: "lusha",
    match: match === "same_as_source" ? "same_as_source" : isCsrRole(p.jobTitle?.title) ? "csr_role" : "adjacent_role",
    lusha_id: p.id,
    name: name(p),
    title: p.jobTitle?.title ?? null,
    city: p.location?.city ?? null,
    state: p.location?.state ?? null,
    linkedin: p.socialLinks?.linkedin ?? null,
    can_reveal: (p.canReveal ?? []).map((c) => c.field),
  }));
  if (rows.length) await db().from("lead_contacts").upsert(rows, { onConflict: "lead_id,lusha_id", ignoreDuplicates: true });
  return { found: rows.length, credits };
}

/** Reveal a work email (1 credit). Phones are never revealed automatically. */
export async function revealEmail(contactId: string, cfg: RadarConfig) {
  if ((await creditsUsedThisMonth()) >= cfg.lusha_monthly_cap) return { ok: false, reason: "monthly Lusha cap reached" };
  const { data: c } = await db().from("lead_contacts").select("id, lead_id, lusha_id, name, email").eq("id", contactId).single();
  if (!c?.lusha_id) return { ok: false, reason: "not a Lusha contact" };
  if (c.email) return { ok: true, email: c.email };
  const r = await call<{ results: LushaPerson[]; billing?: { creditsCharged?: number } }>("/contacts/enrich", {
    ids: [c.lusha_id], reveal: ["emails"], waterfallEnabled: false,
  });
  const email = r.results?.[0]?.emails?.[0]?.email ?? null;
  await logSpend("reveal_email", r.billing?.creditsCharged ?? 0, c.lead_id, c.name);
  await db().from("lead_contacts").update({
    email, revealed_at: new Date().toISOString(),
    can_reveal: email ? ["phones"] : [],
  }).eq("id", c.id);
  return { ok: !!email, email, reason: email ? undefined : "Lusha has no email for this contact" };
}

/** New hot and warm leads (per radar_config.lusha_auto_tiers): find the contact and reveal one email. */
export async function autoEnrich(lead: { id: string; company_name: string; poc_name: string | null; tier: string }, cfg: RadarConfig) {
  if (!process.env.LUSHA_API_KEY || !cfg.lusha_auto_tiers.includes(lead.tier as never)) return null;
  const found = await findContacts(lead, cfg);
  if (!found.found) return found;
  const { data: best } = await db().from("lead_contacts").select("id").eq("lead_id", lead.id).eq("source", "lusha")
    .order("match", { ascending: false }).limit(1).maybeSingle();
  const reveal = best ? await revealEmail(best.id, cfg) : null;
  return { ...found, revealed: reveal?.ok ?? false };
}
