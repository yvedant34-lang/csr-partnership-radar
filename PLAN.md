# CSR Partnership Radar: build plan

For Ananya. Every Monday by 06:30 IST: which companies to call this week, and why.
Status: **awaiting approval**. No app code written yet.

---

## 0. Blockers and honest flags (one line each)

| # | Issue | Proposal |
|---|---|---|
| B1 | ~~Seed pack is missing.~~ **Resolved 12 Oct 2026:** `seed/csr_leads_live.csv` (15 real rows) is the source of truth. `build_seed.py` was never supplied, so scoring rules were fitted to the CSV and all 15 rows reproduce exactly. Inferred constants are listed in `seed/radar_config.json` → `_inferred` / `_unverified`. `schema.sql`, `seed_live.sql` and `radar_config.json` are generated here. No synthetic pack: I write a small badged one for UI testing. | If `build_seed.py` turns up, diff it against `lib/scoring.ts`. Tests will catch any drift. |
| F1 | Hobby crons fire anywhere inside the hour, so `0 1 * * 1` UTC can land at 07:29 IST, after the 06:30 promise. | Schedule digest at `0 0 * * 1` UTC (05:30 to 06:29 IST). Ingest stays `30 23 * * *` (fires 04:30 to 05:29 IST, always before the digest). |
| F2 | 20 Gemini items per invocation and one cron a day means a backlog on busy weeks. | Ingest hands off to `/api/extract` up to 3 times via `after()` (each its own invocation, each ≤20 items). Unprocessed count shows in the coverage strip, plus a "Process backlog" button. |
| F3 | The public URL must show live data, but Settings, Rescore, Move stage and Paste a link change data or spend Gemini quota. | Reads are public. Writes need a passcode (`ADMIN_PASSCODE` env, httpOnly cookie). No user accounts. |
| F4 | A lead conversion line graph with 0 won and 0 lost outcomes would be empty or invented. | Plot weekly stage progress (found, contacted, meeting, proposal, won) from a stage event log. Label the conversion rate "estimate" until 50 closed outcomes exist. See section 6. |
| F5 | Current Gemini Flash model name. | Look it up in Google's docs at Phase 2 and set `GEMINI_MODEL`. Code never hardcodes it. |
| F6 | The graph needs stage history. | `lead_stage_events` is now part of `seed/schema.sql` (I write the schema, so no separate migration). |

---

## 1. What I am taking from the reference site, and what I am cutting

The reference (csr-partnership-radar-alpha.vercel.app) opens with 4 stat cards, a "data status" card, a tier legend, a 3-panel "at a glance" block, three admin buttons and readiness text before the first lead. Ananya has to scroll a full screen to learn the answer.

**Simplified home, top to bottom:**

1. **One decision line:** "Call 0 this week. Warm up BASF India and Zeta." (the answer, first)
2. **Coverage strip, single row:** `Last run 12 Oct, 05:04 IST · 9 of 9 feeds · 76 items · 4 leads`. Tap for details. No buttons here.
3. **Three columns** (Hot / Warm / Cold) with count badges. Stacked tabs at 375px.
4. **Lead conversion line graph**, collapsed to a small sparkline card; it expands on tap.

Cut from home: stat card grid, tier legend (moved to a tooltip on the badge), admin buttons (moved to Settings), "readiness". Tier names follow the spec (hot, warm, cold), not the reference's Call / Watch / Emerging.

**Lead card, three lines, decision first:**

```
WARM 70  BASF India · Nashik, MH                       15 Sep
Call this week? Not yet. Rs 8.86 Cr unspent, no partner named.
Bahram Vakil, Chairman CSR Committee · source ↗
```

Everything else (score bars, gates, drafts, actions) lives in the drawer.

---

## 2. File tree

