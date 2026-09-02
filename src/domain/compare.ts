import type { AiCitation, CollectedPricePoint, FeeBreakdown, Freshness, Offer } from './types'
import { ProviderUnavailableError } from './types'

// ─── Money ──────────────────────────────────────────────────────────────────

const CURRENCY_LOCALES: Record<string, string> = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
}

export function formatMoney(value: number | null, currency = 'INR', compact = false): string {
  if (value === null) return 'At checkout'
  const locale = CURRENCY_LOCALES[currency] ?? 'en-IN'
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
      notation: compact ? 'compact' : 'standard',
    }).format(value)
  } catch {
    return `${currency} ${value}`
  }
}

/** Returns null when any fee line is unknown — the payable total then is too. */
export function feeTotal(offer: Offer): number | null {
  const values = [offer.fees.delivery, offer.fees.platform, offer.fees.handling, offer.fees.convenience, offer.fees.other]
  if (values.some((v) => v === null || v === undefined)) return null
  return values.reduce<number>((sum, v) => sum + (v ?? 0), 0)
}

/** True payable price = product price + known fees. null → “+ checkout charges”. */
export function finalPrice(offer: Offer): number | null {
  const fees = feeTotal(offer)
  return fees === null ? null : offer.price + fees
}

/** Honest price line: “₹499 + checkout charges” when fees are unknown. */
export function priceLine(offer: Offer): string {
  const total = finalPrice(offer)
  return total === null
    ? `${formatMoney(offer.price, offer.currency)} + checkout charges`
    : formatMoney(total, offer.currency)
}

export function discountAmount(offer: Offer): number | null {
  return offer.mrp === null ? null : Math.max(0, offer.mrp - offer.price)
}

export function discountPercent(offer: Offer): number | null {
  if (offer.mrp === null || offer.mrp <= 0) return null
  return Math.round(((offer.mrp - offer.price) / offer.mrp) * 100)
}

// ─── Fee rows (drawer / modal) ──────────────────────────────────────────────

const FEE_LABELS: Array<[keyof FeeBreakdown, string]> = [
  ['delivery', 'Delivery fee'],
  ['platform', 'Platform fee'],
  ['handling', 'Handling fee'],
  ['convenience', 'Convenience fee'],
  ['other', 'Other charges'],
]

export function buildFeeRows(offer: Offer): Array<[string, number | null]> {
  const rows: Array<[string, number | null]> = [['Product price', offer.price]]
  const discount = discountAmount(offer)
  if (discount !== null && discount > 0) rows.push(['Source-listed discount', -discount])
  for (const [key, label] of FEE_LABELS) {
    const value = offer.fees[key]
    if (typeof value === 'number' && value > 0) rows.push([label, value])
    else if (value === null) rows.push([label, null])
  }
  return rows
}

// ─── Freshness (§ real-time price validation) ───────────────────────────────

export interface FreshnessInfo {
  label: string
  cls: Freshness | 'unavailable'
}

const s = (ms: number) => Math.max(0, Math.round(ms / 1000))
const m = (ms: number) => Math.max(1, Math.round(ms / 60000))
const h = (ms: number) => Math.max(1, Math.round(ms / 3600000))

export function describeFreshness(retrievedAt: number, cached = false): FreshnessInfo {
  const age = Date.now() - retrievedAt
  if (cached) {
    if (age < 120_000) return { label: `Cached · retrieved ${s(age)}s ago`, cls: 'cached' }
    if (age < 3_600_000) return { label: `Cached · retrieved ${m(age)} min ago`, cls: 'cached' }
    return { label: `Cached · retrieved ${h(age)}h ago`, cls: 'stale' }
  }
  if (age < 60_000) return { label: `Live · updated ${s(age)}s ago`, cls: 'live' }
  if (age < 15 * 60_000) return { label: `Updated ${m(age)} min ago`, cls: 'live' }
  if (age < 3_600_000) return { label: `Retrieved ${m(age)} min ago`, cls: 'cached' }
  return { label: `Stale · retrieved ${h(age)}h ago`, cls: 'stale' }
}

export function offerFreshness(offer: Offer): FreshnessInfo {
  return describeFreshness(offer.retrievedAt, offer.freshness === 'cached')
}

// ─── Validation — offers without provenance cannot exist ────────────────────

export class InvalidOfferError extends Error {}

/**
 * Runtime guard: every production offer must carry real provenance.
 * Throws on the first sign of a fabricated record.
 */
