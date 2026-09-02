// ─── Core domain types ────────────────────────────────────────────────────────
// REAL DATA ONLY.
//
// Every Offer that exists at runtime must be derived from a legitimate
// upstream source that PriceRadar actually queried. These types make
// fabrication hard on purpose:
//
//   - `retrievedAt` is mandatory: an offer with no retrieval timestamp cannot
//     be rendered, sorted, or cited by the assistant.
//   - Anything the upstream source did not supply is `null` / `unknown`,
//     never zero, never guessed.
//   - Prices carry the source's real currency.
//   - Every offer records which adapter produced it and the real product URL
//     when one exists.

export type DeliveryMode = 'instant' | 'normal'

export type MatchLevel = 'exact' | 'likely' | 'similar'
export type MatchConfidence = 'Exact Match' | 'High Confidence' | 'Possible Match' | 'Not a Match'

/** `unknown` is a first-class value: absence of information is not in-stock. */
export type Availability = 'in_stock' | 'low_stock' | 'out_of_stock' | 'unknown'

export type Freshness = 'live' | 'cached' | 'stale'

/** Integration status shown to users (§ Provider Integration Status). */
export type ProviderStatus =
  | 'live'                  // returned real data on the latest query
  | 'connected'             // configured, healthy, but not queried yet
  | 'auth_required'         // needs user/operator credentials
  | 'integration_pending'   // no authorized access mechanism exists yet
  | 'temporarily_unavailable' // reachable last try failed (timeout / 5xx / rate limit)
  | 'error'

// ─── Fee breakdown ─────────────────────────────────────────────────────────────

export interface FeeBreakdown {
  /** null = not disclosed by the source → shown as “at checkout”, never ₹0 */
  delivery: number | null
  platform: number | null
  handling: number | null
  convenience: number | null
  other: number | null
  note?: string
}

export function unknownFees(note?: string): FeeBreakdown {
  return { delivery: null, platform: null, handling: null, convenience: null, other: null, note }
}

// ─── Product identity (real, resolved from a real source) ─────────────────────

export interface ProductIdentity {
  /** Stable id, e.g. `off:3017620422003` */
  id: string
  /** Adapter that resolved this identity, e.g. `openfoodfacts` */
  sourceId: string
  sourceName: string
  /** GTIN / EAN / UPC when the source provides one */
  barcode?: string
  name: string
  brand?: string
  /** e.g. "400 g" — as recorded by the source */
  quantity?: string
  imageUrl?: string
  category?: string
  /** Link to the real source record */
  url: string
  retrievedAt: number
}

// ─── Offer (one real, retrieved listing / price point) ────────────────────────

export type OfferKind =
  /** A live listing the user can click through and buy */
  | 'shoppable'
  /** A real recorded price point (e.g. community-submitted) — reference only */
  | 'reference'

export interface Offer {
  id: string
  kind: OfferKind

  // ─ Where the data came from ─
  /** Adapter that retrieved this offer, e.g. `upcitemdb` */
  sourceId: string
  sourceName: string
  /** The actual store/merchant on the listing, when the source names one */
  merchant: string | null
  /** Real listing URL; null when the source provides none */
  productUrl: string | null
  /** Epoch ms — when PriceRadar retrieved this record. Mandatory. */
  retrievedAt: number
  /** When the price was actually observed/recorded upstream (ISO date or ms) */
  observedAt?: string | number
  freshness: Freshness

  // ─ Product as the source describes it ─
  productName: string
  brand: string | null
  variant: string | null
  quantity: string | null
  barcode: string | null

  // ─ Real pricing, real currency ─
  price: number
  /** Manufacturer retail price when the source states one; null otherwise */
  mrp: number | null
  currency: string
  fees: FeeBreakdown
  /** e.g. "₹63 / L" only when computable from real source values */
  pricePerUnit: string | null

  // ─ Delivery — never guessed ─
  mode: DeliveryMode
  /** null → “Delivery estimate unavailable” */
  etaMinutes: number | null
  /** Human-readable delivery text supplied by the source, if any */
  deliveryNote: string | null

  // ─ Availability — never guessed ─
  availability: Availability
  stockLabel: string

