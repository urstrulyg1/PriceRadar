// ─── Core domain types ────────────────────────────────────────────────────────
// All comparison logic is expressed through these types.
// Provider-specific logic lives in adapter implementations; the UI only
// imports from here and from the comparison / matcher helpers.

export type DeliveryMode = 'instant' | 'normal'
export type MatchLevel = 'exact' | 'likely' | 'similar'
export type MatchConfidence = 'Exact Match' | 'High Confidence' | 'Possible Match' | 'Not a Match'
export type Availability = 'in_stock' | 'low_stock' | 'unavailable'
export type Freshness = 'live' | 'recent' | 'cached' | 'unavailable'
export type TrendDirection = 'up' | 'down' | 'flat'
export type AlertStatus = 'active' | 'triggered' | 'paused'

// ─── Provider ────────────────────────────────────────────────────────────────

export interface Provider {
  id: string
  name: string
  shortName: string
  kind: 'instant' | 'ecommerce' | 'marketplace'
  mark: string
  color: string
  background: string
  isConnected: boolean
  /** True when the provider responded to the last health ping */
  isHealthy?: boolean
  /** Reason if not connected/healthy */
  unavailableReason?: string
}

// ─── Price breakdown ─────────────────────────────────────────────────────────

export interface FeeBreakdown {
  /** null = unknown until checkout */
  delivery: number | null
  platform: number | null
  handling: number | null
  convenience: number | null
  other: number | null
  /** Optional explanatory note (e.g. "Delivery fee depends on basket value") */
  note?: string
}

// ─── Price history ────────────────────────────────────────────────────────────

export interface PricePoint {
  date: string   // ISO date string  e.g. "2025-08-01"
  price: number
  provider?: string
}

export interface PriceHistory {
  /** Ordered oldest→newest */
  points: PricePoint[]
  lowest: number
  highest: number
  average: number
  /** Positive = increase, negative = decrease vs period start */
  change: number
  changePercent: number
  trend: TrendDirection
  period: string
}

// ─── Offer ────────────────────────────────────────────────────────────────────

export interface Offer {
  id: string
  provider: Provider
  mode: DeliveryMode
  productName: string
  brand: string
  variant: string
  quantity: string
  /** Product selling price */
  price: number
  /** Maximum retail price */
  mrp: number
  fees: FeeBreakdown
  /** Human-readable ETA e.g. "12 min" or "Tomorrow" */
  etaLabel: string
  /** Numeric ETA in minutes for sorting; undefined = unknown */
  etaMinutes?: number
  /** Expected delivery date string e.g. "Sep 3" */
  deliveryDate?: string
  availability: Availability
  stockLabel: string
  seller: string
  sellerRating?: number
  /** Human-readable location context */
  location: string
  match: MatchLevel
  matchConfidence: MatchConfidence
  matchScore: number
  matchReason: string
  pricePerUnit: string
  /** Short badge e.g. "Free delivery" */
  offerLabel?: string
  offerDetail?: string
  rating?: number
  reviewCount?: string
  returnPolicy?: string
  warranty?: string
  freshness: Freshness
  updatedSeconds: number
  url: string
  /** True when the adapter returned a real HTTP success on this fetch */
  isLiveData: boolean
  /** If the provider is unavailable this holds the error message */
  providerError?: string
}

// ─── Product ─────────────────────────────────────────────────────────────────

export type ImageKind = 'milk' | 'phone' | 'audio' | 'shampoo' | 'rice' | 'detergent' | 'default'

export interface ProductSpec {
  label: string
  value: string
}

export interface Product {
  id: string
  /** Normalized search terms used for demo catalog lookup */
  searchTerms: string[]
  name: string
  brand: string
  variant: string
  quantity: string
  category: string
  imageKind: ImageKind
  description: string
  specs?: ProductSpec[]
  /** GTIN / UPC / EAN if known */
  gtin?: string
  sku?: string
  priceHistory: PriceHistory
  offers: Offer[]
  /** Whether the search was able to find a definitive match */
  isDefinitiveMatch: boolean
  /** Alternative products to consider */
  alternatives?: AlternativeProduct[]
}

// ─── Alternative / similar product ───────────────────────────────────────────

export interface AlternativeProduct {
  id: string
  name: string
  brand: string
  variant: string
  quantity: string
  imageKind: ImageKind
  bestPrice: number
  bestProvider: string
  savings: number
  savingsReason: string
}

// ─── Comparison outputs ───────────────────────────────────────────────────────

export interface ComparisonSummary {
  bestPrice?: Offer
  fastest?: Offer
  bestOverall?: Offer
}

export interface ProviderHealth {
  provider: Provider
  status: 'connected' | 'temporarily_unavailable' | 'not_serviceable'
  latencyMs?: number
  lastChecked: number
  error?: string
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export interface PriceAlert {
  id: string
  productId: string
  productName: string
  targetPrice: number
  currentBest: number
  provider?: string  // undefined = any provider
  status: AlertStatus
  createdAt: string
  triggeredAt?: string
}

// ─── Wishlist ─────────────────────────────────────────────────────────────────

export interface WishlistItem {
  productId: string
  addedAt: string
}

// ─── Search ───────────────────────────────────────────────────────────────────

export interface SearchHistoryEntry {
  query: string
  productId?: string
  timestamp: string
  offerCount: number
  bestTotal?: number
}

// ─── AI ──────────────────────────────────────────────────────────────────────

export type AiRole = 'user' | 'assistant'

export interface AiMessage {
  id: string
  role: AiRole
  content: string
  timestamp: number
  /** Offers cited in this message */
  citations?: Offer[]
  /** Product search result linked to this message */
  linkedProduct?: Product
}

// ─── Provider adapter interface ───────────────────────────────────────────────

export interface ProviderAdapter {
  provider: Provider
  supportedModes: DeliveryMode[]
  /**
   * Search returns normalized offers for a query and location.
   * Implementations MUST NOT fabricate data.
   * If the provider is unavailable, return [] and let the registry handle it.
   */
  search(query: string, location: string): Promise<Offer[]>
}
