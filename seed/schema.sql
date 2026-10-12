-- CSR Partnership Radar schema. Run once on a fresh Supabase project, then seed_live.sql.
-- "This week" is never stored: queries filter posted_at at read time.


create table if not exists radar_config (
  id          int primary key default 1 check (id = 1),
  config      jsonb not null,
  updated_at  timestamptz not null default now()
);

create table if not exists ingestion_runs (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null default 'ingest',        -- ingest | extract | paste | rescore
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  feeds_total     int not null default 0,
  feeds_ok        int not null default 0,
  feeds_failed    int not null default 0,
  items_fetched   int not null default 0,
  items_new       int not null default 0,
  items_relevant  int not null default 0,
  leads_created   int not null default 0,
  errors          jsonb not null default '[]'::jsonb
);

create table if not exists raw_items (
  id               uuid primary key default gen_random_uuid(),
  run_id           uuid references ingestion_runs(id) on delete set null,
  lane             text not null,                         -- QUERIES key, or 'paste'
  title            text not null,
  title_norm       text not null unique,                  -- dedupe key
  link             text not null,                         -- Google redirect URL stored as is
  source_name      text,
  snippet          text,
  published_at     timestamptz,
  fetched_at       timestamptz not null default now(),
  prefilter_pass   boolean not null default false,
  status           text not null default 'new',           -- new | skipped | extracted | irrelevant | error
  extracted_at     timestamptz,
  extraction       jsonb,
  error            text
);
create index if not exists raw_items_status_idx on raw_items (status, prefilter_pass);

create table if not exists leads (
  id                     uuid primary key default gen_random_uuid(),
  lead_id                text unique,                     -- LIVE-008, SYN-001, RSS-...
  raw_item_id            uuid references raw_items(id) on delete set null,
  company_name           text not null,
  industry               text,
  csr_focus_area         text,
  city                   text,
  state                  text,
  geo_scope              text,                            -- city | state | pan_india | other
  programme_states       text[] not null default '{}',
  poc_name               text,                            -- only ever from source text
  poc_designation        text,
  poc_email              text,
  poc_phone              text,
  poc_linkedin           text,
  contact_source         text,
  source_type            text,                            -- news | press_release | annual_report | linkedin | paste
  source_name            text,
  post_link              text,
  signal_type            text not null,
  budget_inr_cr          numeric,
  budget_basis           text,
  posted_at              timestamptz not null,
  posted_time_precision  text,
  implementation_partner text,
  beneficiaries          text,
  summary                text,
  why_now                text,
  extraction_confidence  text not null default 'high',   -- high (verified / full text) | low (RSS title + snippet)
  -- score: plain code from radar_config, recomputed daily and on "Rescore all"
  priority_score         int not null default 0,
  probability_of_conversion_pct numeric not null default 0,
  tier                   text not null default 'cold' check (tier in ('hot','warm','cold')),
  score_signal           int not null default 0,
  score_recency          int not null default 0,
  score_sector_fit       int not null default 0,
  score_geo_fit          int not null default 0,
  score_budget_fit       int not null default 0,
  flags                  text[] not null default '{}',
  hot_gate_fails         text[] not null default '{}',
  proven_funder          boolean not null default false,
  recommended_action     text,
  scored_at              timestamptz,
  -- CRM
  pipeline_stage         text not null default 'new'
    check (pipeline_stage in ('new','contacted','meeting','proposal','won','lost','parked')),
  owner                  text default 'Ananya',
  feedback               text check (feedback in ('useful','not_useful')),
  is_synthetic           boolean not null default false,
  verified_at            date,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- One lead per company, signal type and IST week.
create unique index if not exists leads_company_signal_week_uidx on leads (
  lower(company_name), signal_type,
  (date_trunc('week', (posted_at at time zone 'Asia/Kolkata')))
);
create index if not exists leads_posted_idx on leads (posted_at desc);

create table if not exists lead_stage_events (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references leads(id) on delete cascade,
  from_stage  text,
  to_stage    text not null,
  changed_at  timestamptz not null default now()
);
create index if not exists lead_stage_events_changed_idx on lead_stage_events (changed_at);

-- Contacts with provenance. 'source_text' = named in the article (never invented).
-- 'lusha' = Lusha record; email/phone only after an explicit, credit-counted reveal.
create table if not exists lead_contacts (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references leads(id) on delete cascade,
  source        text not null check (source in ('source_text','lusha')),
  match         text check (match in ('same_as_source','csr_role','adjacent_role')),
  lusha_id      text,
  name          text not null,
  title         text,
  city          text,
  state         text,
  linkedin      text,
  email         text,
  phone         text,
  can_reveal    text[] not null default '{}',
  revealed_at   timestamptz,
  found_at      timestamptz not null default now(),
  unique (lead_id, lusha_id)
);

create table if not exists lusha_spend (
  id            uuid primary key default gen_random_uuid(),
  action        text not null,                            -- search | reveal_email | reveal_phone
  credits       int not null,
  lead_id       uuid references leads(id) on delete set null,
  note          text,
  spent_at      timestamptz not null default now()
);

create table if not exists policy_updates (
  id             uuid primary key default gen_random_uuid(),
  raw_item_id    uuid references raw_items(id) on delete set null,
  title          text not null,
  source_name    text,
  link           text,
  published_at   timestamptz,
  summary        text,
  impact_on_us   text,
  action         text,
  is_synthetic   boolean not null default false,
  created_at     timestamptz not null default now()
);

create table if not exists tasks (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid references leads(id) on delete cascade,
  kind          text not null default 'call',             -- call | email | follow_up
  title         text not null,
  due_date      date,
  status        text not null default 'open' check (status in ('open','done','dropped')),
  email_subject text,
  email_draft   text,                                     -- drafted, never sent to a company
  call_opener   text,
  is_synthetic  boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists digests (
  id           uuid primary key default gen_random_uuid(),
  week         text not null unique,                      -- 2026-W42 (ISO week, IST)
  subject      text not null,
  html         text not null,
  text         text not null,
  payload      jsonb not null,
  sent_at      timestamptz,
  send_error   text,
  created_at   timestamptz not null default now()
);

-- Reads go through the anon key; writes only through server routes with the service role key.
alter table radar_config      enable row level security;
alter table ingestion_runs    enable row level security;
alter table raw_items         enable row level security;
alter table leads             enable row level security;
alter table lead_stage_events enable row level security;
alter table policy_updates    enable row level security;
alter table tasks             enable row level security;
alter table digests           enable row level security;
alter table lead_contacts     enable row level security;
alter table lusha_spend       enable row level security;

do $$
declare t text;
begin
  foreach t in array array['radar_config','ingestion_runs','leads','lead_stage_events','policy_updates','tasks','digests'] loop
    execute format('drop policy if exists "public read" on %I', t);
    execute format('create policy "public read" on %I for select using (true)', t);
  end loop;
end $$;
