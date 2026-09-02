// ─── SerpApi Google Shopping — authorized, key-gated ──────────────────────────
// https://serpapi.com/google-shopping-api — official paid API (free tier
// available). Requires the user's API key; until one is configured this
// adapter reports `auth_required` and returns NOTHING.
// Mapped fields: merchant (source), title, extracted_price, currency (gl=in
// → INR), product_link, delivery text, rating/reviews, old_price.

import type { Availability, Offer, OfferAdapter, SearchContext } from '../../domain/types'
import { ProviderUnavailableError, unknownFees } from '../../domain/types'
import { attributesFromTitle, matchProduct, attributesFromIdentity } from '../../domain/matcher'
import { GatewayError, gatewayJson, q } from '../gateway'
import { providerConfig } from '../providerConfig'

const BASE = '/api/serpapi'

interface ShoppingResult {
  title?: string
  source?: string
  link?: string
  product_link?: string
  extracted_price?: number
  price?: string
  old_price?: string
  currency?: string
  rating?: number
  reviews?: number
  delivery?: string
}

interface SearchResponse {
  shopping_results?: ShoppingResult[]
  error?: string
}

function parseMoneyString(v?: string): number | null {
  if (!v) return null
  const m = v.replace(/,/g, '').match(/([\d.]+)/)
  return m ? parseFloat(m[1]) : null
}

function toOffer(r: ShoppingResult, index: number, retrievedAt: number, ctx: SearchContext): Offer | null {
  const price = typeof r.extracted_price === 'number' && r.extracted_price > 0
    ? r.extracted_price
    : parseMoneyString(r.price)
  if (price === null || !(price > 0) || !r.title || !r.source) return null

  const identity = ctx.identity ?? null
  const match = identity
    ? matchProduct(attributesFromIdentity(identity), attributesFromTitle(r.title))
    : { level: 'likely' as const, confidence: 'High Confidence' as const, score: 0.75, reason: 'Shopping search result — verify variant on the merchant page' }

  const oldPrice = parseMoneyString(r.old_price)
  return {
    id: `serpapi:${retrievedAt}:${index}`,
    kind: 'shoppable',
    sourceId: 'serpapi',
    sourceName: 'Google Shopping via SerpApi',
    merchant: r.source,
    productUrl: r.product_link || r.link || null,
    retrievedAt,
    observedAt: retrievedAt,
    freshness: 'live',
    productName: r.title,
    brand: null,
    variant: null,
    quantity: null,
    barcode: identity?.barcode ?? null,
    price,
    mrp: oldPrice && oldPrice > price ? oldPrice : null,
    currency: (r.currency || 'INR').toUpperCase(),
    fees: unknownFees(r.delivery ? `Source delivery note: “${r.delivery}”` : 'Delivery charges are shown at merchant checkout'),
    pricePerUnit: null,
    mode: 'normal',
    etaMinutes: null,
    deliveryNote: r.delivery || null,
    availability: 'unknown' as Availability,
    stockLabel: 'See merchant page',
    seller: r.source,
    sellerRating: null,
    rating: typeof r.rating === 'number' && r.rating > 0 ? r.rating : null,
    reviewCount: typeof r.reviews === 'number' && r.reviews > 0 ? r.reviews : null,
    condition: null,
    offerLabel: oldPrice && oldPrice > price ? `Was ${r.old_price}` : null,
    offerDetail: null,
    match: match.level,
    matchConfidence: match.confidence,
    matchScore: match.score,
    matchReason: match.reason,
    locationLabel: null,
  }
}

export const serpApiShopping: OfferAdapter = {
  id: 'serpapi',
  name: 'Google Shopping (SerpApi)',
  kind: 'shoppable',
  accessNote: 'Authorized SerpApi key required (free tier available). Searches real Google Shopping listings for India.',
  docsUrl: 'https://serpapi.com/google-shopping-api',
  requiresAuth: () => !providerConfig.isConfigured('serpapi'),
  async search(ctx: SearchContext): Promise<Offer[]> {
    const apiKey = providerConfig.get('serpapi').apiKey?.trim()
    if (!apiKey) {
      throw new ProviderUnavailableError('auth_required', 'Add your SerpApi key in Sources → Configure to enable Google Shopping results')
    }
    const term = ctx.identity ? ctx.identity.name : ctx.query
    // The key travels only to our same-origin gateway route, which forwards
    // it to SerpApi. A server-side gateway can instead inject SERPAPI_KEY.
    const url = `${BASE}/search?engine=google_shopping&q=${q(term)}&gl=in&hl=en&api_key=${q(apiKey)}`
    let data: SearchResponse
    try {
      data = await gatewayJson<SearchResponse>(url)
    } catch (err) {
      if (err instanceof GatewayError) {
        if (err.kind === 'unauthorized') {
          throw new ProviderUnavailableError('auth_required', 'SerpApi rejected the configured key')
        }
        throw new ProviderUnavailableError('temporarily_unavailable', `Google Shopping lookup failed: ${err.message}`)
      }
      throw err
    }
    if (data.error) {
      throw new ProviderUnavailableError('auth_required', `SerpApi error: ${data.error}`)
    }
    const retrievedAt = Date.now()
    return (data.shopping_results ?? [])
      .map((r, i) => toOffer(r, i, retrievedAt, ctx))
      .filter((o): o is Offer => o !== null)
  },
}
