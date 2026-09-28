import { z } from 'zod';

/**
 * One schema, used by the glass form, the questions section and both API
 * routes. If validation changes, it changes in one place.
 */

/** The exact wording shown next to the consent box. Stored with every lead. */
export const CONSENT_VERSION = '2026-09-v2';
export const CONSENT_TEXT =
  'I agree to the use of my name, email, and answers as described in the privacy notice.';

/** Checkboxes arrive as `true`, `"true"` or `"on"` depending on the form. */
const looseBoolean = z.preprocess(
  (v) => v === true || v === 'true' || v === 'on' || v === '1',
  z.boolean(),
);

export const waitlistSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Please tell us your name.')
    .max(60, 'That is longer than we can store.'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .email('That email address does not look right.'),
  consent: looseBoolean,
  /** Honeypot. Bots fill it; humans never see it. */
  company: z.string().max(200).optional(),
  utm: z.record(z.string().max(200)).optional(),
  referrer: z.string().max(500).optional(),
}).superRefine((value, ctx) => {
  if (!value.consent) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['consent'],
      message: 'Please agree to the privacy notice to continue.',
    });
  }
});

export type WaitlistInput = z.input<typeof waitlistSchema>;
export type WaitlistPayload = z.output<typeof waitlistSchema>;

export const PERSONAS = [
  { value: 'builder', label: 'The Builder', line: 'Tech, code, ten tabs open' },
  { value: 'athlete', label: 'The Athlete', line: 'Early runs, heavy lifts' },
  { value: 'gourmand', label: 'The Gourmand', line: 'Plans trips around dinners' },
  { value: 'founder', label: 'The Founder', line: 'Always on, rarely off' },
  { value: 'creative', label: 'The Creative', line: 'Design, art, music, making' },
  { value: 'wanderer', label: 'The Wanderer', line: 'Airports feel like home' },
  { value: 'nightowl', label: 'The Night Owl', line: 'Best ideas after midnight' },
  { value: 'healer', label: 'The Healer', line: 'Doctors, nurses, carers' },
  { value: 'mover', label: 'The Mover', line: 'Yoga, pilates, long walks' },
  { value: 'parent', label: 'The Parent', line: 'Sleep is a rumour' },
  { value: 'gamer', label: 'The Player', line: 'Games, chess, puzzles' },
  { value: 'brain_johnson', label: 'Brain Johnson', line: 'Optimising sleep like a full-time job', vibe: 'mint' },
  { value: 'blanket_burrito', label: 'The Blanket Burrito', line: 'Only emerges for snacks and sunshine', vibe: 'butter' },
  { value: 'playlist_pilot', label: 'The Playlist Pilot', line: 'Has a soundtrack for every moment', vibe: 'sky' },
  { value: 'other', label: 'Something else', line: 'Opens a one-line text field' },
] as const;

export const RECOVERIES = [
  { value: 'ritual', label: "Yes, it's a ritual now" },
  { value: 'trying', label: "I'm working on it" },
  { value: 'not_yet', label: 'Not yet, and I know it' },
  { value: 'never', label: 'Rest? Never heard of her' },
] as const;

export const PERSONA_VALUES = PERSONAS.map((p) => p.value) as unknown as [
  string,
  ...string[],
];
export const RECOVERY_VALUES = RECOVERIES.map((r) => r.value) as unknown as [
  string,
  ...string[],
];

export type Persona = (typeof PERSONAS)[number]['value'];
export type Recovery = (typeof RECOVERIES)[number]['value'];

/** Q1 allows up to two picks — enough for "founder who runs", not a survey. */
export const MAX_PERSONAS = 2;
export const PERSONA_OTHER_MAX = 40;

export const answersSchema = z
  .object({
    leadId: z.string().uuid('We could not find your details.'),
    persona: z
      .array(z.enum(PERSONA_VALUES))
      .min(1, 'Pick at least one.')
      .max(MAX_PERSONAS, `Pick up to ${MAX_PERSONAS}.`),
    personaOther: z.string().trim().max(PERSONA_OTHER_MAX).optional(),
    recovery: z.enum(RECOVERY_VALUES),
  })
  .superRefine((value, ctx) => {
    if (value.persona.includes('other') && !value.personaOther) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['personaOther'],
        message: 'Tell us in a few words.',
      });
    }
  });

export type AnswersInput = z.input<typeof answersSchema>;
export type AnswersPayload = z.output<typeof answersSchema>;

/** Turns a ZodError into `{ fieldName: firstMessage }` for inline errors. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
