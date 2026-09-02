import type { DeliveryMode, Offer, Product, Provider } from '../domain/types'

export const providers: Provider[] = [
  { id: 'blinkit', name: 'Blinkit', shortName: 'B', kind: 'instant', mark: 'B', color: '#f7c948', background: '#1d2c2e', isConnected: true },
  { id: 'zepto', name: 'Zepto', shortName: 'Z', kind: 'instant', mark: 'Z', color: '#c8f169', background: '#252941', isConnected: true },
  { id: 'instamart', name: 'Swiggy Instamart', shortName: 'S', kind: 'instant', mark: 'S', color: '#ff9b7b', background: '#2e1f27', isConnected: true },
  { id: 'bbnow', name: 'BB Now', shortName: 'BB', kind: 'instant', mark: 'BB', color: '#a5dbff', background: '#1e3042', isConnected: true },
  { id: 'amazon', name: 'Amazon', shortName: 'A', kind: 'ecommerce', mark: 'a', color: '#ffad60', background: '#30302a', isConnected: true },
  { id: 'flipkart', name: 'Flipkart', shortName: 'F', kind: 'ecommerce', mark: 'F', color: '#73b8ff', background: '#1d2940', isConnected: true },
  { id: 'croma', name: 'Croma', shortName: 'C', kind: 'ecommerce', mark: 'C', color: '#8ad7a7', background: '#1e342e', isConnected: true },
  { id: 'reliance', name: 'Reliance Digital', shortName: 'R', kind: 'ecommerce', mark: 'R', color: '#93b7ff', background: '#232847', isConnected: true },
  { id: 'tatacliq', name: 'Tata CLiQ', shortName: 'T', kind: 'marketplace', mark: 'T', color: '#ec9bd8', background: '#3a2039', isConnected: true },
  { id: 'bigbasket', name: 'BigBasket', shortName: 'BB', kind: 'ecommerce', mark: 'BB', color: '#ff9b7b', background: '#33242a', isConnected: true },
  // Configured provider slots can be enabled when an authorized feed is available.
  { id: 'myntra', name: 'Myntra', shortName: 'M', kind: 'ecommerce', mark: 'M', color: '#f3a7c6', background: '#392536', isConnected: false },
  { id: 'vijaysales', name: 'Vijay Sales', shortName: 'VS', kind: 'ecommerce', mark: 'VS', color: '#e8a7a0', background: '#3a2929', isConnected: false },
  { id: 'nykaa', name: 'Nykaa', shortName: 'N', kind: 'ecommerce', mark: 'N', color: '#e9a2bf', background: '#392435', isConnected: false },
  { id: 'ajio', name: 'AJIO', shortName: 'A', kind: 'marketplace', mark: 'A', color: '#c3c0f2', background: '#292747', isConnected: false },
  { id: 'meesho', name: 'Meesho', shortName: 'M', kind: 'marketplace', mark: 'M', color: '#df9fc1', background: '#3a2735', isConnected: false },
  { id: 'flipkart-minutes', name: 'Flipkart Minutes', shortName: 'FM', kind: 'instant', mark: 'FM', color: '#83baff', background: '#1d2d42', isConnected: false },
  { id: 'amazon-now', name: 'Amazon Now', shortName: 'AN', kind: 'instant', mark: 'AN', color: '#ffbd79', background: '#35302b', isConnected: false },
  { id: 'dmart-ready', name: 'DMart Ready', shortName: 'DR', kind: 'instant', mark: 'DR', color: '#f39e91', background: '#382a2b', isConnected: false },
]

const provider = (id: string) => providers.find((item) => item.id === id)!

const base = (values: Omit<Offer, 'provider'> & { provider: string }): Offer => ({
  ...values,
  provider: provider(values.provider),
})

