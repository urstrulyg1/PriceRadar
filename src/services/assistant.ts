// ─── PriceRadar Assistant — grounded, deterministic, no-fabrication AI ────────
// The assistant reasons ONLY over records PriceRadar actually retrieved.
//   • Every number in a reply is copied or computed from cited offers.
//   • If there is no verified data the assistant says exactly that, plus the
//     honest per-source reason (auth required / unavailable / pending).
//   • It never names a provider that did not return data for the query.
//   • History statements require ≥2 genuinely collected observations.

import type { AiCitation, CollectedPricePoint, Offer, SearchResult } from '../domain/types'
import {
  collectedInsight, comparableOffers, finalPrice, formatMoney, summarize,
} from '../domain/compare'
import { getCollectedPoints, productKeyOf } from './priceHistoryStore'

export interface AssistantSession {
  /** The current real search result, if one has been run */
  result: SearchResult | null
}

export interface AssistantReply {
  content: string
  citations: AiCitation[]
}

const NO_DATA_REPLY =
  'I couldn’t find verified live pricing for this product right now.'

function ageOf(offer: Offer): string {
  const secs = Math.max(1, Math.round((Date.now() - offer.retrievedAt) / 1000))
  if (secs < 60) return `${secs}s ago`
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins} min ago`
  return `${Math.round(mins / 60)}h ago`
}

function sourceBreakdown(result: SearchResult): string {
  const lines = result.results
    .filter((r) => r.offers.length === 0)
    .map((r) => `• ${r.sourceName}: ${r.error ?? r.note ?? 'no results'}`)
  return lines.length ? `\n\nWhy some sources are empty:\n${lines.join('\n')}` : ''
}

function withData(offer: Offer): string {
  const total = finalPrice(offer)
  const price = total === null
    ? `${formatMoney(offer.price, offer.currency)} + checkout charges`
    : formatMoney(total, offer.currency)
  const parts = [`${offer.sourceName}${offer.merchant && offer.merchant !== offer.sourceName ? ` (${offer.merchant})` : ''} — ${price}`]
  if (offer.deliveryNote) parts.push(`Delivery: ${offer.deliveryNote}`)
  else if (offer.etaMinutes !== null) parts.push(`Delivery: ~${offer.etaMinutes} min`)
  else parts.push('Delivery estimate unavailable')
  parts.push(`Price checked: ${ageOf(offer)}`)
  return parts.join('\n')
}

/** Reply to a user message using only the session's real data. */
export function answer(message: string, session: AssistantSession): AssistantReply {
  const q = message.trim().toLowerCase()
  const result = session.result
  const offers = result?.offers ?? []
  const shoppable = comparableOffers(offers)

  // ── Greetings / help ────────────────────────────────────────────────────────
  if (/^(hi|hello|hey|help|what can you do)/.test(q)) {
    return {
      content: [
        'Hello! I’m the PriceRadar assistant. I can only discuss prices and offers that PriceRadar actually retrieved from its connected sources — I never guess or estimate.',
        '',
        'Try:',
        '• “What’s the cheapest verified price?”',
        '• “Is this a good price right now?”',
        '• “Which source is unavailable?”',
      ].join('\n'),
      citations: [],
    }
  }

  // ── Source availability questions ──────────────────────────────────────────
  if (/which (source|provider|store)/.test(q) || /unavailable|down|status/.test(q)) {
    if (!result) {
      return { content: 'No search has been run yet in this session, so I have no source status to report. Run a search first — I only report what PriceRadar actually queried.', citations: [] }
    }
    const live = result.results.filter((r) => r.offers.length > 0)
    const empty = result.results.filter((r) => r.offers.length === 0)
    const lines: string[] = []
    if (live.length) lines.push(...live.map((r) => `✓ ${r.sourceName}: live, ${r.offers.length} result(s)`))
    if (empty.length) lines.push(...empty.map((r) => `✗ ${r.sourceName}: ${r.error ?? r.note ?? 'no results'}`))
    return {
      content: `Source status for “${result.query}” (checked ${Math.max(1, Math.round((Date.now() - result.retrievedAt) / 1000))}s ago):\n${lines.join('\n')}`,
      citations: [],
    }
  }

  // ── Any price/buy/cheap/fast/good question with NO verified data ────────────
  if (!shoppable.length) {
    const reason = result
      ? sourceBreakdown(result)
      : '\n\nNo search has been run yet. Search for a product first — I answer only from retrieved data.'
    return {
      content: `${NO_DATA_REPLY}${reason}\n\nYou can connect an authorized source (SerpApi / Flipkart Affiliate) in Sources, or try a different product or barcode.`,
      citations: [],
    }
  }

  const summary = summarize(offers)

  // ── Good price / history (checked BEFORE generic price words) ───────────────
  if (/good price|worth|should i buy|right time|history|trend|compare over time/.test(q)) {
    if (!result?.identity) {
      return { content: 'No verified product identity is attached to this search, so I have nothing to compare historically.', citations: [] }
    }
    const points = getCollectedPoints(productKeyOf(result.identity))
    const currency = shoppable[0]?.currency ?? 'INR'
    const insight = collectedInsight(points, currency)
    const best = summary.bestPrice!
    const current = finalPrice(best) ?? best.price
    if (!insight) {
      return {
        content: [
          'Not enough historical data yet.',
          '',
          `PriceRadar has recorded ${points.length} price observation(s) for this product so far — at least two on different dates are needed before I’ll describe a trend. The current best verified price is ${formatMoney(current, best.currency)} at ${best.sourceName} (checked ${ageOf(best)}).`,
        ].join('\n'),
        citations: [toCite(best)],
      }
    }
    return {
      content: [
        insight,
        '',
        `Current best verified price: ${formatMoney(current, best.currency)} at ${best.sourceName} (checked ${ageOf(best)}).`,
        '',
        'This comparison uses only prices PriceRadar itself collected — no generated history.',
      ].join('\n'),
      citations: [toCite(best)],
    }
  }

  // ── Best / cheapest ─────────────────────────────────────────────────────────
  if (/cheap|best|lowest|buy|price|deal|recommend|option/.test(q)) {
    const best = summary.bestPrice!
    const lines: string[] = ['**Best verified price right now**', '', withData(best)]
    if (summary.savings && summary.nextBestPrice) {
      lines.push('', `This is ${formatMoney(summary.savings, best.currency)} cheaper than the next verified option (${summary.nextBestPrice.sourceName}${summary.nextBestPrice.merchant ? ` · ${summary.nextBestPrice.merchant}` : ''}).`)
    }
    const others = shoppable.filter((o) => o.id !== best.id).slice(0, 3)
    if (others.length) {
      lines.push('', 'Other verified options:')
      lines.push(...others.map((o) => `• ${withData(o).split('\n')[0]}`))
    }
    lines.push('', 'All figures above come from listings PriceRadar retrieved — fees not disclosed by a source are listed as “+ checkout charges”, never assumed.')
    return {
      content: lines.join('\n'),
      citations: [best, ...others].map(toCite),
    }
  }

  // ── Fastest ─────────────────────────────────────────────────────────────────
  if (/fast|quick|soonest|deliver/.test(q)) {
    const withEta = shoppable.filter((o) => o.etaMinutes !== null || o.deliveryNote)
    if (!withEta.length) {
      return {
        content: 'None of the sources that returned verified results for this search supplied a delivery estimate, so I can’t rank by speed. I won’t guess one.',
        citations: shoppable.map(toCite),
      }
    }
    const fastest = withEta.sort((a, b) => (a.etaMinutes ?? 1e9) - (b.etaMinutes ?? 1e9))[0]
    return {
      content: ['**Fastest verified option**', '', withData(fastest)].join('\n'),
      citations: [toCite(fastest)],
    }
  }

  // ── Default: honest summary of what we have ─────────────────────────────────
  const best = summary.bestPrice!
  return {
    content: [
      `For “${result?.query}”, PriceRadar retrieved ${shoppable.length} verified offer(s) from ${new Set(shoppable.map((o) => o.sourceId)).size} source(s).`,
      '',
      withData(best),
      '',
      'Ask me “cheapest”, “fastest”, “is this a good price” or “which source is unavailable” — I answer only from this retrieved data.',
    ].join('\n'),
    citations: [toCite(best)],
  }
}

function toCite(o: Offer): AiCitation {
  return {
    sourceName: o.sourceName,
    merchant: o.merchant,
    price: o.price,
    currency: o.currency,
    productUrl: o.productUrl,
    retrievedAt: o.retrievedAt,
  }
}

/** Exposed for tests: the exact no-data reply text. */
export const noDataReply = NO_DATA_REPLY
