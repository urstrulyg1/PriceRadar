/**
 * ⚠️ TEST-ONLY FIXTURES — NEVER IMPORT FROM PRODUCTION CODE ⚠️
 *
 * These records exist exclusively for unit-testing PriceRadar's engines
 * (comparison, matching, adapters, assistant). They are NEVER loaded by the
 * application, never returned by production APIs, and never shown to users.
 *
 * The API payload fixtures mirror the documented response shapes of the real
 * upstream services (Open Food Facts, Open Prices, UPCitemDB, SerpApi,
 * Flipkart Affiliate) so adapter mapping can be tested without network calls.
 *
 * If you are reading this inside src/App.tsx or src/services/**, something
 * has gone terribly wrong — delete the import immediately.
 */

import type { Offer } from '../../domain/types'

export const TEST_FIXTURE_MARKER = 'test-fixture-only'

export function makeOffer(overrides: Partial<Offer> = {}): Offer {
  const retrievedAt = Date.now()
  return {
    id: 'test-o1',
    kind: 'shoppable',
    sourceId: 'testsource',
    sourceName: 'Test Source',
    merchant: 'Test Merchant',
    productUrl: 'https://merchant.example/listing',
    retrievedAt,
    observedAt: retrievedAt,
    freshness: 'live',
    productName: 'Test Product 400 g',
    brand: 'TestBrand',
    variant: null,
    quantity: '400 g',
    barcode: '3017620422003',
    price: 100,
    mrp: 120,
    currency: 'INR',
    fees: { delivery: 10, platform: 5, handling: 0, convenience: 0, other: 0 },
    pricePerUnit: null,
    mode: 'normal',
    etaMinutes: 30,
    deliveryNote: null,
    availability: 'in_stock',
    stockLabel: 'In stock',
    seller: 'Test Merchant',
    sellerRating: null,
    rating: 4.2,
    reviewCount: 100,
    condition: null,
    offerLabel: null,
    offerDetail: null,
    match: 'exact',
    matchConfidence: 'Exact Match',
    matchScore: 0.95,
    matchReason: 'Fixture match',
    locationLabel: null,
    ...overrides,
  }
}

// ─── Recorded API payload shapes (documented upstream formats) ───────────────

export const OFF_PRODUCT_RESPONSE = {
  status: 1,
  code: '3017620422003',
  product: {
    code: '3017620422003',
    product_name: 'Nutella',
    brands: 'Nutella, Ferrero',
    quantity: '400 g',
    image_small_url: 'https://images.openfoodfacts.org/images/products/301/762/042/2003/front_en.100.jpg',
    categories: 'Spreads, Sweet spreads',
    unique_scans_n: 1064,
  },
}

export const OFF_SEARCH_RESPONSE = {
  status: 1,
  count: 2,
  page: 1,
  page_size: 12,
  skip: 0,
  products: [
    OFF_PRODUCT_RESPONSE.product,
    {
      code: '3017620422003',
      product_name: 'Nutella B-ready',
      brands: 'Ferrero',
      quantity: '',
      image_small_url: '',
      categories: 'Snacks',
      unique_scans_n: 30,
    },
  ],
}

export const OPEN_PRICES_RESPONSE = {
  items: [
    {
      id: 2207,
      product_code: '3017620422003',
      price: 3.21,
      price_is_discounted: false,
      price_without_discount: null,
      currency: 'EUR',
      date: '2024-01-11',
      location: {
        osm_name: 'Carrefour Villeurbanne',
        osm_brand: 'Carrefour',
        osm_address_city: 'Villeurbanne',
        osm_address_country_code: 'FR',
      },
    },
    {
      id: 3838,
      product_code: '3017620422003',
      price: 2.99,
      price_is_discounted: true,
      price_without_discount: 3.99,
      currency: 'EUR',
      date: '2024-01-29',
      location: {
        osm_name: 'Carrefour Market',
        osm_brand: 'Carrefour Market',
        osm_address_city: 'Veynes',
        osm_address_country_code: 'FR',
      },
    },
  ],
  page: 1,
  pages: 82,
  size: 25,
  total: 164,
}

export const UPCITEMDB_RESPONSE = {
  code: 'OK',
  total: 1,
  offset: 0,
  items: [
    {
      ean: '3017620422003',
      title: 'Nutella Hazelnut Spread 400g',
      brand: 'Ferrero',
      color: '',
      size: '400g',
      weight: '',
      category: 'Grocery > Spreads',
      offers: [
        {
          merchant: 'Walmart',
          domain: 'walmart.com',
          title: 'Nutella Hazelnut Spread, 400g',
          currency: 'USD',
          list_price: '',
          price: 4.48,
          shipping: 'US:Standard:0.00 USD',
          condition: 'New',
          availability: 'In Stock',
          link: 'https://www.upcitemdb.com/norob/alink/?id=example',
          updated_t: 1700000000,
        },
        {
          merchant: 'Amazon',
          domain: 'amazon.com',
          title: 'Nutella Spread 13 oz',
          currency: 'USD',
          list_price: 6.99,
          price: 5.12,
          shipping: '',
          condition: 'New',
          availability: '',
          link: 'https://www.upcitemdb.com/norob/alink/?id=example2',
          updated_t: 1700000100,
        },
      ],
    },
  ],
}

export const SERPAPI_RESPONSE = {
  shopping_results: [
    {
      title: 'Nutella Hazelnut Spread 400 g',
      source: 'flipkart.com',
      link: 'https://www.google.com/aclk?example',
      product_link: 'https://www.flipkart.com/nutella-400g/p/example',
      price: '₹379',
      extracted_price: 379,
      old_price: '₹449',
      currency: 'INR',
      rating: 4.5,
      reviews: 1200,
      delivery: 'Free delivery by tomorrow',
    },
    {
      title: 'Nutella Hazelnut Spread 750 g',
      source: 'amazon.in',
      price: '₹669',
      extracted_price: 669,
      currency: 'INR',
    },
  ],
}

export const FLIPKART_RESPONSE = {
  productInfoList: [
    {
      productId: 'NUTELLA400',
      title: 'Nutella Hazelnut Spread 400 g',
      productDescription: 'Hazelnut spread with cocoa',
      imageUrls: { '200x200': 'https://rukminim2.flixcart.com/image/200x200/example.jpeg' },
      productBrand: 'Ferrero',
      sellingPrice: 379,
      retailPrice: 449,
      availabilityStatus: 'IN_STOCK',
      averageRating: 4.4,
      numberOfRatings: 5200,
      productUrl: 'https://www.flipkart.com/nutella-hazelnut-spread-400-g/p/nutella400',
    },
    {
      productId: 'NUTELLA750',
      title: 'Nutella Hazelnut Spread 750 g',
      sellingPrice: 669,
      retailPrice: 699,
      availabilityStatus: 'OUT_OF_STOCK',
      productUrl: 'https://www.flipkart.com/nutella-750-g/p/nutella750',
    },
  ],
}
