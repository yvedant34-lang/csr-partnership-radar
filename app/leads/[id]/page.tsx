import Link from "next/link";
import { notFound } from "next/navigation";
import { createCallTask, draftEmail, findContactAction, revealEmailAction, setFeedback } from "@/app/actions";
import { ActionButton } from "@/app/components/ActionButton";
import { ActionChecklist } from "@/app/components/ActionChecklist";
import { Card, SampleBadge, TierBadge } from "@/app/components/Badges";
import { CopyButton } from "@/app/components/CopyButton";
import { ScoreBars } from "@/app/components/ScoreBars";
import { SendDraft } from "@/app/components/SendDraft";
import { emailBodyFromDraft, linkedinNoteFromDraft } from "@/lib/compose";
import { StageSelect } from "@/app/components/StageSelect";
import { getActivity, getConfig, getContacts, getLead, getTasks } from "@/lib/data";
import { formatDate, formatDateTimeIst, formatInr } from "@/lib/format";
import { nextActions } from "@/lib/next-actions";
import { estimateConfidence, gateWords } from "@/lib/scoring";
import { isAdmin } from "@/lib/session";
import { CHANNEL_LABEL, decision, place, SIGNAL_LABEL } from "@/lib/ui";
import { todayIst } from "@/lib/view";

export const dynamic = "force-dynamic";

const MATCH_LABEL: Record<string, string> = {
  same_as_source: "Same person as the article",
  csr_role: "CSR role at the company",
  adjacent_role: "Related role, not CSR",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-fg-3">{label}</dt>
      <dd className="min-w-0 break-words text-fg">{children}</dd>
    </div>
  );
}