```
csr-partnership-radar/
├─ PLAN.md  README.md  COMPONENTS_MAP.md
├─ .env.example            # names only, no values
├─ .gitignore              # includes .env*
├─ vercel.json             # two crons
├─ seed/                   # your files, unchanged
├─ supabase/migrations/
│   └─ 002_stage_events.sql
├─ lib/
│   ├─ scoring.ts          # line-for-line port: score_lead, tier_for, conversion_prior, proven_funder
│   ├─ config.ts           # loads radar_config row, typed
│   ├─ gemini.ts           # REST call, temp 0, JSON schema; GEMINI_PROMPT + GEMINI_SCHEMA verbatim
│   ├─ drafts.ts           # intro email (≤120 words) + 2-line opener, via Gemini
│   ├─ rss.ts              # QUERIES, fetch, parse, normalise title, dedupe
│   ├─ prefilter.ts        # keyword prefilter, ported from scrape_google_news.py
│   ├─ pipeline.ts         # extract → flags → score → upsert lead → hot actions (shared by cron + Paste a link)
│   ├─ week.ts             # IST week maths, "this week" at read time, next Monday
│   ├─ format.ts           # Rs crore/lakh, 12 Oct 2026, IST times
│   ├─ supabase/server.ts  # service-role client, server only (`import "server-only"`)
│   ├─ supabase/public.ts  # anon client
│   └─ auth.ts             # passcode cookie check for writes
├─ app/
│   ├─ layout.tsx          # nav: This Week · Funders · Pipeline · Tasks · Policy · Paste · Settings
│   ├─ page.tsx            # This Week
│   ├─ funders/page.tsx    # Proven Funders
│   ├─ pipeline/page.tsx   # Kanban
│   ├─ policy/page.tsx
│   ├─ tasks/page.tsx
│   ├─ paste/page.tsx
│   ├─ settings/page.tsx
│   ├─ digest/[week]/page.tsx
│   ├─ components/         # LeadCard, LeadDrawer, ScoreBars, CoverageStrip, TierColumn,
│   │                      # ConversionChart (hand-rolled SVG, no chart lib), SampleToggle, CopyButton
│   └─ api/
│       ├─ cron/ingest/route.ts
│       ├─ cron/digest/route.ts
│       ├─ extract/route.ts      # ≤20 items per call, CRON_SECRET or passcode
│       ├─ paste/route.ts
│       ├─ leads/[id]/route.ts   # feedback, stage move (writes stage event)
│       ├─ tasks/route.ts        # create call task, draft email
│       ├─ rescore/route.ts
│       └─ login/route.ts
└─ tests/
    ├─ scoring.test.ts     # all 15 rows of csr_leads_live.json, REF = 2026-10-12T18:00:00+05:30
    ├─ week.test.ts        # IST boundaries, next Monday
    └─ format.test.ts      # crore/lakh
```

Dependencies: `next`, `react`, `@supabase/supabase-js`, `resend`, `fast-xml-parser`, `tailwindcss`, `vitest`. Gemini over REST (no SDK). No chart library, no UI kit.

---

## 3. Routes

| Route | Guard | Does |
|---|---|---|
| `GET /api/cron/ingest` | `CRON_SECRET` bearer | Fetch 9 lane feeds, dedupe by normalised title, insert `raw_items`, log `ingestion_runs`, hand off to extract. |
| `POST /api/extract` | `CRON_SECRET` or passcode | Up to 20 unprocessed, prefiltered items → Gemini → policy to `policy_updates`, companies to the lead pipeline. Marks `extraction_confidence = low` for snippet-only input. |
| `GET /api/cron/digest` | `CRON_SECRET` | Build digest, save to `digests`, send via Resend, publish `/digest/[week]`. Idempotent per week. |
| `POST /api/paste` | passcode | URL or text → same `pipeline.ts` path. Fetches a URL's page text where allowed. LinkedIn URLs are never fetched: you paste the post text. |
| `PATCH /api/leads/[id]` | passcode | Useful / Not useful, move stage. |
| `POST /api/tasks` | passcode | Create call task, (re)draft email. |
| `POST /api/rescore` | passcode | Recompute every lead from current `radar_config`. |

---

## 4. Data flow

```
05:00 IST  cron ingest ─► Google News RSS (9 lanes, when:7d, hl=en-IN)
              │  dedupe (normalised title) ─► raw_items      ingestion_runs (ok, failed, fetched)
              ▼
           extract ×≤3 invocations, ≤20 items each
              │  keyword prefilter ─► Gemini Flash (temp 0, JSON schema, title + snippet only)
              ├─ is_policy ─► policy_updates (impact on us, action)
              └─ company   ─► code adds partner_already_selected, programme_in_home_state
                              ─► lib/scoring.ts (weights + gates from radar_config) ─► leads
                                 (unique: company + signal_type + week; conflict = update, not duplicate)
                              ─► if hot and new: task (due next Monday) + email draft + call opener ─► tasks
Paste a link ───────────────────────────────────────────► same path from "Gemini Flash" onwards

05:30 IST Mon  cron digest ─► digests ─► Resend ─► Ananya's phone ─► /digest/2026-W42

Read time: "this week" = posted_at ≥ now(IST) − 7 days, computed in the query. Never stored.
Nothing is ever sent to a company. Drafts are copy-only.
```

