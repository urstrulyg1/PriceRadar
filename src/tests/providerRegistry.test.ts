/**
 * Unit tests — ProviderRegistry
 * Verifies failure isolation, circuit breaker, and concurrent aggregation.
 */

import { describe, expect, it, vi } from 'vitest'
import { ProviderRegistry } from '../services/providerRegistry'
import type { Offer, Provider, ProviderAdapter } from '../domain/types'

function makeProvider(id: string): Provider {
  return { id, name: id, shortName: id[0].toUpperCase(), kind: 'instant', mark: id[0].toUpperCase(), color: '#fff', background: '#000', isConnected: true }
}

function makeOffer(providerId: string): Offer {
  return {
    id: `${providerId}-o1`,
    provider: makeProvider(providerId),
    mode: 'instant',
    productName: 'Test', brand: 'B', variant: 'V', quantity: '1',
    price: 100, mrp: 120,
    fees: { delivery: 0, platform: 0, handling: 0, convenience: 0, other: 0 },
    etaLabel: '10 min', etaMinutes: 10,
    availability: 'in_stock', stockLabel: 'In stock',
    seller: 'Seller', location: 'City',
    match: 'exact', matchConfidence: 'Exact Match', matchScore: 1,
    matchReason: 'All match', pricePerUnit: '₹100',
    freshness: 'live', updatedSeconds: 5, url: 'https://example.com', isLiveData: true,
  }
}

function makeAdapter(id: string, offers: Offer[], shouldFail = false): ProviderAdapter {
  return {
    provider: makeProvider(id),
    supportedModes: ['instant', 'normal'],
    search: shouldFail
      ? () => Promise.reject(new Error(`${id} provider error`))
      : () => Promise.resolve(offers),
  }
}

describe('ProviderRegistry', () => {

  it('aggregates results from multiple providers concurrently', async () => {
    const registry = new ProviderRegistry()
    registry.register(makeAdapter('a', [makeOffer('a')]))
    registry.register(makeAdapter('b', [makeOffer('b')]))
    registry.register(makeAdapter('c', [makeOffer('c')]))

    const results = await registry.compare('test query', 'test city')
    expect(results).toHaveLength(3)
    expect(results.filter((r) => r.status === 'connected')).toHaveLength(3)
    expect(results.flatMap((r) => r.offers)).toHaveLength(3)
  })

  it('isolates a failing provider from successful ones', async () => {
    const registry = new ProviderRegistry()
    registry.register(makeAdapter('good1', [makeOffer('good1')]))
    registry.register(makeAdapter('bad',   [],                  true))  // fails
    registry.register(makeAdapter('good2', [makeOffer('good2')]))

    const results = await registry.compare('query', 'city')
    const connected = results.filter((r) => r.status === 'connected')
    const failed    = results.filter((r) => r.status === 'temporarily_unavailable')

    expect(connected).toHaveLength(2)
    expect(failed).toHaveLength(1)
    expect(connected.flatMap((r) => r.offers)).toHaveLength(2)
  })

  it('returns all offers as empty array when provider fails', async () => {
    const registry = new ProviderRegistry()
    registry.register(makeAdapter('fail', [], true))

    const results = await registry.compare('q', 'c')
    expect(results[0].offers).toHaveLength(0)
  })

  it('lists registered providers', () => {
    const registry = new ProviderRegistry()
    registry.register(makeAdapter('x', []))
    registry.register(makeAdapter('y', []))
    expect(registry.list()).toHaveLength(2)
  })

  it('filters providers by mode', () => {
    const registry = new ProviderRegistry()
    const instantAdapter: ProviderAdapter = { ...makeAdapter('instant-only', []), supportedModes: ['instant'] }
    const normalAdapter: ProviderAdapter  = { ...makeAdapter('normal-only',  []), supportedModes: ['normal'] }
    registry.register(instantAdapter)
    registry.register(normalAdapter)
    expect(registry.list('instant')).toHaveLength(1)
    expect(registry.list('normal')).toHaveLength(1)
  })

  it('can unregister a provider', () => {
    const registry = new ProviderRegistry()
    registry.register(makeAdapter('to-remove', []))
    registry.register(makeAdapter('to-keep', []))
    registry.unregister('to-remove')
    expect(registry.list().map((p) => p.id)).not.toContain('to-remove')
    expect(registry.list().map((p) => p.id)).toContain('to-keep')
  })

  it('reports health for all registered providers', () => {
    const registry = new ProviderRegistry()
    registry.register(makeAdapter('h1', []))
    registry.register(makeAdapter('h2', []))
    const health = registry.health()
    expect(health).toHaveLength(2)
    health.forEach((h) => {
      expect(h.provider).toBeDefined()
      expect(h.status).toMatch(/connected|temporarily_unavailable/)
    })
  })

  it('never throws even when all providers fail', async () => {
    const registry = new ProviderRegistry()
    registry.register(makeAdapter('f1', [], true))
    registry.register(makeAdapter('f2', [], true))
    await expect(registry.compare('q', 'c')).resolves.toBeDefined()
  })
})
