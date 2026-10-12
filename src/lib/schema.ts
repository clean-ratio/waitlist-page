import { z } from 'zod';

/**
 * One schema, used by the hero form and the profile questions. The database
 * functions in supabase/schema.sql re-check the same rules on the way in.
 */

/** The exact wording shown next to the consent box. Stored with every lead. */
export const CONSENT_VERSION = '2026-10-v3';
export const CONSENT_TEXT =
  'I agree to Clean Ratio storing these details and emailing me updates.';

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

/**
 * The Lifestyle & Recovery Profile: three pick-a-few questions and one scale.
 * Optional, and only offered to people who keep scrolling past the form.
 *
 * Option values are stored as-is and checked again in supabase/schema.sql, so
 * adding or renaming one means updating the allow-list there too. Labels and
 * lines can be reworded freely.
 */
export const PROFILE_QUESTIONS = [
  {
    key: 'lifestyle',
    kicker: 'Lifestyle',
    question: 'Who are you, _mostly_?',
    max: 2,
    options: [
      { value: 'fitness', label: 'Fitness Enthusiast', line: 'Early runs, heavy lifts, race calendars' },
      { value: 'foodie', label: 'Foodie', line: 'Plans trips around dinners' },
      { value: 'tech', label: 'Tech Enthusiast', line: 'Ten tabs, three screens, one more build' },
      { value: 'entrepreneur', label: 'Entrepreneur', line: 'Always on, rarely off' },
      { value: 'professional', label: 'Business Professional', line: 'Back-to-back calls and flights' },
      { value: 'parent', label: 'On-the-Go Parent', line: 'School runs and a full calendar' },
      { value: 'creative', label: 'Creative', line: 'Design, art, music, making' },
      { value: 'traveller', label: 'Frequent Traveller', line: 'Airports feel like home' },
      { value: 'wellness', label: 'Wellness Seeker', line: 'Yoga, pilates, long walks' },
      { value: 'carer', label: 'Carer & Shift Worker', line: 'Doctors, nurses, night shifts' },
      { value: 'other', label: 'Something else', line: 'Tell us in a few words' },
    ],
  },
  {
    key: 'approach',
    kicker: 'Your recovery',
    question: 'How do you _recover_ today?',
    max: 3,
    options: [
      { value: 'sleep', label: 'Sleep & rest', line: 'An early night fixes most things' },
      { value: 'movement', label: 'Movement', line: 'Stretching, mobility, an easy walk' },
      { value: 'thermal', label: 'Heat & cold', line: 'Saunas, cold plunges, contrast' },
      { value: 'nature', label: 'Time outdoors', line: 'Sea, trees, open sky' },
      { value: 'nutrition', label: 'Food & hydration', line: 'Eating and drinking well' },
      { value: 'bodywork', label: 'Massage & bodywork', line: 'Hands-on, or a foam roller' },
      { value: 'unplug', label: 'Unplugging', line: 'Screens off, phone away' },
      { value: 'none', label: 'I don’t, really', line: 'That is why I am here' },
    ],
  },
  {
    key: 'focus',
    kicker: 'What you need',
    question: 'What would you most like _help_ with?',
    max: 2,
    options: [
      { value: 'cooling', label: 'Cooling down', line: 'After heat, sun, or a hard session' },
      { value: 'muscle', label: 'Muscle recovery', line: 'Soreness, tightness, heavy legs' },
      { value: 'skin', label: 'Skin recovery', line: 'Sun, travel, and tired skin' },
      { value: 'sleep', label: 'Sleep & stress', line: 'Switching off at the end of the day' },
    ],
  },
] as const;

export type ProfileQuestion = (typeof PROFILE_QUESTIONS)[number];
export type ProfileKey = ProfileQuestion['key'];

export const REST_SCALE = [
  { value: 'ritual', label: "Yes, it's a ritual now" },
  { value: 'trying', label: "I'm working on it" },
  { value: 'not_yet', label: 'Not yet, and I know it' },
  { value: 'never', label: 'Rest? Never heard of her' },
] as const;

export type Rest = (typeof REST_SCALE)[number]['value'];

export const LIFESTYLE_OTHER_MAX = 40;

const valuesOf = (key: ProfileKey) =>
  PROFILE_QUESTIONS.find((q) => q.key === key)!.options.map(
    (o) => o.value,
  ) as unknown as [string, ...string[]];

const picks = (key: ProfileKey) => {
  const max = PROFILE_QUESTIONS.find((q) => q.key === key)!.max;
  return z.array(z.enum(valuesOf(key))).max(max, `Pick up to ${max}.`);
};

/**
 * Every question is optional: a partial profile is still worth having. The
 * email ties it to the waitlist entry once there is somewhere to store both.
 */
export const answersSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().optional(),
    lifestyle: picks('lifestyle'),
    lifestyleOther: z.string().trim().max(LIFESTYLE_OTHER_MAX).optional(),
    approach: picks('approach'),
    focus: picks('focus'),
    rest: z.enum(REST_SCALE.map((r) => r.value) as unknown as [string, ...string[]]).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.lifestyle.includes('other') && !value.lifestyleOther) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lifestyleOther'],
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
