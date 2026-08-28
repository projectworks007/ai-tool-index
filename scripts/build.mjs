#!/usr/bin/env node
/**
 * Builds the published edition by aggregating the last 7 daily measurements.
 * No network, no secrets — pure transform, so anyone can rebuild the page from the committed
 * data and check the arithmetic.
 *
 * Why aggregate rather than publish the latest run: measured on 2026-08-28, two runs a few hours
 * apart with identical questions moved four of six tools and swapped the category leader. One
 * snapshot is noise. The published number is "cited in N of the week's M answers", which is both
 * steadier and more honest than a single day dressed up as a ranking.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(ROOT, 'docs');
const WINDOW = 7;

// A measurement that lands in data/ instead of data/daily/ is invisible to this build, so the
// page would silently keep publishing an older window. That happened once on 2026-08-28 after a
// path change, and nothing complained. Fail loudly instead.
const stray = readdirSync(join(ROOT, 'data')).filter((f) => f.endsWith('.json'));
if (stray.length) {
  console.error(`HIBA: mérési fájl a data/ gyökerében, a data/daily/ helyett: ${stray.join(', ')}`);
  console.error('Tedd át a data/daily/ alá, különben a kiadás nem látja.');
  process.exit(1);
}

const files = readdirSync(join(ROOT, 'data', 'daily')).filter((f) => f.endsWith('.json')).sort();
if (!files.length) { console.error('nincs napi adat'); process.exit(1); }
const windowFiles = files.slice(-WINDOW);
const days = windowFiles.map((f) => JSON.parse(readFileSync(join(ROOT, 'data', 'daily', f), 'utf8')));
const week = windowFiles.at(-1).replace('.json', '');

/** Fold the window into one score per tool: cited in X of the window's Y answered questions. */
const aggregate = () => {
  const byCat = new Map();
  for (const day of days) {
    for (const c of day.categories) {
      const e = byCat.get(c.category)
        || { category: c.category, title: c.title, queries: c.queries, answered: 0, tools: new Map(), samples: 0 };
      e.answered += c.answered;
      e.samples += 1;
      e.queries = c.queries;
      for (const t of c.ranked) {
        const cur = e.tools.get(t.name) || { name: t.name, url: t.url, hits: 0 };
        cur.hits += t.hits;
        e.tools.set(t.name, cur);
      }
      byCat.set(c.category, e);
    }
  }
  return [...byCat.values()].map((e) => ({
    ...e,
    ranked: [...e.tools.values()].sort((a, b) => b.hits - a.hits || a.name.localeCompare(b.name)),
  }));
};

const cats = aggregate();
const totalCost = days.reduce((s, d) => s + (d.totalCostUsd ?? 0), 0);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const CSS = `
:root{--bg:#fff;--fg:#16181d;--muted:#5b6472;--line:#e3e6ea;--accent:#0b5fff;--zero:#98a2b3}
@media(prefers-color-scheme:dark){:root{--bg:#0f1115;--fg:#e8eaed;--muted:#9aa4b2;--line:#242a33;--accent:#6ea8ff;--zero:#5b6472}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
main{max-width:860px;margin:0 auto;padding:2.5rem 1.25rem 5rem}
h1{font-size:1.9rem;line-height:1.25;margin:0 0 .5rem}
h2{font-size:1.25rem;margin:2.75rem 0 .35rem;padding-top:1.25rem;border-top:1px solid var(--line)}
.sub{color:var(--muted);margin:0 0 2rem}
.lede{font-size:1.05rem}
table{width:100%;border-collapse:collapse;margin:1rem 0 .5rem;font-size:.95rem}
th,td{text-align:left;padding:.5rem .6rem;border-bottom:1px solid var(--line);vertical-align:top}
th{font-weight:600;color:var(--muted);font-size:.82rem;text-transform:uppercase;letter-spacing:.04em}
td.n{text-align:right;font-variant-numeric:tabular-nums;width:7rem;white-space:nowrap}
tr.zero td{color:var(--zero)}
.q{color:var(--muted);font-size:.9rem;margin:.4rem 0 0}
a{color:var(--accent)}
code{background:rgba(128,128,128,.13);padding:.1rem .35rem;border-radius:3px;font-size:.9em}
.note{border-left:3px solid var(--line);padding:.1rem 0 .1rem 1rem;color:var(--muted);font-size:.94rem}
footer{margin-top:3.5rem;padding-top:1.25rem;border-top:1px solid var(--line);color:var(--muted);font-size:.9rem}
.overflow{overflow-x:auto}
`;

