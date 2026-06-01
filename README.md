# IMAGO Media Finder

A lightweight Next.js + TypeScript search experience for inconsistent IMAGO-style media metadata. It implements a local search API, preprocessing, filters, sorting, pagination, basic analytics, and a Tailwind UI.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Useful checks:

```bash
npm run test
npm run build
```

## API

`GET /api/search`

Query parameters:

- `q`: keyword query across `suchtext`, `fotografen`, and `bildnummer`
- `credit`: exact `fotografen` filter
- `dateFrom`, `dateTo`: ISO date range filters
- `restriction`: one or more derived restriction filters, for example `PUBLICATION NOT IN JPN`
- `sort`: `date_asc` or `date_desc`
- `page`, `pageSize`: paginated response controls

Response shape:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 24,
  "total": 0,
  "totalPages": 1,
  "responseTimeMs": 3.2
}
```

Additional endpoints:

- `GET /api/facets`: credits, restrictions, min/max date, dataset size
- `GET /api/analytics`: in-memory search count, average response time, common keywords

## Approach

The app builds an in-memory index from `seed.json` at server startup. For a challenge-sized dataset this keeps the implementation transparent, fast, and easy to review without introducing an external service. The code is intentionally separated into `src/lib/search.ts` for search and preprocessing, route handlers for HTTP concerns, and `src/app/page.tsx` for the UI.

## Preprocessing

Implemented preprocessing steps:

- Date normalization: converts `datum` from `DD.MM.YYYY` to ISO `YYYY-MM-DD`, allowing reliable range filtering and sorting.
- Restriction extraction: finds tokens like `PUBLICATIONxINxGERxONLY` with a regex and normalizes them to readable facet values like `PUBLICATION IN GER ONLY`.
- Text normalization: lowercases, strips diacritics, splits punctuation and camel-ish separators, and removes a small stop-word set.
- Weighted token map: precomputes searchable tokens for each item so requests do not repeatedly tokenize every field.

This happens at server module load. In production I would move it to a build/ingestion step and persist the resulting index.

## Relevance

Search uses simple weighted scoring:

- `suchtext`: primary field, weight 6
- `fotografen`: secondary field, weight 3
- `bildnummer`: optional identifier field, weight 2
- restrictions: low-weight derived tokens, weight 1

Exact token matches score higher than prefix matches. The default sort is relevance first, then newest date. When `sort=date_asc` or `sort=date_desc` is provided, date ordering becomes the primary order.

## UI

The UI includes:

- Debounced search input
- Credit dropdown
- Date range inputs
- Restriction chips
- Date sort selector
- Loading, empty, and error states
- Paginated result cards with `bildnummer`, `fotografen`, `datum`, restrictions, and a short snippet

The layout favors dense scanning over a marketing-style page because the primary user task is repeated searching and filtering.

## Assumptions

- `fotografen` is treated as an exact credit facet.
- Restriction values are only extracted when they match the `PUBLICATIONx...` pattern.
- Dates that cannot be parsed are retained but sort/filter as unknown.
- The seed dataset is trusted local input for this demo.
- The UI does not render actual media thumbnails because the seed data does not include asset URLs.

## Performance And Scaling

For 10,000 items, an in-memory scan with precomputed tokens is acceptable and keeps request times low. The design avoids repeated parsing work per request and caps `pageSize` at 100.

For millions of items, I would replace the local scan with a search engine such as OpenSearch, Elasticsearch, or Meilisearch:

- Normalize and enrich metadata in an ingestion pipeline.
- Store structured fields for date, credit, restrictions, people, locations, and rights metadata.
- Use weighted full-text fields with analyzers for multilingual captions.
- Add prefix/autocomplete indexes for names, teams, locations, and image numbers.
- Keep facets in the engine for fast counts and filtering.
- Use incremental ingestion with versioned documents and queue-based reindexing.
- Add observability for zero-result queries, latency percentiles, and ranking feedback.

## Limitations

- Prefix matching is intentionally simple and not typo-tolerant.
- Snippets are not HTML-highlighted to avoid introducing unsafe markup.
- Analytics are in memory and reset when the server restarts.
- There are no thumbnails or media previews because the provided data only contains metadata.
- The local in-memory implementation is not intended to be a distributed production search architecture.

## What I Would Do Next

- Add typo tolerance and better phrase matching.
- Extract people, clubs, locations, and country codes into first-class facets.
- Add thumbnail support if asset URLs are available.
- Persist analytics and add a small dashboard for query quality.
- Add Playwright coverage for the main search/filter flows.
