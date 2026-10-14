-- One sign-up per email. Run once in the Supabase SQL editor (safe to re-run).
-- Needs phone-migration.sql to have been run first (it has, on the live project).
--
-- Replaces public.join_waitlist() only, with the same arguments as now, so its
-- grants carry over. No table, column, row, grant or policy changes.

-- Joins the waitlist. Returns the new lead id, which the page needs to attach
-- the profile, or null if the email is already on the list: one sign-up per
-- email, and the existing entry is never changed. (Null rather than an error,
-- so the request still counts towards the rate limit; an error would roll
-- that back and make the list free to probe.)
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

-- Tell the API about the change now, not on its next refresh.
notify pgrst, 'reload schema';
