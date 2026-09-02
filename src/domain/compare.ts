import type { ComparisonSummary, FeeBreakdown, MatchConfidence, MatchLevel, Offer, PriceHistory, TrendDirection } from './types'

// ─── Money helpers ─────────────────────────────────────────────────────────

/** Returns null when any fee line is unknown (null). */
export function feeTotal(offer: Offer): number | null {
  const { delivery, platform, handling, convenience, other } = offer.fees
  const values = [delivery, platform, handling, convenience, other]
  if (values.some((v) => v === null || v === undefined)) return null
  return values.reduce<number>((sum, v) => sum + (v ?? 0), 0)
}

/**
 * True payable price = product price + all known fees.
 * Returns null when checkout fees are unknown.
 */
export function finalPrice(offer: Offer): number | null {
  const fees = feeTotal(offer)
  return fees === null ? null : offer.price + fees
}

export function discountAmount(offer: Offer): number {
  return Math.max(0, offer.mrp - offer.price)
}

export function discountPercent(offer: Offer): number {
  if (offer.mrp <= 0) return 0
  return Math.round(((offer.mrp - offer.price) / offer.mrp) * 100)
}

export function formatRupees(value: number | null, compact = false): string {
  if (value === null) return 'At checkout'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
    notation: compact ? 'compact' : 'standard',
  }).format(value)
}

// ─── Fee row builder ──────────────────────────────────────────────────────

const FEE_LABELS: Array<[keyof FeeBreakdown, string]> = [
  ['delivery', 'Delivery fee'],
  ['platform', 'Platform fee'],
  ['handling', 'Handling fee'],
  ['convenience', 'Convenience fee'],
  ['other', 'Other charges'],
]

export function buildFeeRows(offer: Offer): Array<[string, number | null]> {
  const rows: Array<[string, number | null]> = [['Product price', offer.price]]
  if (discountAmount(offer) > 0) rows.push(['Discount', -discountAmount(offer)])
  for (const [key, label] of FEE_LABELS) {
    const value = offer.fees[key as keyof FeeBreakdown]
    if (typeof value === 'number' && value > 0) rows.push([label, value])
    else if (value === null) rows.push([label, null])
  }
  return rows
}

// ─── Sorting ──────────────────────────────────────────────────────────────

export function sortOffers(offers: Offer[], sort: 'overall' | 'price' | 'speed' | 'discount' | 'rating'): Offer[] {
  return [...offers].sort((a, b) => {
    if (sort === 'price') return (finalPrice(a) ?? Infinity) - (finalPrice(b) ?? Infinity)
    if (sort === 'speed') return (a.etaMinutes ?? 9999) - (b.etaMinutes ?? 9999)
    if (sort === 'discount') return discountPercent(b) - discountPercent(a)
    if (sort === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
    // 'overall': weighted composite of price + speed + match quality
    const aScore = (finalPrice(a) ?? 999999) + (a.etaMinutes ?? 999) * 1.2 - a.matchScore * 25
    const bScore = (finalPrice(b) ?? 999999) + (b.etaMinutes ?? 999) * 1.2 - b.matchScore * 25
    return aScore - bScore
  })
}

export function summarize(offers: Offer[]): ComparisonSummary {
  const available = offers.filter(
    (o) => o.availability !== 'unavailable' && (o.match === 'exact' || o.match === 'likely')
  )
  if (!available.length) return {}

  const exactOnly = available.filter((o) => o.match === 'exact')
  const pool = exactOnly.length ? exactOnly : available

  const bestPrice = [...pool].sort((a, b) => (finalPrice(a) ?? Infinity) - (finalPrice(b) ?? Infinity))[0]
  const fastest = [...pool].sort((a, b) => (a.etaMinutes ?? Infinity) - (b.etaMinutes ?? Infinity))[0]
  const bestOverall = sortOffers(pool, 'overall')[0]
  return { bestPrice, fastest, bestOverall }
}

// ─── Match confidence label ────────────────────────────────────────────────

export function matchLevelToConfidence(level: MatchLevel): MatchConfidence {
  switch (level) {
    case 'exact': return 'Exact Match'
    case 'likely': return 'High Confidence'
    case 'similar': return 'Possible Match'
    default: return 'Not a Match'
  }
}

// ─── Price history helpers ────────────────────────────────────────────────

export function priceVsAverage(history: PriceHistory, currentPrice: number): { diff: number; percent: number; direction: TrendDirection } {
  const diff = currentPrice - history.average
  const percent = history.average > 0 ? Math.round((Math.abs(diff) / history.average) * 100) : 0
  const direction: TrendDirection = diff < -2 ? 'down' : diff > 2 ? 'up' : 'flat'
  return { diff, percent, direction }
}

export function priceInsight(history: PriceHistory, bestCurrentPrice: number): string {
  const { diff, percent, direction } = priceVsAverage(history, bestCurrentPrice)
  if (direction === 'down') return `Price is ${percent}% below its ${history.period} average — good time to buy.`
  if (direction === 'up') return `Price is ${percent}% above its ${history.period} average.`
  return `Price is near its ${history.period} average.`
}
