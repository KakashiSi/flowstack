#!/usr/bin/env node
import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnv(path) {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const [key, ...rest] = line.split('=');
      if (key?.trim() && rest.length) process.env[key.trim()] = rest.join('=').trim();
    }
  } catch {}
}

loadEnv(resolve(process.env.HOME, '.claude/keys/keys.env'));

const API_KEY = process.env.SPEEDYINDEX_API_KEY;
if (!API_KEY) { console.error('SPEEDYINDEX_API_KEY niet gevonden'); process.exit(1); }

const URLS = [
  'https://pflow.org/',
  'https://pflow.org/guide',
  'https://pflow.org/tools',
  'https://pflow.org/blog',
  'https://pflow.org/blog/what-is-pflow',
  'https://pflow.org/blog/best-ai-workflow-tools-2026',
  'https://pflow.org/blog/reduce-ai-agent-costs',
  'https://pflow.org/blog/free-ai-workflow-tools',
  'https://pflow.org/vs/pflow-vs-make',
  'https://pflow.org/vs/pflow-vs-n8n',
  'https://pflow.org/vs/pflow-vs-zapier',
];

const res = await fetch('https://api.speedyindex.com/v2/task/google/indexer/create', {
  method: 'POST',
  headers: { Authorization: API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ urls: URLS, pay_per_indexed: true }),
});

if (!res.ok) { console.error('API fout', res.status, await res.text()); process.exit(1); }
const data = await res.json();
console.log(`✓ ${URLS.length} URLs ingediend bij SpeedyIndex`);
console.log(JSON.stringify(data, null, 2));