export default async function LeadRecord({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();
  const [cfg, contacts, tasks, admin] = await Promise.all([getConfig(), getContacts(id), getTasks(id), isAdmin()]);
  const activity = await getActivity(id, lead.posted_at);
  const actions = nextActions(lead, contacts, tasks, cfg);
  const conf = estimateConfidence({ ...lead, has_contact_email: contacts.some((c) => c.email) });
  const sourceContacts = contacts.filter((c) => c.source === "source_text");
  const lushaContacts = contacts.filter((c) => c.source === "lusha");
  const otherPeople = lead.people.filter((p) => p.name !== lead.poc_name);
  const drafts = tasks.filter((t) => t.email_draft);
  const locked = !admin;
  const sourceUrl = lead.source_url ?? lead.post_link;
  // Who the draft goes to: a verified email (Lusha) first; the article's contact otherwise has no address.
  const emailContact = contacts.find((c) => c.email && c.match !== "adjacent_role") ?? contacts.find((c) => c.email) ?? null;

  return (
    <div className="space-y-5">
      <nav className="text-xs text-fg-3"><Link href="/leads" className="hover:text-fg">Leads</Link> / {lead.company_name}</nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{lead.company_name}</h1>
            <TierBadge tier={lead.tier} score={lead.priority_score} />
            {lead.proven_funder && <span className="text-xs text-fg-2">Proven funder</span>}
            {lead.is_synthetic && <SampleBadge />}
          </div>
          <p className="text-xs text-fg-3">{SIGNAL_LABEL[lead.signal_type] ?? lead.signal_type} · {place(lead)} · posted {formatDate(lead.posted_at)}</p>
          <p className="text-base"><span className="font-medium">{decision(lead.tier)}</span> <span className="text-fg-2">{lead.why_now}</span></p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StageSelect leadId={id} stage={lead.pipeline_stage} disabled={locked} />
          <div className="flex flex-wrap justify-end gap-2">
            <ActionButton action={draftEmail.bind(null, id)} label="Draft email" pendingLabel="Drafting…" variant="primary" disabled={locked} />
            <ActionButton action={findContactAction.bind(null, id)} label="Find contact" pendingLabel="Searching…" disabled={locked} />
            <ActionButton action={createCallTask.bind(null, id)} label="Call task" disabled={locked} />
          </div>
          {locked && <Link href={`/login?next=/leads/${id}`} className="text-xs text-fg-3 underline">Unlock editing to act</Link>}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr_300px]">
        {/* Left: the metrics behind the decision */}
        <div className="space-y-4">
          <Card title="Conversion">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold tabular">{lead.probability_of_conversion_pct.toFixed(1)}%</span>
              <span className="text-xs text-fg-3">estimate</span>
            </div>
            <p className="mt-1 text-sm"><span className="capitalize">{conf.level}</span> confidence</p>
            <p className="mt-1 text-xs text-fg-3">{conf.reasons.join(", ")}. A formula prior from the score until {cfg.conversion_prior.measured_after_outcomes} won or lost outcomes are recorded.</p>
          </Card>
          <Card title="Why this score">
            <ScoreBars lead={lead} cfg={cfg} />
            {lead.hot_gate_fails.length > 0 && (
              <div className="mt-3 border-t border-line pt-3 text-sm">
                <p className="text-xs text-fg-3">{lead.tier === "hot" ? "Gates" : "Not hot because"}</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-fg-2">
                  {lead.hot_gate_fails.map((g) => <li key={g}>{gateWords(g as never, cfg)}</li>)}
                </ul>
              </div>
            )}
          </Card>
          <Card title="About">
            <dl className="divide-y divide-line">
              <Row label="Signal">{SIGNAL_LABEL[lead.signal_type] ?? lead.signal_type}</Row>
              <Row label="Budget">{formatInr(lead.budget_inr_cr)}</Row>
              <Row label="Sector">{lead.csr_focus_area ?? "Not stated"}</Row>
              <Row label="Partner">{lead.implementation_partner ?? "Not named"}</Row>
              <Row label="Beneficiaries">{lead.beneficiaries ?? "Not stated"}</Row>
              <Row label="Industry">{lead.industry ?? "Not stated"}</Row>
              <Row label="Read from">{lead.article_read ? "Full article" : "Headline only"}</Row>
              <Row label="Source">
                {lead.post_link?.startsWith("http") ? <a href={lead.post_link} target="_blank" rel="noreferrer" className="underline">{lead.source_name ?? "Open"}</a> : lead.source_name}
                {lead.source_url && lead.source_url !== lead.post_link && <> · <a href={lead.source_url} target="_blank" rel="noreferrer" className="underline">publisher</a></>}
              </Row>
            </dl>
          </Card>
        </div>

        {/* Centre: what to do, and the drafts to do it with */}
        <div className="min-w-0 space-y-4">
          <Card title="Next actions">
            <ActionChecklist items={actions.map((a) => ({ ...a, leadId: id, sourceUrl }))} admin={admin} today={todayIst()} empty="No actions: this lead is closed." />
          </Card>
          {lead.outreach_first_line && (
            <Card title="Outreach plan">
              <dl className="text-sm">
                <Row label="First channel">{CHANNEL_LABEL[lead.outreach_channel ?? ""] ?? lead.outreach_channel}</Row>
                <Row label="Angle">{lead.outreach_angle}</Row>
                <Row label="Ask">{lead.outreach_ask}</Row>
              </dl>
              <div className="mt-2 flex items-start justify-between gap-3 rounded-md bg-surface-2 p-3 text-sm">
                <p>{lead.outreach_first_line}</p>
                <CopyButton text={lead.outreach_first_line} label="Copy" />
              </div>
            </Card>
          )}
          <Card title="Drafts" action={<span className="text-xs text-fg-3">Never sent automatically</span>}>
            {drafts.length === 0 ? (
              <p className="text-sm text-fg-3">No draft yet. Use Draft email for an intro email, a LinkedIn note and a call opener.</p>
            ) : drafts.map((t) => {
              const body = emailBodyFromDraft(t.email_draft ?? "");
              const note = linkedinNoteFromDraft(t.email_draft ?? "");
              return (
                <div key={t.id} className="space-y-3 text-sm">
                  <p><span className="text-fg-3">Subject:</span> {t.email_subject}</p>
                  <pre className="whitespace-pre-wrap rounded-md bg-surface-2 p-3 font-sans text-fg">{body}</pre>
                  <SendDraft leadId={id} to={emailContact?.email ?? null} toName={emailContact?.name ?? null} subject={t.email_subject ?? ""} body={body} admin={admin} />
                  <div className="flex flex-wrap gap-2">
                    <CopyButton text={`Subject: ${t.email_subject}\n\n${body}`} label="Copy email" />
                    {note && <CopyButton text={note} label="Copy LinkedIn note" />}
                    {t.call_opener && <CopyButton text={t.call_opener} label="Copy call opener" />}
                    {t.drafted_model && <span className="self-center text-xs text-fg-3">Drafted by {t.drafted_model}. Check before sending.</span>}
                  </div>
                  {note && <p className="text-xs text-fg-3"><span className="font-medium text-fg-2">LinkedIn note:</span> {note}</p>}
                  {t.call_opener && <p className="text-xs text-fg-3"><span className="font-medium text-fg-2">Call opener:</span> {t.call_opener}</p>}
                </div>
              );
            })}
          </Card>
          <Card title="Summary">
            <p className="text-sm text-fg-2">{lead.summary}</p>
          </Card>
          <Card title="Activity">
            <ol className="space-y-2 border-l border-line pl-4">
              {activity.map((a, i) => (
                <li key={i} className="relative text-sm">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-fg-3" />
                  <span className="text-fg">{a.text}</span> <span className="text-xs text-fg-3">{formatDateTimeIst(a.at)}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        {/* Right: people */}
        <div className="space-y-4">
          <Card title="Contacts">
            {sourceContacts.length === 0 && lushaContacts.length === 0 && (
              <p className="text-sm text-fg-2">
                Not published. <a href={`https://www.google.com/search?q=${encodeURIComponent(`${lead.company_name} CSR policy`)}`} target="_blank" rel="noreferrer" className="underline">Search the CSR policy page</a>
              </p>
            )}
            <ul className="space-y-3">
              {sourceContacts.map((c) => (
                <li key={c.id} className="text-sm">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-fg-2">{c.title ?? "Role not stated"}</p>
                  <p className="text-xs text-fg-3">Named in the source</p>
                </li>
              ))}
              {lushaContacts.map((c) => (
                <li key={c.id} className="border-t border-line pt-3 text-sm">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-fg-2">{c.title}{c.city ? `, ${c.city}` : ""}</p>
                  <p className="text-xs text-fg-3">Lusha · {MATCH_LABEL[c.match ?? ""] ?? c.match}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {c.email && admin && <><a href={`mailto:${c.email}`} className="break-all underline">{c.email}</a><CopyButton text={c.email} /></>}
                    {c.email && !admin && <span className="text-xs text-fg-3">Email on file (unlock to see)</span>}
                    {!c.email && c.can_reveal.includes("emails") && <ActionButton size="sm" action={revealEmailAction.bind(null, c.id)} label="Reveal email · 1 credit" disabled={locked} />}
                    {c.linkedin && <a href={c.linkedin} target="_blank" rel="noreferrer" className="text-xs underline">LinkedIn</a>}
                  </div>
                </li>
              ))}
            </ul>
            {otherPeople.length > 0 && (
              <p className="mt-3 border-t border-line pt-3 text-xs text-fg-3">Also named: {otherPeople.map((p) => `${p.name}${p.designation ? ` (${p.designation})` : ""}`).join("; ")}</p>
            )}
          </Card>
          <Card title="Was this useful?">
            <div className="flex gap-2">
              <ActionButton size="sm" action={setFeedback.bind(null, id, "useful")} label={lead.feedback === "useful" ? "Useful (marked)" : "Useful"} disabled={locked} />
              <ActionButton size="sm" action={setFeedback.bind(null, id, "not_useful")} label={lead.feedback === "not_useful" ? "Not useful (marked)" : "Not useful"} disabled={locked} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
