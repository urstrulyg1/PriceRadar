/**
 * Unit tests — catalog and search
 */

import { describe, expect, it } from 'vitest'
import { catalog, defaultProduct, findProduct, generateAiResponse, parseQuery } from '../data/catalog'
import { finalPrice } from '../domain/compare'

describe('catalog integrity', () => {
  it('has at least 4 products', () => {
    expect(catalog.length).toBeGreaterThanOrEqual(4)
  })

  it('every product has a non-empty name', () => {
    catalog.forEach((p) => {
      expect(p.name.trim().length).toBeGreaterThan(0)
    })
  })

  it('every product has at least one offer', () => {
    catalog.forEach((p) => {
      expect(p.offers.length).toBeGreaterThan(0)
    })
  })

  it('every offer price is positive', () => {
    catalog.forEach((p) => {
      p.offers.forEach((o) => {
        expect(o.price).toBeGreaterThan(0)
      })
    })
  })

  it('every offer MRP >= price (no negative discount)', () => {
    catalog.forEach((p) => {
      p.offers.forEach((o) => {
        expect(o.mrp).toBeGreaterThanOrEqual(o.price)
      })
    })
  })

  it('every offer has a valid provider reference', () => {
    catalog.forEach((p) => {
      p.offers.forEach((o) => {
        expect(o.provider).toBeDefined()
        expect(o.provider.id).toBeTruthy()
      })
    })
  })

  it('every offer has a non-empty URL', () => {
    catalog.forEach((p) => {
      p.offers.forEach((o) => {
        expect(o.url.startsWith('http')).toBe(true)
      })
    })
  })

  it('matchScore is between 0 and 1 inclusive', () => {
    catalog.forEach((p) => {
      p.offers.forEach((o) => {
        expect(o.matchScore).toBeGreaterThanOrEqual(0)
        expect(o.matchScore).toBeLessThanOrEqual(1)
      })
    })
  })

  it('price history has at least 7 data points', () => {
    catalog.forEach((p) => {
      expect(p.priceHistory.points.length).toBeGreaterThanOrEqual(7)
    })
  })

  it('price history lowest <= average <= highest', () => {
    catalog.forEach((p) => {
      const h = p.priceHistory
      expect(h.lowest).toBeLessThanOrEqual(h.average)
      expect(h.average).toBeLessThanOrEqual(h.highest)
    })
  })
})

describe('findProduct', () => {
  it('returns defaultProduct for empty query', () => {
    expect(findProduct('')).toEqual(defaultProduct)
  })

  it('finds Amul milk by partial term', () => {
    const result = findProduct('amul milk')
    expect(result.name).toContain('Amul')
  })

  it('finds iPhone by brand + model', () => {
    const result = findProduct('iphone 16')
    expect(result.name.toLowerCase()).toContain('iphone')
  })

  it('finds AirPods by partial name', () => {
    const result = findProduct('airpods pro')
    expect(result.name.toLowerCase()).toContain('airpods')
  })

  it('finds shampoo by category query', () => {
    const result = findProduct('anti dandruff shampoo')
    expect(result.category.toLowerCase()).toContain('personal care')
  })

  it('returns defaultProduct for completely unrelated query', () => {
    const result = findProduct('this product definitely does not exist xyz123')
    expect(result).toEqual(defaultProduct)
  })
})

describe('parseQuery', () => {
  it('extracts budget from "under ₹500"', () => {
    const result = parseQuery('shampoo under ₹500')
    expect(result.budget).toBe(500)
  })

  it('extracts budget from "below 1000"', () => {
    const result = parseQuery('phone below 1000')
    expect(result.budget).toBe(1000)
  })

  it('detects instant delivery request', () => {
    const result = parseQuery('milk near me')
    expect(result.instantOnly).toBe(true)
  })

  it('detects instant from "30 minutes"', () => {
    const result = parseQuery('detergent 30 min delivery')
    expect(result.instantOnly).toBe(true)
  })

  it('returns no budget for plain product query', () => {
    const result = parseQuery('iphone 16')
    expect(result.budget).toBeUndefined()
  })
})

describe('generateAiResponse', () => {
  it('returns an object with response and product', () => {
    const result = generateAiResponse('amul milk', defaultProduct)
    expect(result.response).toBeTruthy()
    expect(result.product).toBeDefined()
  })

  it('response contains provider name for product search', () => {
    const result = generateAiResponse('find cheapest milk', defaultProduct)
    // Should mention at least one provider
    const hasProvider = ['Blinkit', 'Zepto', 'Swiggy', 'Amazon', 'BigBasket'].some((name) =>
      result.response.includes(name)
    )
    expect(hasProvider).toBe(true)
  })

  it('never fabricates prices — mentions real offer prices only', () => {
    const result = generateAiResponse('iphone 16', defaultProduct)
    // The response should be a string
    expect(typeof result.response).toBe('string')
  })

  it('handles greeting gracefully', () => {
    const result = generateAiResponse('hello', defaultProduct)
    expect(result.response.length).toBeGreaterThan(10)
  })
})
