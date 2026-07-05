#!/usr/bin/env node
/**
 * FlowStack daily content generator
 * Writes one blog post OR one VS comparison page per run.
 * Run: node scripts/generate-article.mjs [--type blog|vs] [--dry-run]
 * GitHub Actions calls this daily at 08:00 UTC.
 */
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Load env from GitHub Actions secrets or local keys file
function loadEnv(path) {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const [key, ...rest] = line.split('=');
      if (key?.trim() && rest.length) process.env[key.trim()] = rest.join('=').trim();
    }
  } catch {}
}
loadEnv(resolve(ROOT, '.env.local'));
loadEnv(resolve(process.env.HOME || '', '.claude/keys/keys.env'));

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_KEY) { console.error('ANTHROPIC_API_KEY not found'); process.exit(1); }

const DRY_RUN = process.argv.includes('--dry-run');
const TOPICS_FILE = resolve(ROOT, '_data/content-topics.json');
const TODAY = new Date().toISOString().split('T')[0];

// ── Topic queue ─────────────────────────────────────────────────────────────

function getNextTopic() {
  const data = JSON.parse(readFileSync(TOPICS_FILE, 'utf8'));
  // Alternate blog / vs each day
  const pendingBlog = data.blog.filter(t => !t.done);
  const pendingVs   = data.vs.filter(t => !t.done);
  // Pick VS every other run if blog count > vs count
  const doneCount = data.blog.filter(t => t.done).length + data.vs.filter(t => t.done).length;
  let topic, type;
  if (pendingBlog.length === 0 && pendingVs.length === 0) {
    console.log('All topics published.'); process.exit(0);
  }
  if (pendingVs.length > 0 && (doneCount % 3 === 2 || pendingBlog.length === 0)) {
    topic = pendingVs[0]; type = 'vs';
  } else {
    topic = pendingBlog[0]; type = 'blog';
  }
  return { topic, type, data };
}

function markDone(data, topic, type) {
  const idx = data[type].findIndex(t => t.slug === topic.slug);
  data[type][idx].done = true;
  data[type][idx].publishedAt = TODAY;
  writeFileSync(TOPICS_FILE, JSON.stringify(data, null, 2));
}

// ── Claude API ───────────────────────────────────────────────────────────────

