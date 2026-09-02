// ─── Provider configuration (user-supplied credentials) ───────────────────────
// Credentials for authorized APIs are stored only on this device
// (localStorage) or injected server-side by the gateway (environment
// variables). They are never logged and never sent anywhere except the
// same-origin gateway route for the matching provider.

export interface CredentialField {
  key: string
  label: string
  placeholder: string
  hint: string
}

export interface CredentialSpec {
  /** localStorage namespace, e.g. `priceradar.creds.serpapi` */
  storageKey: string
  fields: CredentialField[]
}

export const CREDENTIAL_SPECS: Record<string, CredentialSpec> = {
  serpapi: {
    storageKey: 'priceradar.creds.serpapi',
    fields: [
      {
        key: 'apiKey',
        label: 'SerpApi key',
        placeholder: 'Your SerpApi API key',
        hint: 'From serpapi.com → API key. Used for Google Shopping results (authorized API, paid plan or free tier).',
      },
    ],
  },
  flipkart: {
    storageKey: 'priceradar.creds.flipkart',
    fields: [
      {
        key: 'affiliateId',
        label: 'Flipkart Affiliate ID',
        placeholder: 'e.g. yourname',
        hint: 'From the Flipkart Affiliate Program (affiliate.flipkart.com).',
      },
      {
        key: 'affiliateToken',
        label: 'Flipkart Affiliate token',
        placeholder: 'Your Fk-Affiliate-Token',
        hint: 'Partner token issued by the Flipkart Affiliate Program.',
      },
    ],
  },
}

export type Credentials = Record<string, string>

const listeners = new Set<() => void>()

function readSpec(spec: CredentialSpec): Credentials {
  try {
    const raw = localStorage.getItem(spec.storageKey)
    return raw ? JSON.parse(raw) as Credentials : {}
  } catch {
    return {}
  }
}

function writeSpec(spec: CredentialSpec, creds: Credentials): void {
  try {
    const hasValue = Object.values(creds).some((v) => v && v.trim())
    if (hasValue) localStorage.setItem(spec.storageKey, JSON.stringify(creds))
    else localStorage.removeItem(spec.storageKey)
  } catch {
    // storage unavailable (private mode) — credentials simply won't persist
  }
  listeners.forEach((fn) => fn())
}

export const providerConfig = {
  get(providerId: string): Credentials {
    const spec = CREDENTIAL_SPECS[providerId]
    return spec ? readSpec(spec) : {}
  },
  set(providerId: string, creds: Credentials): void {
    const spec = CREDENTIAL_SPECS[providerId]
    if (spec) writeSpec(spec, creds)
  },
  clear(providerId: string): void {
    const spec = CREDENTIAL_SPECS[providerId]
    if (spec) writeSpec(spec, {})
  },
  isConfigured(providerId: string): boolean {
    const spec = CREDENTIAL_SPECS[providerId]
    if (!spec) return false
    const creds = readSpec(spec)
    return spec.fields.every((f) => !!(creds[f.key] && creds[f.key].trim()))
  },
  /** Headers the gateway forwards to the upstream for this provider. */
  authHeaders(providerId: string): Record<string, string> {
    if (providerId === 'serpapi') {
      const key = this.get('serpapi').apiKey?.trim()
      return key ? { 'X-SerpApi-Key': key } : {}
    }
    if (providerId === 'flipkart') {
      const { affiliateId, affiliateToken } = this.get('flipkart')
      const headers: Record<string, string> = {}
      if (affiliateId?.trim()) headers['X-Fk-Affiliate-Id'] = affiliateId.trim()
      if (affiliateToken?.trim()) headers['X-Fk-Affiliate-Token'] = affiliateToken.trim()
      return headers
    }
    return {}
  },
  onChange(fn: () => void): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
}
