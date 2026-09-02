import {
  useCallback, useEffect, useMemo, useRef, useState,
  type CSSProperties, type FormEvent, type KeyboardEvent, type ReactNode,
} from 'react'
import {
  AlertCircle, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight,
  Bell, BellRing, Check, ChevronDown, ChevronRight, ChevronUp,
  CircleHelp, Clock3, Copy, ExternalLink, Eye, Filter, Gift,
  Globe2, Heart, History, Info, LayoutDashboard, ListFilter,
  MapPin, Menu, Minus, Moon, MoreHorizontal, PackageCheck,
  PanelLeftClose, Plus, RefreshCw, Radar, Search, Settings2,
  Share2, ShieldCheck, ShoppingBag, Sparkles, Star, Sun, Tag,
  TrendingDown, TrendingUp, Truck, Users, WalletCards, X, Zap,
} from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  catalog, defaultProduct, findProduct, generateAiResponse,
  parseQuery, providers,
} from './data/catalog'
import {
  buildFeeRows, discountPercent, finalPrice, formatRupees,
  matchLevelToConfidence, priceInsight, sortOffers, summarize,
} from './domain/compare'
import type {
  AiMessage, DeliveryMode, MatchLevel, Offer, PriceAlert,
  Product, SearchHistoryEntry, WishlistItem,
} from './domain/types'

// ─── Local types ──────────────────────────────────────────────────────────────
type Mode = DeliveryMode | 'all'
type ViewId = 'compare' | 'overview' | 'alerts' | 'wishlist' | 'history'
type SortKey = 'overall' | 'price' | 'speed' | 'discount' | 'rating'
type FilterState = {
  priceMin: string; priceMax: string;
  providers: string[];
  availability: boolean; exactOnly: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const NAV_ITEMS: Array<{ id: ViewId; label: string; icon: typeof Radar }> = [
  { id: 'compare',  label: 'Compare prices',  icon: Radar },
  { id: 'overview', label: 'Overview',         icon: LayoutDashboard },
  { id: 'alerts',   label: 'Price alerts',     icon: BellRing },
  { id: 'wishlist', label: 'Wishlist',         icon: Heart },
  { id: 'history',  label: 'Search history',  icon: History },
]

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'overall',  label: 'Best overall' },
  { value: 'price',    label: 'Lowest price' },
  { value: 'speed',    label: 'Fastest delivery' },
  { value: 'discount', label: 'Biggest discount' },
  { value: 'rating',   label: 'Highest rated' },
]

const LOCATIONS = [
  'Koramangala, Bengaluru',
  'Indiranagar, Bengaluru',
  'HSR Layout, Bengaluru',
  'Whitefield, Bengaluru',
  'Bandra, Mumbai',
]

const SEARCH_SUGGESTIONS = [
  { label: 'iPhone 16 128GB black', hint: 'Mobiles' },
  { label: 'AirPods Pro 2',          hint: 'Audio' },
  { label: 'cheapest shampoo near me', hint: 'Personal care' },
  { label: 'basmati rice 5kg',        hint: 'Groceries' },
  { label: 'detergent under ₹300',   hint: 'Household' },
]

const AI_QUICK_PROMPTS = [
  'Find the cheapest iPhone 16 near me',
  'Detergent under ₹300 delivered in 30 min',
  'Is this a good price right now?',
  'Best shampoo under ₹500',
]

const INITIAL_ALERTS: PriceAlert[] = [
  { id: 'a1', productId: 'amul-taaza-1l',         productName: 'Amul Taaza Milk 1L',                targetPrice: 55,    currentBest: 67,    status: 'active',    createdAt: '2025-08-28' },
  { id: 'a2', productId: 'iphone-16-128-black',   productName: 'iPhone 16 128GB Black',              targetPrice: 68000, currentBest: 69499, status: 'active',    createdAt: '2025-08-25' },
  { id: 'a3', productId: 'airpods-pro-2-usbc',    productName: 'AirPods Pro 2 USB-C',               targetPrice: 17500, currentBest: 18499, status: 'active',    createdAt: '2025-08-20' },
]

const INITIAL_WISHLIST: WishlistItem[] = catalog.map((p) => ({ productId: p.id, addedAt: '2025-08-15' }))

const INITIAL_HISTORY: SearchHistoryEntry[] = [
  { query: 'Amul Taaza Milk 1L',        productId: 'amul-taaza-1l',          timestamp: '2025-09-02T10:42:00', offerCount: 6, bestTotal: 67 },
  { query: 'iPhone 16 128GB black',     productId: 'iphone-16-128-black',    timestamp: '2025-09-01T20:16:00', offerCount: 5, bestTotal: 69499 },
  { query: 'AirPods Pro 2',             productId: 'airpods-pro-2-usbc',     timestamp: '2025-08-28T16:02:00', offerCount: 3, bestTotal: 18499 },
  { query: 'Head & Shoulders shampoo',  productId: 'head-shoulders-650',     timestamp: '2025-08-24T11:28:00', offerCount: 5, bestTotal: 400 },
  { query: 'basmati rice 5kg',          productId: 'india-gate-basmati-5kg', timestamp: '2025-08-22T09:10:00', offerCount: 4, bestTotal: 453 },
]

// ─── Utility ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2)

function fmtRelTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  // Views
  const [activeView, setActiveView] = useState<ViewId>('compare')

  // Search
  const [query, setQuery] = useState('Amul Taaza Milk 1L')
  const [product, setProduct] = useState<Product>(defaultProduct)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  // Mode & filters
  const [mode, setMode] = useState<Mode>('instant')
  const [sort, setSort] = useState<SortKey>('overall')
  const [filters, setFilters] = useState<FilterState>({
    priceMin: '', priceMax: '', providers: [], availability: false, exactOnly: true,
  })
  const [showFilters, setShowFilters] = useState(false)

  // UI state
  const [location, setLocation] = useState(LOCATIONS[0])
  const [locationOpen, setLocationOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null)
  const [alertOpen, setAlertOpen] = useState(false)
  const [alertPrice, setAlertPrice] = useState('')

  // Toast
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'info' | 'error' } | null>(null)

  // AI
  const [aiOpen, setAiOpen] = useState(false)
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([])
  const [aiDraft, setAiDraft] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const aiEndRef = useRef<HTMLDivElement>(null)

  // Alerts & wishlist
  const [alerts, setAlerts] = useState<PriceAlert[]>(INITIAL_ALERTS)
  const [wishlist, setWishlist] = useState<WishlistItem[]>(INITIAL_WISHLIST)
  const [history, setHistory] = useState<SearchHistoryEntry[]>(INITIAL_HISTORY)
  const [providerFilter, setProviderFilter] = useState('all')

  // ── Derived state ───────────────────────────────────────────────────────────

  const isSaved = wishlist.some((w) => w.productId === product.id)

  const modeOffers = useMemo(() => {
    let offers = product.offers.filter((o) => mode === 'all' || o.mode === mode)
    if (providerFilter !== 'all') offers = offers.filter((o) => o.provider.id === providerFilter)
    return offers
  }, [mode, product, providerFilter])

  const filteredOffers = useMemo(() => {
    let offers = modeOffers
    if (filters.exactOnly) offers = offers.filter((o) => o.match === 'exact' || o.match === 'likely')
    if (filters.availability) offers = offers.filter((o) => o.availability === 'in_stock')
    if (filters.priceMin) offers = offers.filter((o) => (finalPrice(o) ?? 0) >= Number(filters.priceMin))
    if (filters.priceMax) offers = offers.filter((o) => (finalPrice(o) ?? Infinity) <= Number(filters.priceMax))
    if (filters.providers.length) offers = offers.filter((o) => filters.providers.includes(o.provider.id))
    return sortOffers(offers, sort)
  }, [modeOffers, filters, sort])

  const summary = useMemo(() => summarize(filteredOffers), [filteredOffers])

  const instantCount = product.offers.filter((o) => o.mode === 'instant').length
  const normalCount  = product.offers.filter((o) => o.mode === 'normal').length
  const connectedCount = providers.filter((p) => p.isConnected).length

  // ── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3400)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  useEffect(() => {
    aiEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [aiMessages, aiLoading])

  // ── Actions ─────────────────────────────────────────────────────────────────

  const showToast = (msg: string, type: 'success' | 'info' | 'error' = 'info') => setToast({ msg, type })

  const runSearch = useCallback((q: string) => {
    const nextProduct = findProduct(q)
    setQuery(q)
    setProduct(nextProduct)
    setActiveView('compare')
    setProviderFilter('all')
    setSearchOpen(false)
    setMode(nextProduct.offers.some((o) => o.mode === 'instant') ? 'instant' : 'normal')
    // Add to history
    const fp = Math.min(...nextProduct.offers.map((o) => finalPrice(o) ?? Infinity))
    setHistory((prev) => [
      { query: q, productId: nextProduct.id, timestamp: new Date().toISOString(), offerCount: nextProduct.offers.length, bestTotal: isFinite(fp) ? fp : undefined },
      ...prev.filter((h) => h.query !== q),
    ].slice(0, 20))
    showToast(`Comparing ${nextProduct.name}`, 'success')
  }, [])

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (query.trim()) runSearch(query.trim())
  }

  const chooseLocation = (loc: string) => {
    setLocation(loc)
    setLocationOpen(false)
    showToast(`Showing availability around ${loc.split(',')[0]}`, 'info')
  }

  const refreshOffers = () => {
    setIsRefreshing(true)
    setTimeout(() => {
      setIsRefreshing(false)
      showToast('All connected sources refreshed', 'success')
    }, 1100)
  }

  const shareComparison = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      showToast('Comparison link copied', 'success')
    } catch {
      showToast('Share link ready', 'info')
    }
  }

  const toggleWishlist = () => {
    if (isSaved) {
      setWishlist((w) => w.filter((i) => i.productId !== product.id))
      showToast('Removed from wishlist', 'info')
    } else {
      setWishlist((w) => [...w, { productId: product.id, addedAt: new Date().toISOString() }])
      showToast('Saved to wishlist', 'success')
    }
  }

  const saveAlert = (price: number) => {
    const existing = alerts.findIndex((a) => a.productId === product.id)
    const best = Math.min(...product.offers.map((o) => finalPrice(o) ?? Infinity))
    const newAlert: PriceAlert = {
      id: uid(), productId: product.id, productName: product.name,
      targetPrice: price, currentBest: isFinite(best) ? best : 0,
      status: 'active', createdAt: new Date().toISOString(),
    }
    if (existing >= 0) {
      setAlerts((a) => a.map((item, i) => i === existing ? newAlert : item))
    } else {
      setAlerts((a) => [newAlert, ...a])
    }
    setAlertOpen(false)
    showToast(`Alert set — we'll notify you when ${product.name} drops below ₹${price.toLocaleString('en-IN')}`, 'success')
  }

  const submitAiPrompt = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!aiDraft.trim() || aiLoading) return
    const userMsg: AiMessage = { id: uid(), role: 'user', content: aiDraft.trim(), timestamp: Date.now() }
    setAiMessages((m) => [...m, userMsg])
    setAiDraft('')
    setAiLoading(true)
    // Simulate network latency while building grounded response
    await new Promise((r) => setTimeout(r, 750 + Math.random() * 500))
    const { response, product: linkedProduct } = generateAiResponse(userMsg.content, product)
    const assistantMsg: AiMessage = {
      id: uid(), role: 'assistant', content: response,
      timestamp: Date.now(), linkedProduct,
    }
    setAiMessages((m) => [...m, assistantMsg])
    setAiLoading(false)
    // If AI found a different product, navigate to it
    if (linkedProduct.id !== product.id) {
      runSearch(linkedProduct.searchTerms[0])
    }
  }

  const useAiPrompt = (prompt: string) => {
    setAiDraft(prompt)
  }

  const changeView = (view: ViewId) => {
    setActiveView(view)
    setSidebarOpen(false)
  }

  const openAlertFor = (p: Product) => {
    const best = Math.min(...p.offers.map((o) => finalPrice(o) ?? Infinity))
    setAlertPrice(isFinite(best) ? String(Math.round(best * 0.9)) : '')
    setAlertOpen(true)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={`app-shell${darkMode ? ' dark-mode' : ''}`}>
      {/* ── Sidebar ── */}
      <aside className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`} aria-label="Main navigation">
        <div className="brand-row">
          <div className="brand-lockup">
            <span className="brand-mark"><Radar size={20} strokeWidth={2.6} /></span>
            <span className="brand-name">Price<span>Radar</span></span>
          </div>
          <button className="icon-button sidebar-close" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}>
            <PanelLeftClose size={18} />
          </button>
        </div>

        <button className="sidebar-location" onClick={() => setLocationOpen(true)} aria-label="Change location">
          <span className="sidebar-location-icon"><MapPin size={14} /></span>
          <span className="sidebar-location-text">
            <span>Shopping around</span>
            <strong>{location.split(',')[0]}</strong>
          </span>
          <ChevronRight size={15} />
        </button>

        <nav aria-label="Workspace navigation">
          <p className="side-label">Workspace</p>
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const badge = id === 'alerts' ? alerts.filter((a) => a.status === 'active').length
              : id === 'wishlist' ? wishlist.length : 0
            return (
              <button
                key={id}
                className={`nav-item${activeView === id ? ' active' : ''}`}
                onClick={() => changeView(id)}
                aria-current={activeView === id ? 'page' : undefined}
              >
                <Icon size={18} strokeWidth={activeView === id ? 2.4 : 2} />
                <span>{label}</span>
                {badge > 0 && <span className="nav-badge" aria-label={`${badge} items`}>{badge}</span>}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-spacer" />

        {/* Provider health */}
        <div className="source-health">
          <div className="health-topline">
            <span className="pulse-dot" aria-hidden="true" />
            <span>Source health</span>
            <MoreHorizontal size={15} />
          </div>
          <strong>All systems normal</strong>
          <p><span>{connectedCount}</span> providers active</p>
          <div className="health-bars" aria-hidden="true">
            {[7, 13, 10, 8, 17, 9, 12, 8, 11, 7].map((h, i) => (
              <i key={i} style={{ height: `${h}px`, background: i === 4 ? 'var(--lime)' : '#58a980' }} />
            ))}
          </div>
          <button onClick={() => showToast('Provider management is coming in the next release', 'info')}>
            Manage sources <ArrowUpRight size={13} />
          </button>
        </div>

        <div className="sidebar-user">
          <div className="user-avatar" aria-hidden="true">AK</div>
          <div className="user-copy">
            <strong>Arjun Kapoor</strong>
            <span>Personal account</span>
          </div>
          <Settings2 size={16} />
        </div>
      </aside>

      {sidebarOpen && (
        <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Main ── */}
      <main className="main-content">

        {/* ── Topbar ── */}
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}>
            <Menu size={21} />
          </button>

          <div className="topbar-location-wrap">
            <button className="topbar-location" onClick={() => setLocationOpen((v) => !v)} aria-expanded={locationOpen}>
              <span className="location-pin"><MapPin size={15} fill="currentColor" /></span>
              <span>
                <small>Deliver to</small>
                <strong>{location}</strong>
              </span>
              <ChevronDown size={15} />
            </button>

            {locationOpen && (
              <div className="location-menu" role="dialog" aria-label="Choose location">
                <div className="location-menu-header">
                  <span>Your locations</span>
                  <button onClick={() => setLocationOpen(false)} aria-label="Close"><X size={14} /></button>
                </div>
                {LOCATIONS.map((loc) => (
                  <button
                    key={loc}
                    className={loc === location ? 'selected' : ''}
                    onClick={() => chooseLocation(loc)}
                  >
                    <MapPin size={14} />
                    {loc}
                    {loc === location && <Check size={14} />}
                  </button>
                ))}
                <button className="add-location" onClick={() => showToast('Manual pincode entry coming soon', 'info')}>
                  <Plus size={14} /> Add location or pincode
                </button>
              </div>
            )}
          </div>

          <div className="topbar-actions">
            <div className="live-source-pill" aria-label="All sources live">
              <span className="pulse-dot" aria-hidden="true" />
              All sources live
            </div>

            <button
              className="ask-ai-button"
              onClick={() => setAiOpen(true)}
              aria-label="Open AI shopping assistant"
            >
              <Sparkles size={14} />
              Ask AI
            </button>

            <button
              className={`icon-button refresh-button${isRefreshing ? ' refreshing' : ''}`}
              onClick={refreshOffers}
              aria-label="Refresh all prices"
              title="Refresh prices"
            >
              <RefreshCw size={17} />
            </button>

            <button
              className="icon-button"
              onClick={() => setDarkMode((d) => !d)}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <div className="topbar-avatar" aria-hidden="true">AK</div>
          </div>
        </header>

        {/* ── Views ── */}
        {activeView === 'compare' && (
          <CompareView
            query={query}
            setQuery={setQuery}
            product={product}
            mode={mode}
            setMode={setMode}
            sort={sort}
            setSort={setSort}
            filters={filters}
            setFilters={setFilters}
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            providerFilter={providerFilter}
            setProviderFilter={setProviderFilter}
            filteredOffers={filteredOffers}
            summary={summary}
            instantCount={instantCount}
            normalCount={normalCount}
            isSaved={isSaved}
            searchOpen={searchOpen}
            setSearchOpen={setSearchOpen}
            searchRef={searchRef}
            onSearch={handleSearch}
            onRun={runSearch}
            onRefresh={refreshOffers}
            onShare={shareComparison}
            onWishlist={toggleWishlist}
            onSetAlert={() => {
              const best = Math.min(...product.offers.map((o) => finalPrice(o) ?? Infinity))
              setAlertPrice(isFinite(best) ? String(Math.round(best * 0.9)) : '')
              setAlertOpen(true)
            }}
            onSelectOffer={setSelectedOffer}
            isRefreshing={isRefreshing}
          />
        )}

        {activeView === 'overview' && (
          <OverviewView
            catalog={catalog}
            alerts={alerts}
            wishlist={wishlist}
            onProduct={(p) => { setProduct(p); setQuery(p.name); setActiveView('compare'); setMode(p.offers.some((o) => o.mode === 'instant') ? 'instant' : 'normal') }}
            onSetAlert={openAlertFor}
          />
        )}

        {activeView === 'alerts' && (
          <AlertsView
            alerts={alerts}
            catalog={catalog}
            onDelete={(id) => { setAlerts((a) => a.filter((x) => x.id !== id)); showToast('Alert deleted', 'info') }}
            onAdd={() => { setProduct(defaultProduct); setActiveView('compare') }}
            onCompare={(productId) => {
              const p = catalog.find((c) => c.id === productId)
              if (p) { setProduct(p); setQuery(p.name); setActiveView('compare') }
            }}
          />
        )}

        {activeView === 'wishlist' && (
          <WishlistView
            wishlist={wishlist}
            catalog={catalog}
            onProduct={(p) => { setProduct(p); setQuery(p.name); setActiveView('compare') }}
            onRemove={(id) => { setWishlist((w) => w.filter((i) => i.productId !== id)); showToast('Removed from wishlist', 'info') }}
          />
        )}

        {activeView === 'history' && (
          <HistoryView
            history={history}
            catalog={catalog}
            onSearch={(q) => runSearch(q)}
            onClear={() => { setHistory([]); showToast('Search history cleared', 'info') }}
          />
        )}
      </main>

      {/* ── Modals ── */}
      {selectedOffer && (
        <OfferModal
          offer={selectedOffer}
          onClose={() => setSelectedOffer(null)}
        />
      )}

      {alertOpen && (
        <AlertModal
          product={product}
          price={alertPrice}
          setPrice={setAlertPrice}
          existingAlert={alerts.find((a) => a.productId === product.id)}
          onClose={() => setAlertOpen(false)}
          onSave={() => {
            const p = Number(alertPrice)
            if (p > 0) saveAlert(p)
          }}
        />
      )}

      {aiOpen && (
        <AiPanel
          messages={aiMessages}
          draft={aiDraft}
          setDraft={setAiDraft}
          loading={aiLoading}
          endRef={aiEndRef}
          onClose={() => setAiOpen(false)}
          onSubmit={submitAiPrompt}
          onPrompt={useAiPrompt}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className={`toast toast-${toast.type ?? 'info'}`} role="status" aria-live="polite">
          {toast.type === 'success' && <Check size={15} />}
          {toast.type === 'error'   && <AlertCircle size={15} />}
          {(!toast.type || toast.type === 'info') && <Info size={15} />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}

// ─── Compare View ─────────────────────────────────────────────────────────────

interface CompareViewProps {
  query: string; setQuery: (q: string) => void
  product: Product; mode: Mode; setMode: (m: Mode) => void
  sort: SortKey; setSort: (s: SortKey) => void
  filters: FilterState; setFilters: (f: FilterState) => void
  showFilters: boolean; setShowFilters: (v: boolean) => void
  providerFilter: string; setProviderFilter: (v: string) => void
  filteredOffers: Offer[]; summary: ReturnType<typeof summarize>
  instantCount: number; normalCount: number
  isSaved: boolean; searchOpen: boolean; setSearchOpen: (v: boolean) => void
  searchRef: React.RefObject<HTMLInputElement>
  onSearch: (e: FormEvent<HTMLFormElement>) => void
  onRun: (q: string) => void; onRefresh: () => void; onShare: () => void
  onWishlist: () => void; onSetAlert: () => void
  onSelectOffer: (o: Offer) => void; isRefreshing: boolean
}

function CompareView({
  query, setQuery, product, mode, setMode, sort, setSort,
  filters, setFilters, showFilters, setShowFilters,
  providerFilter, setProviderFilter,
  filteredOffers, summary, instantCount, normalCount,
  isSaved, searchOpen, setSearchOpen, searchRef,
  onSearch, onRun, onRefresh, onShare, onWishlist, onSetAlert,
  onSelectOffer, isRefreshing,
}: CompareViewProps) {
  const insight = priceInsight(product.priceHistory, product.priceHistory.points[product.priceHistory.points.length - 1]?.price ?? 0)
  const disconnectedProviders = providers.filter((p) => !p.isConnected)
  const activeProviderIds = [...new Set(product.offers.filter((o) => mode === 'all' || o.mode === mode).map((o) => o.provider.id))]

  return (
    <>
      {/* Hero & Search */}
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="eyebrow-spark"><Sparkles size={11} /></span>
            AI-powered price comparison
          </p>
          <h1>
            One product.<br />
            <em>Every price.</em>{' '}
            <span>One smart choice.</span>
          </h1>
          <p className="hero-description">
            PriceRadar compares the true payable price — product cost, all fees, discounts — across instant delivery and e-commerce platforms simultaneously.
          </p>
        </div>

        <div className="hero-proof">
          <div className="proof-avatars" aria-hidden="true">
            <span>AK</span><span>SR</span><span>RP</span>
          </div>
          <div>
            <strong>{providers.filter((p) => p.isConnected).length} connected sources</strong>
            <span>Updated just now</span>
          </div>
          <ShieldCheck size={18} />
        </div>

        {/* Search bar */}
        <form className="search-bar" role="search" onSubmit={onSearch}>
          <span className="search-icon"><Search size={19} /></span>
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 180)}
            placeholder="Search any product, brand, or ask a question…"
            aria-label="Search for a product"
            autoComplete="off"
          />
          <kbd aria-hidden="true">⏎</kbd>
          <button type="submit" className="search-submit">
            <Search size={14} /> Compare now
          </button>
        </form>

        {searchOpen && (
          <div className="search-suggestions" role="listbox" aria-label="Search suggestions">
            <div className="suggestions-heading">
              <span>Trending searches</span>
              <span>Press ↵ to search</span>
            </div>
            {SEARCH_SUGGESTIONS.map((s) => (
              <button
                key={s.label}
                role="option"
                onMouseDown={() => onRun(s.label)}
              >
                <span className="suggestion-icon"><Sparkles size={13} /></span>
                <span>
                  <span className="suggestion-label">{s.label}</span>
                  <span className="suggestion-hint">{s.hint}</span>
                </span>
                <ArrowUpRight size={13} />
              </button>
            ))}
            <div className="suggestions-hint">
              <Sparkles size={12} /> Natural language supported — try "cheap airpods near me"
            </div>
          </div>
        )}
      </section>

      <div className="page-content">
        {/* Product overview card */}
        <div className="section-heading">
          <div>
            <p className="section-kicker">
              <span className="live-dot" aria-hidden="true" />
              {product.offers.length} offers found
            </p>
            <h2>Comparing {product.name}</h2>
            <p className="section-subtitle">
              <strong>{product.variant}</strong> · <span>{product.quantity}</span> ·{' '}
              <span>{product.category}</span>
            </p>
          </div>
          <div className="heading-actions">
            <button className="secondary-button" onClick={onShare}><Share2 size={14} /> Share</button>
            <button className="secondary-button" onClick={onSetAlert}><Bell size={14} /> Set alert</button>
            <button
              className={`secondary-button${isSaved ? ' saved' : ''}`}
              onClick={onWishlist}
              aria-label={isSaved ? 'Remove from wishlist' : 'Save to wishlist'}
            >
              <Heart size={14} fill={isSaved ? 'currentColor' : 'none'} />
              {isSaved ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>

        <div className="product-overview-card">
          <div className="product-overview-main">
            <div className="product-art-wrap">
              <ProductArt kind={product.imageKind} size="lg" />
            </div>
            <div className="product-overview-copy">
              <div className="product-kicker">
                <span>{product.category}</span>
                {product.isDefinitiveMatch && (
                  <span className="match-pill"><Check size={10} /> Verified product</span>
                )}
              </div>
              <h3>{product.name}</h3>
              <p>
                {product.brand} <span>·</span> {product.variant} <span>·</span> {product.quantity}
              </p>
              {product.description && (
                <p className="product-description">{product.description}</p>
              )}
              <div className="overview-meta">
                {product.gtin && (
                  <span><Tag size={12} /> GTIN: {product.gtin}</span>
                )}
                {product.sku && (
                  <span><ShoppingBag size={12} /> SKU: {product.sku}</span>
                )}
                <span><Globe2 size={12} /> {product.offers.length} sources</span>
              </div>
              {/* Specs */}
              {product.specs && product.specs.length > 0 && (
                <div className="product-specs">
                  {product.specs.map((s) => (
                    <span key={s.label} className="spec-chip">
                      <strong>{s.label}:</strong> {s.value}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Price history mini */}
          <div className="trend-overview">
            <div className="trend-head">
              <span className="trend-label">Price trend</span>
              <span className={`trend-badge ${product.priceHistory.trend}`}>
                {product.priceHistory.trend === 'down' ? <TrendingDown size={12} /> : product.priceHistory.trend === 'up' ? <TrendingUp size={12} /> : <Minus size={12} />}
                {Math.abs(product.priceHistory.changePercent)}%
              </span>
            </div>
            <MiniChart history={product.priceHistory} />
            <div className="trend-stats">
              <div><span>Lowest</span><strong className="green">{formatRupees(product.priceHistory.lowest)}</strong></div>
              <div><span>Average</span><strong>{formatRupees(product.priceHistory.average)}</strong></div>
              <div><span>Highest</span><strong className="red">{formatRupees(product.priceHistory.highest)}</strong></div>
            </div>
            <p className="trend-insight"><Info size={11} /> {insight}</p>
          </div>
        </div>

        {/* Comparison summary (best price / fastest / best overall) */}
        {(summary.bestPrice || summary.fastest || summary.bestOverall) && (
          <div className="summary-row">
            {summary.bestPrice && (
              <SummaryCard
                icon={<WalletCards size={16} />}
                label="Best Price"
                offer={summary.bestPrice}
                highlight="green"
                onClick={() => onSelectOffer(summary.bestPrice!)}
              />
            )}
            {summary.fastest && (
              <SummaryCard
                icon={<Zap size={16} />}
                label="Fastest"
                offer={summary.fastest}
                highlight="blue"
                onClick={() => onSelectOffer(summary.fastest!)}
              />
            )}
            {summary.bestOverall && (
              <SummaryCard
                icon={<Star size={16} />}
                label="Best Overall"
                offer={summary.bestOverall}
                highlight="yellow"
                onClick={() => onSelectOffer(summary.bestOverall!)}
              />
            )}
          </div>
        )}

        {/* Mode tabs + controls */}
        <div className="controls-row">
          <div className="mode-tabs" role="tablist" aria-label="Delivery mode">
            {[
              { value: 'instant' as Mode, label: '⚡ Instant', count: instantCount },
              { value: 'normal'  as Mode, label: '📦 E-Commerce', count: normalCount },
              { value: 'all'     as Mode, label: '🌐 Compare All', count: product.offers.length },
            ].map(({ value, label, count }) => (
              <button
                key={value}
                className={`mode-tab${mode === value ? ' active' : ''}`}
                onClick={() => setMode(value)}
                role="tab"
                aria-selected={mode === value}
              >
                {label}
                <span className="tab-count">{count}</span>
              </button>
            ))}
          </div>

          <div className="control-actions">
            <div className="sort-wrap">
              <label htmlFor="sort-select" className="sr-only">Sort by</label>
              <ListFilter size={14} />
              <select
                id="sort-select"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <button
              className={`secondary-button${showFilters ? ' active' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
              aria-expanded={showFilters}
            >
              <Filter size={13} /> Filters
              {(filters.providers.length > 0 || filters.priceMin || filters.priceMax) && (
                <span className="filter-badge">!</span>
              )}
            </button>
            <button
              className={`secondary-button${filters.exactOnly ? ' active' : ''}`}
              onClick={() => setFilters({ ...filters, exactOnly: !filters.exactOnly })}
              title={filters.exactOnly ? 'Showing exact matches only' : 'Showing all matches'}
            >
              <ShieldCheck size={13} />
              {filters.exactOnly ? 'Exact only' : 'All matches'}
            </button>
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <FilterPanel
            filters={filters}
            setFilters={setFilters}
            activeProviderIds={activeProviderIds}
            onReset={() => setFilters({ priceMin: '', priceMax: '', providers: [], availability: false, exactOnly: true })}
          />
        )}

        {/* Provider filter pills */}
        {activeProviderIds.length > 1 && (
          <div className="provider-pills">
            <button
              className={`provider-pill${providerFilter === 'all' ? ' active' : ''}`}
              onClick={() => setProviderFilter('all')}
            >
              All providers
            </button>
            {activeProviderIds.map((pid) => {
              const prov = providers.find((p) => p.id === pid)
              if (!prov) return null
              return (
                <button
                  key={pid}
                  className={`provider-pill${providerFilter === pid ? ' active' : ''}`}
                  onClick={() => setProviderFilter(pid)}
                  style={{ '--pcolor': prov.color } as CSSProperties}
                >
                  <span className="provider-dot" style={{ background: prov.color }} />
                  {prov.name}
                </button>
              )
            })}
          </div>
        )}

        {/* Offers */}
        {filteredOffers.length === 0 ? (
          <EmptyState
            icon={<Search size={28} />}
            title="No offers match your filters"
            description="Try adjusting the filters, mode, or match confidence settings."
            action={<button className="primary-button" onClick={() => setFilters({ priceMin: '', priceMax: '', providers: [], availability: false, exactOnly: true })}>Clear filters</button>}
          />
        ) : (
          <div className="offers-grid" aria-label="Price comparison results">
            {filteredOffers.map((offer, i) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                rank={i + 1}
                isBestPrice={offer.id === summary.bestPrice?.id}
                isFastest={offer.id === summary.fastest?.id}
                isBestOverall={offer.id === summary.bestOverall?.id}
                onClick={() => onSelectOffer(offer)}
              />
            ))}
          </div>
        )}

        {/* Disconnected providers notice */}
        {disconnectedProviders.length > 0 && (
          <div className="disconnected-notice">
            <AlertCircle size={14} />
            <span>
              <strong>{disconnectedProviders.length} providers unavailable:</strong>{' '}
              {disconnectedProviders.map((p) => p.name).join(', ')} — authorized feeds pending.
            </span>
          </div>
        )}

        {/* Alternatives */}
        {product.alternatives && product.alternatives.length > 0 && (
          <div className="alternatives-section">
            <div className="section-heading">
              <div>
                <p className="section-kicker"><Sparkles size={12} /> AI Recommendations</p>
                <h2>Cheaper alternatives</h2>
                <p className="section-subtitle">Different products — clearly labelled. Compare separately.</p>
              </div>
            </div>
            <div className="alternatives-grid">
              {product.alternatives.map((alt) => (
                <div key={alt.id} className="alternative-card">
                  <div className="alt-art"><ProductArt kind={alt.imageKind} size="sm" /></div>
                  <div className="alt-copy">
                    <div className="alt-badge">Alternative product</div>
                    <strong>{alt.name}</strong>
                    <span>{alt.brand} · {alt.variant} · {alt.quantity}</span>
                    <div className="alt-price">
                      <span className="alt-best">{formatRupees(alt.bestPrice)}</span>
                      <span className="alt-via">at {alt.bestProvider}</span>
                    </div>
                    {alt.savings > 0 && (
                      <p className="alt-savings"><TrendingDown size={12} /> Saves ₹{alt.savings.toLocaleString('en-IN')} — {alt.savingsReason}</p>
                    )}
                  </div>
                  <button
                    className="alt-compare"
                    onClick={() => {
                      /* In a real app this would navigate to the alt product */
                    }}
                  >
                    Compare <ChevronRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full price history chart */}
        <PriceHistorySection product={product} />
      </div>
    </>
  )
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({
  icon, label, offer, highlight, onClick,
}: { icon: ReactNode; label: string; offer: Offer; highlight: string; onClick: () => void }) {
  const fp = finalPrice(offer)
  return (
    <button className={`summary-card highlight-${highlight}`} onClick={onClick}>
      <div className="summary-icon">{icon}</div>
      <div className="summary-copy">
        <span className="summary-label">{label}</span>
        <strong className="summary-provider">{offer.provider.name}</strong>
        <span className="summary-price">{formatRupees(fp)}</span>
        {label === 'Fastest' && <span className="summary-meta">{offer.etaLabel}</span>}
        {label !== 'Fastest' && fp && <span className="summary-meta">incl. all fees</span>}
      </div>
      <div className="summary-provider-mark" style={{ background: offer.provider.color, color: offer.provider.background }}>
        {offer.provider.mark}
      </div>
    </button>
  )
}

// ─── Offer Card ───────────────────────────────────────────────────────────────

function OfferCard({
  offer, rank, isBestPrice, isFastest, isBestOverall, onClick,
}: {
  offer: Offer; rank: number
  isBestPrice: boolean; isFastest: boolean; isBestOverall: boolean
  onClick: () => void
}) {
  const fp = finalPrice(offer)
  const disc = discountPercent(offer)
  const badges: Array<{ label: string; cls: string }> = []
  if (isBestPrice)   badges.push({ label: '🏆 Best Price',    cls: 'badge-green' })
  if (isFastest)     badges.push({ label: '⚡ Fastest',       cls: 'badge-blue' })
  if (isBestOverall) badges.push({ label: '💰 Best Overall',  cls: 'badge-yellow' })

  return (
    <article
      className={`offer-card${offer.availability === 'unavailable' ? ' unavailable' : ''}${isBestOverall ? ' card-best' : ''}`}
      aria-label={`${offer.provider.name} — ${formatRupees(fp)}`}
    >
      {/* Provider bar */}
      <div className="offer-provider-bar" style={{ background: offer.provider.background }}>
        <div className="offer-provider-mark" style={{ color: offer.provider.color }}>
          {offer.provider.mark}
        </div>
        <span className="offer-provider-name" style={{ color: offer.provider.color }}>
          {offer.provider.name}
        </span>
        <div className="offer-freshness">
          {offer.freshness === 'live' ? (
            <span className="freshness-live"><span className="tiny-live-dot" /> Live</span>
          ) : (
            <span className="freshness-cached">{offer.updatedSeconds}s ago</span>
          )}
        </div>
      </div>

      <div className="offer-body">
        {/* Badges */}
        {badges.length > 0 && (
          <div className="offer-badges">
            {badges.map((b) => (
              <span key={b.label} className={`offer-badge ${b.cls}`}>{b.label}</span>
            ))}
          </div>
        )}

        {/* Product info */}
        <div className="offer-product-row">
          <div className="offer-product-text">
            <strong className="offer-product-name">{offer.productName}</strong>
            <span className="offer-product-meta">{offer.variant} · {offer.quantity}</span>
          </div>
          <MatchBadge match={offer.match} />
        </div>

        {/* Price */}
        <div className="offer-price-row">
          <div className="offer-price-main">
            <span className="offer-final-price">{fp !== null ? formatRupees(fp) : 'See checkout'}</span>
            {fp === null && <em className="checkout-note">Final price at checkout</em>}
          </div>
          <div className="offer-price-detail">
            <span className="offer-product-price">{formatRupees(offer.price)}</span>
            {offer.mrp > offer.price && (
              <>
                <span className="offer-mrp">{formatRupees(offer.mrp)}</span>
                <span className="offer-disc">{disc}% off</span>
              </>
            )}
          </div>
        </div>

        {/* Price per unit */}
        {offer.pricePerUnit && (
          <div className="offer-per-unit">{offer.pricePerUnit}</div>
        )}

        {/* Fee breakdown */}
        <div className="offer-fees">
          {offer.fees.delivery === 0
            ? <span className="fee-free"><Check size={11} /> Free delivery</span>
            : offer.fees.delivery !== null
              ? <span className="fee-paid"><Truck size={11} /> ₹{offer.fees.delivery} delivery</span>
              : <span className="fee-unknown"><Info size={11} /> Delivery at checkout</span>
          }
          {(offer.fees.platform ?? 0) > 0 && (
            <span className="fee-paid">₹{offer.fees.platform} platform fee</span>
          )}
        </div>

        {/* Delivery */}
        <div className="offer-delivery-row">
          <div className={`offer-eta${offer.mode === 'instant' ? ' eta-instant' : ''}`}>
            {offer.mode === 'instant' ? <Zap size={13} /> : <Truck size={13} />}
            {offer.etaLabel}
            {offer.deliveryDate && <span className="eta-date">· {offer.deliveryDate}</span>}
          </div>
          <div className={`offer-stock ${offer.availability}`}>
            {offer.availability === 'in_stock'   && <><Check size={11} /> {offer.stockLabel}</>}
            {offer.availability === 'low_stock'  && <><AlertCircle size={11} /> {offer.stockLabel}</>}
            {offer.availability === 'unavailable' && <><X size={11} /> Unavailable</>}
          </div>
        </div>

        {/* Seller */}
        <div className="offer-seller-row">
          <span className="offer-seller">{offer.seller}</span>
          {offer.rating && (
            <span className="offer-rating">
              <Star size={11} fill="currentColor" /> {offer.rating}
              {offer.reviewCount && <span className="review-count">({offer.reviewCount})</span>}
            </span>
          )}
        </div>

        {/* Offer label */}
        {offer.offerLabel && (
          <div className="offer-label-tag"><Gift size={11} /> {offer.offerLabel}</div>
        )}

        {/* Actions */}
        <div className="offer-actions">
          <button className="offer-details-btn" onClick={onClick}>
            View details <ChevronRight size={14} />
          </button>
          <a
            className="offer-link-btn"
            href={offer.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`View ${offer.productName} on ${offer.provider.name}`}
          >
            <ExternalLink size={14} /> Open
          </a>
        </div>
      </div>
    </article>
  )
}

// ─── Mini Chart ───────────────────────────────────────────────────────────────

function MiniChart({ history }: { history: Product['priceHistory'] }) {
  const data = history.points.slice(-14).map((p) => ({
    date: p.date.slice(5),  // MM-DD
    price: p.price,
  }))
  if (data.length < 2) return null
  const color = history.trend === 'down' ? '#65b88c' : history.trend === 'up' ? '#ec8d76' : '#a99ae9'
  return (
    <div className="mini-chart" aria-hidden="true">
      <ResponsiveContainer width="100%" height={52}>
        <AreaChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
          <defs>
            <linearGradient id="mcGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.28} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="price" stroke={color} strokeWidth={1.8} fill="url(#mcGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Price History Section ────────────────────────────────────────────────────

function PriceHistorySection({ product }: { product: Product }) {
  const { priceHistory: h } = product
  const data = h.points.map((p) => ({ date: p.date.slice(5), price: p.price }))
  const color = h.trend === 'down' ? '#65b88c' : h.trend === 'up' ? '#ec8d76' : '#a99ae9'

  return (
    <section className="history-chart-section" aria-labelledby="history-title">
      <div className="section-heading" style={{ marginBottom: 20 }}>
        <div>
          <p className="section-kicker"><History size={12} /> Price tracking</p>
          <h2 id="history-title">Price history</h2>
          <p className="section-subtitle">{h.period} · {data.length} data points</p>
        </div>
        <div className="history-summary-chips">
          <span className="chip green">Low {formatRupees(h.lowest)}</span>
          <span className="chip neutral">Avg {formatRupees(h.average)}</span>
          <span className="chip red">High {formatRupees(h.highest)}</span>
        </div>
      </div>

      <div className="history-chart-card">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--muted)' }}
              tickLine={false} axisLine={false}
              tickFormatter={(v) => formatRupees(v, true)}
              width={60}
            />
            <Tooltip
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, fontSize: 12 }}
              formatter={(v: number) => [formatRupees(v), 'Price']}
            />
            <ReferenceLine y={h.average} stroke="var(--muted)" strokeDasharray="4 4" label={{ value: 'Avg', fill: 'var(--muted)', fontSize: 10 }} />
            <ReferenceLine y={h.lowest}  stroke="#65b88c" strokeDasharray="4 4" label={{ value: 'Low', fill: '#65b88c', fontSize: 10 }} />
            <Area type="monotone" dataKey="price" stroke={color} strokeWidth={2} fill="url(#histGrad)" dot={false} activeDot={{ r: 4, fill: color }} />
          </AreaChart>
        </ResponsiveContainer>
        <p className="chart-disclaimer">
          <ShieldCheck size={12} /> Historical data from connected sources only. No values are estimated or extrapolated.
        </p>
      </div>
    </section>
  )
}

// ─── Filter Panel ─────────────────────────────────────────────────────────────

function FilterPanel({
  filters, setFilters, activeProviderIds, onReset,
}: { filters: FilterState; setFilters: (f: FilterState) => void; activeProviderIds: string[]; onReset: () => void }) {
  return (
    <div className="filter-panel">
      <div className="filter-section">
        <strong>Price range (final)</strong>
        <div className="price-range-inputs">
          <input
            type="number" placeholder="Min ₹" value={filters.priceMin}
            onChange={(e) => setFilters({ ...filters, priceMin: e.target.value })}
            aria-label="Minimum price"
          />
          <span>–</span>
          <input
            type="number" placeholder="Max ₹" value={filters.priceMax}
            onChange={(e) => setFilters({ ...filters, priceMax: e.target.value })}
            aria-label="Maximum price"
          />
        </div>
      </div>
      <div className="filter-section">
        <strong>In stock only</strong>
        <label className="toggle-label">
          <input
            type="checkbox" checked={filters.availability}
            onChange={(e) => setFilters({ ...filters, availability: e.target.checked })}
          />
          <span className="toggle-switch" />
        </label>
      </div>
      <div className="filter-section filter-section-wide">
        <strong>Providers</strong>
        <div className="filter-provider-chips">
          {activeProviderIds.map((pid) => {
            const p = providers.find((x) => x.id === pid)
            if (!p) return null
            const active = filters.providers.includes(pid)
            return (
              <button
                key={pid}
                className={`filter-chip${active ? ' active' : ''}`}
                onClick={() =>
                  setFilters({
                    ...filters,
                    providers: active
                      ? filters.providers.filter((x) => x !== pid)
                      : [...filters.providers, pid],
                  })
                }
                style={{ '--pcolor': p.color } as CSSProperties}
              >
                {p.name}
              </button>
            )
          })}
        </div>
      </div>
      <button className="filter-reset" onClick={onReset}><X size={13} /> Reset filters</button>
    </div>
  )
}

// ─── Match Badge ──────────────────────────────────────────────────────────────

function MatchBadge({ match }: { match: MatchLevel }) {
  const label = matchLevelToConfidence(match)
  const cls = match === 'exact' ? 'match-exact' : match === 'likely' ? 'match-likely' : 'match-similar'
  const icon = match === 'exact' ? <Check size={10} /> : match === 'likely' ? <Eye size={10} /> : <AlertCircle size={10} />
  return <span className={`match-badge ${cls}`} title={label}>{icon} {label}</span>
}

// ─── Product Art ──────────────────────────────────────────────────────────────

const PRODUCT_ART: Record<string, { bg: string; emoji: string }> = {
  milk:      { bg: '#eef5f0', emoji: '🥛' },
  phone:     { bg: '#e8eef8', emoji: '📱' },
  audio:     { bg: '#f0ecf8', emoji: '🎧' },
  shampoo:   { bg: '#f5f0e8', emoji: '🧴' },
  rice:      { bg: '#f8f4e8', emoji: '🌾' },
  detergent: { bg: '#e8f5f0', emoji: '🧺' },
  default:   { bg: '#f0f2ee', emoji: '📦' },
}

function ProductArt({ kind, size = 'md' }: { kind: string; size?: 'sm' | 'md' | 'lg' }) {
  const art = PRODUCT_ART[kind] ?? PRODUCT_ART.default
  const fontSize = size === 'lg' ? 54 : size === 'sm' ? 28 : 40
  return (
    <div className={`product-art product-art-${size}`} style={{ background: art.bg }} aria-hidden="true">
      <span style={{ fontSize }}>{art.emoji}</span>
    </div>
  )
}

// ─── Overview View ────────────────────────────────────────────────────────────

function OverviewView({
  catalog, alerts, wishlist, onProduct, onSetAlert,
}: {
  catalog: Product[]
  alerts: PriceAlert[]
  wishlist: WishlistItem[]
  onProduct: (p: Product) => void
  onSetAlert: (p: Product) => void
}) {
  const totalSavings = catalog.reduce((sum, p) => {
    const best = Math.min(...p.offers.map((o) => finalPrice(o) ?? Infinity))
    const mrp  = Math.min(...p.offers.map((o) => o.mrp))
    return sum + Math.max(0, mrp - best)
  }, 0)

  return (
    <div className="page-content utility-page">
      <div className="utility-page-head">
        <div>
          <p className="eyebrow"><span className="eyebrow-spark"><LayoutDashboard size={12} /></span> Your dashboard</p>
          <h1>Overview</h1>
          <p>Live snapshot of all products in your workspace.</p>
        </div>
      </div>

      <div className="utility-stats">
        <div>
          <span className="utility-stat-icon green"><TrendingDown size={17} /></span>
          <div><strong>{formatRupees(totalSavings, true)}</strong><small>potential savings vs MRP</small></div>
        </div>
        <div>
          <span className="utility-stat-icon yellow"><BellRing size={17} /></span>
          <div><strong>{alerts.filter((a) => a.status === 'active').length} active</strong><small>price alerts watching</small></div>
        </div>
        <div>
          <span className="utility-stat-icon purple"><Heart size={17} /></span>
          <div><strong>{wishlist.length} saved</strong><small>products in wishlist</small></div>
        </div>
        <div>
          <span className="utility-stat-icon blue"><Globe2 size={17} /></span>
          <div><strong>{providers.filter((p) => p.isConnected).length} sources</strong><small>connected &amp; active</small></div>
        </div>
      </div>

      <section className="overview-products-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">All tracked products</p>
            <h2>Product catalog</h2>
          </div>
        </div>
        <div className="overview-grid">
          {catalog.map((p) => {
            const best   = Math.min(...p.offers.map((o) => finalPrice(o) ?? Infinity))
            const mrp    = p.offers[0]?.mrp ?? 0
            const saving = Math.max(0, mrp - best)
            const prov   = p.offers.find((o) => finalPrice(o) === best)?.provider
            return (
              <div key={p.id} className="overview-card">
                <div className="ov-art"><ProductArt kind={p.imageKind} size="sm" /></div>
                <div className="ov-copy">
                  <span className="ov-category">{p.category}</span>
                  <strong className="ov-name">{p.name}</strong>
                  <span className="ov-meta">{p.variant} · {p.quantity}</span>
                  <div className="ov-price-row">
                    <span className="ov-best">{formatRupees(isFinite(best) ? best : null)}</span>
                    {saving > 0 && <span className="ov-saving">-₹{saving.toLocaleString('en-IN')}</span>}
                  </div>
                  {prov && (
                    <span className="ov-provider" style={{ color: prov.color, background: prov.background }}>
                      {prov.name}
                    </span>
                  )}
                  <div className="ov-trend">
                    {p.priceHistory.trend === 'down' ? <TrendingDown size={12} className="green" /> : p.priceHistory.trend === 'up' ? <TrendingUp size={12} className="red" /> : <Minus size={12} />}
                    <span>{Math.abs(p.priceHistory.changePercent)}% {p.priceHistory.period}</span>
                  </div>
                </div>
                <div className="ov-actions">
                  <button className="primary-button" onClick={() => onProduct(p)}>Compare</button>
                  <button className="secondary-button" onClick={() => onSetAlert(p)}><Bell size={13} /></button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Connected providers */}
      <section>
        <div className="section-heading" style={{ marginBottom: 16 }}>
          <div>
            <p className="section-kicker">Integration status</p>
            <h2>Provider network</h2>
          </div>
        </div>
        <div className="provider-status-grid">
          {providers.map((p) => (
            <div key={p.id} className={`provider-status-card${p.isConnected ? ' connected' : ' disconnected'}`}>
              <div className="psc-mark" style={{ background: p.background, color: p.color }}>{p.mark}</div>
              <div className="psc-info">
                <strong>{p.name}</strong>
                <span>{p.kind}</span>
              </div>
              <div className={`psc-status${p.isConnected ? ' ok' : ''}`}>
                {p.isConnected ? <><Check size={12} /> Active</> : <><X size={12} /> Pending</>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

// ─── Alerts View ──────────────────────────────────────────────────────────────

function AlertsView({
  alerts, catalog, onDelete, onAdd, onCompare,
}: { alerts: PriceAlert[]; catalog: Product[]; onDelete: (id: string) => void; onAdd: () => void; onCompare: (id: string) => void }) {
  return (
    <div className="page-content utility-page">
      <div className="utility-page-head">
        <div>
          <p className="eyebrow"><span className="eyebrow-spark"><BellRing size={12} /></span> Never overpay</p>
          <h1>Price alerts</h1>
          <p>PriceRadar is watching {alerts.filter((a) => a.status === 'active').length} products across connected stores.</p>
        </div>
        <button className="primary-button" onClick={onAdd}><Plus size={16} /> Track a product</button>
      </div>

      {alerts.length === 0 ? (
        <EmptyState
          icon={<BellRing size={28} />}
          title="No price alerts yet"
          description="Search for a product and tap 'Set alert' to start tracking its price."
          action={<button className="primary-button" onClick={onAdd}><Plus size={15} /> Track a product</button>}
        />
      ) : (
        <section className="alerts-table-card">
          <div className="utility-card-head">
            <span className="card-label">ACTIVE WATCHLIST</span>
            <h2>Products you're watching</h2>
          </div>
          {alerts.map((alert) => {
            const product = catalog.find((p) => p.id === alert.productId)
            const pct = Math.round(((alert.currentBest - alert.targetPrice) / alert.targetPrice) * 100)
            const reached = alert.currentBest <= alert.targetPrice
            return (
              <div key={alert.id} className="alert-row">
                <div className="alert-product-art">
                  {product && <ProductArt kind={product.imageKind} size="sm" />}
                </div>
                <div className="alert-product">
                  <strong>{alert.productName}</strong>
                  <span>Set {fmtDate(alert.createdAt)}</span>
                </div>
                <div className="alert-target">
                  <span>Target</span>
                  <strong>{formatRupees(alert.targetPrice)}</strong>
                </div>
                <div className="alert-current">
                  <span>Best now</span>
                  <strong>{formatRupees(alert.currentBest)}</strong>
                </div>
                <div className={`alert-progress-copy${reached ? ' reached' : ''}`}>
                  {reached ? <Check size={14} /> : <Clock3 size={14} />}
                  {reached ? 'Target reached!' : `₹${(alert.currentBest - alert.targetPrice).toLocaleString('en-IN')} to go`}
                </div>
                <div className="alert-row-actions">
                  <button className="secondary-button" onClick={() => onCompare(alert.productId)}>Compare</button>
                  <button className="icon-button danger" onClick={() => onDelete(alert.id)} aria-label="Delete alert"><X size={15} /></button>
                </div>
              </div>
            )
          })}
        </section>
      )}
    </div>
  )
}

// ─── Wishlist View ────────────────────────────────────────────────────────────

function WishlistView({
  wishlist, catalog, onProduct, onRemove,
}: { wishlist: WishlistItem[]; catalog: Product[]; onProduct: (p: Product) => void; onRemove: (id: string) => void }) {
  const items = wishlist.map((w) => catalog.find((c) => c.id === w.productId)).filter(Boolean) as Product[]

  return (
    <div className="page-content utility-page">
      <div className="utility-page-head">
        <div>
          <p className="eyebrow"><span className="eyebrow-spark"><Heart size={12} /></span> Your saved buys</p>
          <h1>Wishlist</h1>
          <p>Track products you're considering. PriceRadar watches their prices.</p>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<Heart size={28} />}
          title="Your wishlist is empty"
          description="Search for a product and tap the heart icon to save it here."
        />
      ) : (
        <div className="wishlist-grid">
          {items.map((item) => {
            const best = Math.min(...item.offers.map((o) => finalPrice(o) ?? Infinity))
            const prov = item.offers.find((o) => finalPrice(o) === best)?.provider
            return (
              <div key={item.id} className="wishlist-card">
                <button className="wishlist-remove" onClick={() => onRemove(item.id)} aria-label="Remove from wishlist">
                  <X size={14} />
                </button>
                <button className="wishlist-inner" onClick={() => onProduct(item)}>
                  <div className="wishlist-art"><ProductArt kind={item.imageKind} size="md" /></div>
                  <div className="wishlist-copy">
                    <span className="wishlist-category">{item.category}</span>
                    <h3>{item.name}</h3>
                    <p>{item.variant} · {item.quantity}</p>
                    <strong>{formatRupees(isFinite(best) ? best : null)}</strong>
                    {prov && <span className="wishlist-provider" style={{ color: prov.color, background: prov.background }}>{prov.name}</span>}
                    <small>best total across {item.offers.length} offers <ArrowUpRight size={12} /></small>
                  </div>
                </button>
                <button className="primary-button wishlist-compare" onClick={() => onProduct(item)}>
                  Compare prices
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── History View ─────────────────────────────────────────────────────────────

function HistoryView({
  history, catalog, onSearch, onClear,
}: { history: SearchHistoryEntry[]; catalog: Product[]; onSearch: (q: string) => void; onClear: () => void }) {
  return (
    <div className="page-content utility-page">
      <div className="utility-page-head">
        <div>
          <p className="eyebrow"><span className="eyebrow-spark"><History size={12} /></span> Pick up where you left off</p>
          <h1>Search history</h1>
          <p>Your recent comparisons, kept in one place.</p>
        </div>
        <button className="secondary-button" onClick={onClear}><X size={14} /> Clear history</button>
      </div>

      {history.length === 0 ? (
        <EmptyState
          icon={<History size={28} />}
          title="No search history yet"
          description="Once you search for products, your comparisons will appear here."
        />
      ) : (
        <section className="history-list-card">
          {history.map((item, i) => {
            const product = catalog.find((c) => c.id === item.productId)
            return (
              <button key={`${item.query}-${i}`} className="history-row" onClick={() => onSearch(item.query)}>
                <div className="history-number">
                  {String(i + 1).padStart(2, '0')}
                </div>
                {product && (
                  <div className="history-thumb"><ProductArt kind={product.imageKind} size="sm" /></div>
                )}
                <div className="history-query">
                  <strong>{item.query}</strong>
                  <span>{item.offerCount} offers · {fmtRelTime(item.timestamp)}</span>
                </div>
                {item.bestTotal !== undefined && (
                  <div className="history-best">
                    <span>Best total</span>
                    <strong>{formatRupees(item.bestTotal)}</strong>
                  </div>
                )}
                <ArrowRight size={17} />
              </button>
            )
          })}
        </section>
      )}
    </div>
  )
}

// ─── Offer Modal ──────────────────────────────────────────────────────────────

function OfferModal({ offer, onClose }: { offer: Offer; onClose: () => void }) {
  const feeRows = buildFeeRows(offer)
  const fp = finalPrice(offer)
  const disc = discountPercent(offer)

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={onClose} role="dialog" aria-modal="true" aria-label="Offer details">
      <section className="offer-modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>

        <div className="modal-provider-bar" style={{ background: offer.provider.background }}>
          <span className="modal-provider-mark" style={{ color: offer.provider.color }}>{offer.provider.mark}</span>
          <span className="modal-provider-name" style={{ color: offer.provider.color }}>{offer.provider.name}</span>
          <MatchBadge match={offer.match} />
        </div>

        <div className="modal-body">
          <div className="modal-product">
            <div className="modal-product-info">
              <strong>{offer.productName}</strong>
              <span>{offer.variant} · {offer.quantity}</span>
              <div className="modal-meta-row">
                <MatchBadge match={offer.match} />
                <span className="modal-freshness">
                  {offer.freshness === 'live'
                    ? <><span className="tiny-live-dot" aria-hidden="true" /> Live source</>
                    : <>Updated {offer.updatedSeconds}s ago</>
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Transparent breakdown */}
          <div className="breakdown-box">
            <div className="breakdown-head">
              <span>Transparent total</span>
              <span>{offer.etaLabel} delivery</span>
            </div>
            {feeRows.map(([label, value]) => (
              <div className="breakdown-row" key={label}>
                <span>
                  {label}
                  {label === 'Product price' && offer.mrp > offer.price && (
                    <small> MRP {formatRupees(offer.mrp)}</small>
                  )}
                </span>
                <strong>
                  {value === null ? <em>At checkout</em> : (
                    <span style={{ color: typeof value === 'number' && value < 0 ? '#65b88c' : undefined }}>
                      {typeof value === 'number' && value < 0 ? `-${formatRupees(-value)}` : formatRupees(value as number)}
                    </span>
                  )}
                </strong>
              </div>
            ))}
            <div className="breakdown-total">
              <span>Final payable price</span>
              <strong>{formatRupees(fp)}</strong>
            </div>
            {fp === null && (
              <p className="checkout-warning"><AlertCircle size={12} /> Final amount not known until checkout</p>
            )}
          </div>

          {offer.fees.note && (
            <p className="fee-note"><Info size={13} /> {offer.fees.note}</p>
          )}

          {/* Seller & facts */}
          <div className="modal-facts">
            <div><span>Sold by</span><strong>{offer.seller}</strong></div>
            <div>
              <span>Availability</span>
              <strong className={`avail-${offer.availability}`}>
                {offer.availability === 'in_stock'   ? '● In stock'    : ''}
                {offer.availability === 'low_stock'  ? '● Low stock'   : ''}
                {offer.availability === 'unavailable' ? '● Unavailable' : ''}
              </strong>
            </div>
            {offer.returnPolicy && <div><span>Return policy</span><strong>{offer.returnPolicy}</strong></div>}
            {offer.warranty     && <div><span>Warranty</span><strong>{offer.warranty}</strong></div>}
            <div>
              <span>Match confidence</span>
              <strong>{Math.round(offer.matchScore * 100)}%</strong>
            </div>
            <div><span>Match reason</span><strong>{offer.matchReason}</strong></div>
          </div>

          {offer.rating && (
            <div className="modal-rating">
              <Star size={14} fill="currentColor" style={{ color: '#f4cb63' }} />
              <strong>{offer.rating}</strong>
              {offer.reviewCount && <span>({offer.reviewCount} reviews)</span>}
            </div>
          )}

          <div className="modal-actions">
            <a className="primary-modal-button" href={offer.url} target="_blank" rel="noreferrer">
              View on {offer.provider.name} <ExternalLink size={15} />
            </a>
            <button className="secondary-modal-button" onClick={onClose}>Keep comparing</button>
          </div>

          <p className="modal-disclaimer">
            <ShieldCheck size={12} /> Price and availability can change at checkout. Last checked {offer.updatedSeconds}s ago.
          </p>
        </div>
      </section>
    </div>
  )
}

// ─── Alert Modal ──────────────────────────────────────────────────────────────

function AlertModal({
  product, price, setPrice, existingAlert, onClose, onSave,
}: {
  product: Product; price: string; setPrice: (v: string) => void
  existingAlert?: PriceAlert; onClose: () => void; onSave: () => void
}) {
  const best = Math.min(...product.offers.map((o) => finalPrice(o) ?? Infinity))

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={onClose} role="dialog" aria-modal="true" aria-label="Set a price alert">
      <section className="alert-modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <div className="alert-modal-icon"><BellRing size={20} /></div>
        <p className="modal-kicker">PRICE ALERT</p>
        <h2>Let the radar watch it.</h2>
        <p className="alert-intro">
          We'll check connected sources and notify you when{' '}
          <strong>{product.name}</strong> drops below your target price.
        </p>

        <label className="target-price-label" htmlFor="alert-price-input">
          Alert me below
          <span>
            <span aria-hidden="true">₹</span>
            <input
              id="alert-price-input"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ''))}
              inputMode="numeric"
              aria-label="Target price in rupees"
              autoFocus
            />
          </span>
        </label>

        <div className="alert-current">
          <span>Best available now</span>
          <strong>{formatRupees(isFinite(best) ? best : null)}</strong>
        </div>

        <button className="save-alert-button" onClick={onSave}>
          <BellRing size={16} />
          {existingAlert ? 'Update alert' : 'Save price alert'}
        </button>

        <p className="alert-fineprint">
          <ShieldCheck size={12} /> Manage alerts anytime from the Price alerts view.
        </p>
      </section>
    </div>
  )
}

// ─── AI Panel ─────────────────────────────────────────────────────────────────

function AiPanel({
  messages, draft, setDraft, loading, endRef, onClose, onSubmit, onPrompt,
}: {
  messages: AiMessage[]
  draft: string; setDraft: (v: string) => void
  loading: boolean
  endRef: React.RefObject<HTMLDivElement>
  onClose: () => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  onPrompt: (p: string) => void
}) {
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="ai-panel-backdrop" onMouseDown={onClose} role="dialog" aria-modal="true" aria-label="AI shopping assistant">
      <section className="ai-panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="ai-panel-header">
          <div className="ai-panel-title">
            <span className="ai-icon large"><Sparkles size={17} /></span>
            <div>
              <strong>PriceRadar AI</strong>
              <span>Grounded in real price data</span>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close AI panel"><X size={18} /></button>
        </div>

        <div className="ai-chat">
          {messages.length === 0 && (
            <div className="ai-message assistant">
              <span className="message-avatar"><Radar size={14} /></span>
              <div>
                <p>
                  Tell me what you want to buy, your budget, or how fast you need it.
                  I'll compare real totals — not just sticker prices. I only use data from connected sources.
                </p>
                <span className="message-time">Just now</span>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`ai-message ${msg.role}`}>
              <span className="message-avatar">
                {msg.role === 'assistant' ? <Radar size={14} /> : '👤'}
              </span>
              <div>
                <p className="ai-message-text">{formatAiContent(msg.content)}</p>
                <span className="message-time">{fmtRelTime(new Date(msg.timestamp).toISOString())}</span>
                {msg.linkedProduct && (
                  <div className="ai-linked-product">
                    <ProductArt kind={msg.linkedProduct.imageKind} size="sm" />
                    <span>{msg.linkedProduct.name}</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="ai-message assistant">
              <span className="message-avatar"><Radar size={14} /></span>
              <div className="ai-loading">
                <span /><span /><span />
              </div>
            </div>
          )}

          {messages.length === 0 && (
            <div className="prompt-chips">
              {AI_QUICK_PROMPTS.map((p) => (
                <button key={p} onClick={() => onPrompt(p)}>
                  {p} <ArrowUpRight size={13} />
                </button>
              ))}
            </div>
          )}

          <div ref={endRef} />
        </div>

        <form className="ai-input-wrap" onSubmit={onSubmit}>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask anything about a product…"
            aria-label="Ask the AI assistant"
            disabled={loading}
          />
          <button type="submit" aria-label="Send" disabled={loading || !draft.trim()}>
            <ArrowUpRight size={17} />
          </button>
        </form>

        <p className="ai-disclaimer">
          <ShieldCheck size={12} /> All recommendations use real connected offer data.
          No prices are estimated or invented.
        </p>
      </section>
    </div>
  )
}

/** Basic markdown-lite formatter for AI messages */
function formatAiContent(text: string): ReactNode {
  return text.split('\n').map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/)
    return (
      <span key={i}>
        {parts.map((part, j) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={j}>{part.slice(2, -2)}</strong>
            : part
        )}
        {i < text.split('\n').length - 1 && <br />}
      </span>
    )
  })
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({
  icon, title, description, action,
}: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}


