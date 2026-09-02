import type { MatchLevel } from './types'

export interface ProductAttributes {
  brand?: string
  name?: string
  model?: string
  sku?: string
  gtin?: string
  variant?: string
  size?: string
  weight?: string
  quantity?: string
  color?: string
  storage?: string
  packSize?: string
}

export interface MatchResult {
  level: MatchLevel
  score: number
  reason: string
}

const clean = (value = '') => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const tokens = (value = '') => new Set(clean(value).split(/\s+/).filter(Boolean))

function sameValue(left?: string, right?: string): boolean {
  if (!left || !right) return false
  return clean(left) === clean(right)
}

function hasSharedToken(left?: string, right?: string): boolean {
  if (!left || !right) return false
  const leftTokens = tokens(left)
  return [...tokens(right)].some((token) => leftTokens.has(token))
}

/**
 * Conservative matching on normalized attributes. A product is exact only
 * when strong identifiers match, or when brand + variant/quantity attributes
 * all agree. Name similarity alone can never produce an exact match.
 */
export function matchProduct(reference: ProductAttributes, candidate: ProductAttributes): MatchResult {
  const identifiers = [
    ['GTIN', reference.gtin, candidate.gtin],
    ['SKU', reference.sku, candidate.sku],
    ['model', reference.model, candidate.model],
  ] as Array<[string, string | undefined, string | undefined]>

  const strongIdentifier = identifiers.find(([, left, right]) => left && right && sameValue(left, right))
  const conflictingIdentifier = identifiers.find(([, left, right]) => left && right && !sameValue(left, right))
  const brandMatches = sameValue(reference.brand, candidate.brand)
  const variantMatches = sameValue(reference.variant, candidate.variant) || hasSharedToken(reference.variant, candidate.variant)
  const sizeMatches = sameValue(reference.size ?? reference.quantity, candidate.size ?? candidate.quantity)
  const colorMatches = sameValue(reference.color, candidate.color)
  const storageMatches = sameValue(reference.storage, candidate.storage)

  if (conflictingIdentifier) {
    return { level: 'similar', score: 0.54, reason: `${conflictingIdentifier[0]} differs` }
  }
  if (strongIdentifier && brandMatches && variantMatches && sizeMatches) {
    return { level: 'exact', score: 1, reason: `${strongIdentifier[0]} and variant attributes match` }
  }
  if (brandMatches && variantMatches && sizeMatches && (!reference.color || colorMatches) && (!reference.storage || storageMatches)) {
    return { level: 'exact', score: 0.96, reason: 'Brand, variant and size attributes match' }
  }

  const matchingAttributes = [brandMatches, variantMatches, sizeMatches, colorMatches, storageMatches].filter(Boolean).length
  if (matchingAttributes >= 3) return { level: 'likely', score: 0.82, reason: 'Most attributes match; identifier needs verification' }
  return { level: 'similar', score: 0.62, reason: 'Name or category is similar, but variant differs' }
}
