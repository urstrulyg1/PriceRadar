import type { MatchConfidence, MatchLevel, Offer, ProductIdentity } from './types'

// ─── Normalized product identity ──────────────────────────────────────────────
// Two products are the same only when strong identifiers agree, or when a
// sufficient set of normalized attributes all match.
// Name similarity alone is NEVER enough for an exact match.

export interface ProductAttributes {
  brand?: string
  name?: string
  model?: string
  sku?: string
  gtin?: string
  upc?: string
  ean?: string
  variant?: string
  size?: string
  weight?: string
  quantity?: string
  color?: string
  storage?: string
  packSize?: string
  generation?: string
  connector?: string
}

export interface MatchResult {
  level: MatchLevel
  confidence: MatchConfidence
  score: number
  reason: string
}

// ─── String normalization ─────────────────────────────────────────────────────

const clean = (v = '') => v.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const tokenSet = (v = '') => new Set(clean(v).split(/\s+/).filter(Boolean))

function equalNorm(a?: string, b?: string): boolean {
  if (!a || !b) return false
  return clean(a) === clean(b)
}

function sharedToken(a?: string, b?: string): boolean {
  if (!a || !b) return false
  const ta = tokenSet(a)
  return [...tokenSet(b)].some((t) => ta.has(t))
}

// ─── Identifier matching ──────────────────────────────────────────────────────

const STRONG_IDS: Array<keyof ProductAttributes> = ['gtin', 'upc', 'ean', 'sku']

function strongIdMatch(ref: ProductAttributes, cand: ProductAttributes): { key: string; matched: boolean } | null {
  for (const key of STRONG_IDS) {
    const r = ref[key], c = cand[key]
    if (r && c) return { key, matched: equalNorm(r, c) }
  }
  return null
}

function modelMatch(ref: ProductAttributes, cand: ProductAttributes): boolean | null {
  if (!ref.model || !cand.model) return null
  return equalNorm(ref.model, cand.model)
}

// ─── Attribute scoring ────────────────────────────────────────────────────────

interface AttrScores {
  brand: boolean
  variant: boolean
  size: boolean
  color: boolean | null
  storage: boolean | null
  generation: boolean | null
  connector: boolean | null
}

function scoreAttributes(ref: ProductAttributes, cand: ProductAttributes): AttrScores {
  const refSize = ref.size ?? ref.quantity ?? ref.weight
  const candSize = cand.size ?? cand.quantity ?? cand.weight
  return {
    brand: equalNorm(ref.brand, cand.brand),
    variant: equalNorm(ref.variant, cand.variant) || sharedToken(ref.variant, cand.variant),
    size: equalNorm(refSize, candSize),
    color: ref.color && cand.color ? equalNorm(ref.color, cand.color) : null,
    storage: ref.storage && cand.storage ? equalNorm(ref.storage, cand.storage) : null,
    generation: ref.generation && cand.generation ? equalNorm(ref.generation, cand.generation) : null,
    connector: ref.connector && cand.connector ? equalNorm(ref.connector, cand.connector) : null,
  }
}

// ─── Main matcher ─────────────────────────────────────────────────────────────

