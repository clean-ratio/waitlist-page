import {
  clientIp,
  htmlPage,
  wantsHtml,
  type ApiHandler,
  type ApiRequest,
} from './_http';
import { rateLimited, sendConfirmation, upsertLead } from './_store';
import { CONSENT_VERSION, fieldErrors, waitlistSchema } from '../src/lib/schema';

const handler: ApiHandler = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).setHeader('allow', 'POST').json({ error: 'method_not_allowed' });
    return;
  }

  const parsed = waitlistSchema.safeParse(normaliseBody(req));
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    if (wantsHtml(req)) {
      res
        .status(400)
        .send(
          htmlPage(
            'Check that again',
            `<p>${escapeHtml(Object.values(errors)[0] ?? 'Something was missing.')}</p>
             <p><a href="/">Back</a></p>`,
          ),
        );
      return;
    }
    res.status(400).json({ error: 'invalid', fields: errors });
    return;
  }

  const { name, email, consent, company, utm } = parsed.data;

  // Honeypot. Answer exactly like a success so the bot learns nothing, and
  // write nothing.
  if (company && company.trim() !== '') {
    if (wantsHtml(req)) {
      res.status(200).send(htmlPage('Thank you', thanksBody(name)));
      return;
    }
    res.status(200).json({ leadId: '00000000-0000-4000-8000-000000000000', already: false });
    return;
  }

  if (await rateLimited(clientIp(req))) {
    if (wantsHtml(req)) {
      res
        .status(429)
        .send(
          htmlPage(
            'One moment',
            '<p>That was a lot of tries. Give it a minute and go again.</p>',
          ),
        );
      return;
    }
    res.status(429).json({ error: 'rate_limited' });
    return;
  }

  try {
    const result = await upsertLead({
      name,
      email,
      consent,
      consentVersion: CONSENT_VERSION,
      utm,
    });

    // Only on a first sign-up, and never blocking the response.
    if (!result.already) void sendConfirmation(email, result.name);

    if (wantsHtml(req)) {
      res.status(200).send(htmlPage('Thank you', thanksBody(result.name)));
      return;
    }
    res.status(200).json({ leadId: result.leadId, already: result.already });
  } catch (err) {
    console.error('[waitlist] failed', err);
    if (wantsHtml(req)) {
      res
        .status(500)
        .send(
          htmlPage(
            'Something went wrong',
            '<p>We could not save that just now. Please try again in a moment.</p>',
          ),
        );
      return;
    }
    res.status(500).json({ error: 'server_error' });
  }
};

export default handler;

/** Accepts both the JSON fetch from React and the plain HTML form fallback. */
function normaliseBody(req: ApiRequest): Record<string, unknown> {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const utm =
    typeof body.utm === 'string'
      ? safeJson(body.utm)
      : (body.utm as Record<string, string> | undefined);
  return { ...body, utm };
}

function safeJson(value: string): Record<string, string> | undefined {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function thanksBody(name: string): string {
  return `<p>Thank you, ${escapeHtml(name)}.</p>
          <p>Your details have been received.</p>
          <p><a href="/">Back</a></p>`;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
