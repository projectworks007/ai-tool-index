#!/usr/bin/env node
/**
 * Turns data/*.json into the published site. No network, no secrets — pure transform, so the
 * page can always be rebuilt from the committed data and anyone can verify the numbers.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(ROOT, 'docs');
const weeks = readdirSync(join(ROOT, 'data')).filter((f) => f.endsWith('.json')).sort();
if (!weeks.length) { console.error('nincs adat'); process.exit(1); }

const latest = JSON.parse(readFileSync(join(ROOT, 'data', weeks.at(-1)), 'utf8'));
const prev = weeks.length > 1 ? JSON.parse(readFileSync(join(ROOT, 'data', weeks.at(-2)), 'utf8')) : null;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const CSS = `
:root{--bg:#fff;--fg:#16181d;--muted:#5b6472;--line:#e3e6ea;--accent:#0b5fff;--zero:#98a2b3}
@media(prefers-color-scheme:dark){:root{--bg:#0f1115;--fg:#e8eaed;--muted:#9aa4b2;--line:#242a33;--accent:#6ea8ff;--zero:#5b6472}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
main{max-width:860px;margin:0 auto;padding:2.5rem 1.25rem 5rem}
h1{font-size:1.9rem;line-height:1.25;margin:0 0 .5rem}
h2{font-size:1.25rem;margin:2.75rem 0 .35rem;padding-top:1.25rem;border-top:1px solid var(--line)}
h2:first-of-type{border-top:0;padding-top:0}
.sub{color:var(--muted);margin:0 0 2rem}
.lede{font-size:1.05rem}
table{width:100%;border-collapse:collapse;margin:1rem 0 .5rem;font-size:.95rem}
th,td{text-align:left;padding:.5rem .6rem;border-bottom:1px solid var(--line);vertical-align:top}
th{font-weight:600;color:var(--muted);font-size:.82rem;text-transform:uppercase;letter-spacing:.04em}
td.n{text-align:right;font-variant-numeric:tabular-nums;width:5.5rem;white-space:nowrap}
tr.zero td{color:var(--zero)}
.q{color:var(--muted);font-size:.9rem;margin:.4rem 0 0}
a{color:var(--accent)}
code{background:rgba(128,128,128,.13);padding:.1rem .35rem;border-radius:3px;font-size:.9em}
.note{border-left:3px solid var(--line);padding:.1rem 0 .1rem 1rem;color:var(--muted);font-size:.94rem}
footer{margin-top:3.5rem;padding-top:1.25rem;border-top:1px solid var(--line);color:var(--muted);font-size:.9rem}
.overflow{overflow-x:auto}
`;

const delta = (cat, tool) => {
  if (!prev) return '';
  const p = prev.categories.find((c) => c.category === cat.category)?.ranked.find((t) => t.name === tool.name);
  if (!p) return ' <span title="new">·</span>';
  const d = tool.hits - p.hits;
  if (d === 0) return '';
  return ` <span title="előző hét: ${p.hits}">${d > 0 ? '+' : ''}${d}</span>`;
};

const section = (c) => `
<h2 id="${esc(c.category)}">${esc(c.title)}</h2>
<p class="q">${c.answered} of ${c.queryCount} questions returned an answer with citations.
Questions asked: ${c.queries.map((q) => `<code>${esc(q)}</code>`).join(' · ')}</p>
<div class="overflow"><table>
<thead><tr><th>Tool</th><th class="n">Cited in</th></tr></thead>
<tbody>
${c.ranked.map((t) => `<tr class="${t.hits === 0 ? 'zero' : ''}"><td><a href="${esc(t.url)}">${esc(t.name)}</a></td><td class="n">${t.hits} / ${c.answered}${delta(c, t)}</td></tr>`).join('\n')}
</tbody></table></div>`;

const page = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI Tool Index — which tools AI assistants actually recommend</title>
<meta name="description" content="A weekly, reproducible measurement of which tools AI assistants cite when asked which one to use. Raw data and the exact prompts are published with every edition.">
<style>${CSS}</style>
</head><body><main>

<h1>AI Tool Index</h1>
<p class="sub">Which tools do AI assistants actually recommend? Measured weekly, same questions
every week, raw data published. Edition of <strong>${esc(latest.week)}</strong>.</p>

<p class="lede">Every week the same fixed set of buyer questions goes to an AI assistant, and we
record which tools its answer <em>cites</em> — not which ones rank on Google, and not which ones
pay for placement. A tool scores one point per question whose answer linked to it. Nothing is
weighted, nothing is judged by a model: a link either appeared or it did not.</p>

<p class="note">Full disclosure, because it matters for how you read this: this index is produced
by the maintainer of two of the tools listed below, using one of them
(<a href="https://apify.com/highbrow_fame/ai-search-visibility-tracker">an AI-citation tracker</a>)
as the measuring instrument. Both scored zero in this edition. The prompts and the raw JSON are
published so you can re-run the whole thing and check.</p>

${latest.categories.map(section).join('\n')}

<h2>Method</h2>
<p>Engine: Perplexity (agent mode), one sample per question, US market, English.
Measured ${esc(latest.measuredAt.slice(0, 16).replace('T', ' '))} UTC. Platform cost of this
edition: $${(latest.totalCostUsd ?? 0).toFixed(4)}.</p>
<ul>
<li>The question set is fixed in <a href="https://github.com/projectworks007/ai-tool-index/blob/main/categories.json"><code>categories.json</code></a> and changes only between editions, never within one.</li>
<li>A tool matches when a cited URL matches its published pattern. Matching is a plain regular expression, not a model judgement.</li>
<li>Every edition's raw answers and citation lists are committed under <a href="https://github.com/projectworks007/ai-tool-index/tree/main/data"><code>data/</code></a>.</li>
<li>One engine only, for now. One sample per question. A single edition is a snapshot, not a verdict — the series is the point.</li>
</ul>
<p><strong>What this does not measure:</strong> quality, price, reliability, or whether a tool is
right for you. It measures visibility inside AI answers, which is a different thing and is worth
knowing precisely because it is different.</p>

<footer>
Previous editions: ${weeks.map((w) => `<a href="../data/${w}">${w.replace('.json', '')}</a>`).join(' · ')}<br>
Source, data and method: <a href="https://github.com/projectworks007/ai-tool-index">github.com/projectworks007/ai-tool-index</a> · maintained by yestrue
</footer>
</main></body></html>`;

mkdirSync(DOCS, { recursive: true });
writeFileSync(join(DOCS, 'index.html'), page, 'utf8');
writeFileSync(join(DOCS, '.nojekyll'), '', 'utf8');
console.log(`docs/index.html kész — ${latest.categories.length} kategória, ${weeks.length} kiadás`);
