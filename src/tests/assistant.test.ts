/**
 * Unit tests — the grounded assistant.
 * The AI must NEVER invent prices, providers, availability, delivery times,
 * discounts, offers, or sellers. With no retrieved data it says exactly that.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { answer, noDataReply } from '../services/assistant'
import type { SearchResult } from '../domain/types'
import { makeOffer } from './fixtures/records'
import { clearCollected } from '../services/priceHistoryStore'

beforeEach(() => {
  localStorage.clear()
  clearCollected()
})

describe('assistant with NO data', () => {
  it('says the exact no-verified-pricing line when nothing was retrieved', () => {
    const reply = answer('find the cheapest option', { result: null })
    expect(reply.content).toContain(noDataReply)
    expect(reply.citations).toEqual([])
  })

  it('never quotes a rupee/dollar amount when it has no data', () => {
    const reply = answer('cheapest iphone price', { result: null })
    expect(reply.content).not.toMatch(/[₹$]\s?\d/)
    expect(reply.content).not.toMatch(/\b\d{2,}\s?(rupees|rs)\b/i)
  })

  it('explains per-source reasons when sources failed or need auth', () => {
    const result: SearchResult = {
      query: 'nutella',
      retrievedAt: Date.now(),
      identity: null,
      identityStatus: 'connected',
      candidates: [],
      results: [
        { sourceId: 'serpapi', sourceName: 'Google Shopping (SerpApi)', status: 'auth_required', offers: [], latencyMs: null, retrievedAt: Date.now(), error: 'Add your SerpApi key' },
        { sourceId: 'openprices', sourceName: 'Open Prices', status: 'connected', offers: [], latencyMs: 2, retrievedAt: Date.now(), note: 'Skipped — needs a barcode' },
      ],
      offers: [],
    }
    const reply = answer('what is the cheapest', { result })
    expect(reply.content).toContain(noDataReply)
    expect(reply.content).toContain('SerpApi')
    expect(reply.content).toContain('Skipped')
  })

  it('reports source status without naming anything not queried', () => {
    const result: SearchResult = {
      query: 'x', retrievedAt: Date.now(), identity: null, identityStatus: 'connected',
      candidates: [],
      results: [
        { sourceId: 'a', sourceName: 'Source A', status: 'live', offers: [makeOffer()], latencyMs: 5, retrievedAt: Date.now() },
      ],
      offers: [makeOffer()],
    }
    const reply = answer('which source is unavailable', { result })
    expect(reply.content).toContain('Source A')
    expect(reply.content).not.toContain('Blinkit')
    expect(reply.content).not.toContain('Zepto')
  })
})

describe('assistant WITH retrieved data', () => {
  const cheap = makeOffer({
    id: 'cheap', sourceName: 'Source A', merchant: 'Merchant A',
    price: 379, mrp: 449, currency: 'INR',
    fees: { delivery: 0, platform: 0, handling: 0, convenience: 0, other: 0 },
    retrievedAt: Date.now() - 120_000,
  })
  const mid = makeOffer({
    id: 'mid', sourceName: 'Source B', merchant: 'Merchant B',
    price: 429, currency: 'INR',
    fees: { delivery: 0, platform: 0, handling: 0, convenience: 0, other: 0 },
  })
  const withData: SearchResult = {
    query: 'nutella',
    retrievedAt: Date.now(),
    identity: {
      id: 'off:3017620422003', sourceId: 'openfoodfacts', sourceName: 'Open Food Facts',
      barcode: '3017620422003', name: 'Nutella', brand: 'Nutella', quantity: '400 g',
      url: 'https://world.openfoodfacts.org/product/3017620422003/', retrievedAt: Date.now(),
    },
    identityStatus: 'live',
    candidates: [],
    results: [
      { sourceId: 'a', sourceName: 'Source A', status: 'live', offers: [cheap], latencyMs: 5, retrievedAt: Date.now() },
      { sourceId: 'b', sourceName: 'Source B', status: 'live', offers: [mid], latencyMs: 8, retrievedAt: Date.now() },
    ],
    offers: [cheap, mid],
  }

  it('recommends from real records and shows its data basis', () => {
    const reply = answer('cheapest option please', { result: withData })
    expect(reply.content).toContain('₹379')
    expect(reply.content).toContain('Source A')
    expect(reply.content).toContain('₹50 cheaper') // computed from cited records
    expect(reply.content).toMatch(/Price checked: \d+ min ago/)
    expect(reply.citations.map((c) => c.sourceName)).toContain('Source A')
  })

  it('cites only offers that actually exist', () => {
    const reply = answer('best price', { result: withData })
    for (const c of reply.citations) {
      expect(withData.offers.some((o) => o.sourceName === c.sourceName && o.price === c.price)).toBe(true)
    }
  })

  it('refuses to rank by speed when no ETA was supplied', () => {
    const noEta = withData.offers.map((o) => ({ ...o, etaMinutes: null, deliveryNote: null }))
    const reply = answer('fastest delivery', { result: { ...withData, offers: noEta } })
    expect(reply.content).toContain("can’t rank by speed")
    expect(reply.content).toContain("won’t guess")
  })

  it('history questions say “not enough historical data” until real points exist', () => {
    const reply = answer('is this a good price right now', { result: withData })
    expect(reply.content).toContain('Not enough historical data yet.')
  })
})

describe('assistant tone boundaries', () => {
  it('greets without claiming any provider coverage', () => {
    const reply = answer('hi', { result: null })
    expect(reply.content).not.toContain('Blinkit')
    expect(reply.content).not.toContain('Zepto')
    expect(reply.content).not.toContain('Amazon')
  })
})
