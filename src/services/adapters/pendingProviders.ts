// ─── Stores with no authorized access mechanism yet ───────────────────────────
// REAL DATA ONLY POLICY: PriceRadar does not scrape, does not bypass
// anti-bot systems, and does not estimate. Until a store below offers an
// authorized integration (official API, affiliate feed, partner access) it
// is listed with status `integration_pending` and returns nothing — ever.
// These entries exist so users always know exactly what is and is not
// integrated, never to imply coverage.

import type { Offer, OfferAdapter, SearchContext } from '../../domain/types'
import { ProviderUnavailableError } from '../../domain/types'

export interface PendingStore {
  id: string
  name: string
  kind: 'instant' | 'ecommerce' | 'marketplace'
  reason: string
}

export const PENDING_STORES: PendingStore[] = [
  // Instant delivery
  { id: 'blinkit',  name: 'Blinkit',           kind: 'instant',   reason: 'No public/authorized API. Waiting for an official or partner integration.' },
  { id: 'zepto',    name: 'Zepto',             kind: 'instant',   reason: 'No public/authorized API. Waiting for an official or partner integration.' },
  { id: 'instamart', name: 'Swiggy Instamart', kind: 'instant',   reason: 'No public/authorized API. Waiting for an official or partner integration.' },
  { id: 'bbnow',    name: 'BB Now',            kind: 'instant',   reason: 'No public/authorized API. Waiting for an official or partner integration.' },
  { id: 'fkminutes', name: 'Flipkart Minutes', kind: 'instant',   reason: 'No public/authorized API distinct from the affiliate feed. Pending.' },
  { id: 'amazonnow', name: 'Amazon Now',       kind: 'instant',   reason: 'No public/authorized API. Pending Amazon PA-API partner access (server-side signing).' },
  // E-commerce / marketplace
  { id: 'amazon',   name: 'Amazon.in',         kind: 'ecommerce', reason: 'Amazon PA-API requires approved associate accounts with server-side request signing — pending.' },
  { id: 'myntra',   name: 'Myntra',            kind: 'ecommerce', reason: 'No public/authorized API.' },
  { id: 'croma',    name: 'Croma',             kind: 'ecommerce', reason: 'No public/authorized API.' },
  { id: 'reliance', name: 'Reliance Digital',  kind: 'ecommerce', reason: 'No public/authorized API.' },
  { id: 'tatacliq', name: 'Tata CLiQ',         kind: 'marketplace', reason: 'No public/authorized API.' },
  { id: 'vijaysales', name: 'Vijay Sales',     kind: 'ecommerce', reason: 'No public/authorized API.' },
  { id: 'nykaa',    name: 'Nykaa',             kind: 'ecommerce', reason: 'No public/authorized API.' },
  { id: 'meesho',   name: 'Meesho',            kind: 'marketplace', reason: 'No public/authorized API.' },
  { id: 'ajio',     name: 'AJIO',              kind: 'marketplace', reason: 'No public/authorized API.' },
  { id: 'dmart',    name: 'DMart Ready',       kind: 'ecommerce', reason: 'No public/authorized API.' },
  { id: 'bigbasket', name: 'BigBasket',        kind: 'ecommerce', reason: 'No public/authorized API.' },
]

/**
 * An adapter-shaped wrapper so pending stores appear in the registry with an
 * honest status instead of being silently absent or — worse — simulated.
 */
export function pendingAdapter(store: PendingStore): OfferAdapter {
  return {
    id: store.id,
    name: store.name,
    kind: 'shoppable',
    staticStatus: 'integration_pending',
    accessNote: store.reason,
    requiresAuth: () => false,
    async search(_ctx: SearchContext): Promise<Offer[]> {
      throw new ProviderUnavailableError(
        'integration_pending',
        `${store.name}: ${store.reason} No estimated or simulated offers are shown.`,
      )
    },
  }
}

export const pendingAdapters: OfferAdapter[] = PENDING_STORES.map(pendingAdapter)
