# PriceRadar

**One product. Every price. One smart choice.**

PriceRadar is a responsive AI shopping comparison workspace. The current frontend is a polished, interaction-ready prototype with a normalized offer catalog so the experience can be connected to authorized provider integrations without rewriting the UI.

## Run locally

```bash
npm install
npm run dev
```

For a production build:

```bash
npm run build
npm run preview
```

## What is included

- Instant, normal, and combined delivery comparison modes
- Final payable price ranking with product, delivery, platform, handling, and other fee lines
- Exact / likely / similar match labels and an exact-only ranking default
- Provider, freshness, availability, seller, ETA, price-per-unit, offers, and source links
- Best price, fastest delivery, best overall, price history, savings, and AI recommendation cards
- Location picker, responsive mobile navigation, dark mode, wishlist, search history, and price-alert flows
- Offer details drawer/modal with transparent fee breakdown and match confidence
- AI shopping prompt panel with natural-language search suggestions
- Extensible provider adapter interfaces and a failure-isolated `ProviderRegistry`

The catalog data in `src/data/catalog.ts` is intentionally local demo data. It is not presented as a live scrape. `src/domain/types.ts`, `src/domain/compare.ts`, `src/domain/matcher.ts`, and `src/services/providerRegistry.ts` define the seams for a production backend.

## Integration architecture

Each authorized connector implements `ProviderAdapter` and returns normalized `Offer` objects:

```text
ProviderAdapter
      |
      +-- official / affiliate / partner connector
      |
      +-- normalized Offer[]
                    |
             comparison engine
                    |
             PriceRadar UI
```

`ProviderRegistry.compare()` runs providers independently with `Promise.allSettled()`, so one provider timing out does not remove the other results. A production service should add location serviceability, cache policy, freshness timestamps, price history persistence, authenticated user data, alert workers, telemetry, and signed provider URLs behind the same interfaces.

Only authorized APIs, affiliate feeds, public product feeds, or provider-approved integrations should be wired into these adapters. CAPTCHA bypasses, access-control workarounds, and unapproved scraping are intentionally outside this project.