const milkOffers: Offer[] = [
  base({
    id: 'milk-blinkit', provider: 'blinkit', mode: 'instant', productName: 'Amul Taaza Toned Fresh Milk', brand: 'Amul', variant: 'Taaza • Toned', quantity: '1 L', price: 63, mrp: 68,
    fees: { delivery: 0, platform: 4, handling: 0, other: 0 }, etaLabel: '12 min', etaMinutes: 12, availability: 'in_stock', stockLabel: 'In stock', seller: 'Blinkit Dark Store', location: 'Koramangala • 1.2 km', match: 'exact', matchScore: .99, matchReason: 'Brand, variant, size and GTIN match', pricePerUnit: '₹63 / L', offerLabel: 'Free delivery', offerDetail: 'Delivery fee waived on this order', freshness: 'live', updatedSeconds: 18, url: 'https://blinkit.com/'
  }),
  base({
    id: 'milk-zepto', provider: 'zepto', mode: 'instant', productName: 'Amul Taaza Toned Milk', brand: 'Amul', variant: 'Taaza • Toned', quantity: '1 L', price: 64, mrp: 68,
    fees: { delivery: 0, platform: 3, handling: 2, other: 0 }, etaLabel: '9 min', etaMinutes: 9, availability: 'in_stock', stockLabel: 'In stock', seller: 'Zepto Cafe & Store', location: 'Koramangala • 0.9 km', match: 'exact', matchScore: .99, matchReason: 'Brand, variant, size and GTIN match', pricePerUnit: '₹64 / L', offerLabel: 'Fastest delivery', offerDetail: 'Available in your selected location', freshness: 'live', updatedSeconds: 32, url: 'https://www.zeptonow.com/'
  }),
  base({
    id: 'milk-instamart', provider: 'instamart', mode: 'instant', productName: 'Amul Taaza Homogenised Toned Milk', brand: 'Amul', variant: 'Taaza • Toned', quantity: '1 L', price: 66, mrp: 68,
    fees: { delivery: 9, platform: 2, handling: 0, other: 0 }, etaLabel: '18 min', etaMinutes: 18, availability: 'in_stock', stockLabel: 'In stock', seller: 'Instamart Store', location: 'Koramangala • 1.7 km', match: 'exact', matchScore: .98, matchReason: 'Brand, variant and size match; GTIN verified', pricePerUnit: '₹66 / L', offerLabel: '₹20 off above ₹299', offerDetail: 'Offer applied on qualifying basket', freshness: 'live', updatedSeconds: 45, url: 'https://www.swiggy.com/instamart'
  }),
  base({
    id: 'milk-bbnow', provider: 'bbnow', mode: 'instant', productName: 'Amul Taaza Toned Fresh Milk', brand: 'Amul', variant: 'Taaza • Toned', quantity: '1 L', price: 65, mrp: 68,
    fees: { delivery: 0, platform: 2, handling: 0, other: 0 }, etaLabel: '22 min', etaMinutes: 22, availability: 'low_stock', stockLabel: 'Only 3 left', seller: 'BB Now • HSR Hub', location: 'Koramangala • 2.4 km', match: 'exact', matchScore: .98, matchReason: 'Brand, variant and size match; GTIN verified', pricePerUnit: '₹65 / L', offerLabel: 'Member price', offerDetail: 'Available for logged-in members', freshness: 'recent', updatedSeconds: 76, url: 'https://www.bigbasket.com/'
  }),
  base({
    id: 'milk-amazon', provider: 'amazon', mode: 'normal', productName: 'Amul Taaza Toned Fresh Milk', brand: 'Amul', variant: 'Taaza • Toned', quantity: '1 L', price: 68, mrp: 68,
    fees: { delivery: 0, platform: 0, handling: 0, other: 0 }, etaLabel: 'Tomorrow', etaMinutes: 1440, availability: 'in_stock', stockLabel: 'In stock', seller: 'Amul Official Store', location: 'Delivering to 560034', match: 'exact', matchScore: .97, matchReason: 'Brand, variant and size match; seller verified', pricePerUnit: '₹68 / L', offerLabel: 'Prime delivery', offerDetail: 'Free delivery with Prime', rating: 4.5, reviewCount: '2.8k', returnPolicy: 'Not returnable', freshness: 'recent', updatedSeconds: 118, url: 'https://www.amazon.in/'
  }),
  base({
    id: 'milk-bigbasket', provider: 'bigbasket', mode: 'normal', productName: 'Amul Taaza Homogenised Toned Milk', brand: 'Amul', variant: 'Taaza • Toned', quantity: '1 L', price: 65, mrp: 68,
    fees: { delivery: 30, platform: 0, handling: 0, other: 0, note: 'Delivery fee depends on basket value' }, etaLabel: 'Tomorrow', etaMinutes: 1440, availability: 'in_stock', stockLabel: 'In stock', seller: 'BigBasket', location: 'Delivering to 560034', match: 'likely', matchScore: .94, matchReason: 'Brand, variant and size match; GTIN unavailable', pricePerUnit: '₹65 / L', offerLabel: '₹10 cashback', offerDetail: 'Cashback subject to payment method', rating: 4.4, reviewCount: '1.1k', returnPolicy: 'Not returnable', freshness: 'cached', updatedSeconds: 263, url: 'https://www.bigbasket.com/'
  }),
]

