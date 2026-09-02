// ─── Open Food Facts — real product identity (public open database) ───────────
// https://world.openfoodfacts.org — open data, ODbL licence. Keyless, public,
// CORS-friendly. Used to resolve a search term or barcode to a REAL product
// record: real name, real brand, real quantity, real GTIN/EAN, real photo.
// Open Food Facts has no prices — we never pretend it does.

import type { IdentityAdapter, ProductIdentity, SearchContext } from '../../domain/types'
import { ProviderUnavailableError } from '../../domain/types'
import { GatewayError, gatewayJson, q } from '../gateway'

const BASE = '/api/openfoodfacts'
const FIELDS = ['code', 'product_name', 'brands', 'quantity', 'image_small_url', 'categories', 'unique_scans_n'].join(',')

interface OffProduct {
  code?: string
  product_name?: string
  product_name_en?: string
  brands?: string
  quantity?: string
  image_small_url?: string
  categories?: string
  unique_scans_n?: number
}

interface OffSearchResponse {
  status?: number
  count?: number
  products?: OffProduct[]
}

interface OffProductResponse {
  status?: number
  product?: OffProduct
}

const primaryBrand = (brands?: string): string | undefined => {
  if (!brands) return undefined
  const first = brands.split(',')[0]?.trim()
  return first || undefined
}

function toIdentity(p: OffProduct): ProductIdentity | null {
  const name = (p.product_name_en || p.product_name || '').trim()
  const code = (p.code || '').trim()
  if (!name || !code) return null
  return {
    id: `off:${code}`,
    sourceId: 'openfoodfacts',
    sourceName: 'Open Food Facts',
    barcode: code,
    name,
    brand: primaryBrand(p.brands),
    quantity: p.quantity?.trim() || undefined,
    imageUrl: p.image_small_url || undefined,
    category: p.categories?.split(',')[0]?.trim() || undefined,
    url: `https://world.openfoodfacts.org/product/${code}/`,
    retrievedAt: Date.now(),
  }
}

function fail(err: unknown): never {
  if (err instanceof GatewayError) {
    const map: Record<string, string> = {
      unreachable: 'Open Food Facts is not reachable from this deployment',
      timeout: 'Open Food Facts search timed out',
      rate_limited: 'Open Food Facts is rate-limiting anonymous requests — try again shortly',
      bad_response: 'Open Food Facts returned an unreadable response',
      upstream: 'Open Food Facts returned an error',
    }
    throw new ProviderUnavailableError('temporarily_unavailable', map[err.kind] ?? err.message)
  }
  throw new ProviderUnavailableError('error', err instanceof Error ? err.message : 'Unknown Open Food Facts failure')
}

export const openFoodFacts: IdentityAdapter = {
  id: 'openfoodfacts',
  name: 'Open Food Facts',
  accessNote: 'Public open database (ODbL). Resolves real products by barcode or name. Contains no prices.',
  docsUrl: 'https://openfoodfacts.github.io/openfoodfacts-server/api/',
  async resolve(ctx: SearchContext): Promise<{ identity: ProductIdentity | null; candidates: ProductIdentity[] }> {
    const barcode = ctx.barcode ?? barcodeFromQuery(ctx.query)
    if (barcode) {
      try {
        const data = await gatewayJson<OffProductResponse>(
          `${BASE}/api/v2/product/${q(barcode)}.json?fields=${FIELDS}`,
        )
        const identity = data.status === 1 && data.product ? toIdentity(data.product) : null
        return { identity, candidates: [] }
      } catch (err) {
        fail(err)
      }
    }

    const term = ctx.query.trim()
    if (!term) return { identity: null, candidates: [] }
    try {
      const data = await gatewayJson<OffSearchResponse>(
        `${BASE}/api/v2/search?search_terms=${q(term)}&fields=${FIELDS}&page_size=12`,
      )
      const products = (data.products ?? [])
        .map(toIdentity)
        .filter((p): p is ProductIdentity => p !== null)
        .sort((a, b) => nameRelevance(b.name, term) - nameRelevance(a.name, term))
      return { identity: products[0] ?? null, candidates: products.slice(1, 6) }
    } catch (err) {
      fail(err)
    }
  },
}

/** Extract a bare barcode (EAN/UPC, 8–14 digits) typed into the search box. */
export function barcodeFromQuery(query: string): string | undefined {
  const m = query.trim().match(/^(\d{8,14})$/)
  return m ? m[1] : undefined
}

/** Token-overlap relevance between a real product name and the query. */
export function nameRelevance(name: string, term: string): number {
  const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter((t) => t.length > 1)
  const qTokens = new Set(norm(term))
  const nTokens = norm(name)
  let overlap = 0
  for (const t of nTokens) if (qTokens.has(t)) overlap += 1
  return overlap
}
