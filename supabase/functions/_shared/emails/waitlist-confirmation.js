/**
 * The waitlist confirmation email: subject, HTML and plain text.
 *
 * Edit the words in COPY below; everything after it is layout. Plain
 * JavaScript on purpose, so the same file is used by the Supabase Edge Function
 * (Deno) that sends it and by `npm run email:test` (Node).
 *
 * In COPY, *words* are set in Fragment Mono for emphasis.
 *
 * Layout: one 600px column, proportioned by the golden ratio. The one image is
 * a 600 x 371 golden rectangle, the wordmark is 229 wide (600 / φ²), spacing
 * steps through 13 · 21 · 34 · 55 · 89 and type through 10 · 16 · 26. Images
 * are built by scripts/email-images.mjs and served from clean-ratio.com/email/;
 * fonts from clean-ratio.com/fonts/. Clients that ignore web fonts (Gmail,
 * Outlook) fall back to system sans and monospace.
 */

export const COPY = {
  subject: "You're on the list 🤫",
  preheader: "Two parts mystery, one part patience.",
  greeting: (firstName) => `Hi ${firstName},`,
  welcome: "Welcome to CLEAN RATIO. You're in.",
  mystery: "Two parts mystery, one part patience. That's our ratio for now. Our lips? Sealed.",
  early: "When the ice breaks, you'll get access *30 minutes* before everyone else.",
  reply: "What brought you here? Hit reply. We'd love to know.",
  share: "Know someone who'd enjoy being in on the beginning? Send them our way:",
  contact: 'socials@clean-ratio.com',
};

const BRAND = 'Clean Ratio';
const ASSETS = 'https://clean-ratio.com';

const COLOR = {
  bone: '#edf0e8',
  paper: '#f8f7f1',
  ink: '#1a271f',
  stone: '#4d5d51',
  hairline: '#d4d9d0',
};

const RANADE = "'Ranade', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO = "'Fragment Mono', 'SFMono-Regular', Menlo, Consolas, 'Courier New', monospace";

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

/** The wordmark image; the width sets its size (the file is 458 x 37, 2x). */
const wordmark = (width) =>
  `<img src="${ASSETS}/email/wordmark.png" width="${width}" height="${Math.round((width * 37) / 458)}" alt="${BRAND}" style="display:block;border:0;outline:none;text-decoration:none;width:${width}px;height:auto;">`;

/** COPY text to HTML: escaped, with *words* in mono. */
const richText = (text) =>
  escapeHtml(text).replace(/\*(.+?)\*/g, `<span style="font-family:${MONO};font-size:0.8em;letter-spacing:0.02em;">$1</span>`);

/** Keeps the last two words together, so a line never ends on one short word. */
const noWidow = (html) => html.replace(/(\S+ \S+)$/, '<span style="white-space:nowrap;">$1</span>');

/** COPY text to plain text. */
const plain = (text) => text.replace(/\*(.+?)\*/g, '$1');

const paragraph = (html, style) =>
  `<p style="margin:0 0 21px;font-family:${RANADE};font-weight:300;font-size:16px;line-height:1.618;color:${COLOR.stone};${style ?? ''}">${html}</p>`;

/** @param {{ name: string }} lead  @returns {{ subject: string, html: string, text: string }} */
export function renderWaitlistConfirmation({ name }) {
  const firstName = cleanName(name).split(' ')[0] || 'there';
  const greeting = COPY.greeting(firstName);

  const text = [
    greeting,
    '',
    plain(COPY.welcome),
    '',
    plain(COPY.mystery),
    '',
    plain(COPY.early),
    '',
    plain(COPY.reply),
    '',
    plain(COPY.share),
    COPY.contact,
    '',
    BRAND,
  ].join('\n');

  const display = `font-size:26px;line-height:1.3;color:${COLOR.ink};`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(COPY.subject)}</title>
<style>
  @font-face { font-family: 'Ranade'; src: url('${ASSETS}/fonts/Ranade-Light.otf') format('opentype'); font-weight: 300; font-style: normal; }
  @font-face { font-family: 'Fragment Mono'; src: url('${ASSETS}/fonts/FragmentMono-Regular.ttf') format('truetype'); font-weight: 400; font-style: normal; }
  @media (max-width: 620px) {
    .pad { padding-left: 21px !important; padding-right: 21px !important; }
  }
</style>
<!--[if mso]><style>body, table, td, p, a, span { font-family: Arial, sans-serif !important; }</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${COLOR.bone};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(COPY.preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLOR.bone};">
  <tr>
    <td align="center" style="padding:34px 0 55px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:${COLOR.paper};">

        <!-- Wordmark: 229 = 600 / φ² -->
        <tr>
          <td align="center" style="padding:55px 21px 34px;"><div style="width:229px;max-width:100%;margin:0 auto;">${wordmark(229)}</div></td>
        </tr>

        <!-- 600 x 371: a golden rectangle -->
        <tr>
          <td><img src="${ASSETS}/email/hero.jpg" width="600" height="371" alt="A glacier arch over breaking ice" style="display:block;border:0;outline:none;width:100%;max-width:600px;height:auto;background-color:${COLOR.bone};"></td>
        </tr>

        <tr>
          <td class="pad" style="padding:55px 89px 34px 55px;">
            <p style="margin:0 0 21px;font-family:${MONO};font-size:10px;line-height:1.618;letter-spacing:0.12em;text-transform:uppercase;color:${COLOR.stone};">${escapeHtml(COPY.subject.replace(/\s*\p{Extended_Pictographic}/gu, ''))}</p>
            ${paragraph(escapeHtml(greeting), `margin:0 0 13px;${display}`)}
            ${paragraph(noWidow(escapeHtml(COPY.welcome)), `margin:0 0 34px;${display}`)}
            ${paragraph(richText(COPY.mystery))}
            ${paragraph(richText(COPY.early), `margin:0 0 34px;font-size:20px;line-height:1.45;color:${COLOR.ink};`)}
            ${paragraph(richText(COPY.reply), 'margin:0 0 34px;')}
            ${paragraph(richText(COPY.share), 'margin:0 0 8px;')}
            <p style="margin:0;font-family:${MONO};font-size:13px;line-height:1.618;letter-spacing:0.04em;">
              <a href="mailto:${escapeHtml(COPY.contact)}" style="color:${COLOR.ink};text-decoration:none;border-bottom:1px solid ${COLOR.hairline};">${escapeHtml(COPY.contact)}</a>
            </p>
          </td>
        </tr>

        <!-- Sign-off -->
        <tr>
          <td class="pad" style="padding:34px 55px 89px;">${wordmark(142)}</td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  return { subject: COPY.subject, html, text };
}
