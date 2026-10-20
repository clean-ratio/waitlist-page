/**
 * The waitlist confirmation email: subject, HTML and plain text.
 *
 * Edit the copy in COPY below. Everything else is layout. Plain JavaScript on
 * purpose, so the same file is used by the Supabase Edge Function (Deno) that
 * sends it and by `npm run email:test` (Node).
 *
 * Colours are the page's own (src/styles/tokens.css). Email clients ignore
 * <style> blocks and web fonts unevenly, so every style is inline and the type
 * falls back to Georgia / system sans.
 */

export const COPY = {
  subject: "You're on the list",
  preheader: "You're on the list. We'll be in touch when the ice breaks.",
  greeting: (name) => `Hi ${name},`,
  headline: "You're on the list. We'll be in touch when the ice breaks.",
  next: 'Nothing to do in the meantime. We will write when there is something worth your time: first access, and a little of what we have been making.',
  reply: 'If you want to reach us before then, just reply to this email. It comes straight to us.',
  signoff: 'Clean Ratio',
};

const COLOR = {
  bone: '#edf0e8',
  paper: '#f8f7f1',
  ink: '#1a271f',
  stone: '#4d5d51',
  hairline: '#d4d9d0',
};

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

/** Escapes text for HTML element content and attribute values. */
export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * The name as it should appear in the greeting: control characters and line
 * breaks removed, whitespace collapsed, at most 60 characters (the database
 * limit). Returns '' if nothing usable is left.
 */
export function cleanName(name) {
  return String(name ?? '')
    // Control, invisible-format (bidi overrides, zero-width) and line/paragraph separators.
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
    .trim();
}

/** Same rule as join_waitlist() in supabase/schema.sql. Returns the email or null. */
export function cleanEmail(email) {
  const value = String(email ?? '').trim().toLowerCase();
  return value.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) ? value : null;
}

/** @param {{ name: string }} lead  @returns {{ subject: string, html: string, text: string }} */
export function renderWaitlistConfirmation({ name }) {
  const first = cleanName(name) || 'there';
  const greeting = COPY.greeting(first);

  const text = [
    'CLEAN RATIO',
    '',
    greeting,
    '',
    COPY.headline,
    '',
    COPY.next,
    '',
    COPY.reply,
    '',
    COPY.signoff,
    'clean-ratio.com',
  ].join('\n');

  const p = (content, extra = '') =>
    `<p style="margin:0 0 24px;font-family:${SANS};font-size:16px;line-height:1.62;color:${COLOR.stone};${extra}">${content}</p>`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(COPY.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLOR.bone};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${COLOR.bone};">${escapeHtml(COPY.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLOR.bone};">
  <tr>
    <td align="center" style="padding:56px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:${COLOR.paper};border:1px solid ${COLOR.hairline};">
        <tr>
          <td style="padding:48px 40px 8px;">
            <p style="margin:0 0 48px;font-family:${SERIF};font-size:15px;letter-spacing:0.32em;text-transform:uppercase;color:${COLOR.ink};">Clean Ratio</p>
            <p style="margin:0 0 24px;font-family:${SERIF};font-size:22px;line-height:1.4;color:${COLOR.ink};">${escapeHtml(greeting)}</p>
            <p style="margin:0 0 32px;font-family:${SERIF};font-size:26px;line-height:1.35;color:${COLOR.ink};">${escapeHtml(COPY.headline)}</p>
            <div style="height:1px;line-height:1px;font-size:0;background-color:${COLOR.hairline};margin:0 0 32px;">&nbsp;</div>
            ${p(escapeHtml(COPY.next))}
            ${p(escapeHtml(COPY.reply))}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 40px 48px;">
            <p style="margin:0;font-family:${SERIF};font-size:16px;color:${COLOR.ink};">${escapeHtml(COPY.signoff)}</p>
          </td>
        </tr>
      </table>
      <p style="margin:24px 0 0;font-family:${SANS};font-size:12px;letter-spacing:0.06em;color:${COLOR.stone};">
        <a href="https://clean-ratio.com" style="color:${COLOR.stone};text-decoration:none;">clean-ratio.com</a>
      </p>
    </td>
  </tr>
</table>
</body>
</html>`;

  return { subject: COPY.subject, html, text };
}
