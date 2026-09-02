# PriceRadar — Real Data Only / Zero Dummy Data

## What this PR does

Converts PriceRadar from a UI prototype backed by a static catalog of invented products into a **real-data-only price comparison platform**. If a source cannot return real data, the app shows an honest unavailable state — it never fabricates prices, ETAs, stock, offers, ratings, history, or AI answers.

## Removed (all fabricated data paths)

- Deleted `src/data/catalog.ts` — 726 lines of invented products, offers, fees, price history, and a fake-grounded AI responder
- Removed seeded price alerts / wishlist / search history (all user records now start empty and are created only from real actions)
- Removed fake "All sources live" pill, fake source-health widget, fake refresh simulation, and demo persona
- Removed tests asserting the static catalog

## Real integrations (verified API shapes)

| Source | Access | Ships as |
|---|---|---|
| Open Food Facts | public open DB, keyless | Live — real product identity (barcode, brand, quantity, image) |
| Open Prices | public open dataset, keyless | Live — real community-recorded price points with store + date |
| UPCitemDB | public trial API, keyless | Live — real merchant listings keyed by barcode |
| Google Shopping (SerpApi) | authorized, key-gated | `Authentication required` until a key is configured in-app |
| Flipkart Affiliate feed | authorized, credential-gated | `Authentication required` until configured in-app |
| 17 instant-delivery / e-commerce stores (Blinkit, Zepto, Instamart, Amazon.in PA-API, Myntra, …) | no authorized API exists | `Integration pending` — return nothing, never simulated |

All upstream calls go through same-origin `/api/*` routes (Vite dev proxy in development, zero-dependency `gateway/server.mjs` in production, with optional server-side key injection via env vars). No CORS or anti-bot bypassing.

## Integrity mechanics added

- **Provenance on every offer** (`sourceId`, `merchant`, `productUrl`, `retrievedAt`, `observedAt`, `currency`) with a runtime `assertRealOffer` guard
- **Freshness labels**: `Live · updated 18s ago` / `Cached · retrieved 12 min ago` / `Stale` — cached results are re-labeled and never shown as live (90 s TTL)
- **Unknown stays unknown**: undisclosed fees → “₹X + checkout charges”; no ETA → “Delivery estimate unavailable”; no stock info → “Unknown”
- **Exact-variant matching**: GTIN/model/size/colour/storage conflicts downgrade or reject a match; name similarity alone can't produce “exact”
- **Earned price history**: chart only from observations PriceRadar actually recorded; < 2 dated points → “Not enough historical data yet.”
- **Grounded AI**: deterministic assistant over cited retrieval records (source · price · checked-when), with the exact “I couldn't find verified live pricing…” reply when there is no data
- **Provider status system**: live / connected / auth required / integration pending / temporarily unavailable / error, per source, on every search
- **Beautiful empty states** with Try again / Change location / Search another product actions; partial results are first-class

## Guard tests (71 passing)

- production source scan: no fabrication vocabulary, no static catalog, no fixture imports, no literal product prices
- unauthenticated sources return zero offers without being queried; failures/rate-limits surface as unavailable; pending stores return nothing
- unknown fees/ETA/availability remain unknown end-to-end
- cached data carries freshness metadata; AI replies cite only offers that exist and quote no amounts without data
- app smoke tests: zero preloaded shopping data, honest pre-search state, pending stores listed transparently
- fixtures isolated under `src/tests/fixtures/` (clearly marked, never imported by production code)

## Validation

- `npm test` → 71/71 passing
- `tsc -b` clean, `vite build` succeeds
- Repo-wide audit for mock/dummy/fake/sample/demo/placeholder/hardcoded tokens: production code clean