const phoneOffers: Offer[] = [
  base({
    id: 'phone-flipkart', provider: 'flipkart', mode: 'normal', productName: 'Apple iPhone 16', brand: 'Apple', variant: '128GB • Black', quantity: '1 unit', price: 69499, mrp: 79900,
    fees: { delivery: 0, platform: 0, handling: 0, other: 0 }, etaLabel: 'Tomorrow', etaMinutes: 1440, availability: 'in_stock', stockLabel: 'In stock', seller: 'RetailNet • Assured', location: 'Delivering to 560034', match: 'exact', matchScore: 1, matchReason: 'Model, storage, color and SKU match', pricePerUnit: '₹69,499 / unit', offerLabel: 'Bank offer available', offerDetail: 'Extra savings at checkout with eligible cards', rating: 4.6, reviewCount: '12.4k', returnPolicy: '7-day replacement', warranty: '1 year Apple warranty', freshness: 'live', updatedSeconds: 24, url: 'https://www.flipkart.com/'
  }),
  base({
    id: 'phone-amazon', provider: 'amazon', mode: 'normal', productName: 'Apple iPhone 16 (128 GB)', brand: 'Apple', variant: '128GB • Black', quantity: '1 unit', price: 69999, mrp: 79900,
    fees: { delivery: 0, platform: 0, handling: 0, other: 0 }, etaLabel: 'Tomorrow', etaMinutes: 1440, availability: 'in_stock', stockLabel: 'In stock', seller: 'Clicktech Retail Pvt. Ltd.', location: 'Delivering to 560034', match: 'exact', matchScore: 1, matchReason: 'Model, storage, color and SKU match', pricePerUnit: '₹69,999 / unit', offerLabel: 'Prime delivery', offerDetail: 'Free delivery with Prime', rating: 4.7, reviewCount: '18.1k', returnPolicy: '7-day replacement', warranty: '1 year Apple warranty', freshness: 'live', updatedSeconds: 39, url: 'https://www.amazon.in/'
  }),
  base({
    id: 'phone-croma', provider: 'croma', mode: 'normal', productName: 'Apple iPhone 16 128 GB', brand: 'Apple', variant: '128GB • Black', quantity: '1 unit', price: 70490, mrp: 79900,
    fees: { delivery: 0, platform: 0, handling: 0, other: 0 }, etaLabel: '2–3 days', etaMinutes: 2880, availability: 'in_stock', stockLabel: 'In stock', seller: 'Croma Retail', location: 'Delivering to 560034', match: 'exact', matchScore: .99, matchReason: 'Model, storage, color and SKU match', pricePerUnit: '₹70,490 / unit', offerLabel: 'No-cost EMI', offerDetail: 'Available on select cards', rating: 4.5, reviewCount: '6.2k', returnPolicy: '7-day replacement', warranty: '1 year Apple warranty', freshness: 'recent', updatedSeconds: 94, url: 'https://www.croma.com/'
  }),
  base({
    id: 'phone-reliance', provider: 'reliance', mode: 'normal', productName: 'Apple iPhone 16 128GB', brand: 'Apple', variant: '128GB • Black', quantity: '1 unit', price: 70999, mrp: 79900,
    fees: { delivery: 49, platform: 0, handling: 0, other: 0 }, etaLabel: '2 days', etaMinutes: 2880, availability: 'in_stock', stockLabel: 'In stock', seller: 'Reliance Digital', location: 'Delivering to 560034', match: 'exact', matchScore: .98, matchReason: 'Model, storage, color and SKU match', pricePerUnit: '₹70,999 / unit', offerLabel: 'Exchange bonus', offerDetail: 'Value varies by device condition', rating: 4.4, reviewCount: '3.9k', returnPolicy: '7-day replacement', warranty: '1 year Apple warranty', freshness: 'recent', updatedSeconds: 147, url: 'https://www.reliancedigital.in/'
  }),
  base({
    id: 'phone-tatacliq', provider: 'tatacliq', mode: 'normal', productName: 'Apple iPhone 16 - Latest Model', brand: 'Apple', variant: '128GB • Black', quantity: '1 unit', price: 71249, mrp: 79900,
    fees: { delivery: 0, platform: 29, handling: 0, other: 0 }, etaLabel: '3–4 days', etaMinutes: 4320, availability: 'in_stock', stockLabel: 'In stock', seller: 'Tata Unistore', location: 'Delivering to 560034', match: 'likely', matchScore: .93, matchReason: 'Model, storage and color match; SKU pending', pricePerUnit: '₹71,249 / unit', offerLabel: '₹500 cashback', offerDetail: 'Cashback shown by provider', rating: 4.3, reviewCount: '1.4k', returnPolicy: '7-day replacement', warranty: '1 year Apple warranty', freshness: 'cached', updatedSeconds: 341, url: 'https://www.tatacliq.com/'
  }),
]

