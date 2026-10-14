-- Phone number on the waitlist. Run once in the Supabase SQL editor, BEFORE
-- deploying the page that sends it (safe to re-run).
--
-- Touches only public.leads, public.join_waitlist() and the export view.
-- Not public.profiles, not public.request_log.

-- 1. The column. Skip if you have already added it; this is a no-op then.
alter table public.leads add column if not exists phone text;

-- Optional, if you have not added your own: E.164 only.
-- alter table public.leads add constraint leads_phone_e164
--   check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$');

-- 2. join_waitlist() with p_phone, replacing the six-argument version.
-- Joins the waitlist, or refreshes the entry if the email is already on it.
-- Returns the lead id, which the page needs to attach the profile.
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
  on conflict (email) do update
    set name            = excluded.name,
        -- Joining again without a phone keeps the one already on file.
        phone           = coalesce(excluded.phone, public.leads.phone),
        consent_at      = excluded.consent_at,
        consent_version = excluded.consent_version,
        updated_at      = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.join_waitlist(text, text, boolean, text, jsonb, text, text) from public;
grant execute on function public.join_waitlist(text, text, boolean, text, jsonb, text, text) to anon, authenticated;

-- 3. The export view, with phone as its last column.
create or replace view public.waitlist_export
with (security_invoker = true) as
select l.created_at, l.name, l.email, l.consent_at, l.consent_version,
       p.lifestyle, p.lifestyle_other, p.approach, p.focus, p.rest,
       l.utm, l.referrer, l.phone
from public.leads l
left join public.profiles p on p.lead_id = l.id
order by l.created_at desc;

revoke all on public.waitlist_export from anon, authenticated;

-- 4. Tell the API about the new signature now, not on its next refresh.
notify pgrst, 'reload schema';
