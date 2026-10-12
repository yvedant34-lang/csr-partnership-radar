import Link from "next/link";
import { createCallTask, draftEmail, findContactAction, revealEmailAction, setFeedback } from "@/app/actions";
import { ActionButton } from "@/app/components/ActionButton";
import { CopyButton } from "@/app/components/CopyButton";
import { ScoreBars } from "@/app/components/ScoreBars";
import { StageSelect } from "@/app/components/StageSelect";
import type { RadarConfig } from "@/lib/config";
import { getContacts, getLead, getTasks } from "@/lib/data";
import { formatDate, formatInr } from "@/lib/format";
import { estimateConfidence, gateWords } from "@/lib/scoring";
import { CHANNEL_LABEL, decision, place, SIGNAL_LABEL, TIER_STYLE, withParam } from "@/lib/ui";

const MATCH_LABEL: Record<string, string> = {
  same_as_source: "same person as the article",
  csr_role: "CSR role at the company",
  adjacent_role: "related role, not CSR",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-stone-200 pt-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">{title}</h3>
      {children}
    </section>
  );
}

export async function LeadDrawer({ id, basePath, admin, cfg }: { id: string; basePath: string; admin: boolean; cfg: RadarConfig }) {
  const lead = await getLead(id);
  const close = withParam(basePath, "lead", null);
  if (!lead) {
    return (
      <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-xl bg-stone-50 p-5 shadow-2xl">
        <p>Lead not found. <Link href={close} className="underline">Close</Link></p>
      </aside>
    );
  }
  const [contacts, tasks] = await Promise.all([getContacts(id), getTasks(id)]);
  const sourceContacts = contacts.filter((c) => c.source === "source_text");
  const lushaContacts = contacts.filter((c) => c.source === "lusha");
  const conf = estimateConfidence({ ...lead, has_contact_email: lushaContacts.some((c) => c.email) });
  const t = TIER_STYLE[lead.tier];
  const otherPeople = lead.people.filter((p) => p.name !== lead.poc_name);
  const searchCsr = `https://www.google.com/search?q=${encodeURIComponent(`${lead.company_name} CSR policy`)}`;
  const locked = !admin;

  return (
    <>
      <Link href={close} scroll={false} aria-label="Close" className="fixed inset-0 z-30 bg-stone-900/30" />
      <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-xl flex-col bg-stone-50 shadow-2xl" aria-label={`${lead.company_name} details`}>
        <header className="flex items-start justify-between gap-3 border-b border-stone-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs text-stone-500">{SIGNAL_LABEL[lead.signal_type] ?? lead.signal_type} · {place(lead)} · {formatDate(lead.posted_at)}</p>
            <h2 className="mt-0.5 text-lg font-semibold text-stone-900">{lead.company_name}</h2>
            <p className="mt-1">
              <span className={`rounded px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${t.badge}`}>{t.label} {lead.priority_score}</span>
              {lead.proven_funder && <span className="ml-2 text-xs text-stone-700">Proven funder</span>}
              {lead.is_synthetic && <span className="ml-2 rounded bg-violet-50 px-1 text-xs text-violet-700 ring-1 ring-violet-200">Sample</span>}
            </p>
          </div>
          <Link href={close} scroll={false} className="rounded-md px-2 py-1 text-sm text-stone-600 ring-1 ring-stone-300 hover:bg-stone-50">Close</Link>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <p className="text-base font-medium text-stone-900">{decision(lead.tier)}</p>
            <p className="mt-1 text-sm text-stone-700">{lead.why_now}</p>
            <p className="mt-2 text-sm text-stone-600"><span className="font-medium text-stone-800">Next step:</span> {lead.recommended_action}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-white p-3 ring-1 ring-stone-200">
              <p className="text-xs text-stone-500">Conversion estimate</p>
              <p className="text-2xl font-semibold tabular-nums text-stone-900">{lead.probability_of_conversion_pct.toFixed(1)}%</p>
              <p className="text-xs text-stone-500">Formula prior from the score, not measured.</p>
            </div>
            <div className="rounded-lg bg-white p-3 ring-1 ring-stone-200">
              <p className="text-xs text-stone-500">Confidence in the estimate</p>
              <p className="text-2xl font-semibold capitalize text-stone-900">{conf.level}</p>
              <p className="text-xs text-stone-500">{conf.reasons.join(", ")}.</p>
            </div>
          </div>

          <Section title="Outreach plan">
            {lead.outreach_first_line ? (
              <div className="space-y-2 text-sm">
                <p><span className="text-stone-500">First channel:</span> <span className="font-medium">{CHANNEL_LABEL[lead.outreach_channel ?? ""] ?? lead.outreach_channel}</span></p>
                <p><span className="text-stone-500">Angle:</span> {lead.outreach_angle}</p>
                <div className="rounded-md bg-white p-2.5 ring-1 ring-stone-200">
                  <p className="text-stone-800">{lead.outreach_first_line}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-xs text-stone-500">Ask: {lead.outreach_ask}</span>
                    <CopyButton text={lead.outreach_first_line} label="Copy line" />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-stone-600">No plan yet. Draft outreach to get an email, a LinkedIn note and a call opener.</p>
            )}
          </Section>

          <Section title="Why this score">
            <ScoreBars lead={lead} cfg={cfg} />
            {lead.hot_gate_fails.length > 0 && (
              <div className="mt-3 text-sm">
                <p className="text-stone-600">{lead.tier === "hot" ? "" : "Not hot because:"}</p>
                <ul className="mt-1 list-disc pl-5 text-stone-800">
                  {lead.hot_gate_fails.map((g) => <li key={g}>{gateWords(g as never, cfg)}</li>)}
                </ul>
              </div>
            )}
          </Section>

          <Section title="Who to contact">
            {sourceContacts.length === 0 && lushaContacts.length === 0 && (
              <p className="text-sm text-stone-700">
                Not published. <a href={searchCsr} target="_blank" rel="noreferrer" className="underline">Search the company&apos;s CSR policy page</a>.
              </p>
            )}
            {sourceContacts.map((c) => (
              <div key={c.id} className="mb-2 text-sm">
                <p className="font-medium text-stone-900">{c.name}</p>
                <p className="text-stone-600">{c.title ?? "Role not stated"}</p>
                <p className="text-xs text-stone-500">From the source: {lead.contact_source ?? "named in the article"}</p>
              </div>
            ))}
            {otherPeople.length > 0 && (
              <p className="mb-2 text-xs text-stone-500">Also named: {otherPeople.map((p) => `${p.name}${p.designation ? ` (${p.designation})` : ""}`).join("; ")}</p>
            )}
            {lushaContacts.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium text-stone-500">From Lusha (not in the article)</p>
                {lushaContacts.map((c) => (
                  <div key={c.id} className="rounded-md bg-white p-2.5 text-sm ring-1 ring-stone-200">
                    <p className="font-medium text-stone-900">{c.name}</p>
                    <p className="text-stone-600">{c.title}{c.city ? `, ${c.city}` : ""}</p>
                    <p className="text-xs text-stone-500">{MATCH_LABEL[c.match ?? ""] ?? c.match} · found {formatDate(c.found_at)}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm">
                      {c.email && admin && <><a href={`mailto:${c.email}`} className="underline">{c.email}</a><CopyButton text={c.email} /></>}
                      {c.email && !admin && <span className="text-xs text-stone-500">Email on file: enter the passcode to see it.</span>}
                      {!c.email && c.can_reveal.includes("emails") && (
                        <ActionButton action={revealEmailAction.bind(null, c.id)} label="Reveal email · 1 credit" disabled={locked} />
                      )}
                      {c.linkedin && <a href={c.linkedin} target="_blank" rel="noreferrer" className="text-xs underline">LinkedIn profile</a>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="The signal">
            <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-stone-500">Summary</dt><dd className="text-stone-800">{lead.summary}</dd>
              <dt className="text-stone-500">Budget</dt><dd>{formatInr(lead.budget_inr_cr)}</dd>
              <dt className="text-stone-500">Partner</dt><dd>{lead.implementation_partner ?? "Not named"}</dd>
              <dt className="text-stone-500">Beneficiaries</dt><dd>{lead.beneficiaries ?? "Not stated"}</dd>
              <dt className="text-stone-500">Sector</dt><dd>{lead.csr_focus_area ?? "Not stated"}{lead.industry ? ` · ${lead.industry}` : ""}</dd>
              <dt className="text-stone-500">Source</dt>
              <dd className="space-x-2">
                {lead.post_link?.startsWith("http") && <a href={lead.post_link} target="_blank" rel="noreferrer" className="underline">{lead.source_name ?? "Open source"}</a>}
                {lead.source_url && lead.source_url !== lead.post_link && <a href={lead.source_url} target="_blank" rel="noreferrer" className="underline">publisher page</a>}
              </dd>
              <dt className="text-stone-500">Read from</dt><dd>{lead.article_read ? "Full article" : "Headline and snippet only (lower confidence)"}</dd>
            </dl>
          </Section>

          {tasks.length > 0 && (
            <Section title="Tasks and drafts">
              {tasks.map((task) => (
                <div key={task.id} className="mb-3 rounded-md bg-white p-3 text-sm ring-1 ring-stone-200">
                  <p className="font-medium">{task.title} · due {task.due_date ? formatDate(`${task.due_date}T09:00:00+05:30`) : "no date"} · {task.status}</p>
                  {task.email_subject && <p className="mt-1 text-stone-700">Subject: {task.email_subject}</p>}
                  {task.email_draft && <pre className="mt-1 whitespace-pre-wrap font-sans text-stone-800">{task.email_draft}</pre>}
                  {task.call_opener && <p className="mt-2 text-stone-700"><span className="text-stone-500">Call opener:</span> {task.call_opener}</p>}
                  <div className="mt-2 flex gap-2">
                    {task.email_draft && <CopyButton text={`Subject: ${task.email_subject}\n\n${task.email_draft}`} label="Copy email" />}
                    {task.call_opener && <CopyButton text={task.call_opener} label="Copy opener" />}
                  </div>
                </div>
              ))}
            </Section>
          )}
        </div>

        <footer className="border-t border-stone-200 bg-white px-5 py-3">
          {locked && <p className="mb-2 text-xs text-stone-500"><Link href={`/login?next=${encodeURIComponent(withParam(basePath, "lead", id))}`} className="underline">Enter the passcode</Link> to change anything.</p>}
          <div className="flex flex-wrap items-start gap-2">
            <ActionButton action={setFeedback.bind(null, id, "useful")} label={lead.feedback === "useful" ? "Useful (marked)" : "Useful"} disabled={locked} />
            <ActionButton action={setFeedback.bind(null, id, "not_useful")} label={lead.feedback === "not_useful" ? "Not useful (marked)" : "Not useful"} disabled={locked} />
            <ActionButton action={createCallTask.bind(null, id)} label="Create call task" disabled={locked} />
            <ActionButton action={draftEmail.bind(null, id)} label="Draft email" pendingLabel="Drafting…" variant="primary" disabled={locked} />
            <ActionButton action={findContactAction.bind(null, id)} label="Find CSR contact" pendingLabel="Searching Lusha…" disabled={locked} />
          </div>
          <div className="mt-2"><StageSelect leadId={id} stage={lead.pipeline_stage} disabled={locked} /></div>
        </footer>
      </aside>
    </>
  );
}
