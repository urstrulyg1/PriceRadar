import type { ComparisonSummary, Offer } from './types'

/**
 * Keep money calculations in one place. Provider adapters return normalized
 * line items; the comparison engine owns the final payable price.
 */
export function feeTotal(offer: Offer): number | null {
  const feeValues = [offer.fees.delivery, offer.fees.platform, offer.fees.handling, offer.fees.other]
  if (feeValues.some((value) => value === null || value === undefined)) return null
  return feeValues.reduce((total: number, fee) => total + (fee ?? 0), 0)
}

export function finalPrice(offer: Offer): number | null {
  const fees = feeTotal(offer)
  return fees === null ? null : offer.price + fees
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

export function discountPercent(offer: Offer): number {
  return Math.round(((offer.mrp - offer.price) / offer.mrp) * 100)
}

export function sortOffers(offers: Offer[], sort: 'overall' | 'price' | 'speed'): Offer[] {
  return [...offers].sort((a, b) => {
    if (sort === 'price') return (finalPrice(a) ?? Infinity) - (finalPrice(b) ?? Infinity)
    if (sort === 'speed') return (a.etaMinutes ?? 9999) - (b.etaMinutes ?? 9999)
    const aScore = (finalPrice(a) ?? 999999) + (a.etaMinutes ?? 999) * 1.1 - a.matchScore * 20
    const bScore = (finalPrice(b) ?? 999999) + (b.etaMinutes ?? 999) * 1.1 - b.matchScore * 20
    return aScore - bScore
  })
}

export function summarize(offers: Offer[]): ComparisonSummary {
  const available = offers.filter((offer) => offer.availability !== 'unavailable' && offer.match === 'exact')
  if (!available.length) return {}

  const bestPrice = [...available].sort((a, b) => (finalPrice(a) ?? Infinity) - (finalPrice(b) ?? Infinity))[0]
  const fastest = [...available].sort((a, b) => (a.etaMinutes ?? Infinity) - (b.etaMinutes ?? Infinity))[0]
  const bestOverall = sortOffers(available, 'overall')[0]
  return { bestPrice, fastest, bestOverall }
}
