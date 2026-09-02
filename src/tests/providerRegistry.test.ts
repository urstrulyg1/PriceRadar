/**
 * Unit tests — ProviderRegistry
 * Failure isolation: a source that fails, lacks credentials, or has no
 * authorized integration yields ZERO offers and an honest status.
 */

import { describe, expect, it } from 'vitest'
import { ProviderRegistry } from '../services/providerRegistry'
import { ProviderUnavailableError, type Offer, type OfferAdapter, type SearchContext } from '../domain/types'
import { makeOffer } from './fixtures/records'

const ctx: SearchContext = { query: 'nutella', location: null, mode: 'all' }

function adapter(partial: Partial<OfferAdapter> & Pick<OfferAdapter, 'id' | 'name'>): OfferAdapter {
  return {
    kind: 'shoppable',
    accessNote: 'Test adapter',
    requiresAuth: () => false,
    search: async () => [makeOffer()],
    ...partial,
  }
}

describe('ProviderRegistry', () => {
  it('returns live status with offers from a working source', async () => {
    const reg = new ProviderRegistry()
    reg.register(adapter({ id: 'good', name: 'Good' }))
    const results = await reg.compare(ctx)
    expect(results[0].status).toBe('live')
    expect(results[0].offers).toHaveLength(1)
  })

  it('a failing source yields zero offers and temporarily_unavailable — never an estimate', async () => {
    const reg = new ProviderRegistry()
    reg.register(adapter({
      id: 'bad', name: 'Bad',
      search: async () => { throw new Error('HTTP 500') },
    }))
    reg.register(adapter({ id: 'good', name: 'Good' }))
    const results = await reg.compare(ctx)
    const bad = results.find((r) => r.sourceId === 'bad')!
    expect(bad.status).toBe('error')
    expect(bad.offers).toEqual([])
    expect(bad.error).toContain('HTTP 500')
    expect(results.find((r) => r.sourceId === 'good')!.offers).toHaveLength(1)
  })

  it('unauthenticated sources report auth_required without being queried', async () => {
    let queried = false
    const reg = new ProviderRegistry()
    reg.register(adapter({
      id: 'locked', name: 'Locked',
      requiresAuth: () => true,
      accessNote: 'API key required',
      search: async () => { queried = true; return [] },
    }))
    const results = await reg.compare(ctx)
    expect(results[0].status).toBe('auth_required')
    expect(results[0].offers).toEqual([])
    expect(queried).toBe(false)
  })

  it('integration_pending stores return nothing, ever', async () => {
    const reg = new ProviderRegistry()
    reg.register(adapter({
      id: 'nostore', name: 'NoStore',
      staticStatus: 'integration_pending',
      search: async () => {
        throw new ProviderUnavailableError('integration_pending', 'No authorized API')
      },
    }))
    const results = await reg.compare(ctx)
    expect(results[0].status).toBe('integration_pending')
    expect(results[0].offers).toEqual([])
  })

  it('deliberate skips (e.g. barcode-only source) stay connected with a note', async () => {
    const reg = new ProviderRegistry()
    reg.register(adapter({
      id: 'skip', name: 'Skip',
      search: async () => {
        throw new ProviderUnavailableError('connected', 'Skipped — needs a barcode')
      },
    }))
    const results = await reg.compare(ctx)
    expect(results[0].status).toBe('connected')
    expect(results[0].note).toContain('Skipped')
    expect(results[0].offers).toEqual([])
  })

  it('timeouts surface as temporarily_unavailable with zero offers', async () => {
    const reg = new ProviderRegistry()
    reg.register(adapter({
      id: 'slow', name: 'Slow',
      search: () => new Promise<Offer[]>((resolve) => setTimeout(resolve, 20_000)),
    }))
    const results = await reg.compare(ctx)
    expect(results[0].status).toBe('temporarily_unavailable')
    expect(results[0].offers).toEqual([])
  }, 20_000)

  it('idleStatus reflects pending / auth / connected before any query', () => {
    const reg = new ProviderRegistry()
    reg.register(adapter({ id: 'a', name: 'A', staticStatus: 'integration_pending' }))
    reg.register(adapter({ id: 'b', name: 'B', requiresAuth: () => true }))
    reg.register(adapter({ id: 'c', name: 'C' }))
    const statuses = Object.fromEntries(reg.list().map((a) => [a.id, reg.idleStatus(a)]))
    expect(statuses).toEqual({
      a: 'integration_pending',
      b: 'auth_required',
      c: 'connected',
    })
  })
})
