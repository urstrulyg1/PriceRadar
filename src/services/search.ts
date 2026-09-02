// ─── Search orchestrator ──────────────────────────────────────────────────────
// User search
//   → real product identity (Open Food Facts)
//   → real provider queries (ProviderRegistry — only authorized sources)
//   → real product matching (matcher)
//   → real price calculation (compare)
// Every stage is grounded; when a stage has no real data the result says so.

import type {
  Offer, ProductIdentity, ProviderResult, ProviderStatus, SearchResult, SearchContext,
} from '../domain/types'
import { ProviderRegistry } from './providerRegistry'
import { openFoodFacts, barcodeFromQuery } from './adapters/openFoodFacts'
import { openPrices } from './adapters/openPrices'
import { upcItemDb } from './adapters/upcItemDb'
import { serpApiShopping } from './adapters/serpApiShopping'
import { flipkartAffiliate } from './adapters/flipkartAffiliate'
import { pendingAdapters } from './adapters/pendingProviders'
import { recordOffers } from './priceHistoryStore'

/** Parse natural-language search into criteria (no data invented here). */
export function parseQuery(raw: string): { normalized: string; budget?: number; instantOnly: boolean } {
  const q = raw.trim().toLowerCase()
  const budgetMatch = q.match(/under\s+₹?\s*(\d[\d,]*)/i) ?? q.match(/below\s+₹?\s*(\d[\d,]*)/i)
  const budget = budgetMatch ? parseInt(budgetMatch[1].replace(/,/g, ''), 10) : undefined
  const instantOnly = /\b(instant|quick|fast|30\s*min|minutes?|now|nearby|near me|same day)\b/i.test(q)
  const normalized = q
    .replace(/under\s+₹?\s*\d[\d,]*/i, '')
    .replace(/\b(cheap(est)?|best|near me|now|instant|quick|fast)\b/gi, '')
    .trim()
  return { normalized, budget, instantOnly }
}

export const CACHE_TTL_MS = 90_000

interface CacheEntry {
  result: SearchResult
  at: number
}

export function createSearchService(registry: ProviderRegistry) {
  registry.registerAll([
    serpApiShopping,   // authorized (key-gated) — Google Shopping IN listings
    flipkartAffiliate, // authorized (key-gated) — Flipkart affiliate feed
    upcItemDb,         // public trial API — barcode-keyed merchant offers
    openPrices,        // public open dataset — community price points
    ...pendingAdapters,
  ])

  // Cache is per service instance; entries expire after CACHE_TTL_MS and are
  // always re-labeled as cached so stale data is never shown as live.
  const cache = new Map<string, CacheEntry>()

  async function run(rawQuery: string, location: string | null, opts: { force?: boolean } = {}): Promise<SearchResult> {
    const query = rawQuery.trim()
    const cacheKey = `${query.toLowerCase()}|${location ?? ''}`
    if (!opts.force) {
      const hit = cache.get(cacheKey)
      if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
        return markCached(hit.result)
      }
    }

    const ctxBase: SearchContext = { query, location, mode: 'all' }

    // 1) Real identity resolution
    let identity: ProductIdentity | null = null
    let candidates: ProductIdentity[] = []
    let identityStatus: ProviderStatus = 'connected'
    let identityNote: string | undefined
    try {
      const resolved = await openFoodFacts.resolve({
        ...ctxBase,
        barcode: barcodeFromQuery(query),
      })
      identity = resolved.identity
      candidates = resolved.candidates
      identityStatus = identity ? 'live' : 'connected'
      if (!identity) identityNote = 'No matching product record found in Open Food Facts for this search'
    } catch (err) {
      identityStatus = 'temporarily_unavailable'
      identityNote = err instanceof Error ? err.message : 'Product identity source unavailable'
    }

    // 2) Real provider queries (barcode passed only when genuinely resolved)
    const ctx: SearchContext = {
      ...ctxBase,
      barcode: identity?.barcode ?? barcodeFromQuery(query),
      identity,
    }
    const results: ProviderResult[] = await registry.compare(ctx)

    // 3) Offers come only from providers that returned live data
    const offers: Offer[] = results.flatMap((r) => r.offers)

    const retrievedAt = Date.now()
    const result: SearchResult = {
      query,
      retrievedAt,
      identity,
      identityStatus,
      identityNote,
      candidates,
      results,
      offers,
    }

    // 4) Record what we really saw into collected history
    if (identity && offers.length) {
      recordOffers(identity, offers)
    }

    cache.set(cacheKey, { result, at: retrievedAt })
    return result
  }

  return { run }
}

/** Clone a cached result so freshness labels say “Cached”, never “Live”. */
function markCached(result: SearchResult): SearchResult {
  const offers = result.offers.map((o) => ({ ...o, freshness: 'cached' as const }))
  return {
    ...result,
    offers,
    results: result.results.map((r) => ({ ...r, offers: r.offers.map((o) => ({ ...o, freshness: 'cached' as const })) })),
  }
}

export type SearchService = ReturnType<typeof createSearchService>
