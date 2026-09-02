// ─── Open Prices — real community-recorded price points ───────────────────────
// https://prices.openfoodfacts.org — open dataset (ODbL) of REAL prices
// submitted by contributors with store location and observation date.
// Keyless public API. These are reference prices (kind: 'reference'):
// real numbers, real stores, real dates — no stock, no ETA, no buy link.
// Every field the source does not provide stays null/unknown.

import type { Offer, OfferAdapter, SearchContext } from '../../domain/types'
import { ProviderUnavailableError, unknownFees } from '../../domain/types'
import { GatewayError, gatewayJson, q } from '../gateway'

const BASE = '/api/openprices'

interface OpLocation {
  osm_name?: string
  osm_brand?: string
  osm_address_city?: string
  osm_address_country?: string
  osm_address_country_code?: string
}

interface OpPrice {
  id: number
  product_code?: string
  price: number
  price_is_discounted?: boolean
  price_without_discount?: number | null
  currency: string
  date: string
  location?: OpLocation | null
}

interface OpResponse {
  items?: OpPrice[]
  total?: number
}

function locationLabel(loc?: OpLocation | null): string | null {
  if (!loc) return null
  const parts = [loc.osm_name || loc.osm_brand, loc.osm_address_city, loc.osm_address_country_code]
    .filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

function toOffer(item: OpPrice, barcode: string): Offer | null {
  if (typeof item.price !== 'number' || item.price < 0) return null
  return {
    id: `openprices:${item.id}`,
    kind: 'reference',
    sourceId: 'openprices',
    sourceName: 'Open Prices',
    merchant: item.location?.osm_brand || item.location?.osm_name || 'Community-recorded store',
    productUrl: null,
    retrievedAt: Date.now(),
    observedAt: item.date,
    freshness: 'live',
    productName: `Community price submission #${item.id}`,
    brand: null,
    variant: null,
    quantity: null,
    barcode,
    price: item.price,
    mrp: item.price_without_discount ?? null,
    currency: item.currency,
    fees: unknownFees('In-store reference price — no checkout fees apply'),
    pricePerUnit: null,
    mode: 'normal',
    etaMinutes: null,
    deliveryNote: 'In-store price — no delivery estimate',
    availability: 'unknown',
    stockLabel: 'Unknown',
    seller: null,
    sellerRating: null,
    rating: null,
    reviewCount: null,
    condition: null,
    offerLabel: item.price_is_discounted ? 'Recorded as discounted' : null,
    offerDetail: item.price_is_discounted && item.price_without_discount
      ? `Regular price ${item.price_without_discount} on the same recorded tag`
      : null,
    match: 'exact',
    matchConfidence: 'Exact Match',
    matchScore: 0.95,
    matchReason: 'Price submitted for this exact product barcode',
    locationLabel: locationLabel(item.location),
  }
}

export const openPrices: OfferAdapter = {
  id: 'openprices',
  name: 'Open Prices',
  kind: 'reference',
  accessNote: 'Public open dataset of community-recorded in-store prices with store, city and date. Keyless.',
  docsUrl: 'https://prices.openfoodfacts.org/api/docs',
  requiresAuth: () => false,
  async search(ctx: SearchContext): Promise<Offer[]> {
    const barcode = ctx.barcode ?? ctx.identity?.barcode
    if (!barcode) {
      // Honest skip: this source can only answer barcode-keyed queries.
      throw new ProviderUnavailableError(
        'connected',
        'Skipped — Open Prices answers barcode-keyed lookups only, and this search resolved no barcode',
      )
    }
    let data: OpResponse
    try {
      data = await gatewayJson<OpResponse>(`${BASE}/api/v1/prices?product_code=${q(barcode)}&size=25`)
    } catch (err) {
      if (err instanceof GatewayError && err.kind === 'not_found') return []
      if (err instanceof GatewayError) {
        throw new ProviderUnavailableError('temporarily_unavailable', `Open Prices is unavailable: ${err.message}`)
      }
      throw err
    }
    return (data.items ?? [])
      .map((item) => toOffer(item, barcode))
      .filter((o): o is Offer => o !== null)
  },
}
