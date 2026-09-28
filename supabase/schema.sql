-- Run once in the Supabase SQL editor.
--
-- Only the service-role key may touch these tables, and that key lives in a
-- server environment variable, never in a VITE_ one. Row level security is on
-- with no policies, so the anon key can read nothing.

create extension if not exists citext;
create extension if not exists pgcrypto;

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text not null check (length(name) between 1 and 60),
  email citext unique not null,
  consent_at timestamptz,            -- null if the box was not ticked
  consent_version text not null,     -- e.g. '2026-09-v1', the exact wording shown
  utm jsonb
);

create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid unique not null references leads(id) on delete cascade,
  persona text[] not null,
  persona_other text check (persona_other is null or length(persona_other) <= 40),
  recovery text not null,
  created_at timestamptz default now()
);

create index if not exists leads_created_at_idx on leads (created_at desc);

alter table leads enable row level security;
alter table answers enable row level security;

-- Export the waitlist as CSV:
--   select l.created_at, l.name, l.email, l.consent_at, l.consent_version,
--          a.persona, a.persona_other, a.recovery
--   from leads l left join answers a on a.lead_id = l.id
--   order by l.created_at desc;

-- Delete on request (DPDP): one statement, answers go with it.
--   delete from leads where email = 'someone@example.com';
