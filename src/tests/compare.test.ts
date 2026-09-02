/**
 * Unit tests — comparison engine (real-data semantics)
 * Unknown fees must stay unknown; unknown ETAs stay unknown; summaries use
 * only comparable, actually-retrieved offers.
 */

import { describe, expect, it } from 'vitest'
import {
  buildSeries, collectedInsight, comparableOffers, describeFreshness,
  discountPercent, feeTotal, finalPrice, formatMoney, offerFreshness,
  priceLine, sortOffers, summarize, assertRealOffer,
} from '../domain/compare'
import { makeOffer } from './fixtures/records'

describe('feeTotal / finalPrice', () => {
  it('sums all disclosed fees', () => {
    const offer = makeOffer({ fees: { delivery: 10, platform: 5, handling: 2, convenience: 3, other: 1 } })
    expect(feeTotal(offer)).toBe(21)
    expect(finalPrice(offer)).toBe(121)
  })

  it('returns null when ANY fee is unknown — never assumes ₹0', () => {
    const offer = makeOffer({ fees: { delivery: null, platform: 5, handling: 0, convenience: 0, other: 0 } })
    expect(feeTotal(offer)).toBeNull()
    expect(finalPrice(offer)).toBeNull()
  })

  it('renders unknown totals as “+ checkout charges”, not a number', () => {
    const offer = makeOffer({ fees: { delivery: null, platform: null, handling: null, convenience: null, other: null } })
    expect(priceLine(offer)).toBe('₹100 + checkout charges')
  })
})

describe('formatMoney', () => {
  it('formats per currency and keeps unknown as At checkout', () => {
    expect(formatMoney(100, 'INR')).toContain('100')
    expect(formatMoney(3.21, 'EUR')).toContain('3,21')
    expect(formatMoney(null)).toBe('At checkout')
  })
})

describe('discount', () => {
  it('computes discount only from a source-stated MRP', () => {
    expect(discountPercent(makeOffer())).toBe(17) // 120 -> 100
    expect(discountPercent(makeOffer({ mrp: null }))).toBeNull()
  })
})

describe('comparableOffers / summarize', () => {
  it('excludes reference points, out-of-stock and weak matches', () => {
    const offers = [
      makeOffer({ id: 'a', price: 100 }),
      makeOffer({ id: 'b', price: 50, kind: 'reference' }),
      makeOffer({ id: 'c', price: 60, availability: 'out_of_stock' }),
      makeOffer({ id: 'd', price: 70, match: 'similar', matchConfidence: 'Possible Match' }),
    ]
    const ids = comparableOffers(offers).map((o) => o.id)
    expect(ids).toEqual(['a'])
  })

  it('computes best price and savings from verified offers only', () => {
    const offers = [
      makeOffer({ id: 'a', price: 100 }),
      makeOffer({ id: 'b', price: 150, sourceName: 'Second Source' }),
    ]
    const s = summarize(offers)
    expect(s.bestPrice?.id).toBe('a')
    expect(s.savings).toBe(50)
    expect(s.nextBestPrice?.sourceName).toBe('Second Source')
  })

  it('returns an empty summary (not a made-up winner) when nothing qualifies', () => {
    expect(summarize([makeOffer({ availability: 'out_of_stock' })])).toEqual({})
    expect(summarize([])).toEqual({})
  })

  it('fastest is undefined when no source supplied an ETA', () => {
    const s = summarize([makeOffer({ etaMinutes: null, deliveryNote: null })])
    expect(s.fastest).toBeUndefined()
  })
})

describe('sortOffers', () => {
  it('sorts by final price and pushes unknown totals last', () => {
    const offers = [
      makeOffer({ id: 'unknown', price: 10, fees: { delivery: null, platform: null, handling: null, convenience: null, other: null } }),
      makeOffer({ id: 'cheap', price: 100, fees: { delivery: 0, platform: 0, handling: 0, convenience: 0, other: 0 } }),
      makeOffer({ id: 'mid', price: 100, fees: { delivery: 20, platform: 0, handling: 0, convenience: 0, other: 0 } }),
    ]
    expect(sortOffers(offers, 'price').map((o) => o.id)).toEqual(['cheap', 'mid', 'unknown'])
  })
})

describe('freshness labels', () => {
  it('live within a minute, updated within 15, cached is labeled cached', () => {
    expect(describeFreshness(Date.now() - 5_000).label).toMatch(/^Live · updated \d+s ago$/)
    expect(describeFreshness(Date.now() - 5 * 60_000).label).toMatch(/^Updated \d+ min ago$/)
    const cached = describeFreshness(Date.now() - 60_000, true)
    expect(cached.label).toMatch(/^Cached · retrieved/)
    expect(cached.cls).toBe('cached')
    expect(offerFreshness(makeOffer({ freshness: 'cached', retrievedAt: Date.now() - 60_000 })).cls).toBe('cached')
  })

  it('old data is labeled stale, never presented as live', () => {
    expect(describeFreshness(Date.now() - 2 * 3_600_000).cls).toBe('stale')
  })
})

describe('provenance guard (assertRealOffer)', () => {
  it('accepts a fully provenance-carrying offer', () => {
    expect(() => assertRealOffer(makeOffer())).not.toThrow()
  })

  it('rejects offers without retrievedAt / source / currency', () => {
    expect(() => assertRealOffer(makeOffer({ retrievedAt: 0 }))).toThrow(/retrievedAt/)
    expect(() => assertRealOffer(makeOffer({ sourceId: '' }))).toThrow(/sourceId/)
    expect(() => assertRealOffer(makeOffer({ currency: '' }))).toThrow(/currency/)
    expect(() => assertRealOffer(makeOffer({ price: 0 }))).toThrow(/price/)
  })

  it('rejects shoppable offers with invalid product URLs', () => {
    expect(() => assertRealOffer(makeOffer({ productUrl: 'not-a-url' }))).toThrow(/productUrl/)
  })
})

describe('collected history', () => {
  const base = {
    productId: 'off:1', productKey: 'gtin:1', productName: 'P',
    sourceId: 's', merchant: null, currency: 'INR',
  }
  it('needs two distinct observation dates before a trend exists', () => {
    const single = buildSeries([{ ...base, price: 10, retrievedAt: 1, observedAt: '2026-01-01' }], 'INR')
    expect(single.enough).toBe(false)
    expect(collectedInsight([single.points[0]], 'INR')).toBeNull()

    const two = buildSeries([
      { ...base, price: 10, retrievedAt: 1, observedAt: '2026-01-01' },
      { ...base, price: 12, retrievedAt: 2, observedAt: '2026-02-01' },
    ], 'INR')
    expect(two.enough).toBe(true)
    expect(collectedInsight(two.points, 'INR')).toMatch(/up/)
  })

  it('separates currencies — never mixes EUR points into an INR series', () => {
    const pts = [
      { ...base, price: 10, retrievedAt: 1, observedAt: '2026-01-01' },
      { ...base, price: 12, retrievedAt: 2, observedAt: '2026-02-01', currency: 'EUR' },
    ]
    expect(buildSeries(pts, 'INR').enough).toBe(false)
  })
})