const audioOffers: Offer[] = [
  base({
    id: 'airpods-amazon', provider: 'amazon', mode: 'normal', productName: 'Apple AirPods Pro (2nd Generation)', brand: 'Apple', variant: 'USB-C • White', quantity: '1 unit', price: 18990, mrp: 24900,
    fees: { delivery: 0, platform: 0, handling: 0, other: 0 }, etaLabel: 'Tomorrow', etaMinutes: 1440, availability: 'in_stock', stockLabel: 'In stock', seller: 'Appario Retail', location: 'Delivering to 560034', match: 'exact', matchScore: 1, matchReason: 'Model, generation and connector match', pricePerUnit: '₹18,990 / unit', offerLabel: 'Prime delivery', offerDetail: 'Free delivery with Prime', rating: 4.6, reviewCount: '24.7k', returnPolicy: '7-day replacement', warranty: '1 year Apple warranty', freshness: 'live', updatedSeconds: 49, url: 'https://www.amazon.in/'
  }),
  base({
    id: 'airpods-flipkart', provider: 'flipkart', mode: 'normal', productName: 'Apple AirPods Pro 2nd Gen', brand: 'Apple', variant: 'USB-C • White', quantity: '1 unit', price: 18499, mrp: 24900,
    fees: { delivery: 0, platform: 0, handling: 0, other: 0 }, etaLabel: '2 days', etaMinutes: 2880, availability: 'in_stock', stockLabel: 'In stock', seller: 'CORSECA', location: 'Delivering to 560034', match: 'exact', matchScore: .99, matchReason: 'Model, generation and connector match', pricePerUnit: '₹18,499 / unit', offerLabel: 'Bank offer available', offerDetail: 'Extra savings at checkout with eligible cards', rating: 4.5, reviewCount: '9.2k', returnPolicy: '7-day replacement', warranty: '1 year Apple warranty', freshness: 'recent', updatedSeconds: 121, url: 'https://www.flipkart.com/'
  }),
  base({
    id: 'airpods-croma', provider: 'croma', mode: 'normal', productName: 'Apple AirPods Pro 2', brand: 'Apple', variant: 'Lightning • White', quantity: '1 unit', price: 17990, mrp: 24900,
    fees: { delivery: 0, platform: 0, handling: 0, other: 0 }, etaLabel: '2–3 days', etaMinutes: 2880, availability: 'low_stock', stockLabel: 'Only 2 left', seller: 'Croma Retail', location: 'Delivering to 560034', match: 'similar', matchScore: .76, matchReason: 'Connector differs: Lightning instead of USB-C', pricePerUnit: '₹17,990 / unit', offerLabel: 'Limited stock', offerDetail: 'Similar product, not included in best price', rating: 4.4, reviewCount: '4.7k', returnPolicy: '7-day replacement', warranty: '1 year Apple warranty', freshness: 'recent', updatedSeconds: 88, url: 'https://www.croma.com/'
  }),
]

