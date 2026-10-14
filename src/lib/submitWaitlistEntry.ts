import { CONSENT_VERSION, type AnswersPayload } from './schema';
import { campaign } from './analytics';
import { maskPhonesIn } from './phone';

/**
 * The one place the page hands data off: two Supabase database functions,
 * called over its REST API with the project's publishable key.
 *
 * That key is public by design and safe in the bundle. It can call
 * join_waitlist() and save_profile() and nothing else; it cannot read a single
 * row back (see supabase/schema.sql). No SDK: two POSTs do not need one.
 */

const URL_ = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '');
const KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const hasDatabase = Boolean(URL_ && KEY);

/** A save that has not answered by now counts as failed, so the form can retry. */
const REQUEST_TIMEOUT_MS = 15000;

/** Thrown for any failed save; `code` says what the UI should tell the visitor. */
export class SubmitError extends Error {
  constructor(public code: 'rate_limited' | 'invalid' | 'unavailable' | 'duplicate') {
    super(code);
  }
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  if (!hasDatabase) {
    console.error('[waitlist] VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are not set');
    throw new SubmitError('unavailable');
  }

  let response: Response;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    response = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: KEY, 'content-type': 'application/json' },
      body: JSON.stringify(args),
      signal: controller.signal,
    });
  } catch (err) {
    console.error(`[waitlist] ${fn} request failed`, err);
    throw new SubmitError('unavailable');
  } finally {
    window.clearTimeout(timeout);
  }

  if (!response.ok) {
    // Only the error's code and message: PostgREST's `details` can echo the
    // submitted row, phone number included.
    const body = (await response.json().catch(() => null)) as { code?: string; message?: string } | null;
    console.error(`[waitlist] ${fn} → ${response.status}`, body?.code ?? '', maskPhonesIn(body?.message ?? ''));
    if (response.status === 429) throw new SubmitError('rate_limited');
    // A unique-email clash: two sign-ups with one email at the same moment.
    if (response.status === 409) throw new SubmitError('duplicate');
    if (response.status === 400 || response.status === 404) throw new SubmitError('invalid');
    throw new SubmitError('unavailable');
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

/**
 * Adds them to the waitlist and returns the lead id. Throws
 * SubmitError('duplicate') if the email is already on it; that entry is left
 * as it was. `phone` must already be E.164 (see lib/phone.ts), or null.
 */
export async function submitWaitlistEntry(name: string, email: string, phone: string | null): Promise<string> {
  const { utm, referrer } = campaign();
  const id = await rpc<string | null>('join_waitlist', {
    p_name: name,
    p_email: email,
    // Only sent when given, so sign-ups without a phone also work against a
    // database that has not had supabase/phone-migration.sql run yet.
    ...(phone ? { p_phone: phone } : {}),
    p_consent: true,
    p_consent_version: CONSENT_VERSION,
    p_utm: utm ?? null,
    p_referrer: referrer ?? null,
  });
  if (!id) throw new SubmitError('duplicate');
  return id;
}

/** Saves the profile against the lead; a second save replaces the first. */
export async function submitProfile(leadId: string, profile: AnswersPayload): Promise<void> {
  await rpc<null>('save_profile', {
    p_lead_id: leadId,
    p_email: profile.email ?? '',
    p_lifestyle: profile.lifestyle,
    p_lifestyle_other: profile.lifestyleOther ?? null,
    p_approach: profile.approach,
    p_focus: profile.focus,
    p_rest: profile.rest ?? null,
  });
}

/** Visitor-facing wording for a failed save. */
export function submitErrorMessage(err: unknown): string {
  const code = err instanceof SubmitError ? err.code : 'unavailable';
  if (code === 'rate_limited') return 'That was a lot of tries. Give it a minute and go again.';
  if (code === 'invalid') return 'Something in that did not look right. Please check and try again.';
  return 'We could not save that just now. Please try again in a moment.';
}
