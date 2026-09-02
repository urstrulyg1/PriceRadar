// ─── Gateway client ───────────────────────────────────────────────────────────
// REAL DATA ACCESS, the honest way.
//
// PriceRadar NEVER talks to a shopping provider from the browser in a way that
// bypasses CORS, anti-bot protection, authentication or paywalls. Every
// upstream request goes to a same-origin `/api/*` route:
//
//   - in development, the Vite dev server proxies these routes to the real
//     public/authorized endpoints (see vite.config.ts);
//   - in production, a gateway (see gateway/server.mjs) or your reverse proxy
//     forwards them, optionally injecting server-side credentials.
//
// If the route is not there, sources report “unavailable” — they never fall
// back to invented data.

export type GatewayErrorKind =
  | 'unreachable'    // gateway/route missing (dev proxy or gateway down)
  | 'timeout'
  | 'rate_limited'
  | 'unauthorized'
  | 'not_found'
  | 'upstream'       // upstream returned an error status
  | 'bad_response'   // upstream replied with something we cannot parse

export class GatewayError extends Error {
  readonly kind: GatewayErrorKind
  readonly status: number
  constructor(kind: GatewayErrorKind, message: string, status = 0) {
    super(message)
    this.name = 'GatewayError'
    this.kind = kind
    this.status = status
  }
}

export interface GatewayOptions {
  timeoutMs?: number
  headers?: Record<string, string>
}

export async function gatewayJson<T = unknown>(path: string, options: GatewayOptions = {}): Promise<T> {
  const { timeoutMs = 9_000, headers } = options
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let res: Response
  try {
    res = await fetch(path, {
      signal: controller.signal,
      headers: { Accept: 'application/json', ...headers },
    })
  } catch (err) {
    clearTimeout(timer)
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new GatewayError('timeout', 'Upstream request timed out')
    }
    throw new GatewayError('unreachable', 'Data gateway is not reachable from this deployment')
  }
  clearTimeout(timer)

  if (res.status === 429) throw new GatewayError('rate_limited', 'Upstream rate limit reached', 429)
  if (res.status === 401 || res.status === 403) throw new GatewayError('unauthorized', 'Upstream rejected the credentials', res.status)
  if (res.status === 404) throw new GatewayError('not_found', 'No record found upstream', 404)
  if (!res.ok) throw new GatewayError('upstream', `Upstream returned HTTP ${res.status}`, res.status)

  try {
    return await res.json() as T
  } catch {
    throw new GatewayError('bad_response', 'Upstream returned a non-JSON response')
  }
}

/** URL-encode a query parameter. */
export function q(value: string | number | undefined | null): string {
  return encodeURIComponent(String(value ?? ''))
}
