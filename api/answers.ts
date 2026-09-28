import { clientIp, type ApiHandler } from './_http';
import { rateLimited, saveAnswers } from './_store';
import { answersSchema, fieldErrors } from '../src/lib/schema';

const handler: ApiHandler = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).setHeader('allow', 'POST').json({ error: 'method_not_allowed' });
    return;
  }

  // The schema is the allow-list: unknown persona or recovery values, more
  // than two picks, or an over-long "something else" never reach the database.
  const parsed = answersSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid', fields: fieldErrors(parsed.error) });
    return;
  }

  if (await rateLimited(`answers:${clientIp(req)}`)) {
    res.status(429).json({ error: 'rate_limited' });
    return;
  }

  const { leadId, persona, personaOther, recovery } = parsed.data;

  try {
    await saveAnswers({
      lead_id: leadId,
      persona,
      persona_other: persona.includes('other') ? (personaOther ?? null) : null,
      recovery,
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[answers] failed', err);
    res.status(500).json({ error: 'server_error' });
  }
};

export default handler;
