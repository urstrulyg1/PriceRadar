/**
 * Unit tests — price comparison engine
 * Run: npx vitest run
 */

import { describe, expect, it } from 'vitest'
import { buildFeeRows, discountPercent, feeTotal, finalPrice, formatRupees, priceInsight, sortOffers, summarize } from '../domain/compare'
import type { Offer, PriceHistory, Provider } from '../domain/types'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const provider: Provider = {
  id: 'test', name: 'TestProvider', shortName: 'T', kind: 'instant',
  mark: 'T', color: '#fff', background: '#000', isConnected: true,
}

function makeOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: 'o1', provider, mode: 'instant',
    productName: 'Test Product', brand: 'Brand', variant: 'V1', quantity: '1',
    price: 100, mrp: 120,
    fees: { delivery: 10, platform: 5, handling: 0, convenience: 0, other: 0 },
    etaLabel: '15 min', etaMinutes: 15,
    availability: 'in_stock', stockLabel: 'In stock',
    seller: 'Seller', location: 'City',
    match: 'exact', matchConfidence: 'Exact Match', matchScore: 0.99,
    matchReason: 'All attributes match',
    pricePerUnit: '₹100 / unit',
    freshness: 'live', updatedSeconds: 10,
    url: 'https://example.com',
    isLiveData: false,
    ...overrides,
  }
}

// ─── feeTotal ─────────────────────────────────────────────────────────────────

describe('feeTotal', () => {
  it('sums all non-null fee fields', () => {
    const offer = makeOffer({ fees: { delivery: 10, platform: 5, handling: 2, convenience: 3, other: 1 } })
    expect(feeTotal(offer)).toBe(21)
  })

  it('returns null when any fee is null', () => {
    const offer = makeOffer({ fees: { delivery: null, platform: 5, handling: 0, convenience: 0, other: 0 } })
    expect(feeTotal(offer)).toBeNull()
  })

  it('returns 0 when all fees are 0', () => {
    const offer = makeOffer({ fees: { delivery: 0, platform: 0, handling: 0, convenience: 0, other: 0 } })
    expect(feeTotal(offer)).toBe(0)
  })
})

// ─── finalPrice ───────────────────────────────────────────────────────────────

describe('finalPrice', () => {
  it('returns price + fees when all fees known', () => {
    const offer = makeOffer({ price: 100, fees: { delivery: 10, platform: 5, handling: 0, convenience: 0, other: 0 } })
    expect(finalPrice(offer)).toBe(115)
  })

  it('returns null when any fee is null', () => {
    const offer = makeOffer({ fees: { delivery: null, platform: 5, handling: 0, convenience: 0, other: 0 } })
    expect(finalPrice(offer)).toBeNull()
  })

  it('returns price when all fees are 0', () => {
    const offer = makeOffer({ price: 250, fees: { delivery: 0, platform: 0, handling: 0, convenience: 0, other: 0 } })
    expect(finalPrice(offer)).toBe(250)
  })
})

// ─── discountPercent ──────────────────────────────────────────────────────────

describe('discountPercent', () => {
  it('calculates correct discount percentage', () => {
    expect(discountPercent(makeOffer({ price: 80, mrp: 100 }))).toBe(20)
  })

  it('returns 0 when price equals MRP', () => {
    expect(discountPercent(makeOffer({ price: 100, mrp: 100 }))).toBe(0)
  })

  it('returns 0 for zero MRP', () => {
    expect(discountPercent(makeOffer({ price: 50, mrp: 0 }))).toBe(0)
  })

  it('rounds correctly', () => {
    expect(discountPercent(makeOffer({ price: 67, mrp: 100 }))).toBe(33)
  })
})

// ─── formatRupees ─────────────────────────────────────────────────────────────

describe('formatRupees', () => {
  it('formats in Indian locale', () => {
    expect(formatRupees(1000)).toContain('1,000')
  })

  it('formats large numbers with correct grouping', () => {
    expect(formatRupees(69499)).toContain('69,499')
  })

  it('returns "At checkout" for null', () => {
    expect(formatRupees(null)).toBe('At checkout')
  })

  it('compact notation uses K/L suffix', () => {
    const result = formatRupees(1000, true)
    expect(result).toMatch(/K|k|thousand/i)
  })
})

// ─── sortOffers ───────────────────────────────────────────────────────────────

