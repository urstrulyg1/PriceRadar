/**
 * Integration tests — search pipeline (identity → authorized sources → offers)
 * with stubbed upstreams, plus cache freshness metadata.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSearchService } from '../services/search'
import { ProviderRegistry } from '../services/providerRegistry'
import {
  OFF_PRODUCT_RESPONSE, OPEN_PRICES_RESPONSE, UPCITEMDB_RESPONSE,
} from './fixtures/records'
import { allCollectedPoints, clearCollected } from '../services/priceHistoryStore'

function stubUpstreams() {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/openfoodfacts')) {
      return new Response(JSON.stringify(OFF_PRODUCT_RESPONSE), { status: 200 })
    }
    if (url.includes('/api/openprices')) {
      return new Response(JSON.stringify(OPEN_PRICES_RESPONSE), { status: 200 })
    }
    if (url.includes('/api/upcitemdb')) {
      return new Response(JSON.stringify(UPCITEMDB_RESPONSE), { status: 200 })
    }
    return new Response('{}', { status: 200 })
  }))
}

beforeEach(() => {
  localStorage.clear()
  clearCollected()
  stubUpstreams()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('search pipeline', () => {
  it('resolves a real identity and collects offers only from live sources', async () => {
    const svc = createSearchService(new ProviderRegistry())
    const result = await svc.run('3017620422003', null)

    expect(result.identity?.barcode).toBe('3017620422003')
    expect(result.identity?.name).toBe('Nutella')

    // 2 UPCitemDB shoppable + 2 Open Prices reference
    expect(result.offers.filter((o) => o.kind === 'shoppable')).toHaveLength(2)
    expect(result.offers.filter((o) => o.kind === 'reference')).toHaveLength(2)

    const byStatus = Object.fromEntries(result.results.map((r) => [r.sourceId, r.status]))
    expect(byStatus.upcitemdb).toBe('live')
    expect(byStatus.openprices).toBe('live')
    expect(byStatus.serpapi).toBe('auth_required')       // no key configured
    expect(byStatus.flipkart).toBe('auth_required')      // no creds configured
    expect(byStatus.blinkit).toBe('integration_pending') // never fabricated

    // Every offer carries provenance
    for (const o of result.offers) {
      expect(o.retrievedAt).toBeGreaterThan(0)
      expect(o.sourceId).toBeTruthy()
      expect(o.currency).toMatch(/^[A-Z]{3}$/)
    }

    // History recorded exactly what was retrieved
    expect(allCollectedPoints()).toHaveLength(4)
  })

  it('when the identity source is down, the search still reports honestly', async () => {
    vi.unstubAllGlobals()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network down') }))
    const svc = createSearchService(new ProviderRegistry())
    const result = await svc.run('nutella', null)
    expect(result.identity).toBeNull()
    expect(result.identityStatus).toBe('temporarily_unavailable')
    expect(result.offers).toEqual([])
    const err = result.results.find((r) => r.sourceId === 'upcitemdb')
    expect(err?.offers).toEqual([])
  })

  it('cached results are labeled cached — never presented as live', async () => {
    const svc = createSearchService(new ProviderRegistry())
    const first = await svc.run('3017620422003', null)
    expect(first.offers.every((o) => o.freshness === 'live')).toBe(true)

    const second = await svc.run('3017620422003', null) // within TTL
    expect(second.offers.length).toBeGreaterThan(0)
    expect(second.offers.every((o) => o.freshness === 'cached')).toBe(true)

    const forced = await svc.run('3017620422003', null, { force: true })
    expect(forced.offers.every((o) => o.freshness === 'live')).toBe(true)
  })

  it('partial results are acceptable — some live, some honest-empty', async () => {
    const svc = createSearchService(new ProviderRegistry())
    const result = await svc.run('3017620422003', null)
    const live = result.results.filter((r) => r.offers.length > 0).length
    const empty = result.results.filter((r) => r.offers.length === 0).length
    expect(live).toBeGreaterThanOrEqual(2)
    expect(empty).toBeGreaterThanOrEqual(2) // auth_required + pending never fabricate
  })
})
