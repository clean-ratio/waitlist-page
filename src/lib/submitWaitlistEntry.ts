import type { AnswersPayload } from './schema';

/**
 * The one place the page hands data off. Both functions deliberately save
 * nothing yet; replace their bodies when a database is chosen.
 */

export type WaitlistSubmission = {
  saved: false;
};

export async function submitWaitlistEntry(
  _name: string,
  _email: string,
): Promise<WaitlistSubmission> {
  // TODO: connect a database here. This placeholder deliberately saves nothing.
  return { saved: false };
}

export async function submitProfile(
  _profile: AnswersPayload,
): Promise<WaitlistSubmission> {
  // TODO: store alongside the waitlist entry, keyed by email.
  return { saved: false };
}
