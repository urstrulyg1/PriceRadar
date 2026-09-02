import type { DeliveryMode, Offer, Provider, ProviderAdapter } from '../domain/types'

export type ProviderStatus = 'connected' | 'temporarily_unavailable' | 'not_serviceable'

export interface ProviderResult {
  provider: Provider
  status: ProviderStatus
  offers: Offer[]
  error?: string
}

/**
 * Provider adapters are deliberately isolated from the comparison UI. Each
 * connector can use an official API, affiliate feed, or approved partner
 * endpoint without changing the normalized Offer shape or ranking engine.
 */
export class ProviderRegistry {
  private readonly adapters = new Map<string, ProviderAdapter>()

  register(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.provider.id, adapter)
  }

  unregister(providerId: string): void {
    this.adapters.delete(providerId)
  }

  list(mode?: DeliveryMode): Provider[] {
    return [...this.adapters.values()]
      .filter((adapter) => !mode || adapter.supportedModes.includes(mode))
      .map((adapter) => adapter.provider)
  }

  async compare(query: string, location: string, mode?: DeliveryMode): Promise<ProviderResult[]> {
    const adapters = [...this.adapters.values()].filter((adapter) => !mode || adapter.supportedModes.includes(mode))
    const results = await Promise.allSettled(adapters.map(async (adapter) => ({ provider: adapter.provider, offers: await adapter.search(query, location) })))

    return results.map((result, index) => {
      const adapter = adapters[index]
      if (result.status === 'fulfilled') return { ...result.value, status: 'connected' as const }
      return { provider: adapter.provider, offers: [], status: 'temporarily_unavailable' as const, error: result.reason instanceof Error ? result.reason.message : 'Provider did not respond' }
    })
  }
}

export function createRegistry(adapters: ProviderAdapter[] = []): ProviderRegistry {
  const registry = new ProviderRegistry()
  adapters.forEach((adapter) => registry.register(adapter))
  return registry
}