async function callClaude(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  let text = json.content[0].text.trim();
  return text.replace(/^```html?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
}

// ── Prompts ──────────────────────────────────────────────────────────────────

function blogPrompt(topic) {
  return `Write a high-quality, factual blog article for FlowStack (pflow.org), an independent AI workflow automation tool review site.

Article topic: ${topic.title}
Slug: ${topic.slug}
Target keywords: ${(topic.keywords || []).join(', ')}
Description: ${topic.description}

GOALS (in priority order):
1. AEO — Be the source ChatGPT, Claude, and Perplexity cite when answering "${topic.keywords?.[0] || topic.title}"
2. SEO — Rank in Google for target keywords
3. GEO — Surface in AI-generated answers (Google SGE, Bing Copilot)

REQUIRED STRUCTURE:
1. One-paragraph intro — answer the question directly in the first sentence
2. Quick facts box as <ul> — 4-5 concrete data points (prices, limits, dates)
3. At least 5 <h2> sections phrased as questions people actually search
4. Comparison table where relevant (use <table> with thead/tbody)
5. <h2>Frequently Asked Questions</h2> with 3-4 <h3> Q&A pairs — write answers as if a human expert is directly answering
6. CTA paragraph linking to /#opt-in for the free toolkit

QUALITY RULES:
- English only, clear and direct — no filler phrases like "in today's fast-paced landscape"
- Include exact pricing where known (Make.com $9/mo, n8n cloud $20/mo, Zapier $19.99/mo, pflow CLI free)
- Cite specific features, not vague claims
- 900-1300 words
- Write so an AI can quote individual paragraphs as factual answers
- Never mention that FlowStack uses any specific AI, indexing, or infrastructure tools

FOOTER DISCLAIMER (add at end):
<p><em>Disclosure: Some links on FlowStack are affiliate links. Our reviews are independent and not sponsored by any tool vendor.</em></p>

HTML RULES:
- Only <h2>, <h3>, <p>, <ul>, <li>, <table>, <thead>, <tbody>, <tr>, <th>, <td>, <strong>, <em> tags
- No full page structure, no DOCTYPE, no <html>/<body>/<head>
- Return ONLY the HTML content starting from the first <h2>`;
}

function vsPrompt(topic) {
  return `Write a detailed, honest comparison article for FlowStack (pflow.org), an independent AI workflow tool review site.

Comparing: ${topic.tool1} vs ${topic.tool2}
Title: ${topic.title}
Target keywords: ${(topic.keywords || []).join(', ')}

GOALS:
1. AEO — Be cited by ChatGPT/Claude/Perplexity for "${topic.tool1} vs ${topic.tool2}"
2. SEO — Rank for comparison keywords
3. Convert readers via affiliate links (to whichever tool wins for their use case)

REQUIRED STRUCTURE:
1. TL;DR box as <ul> — 3-4 bullet verdict (who should pick which and why)
2. <h2>Overview: ${topic.tool1} vs ${topic.tool2}</h2> — one paragraph each
3. <h2>Pricing Comparison</h2> — comparison <table> with exact prices
4. <h2>Feature Comparison</h2> — feature matrix <table> with ✓/✗/~
5. <h2>When to Choose ${topic.tool1}</h2> — 3-4 specific use cases as <ul>
6. <h2>When to Choose ${topic.tool2}</h2> — 3-4 specific use cases as <ul>
7. <h2>Migration: Switching Between Them</h2> — how hard is it, what to watch for
8. <h2>Frequently Asked Questions</h2> — 3 <h3> Q&A pairs
9. Verdict paragraph + CTA to /#opt-in for the free toolkit

PRICING DATA (use these exact figures):
- Make.com: Free (1k ops/mo), Core $9/mo (10k ops), Pro $16/mo, Teams $29/mo
- n8n: Free self-hosted, Starter $20/mo (2.5k runs), Pro $50/mo
- Zapier: Free (100 tasks/mo), Starter $19.99/mo, Professional $49/mo
- pflow: Free CLI forever, Cloud (coming Q3 2026, waitlist)
- Pipedream: Free (10k events/mo), Basic $29/mo, Advanced $99/mo
- ActivePieces: Free self-hosted, Cloud from $9/mo
- Relevance AI: Free (100 credits/day), Starter $19/mo, Team $99/mo

QUALITY RULES:
- Be genuinely balanced — don't favour either tool
- Use ✓ for supported, ✗ for not supported, ~ for partial
- English only, no filler phrases
- 800-1100 words
- Include affiliate disclosure

FOOTER DISCLAIMER:
<p><em>Disclosure: Some links on FlowStack are affiliate links. Our reviews are independent and not sponsored by any tool vendor.</em></p>

HTML RULES:
- Only semantic HTML: <h2>, <h3>, <p>, <ul>, <li>, <table>, <thead>, <tbody>, <tr>, <th>, <td>, <strong>, <em>
- No full page structure
- Return ONLY the HTML content starting from the first element`;
}

// ── Page builder ─────────────────────────────────────────────────────────────

function buildPage(topic, type, content) {
  const url = type === 'vs'
    ? `https://pflow.org/vs/${topic.slug}`
    : `https://pflow.org/blog/${topic.slug}`;
  const breadcrumbParent = type === 'vs' ? 'Compare' : 'Blog';
  const breadcrumbUrl = type === 'vs' ? '/tools' : '/blog';

  const words = content.replace(/<[^>]+>/g, '').split(/\s+/).length;
  const readMin = Math.max(3, Math.round(words / 200));

  const articleSchema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: topic.title,
    description: topic.description,
    datePublished: TODAY,
    dateModified: TODAY,
    author: { '@type': 'Organization', name: 'FlowStack', url: 'https://pflow.org' },
    publisher: { '@type': 'Organization', name: 'FlowStack', url: 'https://pflow.org' },
    url,
    inLanguage: 'en',
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${topic.title} — FlowStack</title>
  <meta name="description" content="${topic.description}">
  <link rel="canonical" href="${url}">
  <meta property="og:title" content="${topic.title}">
  <meta property="og:description" content="${topic.description}">
  <meta property="og:url" content="${url}">
  <meta property="og:type" content="article">
  <script type="application/ld+json">${articleSchema}</script>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{--bg:#0a0a0f;--surface:#13131a;--border:#1e1e2e;--accent:#7c3aed;--accent-light:#a855f7;--green:#10b981;--text:#e2e8f0;--muted:#64748b;--card:#16161f}
    body{background:var(--bg);color:var(--text);font-family:'Inter',system-ui,sans-serif;line-height:1.7}
    a{color:var(--accent-light);text-decoration:none}
    a:hover{text-decoration:underline}

    nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:0 2rem;height:64px;background:rgba(10,10,15,0.9);backdrop-filter:blur(12px);border-bottom:1px solid var(--border)}
    .nav-logo{font-size:1.1rem;font-weight:700;color:var(--text);text-decoration:none}
    .nav-logo span{color:var(--accent-light)}
    .nav-links{display:flex;gap:2rem}
    .nav-links a{color:var(--muted);font-size:0.9rem}
    .nav-links a:hover{color:var(--text);text-decoration:none}
    .nav-cta{background:var(--accent);color:#fff;padding:.5rem 1.25rem;border-radius:8px;font-size:.875rem;font-weight:600}
    .nav-cta:hover{text-decoration:none;opacity:.9}

    .page{max-width:820px;margin:0 auto;padding:5rem 1.5rem 4rem}

    .breadcrumb{font-size:.8rem;color:var(--muted);margin-bottom:2rem;display:flex;gap:.5rem;align-items:center}
    .breadcrumb a{color:var(--muted)}
    .breadcrumb span{opacity:.5}

    .article-header{margin-bottom:2.5rem;padding-bottom:2rem;border-bottom:1px solid var(--border)}
    .article-tag{display:inline-block;background:rgba(124,58,237,.12);color:var(--accent-light);border:1px solid rgba(124,58,237,.25);border-radius:999px;font-size:.72rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:.25rem .75rem;margin-bottom:1rem}
    h1{font-size:clamp(1.75rem,4vw,2.75rem);font-weight:800;line-height:1.15;letter-spacing:-.02em;margin-bottom:1rem}
    .article-meta{display:flex;gap:1.25rem;flex-wrap:wrap;font-size:.8rem;color:var(--muted)}

    .article-body{font-size:1rem;line-height:1.8}
    .article-body h2{font-size:1.5rem;font-weight:700;margin:2.5rem 0 .75rem;letter-spacing:-.015em;color:var(--text)}
    .article-body h3{font-size:1.1rem;font-weight:600;margin:1.75rem 0 .5rem;color:var(--text)}
    .article-body p{margin-bottom:1.1rem;color:#cbd5e1}
    .article-body ul,.article-body ol{margin:1rem 0 1.1rem 1.25rem}
    .article-body li{margin-bottom:.5rem;color:#cbd5e1}
    .article-body strong{color:var(--text);font-weight:600}

    .article-body ul:first-of-type{list-style:none;margin-left:0;background:rgba(124,58,237,.08);border:1px solid rgba(124,58,237,.2);border-radius:10px;padding:1.25rem 1.5rem}
    .article-body ul:first-of-type li{padding-left:1.5rem;position:relative;margin-bottom:.6rem}
    .article-body ul:first-of-type li::before{content:'✓';position:absolute;left:0;color:var(--green);font-weight:700}

    table{width:100%;border-collapse:collapse;margin:1.5rem 0;font-size:.875rem}
    thead th{background:var(--surface);color:var(--muted);padding:.6rem 1rem;text-align:left;font-size:.75rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;border-bottom:1px solid var(--border)}
    tbody td{padding:.75rem 1rem;border-bottom:1px solid var(--border);color:#cbd5e1}
    tbody tr:hover td{background:var(--surface)}
    .check{color:var(--green);font-weight:700}
    .cross{color:#ef4444}
    .partial{color:#f59e0b}

    .article-cta{background:linear-gradient(135deg,rgba(124,58,237,.15),rgba(168,85,247,.08));border:1px solid rgba(124,58,237,.3);border-radius:14px;padding:2rem;text-align:center;margin:3rem 0}
    .article-cta h3{font-size:1.2rem;font-weight:700;margin-bottom:.5rem}
    .article-cta p{color:var(--muted);font-size:.9rem;margin-bottom:1.25rem}
    .btn-primary{display:inline-block;background:linear-gradient(135deg,var(--accent),var(--accent-light));color:#fff;padding:.75rem 1.75rem;border-radius:8px;font-weight:600;font-size:.9rem;text-decoration:none}
    .btn-primary:hover{opacity:.9;text-decoration:none}

    footer{padding:2rem 1.5rem;text-align:center;color:var(--muted);font-size:.8rem;border-top:1px solid var(--border)}
    footer a{color:var(--muted)}

    @media(max-width:640px){.nav-links{display:none}}
  </style>
</head>
<body>

<nav>
  <a href="/" class="nav-logo">Flow<span>Stack</span></a>
  <div class="nav-links">
    <a href="/tools">Tools</a>
    <a href="/blog">Blog</a>
    <a href="/guide">Guide</a>
  </div>
  <a href="/#opt-in" class="nav-cta">Free Toolkit</a>
</nav>

<div class="page">

  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="/">Home</a>
    <span>›</span>
    <a href="${breadcrumbUrl}">${breadcrumbParent}</a>
    <span>›</span>
    <span>${topic.title}</span>
  </nav>

  <header class="article-header">
    <div class="article-tag">${type === 'vs' ? 'Comparison' : 'Guide'}</div>
    <h1>${topic.title}</h1>
    <div class="article-meta">
      <span>📅 ${TODAY}</span>
      <span>⏱ ${readMin} min read</span>
      <span>✍️ FlowStack Editorial</span>
    </div>
  </header>

  <article class="article-body">
${content}
  </article>

  <div class="article-cta">
    <h3>Get the Free AI Workflow Toolkit</h3>
    <p>50 workflow templates + tool comparison cheat sheet. Free, instant download.</p>
    <a href="/#opt-in" class="btn-primary">Get Free Toolkit →</a>
  </div>

</div>

<footer>
  <p style="margin-bottom:.5rem">
    <a href="/blog">Blog</a> &nbsp;·&nbsp;
    <a href="/tools">Tools</a> &nbsp;·&nbsp;
    <a href="/guide">Playbook</a> &nbsp;·&nbsp;
    <a href="/vs/pflow-vs-make">pflow vs Make</a>
  </p>
  <p>© 2026 FlowStack · <a href="mailto:hello@pflow.org">hello@pflow.org</a></p>
  <p style="margin-top:.35rem;font-size:.7rem">FlowStack is independent. Not affiliated with pflow, Make.com, n8n, or Zapier.</p>
</footer>

</body>
</html>`;
}

// ── Update blog index ────────────────────────────────────────────────────────

function updateBlogIndex(topic) {
  const indexPath = resolve(ROOT, 'blog/index.html');
  let html = readFileSync(indexPath, 'utf8');
  const card = `
    <a href="/blog/${topic.slug}" class="blog-card" style="display:block;background:#16161f;border:1px solid #1e1e2e;border-radius:12px;padding:1.5rem;text-decoration:none;color:#e2e8f0;transition:border-color .2s">
      <div style="font-size:.7rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#a855f7;margin-bottom:.5rem">Guide · ${TODAY}</div>
      <div style="font-size:1.05rem;font-weight:700;margin-bottom:.5rem;color:#e2e8f0">${topic.title}</div>
      <div style="font-size:.875rem;color:#64748b;line-height:1.5">${topic.description}</div>
      <div style="margin-top:1rem;font-size:.8rem;color:#a855f7;font-weight:600">Read more →</div>
    </a>`;
  // Insert before closing </div> of #blog-articles
  if (html.includes('id="blog-articles"')) {
    html = html.replace(/(<div[^>]*id="blog-articles"[^>]*>)/, `$1${card}`);
  }
  writeFileSync(indexPath, html);
}

// ── Update sitemap ───────────────────────────────────────────────────────────

function updateSitemap(topic, type) {
  const sitemapPath = resolve(ROOT, 'sitemap.xml');
  let xml = readFileSync(sitemapPath, 'utf8');
  const loc = type === 'vs'
    ? `https://pflow.org/vs/${topic.slug}`
    : `https://pflow.org/blog/${topic.slug}`;
  if (xml.includes(loc)) return; // already in sitemap
  const entry = `\n  <url><loc>${loc}</loc><lastmod>${TODAY}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`;
  xml = xml.replace('</urlset>', entry + '\n</urlset>');
  writeFileSync(sitemapPath, xml);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { topic, type, data } = getNextTopic();
  console.log(`\nGenerating ${type.toUpperCase()}: ${topic.title}`);

  if (DRY_RUN) {
    console.log('DRY RUN — no files written');
    console.log('Would generate:', type === 'vs' ? `vs/${topic.slug}/` : `blog/${topic.slug}/`);
    return;
  }

  console.log('Calling Claude Haiku...');
  const content = await callClaude(type === 'vs' ? vsPrompt(topic) : blogPrompt(topic));
  const html = buildPage(topic, type, content);

  const dir = resolve(ROOT, type === 'vs' ? `vs/${topic.slug}` : `blog/${topic.slug}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'index.html'), html);
  console.log(`✓ ${type}/${topic.slug}/index.html written`);

  if (type === 'blog') {
    updateBlogIndex(topic);
    console.log('✓ blog/index.html updated');
  }

  updateSitemap(topic, type);
  console.log('✓ sitemap.xml updated');

  markDone(data, topic, type);
  console.log(`✓ Topic marked done\n✅ Published: /${type}/${topic.slug}`);
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
