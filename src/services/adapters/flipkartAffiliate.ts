// ─── Flipkart Affiliate API — authorized, key-gated ───────────────────────────
// https://affiliate.flipkart.net — official Flipkart Affiliate product search
// feed. Requires an Affiliate ID + token (headers Fk-Affiliate-Id /
// Fk-Affiliate-Token). Until both are configured this adapter reports
// `auth_required` and returns NOTHING.
// Mapped fields: title, productDescription, sellingPrice/retailPrice (INR),
// availabilityStatus, averageRating, productUrl (real Flipkart listing).

import type { Availability, Offer, OfferAdapter, SearchContext } from '../../domain/types'
import { ProviderUnavailableError, unknownFees } from '../../domain/types'
import { attributesFromTitle, matchProduct, attributesFromIdentity } from '../../domain/matcher'
import { GatewayError, gatewayJson, q } from '../gateway'
import { providerConfig } from '../providerConfig'

const BASE = '/api/flipkart'

interface FkProduct {
  productId?: string
  title?: string
  productDescription?: string
  imageUrls?: Record<string, string>
  sellingPrice?: number
  retailPrice?: number
  availabilityStatus?: string
  averageRating?: number
  numberOfRatings?: number
  productUrl?: string
  productBrand?: string
  codAvailability?: boolean
  deliveryInfo?: string
}

interface FkResponse {
  productInfoList?: FkProduct[]
  errorMessage?: string
}

function availabilityFrom(status?: string): { availability: Availability; stockLabel: string } {
  const v = (status ?? '').trim().toUpperCase()
  if (!v) return { availability: 'unknown', stockLabel: 'Unknown' }
  if (v === 'IN_STOCK') return { availability: 'in_stock', stockLabel: 'In stock' }
  if (v === 'OUT_OF_STOCK') return { availability: 'out_of_stock', stockLabel: 'Out of stock' }
  if (v.includes('LIMITED')) return { availability: 'low_stock', stockLabel: 'Limited stock' }
  return { availability: 'unknown', stockLabel: status || 'Unknown' }
}

function toOffer(p: FkProduct, index: number, retrievedAt: number, ctx: SearchContext): Offer | null {
  if (!p.title || typeof p.sellingPrice !== 'number' || !(p.sellingPrice > 0)) return null

  const identity = ctx.identity ?? null
  const match = identity
    ? matchProduct(attributesFromIdentity(identity), attributesFromTitle(p.title, { brand: p.productBrand }))
    : { level: 'likely' as const, confidence: 'High Confidence' as const, score: 0.75, reason: 'Marketplace search result — verify variant on the listing page' }

  const avail = availabilityFrom(p.availabilityStatus)
  const retail = typeof p.retailPrice === 'number' && p.retailPrice > p.sellingPrice ? p.retailPrice : null

  return {
    id: `flipkart:${p.productId ?? index}`,
    kind: 'shoppable',
    sourceId: 'flipkart',
    sourceName: 'Flipkart Affiliate Feed',
    merchant: 'Flipkart',
    productUrl: p.productUrl ?? null,
    retrievedAt,
    observedAt: retrievedAt,
    freshness: 'live',
    productName: p.title,
    brand: p.productBrand ?? null,
    variant: null,
    quantity: null,
    barcode: identity?.barcode ?? null,
    price: p.sellingPrice,
    mrp: retail,
    currency: 'INR',
    fees: unknownFees('Flipkart’s feed does not disclose delivery fees — they are shown at checkout'),
    pricePerUnit: null,
    mode: 'normal',
    etaMinutes: null,
    deliveryNote: p.deliveryInfo || null,
    availability: avail.availability,
    stockLabel: avail.stockLabel,
    seller: 'Flipkart seller (see listing)',
    sellerRating: null,
    rating: typeof p.averageRating === 'number' && p.averageRating > 0 ? p.averageRating : null,
    reviewCount: typeof p.numberOfRatings === 'number' && p.numberOfRatings > 0 ? p.numberOfRatings : null,
    condition: null,
    offerLabel: retail ? `MRP ${retail.toLocaleString('en-IN')}` : null,
    offerDetail: null,
    match: match.level,
    matchConfidence: match.confidence,
    matchScore: match.score,
    matchReason: match.reason,
    locationLabel: null,
  }
}

export const flipkartAffiliate: OfferAdapter = {
  id: 'flipkart',
  name: 'Flipkart (Affiliate API)',
  kind: 'shoppable',
  accessNote: 'Flipkart Affiliate Program credentials required (affiliate.flipkart.net). Returns real Flipkart listings in INR.',
  docsUrl: 'https://affiliate.flipkart.net/api-docs/affiliate-products-api.html',
  requiresAuth: () => !providerConfig.isConfigured('flipkart'),
  async search(ctx: SearchContext): Promise<Offer[]> {
    const { affiliateId, affiliateToken } = providerConfig.get('flipkart')
    if (!affiliateId?.trim() || !affiliateToken?.trim()) {
      throw new ProviderUnavailableError('auth_required', 'Add your Flipkart Affiliate ID and token in Sources → Configure')
    }
    const term = ctx.identity ? ctx.identity.name : ctx.query
    const headers = {
      'Fk-Affiliate-Id': affiliateId.trim(),
      'Fk-Affiliate-Token': affiliateToken.trim(),
    }
    let data: FkResponse
    try {
      data = await gatewayJson<FkResponse>(`${BASE}/affiliate/1.0/search.json?query=${q(term)}&count=10`, { headers })
    } catch (err) {
      if (err instanceof GatewayError) {
        if (err.kind === 'unauthorized') {
          throw new ProviderUnavailableError('auth_required', 'Flipkart rejected the configured affiliate credentials')
        }
        throw new ProviderUnavailableError('temporarily_unavailable', `Flipkart feed is unavailable: ${err.message}`)
      }
      throw err
    }
    if (data.errorMessage && !data.productInfoList) {
      throw new ProviderUnavailableError('temporarily_unavailable', `Flipkart feed error: ${data.errorMessage}`)
    }
    const retrievedAt = Date.now()
    return (data.productInfoList ?? [])
      .map((p, i) => toOffer(p, i, retrievedAt, ctx))
      .filter((o): o is Offer => o !== null)
  },
}
