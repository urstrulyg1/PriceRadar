// ─── Provider registry ────────────────────────────────────────────────────────
// Queries every configured source concurrently, isolates failures, and
// reports an honest per-source status. A provider that fails, times out,
// lacks credentials, or has no authorized integration yields ZERO offers —
// the UI shows the reason, never a substitute value.

import type {
  Offer, OfferAdapter, ProviderResult, ProviderStatus, SearchContext,
} from '../domain/types'
import { ProviderUnavailableError } from '../domain/types'

const FAILURE_THRESHOLD = 3
const RECOVERY_WINDOW_MS = 60_000
const DEFAULT_TIMEOUT_MS = 10_000

export class ProviderRegistry {
  private readonly adapters = new Map<string, OfferAdapter>()
  private readonly failures = new Map<string, number>()
  private readonly lastFailureAt = new Map<string, number>()

  register(adapter: OfferAdapter): void {
    this.adapters.set(adapter.id, adapter)
  }

  registerAll(adapters: OfferAdapter[]): void {
    adapters.forEach((a) => this.register(a))
  }

  unregister(id: string): void {
    this.adapters.delete(id)
    this.failures.delete(id)
    this.lastFailureAt.delete(id)
  }

  list(): OfferAdapter[] {
    return [...this.adapters.values()]
  }

  /** Static status before any query: pending / needs auth / ready. */
  idleStatus(adapter: OfferAdapter): ProviderStatus {
    if (adapter.staticStatus) return adapter.staticStatus
    if (adapter.requiresAuth()) return 'auth_required'
    return 'connected'
  }

  private circuitOpen(id: string): boolean {
    const fails = this.failures.get(id) ?? 0
    if (fails < FAILURE_THRESHOLD) return false
    const last = this.lastFailureAt.get(id) ?? 0
    return Date.now() - last < RECOVERY_WINDOW_MS
  }

  private recordSuccess(id: string): void {
    this.failures.set(id, 0)
  }

  private recordFailure(id: string): void {
    this.failures.set(id, (this.failures.get(id) ?? 0) + 1)
    this.lastFailureAt.set(id, Date.now())
  }

  /**
   * Query all adapters. Never throws; always returns a result per adapter
   * with an honest status and zero offers on any failure.
   */
  async compare(ctx: SearchContext): Promise<ProviderResult[]> {
    const adapters = this.list()

    const settled = await Promise.all(
      adapters.map((adapter): Promise<ProviderResult> => this.queryOne(adapter, ctx)),
    )
    return settled
  }

  private async queryOne(adapter: OfferAdapter, ctx: SearchContext): Promise<ProviderResult> {
    const retrievedAt = Date.now()

    if (this.circuitOpen(adapter.id)) {
      return {
        sourceId: adapter.id,
        sourceName: adapter.name,
        status: 'temporarily_unavailable',
        offers: [],
        latencyMs: null,
        retrievedAt,
        error: 'Paused after repeated failures — will retry automatically',
      }
    }

    if (adapter.requiresAuth()) {
      return {
        sourceId: adapter.id,
        sourceName: adapter.name,
        status: 'auth_required',
        offers: [],
        latencyMs: null,
        retrievedAt,
        note: adapter.accessNote,
      }
    }

    const start = Date.now()
    try {
      const offers = await Promise.race([
        adapter.search(ctx),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new ProviderUnavailableError('temporarily_unavailable', 'Source timed out')), DEFAULT_TIMEOUT_MS),
        ),
      ])
      const latencyMs = Date.now() - start
      this.recordSuccess(adapter.id)
      return {
        sourceId: adapter.id,
        sourceName: adapter.name,
        status: 'live',
        offers,
        latencyMs,
        retrievedAt,
      }
    } catch (err) {
      this.recordFailure(adapter.id)
      const latencyMs = Date.now() - start
      if (err instanceof ProviderUnavailableError) {
        // `connected` + note = a deliberate skip (source not applicable to
        // this query), which is not a failure.
        if (err.status === 'connected') this.recordSuccess(adapter.id)
        return {
          sourceId: adapter.id,
          sourceName: adapter.name,
          status: err.status,
          offers: [],
          latencyMs,
          retrievedAt,
          note: err.status === 'connected' ? err.message : undefined,
          error: err.status === 'connected' ? undefined : err.message,
        }
      }
      return {
        sourceId: adapter.id,
        sourceName: adapter.name,
        status: 'error',
        offers: [],
        latencyMs,
        retrievedAt,
        error: err instanceof Error ? err.message : 'Unknown source failure',
      }
    }
  }
}

export function createRegistry(adapters: OfferAdapter[] = []): ProviderRegistry {
  const registry = new ProviderRegistry()
  registry.registerAll(adapters)
  return registry
}