export function assertRealOffer(offer: Offer): void {
  const problems: string[] = []
  if (!offer.retrievedAt || typeof offer.retrievedAt !== 'number') problems.push('missing retrievedAt')
  if (!offer.sourceId) problems.push('missing sourceId')
  if (!offer.sourceName) problems.push('missing sourceName')
  if (typeof offer.price !== 'number' || !(offer.price > 0)) problems.push('invalid price')
  if (!offer.currency || offer.currency.length !== 3) problems.push('missing currency')
  if (offer.productUrl && !/^https?:\/\//.test(offer.productUrl)) problems.push('invalid productUrl')
  if (offer.productUrl === null && offer.kind === 'shoppable') {
    // shoppable offers without a link can exist only for sources that don't expose links
    if (!['openprices'].includes(offer.sourceId)) problems.push('shoppable offer without product URL')
  }
  if (problems.length) {
    throw new InvalidOfferError(`Offer failed provenance validation: ${problems.join(', ')}`)
  }
}

// ─── Sorting / summary ──────────────────────────────────────────────────────

export type SortKey = 'overall' | 'price' | 'speed' | 'discount' | 'rating'

export function sortOffers(offers: Offer[], sort: SortKey): Offer[] {
  return [...offers].sort((a, b) => {
    if (sort === 'price') return (finalPrice(a) ?? Infinity) - (finalPrice(b) ?? Infinity)
    if (sort === 'speed') return (a.etaMinutes ?? Infinity) - (b.etaMinutes ?? Infinity)
    if (sort === 'discount') return (discountPercent(b) ?? -1) - (discountPercent(a) ?? -1)
    if (sort === 'rating') return (b.rating ?? -1) - (a.rating ?? -1)
    // overall: cheaper + faster + better matched, same currency only
    const aScore = (finalPrice(a) ?? 9e9) + (a.etaMinutes ?? 9999) * 0.5 - a.matchScore * 100
    const bScore = (finalPrice(b) ?? 9e9) + (b.etaMinutes ?? 9999) * 0.5 - b.matchScore * 100
    return aScore - bScore
  })
}

export interface ComparisonSummary {
  bestPrice?: Offer
  fastest?: Offer
  bestOverall?: Offer
  nextBestPrice?: Offer
  savings?: number
}

/** Only comparable offers count: shoppable, not out of stock, exact/likely match. */
export function comparableOffers(offers: Offer[]): Offer[] {
  return offers.filter((o) =>
    o.kind === 'shoppable' &&
    o.availability !== 'out_of_stock' &&
    (o.match === 'exact' || o.match === 'likely')
  )
}

export function summarize(offers: Offer[]): ComparisonSummary {
  const pool = comparableOffers(offers).filter((o) => o.price > 0)
  if (!pool.length) return {}
  const byPrice = [...pool].sort((a, b) => (finalPrice(a) ?? a.price) - (finalPrice(b) ?? b.price))
  const bestPrice = byPrice[0]
  const nextBestPrice = byPrice[1]
  const withEta = pool.filter((o) => o.etaMinutes !== null)
  const fastest = withEta.length
    ? [...withEta].sort((a, b) => (a.etaMinutes ?? 0) - (b.etaMinutes ?? 0))[0]
    : undefined
  const bestOverall = sortOffers(pool, 'overall')[0]
  const savings = nextBestPrice
    ? (finalPrice(nextBestPrice) ?? nextBestPrice.price) - (finalPrice(bestPrice) ?? bestPrice.price)
    : undefined
  return { bestPrice, fastest, bestOverall, nextBestPrice, savings: savings && savings > 0 ? savings : undefined }
}

// ─── Price history (collected points only) ─────────────────────────────────

export function buildSeries(points: CollectedPricePoint[], currency: string): { points: CollectedPricePoint[]; enough: boolean } {
  const observedTime = (p: CollectedPricePoint) => new Date(p.observedAt).getTime() || p.retrievedAt
  const same = points
    .filter((p) => p.currency === currency)
    .sort((a, b) => observedTime(a) - observedTime(b))
  // At least two distinct observation dates are required before we call it a trend
  const distinctDates = new Set(same.map((p) => String(p.observedAt).slice(0, 10)))
  return { points: same, enough: distinctDates.size >= 2 }
}

/** The only insight text allowed: computed from actually collected points. */
export function collectedInsight(points: CollectedPricePoint[], currency: string): string | null {
  const series = buildSeries(points, currency)
  if (!series.enough) return null
  const first = series.points[0].price
  const last = series.points[series.points.length - 1].price
  const pct = first > 0 ? Math.round(((last - first) / first) * 100) : 0
  if (pct < -2) return `Collected prices have moved ${Math.abs(pct)}% down across ${series.points.length} recorded points.`
  if (pct > 2) return `Collected prices have moved ${pct}% up across ${series.points.length} recorded points.`
  return `Collected prices are flat across ${series.points.length} recorded points.`
}

// ─── AI citations ────────────────────────────────────────────────────────────

export function toCitation(offer: Offer): AiCitation {
  return {
    sourceName: offer.sourceName,
    merchant: offer.merchant,
    price: offer.price,
    currency: offer.currency,
    productUrl: offer.productUrl,
    retrievedAt: offer.retrievedAt,
  }
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export function isProviderUnavailable(err: unknown): err is ProviderUnavailableError {
  return err instanceof ProviderUnavailableError
}