  // ─ Seller / quality signals — only when the source states them ─
  seller: string | null
  sellerRating: number | null
  rating: number | null
  reviewCount: number | null
  condition: string | null

  // ─ Offer text the source itself displays, if any ─
  offerLabel: string | null
  offerDetail: string | null

  // ─ Match against the resolved product identity ─
  match: MatchLevel
  matchConfidence: MatchConfidence
  matchScore: number
  matchReason: string

  /** Location context when the source provides one (e.g. store address) */
  locationLabel: string | null
}

// ─── Search session ────────────────────────────────────────────────────────────

export interface ProviderResult {
  sourceId: string
  sourceName: string
  status: ProviderStatus
  offers: Offer[]
  latencyMs: number | null
  retrievedAt: number
  note?: string
  error?: string
}

export interface SearchResult {
  query: string
  retrievedAt: number
  identity: ProductIdentity | null
  identityStatus: ProviderStatus
  identityNote?: string
  /** Other real products the identity source found for this query */
  candidates: ProductIdentity[]
  results: ProviderResult[]
  offers: Offer[]
}

// ─── Collected price history (only what PriceRadar really saw) ─────────────────

export interface CollectedPricePoint {
  productId: string
  productKey: string          // barcode or normalized name, for cross-source joins
  productName: string
  sourceId: string
  merchant: string | null
  price: number
  currency: string
  /** When PriceRadar retrieved it */
  retrievedAt: number
  /** When the price was observed upstream (may be an older, real date) */
  observedAt: string | number
}

export interface HistorySeries {
  points: CollectedPricePoint[]
  enough: boolean
}

// ─── Alerts / wishlist / history (persisted locally, user-generated only) ─────

export interface PriceAlert {
  id: string
  productKey: string
  productName: string
  targetPrice: number
  currency: string
  currentBest: number | null
  currentBestSource: string | null
  status: 'active'
  createdAt: string
}

export interface WishlistItem {
  identity: ProductIdentity
  addedAt: string
}

export interface SearchHistoryEntry {
  query: string
  timestamp: string
  offerCount: number
  identityName?: string
}

// ─── AI assistant ──────────────────────────────────────────────────────────────

export interface AiCitation {
  sourceName: string
  merchant: string | null
  price: number
  currency: string
  productUrl: string | null
  retrievedAt: number
}

export interface AiMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  citations?: AiCitation[]
}

// ─── Provider adapter contract ─────────────────────────────────────────────────

export interface SearchContext {
  query: string
  /** Barcode of the resolved identity, when one was resolved */
  barcode?: string
  /** Resolved product identity, when one was resolved */
  identity?: ProductIdentity | null
  location: string | null
  mode: DeliveryMode | 'all'
}

/**
 * Thrown by adapters that cannot return real data. The registry turns this
 * into an honest per-source status. Adapters MUST return only real records —
 * an adapter that cannot retrieve real data throws instead.
 */
export class ProviderUnavailableError extends Error {
  readonly status: ProviderStatus
  constructor(status: ProviderStatus, message: string) {
    super(message)
    this.name = 'ProviderUnavailableError'
    this.status = status
  }
}

export interface OfferAdapter {
  id: string
  name: string
  /** What kind of data this source returns */
  kind: 'shoppable' | 'reference'
  /** Honest pre-query status when the adapter cannot ever return data yet */
  staticStatus?: ProviderStatus
  /** True when this source needs credentials it does not currently have */
  requiresAuth(): boolean
  /** Human explanation shown in the Sources board */
  accessNote: string
  docsUrl?: string
  /**
   * Retrieve real offers. Implementations either return records that came
   * from the upstream response, or throw ProviderUnavailableError.
   */
  search(ctx: SearchContext): Promise<Offer[]>
}

/** Identity sources resolve a search term / barcode to a real product. */
export interface IdentityAdapter {
  id: string
  name: string
  accessNote: string
  docsUrl?: string
  /** Resolve by barcode (when given) or by search term. Throws on failure. */
  resolve(ctx: SearchContext): Promise<{ identity: ProductIdentity | null; candidates: ProductIdentity[] }>
}
