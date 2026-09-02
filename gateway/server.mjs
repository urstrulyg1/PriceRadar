#!/usr/bin/env node
// ─── PriceRadar production gateway ────────────────────────────────────────────
// Zero-dependency Node (18+) server for running the built app with REAL data:
//
//   - serves the static bundle from dist/
//   - forwards the same-origin /api/* routes PriceRadar's adapters call to
//     their real upstream APIs (strict allowlist, no arbitrary proxying)
//   - can inject provider credentials from environment variables so keys
//     never need to live in the browser:
//         SERPAPI_KEY, FK_AFFILIATE_ID, FK_AFFILIATE_TOKEN
//
// Usage:  npm run build && node gateway/server.mjs   (PORT optional, default 8080)
//
// This is an authorized-data gateway only. It does not scrape, bypass
// anti-bot systems, or transform responses — it forwards requests and
// returns exactly what the upstream answered.

import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize } from 'node:path'
import { Readable } from 'node:stream'

const PORT = Number(process.env.PORT ?? 8080)
const DIST = join(process.cwd(), 'dist')
const UPSTREAM_TIMEOUT_MS = 12_000

// Strict route allowlist — path prefix → upstream origin.
const ROUTES = [
  { prefix: '/api/openfoodfacts', origin: 'https://world.openfoodfacts.org' },
  { prefix: '/api/openprices', origin: 'https://prices.openfoodfacts.org' },
  { prefix: '/api/upcitemdb', origin: 'https://api.upcitemdb.com' },
  { prefix: '/api/serpapi', origin: 'https://serpapi.com' },
  { prefix: '/api/flipkart', origin: 'https://affiliate-api.flipkart.net' },
]

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

function injectCredentials(route, url, headers) {
  // Server-side key injection (optional). Browser-supplied values win so the
  // per-user keys stored locally keep working.
  if (route.prefix === '/api/serpapi' && process.env.SERPAPI_KEY && !url.searchParams.has('api_key')) {
    url.searchParams.set('api_key', process.env.SERPAPI_KEY)
  }
  if (route.prefix === '/api/flipkart') {
    if (process.env.FK_AFFILIATE_ID && !headers['fk-affiliate-id']) headers['fk-affiliate-id'] = process.env.FK_AFFILIATE_ID
    if (process.env.FK_AFFILIATE_TOKEN && !headers['fk-affiliate-token']) headers['fk-affiliate-token'] = process.env.FK_AFFILIATE_TOKEN
  }
}

async function proxy(req, res, route) {
  const url = new URL(req.url, 'http://localhost')
  const upstream = new URL(route.origin + url.pathname.slice(route.prefix.length) + url.search)
  const headers = {}
  for (const [key, value] of Object.entries(req.headers)) {
    if (['host', 'connection', 'origin', 'referer', 'cookie', 'accept-encoding'].includes(key)) continue
    if (typeof value === 'string') headers[key] = value
  }
  headers['user-agent'] = headers['user-agent'] ?? 'PriceRadar-Gateway/1.0'
  injectCredentials(route, upstream, headers)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  try {
    const upstreamRes = await fetch(upstream, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : Readable.toWeb(req),
      signal: controller.signal,
      redirect: 'follow',
    })
    clearTimeout(timer)
    res.writeHead(upstreamRes.status, {
      'content-type': upstreamRes.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-store',
    })
    if (upstreamRes.body) Readable.fromWeb(upstreamRes.body).pipe(res)
    else res.end()
  } catch (err) {
    clearTimeout(timer)
    res.writeHead(502, { 'content-type': 'application/json' })
    res.end(JSON.stringify({
      error: 'gateway_upstream_unreachable',
      message: `Upstream ${route.origin} is unreachable from this gateway`,
    }))
  }
}

async function serveStatic(req, res) {
  let path = normalize(decodeURIComponent(new URL(req.url, 'http://localhost').pathname))
  if (path === '/' || path === '') path = '/index.html'
  const file = join(DIST, path)
  if (!file.startsWith(DIST)) {
    res.writeHead(403).end('Forbidden')
    return
  }
  try {
    const info = await stat(file)
    const finalPath = info.isDirectory() ? join(file, 'index.html') : file
    const body = await readFile(finalPath)
    res.writeHead(200, {
      'content-type': MIME[extname(finalPath)] ?? 'application/octet-stream',
      'cache-control': finalPath.endsWith('.html') ? 'no-store' : 'public, max-age=3600',
    })
    res.end(body)
  } catch {
    // SPA fallback
    try {
      const body = await readFile(join(DIST, 'index.html'))
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
      res.end(body)
    } catch {
      res.writeHead(404).end('Build not found — run `npm run build` first.')
    }
  }
}

createServer((req, res) => {
  const route = ROUTES.find((r) => req.url.startsWith(r.prefix))
  if (route) return proxy(req, res, route)
  return serveStatic(req, res)
}).listen(PORT, '0.0.0.0', () => {
  console.log(`PriceRadar gateway listening on http://0.0.0.0:${PORT}`)
  console.log('Authorized /api routes:', ROUTES.map((r) => r.prefix).join(', '))
  console.log('Server-side credential injection:',
    process.env.SERPAPI_KEY ? 'SERPAPI_KEY set' : 'SERPAPI_KEY not set',
    '|',
    process.env.FK_AFFILIATE_ID ? 'FK credentials set' : 'FK credentials not set')
})
