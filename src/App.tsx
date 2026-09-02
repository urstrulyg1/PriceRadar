import {
  useCallback, useEffect, useMemo, useRef, useState,
  type FormEvent, type ReactNode,
} from 'react'
import {
  AlertCircle, ArrowUpRight, BadgeCheck, Bell, BellRing, Check,
  ChevronDown, ChevronRight, Clock3, Database, ExternalLink, Globe2,
  Heart, History, Info, KeyRound, LayoutDashboard, Lock, MapPin,
  Menu, Moon, PackageOpen, Radar, RefreshCw, ScanBarcode, Search,
  Settings2, ShieldCheck, Sparkles, Sunrise, TrendingUp, Truck, X,
} from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type {
  AiMessage, Offer, PriceAlert, ProductIdentity, ProviderResult,
  ProviderStatus, SearchResult, SearchHistoryEntry, WishlistItem,
} from './domain/types'
import {
  buildFeeRows, buildSeries, collectedInsight, comparableOffers,
  describeFreshness, discountPercent, finalPrice, formatMoney,
  offerFreshness, priceLine, sortOffers, summarize,
} from './domain/compare'
import { ProviderRegistry } from './services/providerRegistry'
import { createSearchService } from './services/search'
import { answer as assistantAnswer } from './services/assistant'
import { providerConfig, CREDENTIAL_SPECS } from './services/providerConfig'
import {
  allCollectedPoints, getCollectedPoints, onHistoryChange, productKeyOf,
} from './services/priceHistoryStore'
import { PENDING_STORES } from './services/adapters/pendingProviders'

// ─── Local helpers ────────────────────────────────────────────────────────────

type ViewId = 'compare' | 'sources' | 'alerts' | 'wishlist' | 'history'
type SortKey = 'overall' | 'price' | 'speed' | 'match'

const uid = () => Math.random().toString(36).slice(2)

const NAV_ITEMS: Array<{ id: ViewId; label: string; icon: typeof Radar }> = [
  { id: 'compare',  label: 'Compare prices', icon: Radar },
  { id: 'sources',  label: 'Data sources',   icon: Database },
  { id: 'alerts',   label: 'Price alerts',   icon: BellRing },
  { id: 'wishlist', label: 'Wishlist',       icon: Heart },
  { id: 'history',  label: 'Search history', icon: History },
]

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'overall', label: 'Best overall' },
  { value: 'price',   label: 'Lowest price' },
  { value: 'speed',   label: 'Fastest delivery' },
  { value: 'match',   label: 'Match confidence' },
]

// Search affordances — these are queries, not data. Nothing here is a product
// record, price, or result; every search runs against live sources.
const SEARCH_HINTS = [
  { label: 'nutella', hint: 'try a grocery brand' },
  { label: 'amul taaza milk', hint: 'or any packaged food' },
  { label: '3017620422003', hint: 'or paste a barcode' },
]

const AI_QUICK_PROMPTS = [
  'What’s the cheapest verified price?',
  'Is this a good price right now?',
  'Which source is unavailable?',
]

const registry = new ProviderRegistry()
const searchService = createSearchService(registry)

const STATUS_META: Record<ProviderStatus, { label: string; cls: string }> = {
  live: { label: 'Live', cls: 'ok' },
  connected: { label: 'Connected', cls: 'ok' },
  auth_required: { label: 'Authentication required', cls: 'warn' },
  integration_pending: { label: 'Integration pending', cls: 'muted' },
  temporarily_unavailable: { label: 'Temporarily unavailable', cls: 'err' },
  error: { label: 'Error', cls: 'err' },
}

