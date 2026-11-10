/**
 * Menjalankan Vercel Functions di `api/*.ts` saat `npm run dev` (supaya Piko & lampion bisa dicoba lokal
 * dengan key di `.env.local`). Produksi tetap memakai Vercel Functions asli.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnv, type Plugin, type ViteDevServer } from 'vite';

async function toRequest(req: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const body = Buffer.concat(chunks);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  if (!headers.has('x-forwarded-for')) headers.set('x-forwarded-for', req.socket.remoteAddress ?? '127.0.0.1');
  const url = `http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`;
  return new Request(url, { method: req.method, headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body });
}

export function apiPlugin(): Plugin {
  let server: ViteDevServer;
  return {
    name: 'skyfolio-api-dev',
    apply: 'serve',
    configureServer(s) {
      server = s;
      Object.assign(process.env, loadEnv(s.config.mode, s.config.root, ''));
      s.middlewares.use('/api', (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const name = (req.url ?? '/').split('?')[0]!.replace(/^\/+/, '').replace(/\/+$/, '');
        const file = resolve(s.config.root, 'api', `${name}.ts`);
        if (!/^[a-z0-9-]+$/.test(name) || !existsSync(file)) return next();
        void (async () => {
          try {
            const mod = (await server.ssrLoadModule(file)) as Record<string, ((r: Request) => Promise<Response>) | undefined>;
            const fn = mod[req.method ?? 'GET'];
            const out = fn ? await fn(await toRequest(req)) : new Response('{"error":"method_not_allowed"}', { status: 405 });
            res.statusCode = out.status;
            out.headers.forEach((v, k) => res.setHeader(k, v));
            res.end(Buffer.from(await out.arrayBuffer()));
          } catch (e) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: (e as Error).message }));
          }
        })();
      });
    },
  };
}
