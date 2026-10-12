import "server-only";
import { Resend } from "resend";
import { getCoverage, getLeads, getPolicies, type Lead } from "@/lib/data";
import { formatDate, formatShortDate, formatTimeIst } from "@/lib/format";
import { db } from "@/lib/supabase/server";
import { decision, place, SIGNAL_LABEL } from "@/lib/ui";
import { isoWeek, thisWeekCutoff, weekStartIst } from "@/lib/week";

// Monday digest: decision first, short, readable on a phone. Saved to `digests` and
// published at /digest/[week]. It goes to Ananya only; nothing is sent to a company.

export function appUrl(): string {
  const explicit = process.env.APP_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return prod ? `https://${prod}` : "http://localhost:3100";
}

/** Indian financial year label for the cycle after the current one (April to March). */
export function nextFyLabel(now = new Date()): string {
  const ist = new Date(now.getTime() + 330 * 60_000);
  const fyEnd = ist.getUTCMonth() >= 3 ? ist.getUTCFullYear() + 1 : ist.getUTCFullYear();
  return `FY${String((fyEnd + 1) % 100).padStart(2, "0")}`;
}

interface DigestLead {
  id: string;
  company: string;
  tier: string;
  score: number;
  line: string;
  why: string;
  contact: string;
  estimate: string;
}