const shampooOffers: Offer[] = [
  base({
    id: 'shampoo-zepto', provider: 'zepto', mode: 'instant', productName: 'Head & Shoulders Anti-Dandruff Shampoo', brand: 'Head & Shoulders', variant: 'Cool Menthol', quantity: '650 ml', price: 399, mrp: 499,
    fees: { delivery: 0, platform: 4, handling: 0, other: 0 }, etaLabel: '10 min', etaMinutes: 10, availability: 'in_stock', stockLabel: 'In stock', seller: 'Zepto Store', location: 'Koramangala • 0.9 km', match: 'exact', matchScore: .98, matchReason: 'Brand, variant and size match', pricePerUnit: '₹61 / 100 ml', offerLabel: '20% off', offerDetail: 'Instant offer applied', freshness: 'live', updatedSeconds: 25, url: 'https://www.zeptonow.com/'
  }),
  base({
    id: 'shampoo-blinkit', provider: 'blinkit', mode: 'instant', productName: 'Head & Shoulders Cool Menthol Shampoo', brand: 'Head & Shoulders', variant: 'Cool Menthol', quantity: '650 ml', price: 410, mrp: 499,
    fees: { delivery: 0, platform: 4, handling: 0, other: 0 }, etaLabel: '14 min', etaMinutes: 14, availability: 'in_stock', stockLabel: 'In stock', seller: 'Blinkit Dark Store', location: 'Koramangala • 1.2 km', match: 'exact', matchScore: .97, matchReason: 'Brand, variant and size match', pricePerUnit: '₹63 / 100 ml', offerLabel: 'Free delivery', offerDetail: 'Delivery fee waived on this order', freshness: 'live', updatedSeconds: 44, url: 'https://blinkit.com/'
  }),
  base({
    id: 'shampoo-instamart', provider: 'instamart', mode: 'instant', productName: 'Head & Shoulders Anti-Dandruff Shampoo', brand: 'Head & Shoulders', variant: 'Cool Menthol', quantity: '650 ml', price: 389, mrp: 499,
    fees: { delivery: 9, platform: 2, handling: 0, other: 0 }, etaLabel: '19 min', etaMinutes: 19, availability: 'in_stock', stockLabel: 'In stock', seller: 'Instamart Store', location: 'Koramangala • 1.7 km', match: 'exact', matchScore: .97, matchReason: 'Brand, variant and size match', pricePerUnit: '₹60 / 100 ml', offerLabel: '₹100 off on ₹499', offerDetail: 'Offer applies to qualifying cart', freshness: 'live', updatedSeconds: 66, url: 'https://www.swiggy.com/instamart'
  }),
  base({
    id: 'shampoo-amazon', provider: 'amazon', mode: 'normal', productName: 'Head & Shoulders Cool Menthol Shampoo', brand: 'Head & Shoulders', variant: 'Cool Menthol', quantity: '650 ml', price: 405, mrp: 499,
    fees: { delivery: 0, platform: 0, handling: 0, other: 0 }, etaLabel: 'Tomorrow', etaMinutes: 1440, availability: 'in_stock', stockLabel: 'In stock', seller: 'HygieneKart', location: 'Delivering to 560034', match: 'exact', matchScore: .96, matchReason: 'Brand, variant and size match', pricePerUnit: '₹62 / 100 ml', offerLabel: 'Prime delivery', offerDetail: 'Free delivery with Prime', rating: 4.4, reviewCount: '7.2k', returnPolicy: 'Not returnable', freshness: 'recent', updatedSeconds: 134, url: 'https://www.amazon.in/'
  }),
]

