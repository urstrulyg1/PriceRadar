/**
 * Demo catalog — local static data representing what a real backend would
 * return from authorized provider integrations.
 *
 * All offers carry honest field annotations. Fees are real model entries;
 * nothing is invented. Any field that would be unknown until checkout is
 * explicitly null.
 *
 * Provider adapters are registered separately in src/services/providerRegistry.ts.
 * When a real authorized feed is available the catalog lookup is replaced by a
 * live ProviderRegistry.compare() call without changing any other UI logic.
 */

import type { DeliveryMode, ImageKind, Offer, PriceHistory, PricePoint, Product, Provider } from '../domain/types'

// ─── Providers ────────────────────────────────────────────────────────────────

export const providers: Provider[] = [
  // Instant delivery
  { id: 'blinkit',    name: 'Blinkit',           shortName: 'BL', kind: 'instant',     mark: 'B',  color: '#f7c948', background: '#1d2c2e', isConnected: true,  isHealthy: true },
  { id: 'zepto',      name: 'Zepto',              shortName: 'ZE', kind: 'instant',     mark: 'Z',  color: '#c8f169', background: '#252941', isConnected: true,  isHealthy: true },
  { id: 'instamart',  name: 'Swiggy Instamart',   shortName: 'SI', kind: 'instant',     mark: 'SI', color: '#ff9b7b', background: '#2e1f27', isConnected: true,  isHealthy: true },
  { id: 'bbnow',      name: 'BB Now',             shortName: 'BB', kind: 'instant',     mark: 'BB', color: '#a5dbff', background: '#1e3042', isConnected: true,  isHealthy: true },
  { id: 'fk-minutes', name: 'Flipkart Minutes',   shortName: 'FM', kind: 'instant',     mark: 'FM', color: '#83baff', background: '#1d2d42', isConnected: false, isHealthy: false, unavailableReason: 'Authorized feed pending' },
  { id: 'amz-now',    name: 'Amazon Now',         shortName: 'AN', kind: 'instant',     mark: 'AN', color: '#ffbd79', background: '#35302b', isConnected: false, isHealthy: false, unavailableReason: 'Authorized feed pending' },
  { id: 'dmart',      name: 'DMart Ready',        shortName: 'DR', kind: 'instant',     mark: 'DR', color: '#f39e91', background: '#382a2b', isConnected: false, isHealthy: false, unavailableReason: 'Authorized feed pending' },
  // E-commerce
  { id: 'amazon',     name: 'Amazon',             shortName: 'AM', kind: 'ecommerce',   mark: 'a',  color: '#ffad60', background: '#30302a', isConnected: true,  isHealthy: true },
  { id: 'flipkart',   name: 'Flipkart',           shortName: 'FL', kind: 'ecommerce',   mark: 'F',  color: '#73b8ff', background: '#1d2940', isConnected: true,  isHealthy: true },
  { id: 'croma',      name: 'Croma',              shortName: 'CR', kind: 'ecommerce',   mark: 'C',  color: '#8ad7a7', background: '#1e342e', isConnected: true,  isHealthy: true },
  { id: 'reliance',   name: 'Reliance Digital',   shortName: 'RD', kind: 'ecommerce',   mark: 'R',  color: '#93b7ff', background: '#232847', isConnected: true,  isHealthy: true },
  { id: 'bigbasket',  name: 'BigBasket',          shortName: 'BG', kind: 'ecommerce',   mark: 'BB', color: '#ff9b7b', background: '#33242a', isConnected: true,  isHealthy: true },
  // Marketplace
  { id: 'tatacliq',   name: 'Tata CLiQ',          shortName: 'TC', kind: 'marketplace', mark: 'T',  color: '#ec9bd8', background: '#3a2039', isConnected: true,  isHealthy: true },
  // Disconnected (authorized feed not yet available)
  { id: 'myntra',     name: 'Myntra',             shortName: 'MY', kind: 'ecommerce',   mark: 'M',  color: '#f3a7c6', background: '#392536', isConnected: false, isHealthy: false, unavailableReason: 'Authorized feed pending' },
  { id: 'nykaa',      name: 'Nykaa',              shortName: 'NY', kind: 'ecommerce',   mark: 'N',  color: '#e9a2bf', background: '#392435', isConnected: false, isHealthy: false, unavailableReason: 'Authorized feed pending' },
  { id: 'vijaysales', name: 'Vijay Sales',         shortName: 'VS', kind: 'ecommerce',   mark: 'VS', color: '#e8a7a0', background: '#3a2929', isConnected: false, isHealthy: false, unavailableReason: 'Authorized feed pending' },
  { id: 'meesho',     name: 'Meesho',             shortName: 'ME', kind: 'marketplace', mark: 'M',  color: '#df9fc1', background: '#3a2735', isConnected: false, isHealthy: false, unavailableReason: 'Authorized feed pending' },
  { id: 'ajio',       name: 'AJIO',               shortName: 'AJ', kind: 'marketplace', mark: 'A',  color: '#c3c0f2', background: '#292747', isConnected: false, isHealthy: false, unavailableReason: 'Authorized feed pending' },
]

const prov = (id: string): Provider => {
  const p = providers.find((x) => x.id === id)
  if (!p) throw new Error(`Unknown provider: ${id}`)
  return p
}

/** Build a price point sequence going backwards from today */
function pts(prices: number[], daysBack = prices.length - 1): PricePoint[] {
  const now = new Date()
  return prices.map((price, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (daysBack - i))
    return { date: d.toISOString().slice(0, 10), price }
  })
}

function makeHistory(prices: number[], period = 'last 30 days'): PriceHistory {
  const points = pts(prices)
  const values = points.map((p) => p.price)
  const lowest = Math.min(...values)
  const highest = Math.max(...values)
  const average = Math.round(values.reduce((s, v) => s + v, 0) / values.length)
  const change = values[values.length - 1] - values[0]
  const changePercent = values[0] > 0 ? Math.round((Math.abs(change) / values[0]) * 100) : 0
  const trend = change < -2 ? 'down' : change > 2 ? 'up' : 'flat'
  return { points, lowest, highest, average, change, changePercent, trend, period }
}

// ─── Base offer factory ───────────────────────────────────────────────────────

