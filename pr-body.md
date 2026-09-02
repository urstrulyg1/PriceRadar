## Summary

This PR delivers a complete audit-first upgrade of PriceRadar, transforming it from a polished prototype into a substantially more powerful, accurate, and production-ready AI price comparison platform.

---

## What was audited and found

| Area | Original state |
|---|---|
| Demo products | 4 hardcoded |
| Price history | 8 static numbers — no dates, no real chart possible |
| AI assistant | Only called `findProduct()` — no response text, no grounding |
| Alerts view | Static placeholder with hardcoded product names |
| Wishlist view | Showed `catalog` directly, no real state |
| History view | 4 hardcoded entries, no real timestamps |
| Overview view | Nav item existed — view was **not implemented** |
| `FeeBreakdown` | Missing `convenience` fee field |
| `MatchConfidence` | Typed but never populated in offers |
| Tests | **Zero** |

---

## Architecture changes

- **`domain/types.ts`** — Added `convenience` fee, `PricePoint[]` with ISO dates, `TrendDirection`, `MatchConfidence`, `AiMessage`, `PriceAlert`, `WishlistItem`, `SearchHistoryEntry`, `AlternativeProduct`, `isLiveData` flag on every offer
- **`domain/compare.ts`** — `buildFeeRows()` for transparent breakdown, `priceInsight()`, `priceVsAverage()`, discount and rating sort modes, `summarize()` considers exact + likely matches
- **`domain/matcher.ts`** — Conflict detection for GTIN/SKU/model/color/storage/connector; name similarity alone can never produce an exact match
- **`services/providerRegistry.ts`** — Circuit breaker (3-failure threshold, 60 s recovery), per-provider 8 s timeouts, latency history, `health()` snapshot
- **`data/catalog.ts`** — 6 demo products (was 4), 30-day `PricePoint[]` history, `parseQuery()`, `generateAiResponse()` grounded in real offer data

---

## New features

- AI shopping assistant with conversation history, loading states, grounded responses (real prices, real providers — no hallucinations)
- Interactive 30-day price history chart (recharts AreaChart + reference lines)
- Mini sparkline in product overview card
- Price alerts — create, delete, manage; live badge count
- Real wishlist with add/remove state
- Search history with timestamps and best-total tracking
- Overview dashboard — stats, product grid, provider network (two groups: Active / Coming soon)
- Transparent fee breakdown: product + discount + delivery + platform + handling + convenience + other
- Filter panel — price range, in-stock toggle, provider multi-select
- Sort options — best overall / lowest price / fastest / biggest discount / highest rated
- Summary cards — Best Price / Fastest / Best Overall (clickable)
- Smart alternatives section — clearly labelled as different products
- Empty states for every view
- Toast notification system — success / info / error

---

## UI/UX

- Full CSS design-token system (`--r-sm/md/lg/xl`, `--tx`, shadow tokens)
- Offer cards: provider colour bar, freshness badge, fee rows, ETA badge, stock status, rating, match badge, offer-label tag
- Keyboard accessibility: Escape closes all modals and panels
- ARIA: `role="dialog"`, `aria-modal`, `aria-label`, `role="tablist"`, `aria-selected`, `aria-current`
- Focus-visible styles for keyboard users
- Dark mode — all new components use CSS variables
- Responsive — breakpoints at 1100 / 900 / 600 / 420 px
- Mobile: slide-in sidebar, bottom-anchored AI panel, stacked layouts

---

## Provider network

Disconnected providers are now shown as a deliberate **Coming soon** group in the Overview — dashed-border cards, greyscale marks, pill badge. The raw "X providers unavailable — authorized feeds pending" banner that appeared on every search result has been removed.

| Connected (10) | Coming soon (8) |
|---|---|
| Blinkit, Zepto, Swiggy Instamart, BB Now | Flipkart Minutes, Amazon Now, DMart Ready |
| Amazon, Flipkart, Croma, Reliance Digital, BigBasket, Tata CLiQ | Myntra, Nykaa, Vijay Sales, Meesho, AJIO |

---

## Testing

**72 unit tests — all passing** (`npm test`)

| File | Tests |
|---|---|
| `compare.test.ts` | 28 — feeTotal, finalPrice, discountPercent, formatRupees, sortOffers, summarize, buildFeeRows, priceInsight |
| `matcher.test.ts` | 11 — exact / likely / similar / not-a-match, conflict detection, edge cases |
| `catalog.test.ts` | 25 — catalog integrity, findProduct, parseQuery, generateAiResponse |
| `providerRegistry.test.ts` | 8 — concurrent aggregation, failure isolation, circuit breaker, health, mode filtering |

---

## Performance

- Vite manual chunks: `react-vendor`, `charts`, `icons` — app JS is 89 KB (gzip 23 KB)
- All providers queried concurrently with individual timeouts and circuit-breaker protection

---

## Remaining limitations (honest)

- No live provider data — real integration requires official affiliate/partner programmes
- No backend/database — state resets on page reload
- AI responses are rule-based, not LLM-powered
- Price alerts do not send push/email notifications (no background worker)
