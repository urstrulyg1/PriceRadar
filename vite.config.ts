import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev-time routing for authorized data sources. All adapter requests go to
// same-origin /api/* paths; this proxy forwards them to the real public /
// authorized endpoints. In production the same routes are served by
// gateway/server.mjs (or your own reverse proxy) — see README.
const UPSTREAMS: Record<string, string> = {
  '/api/openfoodfacts': 'https://world.openfoodfacts.org',
  '/api/openprices': 'https://prices.openfoodfacts.org',
  '/api/upcitemdb': 'https://api.upcitemdb.com',
  '/api/serpapi': 'https://serpapi.com',
  '/api/flipkart': 'https://affiliate-api.flipkart.net',
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: Object.fromEntries(
      Object.entries(UPSTREAMS).map(([path, target]) => [
        path,
        {
          target,
          changeOrigin: true,
          rewrite: (p: string) => p.replace(path, ''),
          headers: { 'User-Agent': 'PriceRadar/0.2 (+real-data-only price comparison)' },
        },
      ]),
    ),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'charts': ['recharts'],
          'icons': ['lucide-react'],
        },
      },
    },
  },
})
