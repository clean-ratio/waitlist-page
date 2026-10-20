/**
 * Sends the waitlist confirmation email. Supabase Edge Function (Deno).
 *
 * Called only by the database: the leads_send_confirmation trigger
 * (supabase/confirmation-email.sql) posts { lead_id, name, email } here through
 * pg_net after a new lead is inserted. That call is queued and runs after the
 * sign-up has committed, so this function can never slow down or undo a
 * registration. Repeat sign-ups insert nothing, so they send nothing.
 *
 * Secrets (supabase secrets set …): RESEND_API_KEY, WAITLIST_WEBHOOK_SECRET,
 * and optionally EMAIL_FROM.
 */

import { Resend } from 'npm:resend@6.34.1';
import { cleanEmail, renderWaitlistConfirmation } from '../_shared/emails/waitlist-confirmation.js';

const FROM = Deno.env.get('EMAIL_FROM') || 'Clean Ratio <socials@clean-ratio.com>';
const REPLY_TO = 'socials@clean-ratio.com';

const apiKey = Deno.env.get('RESEND_API_KEY') ?? '';
const webhookSecret = Deno.env.get('WAITLIST_WEBHOOK_SECRET') ?? '';
const resend = apiKey ? new Resend(apiKey) : null;

/** Compares without returning early, so timing does not reveal the secret. */
function sameSecret(given: string, expected: string): boolean {
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i];
  return diff === 0;
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  if (!webhookSecret || !sameSecret(req.headers.get('x-webhook-secret') ?? '', webhookSecret)) {
    return json(401, { error: 'unauthorized' });
  }

  const body = (await req.json().catch(() => null)) as { lead_id?: unknown; name?: unknown; email?: unknown } | null;
  const leadId = typeof body?.lead_id === 'string' ? body.lead_id : '';
  const email = cleanEmail(body?.email);
  if (!leadId || !email) return json(400, { error: 'invalid_payload' });

  if (!resend) {
    console.error('[waitlist-confirmation] RESEND_API_KEY is not set');
    return json(500, { error: 'not_configured' });
  }

  try {
    const { subject, html, text } = renderWaitlistConfirmation({ name: String(body?.name ?? '') });
    const { data, error } = await resend.emails.send(
      { from: FROM, to: email, replyTo: REPLY_TO, subject, html, text },
      // One email per lead even if this request is ever repeated.
      { idempotencyKey: `waitlist-confirmation/${leadId}` },
    );
    if (error) {
      console.error('[waitlist-confirmation] Resend rejected the send', leadId, error.name, error.message);
      return json(502, { error: 'send_failed' });
    }
    return json(200, { id: data?.id });
  } catch (err) {
    console.error('[waitlist-confirmation] send threw', leadId, err);
    return json(502, { error: 'send_failed' });
  }
});