export function matchProduct(ref: ProductAttributes, cand: ProductAttributes): MatchResult {
  // 1. Conflicting strong identifiers → immediately not a match
  const strongId = strongIdMatch(ref, cand)
  if (strongId && !strongId.matched) {
    return {
      level: 'similar',
      confidence: 'Not a Match',
      score: 0.4,
      reason: `${strongId.key.toUpperCase()} does not match`,
    }
  }

  // 2. Model conflict → not the same product
  const model = modelMatch(ref, cand)
  if (model === false) {
    return {
      level: 'similar',
      confidence: 'Not a Match',
      score: 0.45,
      reason: 'Model number differs',
    }
  }

  const attrs = scoreAttributes(ref, cand)

  // 3. Critical attribute conflicts → at best "similar"
  if (attrs.color === false || attrs.storage === false || attrs.connector === false) {
    const conflict = attrs.color === false ? 'color' : attrs.storage === false ? 'storage' : 'connector'
    return {
      level: 'similar',
      confidence: 'Possible Match',
      score: 0.58,
      reason: `Variant conflict: ${conflict} differs`,
    }
  }

  // 4. Exact: strong ID + brand + variant + size all agree
  if (strongId?.matched && attrs.brand && attrs.variant && attrs.size) {
    return {
      level: 'exact',
      confidence: 'Exact Match',
      score: 1.0,
      reason: `${strongId.key.toUpperCase()}, brand, variant and size all match`,
    }
  }

  // 5. Exact by attributes: brand + variant + size + optional specifiers
  if (attrs.brand && attrs.variant && attrs.size) {
    const modelBonus = model === true
    const score = modelBonus ? 0.98 : 0.95
    const parts = ['Brand, variant and size match']
    if (modelBonus) parts.push('model confirmed')
    if (strongId?.matched) parts.push(`${strongId.key.toUpperCase()} verified`)
    return { level: 'exact', confidence: 'Exact Match', score, reason: parts.join('; ') }
  }

  // 6. Likely: brand + 2 of (variant, size, model)
  const attrMatches = [attrs.brand, attrs.variant, attrs.size, model === true].filter(Boolean).length
  if (attrMatches >= 3) {
    return {
      level: 'likely',
      confidence: 'High Confidence',
      score: 0.82,
      reason: 'Most attributes match; identifier needs verification',
    }
  }

  // 7. Similar
  return {
    level: 'similar',
    confidence: 'Possible Match',
    score: 0.55,
    reason: 'Name or category is similar but key attributes differ',
  }
}

// ─── Attribute extraction from real records ───────────────────────────────────

/** Pull matchable attributes out of a resolved real product identity. */
export function attributesFromIdentity(identity: ProductIdentity): ProductAttributes {
  return {
    brand: identity.brand,
    name: identity.name,
    gtin: identity.barcode,
    size: identity.quantity,
    quantity: identity.quantity,
  }
}

const SIZE_RE = /\b(\d+(?:\.\d+)?)\s?(ml|l|litre|liter|g|kg|gm|gram|grams|pcs|pieces|pack|pk)\b/i

/**
 * Extract matchable attributes from a real listing title.
 * Only tokens actually present in the source title are used — nothing is
 * inferred or invented.
 */
export function attributesFromTitle(title: string, extra: { brand?: string | null; barcode?: string | null; color?: string | null; size?: string | null; model?: string | null } = {}): ProductAttributes {
  const attrs: ProductAttributes = {
    name: title,
    gtin: extra.barcode ?? undefined,
    brand: extra.brand ?? undefined,
    color: extra.color ?? undefined,
    size: extra.size ?? undefined,
    model: extra.model ?? undefined,
  }
  const sizeMatch = title.match(SIZE_RE)
  if (sizeMatch && !attrs.size) {
    attrs.size = `${sizeMatch[1]} ${sizeMatch[2].toLowerCase()}`
  }
  return attrs
}

/**
 * Verify a retrieved listing against the resolved identity. When no identity
 * was resolved (barcode-less query), listings from a barcode-keyed lookup are
 * still exact (the barcode IS the identifier); text-search listings can never
 * be better than “likely”.
 */
export function matchOfferToIdentity(offer: Offer, identity: ProductIdentity | null, lookupByBarcode: boolean): MatchResult {
  if (identity) {
    return matchProduct(
      attributesFromIdentity(identity),
      attributesFromTitle(offer.productName, { brand: offer.brand, barcode: offer.barcode }),
    )
  }
  return lookupByBarcode
    ? { level: 'exact', confidence: 'Exact Match', score: 0.95, reason: 'Listing resolved by product barcode' }
    : { level: 'likely', confidence: 'High Confidence', score: 0.75, reason: 'Text-search result — verify variant before buying' }
}
