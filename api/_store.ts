import { randomUUID } from 'node:crypto';

/**
 * Storage and email, behind one interface.
 *
 * Every secret is read from a plain (non-`VITE_`) environment variable, so it
 * stays on the server. Vite inlines `VITE_*` into the public bundle — nothing
 * secret may ever live there.
 *
 * With no Supabase credentials configured the module falls back to an
 * in-memory store. That keeps `npm run dev` working before the database
 * exists; it is not persistence, and it says so loudly on boot.
 */

type LeadRow = {
  id: string;
  name: string;
  email: string;
  consent_at: string | null;
  consent_version: string;
  utm: Record<string, string> | null;
};

type AnswerRow = {
  lead_id: string;
  persona: string[];
  persona_other: string | null;
  recovery: string;
};

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const RESEND_KEY = process.env.RESEND_API_KEY ?? '';
const RESEND_FROM = process.env.RESEND_FROM ?? '';

export const hasDatabase = Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);
export const hasEmail = Boolean(RESEND_KEY && RESEND_FROM);

let warned = false;
function warnOnce() {
  if (warned || hasDatabase) return;
  warned = true;
  console.warn(
    '[waitlist] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. ' +
      'Sign-ups are being kept in memory and will be lost on restart.',
  );
}

const memoryLeads = new Map<string, LeadRow>();
const memoryAnswers = new Map<string, AnswerRow>();

/**
 * Supabase over its REST API (PostgREST), with `fetch` and no SDK.
 *
 * `@supabase/supabase-js` builds an auth client, a storage client and a
 * realtime socket that this code never touches — and the realtime client needs
 * a native WebSocket, so on Node 20 `createClient` throws before a single row
 * is written. All we do is four queries against two tables, so we make them
 * directly. That also keeps the serverless bundle small and runs unchanged on
 * Node 18+, Cloudflare Workers or Deno.
 *
 * The service-role key bypasses row level security, which is why it must never
 * leave the server.
 */
async function rest(
  path: string,
  init: { method?: string; body?: unknown; prefer?: string } = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    apikey: SUPABASE_SERVICE_KEY,
    authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    accept: 'application/json',
  };
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  if (init.prefer) headers.prefer = init.prefer;

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `supabase ${init.method ?? 'GET'} /${path} → ${response.status} ${detail}`,
    );
  }
  return response;
}

/** PostgREST filters go in the query string, so values must be encoded. */
const eq = (value: string) => `eq.${encodeURIComponent(value)}`;

export type UpsertLeadResult = { leadId: string; already: boolean; name: string };

export async function upsertLead(input: {
  name: string;
  email: string;
  consent: boolean;
  consentVersion: string;
  utm?: Record<string, string>;
}): Promise<UpsertLeadResult> {
  warnOnce();
  const consentAt = input.consent ? new Date().toISOString() : null;

  if (!hasDatabase) {
    const existing = memoryLeads.get(input.email);
    if (existing) {
      existing.name = input.name;
      if (consentAt) existing.consent_at = consentAt;
      return { leadId: existing.id, already: true, name: existing.name };
    }
    const row: LeadRow = {
      id: randomUUID(),
      name: input.name,
      email: input.email,
      consent_at: consentAt,
      consent_version: input.consentVersion,
      utm: input.utm ?? null,
    };
    memoryLeads.set(input.email, row);
    return { leadId: row.id, already: false, name: row.name };
  }

  const columns = 'id,name,email,consent_at,consent_version,utm';
  const existing = (await (
    await rest(`leads?email=${eq(input.email)}&select=${columns}&limit=1`)
  ).json()) as LeadRow[];
  const found = existing[0];

  if (found) {
    // A repeat sign-up is never an error. Refresh the name and, if they have
    // now ticked the box, record consent — but never clear consent already given.
    const patch: Record<string, unknown> = { name: input.name };
    if (consentAt) {
      patch.consent_at = consentAt;
      patch.consent_version = input.consentVersion;
    }
    await rest(`leads?id=${eq(found.id)}`, {
      method: 'PATCH',
      body: patch,
      prefer: 'return=minimal',
    });
    return { leadId: found.id, already: true, name: input.name };
  }

  const inserted = (await (
    await rest(`leads?select=${columns}`, {
      method: 'POST',
      body: {
        name: input.name,
        email: input.email,
        consent_at: consentAt,
        consent_version: input.consentVersion,
        utm: input.utm ?? null,
      },
      prefer: 'return=representation',
    })
  ).json()) as LeadRow[];

  const created = inserted[0];
  if (!created) throw new Error('lead_insert_returned_nothing');

  return { leadId: created.id, already: false, name: created.name };
}

export async function saveAnswers(row: AnswerRow): Promise<void> {
  warnOnce();
  if (!hasDatabase) {
    memoryAnswers.set(row.lead_id, row);
    return;
  }
  // One answer row per lead: on_conflict + merge-duplicates makes a second
  // submission overwrite the first instead of failing on the unique index.
  await rest('answers?on_conflict=lead_id', {
    method: 'POST',
    body: row,
    prefer: 'resolution=merge-duplicates,return=minimal',
  });
}

/**
 * Confirmation email. Doubles as proof the address is real. Sent only on a
 * first sign-up, and never allowed to fail the request — the row is already
 * saved by the time we get here.
 */
export async function sendConfirmation(to: string, name: string): Promise<void> {
  if (!hasEmail) return;
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(RESEND_KEY);
    await resend.emails.send({
      from: RESEND_FROM,
      to,
      subject: 'Thanks for stopping by',
      text: [
        `${name},`,
        '',
        'Thanks for sharing your details. They have been received.',
        '',
        'If you did not submit this form, you can ignore this message.',
      ].join('\n'),
    });
  } catch (err) {
    console.error('[waitlist] confirmation email failed', err);
  }
}

/**
 * 5 requests per minute per IP. Uses Upstash Redis when configured; otherwise
 * a per-instance counter, which is best-effort across serverless instances but
 * still stops the obvious flood.
 */
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL ?? '';
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? '';
const WINDOW_MS = 60_000;
const LIMIT = 5;

const memoryHits = new Map<string, number[]>();

export async function rateLimited(key: string): Promise<boolean> {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const res = await fetch(`${UPSTASH_URL}/pipeline`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${UPSTASH_TOKEN}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify([
          ['INCR', `rl:${key}`],
          ['EXPIRE', `rl:${key}`, '60', 'NX'],
        ]),
      });
      const out = (await res.json()) as Array<{ result?: number }>;
      const count = out?.[0]?.result ?? 0;
      return count > LIMIT;
    } catch (err) {
      console.error('[waitlist] rate limit backend failed, allowing', err);
      return false;
    }
  }

  const now = Date.now();
  const hits = (memoryHits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  memoryHits.set(key, hits);
  if (memoryHits.size > 5000) memoryHits.clear();
  return hits.length > LIMIT;
}
