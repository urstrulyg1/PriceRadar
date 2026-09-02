/**
 * Unit tests — real adapter mapping and honest-unavailable behaviour.
 * Uses recorded API payload shapes (test fixtures) and a stubbed fetch.
 * Verifies: unconfigured sources return NOTHING (auth_required), failures
 * surface as unavailable, unknown availability/ETA/fees stay unknown, and
 * real currency/values are preserved verbatim from upstream.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openFoodFacts } from '../services/adapters/openFoodFacts'
import { openPrices } from '../services/adapters/openPrices'
import { upcItemDb } from '../services/adapters/upcItemDb'
import { serpApiShopping } from '../services/adapters/serpApiShopping'
import { flipkartAffiliate } from '../services/adapters/flipkartAffiliate'
import { PENDING_STORES, pendingAdapter } from '../services/adapters/pendingProviders'
import { ProviderUnavailableError } from '../domain/types'
import { providerConfig } from '../services/providerConfig'
import {
  FLIPKART_RESPONSE, OFF_PRODUCT_RESPONSE, OFF_SEARCH_RESPONSE,
  OPEN_PRICES_RESPONSE, SERPAPI_RESPONSE, UPCITEMDB_RESPONSE,
} from './fixtures/records'

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function stubFetch(handler: (url: string) => Response | Promise<Response> | 'fail') {
  const fn = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    const out = handler(url)
    if (out === 'fail') throw new TypeError('network down')
    return out
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

const barcodeCtx = { query: '3017620422003', barcode: '3017620422003', location: null, mode: 'all' as const }

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Open Food Facts identity', () => {
  it('resolves a real barcode to a verified identity', async () => {
    stubFetch((url) => (url.includes('/api/v2/product/') ? json(OFF_PRODUCT_RESPONSE) : json({})))
    const { identity } = await openFoodFacts.resolve(barcodeCtx)
    expect(identity).not.toBeNull()
    expect(identity!.barcode).toBe('3017620422003')
    expect(identity!.name).toBe('Nutella')
    expect(identity!.brand).toBe('Nutella')
    expect(identity!.quantity).toBe('400 g')
    expect(identity!.url).toContain('openfoodfacts.org/product/3017620422003')
  })

  it('search returns ranked real candidates', async () => {
    stubFetch((url) => (url.includes('/api/v2/search') ? json(OFF_SEARCH_RESPONSE) : json({})))
    const { identity, candidates } = await openFoodFacts.resolve({ query: 'nutella', location: null, mode: 'all' })
    expect(identity!.name).toBe('Nutella')
    expect(candidates.length).toBe(1)
  })

  it('unreachable identity source throws ProviderUnavailableError (no fallback data)', async () => {
    stubFetch(() => 'fail')
    await expect(openFoodFacts.resolve(barcodeCtx)).rejects.toBeInstanceOf(ProviderUnavailableError)
  })
})

describe('Open Prices (community-recorded reference prices)', () => {
  it('maps real submissions with price, currency, date and store verbatim', async () => {
    stubFetch((url) => (url.includes('/api/v1/prices') ? json(OPEN_PRICES_RESPONSE) : json({})))
    const offers = await openPrices.search(barcodeCtx)
    expect(offers).toHaveLength(2)
    expect(offers.every((o) => o.kind === 'reference')).toBe(true)
    expect(offers[0]).toMatchObject({ price: 3.21, currency: 'EUR', observedAt: '2024-01-11' })
    expect(offers[0].locationLabel).toContain('Carrefour')
    // Unknown by nature — never guessed:
    expect(offers[0].availability).toBe('unknown')
    expect(offers[0].etaMinutes).toBeNull()
    expect(offers[0].productUrl).toBeNull()
    expect(offers[1].mrp).toBe(3.99) // source-stated regular price
  })

  it('skips honestly when the query has no barcode', async () => {
    stubFetch(() => json({}))
    await expect(openPrices.search({ query: 'no barcode here', location: null, mode: 'all' }))
      .rejects.toMatchObject({ name: 'ProviderUnavailableError', status: 'connected' })
  })
})

describe('UPCitemDB (barcode-keyed merchant listings)', () => {
  it('maps real merchant offers with real currency and links', async () => {
    stubFetch((url) => (url.includes('/prod/trial/lookup') ? json(UPCITEMDB_RESPONSE) : json({})))
    const offers = await upcItemDb.search(barcodeCtx)
    expect(offers).toHaveLength(2)
    expect(offers[0]).toMatchObject({
      merchant: 'Walmart (walmart.com)',
      price: 4.48,
      currency: 'USD',
      availability: 'in_stock', // source explicitly said “In Stock”
      productUrl: UPCITEMDB_RESPONSE.items[0].offers[0].link,
    })
    // Second offer had empty availability → must stay unknown
    expect(offers[1].availability).toBe('unknown')
    // Shipping is a source-formatted string → fee stays unknown, note carries it
    expect(offers[0].fees.delivery).toBeNull()
    expect(offers[0].fees.note).toContain('US:Standard')
    expect(offers[0].etaMinutes).toBeNull()
    expect(offers[1].mrp).toBe(6.99)
  })

  it('rate-limit (429) becomes temporarily_unavailable with zero offers', async () => {
    stubFetch(() => json({ message: 'quota exceeded' }, 429))
    await expect(upcItemDb.search(barcodeCtx))
      .rejects.toMatchObject({ status: 'temporarily_unavailable' })
  })
})

describe('SerpApi Google Shopping (key-gated)', () => {
  it('without a key: auth_required and zero offers — never sample results', async () => {
    const fetchFn = stubFetch(() => json(SERPAPI_RESPONSE))
    providerConfig.clear('serpapi')
    expect(serpApiShopping.requiresAuth()).toBe(true)
    await expect(serpApiShopping.search(barcodeCtx)).rejects.toMatchObject({ status: 'auth_required' })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('with a key: maps real Google Shopping listings', async () => {
    stubFetch((url) => {
      expect(url).toContain('engine=google_shopping')
      expect(url).toContain('gl=in')
      return json(SERPAPI_RESPONSE)
    })
    providerConfig.set('serpapi', { apiKey: 'user-key' })
    expect(serpApiShopping.requiresAuth()).toBe(false)
    const offers = await serpApiShopping.search(barcodeCtx)
    expect(offers).toHaveLength(2)
    expect(offers[0]).toMatchObject({
      merchant: 'flipkart.com',
      price: 379,
      currency: 'INR',
      productUrl: 'https://www.flipkart.com/nutella-400g/p/example',
      deliveryNote: 'Free delivery by tomorrow',
      mrp: 449,
      rating: 4.5,
    })
    // No availability field in the payload → unknown, never in-stock
    expect(offers[0].availability).toBe('unknown')
    expect(offers[0].fees.delivery).toBeNull()
    expect(offers[0].etaMinutes).toBeNull() // delivery text ≠ numeric ETA
  })

  it('bad key surfaces as auth_required', async () => {
    stubFetch(() => json({ error: 'Invalid API key' }, 401))
    providerConfig.set('serpapi', { apiKey: 'bad' })
    await expect(serpApiShopping.search(barcodeCtx)).rejects.toMatchObject({ status: 'auth_required' })
  })
})

describe('Flipkart Affiliate (key-gated)', () => {
  it('without credentials: auth_required and zero offers', async () => {
    const fetchFn = stubFetch(() => json(FLIPKART_RESPONSE))
    providerConfig.clear('flipkart')
    expect(flipkartAffiliate.requiresAuth()).toBe(true)
    await expect(flipkartAffiliate.search(barcodeCtx)).rejects.toMatchObject({ status: 'auth_required' })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('with credentials: maps the real feed incl. availability and MRP', async () => {
    const fetchFn = stubFetch((url) => {
      expect(url).toContain('/affiliate/1.0/search.json')
      return json(FLIPKART_RESPONSE)
    })
    providerConfig.set('flipkart', { affiliateId: 'me', affiliateToken: 'tok' })
    const offers = await flipkartAffiliate.search(barcodeCtx)
    expect(offers).toHaveLength(2)
    expect(offers[0]).toMatchObject({
      merchant: 'Flipkart',
      price: 379,
      mrp: 449,
      currency: 'INR',
      availability: 'in_stock',
      rating: 4.4,
      productUrl: FLIPKART_RESPONSE.productInfoList[0].productUrl,
    })
    expect(offers[1].availability).toBe('out_of_stock')
    expect(offers[0].fees.delivery).toBeNull() // feed doesn't disclose fees
    // Credentials travel as the documented Flipkart headers
    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect((init.headers as Record<string, string>)['Fk-Affiliate-Id']).toBe('me')
    expect((init.headers as Record<string, string>)['Fk-Affiliate-Token']).toBe('tok')
  })
})

describe('Pending stores (no authorized API)', () => {
  it('every pending store returns nothing and says why', async () => {
    for (const store of PENDING_STORES) {
      const adapter = pendingAdapter(store)
      await expect(adapter.search(barcodeCtx)).rejects.toMatchObject({
        status: 'integration_pending',
      })
    }
  })
})