describe('sortOffers', () => {
  const cheap = makeOffer({ id: 'cheap', price: 50, fees: { delivery: 0, platform: 0, handling: 0, convenience: 0, other: 0 } })
  const expensive = makeOffer({ id: 'expensive', price: 100, fees: { delivery: 0, platform: 0, handling: 0, convenience: 0, other: 0 } })
  const fast = makeOffer({ id: 'fast', price: 80, etaMinutes: 5, fees: { delivery: 5, platform: 0, handling: 0, convenience: 0, other: 0 } })

  it('sorts by price ascending', () => {
    const sorted = sortOffers([expensive, cheap, fast], 'price')
    expect(sorted[0].id).toBe('cheap')
  })

  it('sorts by speed (etaMinutes) ascending', () => {
    const sorted = sortOffers([expensive, cheap, fast], 'speed')
    expect(sorted[0].id).toBe('fast')
  })

  it('does not mutate the input array', () => {
    const input = [expensive, cheap]
    const sorted = sortOffers(input, 'price')
    expect(input[0].id).toBe('expensive')
    expect(sorted[0].id).toBe('cheap')
  })

  it('sorts by discount descending', () => {
    const highDisc = makeOffer({ id: 'high-disc', price: 50, mrp: 100 })
    const lowDisc  = makeOffer({ id: 'low-disc',  price: 90, mrp: 100 })
    const sorted = sortOffers([lowDisc, highDisc], 'discount')
    expect(sorted[0].id).toBe('high-disc')
  })
})

// ─── summarize ────────────────────────────────────────────────────────────────

describe('summarize', () => {
  it('returns empty object for empty array', () => {
    expect(summarize([])).toEqual({})
  })

  it('identifies bestPrice correctly', () => {
    const cheap = makeOffer({ id: 'cheap', price: 50, fees: { delivery: 0, platform: 0, handling: 0, convenience: 0, other: 0 } })
    const pricey = makeOffer({ id: 'pricey', price: 100, fees: { delivery: 0, platform: 0, handling: 0, convenience: 0, other: 0 } })
    expect(summarize([pricey, cheap]).bestPrice?.id).toBe('cheap')
  })

  it('excludes unavailable offers', () => {
    const unavail = makeOffer({ id: 'unavail', price: 1, availability: 'unavailable' })
    const instock = makeOffer({ id: 'instock', price: 50, fees: { delivery: 0, platform: 0, handling: 0, convenience: 0, other: 0 } })
    expect(summarize([unavail, instock]).bestPrice?.id).toBe('instock')
  })

  it('identifies fastest correctly', () => {
    const fast = makeOffer({ id: 'fast', etaMinutes: 8 })
    const slow = makeOffer({ id: 'slow', etaMinutes: 40 })
    expect(summarize([slow, fast]).fastest?.id).toBe('fast')
  })
})

// ─── buildFeeRows ─────────────────────────────────────────────────────────────

describe('buildFeeRows', () => {
  it('includes product price as first row', () => {
    const rows = buildFeeRows(makeOffer({ price: 100 }))
    expect(rows[0]).toEqual(['Product price', 100])
  })

  it('includes a discount row when mrp > price', () => {
    const rows = buildFeeRows(makeOffer({ price: 80, mrp: 100 }))
    const discRow = rows.find(([label]) => label === 'Discount')
    expect(discRow).toBeDefined()
    expect(discRow![1]).toBe(-20)
  })

  it('only includes fee rows with positive values', () => {
    const offer = makeOffer({
      price: 100, mrp: 100,
      fees: { delivery: 10, platform: 0, handling: 0, convenience: 0, other: 0 },
    })
    const rows = buildFeeRows(offer)
    const labels = rows.map(([l]) => l)
    expect(labels).toContain('Delivery fee')
    expect(labels).not.toContain('Platform fee')
  })
})

// ─── priceInsight ─────────────────────────────────────────────────────────────

describe('priceInsight', () => {
  const history: PriceHistory = {
    points: [{ date: '2025-08-01', price: 100 }],
    lowest: 80, highest: 120, average: 100,
    change: 0, changePercent: 0, trend: 'flat', period: 'last 30 days',
  }

  it('reports when price is below average', () => {
    const insight = priceInsight({ ...history, average: 100 }, 85)
    expect(insight).toContain('below')
  })

  it('reports when price is above average', () => {
    const insight = priceInsight({ ...history, average: 100 }, 115)
    expect(insight).toContain('above')
  })

  it('reports near average', () => {
    const insight = priceInsight({ ...history, average: 100 }, 100)
    expect(insight).toContain('near')
  })
})
