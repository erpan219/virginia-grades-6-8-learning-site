import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Local-only fixture values. The production config has no defaults for secrets.
const setup = 'local-preview-0123456789abcdef0123456789abcdef';
const origins = process.env.LOCAL_SITE_ORIGIN || 'http://localhost:8000,http://127.0.0.1:8000,http://localhost:4173,http://127.0.0.1:4173,http://localhost:8765,http://127.0.0.1:8765';
const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true,
  scriptPath: fileURLToPath(new URL('./src/worker.js', import.meta.url)),
  compatibilityDate: '2026-11-09',
  host: '127.0.0.1', port: Number(process.env.PORT || 8787),
  d1Databases: ['DB'],
  // Miniflare 5 ignores the legacy d1Persist option. Its shared resource root
  // is explicit so both account records and snapshots survive process restarts.
  resourcePersistencePath: process.env.VA_LOCAL_STATE_DIR || fileURLToPath(new URL('./.local', import.meta.url)),
  bindings: { ALLOWED_ORIGINS: origins, SETUP_CODE: setup, RATE_LIMIT_SALT: 'local-preview-only-0123456789abcdef0123456789' },
}));
const db = await mf.getD1Database('DB');
const schema = await readFile(new URL('./migrations/0001_accounts.sql', import.meta.url), 'utf8');
for (const statement of schema.split(';').map(s => s.trim()).filter(Boolean)) await db.prepare(statement).run();
console.log(`Local account API: ${await mf.ready}`);
console.log(`Local parent setup code (test data only): ${setup}`);
console.log('No Cloudflare resources or real accounts are used.');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await mf.dispose(); process.exit(0); });
