# AI Tool Index

**Which tools do AI assistants actually recommend?** Measured **every day**, published weekly,
with the raw answers included in every edition.

📊 **[Read the current edition →](https://projectworks007.github.io/ai-tool-index/)**

---

## What this is

Every day a fixed set of buyer questions goes to an AI assistant, and we record which tools its
answer **cites**. The weekly edition pools those daily answers. Not which tools rank on Google. Not which ones pay for placement. Which ones the
model actually pointed at when somebody asked what to use.

A tool scores one point per question whose answer linked to it. Nothing is weighted, and no model
judges the ranking — a link either appeared or it did not.

## Current edition — 2026-08-28

| Category | Most-cited | Cited in |
|---|---|---|
| Google Maps scrapers | Scrap.io | 3 of 4 |
| General web scraping APIs | Firecrawl · Scrape.do · Scrapingdog (tied) | 4 of 4 |
| AI visibility & citation trackers | Ahrefs Brand Radar · Profound (tied) | 2 of 4 |
| B2B email finders & enrichment | Snov.io | 2 of 3 |
| Apify Store actors | compass/crawler-google-places | 1 of 3 |

Full tables, the exact questions, and every cited URL: **[the current edition](https://projectworks007.github.io/ai-tool-index/)**.

## Disclosure

This index is produced by the maintainer of two of the tools it ranks, using one of them — an
[AI-citation tracker](https://apify.com/highbrow_fame/ai-search-visibility-tracker) — as the
measuring instrument. **Both scored zero in the first edition.** That is not modesty, it is the
number.

The reason to publish anyway: the questions are fixed and public, the matching is a plain regular
expression, and every raw answer is committed here. You do not have to trust the publisher; you
can re-run it.

## Reproduce it

```bash
npm i -g apify-cli && apify login      # you need your own Apify account
node scripts/measure.mjs               # one day's run, writes data/daily/YYYY-MM-DD.json
node scripts/build.mjs                 # pools the last 7 days into docs/index.html
```

The measurement runs locally and reads your Apify token from `~/.apify/auth.json`. It is never
uploaded anywhere — this repository holds no secrets and its automation never needs one.

Cost of one daily measurement, all five categories: **about a third of a cent**. A full week: about two cents.

## Method, in short

- **Engine:** Perplexity (agent mode), one sample per question, US market, English.
- **Cadence:** measured daily, published weekly. On 2026-08-28 the same questions run twice hours
  apart moved four of six tools and swapped the leader, so a single snapshot is noise — the
  published figure pools a week of daily answers.
- **Questions:** fixed in [`categories.json`](categories.json). They change between editions only,
  never within one, and every change is a commit you can read.
- **Matching:** each tool declares a URL pattern; a citation counts when a cited URL matches it.
- **Data:** every day's answers and citation lists land in [`data/daily/`](data/daily/).

**What it does not measure:** quality, price, reliability, or fit. It measures visibility inside
AI answers, which is a different thing — and worth knowing precisely because it is different.

## Why it exists

Brands increasingly get discovered through AI assistants rather than search results, and almost
nobody publishes what those assistants actually say. The broad, cross-industry version of this
measurement exists commercially. The narrow version — individual tools, individual marketplace
listings, the long tail where most software actually lives — did not, so here it is.

## Licence

Data and text: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — use it, cite it.
Code: MIT.