**Contacts:** POC fields come only from Gemini's reading of the source text. Empty means the card shows "Not published" and a link to search `"<company> CSR policy"`.

---

## 5. Scoring rules I will hold myself to

- `lib/scoring.ts` mirrors `build_seed.py` function by function, same names in camelCase, same order of operations, same rounding. Python comments go in as TS comments so a reviewer can diff them side by side.
- Every weight, threshold, gate, decay rate (including the 4x slower decay for unspent CSR and new CSR head) is read from `radar_config`. A test fails if a numeric literal other than 0 or 1 appears in `scoring.ts` outside the config defaults file.
- Gemini never returns tier, score or probability. Its schema has no such fields.
- Gate failures map to plain words in one table: `partner_already_selected` becomes "Partner already selected", and so on.

---

## 6. Lead conversion line graph

**Where:** small card on This Week; full version at the top of Pipeline.

**What it plots (x = ISO week, last 12 weeks, IST):** five lines, one per stage reached: found, contacted, meeting, proposal, won. Each point is the number of leads that *entered* that stage that week, from `lead_stage_events`.

**Why not a single "conversion %" line:** today there are 0 won and 0 lost. A rate line would be flat at zero or meaningless. Instead:
- Below the chart: "Found → contacted: 4 of 15 (27%)". These are real counts.
- "Win rate" shows only as `estimate: 8% (formula prior, 0 of 50 outcomes recorded)` until 50 closed outcomes exist, then switches to measured.
- Synthetic rows are excluded unless the Sample data toggle is on, in which case the chart is badged "includes sample data".

**Migration `002_stage_events.sql`:** `lead_stage_events(id, lead_id, from_stage, to_stage, changed_at)`; backfill one `new` event per existing lead at `created_at`. Stage moves write an event in the same request.

Rendered as a hand-drawn SVG (~80 lines), muted tier palette, readable at 375px, tap a point for exact numbers.

---

## 6b. Scoring rules as fitted to the CSV

`score = signal + recency + sector + geo + budget − partner_penalty`, clamped 0..100.

| Part | Rule (all values in radar_config) |
|---|---|
| Signal | new_initiative 22 · unspent_csr 20 · event_or_vlog 6 · annual_report_mention 6 · partner_search 30* · csr_tender_or_eoi 30* · new_csr_head 18* |
| Recency | effective days ≤2: 20 · ≤7: 15 · ≤14: 7 · ≤30: 2 · older: 0. Unspent CSR and new CSR head age at ¼ speed. |
| Sector | Skill Development 15 · Youth Employment 15 · Digital Literacy 13 · Education 10 · other 0 |
| Geo | home city (Pune aliases) 20 · home state 15 · programme runs in home state 15 · pan-India 10 · other 0 |
| Budget | unknown 3 · under Rs 1 Cr 5 · Rs 1–10 Cr 10 · Rs 10 Cr+ 15* |
| Penalty | −15 if an outside partner is already selected or the company runs it in house (its own foundation does not count) |
| Gates (block hot only) | too_old (effective days > 14) · outside_footprint (geo 0) · partner_already_selected · implemented_in_house |
| Tier | hot ≥ 75 and no gate fails · warm ≥ 55 · else cold |
| Estimate | `2 + 38 × (score/100)²` percent |
| Proven funder | outside partner selected, in home state (or programme runs there), focus sector |

\* not exercised by the 15 rows: reasoned defaults, editable in Settings.

## 6c. Live RSS probe (12 Oct 2026, 17:10 IST)

9 of 9 lanes returned 200, 74 items. Real signals found: Bharat Electronics moved Rs 75.21 Cr to its Unspent CSR Account; AM/NS India digital skilling for Odisha youth; Zeta, ETASHA/BT, Birla Cable (already in the CSV). Lane "appointed CSR head" is mostly noise and lane "CSR implementation partner NGO" returned 0. Both get retuned in Phase 2.

## 6d. Lusha: contacts and lead generation

