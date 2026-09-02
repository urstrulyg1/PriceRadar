// ─── UPCitemDB — real merchant offers by barcode (public trial API) ───────────
// https://upcitemdb.com — public trial endpoint, keyless, ~100 lookups/day.
// Returns REAL merchant listings (merchant, title, price, currency, link,
// last-updated time). This is a legitimate documented API tier — not a scrape.
// Shipping strings are source-formatted text; unparseable charges stay null.

import type { Availability, Offer, OfferAdapter, SearchContext } from '../../domain/types'
import { ProviderUnavailableError, unknownFees } from '../../domain/types'
import { GatewayError, gatewayJson, q } from '../gateway'

const BASE = '/api/upcitemdb'

interface UpcOffer {
  merchant?: string
  domain?: string
  title?: string
  currency?: string
  price?: number
  list_price?: string | number
  shipping?: string
  condition?: string
  availability?: string
  link?: string
  updated_t?: number
}

interface UpcItem {
  ean?: string
  title?: string
  brand?: string
  model?: string
  color?: string
  size?: string
  weight?: string
  category?: string
  offers?: UpcOffer[]
}

interface UpcResponse {
  code: string
  message?: string
  total?: number
  items?: UpcItem[]
}

/** Only trust explicit availability statements; everything else is unknown. */
function availabilityFrom(source?: string): { availability: Availability; stockLabel: string } {
  const v = (source ?? '').trim().toLowerCase()
  if (!v) return { availability: 'unknown', stockLabel: 'Unknown' }
  if (v === 'in stock' || v === 'instock' || v === 'available') return { availability: 'in_stock', stockLabel: 'In stock' }
  if (v.includes('out of stock') || v === 'unavailable') return { availability: 'out_of_stock', stockLabel: 'Out of stock' }
  if (v.includes('limited') || v.includes('low')) return { availability: 'low_stock', stockLabel: 'Low stock' }
  return { availability: 'unknown', stockLabel: source || 'Unknown' }
}

function toOffer(item: UpcItem, o: UpcOffer, index: number, barcode: string): Offer | null {
  if (typeof o.price !== 'number' || !(o.price > 0) || !o.merchant) return null
  const listPrice = typeof o.list_price === 'number' && o.list_price > o.price ? o.list_price : null

  // The lookup itself is keyed on the product barcode, so the listing refers
  // to the exact product; the source title is kept verbatim for the user.
  const avail = availabilityFrom(o.availability)
  return {
    id: `upcitemdb:${barcode}:${index}`,
    kind: 'shoppable',
    sourceId: 'upcitemdb',
    sourceName: 'UPCitemDB',
    merchant: o.domain ? `${o.merchant} (${o.domain})` : o.merchant,
    productUrl: o.link ?? null,
    retrievedAt: Date.now(),
    observedAt: o.updated_t ? o.updated_t * 1000 : undefined,
    freshness: 'live',
    productName: o.title || item.title || 'Merchant listing',
    brand: item.brand ?? null,
    variant: null,
    quantity: item.size ?? null,
    barcode,
    price: o.price,
    mrp: listPrice,
    currency: (o.currency || 'USD').toUpperCase(),
    fees: unknownFees(o.shipping ? `Source shipping note: “${o.shipping}”` : 'Delivery charges not disclosed by this source'),
    pricePerUnit: null,
    mode: 'normal',
    etaMinutes: null,
    deliveryNote: null,
    availability: avail.availability,
    stockLabel: avail.stockLabel,
    seller: o.merchant,
    sellerRating: null,
    rating: null,
    reviewCount: null,
    condition: o.condition || null,
    offerLabel: null,
    offerDetail: null,
    match: 'exact',
    matchConfidence: 'Exact Match',
    matchScore: 0.95,
    matchReason: 'Listing resolved by product barcode',
    locationLabel: null,
  }
}

export const upcItemDb: OfferAdapter = {
  id: 'upcitemdb',
  name: 'UPCitemDB',
  kind: 'shoppable',
  accessNote: 'Public trial API (keyless, ~100 lookups/day). Real merchant listings keyed by product barcode.',
  docsUrl: 'https://www.upcitemdb.com/wp/docs/main/development/getting-started',
  requiresAuth: () => false,
  async search(ctx: SearchContext): Promise<Offer[]> {
    const barcode = ctx.barcode ?? ctx.identity?.barcode
    if (!barcode) {
      throw new ProviderUnavailableError(
        'connected',
        'Skipped — UPCitemDB answers barcode lookups only, and this search resolved no barcode',
      )
    }
    let data: UpcResponse
    try {
      data = await gatewayJson<UpcResponse>(`${BASE}/prod/trial/lookup?upc=${q(barcode)}`)
    } catch (err) {
      if (err instanceof GatewayError) {
        if (err.kind === 'rate_limited') {
          throw new ProviderUnavailableError('temporarily_unavailable', 'UPCitemDB daily trial quota is exhausted — offers unavailable')
        }
        if (err.kind === 'not_found') return []
        throw new ProviderUnavailableError('temporarily_unavailable', `UPCitemDB is unavailable: ${err.message}`)
      }
      throw err
    }
    if (data.code !== 'OK') {
      throw new ProviderUnavailableError('temporarily_unavailable', `UPCitemDB rejected the lookup: ${data.message ?? data.code}`)
    }
    const item = data.items?.[0]
    if (!item) return []
    return (item.offers ?? [])
      .map((o, i) => toOffer(item, o, i, barcode))
      .filter((o): o is Offer => o !== null)
  },
}