function useLocalState<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) as T : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // non-fatal: state stays in memory
    }
  }, [key, value])
  return [value, setValue]
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [activeView, setActiveView] = useState<ViewId>('compare')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [darkMode, setDarkMode] = useLocalState('priceradar.dark', false)

  // Search
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState<SearchResult | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchFailed, setSearchFailed] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Compare controls
  const [sort, setSort] = useState<SortKey>('overall')
  const [listingTab, setListingTab] = useState<'shoppable' | 'reference'>('shoppable')

  // Location (used only by sources that support it)
  const [location, setLocation] = useLocalState<string | null>('priceradar.location', null)
  const [locationDraft, setLocationDraft] = useState('')
  const [locationOpen, setLocationOpen] = useState(false)

  // Persisted, user-generated-only records
  const [alerts, setAlerts] = useLocalState<PriceAlert[]>('priceradar.alerts.v1', [])
  const [wishlist, setWishlist] = useLocalState<WishlistItem[]>('priceradar.wishlist.v1', [])
  const [history, setHistory] = useLocalState<SearchHistoryEntry[]>('priceradar.history.v1', [])
  const [, forceHistoryTick] = useState(0)

  // UI
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'info' | 'error' } | null>(null)
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null)
  const [alertFor, setAlertFor] = useState<ProductIdentity | null>(null)
  const [alertPrice, setAlertPrice] = useState('')

  // AI
  const [aiOpen, setAiOpen] = useState(false)
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([])
  const [aiDraft, setAiDraft] = useState('')
  const [aiThinking, setAiThinking] = useState(false)
  const aiEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => onHistoryChange(() => forceHistoryTick((t) => t + 1)), [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3600)
    return () => clearTimeout(t)
  }, [toast])
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])
  useEffect(() => {
    aiEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [aiMessages, aiThinking])
  useEffect(() => providerConfig.onChange(() => forceHistoryTick((t) => t + 1)), [])

  const showToast = (msg: string, type: 'success' | 'info' | 'error' = 'info') => setToast({ msg, type })

  // ── Search (real retrieval only) ────────────────────────────────────────────

  const runSearch = useCallback(async (rawQuery: string, opts: { force?: boolean } = {}) => {
    const q = rawQuery.trim()
    if (!q) return
    setSearching(true)
    setSearchFailed(null)
    setActiveView('compare')
    try {
      const result = await searchService.run(q, location, opts)
      setSearch(result)
      setListingTab(result.offers.some((o) => o.kind === 'shoppable') ? 'shoppable' : 'reference')
      const shoppable = comparableOffers(result.offers).length
      setHistory((prev) => [
        {
          query: q,
          timestamp: new Date().toISOString(),
          offerCount: shoppable,
          identityName: result.identity?.name,
        },
        ...prev.filter((h) => h.query.toLowerCase() !== q.toLowerCase()),
      ].slice(0, 20))
      const live = result.results.filter((r) => r.offers.length > 0).length
      showToast(
        shoppable
          ? `${shoppable} verified offer(s) from ${live} live source(s)`
          : live > 0
            ? `${live} source(s) responded — no verified offers for this query`
            : 'No source returned data — see status for reasons',
        shoppable ? 'success' : 'info',
      )
    } catch (err) {
      setSearch(null)
      setSearchFailed(err instanceof Error ? err.message : 'Search failed')
      showToast('Search failed — no data was fabricated to fill the page', 'error')
    } finally {
      setSearching(false)
    }
  }, [location, setHistory])

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (query.trim()) runSearch(query.trim())
  }

  const refresh = () => {
    if (search?.query) runSearch(search.query, { force: true })
    else showToast('Run a search first — refresh re-queries live sources', 'info')
  }

  const toggleWishlist = (identity: ProductIdentity) => {
    const key = productKeyOf(identity)
    if (wishlist.some((w) => productKeyOf(w.identity) === key)) {
      setWishlist((w) => w.filter((i) => productKeyOf(i.identity) !== key))
      showToast('Removed from wishlist', 'info')
    } else {
      setWishlist((w) => [...w, { identity, addedAt: new Date().toISOString() }])
      showToast('Saved to wishlist', 'success')
    }
  }

  const saveAlert = (identity: ProductIdentity, price: number) => {
    const best = search && search.identity && productKeyOf(search.identity) === productKeyOf(identity)
      ? summarize(search.offers).bestPrice
      : undefined
    const alert: PriceAlert = {
      id: uid(),
      productKey: productKeyOf(identity),
      productName: identity.name,
      targetPrice: price,
      currency: best?.currency ?? 'INR',
      currentBest: best ? (finalPrice(best) ?? best.price) : null,
      currentBestSource: best?.sourceName ?? null,
      status: 'active',
      createdAt: new Date().toISOString(),
    }
    setAlerts((a) => [alert, ...a.filter((x) => x.productKey !== alert.productKey)])
    setAlertFor(null)
    showToast(
      best
        ? `Alert set — we’ll flag ${identity.name} below ${formatMoney(price, alert.currency)} (current verified best: ${formatMoney(alert.currentBest, alert.currency)})`
        : `Alert set — no verified price exists yet, so it will start checking on your next searches`,
      'success',
    )
  }

  // ── AI ──────────────────────────────────────────────────────────────────────

  const submitAiPrompt = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const text = aiDraft.trim()
    if (!text || aiThinking) return
    setAiMessages((m) => [...m, { id: uid(), role: 'user', content: text, timestamp: Date.now() }])
    setAiDraft('')
    setAiThinking(true)
    await new Promise((r) => setTimeout(r, 350)) // let the UI settle; no data is generated
    const reply = assistantAnswer(text, { result: search })
    setAiMessages((m) => [...m, {
      id: uid(),
      role: 'assistant',
      content: reply.content,
      timestamp: Date.now(),
      citations: reply.citations,
    }])
    setAiThinking(false)
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const identity = search?.identity ?? null
  const isSaved = identity ? wishlist.some((w) => productKeyOf(w.identity) === productKeyOf(identity)) : false

  const offersForTab = useMemo(() => {
    if (!search) return []
    const pool = search.offers.filter((o) => o.kind === listingTab)
    return sortOffers(pool, sort === 'match' ? 'overall' : sort)
  }, [search, listingTab, sort])

  const summary = useMemo(() => (search ? summarize(search.offers) : {}), [search])
  const collected = useMemo(
    () => (identity ? getCollectedPoints(productKeyOf(identity)) : []),
    [identity, search, history, allCollectedPoints().length],
  )
  const collectedCurrency = summary.bestPrice?.currency ?? collected[0]?.currency ?? 'INR'

  const liveCount = search?.results.filter((r) => r.offers.length > 0).length ?? 0
  const authCount = search?.results.filter((r) => r.status === 'auth_required').length
    ?? registry.list().filter((a) => a.requiresAuth()).length
  const pendingCount = PENDING_STORES.length

  const changeView = (v: ViewId) => {
    setActiveView(v)
    setSidebarOpen(false)
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
            <X size={18} />
          </button>
        </div>

        <button className="sidebar-location" onClick={() => setLocationOpen(true)} aria-label="Set delivery area">
          <span className="sidebar-location-icon"><MapPin size={14} /></span>
          <span className="sidebar-location-text">
            <span>Delivery area</span>
            <strong>{location ?? 'Not set'}</strong>
          </span>
          <ChevronRight size={15} />
        </button>

        <nav aria-label="Workspace navigation">
          <p className="side-label">Workspace</p>
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const badge = id === 'alerts' ? alerts.length : id === 'wishlist' ? wishlist.length : 0
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

        <div className="source-health" aria-live="polite">
          <div className="health-topline">
            <span className={`pulse-dot${liveCount ? '' : ' off'}`} aria-hidden="true" />
            <span>Source status</span>
            <Database size={15} />
          </div>
          <strong>{liveCount ? `${liveCount} source${liveCount > 1 ? 's' : ''} returned data` : 'No live query yet'}</strong>
          <p>
            <span>{authCount}</span> need your key · <span>{pendingCount}</span> pending integration
          </p>
          <button onClick={() => changeView('sources')}>
            Manage sources <ArrowUpRight size={13} />
          </button>
        </div>

        <div className="sidebar-user">
          <div className="user-avatar" aria-hidden="true"><ShieldCheck size={16} /></div>
          <div className="user-copy">
            <strong>Local workspace</strong>
            <span>Your keys &amp; history stay on this device</span>
          </div>
          <Settings2 size={16} />
        </div>
      </aside>

      {sidebarOpen && (
        <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Main ── */}
      <main className="main-content">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}>
            <Menu size={21} />
          </button>

          <div className="topbar-location-wrap">
            <button className="topbar-location" onClick={() => setLocationOpen(true)}>
              <span className="location-pin"><MapPin size={15} fill="currentColor" /></span>
              <span>
                <small>Area</small>
                <strong>{location ?? 'Set delivery area'}</strong>
              </span>
              <ChevronDown size={15} />
            </button>
          </div>

          <div className="topbar-actions">
            <div className={`live-source-pill${liveCount ? '' : ' none'}`} title="Sources that returned real data on the last search">
              <span className={`pulse-dot${liveCount ? '' : ' off'}`} aria-hidden="true" />
              {liveCount ? `${liveCount} live` : 'No live sources'}
            </div>

            <button className="ask-ai-button" onClick={() => setAiOpen(true)} aria-label="Open AI shopping assistant">
              <Sparkles size={14} />
              Ask AI
            </button>

            <button
              className={`icon-button refresh-button${searching ? ' refreshing' : ''}`}
              onClick={refresh}
              aria-label="Re-query all sources"
              title="Re-query live sources"
              disabled={searching}
            >
              <RefreshCw size={17} />
            </button>

            <button className="icon-button" onClick={() => setDarkMode((d) => !d)} aria-label="Toggle dark mode">
              {darkMode ? <Sunrise size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        {activeView === 'compare' && (
          <CompareView
            query={query}
            setQuery={setQuery}
            searchInputRef={searchInputRef}
            onSearch={handleSearch}
            onRun={runSearch}
            searching={searching}
            searchFailed={searchFailed}
            search={search}
            listingTab={listingTab}
            setListingTab={setListingTab}
            sort={sort}
            setSort={setSort}
            offersForTab={offersForTab}
            summary={summary}
            collected={collected}
            collectedCurrency={collectedCurrency}
            identity={identity}
            isSaved={isSaved}
            onWishlist={toggleWishlist}
            onAlert={setAlertFor}
            onSelectOffer={setSelectedOffer}
            onOpenLocation={() => setLocationOpen(true)}
            collectedCount={allCollectedPoints().length}
          />
        )}

        {activeView === 'sources' && (
          <SourcesView
            lastResult={search}
            registry={registry}
            onToast={showToast}
          />
        )}

        {activeView === 'alerts' && (
          <AlertsView
            alerts={alerts}
            onDelete={(id) => { setAlerts((a) => a.filter((x) => x.id !== id)); showToast('Alert deleted', 'info') }}
            onGoCompare={() => changeView('compare')}
          />
        )}

        {activeView === 'wishlist' && (
          <WishlistView
            wishlist={wishlist}
            onSearch={(q) => runSearch(q)}
            onRemove={(key) => {
              setWishlist((w) => w.filter((i) => productKeyOf(i.identity) !== key))
              showToast('Removed from wishlist', 'info')
            }}
          />
        )}

        {activeView === 'history' && (
          <HistoryView
            history={history}
            onSearch={(q) => runSearch(q)}
            onClear={() => { setHistory([]); showToast('Search history cleared', 'info') }}
          />
        )}
      </main>

      {/* ── Location dialog ── */}
      {locationOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Set delivery area" onMouseDown={(e) => { if (e.target === e.currentTarget) setLocationOpen(false) }}>
          <div className="modal-body location-modal">
            <div className="modal-kicker"><MapPin size={14} /> Delivery area</div>
            <h3>Where are you shopping from?</h3>
            <p className="modal-disclaimer">
              The area is passed to sources that support location-based results. None of the currently
              integrated instant-delivery services expose an authorized API yet, so no instant
              serviceability claims are made.
            </p>
            <form
              className="config-form"
              onSubmit={(e) => {
                e.preventDefault()
                setLocation(locationDraft.trim() || null)
                setLocationOpen(false)
                showToast(locationDraft.trim() ? `Delivery area set to ${locationDraft.trim()}` : 'Delivery area cleared', 'info')
              }}
            >
              <input
                value={locationDraft}
                onChange={(e) => setLocationDraft(e.target.value)}
                placeholder="City, area or pincode"
                aria-label="Delivery area"
                autoFocus
              />
              <button type="button" className="secondary-button" onClick={() => setLocationDraft('')}>
                Clear
              </button>
              <button type="submit" className="primary-button">Save area</button>
            </form>
          </div>
        </div>
      )}

      {/* ── Offer modal ── */}
      {selectedOffer && (
        <OfferModal offer={selectedOffer} onClose={() => setSelectedOffer(null)} />
      )}

      {/* ── Alert modal ── */}
      {alertFor && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) setAlertFor(null) }}>
          <div className="modal-body">
            <div className="modal-kicker"><Bell size={14} /> Price alert</div>
            <h3>{alertFor.name}</h3>
            <p className="modal-disclaimer">
              Alerts are checked against verified prices PriceRadar retrieves on your future searches.
              {summary.bestPrice
                ? ` Current verified best: ${formatMoney(finalPrice(summary.bestPrice) ?? summary.bestPrice.price, summary.bestPrice.currency)} at ${summary.bestPrice.sourceName}.`
                : ' No verified price exists for this product yet.'}
            </p>
            <form className="config-form" onSubmit={(e) => {
              e.preventDefault()
              const v = Number(alertPrice)
              if (v > 0) saveAlert(alertFor, v)
            }}>
              <input
                value={alertPrice}
                onChange={(e) => setAlertPrice(e.target.value)}
                inputMode="numeric"
                placeholder={`Target price (${collectedCurrency})`}
                aria-label="Target price"
                autoFocus
              />
              <button type="submit" className="primary-button">Set alert</button>
            </form>
          </div>
        </div>
      )}

      {/* ── AI panel ── */}
      {aiOpen && (
        <AiPanel
          messages={aiMessages}
          draft={aiDraft}
          setDraft={setAiDraft}
          thinking={aiThinking}
          endRef={aiEndRef}
          onClose={() => setAiOpen(false)}
          onSubmit={submitAiPrompt}
          hasSearch={!!search}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className={`toast toast-${toast.type ?? 'info'}`} role="status" aria-live="polite">
          {toast.type === 'success' && <Check size={15} />}
          {toast.type === 'error' && <AlertCircle size={15} />}
          {(!toast.type || toast.type === 'info') && <Info size={15} />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}

// ─── Compare view ─────────────────────────────────────────────────────────────

interface CompareViewProps {
  query: string
  setQuery: (q: string) => void
  searchInputRef: React.RefObject<HTMLInputElement>
  onSearch: (e: FormEvent<HTMLFormElement>) => void
  onRun: (q: string) => void
  searching: boolean
  searchFailed: string | null
  search: SearchResult | null
  listingTab: 'shoppable' | 'reference'
  setListingTab: (t: 'shoppable' | 'reference') => void
  sort: SortKey
  setSort: (s: SortKey) => void
  offersForTab: Offer[]
  summary: ReturnType<typeof summarize>
  collected: ReturnType<typeof getCollectedPoints>
  collectedCurrency: string
  identity: ProductIdentity | null
  isSaved: boolean
  onWishlist: (identity: ProductIdentity) => void
  onAlert: (identity: ProductIdentity) => void
  onSelectOffer: (o: Offer) => void
  onOpenLocation: () => void
  collectedCount: number
}

function CompareView(p: CompareViewProps) {
  const { search } = p
  const hasOffers = !!search?.offers.length
  const series = buildSeries(p.collected, p.collectedCurrency)
  const insight = collectedInsight(p.collected, p.collectedCurrency)

  return (
    <div className="page-content">
      {/* Hero & search */}
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="eyebrow-spark"><Sparkles size={11} /></span>
            Real-data-only price comparison
          </p>
          <h1>
            One product.<br />
            <em>Every verified price.</em>{' '}
            <span>Nothing invented.</span>
          </h1>
          <p className="hero-description">
            PriceRadar retrieves live listings from authorized sources, matches the exact product, and
            shows real prices with their provenance. When a source has no data, we say so — we never
            fill the page with made-up offers.
          </p>
        </div>

        <form className="search-bar" role="search" onSubmit={p.onSearch}>
          <span className="search-icon"><Search size={19} /></span>
          <input
            ref={p.searchInputRef}
            value={p.query}
            onChange={(e) => p.setQuery(e.target.value)}
            placeholder="Search a product, brand, or paste a barcode…"
            aria-label="Search for a product"
            autoComplete="off"
          />
          <button type="submit" className="search-submit" disabled={p.searching}>
            <Search size={14} />
            {p.searching ? 'Retrieving…' : 'Search live sources'}
          </button>
        </form>

        <div className="search-suggestions" role="listbox" aria-label="Search ideas">
          <div className="suggestions-heading">
            <span>Try a real search</span>
            <span>Every query hits live sources</span>
          </div>
          {SEARCH_HINTS.map((s) => (
            <button key={s.label} role="option" onMouseDown={() => { p.setQuery(s.label); p.onRun(s.label) }}>
              <span className="suggestion-icon">{s.label.match(/^\d+$/) ? <ScanBarcode size={13} /> : <Search size={13} />}</span>
              <span>
                <span className="suggestion-label">{s.label}</span>
                <span className="suggestion-hint">{s.hint}</span>
              </span>
              <ArrowUpRight size={13} />
            </button>
          ))}
        </div>
      </section>

      {p.searching && <SearchSkeleton />}

      {!p.searching && p.searchFailed && (
        <EmptyState
          icon={<AlertCircle size={22} />}
          title="Search could not be completed"
          body={p.searchFailed}
          actions={
            <button className="primary-button" onClick={() => p.onRun(p.query)}>
              <RefreshCw size={14} /> Try again
            </button>
          }
        />
      )}

      {!p.searching && !p.searchFailed && search && (
        <>
          {/* Identity */}
          <IdentityCard
            identity={search.identity}
            status={search.identityStatus}
            note={search.identityNote}
            candidates={search.candidates}
            onRun={p.onRun}
            isSaved={p.isSaved}
            onWishlist={p.onWishlist}
            onAlert={p.onAlert}
            hasOffers={hasOffers}
          />

          {/* Source status strip */}
          <SourceStatusStrip results={search.results} />

          {/* Summary */}
          {hasOffers && <SummaryCards summary={p.summary} />}

          {/* Offers / empty state */}
          {!hasOffers && (
            <EmptyState
              icon={<PackageOpen size={22} />}
              title="No verified prices found"
              body={
                <>
                  We couldn’t retrieve verified pricing for this product right now.
                  {search.results.some((r) => r.status === 'auth_required') && ' Connect an authorized source below to unlock more results.'}
                  {search.results.every((r) => !r.offers.length) && search.identity && ' The product resolved, but no integrated source returned a listing for it.'}
                </>
              }
              actions={
                <>
                  <button className="primary-button" onClick={() => p.onRun(search.query)}>
                    <RefreshCw size={14} /> Try again
                  </button>
                  <button className="secondary-button" onClick={p.onOpenLocation}>
                    <MapPin size={14} /> Change location
                  </button>
                  <button className="secondary-button" onClick={() => p.searchInputRef.current?.focus()}>
                    <Search size={14} /> Search another product
                  </button>
                </>
              }
            />
          )}

          {hasOffers && (
            <>
              <div className="controls-row">
                <div className="mode-tabs" role="tablist" aria-label="Result type">
                  <button
                    role="tab"
                    aria-selected={p.listingTab === 'shoppable'}
                    className={`mode-tab${p.listingTab === 'shoppable' ? ' active' : ''}`}
                    onClick={() => p.setListingTab('shoppable')}
                  >
                    Buyable listings
                    <span className="tab-count">{search.offers.filter((o) => o.kind === 'shoppable').length}</span>
                  </button>
                  <button
                    role="tab"
                    aria-selected={p.listingTab === 'reference'}
                    className={`mode-tab${p.listingTab === 'reference' ? ' active' : ''}`}
                    onClick={() => p.setListingTab('reference')}
                  >
                    Reference prices
                    <span className="tab-count">{search.offers.filter((o) => o.kind === 'reference').length}</span>
                  </button>
                </div>
                <div className="sort-wrap">
                  <label htmlFor="sort-select">Sort</label>
                  <select id="sort-select" value={p.sort} onChange={(e) => p.setSort(e.target.value as SortKey)}>
                    {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              {p.offersForTab.length === 0 ? (
                <EmptyState
                  icon={<PackageOpen size={22} />}
                  title={`No ${p.listingTab === 'shoppable' ? 'buyable listings' : 'reference prices'} for this search`}
                  body={
                    p.listingTab === 'shoppable'
                      ? 'No integrated source returned a purchasable listing. Reference prices from open datasets may still be available in the other tab.'
                      : 'No community-recorded prices exist for this exact product yet.'
                  }
                />
              ) : (
                <div className="offers-grid">
                  {p.offersForTab.map((o) => (
                    <OfferCard key={o.id} offer={o} onSelect={p.onSelectOffer} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Collected price history */}
          {search.identity && (
            <section className="history-chart-section" aria-label="Collected price history">
              <div className="section-heading">
                <div>
                  <p className="section-kicker"><TrendingUp size={12} /> Collected price history</p>
                  <h3>Only prices PriceRadar actually recorded</h3>
                </div>
              </div>
              {series.enough ? (
                <>
                  {insight && <p className="trend-insight">{insight}</p>}
                  <div className="history-chart-card">
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={series.points.map((pt) => ({
                        date: String(pt.observedAt).slice(0, 10),
                        price: pt.price,
                        label: `${pt.merchant ?? pt.sourceId} · ${String(pt.observedAt).slice(0, 10)}`,
                      }))}>
                        <defs>
                          <linearGradient id="ph" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--lime)" stopOpacity={0.5} />
                            <stop offset="100%" stopColor="var(--lime)" stopOpacity={0.04} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted)" />
                        <YAxis tick={{ fontSize: 11 }} stroke="var(--muted)" width={52} domain={['auto', 'auto']} />
                        <Tooltip
                          formatter={(v: number) => [formatMoney(v, p.collectedCurrency), p.collectedCurrency]}
                          labelFormatter={(_, payload) => (payload?.[0]?.payload?.label as string) ?? ''}
                        />
                        <Area type="monotone" dataKey="price" stroke="var(--lime)" fill="url(#ph)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                    <p className="chart-disclaimer">
                      {p.collectedCurrency} observations recorded by this PriceRadar install from real
                      retrievals and open datasets — {series.points.length} point(s). No generated history.
                    </p>
                  </div>
                </>
              ) : (
                <div className="empty-state history-empty">
                  <div className="empty-icon"><TrendingUp size={20} /></div>
                  <h4>Not enough historical data yet.</h4>
                  <p>
                    {p.collected.length === 0
                      ? 'PriceRadar hasn’t recorded any price for this product yet. Every search adds real observations.'
                      : `Only ${p.collected.length} observation(s) recorded so far — at least two on different dates are needed before a trend chart is shown.`}
                  </p>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {!p.searching && !p.searchFailed && !search && (
        <EmptyState
          icon={<Radar size={22} />}
          title="Start with a real search"
          body={
            <>
              Search a packaged product by name or barcode. PriceRadar will resolve the exact product via
              Open Food Facts and query every connected price source. Until sources return data, this page
              stays honest — empty, not fabricated.
              <span className="empty-note">
                {p.collectedCount > 0
                  ? ` Your workspace has ${p.collectedCount} recorded real price observation(s).`
                  : ' Connect authorized sources in Data sources for wider coverage.'}
              </span>
            </>
          }
        />
      )}
    </div>
  )
}

// ─── Search skeleton ──────────────────────────────────────────────────────────

function SearchSkeleton() {
  return (
    <div className="search-progress" role="status" aria-live="polite">
      <div className="search-progress-row">
        <span className="pulse-dot" aria-hidden="true" />
        <span>Resolving product identity in Open Food Facts…</span>
      </div>
      <div className="search-progress-row muted">
        <span>Querying connected sources (authorized APIs only)…</span>
      </div>
      <div className="search-progress-row muted">
        <span>Unresponsive sources will be listed as unavailable — never estimated.</span>
      </div>
    </div>
  )
}

// ─── Identity card ────────────────────────────────────────────────────────────

function IdentityCard(props: {
  identity: ProductIdentity | null
  status: ProviderStatus
  note?: string
  candidates: ProductIdentity[]
  onRun: (q: string) => void
  isSaved: boolean
  onWishlist: (identity: ProductIdentity) => void
  onAlert: (identity: ProductIdentity) => void
  hasOffers: boolean
}) {
  const { identity } = props
  if (!identity) {
    return (
      <div className="identity-card unresolved">
        <div className="identity-icon"><ScanBarcode size={20} /></div>
        <div className="identity-body">
          <p className="section-kicker">Product identity</p>
          <h3>No verified product identity found</h3>
          <p className="identity-note">
            {props.note ?? 'The identity source returned no match for this search, so nothing can be compared — a wrong match would be worse than none.'}
          </p>
        </div>
        <StatusChip status={props.status} />
      </div>
    )
  }
  const fresh = describeFreshness(identity.retrievedAt)
  return (
    <div className="identity-card">
      {identity.imageUrl ? (
        <img className="identity-image" src={identity.imageUrl} alt={identity.name} loading="lazy" />
      ) : (
        <div className="identity-image identity-image-fallback" aria-hidden="true">
          {identity.name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="identity-body">
        <p className="section-kicker">
          <BadgeCheck size={12} /> Verified product identity · {identity.sourceName}
        </p>
        <h3>{identity.name}</h3>
        <div className="identity-meta">
          {identity.brand && <span className="chip">{identity.brand}</span>}
          {identity.quantity && <span className="chip">{identity.quantity}</span>}
          {identity.barcode && <span className="chip mono"><ScanBarcode size={11} /> {identity.barcode}</span>}
          <span className={`freshness-${fresh.cls === 'live' ? 'live' : 'cached'}`}>{fresh.label}</span>
        </div>
      </div>
      <div className="identity-actions">
        <a className="icon-button" href={identity.url} target="_blank" rel="noreferrer noopener" aria-label={`View ${identity.name} on ${identity.sourceName}`} title="View source record">
          <ExternalLink size={16} />
        </a>
        <button className="icon-button" onClick={() => props.onWishlist(identity)} aria-label={props.isSaved ? 'Remove from wishlist' : 'Save to wishlist'} title={props.isSaved ? 'Remove from wishlist' : 'Save to wishlist'}>
          <Heart size={16} fill={props.isSaved ? 'currentColor' : 'none'} />
        </button>
        <button className="secondary-button" onClick={() => props.onAlert(identity)}>
          <Bell size={14} /> Alert
        </button>
      </div>
      {props.candidates.length > 0 && (
        <div className="identity-candidates">
          <span>Other real matches found:</span>
          {props.candidates.slice(0, 3).map((c) => (
            <button key={c.id} className="chip chip-button" onClick={() => props.onRun(c.barcode ?? c.name)} title={c.name}>
              {c.name.slice(0, 42)}{c.name.length > 42 ? '…' : ''}{c.quantity ? ` · ${c.quantity}` : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusChip({ status }: { status: ProviderStatus }) {
  const meta = STATUS_META[status]
  return <span className={`status-chip ${meta.cls}`}>{meta.label}</span>
}

// ─── Source status strip ──────────────────────────────────────────────────────

function SourceStatusStrip({ results }: { results: ProviderResult[] }) {
  return (
    <section className="source-strip" aria-label="Per-source retrieval status">
      <p className="section-kicker"><Database size={12} /> Source status on this search</p>
      <div className="source-strip-grid">
        {results.map((r) => {
          const meta = STATUS_META[r.status]
          const detail = r.offers.length
            ? `${r.offers.length} result(s) · ${r.latencyMs !== null ? `${r.latencyMs} ms` : ''}`
            : (r.note ?? r.error ?? 'No results')
          return (
            <div key={r.sourceId} className={`source-chip ${meta.cls}`} title={detail}>
              <span className="source-chip-name">{r.sourceName}</span>
              <span className="source-chip-status">
                {r.status === 'live' ? `✓ Live · ${r.offers.length}` : `✗ ${meta.label}`}
              </span>
              <span className="source-chip-detail">{detail}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ─── Summary cards ────────────────────────────────────────────────────────────

function SummaryCards({ summary }: { summary: ReturnType<typeof summarize> }) {
  if (!summary.bestPrice) return null
  const { bestPrice, fastest, savings } = summary
  const cards = [
    {
      key: 'best', icon: <BadgeCheck size={16} />, label: 'Best verified price',
      price: priceLine(bestPrice),
      provider: `${bestPrice.sourceName}${bestPrice.merchant && bestPrice.merchant !== bestPrice.sourceName ? ` · ${bestPrice.merchant}` : ''}`,
      meta: bestPrice.productUrl ? 'Real listing · fees as disclosed' : 'Fees undisclosed → at checkout',
      extra: savings ? `${formatMoney(savings, bestPrice.currency)} below next verified option` : undefined,
    },
    fastest ? {
      key: 'fast', icon: <Truck size={16} />, label: 'Fastest verified delivery',
      price: fastest.etaMinutes !== null ? `~${fastest.etaMinutes} min` : (fastest.deliveryNote ?? 'Estimate unavailable'),
      provider: `${fastest.sourceName}${fastest.merchant && fastest.merchant !== fastest.sourceName ? ` · ${fastest.merchant}` : ''}`,
      meta: fastest.etaMinutes === null && !fastest.deliveryNote
        ? 'No source-supplied ETA — not guessed'
        : (fastest.deliveryNote ?? 'Source-supplied estimate'),
    } : null,
  ].filter(Boolean) as Array<{ key: string; icon: ReactNode; label: string; price: string; provider: string; meta: string; extra?: string }>

  return (
    <div className="summary-row">
      {cards.map((c) => (
        <div key={c.key} className="summary-card">
          <div className="summary-icon">{c.icon}</div>
          <div className="summary-copy">
            <span className="summary-label">{c.label}</span>
            <span className="summary-price">{c.price}</span>
            <span className="summary-provider">{c.provider}</span>
            <span className="summary-meta">{c.meta}{c.extra ? ` · ${c.extra}` : ''}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Offer card ───────────────────────────────────────────────────────────────

function OfferCard({ offer, onSelect }: { offer: Offer; onSelect: (o: Offer) => void }) {
  const fresh = offerFreshness(offer)
  const disc = discountPercent(offer)
  const isRef = offer.kind === 'reference'
  return (
    <article className={`offer-card${isRef ? ' reference' : ''}`}>
      <div className="offer-provider-bar">
        <div className="offer-provider-mark" aria-hidden="true">
          {offer.sourceName.slice(0, 2).toUpperCase()}
        </div>
        <div className="offer-provider-name">
          <strong>{offer.merchant ?? offer.sourceName}</strong>
          <span>via {offer.sourceName}</span>
        </div>
        <span className={`match-pill match-${offer.match}`}>{offer.matchConfidence}</span>
      </div>

      <div className="offer-body">
        <h4 className="offer-product-name" title={offer.productName}>{offer.productName}</h4>
        <div className="offer-product-meta">
          {offer.brand && <span className="chip">{offer.brand}</span>}
          {offer.quantity && <span className="chip">{offer.quantity}</span>}
          {offer.barcode && <span className="chip mono"><ScanBarcode size={11} /> {offer.barcode}</span>}
          {offer.condition && <span className="chip">{offer.condition}</span>}
        </div>

        <div className="offer-price-row">
          <div className="offer-price-detail">
            <strong className="offer-final-price">{priceLine(offer)}</strong>
            {offer.mrp !== null && offer.mrp > offer.price && (
              <span className="offer-mrp">
                {formatMoney(offer.mrp, offer.currency)}
                {disc !== null && disc > 0 ? ` · −${disc}%` : ''}
              </span>
            )}
            {finalPrice(offer) === null && (
              <span className="checkout-note">Some fees undisclosed by this source</span>
            )}
          </div>
          <div className={`offer-freshness freshness-${fresh.cls === 'live' ? 'live' : 'cached'}`}>
            {fresh.label}
          </div>
        </div>

        <div className="offer-delivery-row">
          <span className={`offer-stock avail-${offer.availability === 'in_stock' ? 'in' : offer.availability === 'out_of_stock' ? 'unavailable' : 'low'}`}>
            {offer.stockLabel}
          </span>
          <span className="offer-eta">
            <Truck size={12} />
            {offer.deliveryNote ?? (offer.etaMinutes !== null ? `~${offer.etaMinutes} min` : 'Delivery estimate unavailable')}
          </span>
          {offer.locationLabel && (
            <span className="offer-eta"><MapPin size={12} /> {offer.locationLabel}</span>
          )}
        </div>

        {isRef && offer.observedAt && (
          <p className="ref-observed">
            <Clock3 size={12} /> Observed {String(offer.observedAt).slice(0, 10)} — community-recorded reference price, not a buyable listing.
          </p>
        )}
        {offer.offerLabel && <span className="offer-badge">{offer.offerLabel}</span>}

        <div className="offer-actions">
          <button className="offer-details-btn" onClick={() => onSelect(offer)}>
            Details &amp; provenance
          </button>
          {offer.productUrl ? (
            <a className="offer-link-btn" href={offer.productUrl} target="_blank" rel="noreferrer noopener">
              View on provider <ExternalLink size={12} />
            </a>
          ) : (
            <span className="offer-link-btn none" title="This source does not expose a listing URL">No listing link</span>
          )}
        </div>
      </div>
    </article>
  )
}

// ─── Offer modal (fee breakdown + provenance) ─────────────────────────────────

function OfferModal({ offer, onClose }: { offer: Offer; onClose: () => void }) {
  const rows = buildFeeRows(offer)
  const total = finalPrice(offer)
  const fresh = offerFreshness(offer)
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-body offer-modal">
        <div className="modal-kicker"><ShieldCheck size={14} /> Full provenance</div>
        <h3>{offer.productName}</h3>

        <div className="breakdown-box">
          <div className="breakdown-head">
            <span>Estimated payable price</span>
            <strong>{total === null ? `${formatMoney(offer.price, offer.currency)} + checkout charges` : formatMoney(total, offer.currency)}</strong>
          </div>
          {rows.map(([label, value]) => (
            <div className="breakdown-row" key={label}>
              <span>{label}</span>
              <span className={value === null ? 'fee-unknown' : value < 0 ? 'fee-free' : 'fee-paid'}>
                {value === null ? 'Unknown — shown at checkout' : formatMoney(value, offer.currency)}
              </span>
            </div>
          ))}
          {offer.fees.note && <p className="fee-note">{offer.fees.note}</p>}
          {total === null && (
            <p className="fee-note">
              Unknown charges are never assumed to be zero. The final payable amount is confirmed at checkout.
            </p>
          )}
        </div>

        <div className="modal-facts">
          <div className="modal-meta-row"><span>Source</span><strong>{offer.sourceName}</strong></div>
          {offer.merchant && <div className="modal-meta-row"><span>Merchant</span><strong>{offer.merchant}</strong></div>}
          <div className="modal-meta-row"><span>Availability</span><strong>{offer.stockLabel}</strong></div>
          <div className="modal-meta-row"><span>Delivery</span><strong>{offer.deliveryNote ?? (offer.etaMinutes !== null ? `~${offer.etaMinutes} min` : 'Not supplied')}</strong></div>
          <div className="modal-meta-row"><span>Retrieved</span><strong>{new Date(offer.retrievedAt).toLocaleString('en-IN')}</strong></div>
          {offer.observedAt && (
            <div className="modal-meta-row"><span>Observed upstream</span><strong>{String(offer.observedAt).slice(0, 10)}</strong></div>
          )}
          <div className="modal-meta-row"><span>Freshness</span><strong>{fresh.label}</strong></div>
          <div className="modal-meta-row"><span>Match</span><strong>{offer.matchConfidence} — {offer.matchReason}</strong></div>
          <div className="modal-meta-row"><span>Product barcode</span><strong className="mono">{offer.barcode ?? 'Not supplied'}</strong></div>
        </div>

        <div className="modal-actions">
          {offer.productUrl ? (
            <a className="primary-modal-button" href={offer.productUrl} target="_blank" rel="noreferrer noopener">
              View on provider <ExternalLink size={13} />
            </a>
          ) : (
            <span className="secondary-modal-button none">No listing URL from this source</span>
          )}
          <button className="secondary-modal-button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ─── Sources view ─────────────────────────────────────────────────────────────

function SourcesView({ lastResult, registry, onToast }: {
  lastResult: SearchResult | null
  registry: ProviderRegistry
  onToast: (msg: string, type?: 'success' | 'info' | 'error') => void
}) {
  const adapters = registry.list()
  const lastById = new Map((lastResult?.results ?? []).map((r) => [r.sourceId, r]))
  const configurable = adapters.filter((a) => CREDENTIAL_SPECS[a.id])
  const openKeyless = adapters.filter((a) => !CREDENTIAL_SPECS[a.id] && !a.staticStatus)
  const pending = adapters.filter((a) => a.staticStatus === 'integration_pending')

  return (
    <div className="page-content">
      <div className="utility-page-head">
        <div>
          <p className="section-kicker"><Database size={12} /> Data sources &amp; integration status</p>
          <h2>Where every price comes from</h2>
        </div>
      </div>

      <div className="policy-card">
        <ShieldCheck size={18} />
        <div>
          <strong>No fabricated data — ever</strong>
          <p>
            PriceRadar shows a price only when an authorized source actually returned it. Sources without
            an authorized integration are listed as pending — never simulated, scraped, or estimated.
            Failed lookups show “unavailable”, and undisclosed fees stay “unknown until checkout”.
          </p>
        </div>
      </div>

      <section className="utility-card-head">
        <h3>Authorized sources you can connect</h3>
        <p>Keys are stored on this device only and travel solely to your PriceRadar gateway.</p>
      </section>
      <div className="sources-list">
        {configurable.map((a) => (
          <ConfigurableSource
            key={a.id}
            adapterId={a.id}
            name={a.name}
            note={a.accessNote}
            docsUrl={a.docsUrl}
            last={lastById.get(a.id)}
            onToast={onToast}
          />
        ))}
      </div>

      <section className="utility-card-head">
        <h3>Open, keyless sources</h3>
        <p>Public open APIs — real data, no account needed. Availability depends on their service status.</p>
      </section>
      <div className="sources-list">
        {openKeyless.map((a) => (
          <SourceRow
            key={a.id}
            name={a.name}
            kind={a.kind}
            note={a.accessNote}
            docsUrl={a.docsUrl}
            last={lastById.get(a.id)}
            idleStatus={registry.idleStatus(a)}
          />
        ))}
      </div>

      <section className="utility-card-head">
        <h3>Pending integration — no authorized access yet</h3>
        <p>
          These stores have no public/authorized API PriceRadar may use. They are listed for
          transparency; they will never return estimated data.
        </p>
      </section>
      <div className="pending-grid">
        {pending.map((a) => {
          const store = PENDING_STORES.find((s) => s.id === a.id)
          return (
            <div key={a.id} className="pending-card" title={a.accessNote}>
              <Lock size={13} />
              <strong>{a.name}</strong>
              <span>{store?.kind === 'instant' ? 'Instant delivery' : store?.kind === 'marketplace' ? 'Marketplace' : 'E-commerce'}</span>
              <p>No authorized API yet — never simulated</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SourceRow(props: {
  name: string
  kind: string
  note: string
  docsUrl?: string
  last?: ProviderResult
  idleStatus: ProviderStatus
}) {
  const status = props.last?.status ?? props.idleStatus
  const detail = props.last
    ? (props.last.offers.length ? `${props.last.offers.length} result(s) on last search` : (props.last.note ?? props.last.error ?? 'No results on last search'))
    : 'Not queried yet'
  return (
    <div className="source-row">
      <div className="source-row-head">
        <strong>{props.name}</strong>
        <StatusChip status={status} />
      </div>
      <p>{props.note}</p>
      <div className="source-row-foot">
        <span>{detail}</span>
        {props.docsUrl && (
          <a href={props.docsUrl} target="_blank" rel="noreferrer noopener">API docs <ExternalLink size={11} /></a>
        )}
        <span className="source-kind">{props.kind === 'reference' ? 'Reference data' : 'Listings'}</span>
      </div>
    </div>
  )
}

function ConfigurableSource({ adapterId, name, note, docsUrl, last, onToast }: {
  adapterId: string
  name: string
  note: string
  docsUrl?: string
  last?: ProviderResult
  onToast: (msg: string, type?: 'success' | 'info' | 'error') => void
}) {
  const spec = CREDENTIAL_SPECS[adapterId]
  const [values, setValues] = useState<Record<string, string>>(() => providerConfig.get(adapterId))
  const configured = providerConfig.isConfigured(adapterId)
  return (
    <div className="source-row configurable">
      <div className="source-row-head">
        <strong>{name}</strong>
        <StatusChip status={last?.status ?? (configured ? 'connected' : 'auth_required')} />
      </div>
      <p>{note}</p>
      <form
        className="config-form"
        onSubmit={(e) => {
          e.preventDefault()
          providerConfig.set(adapterId, values)
          onToast(`${name} credentials saved on this device — run a search to query it`, 'success')
        }}
      >
        {spec.fields.map((f) => (
          <input
            key={f.key}
            type="password"
            value={values[f.key] ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            placeholder={f.label}
            aria-label={f.label}
            title={f.hint}
            autoComplete="off"
          />
        ))}
        <button type="submit" className="primary-button"><KeyRound size={13} /> Save</button>
        {configured && (
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              providerConfig.clear(adapterId)
              setValues({})
              onToast(`${name} credentials removed`, 'info')
            }}
          >
            Remove
          </button>
        )}
      </form>
      {last && last.offers.length === 0 && last.error && <p className="source-row-error">{last.error}</p>}
      {docsUrl && (
        <div className="source-row-foot">
          <span />
          <a href={docsUrl} target="_blank" rel="noreferrer noopener">API docs <ExternalLink size={11} /></a>
        </div>
      )}
    </div>
  )
}

// ─── Alerts / Wishlist / History ──────────────────────────────────────────────

function AlertsView({ alerts, onDelete, onGoCompare }: {
  alerts: PriceAlert[]
  onDelete: (id: string) => void
  onGoCompare: () => void
}) {
  return (
    <div className="page-content">
      <div className="utility-page-head">
        <div>
          <p className="section-kicker"><BellRing size={12} /> Price alerts</p>
          <h2>Your alerts</h2>
        </div>
      </div>
      {alerts.length === 0 ? (
        <EmptyState
          icon={<Bell size={22} />}
          title="No alerts yet"
          body="Set an alert from a verified product card. Alerts reference real products only and compare against prices PriceRadar actually retrieves."
          actions={<button className="primary-button" onClick={onGoCompare}><Search size={14} /> Compare a product</button>}
        />
      ) : (
        <div className="alerts-table-card">
          {alerts.map((a) => (
            <div key={a.id} className="alert-row">
              <div className="alert-product-info">
                <strong>{a.productName}</strong>
                <span>
                  Alert below {formatMoney(a.targetPrice, a.currency)}
                  {a.currentBest !== null
                    ? ` · last verified best ${formatMoney(a.currentBest, a.currency)}${a.currentBestSource ? ` (${a.currentBestSource})` : ''}`
                    : ' · no verified price recorded yet'}
                </span>
              </div>
              <button className="icon-button" aria-label="Delete alert" onClick={() => onDelete(a.id)}>
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function WishlistView({ wishlist, onSearch, onRemove }: {
  wishlist: WishlistItem[]
  onSearch: (q: string) => void
  onRemove: (key: string) => void
}) {
  return (
    <div className="page-content">
      <div className="utility-page-head">
        <div>
          <p className="section-kicker"><Heart size={12} /> Wishlist</p>
          <h2>Saved products</h2>
        </div>
      </div>
      {wishlist.length === 0 ? (
        <EmptyState
          icon={<Heart size={22} />}
          title="Nothing saved yet"
          body="Search a real product and save it from its identity card. Wishlists contain only products verified through a real identity source."
        />
      ) : (
        <div className="wishlist-grid">
          {wishlist.map((w) => (
            <div key={productKeyOf(w.identity)} className="wishlist-card">
              {w.identity.imageUrl && <img className="wishlist-art" src={w.identity.imageUrl} alt="" loading="lazy" />}
              <div className="wishlist-copy">
                <strong>{w.identity.name}</strong>
                <span>{[w.identity.brand, w.identity.quantity].filter(Boolean).join(' · ') || w.identity.barcode}</span>
                <span className="wishlist-provider">Identity: {w.identity.sourceName}</span>
              </div>
              <div className="wishlist-actions">
                <button className="secondary-button" onClick={() => onSearch(w.identity.barcode ?? w.identity.name)}>
                  Compare
                </button>
                <button className="icon-button" aria-label="Remove" onClick={() => onRemove(productKeyOf(w.identity))}>
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function HistoryView({ history, onSearch, onClear }: {
  history: SearchHistoryEntry[]
  onSearch: (q: string) => void
  onClear: () => void
}) {
  return (
    <div className="page-content">
      <div className="utility-page-head">
        <div>
          <p className="section-kicker"><History size={12} /> Search history</p>
          <h2>Your searches</h2>
        </div>
        {history.length > 0 && (
          <button className="secondary-button" onClick={onClear}>Clear history</button>
        )}
      </div>
      {history.length === 0 ? (
        <EmptyState
          icon={<History size={22} />}
          title="No searches yet"
          body="Your real searches and their verified result counts will appear here."
        />
      ) : (
        <div className="history-list-card">
          {history.map((h, i) => (
            <div key={`${h.query}-${i}`} className="history-row">
              <button className="history-query" onClick={() => onSearch(h.query)}>
                <Search size={13} /> {h.query}
              </button>
              <span className="history-meta">
                {h.identityName ? `${h.identityName} · ` : ''}{h.offerCount} verified offer(s)
              </span>
              <span className="history-meta">{new Date(h.timestamp).toLocaleString('en-IN')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ icon, title, body, actions }: {
  icon: ReactNode
  title: string
  body: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="empty-state main-empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{body}</p>
      {actions && <div className="empty-actions">{actions}</div>}
    </div>
  )
}

// ─── AI panel ─────────────────────────────────────────────────────────────────

function AiPanel(props: {
  messages: AiMessage[]
  draft: string
  setDraft: (v: string) => void
  thinking: boolean
  endRef: React.RefObject<HTMLDivElement>
  onClose: () => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  hasSearch: boolean
}) {
  return (
    <div className="ai-panel-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) props.onClose() }} role="dialog" aria-modal="true" aria-label="AI shopping assistant">
      <div className="ai-panel">
        <div className="ai-panel-header">
          <span className="ai-icon"><Sparkles size={15} /></span>
          <div className="ai-panel-title">
            <strong>PriceRadar Assistant</strong>
            <span>Grounded in retrieved data only</span>
          </div>
          <button className="modal-close" onClick={props.onClose} aria-label="Close AI panel"><X size={18} /></button>
        </div>

        <div className="ai-chat">
          {props.messages.length === 0 && (
            <div className="ai-message assistant">
              <div className="message-avatar"><Radar size={14} /></div>
              <div className="message-bubble">
                <p>
                  I only discuss prices and offers PriceRadar actually retrieved from connected sources.
                  I can’t and won’t invent prices, availability, delivery times, or discounts.
                </p>
                {!props.hasSearch && <p>Run a product search first — then ask me about cheapest options, delivery, or price history.</p>}
              </div>
            </div>
          )}
          {props.messages.map((m) => (
            <div key={m.id} className={`ai-message ${m.role}`}>
              <div className="message-avatar">{m.role === 'assistant' ? <Radar size={14} /> : '👤'}</div>
              <div className="message-bubble">
                {m.content.split('\n').map((line, i) => (
                  <p key={i} className={line.startsWith('**') ? 'ai-strong' : undefined}>
                    {renderLine(line)}
                  </p>
                ))}
                {m.citations && m.citations.length > 0 && (
                  <div className="ai-citations">
                    <span className="ai-citations-label">Data basis</span>
                    {m.citations.map((c, i) => (
                      <span key={i} className="ai-citation">
                        {c.sourceName}{c.merchant && c.merchant !== c.sourceName ? ` · ${c.merchant}` : ''} · {formatMoney(c.price, c.currency)} · checked {Math.max(1, Math.round((Date.now() - c.retrievedAt) / 60000))} min ago
                        {c.productUrl && <a href={c.productUrl} target="_blank" rel="noreferrer noopener" aria-label="Open cited listing"><ExternalLink size={10} /></a>}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {props.thinking && (
            <div className="ai-loading">Reading retrieved records…</div>
          )}
          <div ref={props.endRef} />
        </div>

        <div className="prompt-chips" aria-label="Suggested prompts">
          {AI_QUICK_PROMPTS.map((pr) => (
            <button key={pr} onClick={() => props.setDraft(pr)}>{pr}</button>
          ))}
        </div>

        <form className="ai-input-wrap" onSubmit={props.onSubmit}>
          <input
            value={props.draft}
            onChange={(e) => props.setDraft(e.target.value)}
            placeholder={props.hasSearch ? 'Ask about the retrieved offers…' : 'Run a search first, then ask me…'}
            aria-label="Ask the assistant"
          />
          <button type="submit" className="primary-button" disabled={props.thinking}>Ask</button>
        </form>

        <p className="ai-disclaimer">
          Deterministic assistant: every figure is copied or computed from cited retrieval records. No generative shopping data.
        </p>
      </div>
    </div>
  )
}

/** Minimal inline formatter for the assistant’s plain-text replies. */
function renderLine(line: string): ReactNode {
  const parts = line.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>,
  )
}
