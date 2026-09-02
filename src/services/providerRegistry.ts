import type { DeliveryMode, Offer, Provider, ProviderAdapter, ProviderHealth } from '../domain/types'

export type ProviderStatus = 'connected' | 'temporarily_unavailable' | 'not_serviceable'

export interface ProviderResult {
  provider: Provider
  status: ProviderStatus
  offers: Offer[]
  latencyMs: number
  error?: string
}

/**
 * ProviderRegistry isolates provider failures from the UI and comparison engine.
 *
 * - All providers are queried concurrently via Promise.allSettled().
 * - A single provider timeout/error never breaks the comparison.
 * - Results are annotated with provider status so the UI can show
 *   "Provider X is temporarily unavailable" without crashing.
 *
 * Circuit-breaker state: after FAILURE_THRESHOLD consecutive failures the
 * provider is placed in 'temporarily_unavailable' without being queried.
 * It is re-tried after RECOVERY_WINDOW_MS.
 */
export class ProviderRegistry {
  private static readonly FAILURE_THRESHOLD = 3
  private static readonly RECOVERY_WINDOW_MS = 60_000 // 1 minute
  private static readonly DEFAULT_TIMEOUT_MS = 8_000  // 8 seconds per provider

  private readonly adapters = new Map<string, ProviderAdapter>()
  private readonly failures = new Map<string, number>()
  private readonly lastFailureTime = new Map<string, number>()
  private readonly latencyHistory = new Map<string, number[]>()

  register(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.provider.id, adapter)
  }

  unregister(providerId: string): void {
    this.adapters.delete(providerId)
    this.failures.delete(providerId)
    this.lastFailureTime.delete(providerId)
  }

  list(mode?: DeliveryMode): Provider[] {
    return [...this.adapters.values()]
      .filter((a) => !mode || a.supportedModes.includes(mode))
      .map((a) => a.provider)
  }

  /** Health snapshot for all registered providers */
  health(): ProviderHealth[] {
    return [...this.adapters.values()].map((a) => {
      const failCount = this.failures.get(a.provider.id) ?? 0
      const lastFail = this.lastFailureTime.get(a.provider.id) ?? 0
      const inCooldown = failCount >= ProviderRegistry.FAILURE_THRESHOLD &&
        Date.now() - lastFail < ProviderRegistry.RECOVERY_WINDOW_MS
      const latencies = this.latencyHistory.get(a.provider.id) ?? []
      const avgLatency = latencies.length
        ? Math.round(latencies.reduce((s, l) => s + l, 0) / latencies.length)
        : undefined
      return {
        provider: a.provider,
        status: inCooldown ? 'temporarily_unavailable' : 'connected',
        latencyMs: avgLatency,
        lastChecked: lastFail || Date.now(),
        error: inCooldown ? `${failCount} consecutive failures` : undefined,
      } satisfies ProviderHealth
    })
  }

  private isCircuitOpen(providerId: string): boolean {
    const fails = this.failures.get(providerId) ?? 0
    if (fails < ProviderRegistry.FAILURE_THRESHOLD) return false
    const last = this.lastFailureTime.get(providerId) ?? 0
    return Date.now() - last < ProviderRegistry.RECOVERY_WINDOW_MS
  }

  private recordSuccess(providerId: string): void {
    this.failures.set(providerId, 0)
  }

  private recordFailure(providerId: string): void {
    this.failures.set(providerId, (this.failures.get(providerId) ?? 0) + 1)
    this.lastFailureTime.set(providerId, Date.now())
  }

  private recordLatency(providerId: string, ms: number): void {
    const history = this.latencyHistory.get(providerId) ?? []
    history.push(ms)
    if (history.length > 20) history.shift()
    this.latencyHistory.set(providerId, history)
  }

  /**
   * Query all matching adapters concurrently with timeouts.
   * Never throws — partial results are always returned.
   */
  async compare(query: string, location: string, mode?: DeliveryMode): Promise<ProviderResult[]> {
    const adapters = [...this.adapters.values()].filter(
      (a) => !mode || a.supportedModes.includes(mode)
    )

    const results = await Promise.allSettled(
      adapters.map(async (adapter): Promise<ProviderResult> => {
        const id = adapter.provider.id

        // Circuit breaker check
        if (this.isCircuitOpen(id)) {
          return {
            provider: adapter.provider,
            status: 'temporarily_unavailable',
            offers: [],
            latencyMs: 0,
            error: 'Circuit open — provider temporarily suspended after repeated failures',
          }
        }

        const start = Date.now()
        try {
          const offers = await Promise.race([
            adapter.search(query, location),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Provider timeout')), ProviderRegistry.DEFAULT_TIMEOUT_MS)
            ),
          ])
          const latencyMs = Date.now() - start
          this.recordSuccess(id)
          this.recordLatency(id, latencyMs)
          return { provider: adapter.provider, status: 'connected', offers, latencyMs }
        } catch (err) {
          const latencyMs = Date.now() - start
          this.recordFailure(id)
          this.recordLatency(id, latencyMs)
          const error = err instanceof Error ? err.message : 'Unknown provider error'
          console.error(`[ProviderRegistry] ${id} failed: ${error}`)
          return { provider: adapter.provider, status: 'temporarily_unavailable', offers: [], latencyMs, error }
        }
      })
    )

    return results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value
      // Promise.allSettled should never reject since we catch inside, but handle defensively
      return {
        provider: adapters[i].provider,
        status: 'temporarily_unavailable' as const,
        offers: [],
        latencyMs: 0,
        error: 'Unexpected registry error',
      }
    })
  }
}

export const globalRegistry = new ProviderRegistry()

export function createRegistry(adapters: ProviderAdapter[] = []): ProviderRegistry {
  const registry = new ProviderRegistry()
  adapters.forEach((a) => registry.register(a))
  return registry
}