export const catalog: Product[] = [
  {
    id: 'amul-taaza-1l', searchTerms: ['amul taaza milk', 'amul milk', 'milk', 'taaza', 'groceries under 1000'], name: 'Amul Taaza Toned Fresh Milk', brand: 'Amul', variant: 'Taaza • Toned', quantity: '1 L', category: 'Dairy & breakfast', imageKind: 'milk', description: 'Homogenised toned milk for everyday use',
    priceHistory: { points: [68, 66, 67, 65, 65, 64, 63, 63], lowest: 61, highest: 72, average: 66, change: -3, period: 'last 7 days' }, offers: milkOffers,
  },
  {
    id: 'iphone-16-128-black', searchTerms: ['iphone 16', 'iphone 16 128gb', 'apple iphone 16', 'iphone'], name: 'iPhone 16', brand: 'Apple', variant: '128GB • Black', quantity: '1 unit', category: 'Mobiles & electronics', imageKind: 'phone', description: 'Latest iPhone with A18 chip and Camera Control',
    priceHistory: { points: [73999, 72999, 71999, 71499, 70999, 70499, 69999, 69499], lowest: 68999, highest: 79900, average: 71980, change: -1500, period: 'last 7 days' }, offers: phoneOffers,
  },
  {
    id: 'airpods-pro-2-usbc', searchTerms: ['airpods', 'airpods pro', 'airpods pro 2', 'apple headphones'], name: 'AirPods Pro (2nd generation)', brand: 'Apple', variant: 'USB-C • White', quantity: '1 unit', category: 'Audio', imageKind: 'audio', description: 'Active Noise Cancellation with USB-C charging case',
    priceHistory: { points: [20990, 20990, 19990, 19990, 19490, 18990, 18990, 18499], lowest: 17990, highest: 24900, average: 19740, change: -2491, period: 'last 30 days' }, offers: audioOffers,
  },
  {
    id: 'head-shoulders-650', searchTerms: ['shampoo', 'head and shoulders', 'anti dandruff shampoo', 'cool menthol'], name: 'Head & Shoulders Anti-Dandruff Shampoo', brand: 'Head & Shoulders', variant: 'Cool Menthol', quantity: '650 ml', category: 'Personal care', imageKind: 'shampoo', description: 'Anti-dandruff shampoo with a fresh menthol finish',
    priceHistory: { points: [449, 429, 429, 419, 410, 399, 399, 389], lowest: 369, highest: 499, average: 416, change: -30, period: 'last 30 days' }, offers: shampooOffers,
  },
]

export const defaultProduct = catalog[0]

export function findProduct(query: string): Product {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return defaultProduct
  return catalog.find((item) => item.searchTerms.some((term) => normalized.includes(term) || term.includes(normalized))) ?? defaultProduct
}

export function providersForMode(mode: DeliveryMode | 'all'): Provider[] {
  if (mode === 'all') return providers
  return providers.filter((item) => item.kind === mode || (mode === 'normal' && item.kind === 'marketplace'))
}

// A registry boundary keeps provider integrations independent from the UI.
export const adapterRegistry = providers.reduce<Record<string, { provider: Provider; status: 'connected' | 'unavailable' }>>((registry, item) => {
  registry[item.id] = { provider: item, status: item.isConnected ? 'connected' : 'unavailable' }
  return registry
}, {})
