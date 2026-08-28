#!/usr/bin/env node
/**
 * Daily measurement. Runs LOCALLY, never in CI — the Apify token stays on this machine and is
 * never uploaded as a repository secret.
 *
 * Why daily when the index publishes weekly: measured 2026-08-28, two runs hours apart with the
 * same questions moved four of six tools, and swapped the leader. A single snapshot is noise.
 * Seven daily samples make the published weekly number mean something.
 *
 * Asks a fixed, public set of buyer questions through the AI Search Visibility Tracker
 * (an Apify Actor) and records which tools each engine's answer actually cites. The prompt set
 * is fixed and published so anyone can re-run it and get their own numbers.
 *
 * Usage:  node scripts/measure.mjs [--dry]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry');

const CATEGORIES = JSON.parse(readFileSync(join(ROOT, 'categories.json'), 'utf8'));
const TOKEN = JSON.parse(readFileSync(join(homedir(), '.apify', 'auth.json'), 'utf8')).token;
const U = 'https://api.apify.com/v2/';
const TRACKER = 'izpFzU6cyOTRTJeOn';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Charged event counts do not settle when a run reaches a terminal status, and a zero reads
 * exactly as stable as a real value. Wait for the counts to stop moving AND for the billable
 * event to be non-zero whenever the dataset actually holds records.
 */
const settled = async (runId) => {
  const get = async () => (await (await fetch(`${U}actor-runs/${runId}?token=${TOKEN}`)).json()).data;
  let run = await get();
  const t0 = Date.now();
  while (!['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(run.status)) {
    if (Date.now() - t0 > 900_000) throw new Error('run never terminated');
    await sleep(5000);
    run = await get();
  }
  let last = '';
  let streak = 0;
  const tT = Date.now();
  for (;;) {
    await sleep(4000);
    run = await get();
    const key = JSON.stringify(run.chargedEventCounts ?? {});
    streak = key === last ? streak + 1 : 1;
    last = key;
    if (streak >= 4 && (run.chargedEventCounts?.['apify-actor-start'] ?? 0) >= 1) return run;
    if (Date.now() - tT > 240_000) return run;
  }
};

const runCategory = async (cat) => {
  const started = await (await fetch(`${U}acts/${TRACKER}/runs?build=latest&memory=2048&timeout=900&token=${TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      queries: cat.queries,
      brandDomains: cat.trackedDomains,
      competitorDomains: [],
      engines: ['perplexity-agent'],
      language: 'en',
      serpCountry: 'us',
      samplesPerQuery: 1,
    }),
  })).json();
  if (!started.data) throw new Error(`start failed: ${JSON.stringify(started).slice(0, 200)}`);

  const run = await settled(started.data.id);
  const items = await (await fetch(`${U}datasets/${run.defaultDatasetId}/items?clean=true&token=${TOKEN}`)).json();
  const cites = (Array.isArray(items) ? items : []).filter((r) => r.type === 'citation');

  // Score = how many of this category's questions cited the tool at all. Deliberately simple
  // and deterministic: no model judges the ranking, a URL either appeared or it did not.
  const tally = new Map();
  const perQuery = [];
  for (const c of cites) {
    const urls = (c.citations || []).map((x) => x.url || x.link || '').filter(Boolean);
    const hits = [];
    for (const tool of cat.tools) {
      const re = new RegExp(tool.match, 'i');
      if (urls.some((u) => re.test(u))) {
        tally.set(tool.name, (tally.get(tool.name) || 0) + 1);
        hits.push(tool.name);
      }
    }
    perQuery.push({ query: c.query, citations: urls.length, hits, urls });
  }

  const ranked = cat.tools
    .map((t) => ({ name: t.name, url: t.url, hits: tally.get(t.name) || 0 }))
    .sort((a, b) => b.hits - a.hits || a.name.localeCompare(b.name));

  return {
    category: cat.id,
    title: cat.title,
    queries: cat.queries,
    queryCount: cat.queries.length,
    answered: cites.length,
    ranked,
    perQuery,
    runId: run.id,
    costUsd: run.usageTotalUsd ?? 0,
  };
};

const date = new Date().toISOString().slice(0, 10);
const out = { measuredAt: new Date().toISOString(), week: date, engine: 'perplexity-agent', categories: [] };
let spend = 0;

for (const cat of CATEGORIES) {
  process.stdout.write(`  ${cat.id} … `);
  if (DRY) { console.log('(dry)'); continue; }
  const r = await runCategory(cat);
  spend += r.costUsd;
  out.categories.push(r);
  console.log(`${r.answered}/${r.queryCount} válasz, élen: ${r.ranked[0]?.name ?? '—'} (${r.ranked[0]?.hits ?? 0})`);
}

if (!DRY) {
  out.totalCostUsd = Number(spend.toFixed(4));
  mkdirSync(join(ROOT, 'data', 'daily'), { recursive: true });
  writeFileSync(join(ROOT, 'data', 'daily', `${date}.json`), JSON.stringify(out, null, 2), 'utf8');
  console.log(`\nmentve: data/daily/${date}.json  (platformköltség $${spend.toFixed(4)})`);
}
