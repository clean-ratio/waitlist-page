-- Confirmation email on sign-up. Run once in the Supabase SQL editor, AFTER the
-- waitlist-confirmation Edge Function is deployed (safe to re-run).
--
-- Adds a trigger on public.leads. No table, column, row, grant or policy
-- changes, and join_waitlist() is untouched.
--
-- How it works: after a NEW lead is inserted, the trigger queues an HTTP POST
-- (pg_net) to the Edge Function with { lead_id, name, email }. pg_net sends it
-- in the background once the sign-up has committed, so the visitor's request
-- never waits on it, and a failed send cannot undo the sign-up. A repeat
-- sign-up inserts nothing (on conflict do nothing), so it sends nothing. The
-- per-IP limit in join_waitlist() (request_log) gates every insert, and so
-- every email.
--
-- Before running, store the function URL and the shared secret in Vault
-- (Project → Settings → Vault, or in this editor). Use the same secret you set
-- with `supabase secrets set WAITLIST_WEBHOOK_SECRET=…`:
--
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/waitlist-confirmation',
--                              'waitlist_confirmation_url');
--   select vault.create_secret('<the same long random secret>', 'waitlist_webhook_secret');
--
-- Until both exist the trigger does nothing (sign-ups still work).

create extension if not exists pg_net with schema extensions;

create or replace function public.send_waitlist_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
begin
  -- Nothing in here may ever fail the insert.
  begin
    select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'waitlist_confirmation_url';
    select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'waitlist_webhook_secret';

    if v_url is null or v_secret is null then
      raise warning 'waitlist confirmation: vault secrets not set, no email sent';
      return new;
    end if;

    perform net.http_post(
      url     := v_url,
      body    := jsonb_build_object('lead_id', new.id, 'name', new.name, 'email', new.email),
      headers := jsonb_build_object('content-type', 'application/json', 'x-webhook-secret', v_secret),
      timeout_milliseconds := 10000
    );
  exception when others then
    raise warning 'waitlist confirmation: could not queue email for lead %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.send_waitlist_confirmation() from public, anon, authenticated;

drop trigger if exists leads_send_confirmation on public.leads;
create trigger leads_send_confirmation
  after insert on public.leads
  for each row execute function public.send_waitlist_confirmation();

-- To turn the email off without touching anything else:
--   drop trigger if exists leads_send_confirmation on public.leads;
--
-- To see recent sends and their responses (kept for ~6 hours by pg_net):
--   select id, status_code, content, error_msg, created
--   from net._http_response order by created desc limit 20;
