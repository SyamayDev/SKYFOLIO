/**
 * API lokal Hangar (docs/08 bagian 8) — hanya aktif di `npm run dev`, tidak ada di build produksi.
 * Demi keamanan hanya menerima permintaan dari komputer sendiri (loopback), walau dev server dibuka
 * dengan `--host` untuk dicoba di HP. Semua path dibatasi ke folder content/.
 */
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, join, normalize, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import type { ViteDevServer } from 'vite';
import { CONTENT_DIR, ROOT, loadContent } from './lib/content.ts';

const run = promisify(execFile);
const MAX_BODY = 25 * 1024 * 1024;

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((ok, fail) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        fail(new Error('Berkas terlalu besar'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => ok(Buffer.concat(chunks)));
    req.on('error', fail);
  });
}

/** Path aman di dalam content/ (menolak ../). */
function safeContentPath(p: string): string | null {
  const rel = normalize(p.replace(/^\/+/, '').replace(/^content[\\/]/, ''));
  if (rel.startsWith('..')) return null;
  const full = resolve(CONTENT_DIR, rel);
  return relative(CONTENT_DIR, full).startsWith('..') ? null : full;
}

function isLoopback(req: IncomingMessage): boolean {
  const a = req.socket.remoteAddress ?? '';
  return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
}

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

/**
 * Tolak permintaan dari situs lain yang dibuka di browser yang sama (CSRF) dan DNS rebinding:
 * Host wajib localhost, Origin (bila ada) wajib localhost, dan permintaan yang mengubah file wajib membawa
 * header `X-Hangar: 1` — header khusus memicu preflight CORS yang tidak pernah kita setujui.
 */
function isTrusted(req: IncomingMessage): boolean {
  if (!LOCAL_HOST.test(req.headers.host ?? '')) return false;
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (!LOCAL_HOST.test(new URL(origin).host)) return false;
    } catch {
      return false;
    }
  }
  if (req.method !== 'GET' && req.headers['x-hangar'] !== '1') return false;
  return true;
}

async function git(args: string[]): Promise<string> {
  const { stdout, stderr } = await run('git', args, { cwd: ROOT, maxBuffer: 8 * 1024 * 1024 });
  return `${stdout}${stderr}`;
}

export function hangarMiddleware(_server: () => ViteDevServer | null) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (!isLoopback(req) || !isTrusted(req)) return send(res, 403, { error: 'Hangar hanya bisa dibuka dari komputer ini.' });
    const url = new URL(req.url ?? '/', 'http://local');
    try {
      if (req.method === 'GET' && url.pathname === '/content') {
        const { content, issues } = loadContent();
        const draftsDir = join(CONTENT_DIR, 'projects/_drafts');
        const drafts = existsSync(draftsDir) ? readdirSync(draftsDir).filter((n) => n.endsWith('.md')) : [];
        return send(res, 200, { content, issues, drafts });
      }
      if (req.method === 'GET' && url.pathname === '/file') {
        const full = safeContentPath(url.searchParams.get('path') ?? '');
        if (!full || !existsSync(full)) return send(res, 404, { error: 'File tidak ditemukan' });
        return send(res, 200, { text: readFileSync(full, 'utf8') });
      }
      if (req.method === 'PUT' && url.pathname === '/file') {
        const body = JSON.parse((await readBody(req)).toString('utf8')) as { path: string; text: string };
        const full = safeContentPath(body.path);
        if (!full || !/\.(json|md)$/.test(full)) return send(res, 400, { error: 'Path tidak diizinkan' });
        if (full.endsWith('.json')) JSON.parse(body.text); // tolak JSON rusak
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, body.text.endsWith('\n') ? body.text : `${body.text}\n`);
        return send(res, 200, { ok: true, issues: loadContent().issues });
      }
      if (req.method === 'POST' && url.pathname === '/upload') {
        const full = safeContentPath(url.searchParams.get('path') ?? '');
        if (!full || !full.includes(`${join('content', 'media')}`) || !/\.(jpe?g|png|webp|avif|heic|mp4)$/i.test(full)) {
          return send(res, 400, { error: 'Hanya gambar/video ke content/media/' });
        }
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, await readBody(req));
        const out = await run(process.execPath, [resolve(ROOT, 'node_modules/tsx/dist/cli.mjs'), 'scripts/optimize-media.ts'], { cwd: ROOT }).catch((e: Error) => ({ stdout: e.message }));
        return send(res, 200, { ok: true, log: out.stdout });
      }
      if (req.method === 'POST' && url.pathname === '/promote') {
        const body = JSON.parse((await readBody(req)).toString('utf8')) as { name: string };
        const from = safeContentPath(`projects/_drafts/${body.name}`);
        const to = safeContentPath(`projects/${body.name}`);
        if (!from || !to || !existsSync(from)) return send(res, 404, { error: 'Draf tidak ditemukan' });
        renameSync(from, to);
        return send(res, 200, { ok: true });
      }
      if (req.method === 'GET' && url.pathname === '/validate') {
        return send(res, 200, { issues: loadContent().issues });
      }
      if (req.method === 'GET' && url.pathname === '/diff') {
        const status = await git(['status', '--short', '--', 'content', 'public/media']);
        const diff = await git(['diff', '--stat', '--', 'content', 'public/media']);
        const patch = await git(['diff', '--', 'content']);
        return send(res, 200, { status, diff, patch: patch.slice(0, 200_000) });
      }
      if (req.method === 'POST' && url.pathname === '/publish') {
        const body = JSON.parse((await readBody(req)).toString('utf8')) as { message?: string };
        const msg = `content: ${(body.message ?? 'update konten dari Hangar').replace(/[\r\n]+/g, ' ').slice(0, 120)}`;
        const issues = loadContent().issues.filter((i) => i.level === 'error');
        if (issues.length) return send(res, 400, { error: 'Masih ada konten tidak valid', issues });
        let log = await git(['add', 'content', 'public/media']);
        log += await git(['commit', '-m', msg]).catch((e: Error) => `commit: ${e.message}`);
        log += await git(['push']).catch((e: Error) => `\npush gagal (belum ada remote GitHub?): ${e.message}`);
        return send(res, 200, { ok: true, log });
      }
      return send(res, 404, { error: 'Tidak dikenal' });
    } catch (e) {
      return send(res, 500, { error: (e as Error).message });
    }
  };
}
