-- Clean Ratio waitlist. Run once in the Supabase SQL editor (safe to re-run).
--
-- How access works:
--   * The page uses the project's *publishable* (anon) key, which is public by
--     design. With it, a visitor can do exactly two things: call
--     join_waitlist() and save_profile(). Nothing else.
--   * Row level security is on with no policies, and table privileges are
--     revoked, so that key can never read, list, change or delete a row.
--   * Both functions validate everything themselves. The allow-lists below
--     must match src/lib/schema.ts; if an option is added there, add it here.

create table if not exists public.leads (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  name            text not null check (length(name) between 1 and 60),
  email           text not null unique check (email = lower(email) and length(email) <= 254),
  consent_at      timestamptz not null,
  consent_version text not null,
  utm             jsonb,
  referrer        text,
  -- Optional. Always E.164 (+919876543210), or null; never the typed string.
  phone           text check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$')
);

-- For databases created before the phone field.
alter table public.leads add column if not exists phone text;

create table if not exists public.profiles (
  lead_id         uuid primary key references public.leads (id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  lifestyle       text[] not null default '{}',
  lifestyle_other text check (lifestyle_other is null or length(lifestyle_other) <= 40),
  approach        text[] not null default '{}',
  focus           text[] not null default '{}',
  rest            text
);

-- Short-lived per-IP counter for rate limiting. Rows older than a day are
-- cleared as new requests arrive, so no IP is kept for long.
create table if not exists public.request_log (
  id   bigint generated always as identity primary key,
  kind text not null,
  ip   text not null,
  at   timestamptz not null default now()
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists request_log_lookup_idx on public.request_log (kind, ip, at desc);

alter table public.leads enable row level security;
alter table public.profiles enable row level security;
alter table public.request_log enable row level security;

revoke all on public.leads, public.profiles, public.request_log from anon, authenticated;

-- ---------------------------------------------------------------------------

create or replace function public.allow_request(p_kind text, p_limit int, p_window interval)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_headers json := nullif(current_setting('request.headers', true), '')::json;
  v_ip text := btrim(split_part(coalesce(
    v_headers ->> 'cf-connecting-ip',
    v_headers ->> 'x-forwarded-for',
    v_headers ->> 'x-real-ip',
    ''), ',', 1));
  v_count int;
begin
  if v_ip = '' then
    return true; -- no address to count against (e.g. the SQL editor)
  end if;

  delete from public.request_log where at < now() - interval '1 day';

  select count(*) into v_count
  from public.request_log
  where kind = p_kind and ip = v_ip and at > now() - p_window;

  if v_count >= p_limit then
    return false;
  end if;

  insert into public.request_log (kind, ip) values (p_kind, v_ip);
  return true;
end;
$$;

-- Joins the waitlist. Returns the new lead id, which the page needs to attach
-- the profile, or null if the email is already on the list: one sign-up per
-- email, and the existing entry is never changed. (Null rather than an error,
-- so the request still counts towards the rate limit; an error would roll
-- that back and make the list free to probe.)
--
-- The version before the phone field took six arguments. Two overloads would
-- make PostgREST's choice ambiguous, so the old one goes. This drops only the
-- function, never data.
drop function if exists public.join_waitlist(text, text, boolean, text, jsonb, text);

create or replace function public.join_waitlist(
  p_name            text,
  p_email           text,
  p_consent         boolean,
  p_consent_version text,
  p_utm             jsonb default null,
  p_referrer        text default null,
  p_phone           text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name  text := btrim(coalesce(p_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_utm   jsonb := p_utm;
  v_id    uuid;
begin
  if not public.allow_request('join', 10, interval '10 minutes') then
    raise exception 'rate_limited' using errcode = 'PT429';
  end if;

  if length(v_name) not between 1 and 60 then
    raise exception 'invalid_name' using errcode = 'PT400';
  end if;
  if length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email' using errcode = 'PT400';
  end if;
  -- The page normalises with libphonenumber-js (src/lib/phone.ts) and sends
  -- E.164. This is the gate for anything that skips the page.
  if v_phone is not null and v_phone !~ '^\+[1-9][0-9]{6,14}$' then
    raise exception 'invalid_phone' using errcode = 'PT400';
  end if;
  if p_consent is not true then
    raise exception 'consent_required' using errcode = 'PT400';
  end if;
  if length(coalesce(p_consent_version, '')) not between 1 and 40 then
    raise exception 'invalid_consent_version' using errcode = 'PT400';
  end if;
  if v_utm is not null and (jsonb_typeof(v_utm) <> 'object' or length(v_utm::text) > 2000) then
    v_utm := null;
  end if;

  insert into public.leads (name, email, consent_at, consent_version, utm, referrer, phone)
  values (v_name, v_email, now(), p_consent_version, v_utm, left(p_referrer, 500), v_phone)
  on conflict (email) do nothing
  returning id into v_id;

  return v_id; -- null when the email was already there
end;
$$;

-- Saves (or replaces) the Lifestyle & Recovery Profile for a lead. Needs both
-- the id and the matching email, so an id alone is not enough to write.
create or replace function public.save_profile(
  p_lead_id         uuid,
  p_email           text,
  p_lifestyle       text[] default '{}',
  p_lifestyle_other text default null,
  p_approach        text[] default '{}',
  p_focus           text[] default '{}',
  p_rest            text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lifestyle text[] := coalesce(p_lifestyle, '{}');
  v_approach  text[] := coalesce(p_approach, '{}');
  v_focus     text[] := coalesce(p_focus, '{}');
  v_other     text := nullif(btrim(coalesce(p_lifestyle_other, '')), '');
begin
  if not public.allow_request('profile', 20, interval '10 minutes') then
    raise exception 'rate_limited' using errcode = 'PT429';
  end if;

  if not exists (
    select 1 from public.leads
    where id = p_lead_id and email = lower(btrim(coalesce(p_email, '')))
  ) then
    raise exception 'unknown_lead' using errcode = 'PT404';
  end if;

  if cardinality(v_lifestyle) > 2 or not v_lifestyle <@ array[
    'fitness', 'foodie', 'tech', 'entrepreneur', 'professional', 'parent',
    'creative', 'traveller', 'wellness', 'carer', 'other'
  ] then
    raise exception 'invalid_lifestyle' using errcode = 'PT400';
  end if;
  if cardinality(v_approach) > 3 or not v_approach <@ array[
    'sleep', 'movement', 'thermal', 'nature', 'nutrition', 'bodywork', 'unplug', 'none'
  ] then
    raise exception 'invalid_approach' using errcode = 'PT400';
  end if;
  if cardinality(v_focus) > 2 or not v_focus <@ array['cooling', 'muscle', 'skin', 'sleep'] then
    raise exception 'invalid_focus' using errcode = 'PT400';
  end if;
  if p_rest is not null and p_rest not in ('ritual', 'trying', 'not_yet', 'never') then
    raise exception 'invalid_rest' using errcode = 'PT400';
  end if;

  if 'other' = any (v_lifestyle) then
    if v_other is null or length(v_other) > 40 then
      raise exception 'invalid_lifestyle_other' using errcode = 'PT400';
    end if;
  else
    v_other := null;
  end if;

  insert into public.profiles (lead_id, lifestyle, lifestyle_other, approach, focus, rest)
  values (p_lead_id, v_lifestyle, v_other, v_approach, v_focus, p_rest)
  on conflict (lead_id) do update
    set lifestyle       = excluded.lifestyle,
        lifestyle_other = excluded.lifestyle_other,
        approach        = excluded.approach,
        focus           = excluded.focus,
        rest            = excluded.rest,
        updated_at      = now();
end;
$$;

-- Only the two entry points are callable from the page.
revoke all on function public.allow_request(text, int, interval) from public, anon, authenticated;
revoke all on function public.join_waitlist(text, text, boolean, text, jsonb, text, text) from public;
revoke all on function public.save_profile(uuid, text, text[], text, text[], text[], text) from public;
grant execute on function public.join_waitlist(text, text, boolean, text, jsonb, text, text) to anon, authenticated;
grant execute on function public.save_profile(uuid, text, text[], text, text[], text[], text) to anon, authenticated;

-- One row per person, profile alongside. Open it in Table Editor, or export
-- it as CSV from the SQL editor results.
create or replace view public.waitlist_export
with (security_invoker = true) as
select l.created_at, l.name, l.email, l.consent_at, l.consent_version,
       p.lifestyle, p.lifestyle_other, p.approach, p.focus, p.rest,
       l.utm, l.referrer, l.phone
from public.leads l
left join public.profiles p on p.lead_id = l.id
order by l.created_at desc;

revoke all on public.waitlist_export from anon, authenticated;

-- Delete someone on request (their profile goes with it):
--   delete from public.leads where email = 'someone@example.com';
