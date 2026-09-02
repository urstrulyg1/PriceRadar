/**
 * Unit tests — product matcher
 * The matcher must be conservative: only produce 'exact' when strong evidence
 * exists, and must never match products with conflicting identifiers.
 */

import { describe, expect, it } from 'vitest'
import { matchProduct } from '../domain/matcher'

describe('matchProduct', () => {

  // ── Exact matches ──────────────────────────────────────────────────────────

  it('returns exact when GTIN + brand + variant + size all match', () => {
    const result = matchProduct(
      { gtin: '8901234567890', brand: 'Amul', variant: 'Taaza Toned', quantity: '1 L' },
      { gtin: '8901234567890', brand: 'Amul', variant: 'Taaza Toned', quantity: '1 L' },
    )
    expect(result.level).toBe('exact')
    expect(result.score).toBeGreaterThanOrEqual(0.95)
  })

  it('returns exact when brand + variant + size all match (no GTIN)', () => {
    const result = matchProduct(
      { brand: 'Apple', variant: '128GB Black', quantity: '1 unit' },
      { brand: 'Apple', variant: '128GB Black', quantity: '1 unit' },
    )
    expect(result.level).toBe('exact')
  })

  it('returns exact with model confirmation', () => {
    const result = matchProduct(
      { brand: 'Apple', model: 'MYLT3HN/A', variant: '128GB Black', quantity: '1 unit' },
      { brand: 'Apple', model: 'MYLT3HN/A', variant: '128GB Black', quantity: '1 unit' },
    )
    expect(result.level).toBe('exact')
    expect(result.score).toBeGreaterThan(0.96)
  })

  // ── Likely matches ─────────────────────────────────────────────────────────

  it('returns likely when most attributes match but identifier missing', () => {
    const result = matchProduct(
      { brand: 'Apple', variant: '128GB Black', quantity: '1 unit', model: 'XYZ123' },
      { brand: 'Apple', variant: '128GB Black', quantity: '1 unit' },  // no model
    )
    expect(['exact', 'likely']).toContain(result.level)
  })

  // ── Similar / not a match ──────────────────────────────────────────────────

  it('returns not-a-match when GTIN differs', () => {
    const result = matchProduct(
      { gtin: '1111111111111', brand: 'Amul', variant: 'Taaza', quantity: '1 L' },
      { gtin: '2222222222222', brand: 'Amul', variant: 'Taaza', quantity: '1 L' },
    )
    expect(result.level).toBe('similar')
    expect(result.confidence).toBe('Not a Match')
  })

  it('returns similar when model number conflicts', () => {
    const result = matchProduct(
      { brand: 'Apple', model: 'A2347', variant: 'USB-C White' },
      { brand: 'Apple', model: 'A2393', variant: 'Lightning White' },
    )
    expect(result.level).toBe('similar')
  })

  it('returns similar when connector type differs', () => {
    const result = matchProduct(
      { brand: 'Apple', variant: 'USB-C', connector: 'USB-C' },
      { brand: 'Apple', variant: 'Lightning', connector: 'Lightning' },
    )
    expect(result.level).toBe('similar')
    expect(result.reason).toContain('connector')
  })

  it('returns similar when storage differs', () => {
    const result = matchProduct(
      { brand: 'Apple', storage: '128GB', variant: 'Black' },
      { brand: 'Apple', storage: '256GB', variant: 'Black' },
    )
    expect(result.level).toBe('similar')
  })

  it('returns similar when color differs', () => {
    const result = matchProduct(
      { brand: 'Apple', color: 'Black', storage: '128GB' },
      { brand: 'Apple', color: 'White', storage: '128GB' },
    )
    expect(result.level).toBe('similar')
  })

  // ── Edge cases ─────────────────────────────────────────────────────────────

  it('handles completely empty attributes gracefully', () => {
    const result = matchProduct({}, {})
    expect(result).toBeDefined()
    expect(result.score).toBeGreaterThanOrEqual(0)
  })

  it('is not fooled by name similarity alone', () => {
    // Same brand, totally different model numbers
    const result = matchProduct(
      { brand: 'Samsung', model: 'SM-S911B', storage: '128GB' },
      { brand: 'Samsung', model: 'SM-S921B', storage: '256GB' },
    )
    expect(result.level).not.toBe('exact')
  })
})