const section = (c) => `
<h2 id="${esc(c.category)}">${esc(c.title)}</h2>
<p class="q">${c.answered} answers collected over ${c.samples} daily measurement${c.samples === 1 ? '' : 's'}.
Questions asked each day: ${c.queries.map((q) => `<code>${esc(q)}</code>`).join(' · ')}</p>
<div class="overflow"><table>
<thead><tr><th>Tool</th><th class="n">Cited in</th></tr></thead>
<tbody>
${c.ranked.map((t) => `<tr class="${t.hits === 0 ? 'zero' : ''}"><td><a href="${esc(t.url)}">${esc(t.name)}</a></td><td class="n">${t.hits} / ${c.answered}</td></tr>`).join('\n')}
</tbody></table></div>`;

const page = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI Tool Index — which tools AI assistants actually recommend</title>
<meta name="description" content="A weekly, reproducible measurement of which tools AI assistants cite when asked which one to use. Measured daily, published weekly, raw data included.">
<style>${CSS}</style>
</head><body><main>

<h1>AI Tool Index</h1>
<p class="sub">Which tools do AI assistants actually recommend? Measured every day, published
weekly, raw answers included. Edition of <strong>${esc(week)}</strong>${days.length > 1 ? `, covering ${days.length} daily measurements` : ''}.</p>

<p class="lede">The same fixed set of buyer questions goes to an AI assistant every day, and we
record which tools its answer <em>cites</em> — not which ones rank on Google, and not which ones
pay for placement. A tool scores one point per answer that linked to it. Nothing is weighted and
no model judges the ranking: a link either appeared or it did not.</p>

<p class="note"><strong>Why daily measurements and a weekly number.</strong> On 28 August 2026 the
same questions were run twice, a few hours apart. Four of six tools moved, and the category leader
swapped. One snapshot is noise dressed up as a ranking, so the published figure pools a week of
daily answers instead.</p>

<p class="note"><strong>Disclosure.</strong> This index is produced by the maintainer of two of the
tools listed below, using one of them
(<a href="https://apify.com/highbrow_fame/ai-search-visibility-tracker">an AI-citation tracker</a>)
as the measuring instrument. Both scored zero in this edition. The questions and the raw JSON are
published so you can re-run the whole thing and check.</p>

${cats.map(section).join('\n')}

<h2>Method</h2>
<p>Engine: Perplexity (agent mode), one sample per question per day, US market, English.
Window: ${days.length} day${days.length === 1 ? '' : 's'} ending ${esc(week)}. Platform cost of this
edition: $${totalCost.toFixed(4)}.</p>
<ul>
<li>The question set is fixed in <a href="https://github.com/projectworks007/ai-tool-index/blob/main/categories.json"><code>categories.json</code></a> and changes between editions only, never within one.</li>
<li>A tool matches when a cited URL matches its published pattern. Matching is a plain regular expression, not a model judgement.</li>
<li>Every day's raw answers and citation lists are committed under <a href="https://github.com/projectworks007/ai-tool-index/tree/main/data/daily"><code>data/daily/</code></a>.</li>
<li>One engine, for now. The series is the point; a single day is not.</li>
</ul>
<p><strong>What this does not measure:</strong> quality, price, reliability, or whether a tool is
right for you. It measures visibility inside AI answers, which is a different thing and worth
knowing precisely because it is different.</p>

<footer>
Daily data: <a href="https://github.com/projectworks007/ai-tool-index/tree/main/data/daily">${files.length} measurement${files.length === 1 ? '' : 's'}</a> ·
Source and method: <a href="https://github.com/projectworks007/ai-tool-index">github.com/projectworks007/ai-tool-index</a> · maintained by yestrue
</footer>
</main></body></html>`;

mkdirSync(DOCS, { recursive: true });
writeFileSync(join(DOCS, 'index.html'), page, 'utf8');
writeFileSync(join(DOCS, '.nojekyll'), '', 'utf8');
console.log(`docs/index.html kész — ${cats.length} kategória, ${days.length} nap összevonva (${week})`);
