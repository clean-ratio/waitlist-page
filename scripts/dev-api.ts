import { loadEnv, type Plugin, type ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ApiHandler, ApiRequest, ApiResponse } from '../api/_http';

/**
 * Vite has no server, so `/api/*.ts` only runs on Vercel. This plugin mounts
 * the same handlers on the dev server so the waitlist works with `npm run dev`.
 * It reproduces the three things Vercel does for us: environment variables,
 * body parsing, and the `status().json()` response helpers.
 */
export default function devApi(): Plugin {
  return {
    name: 'dev-api',

    config(_config, { mode }) {
      /*
       * Vite only hands `VITE_*` to the client bundle, and deliberately so.
       * The API handlers run here in Node and read `process.env`, which Vite
       * never touches — so load .env/.env.local ourselves. The empty prefix
       * means "every variable, not just the public ones".
       *
       * Real environment variables win, so `SUPABASE_URL=... npm run dev`
       * still overrides the file.
       */
      const env = loadEnv(mode, process.cwd(), '');
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value;
      }
    },

    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith('/api/')) return next();

        const route = url.split('?')[0].replace(/^\/api\//, '').replace(/\/$/, '');
        if (!/^[a-z0-9-]+$/.test(route)) return next();

        try {
          const mod = (await server.ssrLoadModule(`/api/${route}.ts`)) as {
            default?: ApiHandler;
          };
          if (typeof mod.default !== 'function') return next();
          await mod.default(await shimRequest(req), shimResponse(res));
        } catch (err) {
          server.ssrFixStacktrace(err as Error);
          // eslint-disable-next-line no-console
          console.error(`[dev-api] ${route}`, err);
          if (!res.writableEnded) {
            res.statusCode = 500;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ error: 'dev_api_failed' }));
          }
        }
      });
    },
  };
}

async function shimRequest(req: IncomingMessage): Promise<ApiRequest> {
  const raw = await readBody(req);
  const type = String(req.headers['content-type'] ?? '');
  let body: unknown = undefined;

  if (raw) {
    if (type.includes('application/json')) {
      try {
        body = JSON.parse(raw);
      } catch {
        body = undefined;
      }
    } else if (type.includes('application/x-www-form-urlencoded')) {
      body = Object.fromEntries(new URLSearchParams(raw));
    } else {
      body = raw;
    }
  }

  return {
    method: req.method ?? 'GET',
    headers: req.headers as ApiRequest['headers'],
    body,
  };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function shimResponse(res: ServerResponse): ApiResponse {
  const api: ApiResponse = {
    status(code: number) {
      res.statusCode = code;
      return api;
    },
    setHeader(name: string, value: string) {
      res.setHeader(name, value);
      return api;
    },
    json(payload: unknown) {
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(payload));
      return api;
    },
    send(payload: string) {
      if (!res.getHeader('content-type')) {
        res.setHeader('content-type', 'text/html; charset=utf-8');
      }
      res.end(payload);
      return api;
    },
    end() {
      res.end();
      return api;
    },
  };
  return api;
}
