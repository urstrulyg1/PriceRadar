export type DeliveryMode = 'instant' | 'normal'
export type MatchLevel = 'exact' | 'likely' | 'similar'
export type Availability = 'in_stock' | 'low_stock' | 'unavailable'
export type Freshness = 'live' | 'recent' | 'cached' | 'unavailable'

export interface Provider {
  id: string
  name: string
  shortName: string
  kind: 'instant' | 'ecommerce' | 'marketplace'
  mark: string
  color: string
  background: string
  isConnected: boolean
}

export interface FeeBreakdown {
  delivery: number | null
  platform: number | null
  handling: number | null
  other: number | null
  note?: string
}

export interface PriceHistory {
  points: number[]
  lowest: number
  highest: number
  average: number
  change: number
  period: string
}

export interface Offer {
  id: string
  provider: Provider
  mode: DeliveryMode
  productName: string
  brand: string
  variant: string
  quantity: string
  price: number
  mrp: number
  fees: FeeBreakdown
  etaLabel: string
  etaMinutes?: number
  availability: Availability
  stockLabel: string
  seller: string
  location: string
  match: MatchLevel
  matchScore: number
  matchReason: string
  pricePerUnit: string
  offerLabel?: string
  offerDetail?: string
  rating?: number
  reviewCount?: string
  returnPolicy?: string
  warranty?: string
  freshness: Freshness
  updatedSeconds: number
  url: string
}

export interface Product {
  id: string
  searchTerms: string[]
  name: string
  brand: string
  variant: string
  quantity: string
  category: string
  imageKind: 'milk' | 'phone' | 'audio' | 'shampoo'
  description: string
  priceHistory: PriceHistory
  offers: Offer[]
}

export interface ComparisonSummary {
  bestPrice?: Offer
  fastest?: Offer
  bestOverall?: Offer
}

export interface ProviderAdapter {
  provider: Provider
  supportedModes: DeliveryMode[]
  search(query: string, location: string): Promise<Offer[]>
}
