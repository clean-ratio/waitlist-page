/**
 * The slice of Vercel's request/response objects these handlers actually use.
 * `VercelRequest`/`VercelResponse` satisfy these structurally, so the same
 * files run unchanged on Vercel and under the dev-server shim
 * (`scripts/dev-api.ts`). Netlify Functions or Cloudflare Workers would need
 * their own adapter here and nothing else.
 */
export type ApiRequest = {
  method: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

export type ApiResponse = {
  status(code: number): ApiResponse;
  setHeader(name: string, value: string): ApiResponse;
  json(payload: unknown): ApiResponse;
  send(payload: string): ApiResponse;
  end(): ApiResponse;
};

export type ApiHandler = (
  req: ApiRequest,
  res: ApiResponse,
) => void | Promise<void>;

export function header(req: ApiRequest, name: string): string {
  const value = req.headers[name];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

/** Best-effort client IP, for rate limiting only. */
export function clientIp(req: ApiRequest): string {
  const forwarded = header(req, 'x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return header(req, 'x-real-ip') || 'unknown';
}

/**
 * The no-JS form in index.html posts here as a normal HTML form. Those
 * visitors need HTML back, not JSON.
 */
export function wantsHtml(req: ApiRequest): boolean {
  const accept = header(req, 'accept');
  const type = header(req, 'content-type');
  return (
    type.includes('application/x-www-form-urlencoded') &&
    (accept.includes('text/html') || accept === '')
  );
}

export function htmlPage(title: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  :root { color-scheme: light }
  body { margin:0; min-height:100svh; display:grid; place-items:center;
         background:#F2EFEA; color:#1A1916;
         font:400 15px/1.6 ui-serif, Georgia, "Times New Roman", serif }
  main { max-width: 34ch; padding: 24px; text-align: center }
  p { margin: 0 0 1em }
  a { color: inherit }
</style></head>
<body><main>${body}</main></body></html>`;
}