export interface DigestPayload {
  week: string;
  weekOf: string;
  subject: string;
  hot: DigestLead[];
  warm: DigestLead[];
  funders: { id: string; company: string; place: string; note: string }[];
  policy: { title: string; action: string | null; link: string | null }[];
  tasks: { title: string; due: string | null; leadId: string | null }[];
  coverage: string;
  nextFy: string;
  url: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function toDigestLead(l: Lead): DigestLead {
  return {
    id: l.id,
    company: l.company_name,
    tier: l.tier,
    score: l.priority_score,
    line: `${SIGNAL_LABEL[l.signal_type] ?? l.signal_type} · ${place(l)} · ${formatShortDate(l.posted_at)}`,
    why: l.why_now ?? "",
    contact: l.poc_name ? `${l.poc_name}${l.poc_designation ? `, ${l.poc_designation}` : ""}` : "Contact not published",
    estimate: `${l.probability_of_conversion_pct.toFixed(1)}%`,
  };
}

export async function buildDigest(now = new Date()): Promise<DigestPayload> {
  const [thisWeek, proven, policies, coverage] = await Promise.all([
    getLeads({ sample: false, thisWeek: true }), getLeads({ sample: false, provenOnly: true }),
    getPolicies(false), getCoverage(),
  ]);
  const hot = thisWeek.filter((l) => l.tier === "hot").map(toDigestLead);
  const warm = thisWeek.filter((l) => l.tier === "warm").map(toDigestLead);
  const funders = [...proven]
    .sort((a, b) => b.score_geo_fit - a.score_geo_fit || b.score_sector_fit - a.score_sector_fit)
    .slice(0, 5)
    .map((l) => ({ id: l.id, company: l.company_name, place: place(l), note: l.why_now ?? "" }));
  const cutoff = thisWeekCutoff(now).getTime();
  const policy = policies
    .filter((p) => p.published_at && new Date(p.published_at).getTime() >= cutoff)
    .map((p) => ({ title: p.title as string, action: p.action as string | null, link: p.link as string | null }));
  const { data: tasks } = await db().from("tasks").select("title, due_date, lead_id, is_synthetic").eq("status", "open").eq("is_synthetic", false).order("due_date");
  const run = coverage.run;
  const coverageLine = run
    ? `${run.feeds_ok} of ${run.feeds_total} feeds ran · ${run.items_fetched} items · ${run.items_relevant} relevant · last run ${formatDate(run.finished_at ?? run.started_at)}, ${formatTimeIst(run.finished_at ?? run.started_at)}`
    : "No ingestion run yet";

  const weekOf = formatShortDate(weekStartIst(now));
  const subject = `CSR Radar, week of ${weekOf}: ${plural(hot.length, "call", "calls")}, ${warm.length} to warm up, ${plural(policy.length, "policy item", "policy items")}`;
  return {
    week: isoWeek(now), weekOf, subject, hot, warm, funders, policy,
    tasks: (tasks ?? []).map((t) => ({ title: t.title, due: t.due_date, leadId: t.lead_id })),
    coverage: coverageLine, nextFy: nextFyLabel(now), url: appUrl(),
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderText(d: DigestPayload): string {
  const leadLines = (ls: DigestLead[]) => ls.map((l) => `  ${l.company} (${l.tier} ${l.score}): ${l.why}\n    ${l.contact} · estimate ${l.estimate} · ${d.url}/leads/${l.id}`).join("\n");
  return [
    d.subject,
    "",
    "CALL THIS WEEK (hot)",
    d.hot.length ? leadLines(d.hot) : "  None this week. Paste any LinkedIn calls you have seen.",
    "",
    "WARM UP (warm)",
    d.warm.length ? leadLines(d.warm) : "  None this week.",
    "",
    `PROVEN FUNDERS (pitch for ${d.nextFy})`,
    d.funders.length ? d.funders.map((f) => `  ${f.company}, ${f.place}`).join("\n") : "  None yet.",
    "",
    "POLICY",
    d.policy.length ? d.policy.map((p) => `  ${p.title}. Action: ${p.action ?? "none"}`).join("\n") : "  Nothing new this week.",
    "",
    "TASKS",
    d.tasks.length ? d.tasks.map((t) => `  ${t.title}${t.due ? `, due ${formatDate(`${t.due}T09:00:00+05:30`)}` : ""}`).join("\n") : "  No open tasks.",
    "",
    "COVERAGE",
    `  ${d.coverage}`,
    "",
    `Full radar: ${d.url}  ·  This digest: ${d.url}/digest/${d.week}`,
    "Estimates are formula priors, not measured rates. Nothing is ever sent to a company.",
  ].join("\n");
}

export function renderHtml(d: DigestPayload): string {
  const tierColour: Record<string, string> = { hot: "#991b1b", warm: "#92400e", cold: "#57534e" };
  const card = (l: DigestLead) => `
    <div style="border:1px solid #e7e5e4;border-radius:8px;padding:12px;margin:0 0 10px;background:#fff">
      <div style="font-size:12px;color:#78716c">${esc(l.line)}</div>
      <div style="font-size:16px;font-weight:600;color:#1c1917;margin:2px 0">
        <span style="font-size:11px;font-weight:700;letter-spacing:.04em;color:${tierColour[l.tier]};text-transform:uppercase">${esc(l.tier)} ${l.score}</span>&nbsp; ${esc(l.company)}
      </div>
      <div style="font-size:14px;color:#292524;line-height:1.45"><strong>${esc(decision(l.tier as "hot"))}</strong> ${esc(l.why)}</div>
      <div style="font-size:12px;color:#78716c;margin-top:6px">${esc(l.contact)} · estimate ${esc(l.estimate)}</div>
      <a href="${esc(`${d.url}/leads/${l.id}`)}" style="display:inline-block;margin-top:8px;font-size:13px;color:#1c1917">Open lead</a>
    </div>`;
  const section = (title: string, body: string) => `
    <h2 style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#78716c;margin:22px 0 8px">${esc(title)}</h2>${body}`;
  const muted = (s: string) => `<p style="font-size:14px;color:#57534e;margin:0">${esc(s)}</p>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(d.subject)}</title></head>
<body style="margin:0;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:20px 16px">
    <div style="font-size:12px;color:#78716c">CSR Partnership Radar · week of ${esc(d.weekOf)}</div>
    <h1 style="font-size:20px;line-height:1.3;color:#1c1917;margin:4px 0 0">${esc(d.hot.length ? `Call ${d.hot.length} this week.` : "No calls this week.")}${d.warm.length ? ` Warm up ${d.warm.length}.` : ""}</h1>
    ${section("Call this week (hot)", d.hot.length ? d.hot.map(card).join("") : muted("None this week. Paste any LinkedIn calls you have seen."))}
    ${section("Warm up (warm)", d.warm.length ? d.warm.map(card).join("") : muted("None this week."))}
    ${section(`Proven funders: pitch for ${d.nextFy}`, d.funders.length
      ? `<ul style="margin:0;padding-left:18px;font-size:14px;color:#292524;line-height:1.6">${d.funders.map((f) => `<li><a href="${esc(`${d.url}/leads/${f.id}`)}" style="color:#1c1917">${esc(f.company)}</a>, ${esc(f.place)}</li>`).join("")}</ul>`
      : muted("None yet."))}
    ${section("Policy", d.policy.length
      ? d.policy.map((p) => `<p style="font-size:14px;color:#292524;margin:0 0 8px">${esc(p.title)}<br><span style="color:#57534e">Action: ${esc(p.action ?? "none needed")}</span></p>`).join("")
      : muted("Nothing new this week."))}
    ${section("Tasks", d.tasks.length
      ? `<ul style="margin:0;padding-left:18px;font-size:14px;color:#292524;line-height:1.6">${d.tasks.map((t) => `<li>${esc(t.title)}${t.due ? `, due ${esc(formatDate(`${t.due}T09:00:00+05:30`))}` : ""}</li>`).join("")}</ul>
         <a href="${esc(`${d.url}/tasks`)}" style="font-size:13px;color:#1c1917">Drafts are ready on the Tasks page</a>`
      : muted("No open tasks."))}
    ${section("Coverage", muted(d.coverage))}
    <p style="font-size:12px;color:#a8a29e;margin:24px 0 0;line-height:1.5">Estimates are formula priors, not measured rates. Nothing is ever sent to a company.<br>
      <a href="${esc(`${d.url}/digest/${d.week}`)}" style="color:#78716c">View this digest online</a> · <a href="${esc(d.url)}" style="color:#78716c">Open the radar</a></p>
  </div>
</body></html>`;
}

/** Build, save (one row per ISO week) and email. Re-running in the same week does not resend unless forced. */
export async function runDigest(opts: { send: boolean; force?: boolean; to?: string } = { send: true }) {
  const payload = await buildDigest();
  const html = renderHtml(payload);
  const text = renderText(payload);
  const { data: existing } = await db().from("digests").select("id, sent_at").eq("week", payload.week).maybeSingle();
  const { data: row, error } = await db().from("digests")
    .upsert({ week: payload.week, subject: payload.subject, html, text, payload }, { onConflict: "week" })
    .select("id").single();
  if (error) throw new Error(`digests: ${error.message}`);

  let sent: { id?: string; skipped?: string; error?: string } = { skipped: "send not requested" };
  if (opts.send) {
    const to = opts.to ?? process.env.DIGEST_TO_EMAIL;
    if (!to) sent = { skipped: "DIGEST_TO_EMAIL is not set" };
    else if (existing?.sent_at && !opts.force) sent = { skipped: `already sent this week (${existing.sent_at})` };
    else if (!process.env.RESEND_API_KEY) sent = { skipped: "RESEND_API_KEY is not set" };
    else {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from = process.env.DIGEST_FROM_EMAIL ?? "CSR Radar <onboarding@resend.dev>";
      const r = await resend.emails.send({ from, to, subject: payload.subject, html, text });
      if (r.error) {
        sent = { error: r.error.message };
        await db().from("digests").update({ send_error: r.error.message }).eq("id", row.id);
      } else {
        sent = { id: r.data?.id };
        await db().from("digests").update({ sent_at: new Date().toISOString(), send_error: null }).eq("id", row.id);
      }
    }
  }
  return { week: payload.week, subject: payload.subject, counts: { hot: payload.hot.length, warm: payload.warm.length, funders: payload.funders.length, policy: payload.policy.length, tasks: payload.tasks.length }, sent };
}