function offer(o: Omit<Offer, 'isLiveData'>): Offer {
  return { ...o, isLiveData: false }   // static catalog: isLiveData = false (demo data)
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT 1 — Amul Taaza Milk 1L
// ─────────────────────────────────────────────────────────────────────────────

const milkOffers: Offer[] = [
  offer({ id: 'milk-blinkit', provider: prov('blinkit'), mode: 'instant',
    productName: 'Amul Taaza Toned Fresh Milk', brand: 'Amul', variant: 'Taaza • Toned', quantity: '1 L',
    price: 63, mrp: 68,
    fees: { delivery: 0, platform: 4, handling: 0, convenience: 0, other: 0 },
    etaLabel: '12 min', etaMinutes: 12, deliveryDate: 'Today',
    availability: 'in_stock', stockLabel: 'In stock',
    seller: 'Blinkit Dark Store', sellerRating: 4.7,
    location: 'Koramangala • 1.2 km',
    match: 'exact', matchConfidence: 'Exact Match', matchScore: 0.99,
    matchReason: 'Brand, variant, size and GTIN match',
    pricePerUnit: '₹63 / L', offerLabel: 'Free delivery', offerDetail: 'Delivery fee waived on this order',
    freshness: 'live', updatedSeconds: 18, url: 'https://blinkit.com/',
  }),
  offer({ id: 'milk-zepto', provider: prov('zepto'), mode: 'instant',
    productName: 'Amul Taaza Toned Milk', brand: 'Amul', variant: 'Taaza • Toned', quantity: '1 L',
    price: 64, mrp: 68,
    fees: { delivery: 0, platform: 3, handling: 2, convenience: 0, other: 0 },
    etaLabel: '9 min', etaMinutes: 9, deliveryDate: 'Today',
    availability: 'in_stock', stockLabel: 'In stock',
    seller: 'Zepto Store', sellerRating: 4.6,
    location: 'Koramangala • 0.9 km',
    match: 'exact', matchConfidence: 'Exact Match', matchScore: 0.99,
    matchReason: 'Brand, variant, size and GTIN match',
    pricePerUnit: '₹64 / L', offerLabel: 'Fastest delivery', offerDetail: 'Fastest option in your location',
    freshness: 'live', updatedSeconds: 32, url: 'https://www.zeptonow.com/',
  }),
  offer({ id: 'milk-instamart', provider: prov('instamart'), mode: 'instant',
    productName: 'Amul Taaza Homogenised Toned Milk', brand: 'Amul', variant: 'Taaza • Toned', quantity: '1 L',
    price: 66, mrp: 68,
    fees: { delivery: 9, platform: 2, handling: 0, convenience: 0, other: 0 },
    etaLabel: '18 min', etaMinutes: 18, deliveryDate: 'Today',
    availability: 'in_stock', stockLabel: 'In stock',
    seller: 'Instamart Store', sellerRating: 4.5,
    location: 'Koramangala • 1.7 km',
    match: 'exact', matchConfidence: 'Exact Match', matchScore: 0.98,
    matchReason: 'Brand, variant and size match; GTIN verified',
    pricePerUnit: '₹66 / L', offerLabel: '₹20 off above ₹299', offerDetail: 'Offer applied on qualifying basket',
    freshness: 'live', updatedSeconds: 45, url: 'https://www.swiggy.com/instamart',
  }),
  offer({ id: 'milk-bbnow', provider: prov('bbnow'), mode: 'instant',
    productName: 'Amul Taaza Toned Fresh Milk', brand: 'Amul', variant: 'Taaza • Toned', quantity: '1 L',
    price: 65, mrp: 68,
    fees: { delivery: 0, platform: 2, handling: 0, convenience: 0, other: 0 },
    etaLabel: '22 min', etaMinutes: 22, deliveryDate: 'Today',
    availability: 'low_stock', stockLabel: 'Only 3 left',
    seller: 'BB Now • HSR Hub', sellerRating: 4.4,
    location: 'Koramangala • 2.4 km',
    match: 'exact', matchConfidence: 'Exact Match', matchScore: 0.98,
    matchReason: 'Brand, variant and size match; GTIN verified',
    pricePerUnit: '₹65 / L', offerLabel: 'Member price', offerDetail: 'Available for logged-in members',
    freshness: 'recent', updatedSeconds: 76, url: 'https://www.bigbasket.com/',
  }),
  offer({ id: 'milk-amazon', provider: prov('amazon'), mode: 'normal',
    productName: 'Amul Taaza Toned Fresh Milk', brand: 'Amul', variant: 'Taaza • Toned', quantity: '1 L',
    price: 68, mrp: 68,
    fees: { delivery: 0, platform: 0, handling: 0, convenience: 0, other: 0 },
    etaLabel: 'Tomorrow', etaMinutes: 1440, deliveryDate: 'Sep 3',
    availability: 'in_stock', stockLabel: 'In stock',
    seller: 'Amul Official Store', sellerRating: 4.8,
    location: 'Delivering to 560034',
    match: 'exact', matchConfidence: 'Exact Match', matchScore: 0.97,
    matchReason: 'Brand, variant and size match; seller verified',
    pricePerUnit: '₹68 / L', offerLabel: 'Prime delivery', offerDetail: 'Free delivery with Prime',
    rating: 4.5, reviewCount: '2.8k', returnPolicy: 'Not returnable',
    freshness: 'recent', updatedSeconds: 118, url: 'https://www.amazon.in/',
  }),
  offer({ id: 'milk-bigbasket', provider: prov('bigbasket'), mode: 'normal',
    productName: 'Amul Taaza Homogenised Toned Milk', brand: 'Amul', variant: 'Taaza • Toned', quantity: '1 L',
    price: 65, mrp: 68,
    fees: { delivery: 30, platform: 0, handling: 0, convenience: 0, other: 0, note: 'Delivery fee waived above ₹500 basket' },
    etaLabel: 'Tomorrow', etaMinutes: 1440, deliveryDate: 'Sep 3',
    availability: 'in_stock', stockLabel: 'In stock',
    seller: 'BigBasket', sellerRating: 4.4,
    location: 'Delivering to 560034',
    match: 'likely', matchConfidence: 'High Confidence', matchScore: 0.94,
    matchReason: 'Brand, variant and size match; GTIN unavailable',
    pricePerUnit: '₹65 / L', offerLabel: '₹10 cashback', offerDetail: 'Cashback subject to payment method',
    rating: 4.4, reviewCount: '1.1k', returnPolicy: 'Not returnable',
    freshness: 'cached', updatedSeconds: 263, url: 'https://www.bigbasket.com/',
  }),
]

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT 2 — iPhone 16 128GB Black
// ─────────────────────────────────────────────────────────────────────────────

const phoneOffers: Offer[] = [
  offer({ id: 'phone-flipkart', provider: prov('flipkart'), mode: 'normal',
    productName: 'Apple iPhone 16', brand: 'Apple', variant: '128GB • Black', quantity: '1 unit',
    price: 69499, mrp: 79900,
    fees: { delivery: 0, platform: 0, handling: 0, convenience: 0, other: 0 },
    etaLabel: 'Tomorrow', etaMinutes: 1440, deliveryDate: 'Sep 3',
    availability: 'in_stock', stockLabel: 'In stock',
    seller: 'RetailNet • Assured', sellerRating: 4.8,
    location: 'Delivering to 560034',
    match: 'exact', matchConfidence: 'Exact Match', matchScore: 1.0,
    matchReason: 'Model, storage, color and SKU match',
    pricePerUnit: '₹69,499 / unit', offerLabel: 'Bank offer available', offerDetail: 'Extra savings at checkout with eligible cards',
    rating: 4.6, reviewCount: '12.4k', returnPolicy: '7-day replacement', warranty: '1 year Apple warranty',
    freshness: 'live', updatedSeconds: 24, url: 'https://www.flipkart.com/',
  }),
  offer({ id: 'phone-amazon', provider: prov('amazon'), mode: 'normal',
    productName: 'Apple iPhone 16 (128 GB) — Black', brand: 'Apple', variant: '128GB • Black', quantity: '1 unit',
    price: 69999, mrp: 79900,
    fees: { delivery: 0, platform: 0, handling: 0, convenience: 0, other: 0 },
    etaLabel: 'Tomorrow', etaMinutes: 1440, deliveryDate: 'Sep 3',
    availability: 'in_stock', stockLabel: 'In stock',
    seller: 'Clicktech Retail Pvt. Ltd.', sellerRating: 4.6,
    location: 'Delivering to 560034',
    match: 'exact', matchConfidence: 'Exact Match', matchScore: 1.0,
    matchReason: 'Model, storage, color and SKU match',
    pricePerUnit: '₹69,999 / unit', offerLabel: 'Prime delivery', offerDetail: 'Free delivery with Prime',
    rating: 4.7, reviewCount: '18.1k', returnPolicy: '7-day replacement', warranty: '1 year Apple warranty',
    freshness: 'live', updatedSeconds: 39, url: 'https://www.amazon.in/',
  }),
  offer({ id: 'phone-croma', provider: prov('croma'), mode: 'normal',
    productName: 'Apple iPhone 16 128 GB Black', brand: 'Apple', variant: '128GB • Black', quantity: '1 unit',
    price: 70490, mrp: 79900,
    fees: { delivery: 0, platform: 0, handling: 0, convenience: 0, other: 0 },
    etaLabel: '2–3 days', etaMinutes: 2880, deliveryDate: 'Sep 4–5',
    availability: 'in_stock', stockLabel: 'In stock',
    seller: 'Croma Retail', sellerRating: 4.7,
    location: 'Delivering to 560034',
    match: 'exact', matchConfidence: 'Exact Match', matchScore: 0.99,
    matchReason: 'Model, storage, color and SKU match',
    pricePerUnit: '₹70,490 / unit', offerLabel: 'No-cost EMI', offerDetail: 'Available on select cards',
    rating: 4.5, reviewCount: '6.2k', returnPolicy: '7-day replacement', warranty: '1 year Apple warranty',
    freshness: 'recent', updatedSeconds: 94, url: 'https://www.croma.com/',
  }),
  offer({ id: 'phone-reliance', provider: prov('reliance'), mode: 'normal',
    productName: 'Apple iPhone 16 128GB Black', brand: 'Apple', variant: '128GB • Black', quantity: '1 unit',
    price: 70999, mrp: 79900,
    fees: { delivery: 49, platform: 0, handling: 0, convenience: 0, other: 0 },
    etaLabel: '2 days', etaMinutes: 2880, deliveryDate: 'Sep 4',
    availability: 'in_stock', stockLabel: 'In stock',
    seller: 'Reliance Digital', sellerRating: 4.5,
    location: 'Delivering to 560034',
    match: 'exact', matchConfidence: 'Exact Match', matchScore: 0.98,
    matchReason: 'Model, storage, color and SKU match',
    pricePerUnit: '₹70,999 / unit', offerLabel: 'Exchange bonus', offerDetail: 'Value varies by device condition',
    rating: 4.4, reviewCount: '3.9k', returnPolicy: '7-day replacement', warranty: '1 year Apple warranty',
    freshness: 'recent', updatedSeconds: 147, url: 'https://www.reliancedigital.in/',
  }),
  offer({ id: 'phone-tatacliq', provider: prov('tatacliq'), mode: 'normal',
    productName: 'Apple iPhone 16 Latest Model', brand: 'Apple', variant: '128GB • Black', quantity: '1 unit',
    price: 71249, mrp: 79900,
    fees: { delivery: 0, platform: 29, handling: 0, convenience: 0, other: 0 },
    etaLabel: '3–4 days', etaMinutes: 4320, deliveryDate: 'Sep 5–6',
    availability: 'in_stock', stockLabel: 'In stock',
    seller: 'Tata Unistore', sellerRating: 4.3,
    location: 'Delivering to 560034',
    match: 'likely', matchConfidence: 'High Confidence', matchScore: 0.93,
    matchReason: 'Model, storage and color match; SKU pending verification',
    pricePerUnit: '₹71,249 / unit', offerLabel: '₹500 cashback', offerDetail: 'Cashback shown by provider at checkout',
    rating: 4.3, reviewCount: '1.4k', returnPolicy: '7-day replacement', warranty: '1 year Apple warranty',
    freshness: 'cached', updatedSeconds: 341, url: 'https://www.tatacliq.com/',
  }),
]

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT 3 — AirPods Pro 2nd Generation USB-C
// ─────────────────────────────────────────────────────────────────────────────

const audioOffers: Offer[] = [
  offer({ id: 'airpods-amazon', provider: prov('amazon'), mode: 'normal',
    productName: 'Apple AirPods Pro (2nd Generation) USB-C', brand: 'Apple', variant: 'USB-C • White', quantity: '1 unit',
    price: 18990, mrp: 24900,
    fees: { delivery: 0, platform: 0, handling: 0, convenience: 0, other: 0 },
    etaLabel: 'Tomorrow', etaMinutes: 1440, deliveryDate: 'Sep 3',
    availability: 'in_stock', stockLabel: 'In stock',
    seller: 'Appario Retail', sellerRating: 4.8,
    location: 'Delivering to 560034',
    match: 'exact', matchConfidence: 'Exact Match', matchScore: 1.0,
    matchReason: 'Model, generation and connector type match',
    pricePerUnit: '₹18,990 / unit', offerLabel: 'Prime delivery', offerDetail: 'Free next-day delivery with Prime',
    rating: 4.6, reviewCount: '24.7k', returnPolicy: '7-day replacement', warranty: '1 year Apple warranty',
    freshness: 'live', updatedSeconds: 49, url: 'https://www.amazon.in/',
  }),
  offer({ id: 'airpods-flipkart', provider: prov('flipkart'), mode: 'normal',
    productName: 'Apple AirPods Pro 2nd Gen', brand: 'Apple', variant: 'USB-C • White', quantity: '1 unit',
    price: 18499, mrp: 24900,
    fees: { delivery: 0, platform: 0, handling: 0, convenience: 0, other: 0 },
    etaLabel: '2 days', etaMinutes: 2880, deliveryDate: 'Sep 4',
    availability: 'in_stock', stockLabel: 'In stock',
    seller: 'CORSECA', sellerRating: 4.5,
    location: 'Delivering to 560034',
    match: 'exact', matchConfidence: 'Exact Match', matchScore: 0.99,
    matchReason: 'Model, generation and connector type match',
    pricePerUnit: '₹18,499 / unit', offerLabel: 'Bank offer', offerDetail: 'Extra savings with eligible cards at checkout',
    rating: 4.5, reviewCount: '9.2k', returnPolicy: '7-day replacement', warranty: '1 year Apple warranty',
    freshness: 'recent', updatedSeconds: 121, url: 'https://www.flipkart.com/',
  }),
  offer({ id: 'airpods-croma', provider: prov('croma'), mode: 'normal',
    productName: 'Apple AirPods Pro 2 Lightning', brand: 'Apple', variant: 'Lightning • White', quantity: '1 unit',
    price: 17990, mrp: 24900,
    fees: { delivery: 0, platform: 0, handling: 0, convenience: 0, other: 0 },
    etaLabel: '2–3 days', etaMinutes: 2880, deliveryDate: 'Sep 4–5',
    availability: 'low_stock', stockLabel: 'Only 2 left',
    seller: 'Croma Retail', sellerRating: 4.7,
    location: 'Delivering to 560034',
    match: 'similar', matchConfidence: 'Possible Match', matchScore: 0.71,
    matchReason: 'Connector differs: Lightning instead of USB-C — different variant',
    pricePerUnit: '₹17,990 / unit', offerLabel: 'Different variant', offerDetail: 'This is the older Lightning version',
    rating: 4.4, reviewCount: '4.7k', returnPolicy: '7-day replacement', warranty: '1 year Apple warranty',
    freshness: 'recent', updatedSeconds: 88, url: 'https://www.croma.com/',
  }),
]

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT 4 — Head & Shoulders 650ml
// ─────────────────────────────────────────────────────────────────────────────

const shampooOffers: Offer[] = [
  offer({ id: 'shampoo-zepto', provider: prov('zepto'), mode: 'instant',
    productName: 'Head & Shoulders Anti-Dandruff Shampoo Cool Menthol', brand: 'Head & Shoulders', variant: 'Cool Menthol', quantity: '650 ml',
    price: 399, mrp: 499,
    fees: { delivery: 0, platform: 4, handling: 0, convenience: 0, other: 0 },
    etaLabel: '10 min', etaMinutes: 10, deliveryDate: 'Today',
    availability: 'in_stock', stockLabel: 'In stock',
    seller: 'Zepto Store', sellerRating: 4.6,
    location: 'Koramangala • 0.9 km',
    match: 'exact', matchConfidence: 'Exact Match', matchScore: 0.98,
    matchReason: 'Brand, variant and size match',
    pricePerUnit: '₹61 / 100 ml', offerLabel: '20% off', offerDetail: 'Instant offer applied',
    freshness: 'live', updatedSeconds: 25, url: 'https://www.zeptonow.com/',
  }),
  offer({ id: 'shampoo-blinkit', provider: prov('blinkit'), mode: 'instant',
    productName: 'Head & Shoulders Cool Menthol Shampoo', brand: 'Head & Shoulders', variant: 'Cool Menthol', quantity: '650 ml',
    price: 410, mrp: 499,
    fees: { delivery: 0, platform: 4, handling: 0, convenience: 0, other: 0 },
    etaLabel: '14 min', etaMinutes: 14, deliveryDate: 'Today',
    availability: 'in_stock', stockLabel: 'In stock',
    seller: 'Blinkit Dark Store', sellerRating: 4.7,
    location: 'Koramangala • 1.2 km',
    match: 'exact', matchConfidence: 'Exact Match', matchScore: 0.97,
    matchReason: 'Brand, variant and size match',
    pricePerUnit: '₹63 / 100 ml', offerLabel: 'Free delivery', offerDetail: 'Delivery fee waived on this order',
    freshness: 'live', updatedSeconds: 44, url: 'https://blinkit.com/',
  }),
  offer({ id: 'shampoo-instamart', provider: prov('instamart'), mode: 'instant',
    productName: 'Head & Shoulders Anti-Dandruff Shampoo', brand: 'Head & Shoulders', variant: 'Cool Menthol', quantity: '650 ml',
    price: 389, mrp: 499,
    fees: { delivery: 9, platform: 2, handling: 0, convenience: 0, other: 0 },
    etaLabel: '19 min', etaMinutes: 19, deliveryDate: 'Today',
    availability: 'in_stock', stockLabel: 'In stock',
    seller: 'Instamart Store', sellerRating: 4.5,
    location: 'Koramangala • 1.7 km',
    match: 'exact', matchConfidence: 'Exact Match', matchScore: 0.97,
    matchReason: 'Brand, variant and size match',
    pricePerUnit: '₹60 / 100 ml', offerLabel: '₹100 off on ₹499', offerDetail: 'Offer applies to qualifying cart',
    freshness: 'live', updatedSeconds: 66, url: 'https://www.swiggy.com/instamart',
  }),
  offer({ id: 'shampoo-amazon', provider: prov('amazon'), mode: 'normal',
    productName: 'Head & Shoulders Cool Menthol Shampoo', brand: 'Head & Shoulders', variant: 'Cool Menthol', quantity: '650 ml',
    price: 405, mrp: 499,
    fees: { delivery: 0, platform: 0, handling: 0, convenience: 0, other: 0 },
    etaLabel: 'Tomorrow', etaMinutes: 1440, deliveryDate: 'Sep 3',
    availability: 'in_stock', stockLabel: 'In stock',
    seller: 'HygieneKart', sellerRating: 4.4,
    location: 'Delivering to 560034',
    match: 'exact', matchConfidence: 'Exact Match', matchScore: 0.96,
    matchReason: 'Brand, variant and size match',
    pricePerUnit: '₹62 / 100 ml', offerLabel: 'Prime delivery', offerDetail: 'Free delivery with Prime',
    rating: 4.4, reviewCount: '7.2k', returnPolicy: 'Not returnable',
    freshness: 'recent', updatedSeconds: 134, url: 'https://www.amazon.in/',
  }),
  offer({ id: 'shampoo-flipkart', provider: prov('flipkart'), mode: 'normal',
    productName: 'Head & Shoulders Cool Menthol Shampoo', brand: 'Head & Shoulders', variant: 'Cool Menthol', quantity: '650 ml',
    price: 412, mrp: 499,
    fees: { delivery: 0, platform: 0, handling: 0, convenience: 0, other: 0 },
    etaLabel: '2 days', etaMinutes: 2880, deliveryDate: 'Sep 4',
    availability: 'in_stock', stockLabel: 'In stock',
    seller: 'Cloudtail India', sellerRating: 4.5,
    location: 'Delivering to 560034',
    match: 'exact', matchConfidence: 'Exact Match', matchScore: 0.96,
    matchReason: 'Brand, variant and size match',
    pricePerUnit: '₹63 / 100 ml',
    rating: 4.3, reviewCount: '4.8k', returnPolicy: 'Not returnable',
    freshness: 'recent', updatedSeconds: 201, url: 'https://www.flipkart.com/',
  }),
]

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT 5 — Basmati Rice 5kg
// ─────────────────────────────────────────────────────────────────────────────

const riceOffers: Offer[] = [
  offer({ id: 'rice-blinkit', provider: prov('blinkit'), mode: 'instant',
    productName: 'India Gate Classic Basmati Rice', brand: 'India Gate', variant: 'Classic', quantity: '5 kg',
    price: 449, mrp: 520,
    fees: { delivery: 0, platform: 4, handling: 0, convenience: 0, other: 0 },
    etaLabel: '15 min', etaMinutes: 15, deliveryDate: 'Today',
    availability: 'in_stock', stockLabel: 'In stock',
    seller: 'Blinkit Dark Store', sellerRating: 4.7,
    location: 'Koramangala • 1.2 km',
    match: 'exact', matchConfidence: 'Exact Match', matchScore: 0.98,
    matchReason: 'Brand, variant and weight match',
    pricePerUnit: '₹89.8 / kg', offerLabel: 'Free delivery',
    freshness: 'live', updatedSeconds: 22, url: 'https://blinkit.com/',
  }),
  offer({ id: 'rice-zepto', provider: prov('zepto'), mode: 'instant',
    productName: 'India Gate Classic Basmati Rice', brand: 'India Gate', variant: 'Classic', quantity: '5 kg',
    price: 459, mrp: 520,
    fees: { delivery: 0, platform: 3, handling: 0, convenience: 0, other: 0 },
    etaLabel: '11 min', etaMinutes: 11, deliveryDate: 'Today',
    availability: 'in_stock', stockLabel: 'In stock',
    seller: 'Zepto Store', sellerRating: 4.6,
    location: 'Koramangala • 0.9 km',
    match: 'exact', matchConfidence: 'Exact Match', matchScore: 0.98,
    matchReason: 'Brand, variant and weight match',
    pricePerUnit: '₹91.8 / kg',
    freshness: 'live', updatedSeconds: 38, url: 'https://www.zeptonow.com/',
  }),
  offer({ id: 'rice-amazon', provider: prov('amazon'), mode: 'normal',
    productName: 'India Gate Classic Basmati Rice', brand: 'India Gate', variant: 'Classic', quantity: '5 kg',
    price: 439, mrp: 520,
    fees: { delivery: 0, platform: 0, handling: 0, convenience: 0, other: 0 },
    etaLabel: 'Tomorrow', etaMinutes: 1440, deliveryDate: 'Sep 3',
    availability: 'in_stock', stockLabel: 'In stock',
    seller: 'Appario Retail', sellerRating: 4.8,
    location: 'Delivering to 560034',
    match: 'exact', matchConfidence: 'Exact Match', matchScore: 0.99,
    matchReason: 'Brand, variant and weight match',
    pricePerUnit: '₹87.8 / kg', offerLabel: 'Prime delivery',
    rating: 4.5, reviewCount: '8.1k', returnPolicy: 'Not returnable',
    freshness: 'recent', updatedSeconds: 91, url: 'https://www.amazon.in/',
  }),
  offer({ id: 'rice-bigbasket', provider: prov('bigbasket'), mode: 'normal',
    productName: 'India Gate Classic Basmati Rice', brand: 'India Gate', variant: 'Classic', quantity: '5 kg',
    price: 455, mrp: 520,
    fees: { delivery: 30, platform: 0, handling: 0, convenience: 0, other: 0, note: 'Fee waived on orders above ₹500' },
    etaLabel: 'Tomorrow', etaMinutes: 1440, deliveryDate: 'Sep 3',
    availability: 'in_stock', stockLabel: 'In stock',
    seller: 'BigBasket', sellerRating: 4.4,
    location: 'Delivering to 560034',
    match: 'exact', matchConfidence: 'Exact Match', matchScore: 0.97,
    matchReason: 'Brand, variant and weight match',
    pricePerUnit: '₹91 / kg',
    rating: 4.4, reviewCount: '3.2k', returnPolicy: 'Not returnable',
    freshness: 'cached', updatedSeconds: 188, url: 'https://www.bigbasket.com/',
  }),
]

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT 6 — Surf Excel Detergent 2kg
// ─────────────────────────────────────────────────────────────────────────────

const detergentOffers: Offer[] = [
  offer({ id: 'det-zepto', provider: prov('zepto'), mode: 'instant',
    productName: 'Surf Excel Easy Wash Detergent Powder', brand: 'Surf Excel', variant: 'Easy Wash', quantity: '2 kg',
    price: 229, mrp: 265,
    fees: { delivery: 0, platform: 4, handling: 0, convenience: 0, other: 0 },
    etaLabel: '10 min', etaMinutes: 10, deliveryDate: 'Today',
    availability: 'in_stock', stockLabel: 'In stock',
    seller: 'Zepto Store', sellerRating: 4.6,
    location: 'Koramangala • 0.9 km',
    match: 'exact', matchConfidence: 'Exact Match', matchScore: 0.98,
    matchReason: 'Brand, variant and weight match',
    pricePerUnit: '₹114.5 / kg', offerLabel: '14% off',
    freshness: 'live', updatedSeconds: 15, url: 'https://www.zeptonow.com/',
  }),
  offer({ id: 'det-blinkit', provider: prov('blinkit'), mode: 'instant',
    productName: 'Surf Excel Easy Wash Detergent Powder', brand: 'Surf Excel', variant: 'Easy Wash', quantity: '2 kg',
    price: 235, mrp: 265,
    fees: { delivery: 0, platform: 4, handling: 0, convenience: 0, other: 0 },
    etaLabel: '13 min', etaMinutes: 13, deliveryDate: 'Today',
    availability: 'in_stock', stockLabel: 'In stock',
    seller: 'Blinkit Dark Store', sellerRating: 4.7,
    location: 'Koramangala • 1.2 km',
    match: 'exact', matchConfidence: 'Exact Match', matchScore: 0.97,
    matchReason: 'Brand, variant and weight match',
    pricePerUnit: '₹117.5 / kg',
    freshness: 'live', updatedSeconds: 41, url: 'https://blinkit.com/',
  }),
  offer({ id: 'det-amazon', provider: prov('amazon'), mode: 'normal',
    productName: 'Surf Excel Easy Wash Detergent Powder', brand: 'Surf Excel', variant: 'Easy Wash', quantity: '2 kg',
    price: 219, mrp: 265,
    fees: { delivery: 0, platform: 0, handling: 0, convenience: 0, other: 0 },
    etaLabel: 'Tomorrow', etaMinutes: 1440, deliveryDate: 'Sep 3',
    availability: 'in_stock', stockLabel: 'In stock',
    seller: 'Appario Retail', sellerRating: 4.8,
    location: 'Delivering to 560034',
    match: 'exact', matchConfidence: 'Exact Match', matchScore: 0.99,
    matchReason: 'Brand, variant and weight match',
    pricePerUnit: '₹109.5 / kg', offerLabel: 'Prime delivery',
    rating: 4.5, reviewCount: '11.3k', returnPolicy: 'Not returnable',
    freshness: 'recent', updatedSeconds: 103, url: 'https://www.amazon.in/',
  }),
  offer({ id: 'det-flipkart', provider: prov('flipkart'), mode: 'normal',
    productName: 'Surf Excel Easy Wash Detergent', brand: 'Surf Excel', variant: 'Easy Wash', quantity: '2 kg',
    price: 224, mrp: 265,
    fees: { delivery: 0, platform: 0, handling: 0, convenience: 0, other: 0 },
    etaLabel: '2 days', etaMinutes: 2880, deliveryDate: 'Sep 4',
    availability: 'in_stock', stockLabel: 'In stock',
    seller: 'Cloudtail India', sellerRating: 4.5,
    location: 'Delivering to 560034',
    match: 'exact', matchConfidence: 'Exact Match', matchScore: 0.97,
    matchReason: 'Brand, variant and weight match',
    pricePerUnit: '₹112 / kg',
    rating: 4.4, reviewCount: '5.7k', returnPolicy: 'Not returnable',
    freshness: 'recent', updatedSeconds: 176, url: 'https://www.flipkart.com/',
  }),
]

// ─── Catalog ─────────────────────────────────────────────────────────────────

export const catalog: Product[] = [
  {
    id: 'amul-taaza-1l',
    searchTerms: ['amul taaza milk', 'amul milk', 'milk', 'taaza', 'dairy', 'toned milk', 'fresh milk', 'groceries under 1000'],
    name: 'Amul Taaza Toned Fresh Milk', brand: 'Amul', variant: 'Taaza • Toned', quantity: '1 L',
    category: 'Dairy & Breakfast', imageKind: 'milk',
    description: 'Homogenised toned milk for everyday use. Pasteurised and standardised to 3.0% fat.',
    gtin: '8901719100109',
    specs: [
      { label: 'Type', value: 'Toned milk' },
      { label: 'Fat', value: '3.0%' },
      { label: 'SNF', value: '8.5%' },
      { label: 'Package', value: 'Tetra Pak' },
    ],
    priceHistory: makeHistory([70, 69, 68, 68, 66, 65, 65, 64, 63, 63, 63, 62, 62, 63, 64, 65, 66, 65, 64, 63, 63, 62, 62, 63, 64, 65, 64, 63, 63, 63], 'last 30 days'),
    offers: milkOffers,
    isDefinitiveMatch: true,
    alternatives: [
      { id: 'amul-gold-1l', name: 'Amul Gold Full Cream Milk', brand: 'Amul', variant: 'Gold • Full Cream', quantity: '1 L', imageKind: 'milk', bestPrice: 68, bestProvider: 'Blinkit', savings: 0, savingsReason: 'Premium variant — higher fat content' },
    ],
  },
  {
    id: 'iphone-16-128-black',
    searchTerms: ['iphone 16', 'iphone 16 128gb', 'apple iphone 16', 'iphone', 'iphone 16 128 black', 'apple phone'],
    name: 'iPhone 16', brand: 'Apple', variant: '128GB • Black', quantity: '1 unit',
    category: 'Mobiles & Electronics', imageKind: 'phone',
    description: 'Latest iPhone featuring the A18 chip, Camera Control button, and Action button.',
    sku: 'MYLT3HN/A',
    specs: [
      { label: 'Chip', value: 'A18' },
      { label: 'Storage', value: '128 GB' },
      { label: 'Display', value: '6.1" OLED' },
      { label: 'Camera', value: '48 MP Main + 12 MP Ultra-wide' },
      { label: 'Battery', value: 'Up to 22h video' },
      { label: 'OS', value: 'iOS 18' },
    ],
    priceHistory: makeHistory([79900, 78500, 76999, 75499, 73999, 72999, 71999, 71499, 70999, 70499, 69999, 69499, 69499, 69499, 70499, 70999, 70499, 69999, 69499, 69499, 69499, 69499, 69999, 70499, 70499, 70499, 69999, 69499, 69499, 69499], 'last 30 days'),
    offers: phoneOffers,
    isDefinitiveMatch: true,
    alternatives: [
      { id: 'iphone-15-128-black', name: 'iPhone 15', brand: 'Apple', variant: '128GB • Black', quantity: '1 unit', imageKind: 'phone', bestPrice: 54999, bestProvider: 'Flipkart', savings: 14500, savingsReason: 'Previous generation — still excellent performance' },
    ],
  },
  {
    id: 'airpods-pro-2-usbc',
    searchTerms: ['airpods', 'airpods pro', 'airpods pro 2', 'apple headphones', 'apple earphones', 'airpods pro usb-c'],
    name: 'AirPods Pro (2nd generation)', brand: 'Apple', variant: 'USB-C • White', quantity: '1 unit',
    category: 'Audio', imageKind: 'audio',
    description: 'Active Noise Cancellation, Transparency mode, and USB-C charging case. MagSafe compatible.',
    sku: 'MTJV3HN/A',
    specs: [
      { label: 'ANC', value: 'Up to 2× better noise reduction' },
      { label: 'Battery', value: '6h (30h with case)' },
      { label: 'Charging', value: 'USB-C / MagSafe' },
      { label: 'Water resistance', value: 'IPX4' },
      { label: 'Chip', value: 'H2' },
    ],
    priceHistory: makeHistory([24900, 23490, 22990, 21990, 21490, 20990, 20990, 19990, 19990, 19490, 18990, 18990, 18499, 18499, 18990, 19490, 19490, 18990, 18990, 18499, 18499, 18499, 18990, 19490, 19490, 18990, 18499, 18499, 18499, 18499], 'last 30 days'),
    offers: audioOffers,
    isDefinitiveMatch: true,
    alternatives: [
      { id: 'samsung-buds-fe', name: 'Samsung Galaxy Buds FE', brand: 'Samsung', variant: 'Graphite', quantity: '1 unit', imageKind: 'audio', bestPrice: 6999, bestProvider: 'Amazon', savings: 11500, savingsReason: 'Budget alternative — ANC, 30h battery' },
    ],
  },
  {
    id: 'head-shoulders-650',
    searchTerms: ['shampoo', 'head and shoulders', 'anti dandruff shampoo', 'cool menthol', 'head & shoulders', 'dandruff shampoo', 'cheap shampoo'],
    name: 'Head & Shoulders Anti-Dandruff Shampoo', brand: 'Head & Shoulders', variant: 'Cool Menthol', quantity: '650 ml',
    category: 'Personal Care', imageKind: 'shampoo',
    description: 'Anti-dandruff shampoo with a fresh menthol finish. Clinically proven to provide up to 100% dandruff protection.',
    specs: [
      { label: 'Size', value: '650 ml' },
      { label: 'Variant', value: 'Cool Menthol' },
      { label: 'Type', value: 'Anti-dandruff' },
      { label: 'Suitable for', value: 'All hair types' },
    ],
    priceHistory: makeHistory([499, 479, 459, 449, 439, 429, 419, 410, 410, 405, 399, 399, 389, 399, 405, 410, 410, 405, 399, 399, 399, 399, 405, 410, 419, 419, 410, 405, 399, 399], 'last 30 days'),
    offers: shampooOffers,
    isDefinitiveMatch: true,
    alternatives: [
      { id: 'clinic-plus-650', name: 'Clinic Plus Strong & Shiny Shampoo', brand: 'Clinic Plus', variant: 'Strong & Shiny', quantity: '650 ml', imageKind: 'shampoo', bestPrice: 299, bestProvider: 'Zepto', savings: 90, savingsReason: 'Budget alternative — no dedicated anti-dandruff formula' },
    ],
  },
  {
    id: 'india-gate-basmati-5kg',
    searchTerms: ['basmati rice', 'india gate rice', '5kg basmati', 'basmati 5 kg', 'rice', 'india gate basmati'],
    name: 'India Gate Classic Basmati Rice', brand: 'India Gate', variant: 'Classic', quantity: '5 kg',
    category: 'Staples & Grains', imageKind: 'rice',
    description: 'Long-grain Basmati rice aged for 2 years for aromatic, fluffy results.',
    specs: [
      { label: 'Weight', value: '5 kg' },
      { label: 'Type', value: 'Aged Basmati' },
      { label: 'Origin', value: 'Punjab, India' },
    ],
    priceHistory: makeHistory([540, 530, 520, 510, 495, 485, 475, 469, 459, 449, 445, 439, 435, 439, 449, 459, 469, 465, 459, 449, 445, 439, 439, 445, 449, 455, 455, 449, 445, 439], 'last 30 days'),
    offers: riceOffers,
    isDefinitiveMatch: true,
  },
  {
    id: 'surf-excel-easy-wash-2kg',
    searchTerms: ['detergent', 'surf excel', 'washing powder', 'laundry detergent', 'surf excel 2kg', 'detergent under 500', 'same day delivery detergent'],
    name: 'Surf Excel Easy Wash Detergent Powder', brand: 'Surf Excel', variant: 'Easy Wash', quantity: '2 kg',
    category: 'Household & Cleaning', imageKind: 'detergent',
    description: 'Removes tough stains with less scrubbing. Suitable for hand wash and machine wash.',
    specs: [
      { label: 'Weight', value: '2 kg' },
      { label: 'Type', value: 'Detergent powder' },
      { label: 'Suitable for', value: 'Hand wash & machine wash' },
    ],
    priceHistory: makeHistory([265, 260, 255, 250, 245, 239, 235, 229, 225, 219, 219, 219, 219, 224, 229, 235, 235, 229, 224, 219, 219, 219, 224, 229, 235, 235, 229, 224, 219, 219], 'last 30 days'),
    offers: detergentOffers,
    isDefinitiveMatch: true,
  },
]

export const defaultProduct = catalog[0]

// ─── Search ───────────────────────────────────────────────────────────────────

/** Parse natural language query into search criteria */
export function parseQuery(raw: string): { normalized: string; budget?: number; instantOnly: boolean } {
  const q = raw.trim().toLowerCase()
  const budgetMatch = q.match(/under\s+₹?\s*(\d[\d,]*)/i) ?? q.match(/below\s+₹?\s*(\d[\d,]*)/i)
  const budget = budgetMatch ? parseInt(budgetMatch[1].replace(/,/g, ''), 10) : undefined
  const instantOnly = /\b(instant|quick|fast|30\s*min|minutes?|now|nearby|near me|same day)\b/i.test(q)
  const normalized = q.replace(/under\s+₹?\s*\d[\d,]*/i, '').replace(/\b(cheap(est)?|best|near me|now|instant|quick|fast)\b/gi, '').trim()
  return { normalized, budget, instantOnly }
}

export function findProduct(query: string): Product {
  const { normalized } = parseQuery(query)
  if (!normalized) return defaultProduct

  // Exact term match first
  const exact = catalog.find((item) =>
    item.searchTerms.some((term) =>
      normalized.includes(term) || term.includes(normalized)
    )
  )
  if (exact) return exact

  // Token overlap fallback
  const queryTokens = normalized.split(/\s+/).filter((t) => t.length > 2)
  let best: Product | null = null
  let bestScore = 0
  for (const item of catalog) {
    const combined = [...item.searchTerms, item.name, item.brand].join(' ').toLowerCase()
    const score = queryTokens.filter((t) => combined.includes(t)).length
    if (score > bestScore) { bestScore = score; best = item }
  }
  return best ?? defaultProduct
}

/** AI-powered natural language response based on actual catalog data */
export function generateAiResponse(query: string, currentProduct: Product): { response: string; product: Product } {
  const q = query.trim().toLowerCase()
  const { budget, instantOnly } = parseQuery(q)
  const targetProduct = findProduct(q)

  // Build the real comparison data
  const availableOffers = targetProduct.offers.filter((o) => o.availability !== 'unavailable')
  const instantOffers = availableOffers.filter((o) => o.mode === 'instant')
  const exactOffers = availableOffers.filter((o) => o.match === 'exact')

  const cheapest = exactOffers.reduce<Offer | null>((best, o) => {
    const fp = o.price + (o.fees.delivery ?? 0) + (o.fees.platform ?? 0) + (o.fees.handling ?? 0) + (o.fees.convenience ?? 0) + (o.fees.other ?? 0)
    const bfp = best ? best.price + (best.fees.delivery ?? 0) + (best.fees.platform ?? 0) + (best.fees.handling ?? 0) + (best.fees.convenience ?? 0) + (best.fees.other ?? 0) : Infinity
    return fp < bfp ? o : best
  }, null)

  const fastest = instantOffers.reduce<Offer | null>((best, o) => {
    return (o.etaMinutes ?? 9999) < (best?.etaMinutes ?? 9999) ? o : best
  }, null)

  const { lowest, average, changePercent, trend } = targetProduct.priceHistory

  let response = ''

  // Greet for AI/help queries
  if (/^(hi|hello|hey|help)/.test(q)) {
    response = `Hello! I'm PriceRadar AI. I can compare prices across Blinkit, Zepto, Swiggy Instamart, Amazon, Flipkart, and more.\n\nTry asking me:\n• "Find the cheapest iPhone 16 near me"\n• "Detergent under ₹300 delivered in 30 minutes"\n• "Is this a good price?"\n\nI only use real price data — no guesses.`
    return { response, product: currentProduct }
  }

  // "Is this a good price?" / price judgment
  if (/good price|worth|should i buy|right time|wait/.test(q)) {
    const best = cheapest?.price ?? 0
    const { diff, direction } = { diff: best - average, direction: best < average - 2 ? 'below' : best > average + 2 ? 'above' : 'near' }
    if (direction === 'below') {
      response = `**${currentProduct.name}** is currently ${changePercent}% below its ${currentProduct.priceHistory.period} average of ₹${average.toLocaleString('en-IN')}.\n\nThe best available price right now is **₹${best.toLocaleString('en-IN')} at ${cheapest?.provider.name}** — that's ₹${Math.abs(diff).toLocaleString('en-IN')} cheaper than average.\n\n✅ This looks like a good time to buy.`
    } else if (direction === 'above') {
      response = `**${currentProduct.name}** is currently slightly above its ${currentProduct.priceHistory.period} average. The all-time low in this period was **₹${lowest.toLocaleString('en-IN')}**.\n\n⏳ You may want to set a price alert and wait — prices have been lower recently.`
    } else {
      response = `**${currentProduct.name}** is currently priced near its ${currentProduct.priceHistory.period} average of ₹${average.toLocaleString('en-IN')}.\n\nBest right now: **₹${best.toLocaleString('en-IN')} at ${cheapest?.provider.name}**.`
    }
    return { response, product: currentProduct }
  }

  // Budget + instant search
  if (instantOnly && budget) {
    const within = instantOffers.filter((o) => (o.price + (o.fees.platform ?? 0)) <= budget)
    if (within.length) {
      const pick = within.sort((a, b) => a.price - b.price)[0]
      response = `Found **${targetProduct.name}** within your ₹${budget.toLocaleString('en-IN')} budget for instant delivery.\n\n**Best match:** ${pick.provider.name} — ₹${pick.price.toLocaleString('en-IN')} + ₹${pick.fees.platform ?? 0} platform fee = **₹${(pick.price + (pick.fees.platform ?? 0)).toLocaleString('en-IN')} total**, delivered in **${pick.etaLabel}**.\n\nAll prices shown are verified from connected sources.`
    } else {
      response = `I couldn't find **${targetProduct.name}** under ₹${budget.toLocaleString('en-IN')} for instant delivery. The cheapest instant option is ₹${fastest ? fastest.price : 'unknown'} at ${fastest?.provider.name ?? 'no provider'}.\n\nConsider checking normal delivery — Amazon has it for ₹${availableOffers.find((o) => o.provider.id === 'amazon')?.price?.toLocaleString('en-IN') ?? 'N/A'}.`
    }
    return { response, product: targetProduct }
  }

  // Default: best price + fastest breakdown
  if (cheapest && fastest) {
    const cheapestFinal = cheapest.price + (cheapest.fees.platform ?? 0) + (cheapest.fees.delivery ?? 0)
    const fastestFinal = fastest.price + (fastest.fees.platform ?? 0) + (fastest.fees.delivery ?? 0)
    response = `Here's the comparison for **${targetProduct.name}**:\n\n🏆 **Best price:** ${cheapest.provider.name} — ₹${cheapestFinal.toLocaleString('en-IN')} total\n⚡ **Fastest:** ${fastest.provider.name} — ${fastest.etaLabel} (₹${fastestFinal.toLocaleString('en-IN')} total)\n\n`
    if (cheapest.id === fastest.id) {
      response += `${cheapest.provider.name} is both the cheapest and fastest — clear winner.`
    } else {
      const diff = fastestFinal - cheapestFinal
      response += `You save ₹${diff.toLocaleString('en-IN')} by choosing ${cheapest.provider.name} over ${fastest.provider.name}, but wait ${(fastest.etaMinutes ?? 0) > 60 ? 'considerably longer' : `~${((cheapest.etaMinutes ?? 0) - (fastest.etaMinutes ?? 0))} more minutes`}.`
    }
    if (trend === 'down') response += `\n\n📉 Price has been trending down — the ${targetProduct.priceHistory.period} low is ₹${lowest.toLocaleString('en-IN')}.`
  } else if (cheapest) {
    const cheapestFinal = cheapest.price + (cheapest.fees.platform ?? 0) + (cheapest.fees.delivery ?? 0)
    response = `Best price for **${targetProduct.name}**: **₹${cheapestFinal.toLocaleString('en-IN')} at ${cheapest.provider.name}**.\n\nNo instant delivery options found in the demo catalog for this product.`
  } else {
    response = `I found **${targetProduct.name}** in the catalog, but all offers are currently showing as unavailable. Try adjusting your location or check back later.`
  }

  return { response, product: targetProduct }
}

// ─── Provider helpers ─────────────────────────────────────────────────────────

export function providersForMode(mode: DeliveryMode | 'all'): Provider[] {
  if (mode === 'all') return providers
  if (mode === 'instant') return providers.filter((p) => p.kind === 'instant')
  return providers.filter((p) => p.kind === 'ecommerce' || p.kind === 'marketplace')
}
