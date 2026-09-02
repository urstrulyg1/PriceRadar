// ─── Collected price history ──────────────────────────────────────────────────
// The history database contains ONLY prices PriceRadar actually retrieved
// from a real source, plus real observation dates from open datasets. No
// seeded, generated, or interpolated points — if there is not enough
// history, the UI says so.

import type { CollectedPricePoint, Offer, ProductIdentity } from '../domain/types'

const STORE_KEY = 'priceradar.collected.v1'
const MAX_POINTS = 5_000

let cache: CollectedPricePoint[] | null = null
const listeners = new Set<() => void>()

function load(): CollectedPricePoint[] {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(STORE_KEY)
    cache = raw ? JSON.parse(raw) as CollectedPricePoint[] : []
  } catch {
    cache = []
  }
  return cache!
}

function persist(): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(load().slice(-MAX_POINTS)))
  } catch {
    // storage full/unavailable — history stays in memory for this session
  }
  listeners.forEach((fn) => fn())
}

export function productKeyOf(identity: ProductIdentity): string {
  return identity.barcode ? `gtin:${identity.barcode}` : `name:${identity.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80)}`
}

/** Record the offers a real retrieval produced. Only real offers are passed. */
export function recordOffers(identity: ProductIdentity, offers: Offer[]): void {
  const key = productKeyOf(identity)
  const existing = load()
  const now = Date.now()
  for (const o of offers) {
    existing.push({
      productId: identity.id,
      productKey: key,
      productName: identity.name,
      sourceId: o.sourceId,
      merchant: o.merchant,
      price: o.price,
      currency: o.currency,
      retrievedAt: o.retrievedAt || now,
      observedAt: o.observedAt ?? o.retrievedAt ?? now,
    })
  }
  cache = existing.slice(-MAX_POINTS)
  persist()
}

export function getCollectedPoints(productKey: string): CollectedPricePoint[] {
  return load().filter((p) => p.productKey === productKey)
}

export function allCollectedPoints(): CollectedPricePoint[] {
  return [...load()]
}

export function clearCollected(): void {
  cache = []
  persist()
}

export function onHistoryChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
