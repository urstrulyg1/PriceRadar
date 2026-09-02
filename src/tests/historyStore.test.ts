/**
 * Unit tests — collected price history store.
 * The history database may contain ONLY points PriceRadar actually retrieved.
 * No seeding, no generation, no interpolation.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { clearCollected, getCollectedPoints, productKeyOf, recordOffers, allCollectedPoints } from '../services/priceHistoryStore'
import { makeOffer } from './fixtures/records'
import type { ProductIdentity } from '../domain/types'

const identity = (barcode?: string): ProductIdentity => ({
  id: `off:${barcode ?? 'x'}`,
  sourceId: 'openfoodfacts',
  sourceName: 'Open Food Facts',
  ...(barcode ? { barcode } : {}),
  name: 'Nutella',
  url: 'https://world.openfoodfacts.org/product/x/',
  retrievedAt: Date.now(),
})

beforeEach(() => {
  localStorage.clear()
  clearCollected()
})

describe('price history store', () => {
  it('starts completely empty — no seeded history', () => {
    expect(allCollectedPoints()).toEqual([])
    expect(getCollectedPoints('gtin:3017620422003')).toEqual([])
  })

  it('records exactly what a real retrieval produced', () => {
    const offers = [
      makeOffer({ price: 379, currency: 'INR', retrievedAt: 1_000, observedAt: '2026-01-01' }),
      makeOffer({ price: 2.99, currency: 'EUR', retrievedAt: 2_000, observedAt: '2026-01-02' }),
    ]
    recordOffers(identity('3017620422003'), offers)
    const pts = getCollectedPoints(productKeyOf(identity('3017620422003')))
    expect(pts).toHaveLength(2)
    expect(pts[0]).toMatchObject({ price: 379, currency: 'INR', retrievedAt: 1_000 })
    expect(pts[1].currency).toBe('EUR')
  })

  it('keeps products isolated by key (barcode vs name)', () => {
    recordOffers(identity('3017620422003'), [makeOffer({ price: 1 })])
    recordOffers(identity(undefined), [makeOffer({ price: 2 })])
    expect(getCollectedPoints('gtin:3017620422003')).toHaveLength(1)
    expect(getCollectedPoints(productKeyOf(identity(undefined)))).toHaveLength(1)
  })

  it('survives a page reload via localStorage and can be cleared', () => {
    recordOffers(identity('3017620422003'), [makeOffer()])
    expect(localStorage.getItem('priceradar.collected.v1')).toBeTruthy()
    clearCollected()
    expect(allCollectedPoints()).toEqual([])
  })
})
