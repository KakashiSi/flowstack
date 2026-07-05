#!/usr/bin/env node
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadEnv(path) {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const [key, ...rest] = line.split('=');
      if (key?.trim() && rest.length) process.env[key.trim()] = rest.join('=').trim();
    }
  } catch {}
}
loadEnv(resolve(ROOT, '.env.local'));

const API_KEY = process.env.SPEEDYINDEX_API_KEY;
if (!API_KEY) { console.log('No SPEEDYINDEX_API_KEY — skipping.'); process.exit(0); }

const data = JSON.parse(readFileSync(resolve(ROOT, '_data/content-topics.json'), 'utf8'));
const allDone = [
  ...data.blog.filter(t => t.done).map(t => ({ ...t, type: 'blog' })),
  ...data.vs.filter(t => t.done).map(t => ({ ...t, type: 'vs' })),
].sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));

if (!allDone.length) { console.log('No published topics yet.'); process.exit(0); }

// Submit the most recently published URL
const latest = allDone[0];
const url = latest.type === 'vs'
  ? `https://pflow.org/vs/${latest.slug}`
  : `https://pflow.org/blog/${latest.slug}`;

const res = await fetch('https://api.speedyindex.com/v2/task/google/indexer/create', {
  method: 'POST',
  headers: { Authorization: API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ urls: [url], pay_per_indexed: true }),
});

if (!res.ok) { console.error('SpeedyIndex error', res.status); process.exit(1); }
console.log(`✓ Submitted to SpeedyIndex: ${url}`);
