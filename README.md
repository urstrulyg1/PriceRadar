# PriceRadar

**One product. Every verified price. Nothing invented.**

PriceRadar is a real-data-only price comparison workspace. Every price,
availability state, delivery note, offer, rating and price-history point shown
in the UI comes from a source PriceRadar actually queried through a legitimate
mechanism (public open APIs or authorized, key-based APIs). When a source
cannot return real data, PriceRadar shows **unavailable** — it never
substitutes estimated, generated, or hard-coded shopping data.

## The data policy (non-negotiable)

- **Zero fabricated shopping data.** No built-in products, prices, ETAs,
  discounts, sellers, ratings, reviews or price history ship with the app.
- **Unknown stays unknown.** Fees the source does not disclose render as
  “+ checkout charges”, never ₹0. ETAs and stock the source does not supply
  render as “Delivery estimate unavailable” / “Unknown”.
- **Freshness is labeled.** Every offer carries `retrievedAt` provenance and a
  label — `Live · updated 18s ago`, `Cached · retrieved 12 min ago`, `Stale`.
  Cached results are never presented as live.
- **Partial results beat full-looking pages.** A search that returns 2 live
  sources and 19 honest “auth required / pending” rows is a correct result.
- **History is earned.** The price chart contains only observations PriceRadar
  actually recorded (plus real community-recorded open-data points), each
  labeled with source and date. Fewer than two dated observations →
  “Not enough historical data yet.”
- **The assistant cannot hallucinate.** It is deterministic and grounded: every
  number it quotes is copied or computed from cited retrieval records, each
  shown with its source, price and check time. With no data it says exactly
  that and nothing else.

Guard tests in `src/tests/noFakeData.test.ts` fail the build if fabrication
vocabulary, a static catalog, or fixture imports reappear in production code.

## Run locally (development)

```bash
npm install
npm run dev
```

The Vite dev server proxies the app's same-origin `/api/*` routes to the real
upstream APIs (see `vite.config.ts`).

## Run in production

```bash
npm run build
node gateway/server.mjs        # serves dist/ + proxies /api/* to upstreams
```

The gateway (`gateway/server.mjs`, zero dependencies) is an authorized-data
forwarder with a strict route allowlist. It never scrapes or bypasses
anti-bot systems. Optional environment variables let you keep provider keys
server-side instead of in the browser:

```bash
SERPAPI_KEY=... FK_AFFILIATE_ID=... FK_AFFILIATE_TOKEN=... node gateway/server.mjs
```

## Data sources & integration status

PriceRadar ships an honest source board (Data sources tab). Current state:

| Source | Access | Status |
|---|---|---|
| Open Food Facts | Public open database (ODbL), keyless | Live — resolves real product identity (name, brand, quantity, barcode) |
| Open Prices | Public open dataset (community-recorded prices), keyless | Live — real reference price points with store + date |
| UPCitemDB | Public trial API (keyless, ~100 lookups/day) | Live — real merchant listings keyed by barcode |
| Google Shopping via SerpApi | Authorized API, key required | Authentication required until you add a key |
| Flipkart Affiliate feed | Authorized API, affiliate ID + token | Authentication required until configured |
| Blinkit, Zepto, Swiggy Instamart, BB Now, Flipkart Minutes, Amazon Now, Amazon.in (PA-API), Myntra, Croma, Reliance Digital, Tata CLiQ, Vijay Sales, Nykaa, Meesho, AJIO, DMart Ready, BigBasket | — | **Integration pending** — no authorized API available to PriceRadar yet; these stores return nothing and are never simulated |

Adding a legitimate provider = implement an `OfferAdapter`
(`src/domain/types.ts`) that maps the authorized response into `Offer`s with
provenance, and register it in `src/services/search.ts`. Adapters that cannot
retrieve real data throw `ProviderUnavailableError` with an honest status
instead of returning anything.

## Architecture

```text
User search (name or barcode)
   ↓  Open Food Facts          → real product identity (GTIN/EAN, brand, size)
   ↓  ProviderRegistry         → authorized adapters queried concurrently,
   ↓                              failures isolated, per-source status
   ↓  Matcher (domain)         → exact/likely/similar by identifiers &
   ↓                              attributes — variants never conflated
   ↓  Compare engine (domain)  → real payable price; unknown fees stay unknown
   ↓  Price history store      → records ONLY what was really retrieved
   ↓  Assistant (services)     → deterministic answers over cited records
   ↓  UI                       → offers, provenance, freshness, empty states
```

- **Provenance on every offer**: `sourceId`, `sourceName`, `merchant`,
  `productUrl`, `retrievedAt`, `observedAt`, `currency`, `matchConfidence`.
- **Statuses** (per § the provider status system): `live`, `connected`,
  `auth_required`, `integration_pending`, `temporarily_unavailable`, `error`.
- **User records are local & real**: alerts, wishlist and search history are
  created only from real identity-verified products and real retrieved prices,
  stored in the browser's localStorage.

## Tests

```bash
npm test
```

69 tests cover the comparison engine, matcher, registry failure isolation,
adapter mapping against recorded upstream response shapes, honest-unavailable
behaviour (auth required / rate limit / no barcode), cache freshness labeling,
the no-hallucination assistant, collected-only history, and the no-fake-data
production guards. Test fixtures live only under `src/tests/fixtures/` and are
never imported by production code (enforced by test).

## Security notes

- Provider keys entered in the UI are stored in `localStorage` on your device
  and travel only to your same-origin gateway route.
- The gateway proxies only the five allowlisted upstreams and injects
  credentials from environment variables when provided.
- PriceRadar does not implement, and will not accept, scrapers or anti-bot
  bypasses as data sources.