**Account (12 Oct 2026):** free plan, 40 credits, 100 calls a day. Email reveal 1 credit, phone reveal 5, contact search 1 per 25 results, signals 1 per signal. That covers about 30 email reveals in total, so nothing in the app spends credits automatically.

**Done:** one search (2 credits) for CSR roles at the 15 seed companies → 10 candidates at 9 companies, seeded into `lead_contacts` with `source = 'lusha'`. Nothing revealed.

**Contact rule (extends "never invent contacts"):** a contact is either `source_text` (named in the article) or `lusha` (a Lusha record, with its match type and date). The drawer shows them in two separate groups. Lusha never overwrites `poc_name`. If both are empty, the drawer shows "Not published" plus the CSR policy search link.

**In the app (Phase 3):**
- Drawer, Contacts section: "Named in source" first, then "From Lusha". Each Lusha row has a "Reveal email · 1 credit" button. Phone reveal (5 credits) sits behind a second confirm.
- Each lead has a "Find CSR contact in Lusha" button (1 credit per 25 results). It is on demand only and never runs from the cron.
- Every credit spent is written to `lusha_spend`. Settings shows credits used this month against a cap (`lusha_monthly_cap` in radar_config, default 30). Routes refuse to run past the cap.
- `contacts` and `lusha_spend` have no public read policy. Emails and phones are served only to a session that has entered the passcode.

**Lead generation via Lusha (proposal, not built):** a weekly "new CSR head" lane. It finds contacts with CSR titles at Maharashtra companies who have a `companyChange` or `promotion` signal in the last 30 days, and each one becomes a `new_csr_head` lead (18 points, slow decay). That costs about 1 credit plus 1 per signal found, so on the free plan it should be a manual button, not a cron.

**Key caveat:** the Lusha connector works in this Claude Code session only. The deployed app needs `LUSHA_API_KEY` for Lusha's REST API, and the free plan's API access must be checked in Phase 2. Without it, the in-app buttons are hidden and enrichment stays a manual step that I run from here.

## 7. Phases (each ends with a "works / does not work" report)

**Phase 1. Data and scoring**
- [ ] Create Supabase project and run the SQL there (waiting on your go-ahead or keys)
- [x] `seed/schema.sql` (stage events folded in, no separate migration needed), `seed/seed_live.sql` generated from the CSV, verified on Postgres via PGlite
- [ ] `seed/seed_synthetic.sql` (small, badged)
- [x] `lib/scoring.ts`, `lib/config.ts`, `lib/week.ts`, `lib/format.ts`
- [x] Tests: 36 of 36 pass. All 15 CSV rows match score, tier, all 5 parts, flags, gates, estimate, proven funder.

**Phase 2. Ingestion**
- [ ] Confirm Gemini Flash model name from Google docs
- [ ] `rss.ts`, `prefilter.ts`, `gemini.ts`, `pipeline.ts`, ingest + extract routes
- [ ] Run ingest locally against live RSS; show the `ingestion_runs` row and extracted leads
- [ ] Re-run the Zeta example and confirm score 60, warm, proven funder

**Phase 3. Dashboard**
- [ ] This Week, drawer, Proven Funders (Jan to Mar banner), Pipeline kanban, Policy, Paste a link, Settings + Rescore
- [ ] Conversion chart
- [ ] Sample data toggle (off by default, every synthetic row badged)
- [ ] Verify in the browser at 1280px and 375px, with screenshots

**Phase 4. Tasks and digest**
- [ ] Auto task + email draft + opener for every new hot lead
- [ ] Tasks page with copy buttons
- [ ] Digest builder, `/digest/[week]`, Resend send. Send one real test to `DIGEST_TO_EMAIL` and confirm it arrives.

**Phase 5. Deploy**
- [ ] GitHub repo, Vercel project, env vars, crons
- [ ] Trigger one live ingest on production, confirm it shows in the coverage strip
- [ ] README (under 10 steps), `COMPONENTS_MAP.md`
- [ ] Final check against "done means"

---

## 8. Environment variables

`GEMINI_API_KEY`, `GEMINI_MODEL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `DIGEST_TO_EMAIL`, `CRON_SECRET`, `ADMIN_PASSCODE` (new, see F3), `LUSHA_API_KEY` (optional, see 6d).

No Claude or Anthropic API anywhere in the app.
