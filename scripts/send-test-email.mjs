// Sends one waitlist confirmation email to an address you choose, using the
// same template as the Edge Function. Never touches the database.
//
//   npm run email:test -- you@example.com "Your Name"
//
// Reads RESEND_API_KEY (and optional EMAIL_FROM) from .env.local.
// Add --preview to write the HTML to .tmp/waitlist-confirmation.html instead
// of sending.

import { mkdirSync, writeFileSync } from 'node:fs';
import { Resend } from 'resend';
import { cleanEmail, renderWaitlistConfirmation } from '../supabase/functions/_shared/emails/waitlist-confirmation.js';

const args = process.argv.slice(2);
const preview = args.includes('--preview');
const [to, name = 'Friend'] = args.filter((a) => a !== '--preview');

const rendered = renderWaitlistConfirmation({ name });

if (preview) {
  mkdirSync('.tmp', { recursive: true });
  // Point images and fonts at the local copies, so the preview works before
  // they are deployed.
  const local = rendered.html.replace(/https:\/\/clean-ratio\.com\/(email|fonts)\//g, '../public/$1/');
  writeFileSync('.tmp/waitlist-confirmation.html', local);
  writeFileSync('.tmp/waitlist-confirmation.txt', rendered.text);
  console.log('Wrote .tmp/waitlist-confirmation.html and .txt');
  process.exit(0);
}

const email = cleanEmail(to);
if (!email) {
  console.error('Usage: npm run email:test -- you@example.com "Your Name"');
  process.exit(1);
}
if (!process.env.RESEND_API_KEY) {
  console.error('RESEND_API_KEY is not set in .env.local');
  process.exit(1);
}

const resend = new Resend(process.env.RESEND_API_KEY);
const { data, error } = await resend.emails.send({
  from: process.env.EMAIL_FROM || 'Clean Ratio <socials@clean-ratio.com>',
  to: email,
  replyTo: 'socials@clean-ratio.com',
  ...rendered,
});

if (error) {
  console.error('Resend rejected the send:', error.name, error.message);
  process.exit(1);
}
console.log(`Sent to ${email} (Resend id ${data?.id})`);
