import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import {
  AlertCircle,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BellRing,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  ExternalLink,
  Eye,
  Filter,
  Gift,
  Globe2,
  Heart,
  History,
  Info,
  LayoutDashboard,
  ListFilter,
  MapPin,
  Menu,
  Minus,
  Moon,
  MoreHorizontal,
  PackageCheck,
  PanelLeftClose,
  Plus,
  RefreshCw,
  Radar,
  Search,
  Settings2,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Sun,
  Tag,
  TrendingDown,
  Truck,
  Users,
  WalletCards,
  X,
  Zap,
} from 'lucide-react'
import { catalog, defaultProduct, findProduct, providers } from './data/catalog'
import { discountPercent, feeTotal, finalPrice, formatRupees, sortOffers, summarize } from './domain/compare'
import type { DeliveryMode, MatchLevel, Offer, Product } from './domain/types'

 type Mode = DeliveryMode | 'all'
type ViewId = 'compare' | 'overview' | 'alerts' | 'wishlist' | 'history'
type SortKey = 'overall' | 'price' | 'speed'

const navItems: Array<{ id: ViewId; label: string; icon: typeof Radar; badge?: string }> = [
  { id: 'compare', label: 'Compare prices', icon: Radar },
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'alerts', label: 'Price alerts', icon: BellRing, badge: '3' },
  { id: 'wishlist', label: 'Wishlist', icon: Heart, badge: '4' },
  { id: 'history', label: 'Search history', icon: History },
]

const searchSuggestions = [
  { label: 'iPhone 16 128GB black', icon: 'phone' },
  { label: 'AirPods Pro 2', icon: 'audio' },
  { label: 'cheapest shampoo near me', icon: 'spark' },
]

const locations = ['Koramangala, Bengaluru', 'Indiranagar, Bengaluru', 'HSR Layout, Bengaluru']

function App() {
  const [activeView, setActiveView] = useState<ViewId>('compare')
  const [query, setQuery] = useState('Amul Taaza Milk 1L')
  const [product, setProduct] = useState<Product>(defaultProduct)
  const [mode, setMode] = useState<Mode>('instant')
  const [providerFilter, setProviderFilter] = useState('all')
  const [sort, setSort] = useState<SortKey>('overall')
  const [exactOnly, setExactOnly] = useState(true)
  const [location, setLocation] = useState(locations[0])
  const [locationOpen, setLocationOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null)
  const [alertOpen, setAlertOpen] = useState(false)
  const [alertSet, setAlertSet] = useState(false)
  const [alertPrice, setAlertPrice] = useState('55')
  const [aiOpen, setAiOpen] = useState(false)
  const [aiDraft, setAiDraft] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const modeOffers = useMemo(() => {
    let offers = product.offers.filter((offer) => mode === 'all' || offer.mode === mode)
    if (providerFilter !== 'all') offers = offers.filter((offer) => offer.provider.id === providerFilter)
    return offers
  }, [mode, product, providerFilter])

  const exactModeOffers = useMemo(() => {
    let offers = product.offers.filter((offer) => mode === 'all' || offer.mode === mode)
    if (exactOnly) offers = offers.filter((offer) => offer.match === 'exact')
    return offers
  }, [mode, product, exactOnly])

  const visibleOffers = useMemo(() => {
    let offers = modeOffers
    if (exactOnly) offers = offers.filter((offer) => offer.match === 'exact')
    return sortOffers(offers, sort)
  }, [modeOffers, exactOnly, sort])

  const comparisonSummary = useMemo(() => summarize(exactModeOffers), [exactModeOffers])
  const instantCount = product.offers.filter((offer) => offer.mode === 'instant').length
  const normalCount = product.offers.filter((offer) => offer.mode === 'normal').length
  const connectedProviderCount = providers.filter((item) => item.isConnected).length
  const availableProviders = providers.filter((item) => product.offers.some((offer) => offer.provider.id === item.id && (mode === 'all' || offer.mode === mode)))

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const runSearch = (nextQuery: string) => {
    const nextProduct = findProduct(nextQuery)
    setQuery(nextQuery)
    setProduct(nextProduct)
    setActiveView('compare')
    setProviderFilter('all')
    setSearchOpen(false)
    // A product that exists only in the normal-delivery catalog opens there first.
    setMode(nextProduct.offers.some((offer) => offer.mode === 'instant') ? 'instant' : 'normal')
    setToast(`Comparing ${nextProduct.name}`)
  }

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (query.trim()) runSearch(query.trim())
  }

  const chooseLocation = (nextLocation: string) => {
    setLocation(nextLocation)
    setLocationOpen(false)
    setToast(`Showing availability around ${nextLocation.split(',')[0]}`)
  }

  const refreshOffers = () => {
    setIsRefreshing(true)
    window.setTimeout(() => {
      setIsRefreshing(false)
      setToast('All connected sources checked just now')
    }, 900)
  }

  const shareComparison = async () => {
    const shareText = `${product.name} price comparison on PriceRadar`
    try {
      await navigator.clipboard?.writeText(window.location.href)
      setToast('Comparison link copied to clipboard')
    } catch {
      setToast(`${shareText} is ready to share`)
    }
  }

  const saveProduct = () => {
    setSaved((current) => !current)
    setToast(saved ? 'Removed from wishlist' : 'Saved to wishlist')
  }

  const changeView = (view: ViewId) => {
    setActiveView(view)
    setSidebarOpen(false)
  }

  const submitAiPrompt = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!aiDraft.trim()) return
    runSearch(aiDraft.trim())
    setAiOpen(false)
    setAiDraft('')
  }

  return (
    <div className={`app-shell${darkMode ? ' dark-mode' : ''}`}>
      <aside className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>
        <div className="brand-row">
          <div className="brand-lockup">
            <span className="brand-mark"><Radar size={21} strokeWidth={2.6} /></span>
            <span className="brand-name">Price<span>Radar</span></span>
          </div>
          <button className="icon-button sidebar-close" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}><PanelLeftClose size={18} /></button>
        </div>

        <div className="sidebar-location">
          <div className="sidebar-location-icon"><MapPin size={14} /></div>
          <div>
            <span>Shopping around</span>
            <strong>{location.split(',')[0]}</strong>
          </div>
          <ChevronRight size={15} />
        </div>

        <nav className="side-navigation" aria-label="Main navigation">
          <p className="side-label">Workspace</p>
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button key={item.id} className={`nav-item${activeView === item.id ? ' active' : ''}`} onClick={() => changeView(item.id)}>
                <Icon size={18} strokeWidth={activeView === item.id ? 2.4 : 2} />
                <span>{item.label}</span>
                {item.badge && <span className="nav-badge">{item.badge}</span>}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-spacer" />

        <div className="source-health">
          <div className="health-topline"><span className="pulse-dot" /> <span>Source health</span><MoreHorizontal size={16} /></div>
          <strong>All systems normal</strong>
          <p><span>{connectedProviderCount}</span> providers refreshed in the last 5 min</p>
          <div className="health-bars" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
          <button onClick={() => setToast('Provider management is coming soon')}>Manage sources <ArrowUpRight size={13} /></button>
        </div>

        <div className="sidebar-user">
          <div className="user-avatar">AK</div>
          <div className="user-copy"><strong>Arjun Kapoor</strong><span>Personal account</span></div>
          <Settings2 size={16} />
        </div>
      </aside>
      {sidebarOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}

      <main className="main-content">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={21} /></button>
          <div className="topbar-location-wrap">
            <button className="topbar-location" onClick={() => setLocationOpen((current) => !current)}>
              <span className="location-pin"><MapPin size={15} fill="currentColor" /></span>
              <span><small>Deliver to</small><strong>{location}</strong></span>
              <ChevronDown size={15} />
            </button>
            {locationOpen && (
              <div className="location-menu">
                <div className="location-menu-header"><span>Choose your area</span><button onClick={() => setLocationOpen(false)}><X size={15} /></button></div>
                {locations.map((item) => <button key={item} className={item === location ? 'selected' : ''} onClick={() => chooseLocation(item)}><MapPin size={15} /><span>{item}</span>{item === location && <Check size={15} />}</button>)}
                <button className="add-location" onClick={() => setToast('Address search will be available soon')}><Plus size={15} /> Add a new address</button>
              </div>
            )}
          </div>
          <div className="topbar-actions">
            <button className="ask-ai-button" onClick={() => setAiOpen(true)}><Sparkles size={15} /> <span>Ask PriceRadar AI</span></button>
            <span className="live-source-pill"><span className="pulse-dot" /> 10 live sources</span>
            <button className="icon-button theme-toggle" aria-label="Toggle theme" onClick={() => setDarkMode((current) => !current)}>{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button>
            <button className="icon-button notification-button" aria-label="Notifications" onClick={() => setToast('You have 3 active price alerts')}><Bell size={19} /><i /></button>
            <div className="topbar-avatar">AK</div>
          </div>
        </header>

        {activeView === 'alerts' ? (
          <AlertsView onCompare={() => changeView('compare')} onSetAlert={() => setAlertOpen(true)} />
        ) : activeView === 'wishlist' ? (
          <WishlistView onProduct={(item) => { setProduct(item); setQuery(`${item.name} ${item.quantity}`); setMode(item.offers.some((offer) => offer.mode === 'instant') ? 'instant' : 'normal'); changeView('compare') }} />
        ) : activeView === 'history' ? (
          <HistoryView onSearch={runSearch} />
        ) : (
          <>
            <section className="hero-section">
              <div className="hero-copy">
                <p className="eyebrow"><span className="eyebrow-spark"><Sparkles size={12} /></span> AI-powered price intelligence</p>
                <h1>One product.<br /><em>Every price.</em> <span>One smart choice.</span></h1>
                <p className="hero-description">Search once. See the real total from every trusted store around you — then buy with confidence.</p>
              </div>
              <div className="hero-proof">
                <div className="proof-avatars"><span>AM</span><span>FL</span><span>+8</span></div>
                <div><strong>Smarter shopping starts here</strong><span>Compare before you checkout</span></div>
                <ShieldCheck size={19} />
              </div>
              <form className="search-bar" onSubmit={handleSearch}>
                <Search size={20} className="search-icon" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => setSearchOpen(true)} placeholder="Search any product, brand or ask a question..." aria-label="Search for a product" />
                <kbd>⌘ K</kbd>
                <button type="submit" className="search-submit"><Sparkles size={16} /> Compare prices</button>
                {searchOpen && (
                  <div className="search-suggestions">
                    <div className="suggestions-heading"><span>Try asking PriceRadar</span><span>Suggestions</span></div>
                    {searchSuggestions.map((suggestion) => <button type="button" key={suggestion.label} onMouseDown={(event) => event.preventDefault()} onClick={() => runSearch(suggestion.label)}><span className="suggestion-icon">{suggestion.icon === 'phone' ? <ShoppingBag size={15} /> : suggestion.icon === 'audio' ? <PackageCheck size={15} /> : <Sparkles size={15} />}</span><span>{suggestion.label}</span><ArrowUpRight size={14} /></button>)}
                    <div className="suggestions-hint"><Sparkles size={13} /> You can ask for a budget, delivery time or location too</div>
                  </div>
                )}
              </form>
            </section>

            <div className="page-content">
              <div className="section-heading comparison-heading">
                <div>
                  <p className="section-kicker"><span className="live-dot" /> LIVE MARKET SNAPSHOT</p>
                  <h2>Compare offers</h2>
                  <p className="section-subtitle">We found {product.offers.length} listings for <strong>{product.name}</strong></p>
                </div>
                <div className="heading-actions">
                  <button className="secondary-button" onClick={shareComparison}><Share2 size={15} /> <span>Share</span></button>
                  <button className={`secondary-button refresh-button${isRefreshing ? ' refreshing' : ''}`} onClick={refreshOffers}><RefreshCw size={15} /> <span>{isRefreshing ? 'Checking…' : 'Refresh all'}</span></button>
                </div>
              </div>

              <section className="product-overview-card">
                <div className="product-overview-main">
                  <div className="product-art-wrap"><ProductArt kind={product.imageKind} /></div>
                  <div className="product-overview-copy">
                    <div className="product-kicker"><span>{product.category}</span><span className="match-pill"><Check size={11} /> Product matched</span></div>
                    <h3>{product.name}</h3>
                    <p>{product.brand} <span>·</span> {product.variant} <span>·</span> {product.quantity}</p>
                    <div className="overview-meta"><span><PackageCheck size={14} /> {product.description}</span><button onClick={() => setToast('Product details are matched using brand, variant and identifiers')}><Info size={14} /> How we match</button></div>
                    <div className="product-actions"><button className={`save-button${saved ? ' saved' : ''}`} onClick={saveProduct}>{saved ? <Check size={15} /> : <Heart size={15} />} {saved ? 'Saved' : 'Save product'}</button><button className="text-button" onClick={() => setAlertOpen(true)}><BellRing size={15} /> Set price alert</button></div>
                  </div>
                </div>
                <div className="trend-overview">
                  <div className="trend-header"><div><span>Price trend</span><strong><TrendingDown size={16} /> {formatRupees(Math.abs(product.priceHistory.change))} lower</strong></div><span className="trend-period">{product.priceHistory.period}</span></div>
                  <div className="trend-chart"><Sparkline points={product.priceHistory.points} /></div>
                  <div className="trend-foot"><span>High {formatRupees(product.priceHistory.highest)}</span><span>Low {formatRupees(product.priceHistory.lowest)}</span></div>
                </div>
              </section>

              <section className="summary-grid">
                <SummaryMetric icon={<WalletCards size={18} />} tone="green" label="Cheapest total" offer={comparisonSummary.bestPrice} helper="after all known fees" onClick={() => setSort('price')} />
                <SummaryMetric icon={<Zap size={18} />} tone="yellow" label="Fastest delivery" offer={comparisonSummary.fastest} helper="to your location" onClick={() => setSort('speed')} />
                <SummaryMetric icon={<Sparkles size={18} />} tone="purple" label="Best overall" offer={comparisonSummary.bestOverall} helper="price + speed + trust" featured onClick={() => setSort('overall')} />
                <div className="summary-savings"><div className="savings-icon"><TrendingDown size={17} /></div><div><span>Potential savings</span><strong>{savingsAgainstHighest(exactModeOffers)}</strong><small>vs. highest exact offer</small></div><ArrowUpRight size={15} /></div>
              </section>

              <div className="mode-tabs-wrap">
                <div className="mode-tabs" role="tablist" aria-label="Delivery mode">
                  <button className={mode === 'instant' ? 'active' : ''} onClick={() => { setMode('instant'); setProviderFilter('all') }} role="tab"><Zap size={16} /> Instant delivery <span>{instantCount}</span></button>
                  <button className={mode === 'normal' ? 'active' : ''} onClick={() => { setMode('normal'); setProviderFilter('all') }} role="tab"><PackageCheck size={16} /> Normal delivery <span>{normalCount}</span></button>
                  <button className={mode === 'all' ? 'active' : ''} onClick={() => { setMode('all'); setProviderFilter('all') }} role="tab"><Globe2 size={16} /> Compare all <span>{product.offers.length}</span></button>
                </div>
                <div className="mode-context"><span className="context-pulse" /> Prices for <strong>{location.split(',')[0]}</strong></div>
              </div>

              <section className="offers-layout">
                <div className="offers-panel">
                  <div className="offers-toolbar">
                    <div className="offers-count"><strong>{visibleOffers.length} {exactOnly ? 'exact' : 'matching'} offers</strong><span>•</span><span>Updated seconds ago</span></div>
                    <div className="filter-actions">
                      <label className="filter-select"><Filter size={14} /><select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)} aria-label="Filter by provider"><option value="all">All providers</option>{providers.filter((item) => mode === 'all' || (mode === 'instant' ? item.kind === 'instant' : item.kind !== 'instant')).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown size={14} /></label>
                      <label className="filter-select sort-select"><ListFilter size={14} /><select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} aria-label="Sort offers"><option value="overall">Best overall</option><option value="price">Lowest total</option><option value="speed">Fastest first</option></select><ChevronDown size={14} /></label>
                      <button className={`exact-toggle${exactOnly ? ' active' : ''}`} onClick={() => setExactOnly((current) => !current)}><span className="toggle-track"><span /></span> Exact only</button>
                    </div>
                  </div>
                  <div className="offer-column-labels"><span>Provider & match</span><span>Item price</span><span>Delivery</span><span>Final payable</span><span /></div>
                  {visibleOffers.length ? visibleOffers.map((offer) => <OfferCard key={offer.id} offer={offer} summary={comparisonSummary} onDetails={setSelectedOffer} />) : <EmptyOffers mode={mode} onShowNormal={() => setMode('normal')} />}
                  <div className="provider-footnote"><ShieldCheck size={15} /><span>Only authorized or provider-approved data sources are included. Fees marked <b>At checkout</b> are not estimated.</span><button onClick={() => setToast('Learn more about PriceRadar data sources')}>Learn more <ArrowUpRight size={13} /></button></div>
                </div>

                <aside className="insights-column">
                  <section className="ai-recommendation-card">
                    <div className="ai-card-heading"><span className="ai-icon"><Sparkles size={16} /></span><span>Radar recommendation</span><span className="ai-live-label">AI</span></div>
                    {comparisonSummary.bestOverall ? <><h3>{comparisonSummary.bestOverall.provider.name} is your best overall</h3><p>It balances the lowest total with a {comparisonSummary.bestOverall.etaLabel} arrival and a verified exact match.</p><div className="recommendation-total"><div><span>Payable total</span><strong>{formatRupees(finalPrice(comparisonSummary.bestOverall))}</strong></div><button onClick={() => setSelectedOffer(comparisonSummary.bestOverall!)}>See why <ArrowUpRight size={14} /></button></div></> : <><h3>No exact match yet</h3><p>Try Compare all or search for another variant to get a recommendation.</p></>}
                    <div className="ai-card-footer"><span><ShieldCheck size={13} /> Based on actual offer data</span><button onClick={() => setAiOpen(true)}>Ask why <ChevronRight size={13} /></button></div>
                  </section>

                  <section className="price-history-card">
                    <div className="card-section-heading"><div><span className="card-label">PRICE HISTORY</span><h3>Is now a good time?</h3></div><button className="more-button" onClick={() => setToast('Detailed price history is coming soon')}><MoreHorizontal size={17} /></button></div>
                    <div className="history-price"><strong>{formatRupees(product.priceHistory.average)}</strong><span>average</span><em><ArrowDownRight size={13} /> {priceChangePercent(product)}% this period</em></div>
                    <div className="history-chart"><Sparkline points={product.priceHistory.points} /></div>
                    <p className="history-note"><span className="small-trend-icon"><TrendingDown size={12} /></span> Current price is <strong>attractive</strong> versus the {product.priceHistory.period} average.</p>
                    <button className="outline-full-button" onClick={() => setAlertOpen(true)}><BellRing size={14} /> Alert me below {formatRupees(product.priceHistory.lowest + 1)}</button>
                  </section>

                  <section className="trust-card"><div className="trust-icon"><ShieldCheck size={17} /></div><div><strong>Transparent by design</strong><p>See every fee before you buy. No hidden markups.</p></div><button onClick={() => setToast('Every total is calculated from the provider fee breakdown')}><Info size={15} /></button></section>
                </aside>
              </section>
            </div>
          </>
        )}
      </main>

      {selectedOffer && <OfferDetailsModal offer={selectedOffer} onClose={() => setSelectedOffer(null)} />}
      {alertOpen && <AlertModal product={product} price={alertPrice} setPrice={setAlertPrice} alertSet={alertSet} onClose={() => setAlertOpen(false)} onSave={() => { setAlertSet(true); setAlertOpen(false); setToast(`We'll alert you when ${product.name} drops below ₹${alertPrice}`) }} />}
      {aiOpen && <AiPanel draft={aiDraft} setDraft={setAiDraft} onClose={() => setAiOpen(false)} onSubmit={submitAiPrompt} onPrompt={(prompt) => { setAiDraft(prompt) }} />}
      {toast && <div className="toast"><span className="toast-icon"><Check size={15} /></span><span>{toast}</span><button onClick={() => setToast(null)}><X size={14} /></button></div>}
    </div>
  )
}

function ProviderMark({ offer, size = 'medium' }: { offer: Offer; size?: 'small' | 'medium' | 'large' }) {
  return <span className={`provider-mark ${size}`} style={{ '--mark-color': offer.provider.color, '--mark-bg': offer.provider.background } as CSSProperties}>{offer.provider.mark}</span>
}

function ProductArt({ kind }: { kind: Product['imageKind'] }) {
  if (kind === 'phone') return <div className="product-art phone-art"><div className="phone-shadow" /><div className="phone-device"><div className="phone-island"><i /><i /></div><span className="phone-glow" /></div></div>
  if (kind === 'audio') return <div className="product-art audio-art"><div className="audio-case"><div className="case-lid" /><div className="earbud left"><i /></div><div className="earbud right"><i /></div><span></span></div></div>
  if (kind === 'shampoo') return <div className="product-art shampoo-art"><div className="shampoo-shadow" /><div className="shampoo-bottle"><div className="shampoo-cap" /><span>H&S</span><strong>cool<br />menthol</strong><i /></div></div>
  return <div className="product-art milk-art"><div className="milk-shadow" /><div className="milk-pack"><div className="milk-fold" /><span className="milk-brand">AMUL</span><strong>Taaza</strong><small>TONED MILK</small><div className="milk-splash" /><div className="milk-sun" /></div></div>
}

function Sparkline({ points }: { points: number[] }) {
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const coordinates = points.map((point, index) => `${(index / (points.length - 1)) * 100},${86 - ((point - min) / range) * 68}`).join(' ')
  const lastX = 100
  const lastY = 86 - ((points[points.length - 1] - min) / range) * 68
  return <svg className="sparkline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Price trend chart" role="img"><defs><linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#c9ef71" stopOpacity=".32" /><stop offset="100%" stopColor="#c9ef71" stopOpacity="0" /></linearGradient></defs><polygon points={`0,100 ${coordinates} 100,100`} fill="url(#spark-fill)" /><polyline points={coordinates} fill="none" stroke="#b9df68" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><circle cx={lastX} cy={lastY} r="3.5" fill="#c9ef71" stroke="#17232d" strokeWidth="2" /></svg>
}

function SummaryMetric({ icon, tone, label, offer, helper, featured, onClick }: { icon: ReactNode; tone: string; label: string; offer?: Offer; helper: string; featured?: boolean; onClick: () => void }) {
  return <button className={`summary-metric ${featured ? 'featured' : ''}`} onClick={onClick}><span className={`metric-icon ${tone}`}>{icon}</span><span className="metric-copy"><span className="metric-label">{label}</span><strong>{offer ? formatRupees(finalPrice(offer)) : '—'}</strong><small>{offer ? `${offer.provider.name} · ${helper}` : 'Not available for this view'}</small></span><ChevronRight size={16} className="metric-arrow" /></button>
}

function OfferCard({ offer, summary, onDetails }: { offer: Offer; summary: ReturnType<typeof summarize>; onDetails: (offer: Offer) => void }) {
  const isBest = offer.id === summary.bestPrice?.id
  const isFastest = offer.id === summary.fastest?.id
  const isOverall = offer.id === summary.bestOverall?.id
  const total = finalPrice(offer)
  const fees = feeTotal(offer)
  const isLowStock = offer.availability === 'low_stock'
  return <article className={`offer-card${isOverall ? ' recommended-offer' : ''}`}>
    <div className="offer-grid">
      <div className="offer-provider-cell">
        <div className="provider-line"><ProviderMark offer={offer} /><div><strong>{offer.provider.name}</strong><span>{offer.freshness === 'live' ? <><span className="tiny-live-dot" /> Live price</> : `${offer.freshness === 'recent' ? 'Updated' : 'Cached'} ${offer.updatedSeconds}s ago`}</span></div></div>
        <div className="match-line"><MatchBadge match={offer.match} /><button onClick={() => onDetails(offer)}>{Math.round(offer.matchScore * 100)}% match <Info size={12} /></button></div>
      </div>
      <div className="offer-price-cell"><strong>{formatRupees(offer.price)}</strong><span><s>{formatRupees(offer.mrp)}</s><em>{discountPercent(offer)}% off</em></span><small>{offer.pricePerUnit}</small></div>
      <div className="offer-delivery-cell"><div className="delivery-time"><Clock3 size={16} /><strong>{offer.etaLabel}</strong>{isFastest && <span className="fastest-badge">Fastest</span>}</div><span className="delivery-location"><MapPin size={12} /> {offer.location}</span><span className={`stock-status ${isLowStock ? 'low-stock' : ''}`}><i /> {offer.stockLabel}</span></div>
      <div className="offer-total-cell"><span>Final payable</span><strong>{formatRupees(total)}</strong><small>{fees !== null ? `+ ${formatRupees(fees)} fees` : 'Fee at checkout'}</small>{isBest && <span className="offer-tag best-tag"><TrendingDown size={11} /> Best price</span>}{isOverall && !isBest && <span className="offer-tag value-tag"><Sparkles size={11} /> Best value</span>}</div>
      <div className="offer-action-cell"><button className="details-button" onClick={() => onDetails(offer)}>Details</button><a className="shop-button" href={offer.url} target="_blank" rel="noreferrer">Shop <ArrowUpRight size={14} /></a><button className="more-button" onClick={() => onDetails(offer)} aria-label={`More details for ${offer.provider.name}`}><MoreHorizontal size={17} /></button></div>
    </div>
    {(isBest || isFastest || isOverall) && <div className="offer-highlights"><span className="highlight-label">Radar says</span>{isOverall && <span><Sparkles size={12} /> Best overall balance</span>}{isBest && <span><TrendingDown size={12} /> Lowest total after fees</span>}{isFastest && <span><Zap size={12} /> Reaches you in {offer.etaLabel}</span>}<span className="highlight-seller"><ShieldCheck size={12} /> {offer.seller}</span></div>}
  </article>
}

function MatchBadge({ match }: { match: MatchLevel }) {
  const labels: Record<MatchLevel, string> = { exact: 'Exact match', likely: 'Likely match', similar: 'Similar product' }
  return <span className={`match-badge ${match}`}><span />{labels[match]}</span>
}

function EmptyOffers({ mode, onShowNormal }: { mode: Mode; onShowNormal: () => void }) {
  return <div className="empty-offers"><span className="empty-icon"><Radar size={24} /></span><h3>No exact {mode === 'instant' ? 'instant-delivery' : 'matching'} offers here</h3><p>We won't rank similar products as exact. Try normal delivery or turn off “Exact only” to inspect other matches.</p><button onClick={onShowNormal}>View normal delivery <ArrowRight size={15} /></button></div>
}

function savingsAgainstHighest(offers: Offer[]): string {
  const totals = offers.filter((offer) => offer.match === 'exact').map((offer) => finalPrice(offer)).filter((total): total is number => total !== null)
  if (totals.length < 2) return '—'
  return formatRupees(Math.max(...totals) - Math.min(...totals))
}

function priceChangePercent(product: Product): number {
  return Math.round((Math.abs(product.priceHistory.change) / product.priceHistory.average) * 100)
}

function OfferDetailsModal({ offer, onClose }: { offer: Offer; onClose: () => void }) {
  const feeRows = [
    ['Product price', offer.price],
    ['Delivery fee', offer.fees.delivery],
    ['Platform / service fee', offer.fees.platform],
    ['Handling charge', offer.fees.handling],
    ['Other applicable charges', offer.fees.other],
  ] as Array<[string, number | null]>
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="detail-modal" role="dialog" aria-modal="true" aria-label="Offer details" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><div><p className="modal-kicker">PRICE BREAKDOWN</p><h2>{offer.provider.name} offer</h2></div><button className="modal-close" onClick={onClose} aria-label="Close details"><X size={18} /></button></div><div className="modal-provider"><ProviderMark offer={offer} size="large" /><div><strong>{offer.productName}</strong><span>{offer.variant} · {offer.quantity}</span><div><MatchBadge match={offer.match} /><span className="modal-freshness"><span className="tiny-live-dot" /> {offer.freshness === 'live' ? 'Live source' : `Updated ${offer.updatedSeconds}s ago`}</span></div></div></div><div className="breakdown-box"><div className="breakdown-head"><span>Transparent total</span><span>{offer.etaLabel} delivery</span></div>{feeRows.map(([label, value]) => <div className="breakdown-row" key={label}><span>{label}{label === 'Product price' && <small>MRP {formatRupees(offer.mrp)}</small>}</span><strong>{value === null ? <em>At checkout</em> : formatRupees(value)}</strong></div>)}<div className="breakdown-total"><span>Final payable price</span><strong>{formatRupees(finalPrice(offer))}</strong></div></div>{offer.fees.note && <p className="fee-note"><Info size={14} /> {offer.fees.note}</p>}<div className="modal-facts"><div><span>Sold by</span><strong>{offer.seller}</strong></div><div><span>Availability</span><strong className="available-copy"><i /> {offer.stockLabel}</strong></div><div><span>Return policy</span><strong>{offer.returnPolicy ?? 'Provider policy'}</strong></div><div><span>Match confidence</span><strong>{Math.round(offer.matchScore * 100)}% <button onClick={() => undefined}><CircleHelp size={13} /></button></strong></div></div><div className="modal-actions"><a className="primary-modal-button" href={offer.url} target="_blank" rel="noreferrer">View on {offer.provider.name} <ExternalLink size={15} /></a><button className="secondary-modal-button" onClick={onClose}>Keep comparing</button></div><p className="modal-disclaimer"><ShieldCheck size={13} /> Price and stock can change at checkout. Last checked {offer.updatedSeconds} seconds ago.</p></section></div>
}

function AlertModal({ product, price, setPrice, alertSet, onClose, onSave }: { product: Product; price: string; setPrice: (value: string) => void; alertSet: boolean; onClose: () => void; onSave: () => void }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="alert-modal" role="dialog" aria-modal="true" aria-label="Set a price alert" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Close alert dialog"><X size={18} /></button><div className="alert-modal-icon"><BellRing size={20} /></div><p className="modal-kicker">PRICE ALERT</p><h2>Let the radar watch it.</h2><p className="alert-intro">We'll check connected sources and let you know when <strong>{product.name}</strong> falls below your target.</p><label className="target-price-label">Alert me below <span><span>₹</span><input value={price} onChange={(event) => setPrice(event.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" aria-label="Target price" /></span></label><div className="alert-current"><span>Best available now</span><strong>{formatRupees(Math.min(...product.offers.map((offer) => finalPrice(offer) ?? Infinity)))}</strong></div><button className="save-alert-button" onClick={onSave}>{alertSet ? <Check size={16} /> : <BellRing size={16} />} {alertSet ? 'Alert saved' : 'Save price alert'}</button><p className="alert-fineprint"><ShieldCheck size={12} /> You can manage alerts anytime from Price alerts</p></section></div>
}

function AiPanel({ draft, setDraft, onClose, onSubmit, onPrompt }: { draft: string; setDraft: (value: string) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onPrompt: (prompt: string) => void }) {
  const prompts = ['Find the cheapest iPhone 16 near me', 'Best deal under ₹1,000 delivered in 30 min', 'Compare this with Amazon']
  return <div className="ai-panel-backdrop" onMouseDown={onClose}><section className="ai-panel" onMouseDown={(event) => event.stopPropagation()}><div className="ai-panel-header"><div className="ai-panel-title"><span className="ai-icon large"><Sparkles size={17} /></span><div><strong>PriceRadar AI</strong><span>Your shopping co-pilot</span></div></div><button className="modal-close" onClick={onClose}><X size={18} /></button></div><div className="ai-chat"><div className="ai-message assistant"><span className="message-avatar"><Radar size={14} /></span><div><p>Tell me what you want to buy, your budget, or how fast you need it. I’ll compare the real totals — not just sticker prices.</p><span className="message-time">Just now</span></div></div><div className="prompt-chips">{prompts.map((prompt) => <button key={prompt} onClick={() => onPrompt(prompt)}>{prompt}<ArrowUpRight size={13} /></button>)}</div></div><form className="ai-input-wrap" onSubmit={onSubmit}><input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask anything about a product..." /><button type="submit" aria-label="Send prompt"><ArrowUpRight size={17} /></button></form><p className="ai-disclaimer"><Info size={12} /> Recommendations use the latest connected offer data and show their sources.</p></section></div>
}

function AlertsView({ onCompare, onSetAlert }: { onCompare: () => void; onSetAlert: () => void }) {
  return <div className="page-content utility-page"><div className="utility-page-head"><div><p className="eyebrow"><span className="eyebrow-spark"><BellRing size={12} /></span> Never miss a better price</p><h1>Your price alerts</h1><p>PriceRadar is watching 3 products across connected stores.</p></div><button className="primary-button" onClick={onCompare}><Plus size={16} /> Track a product</button></div><div className="utility-stats"><div><span className="utility-stat-icon green"><TrendingDown size={17} /></span><div><strong>₹1,842</strong><small>saved by alerts this month</small></div></div><div><span className="utility-stat-icon yellow"><BellRing size={17} /></span><div><strong>3 active</strong><small>products being watched</small></div></div><div><span className="utility-stat-icon purple"><Zap size={17} /></span><div><strong>10 sources</strong><small>checked automatically</small></div></div></div><section className="alerts-table-card"><div className="utility-card-head"><div><span className="card-label">ACTIVE WATCHLIST</span><h2>Products you’re watching</h2></div><button className="secondary-button" onClick={onSetAlert}><Plus size={15} /> New alert</button></div><AlertRow product={catalog[0]} target="₹55" current="₹67" change="₹3 below average" /><AlertRow product={catalog[1]} target="₹68,000" current="₹69,499" change="₹1,500 to go" /><AlertRow product={catalog[2]} target="₹17,500" current="₹18,499" change="₹999 to go" /></section></div>
}

function AlertRow({ product, target, current, change }: { product: Product; target: string; current: string; change: string }) {
  return <div className="alert-row"><div className="alert-product-art"><ProductArt kind={product.imageKind} /></div><div className="alert-product"><strong>{product.name}</strong><span>{product.variant} · {product.quantity}</span></div><div className="alert-target"><span>Target</span><strong>{target}</strong></div><div className="alert-current"><span>Best now</span><strong>{current}</strong></div><div className={`alert-progress-copy${change.includes('below') ? ' reached' : ''}`}>{change.includes('below') ? <Check size={14} /> : <Clock3 size={14} />}{change}</div><button className="more-button"><MoreHorizontal size={17} /></button></div>
}

function WishlistView({ onProduct }: { onProduct: (product: Product) => void }) {
  return <div className="page-content utility-page"><div className="utility-page-head"><div><p className="eyebrow"><span className="eyebrow-spark"><Heart size={12} /></span> Your saved buys</p><h1>Wishlist</h1><p>Keep an eye on the products you’re considering.</p></div><button className="secondary-button" onClick={() => undefined}><Share2 size={15} /> Share wishlist</button></div><div className="wishlist-grid">{catalog.map((item) => <button key={item.id} className="wishlist-card" onClick={() => onProduct(item)}><div className="wishlist-art"><ProductArt kind={item.imageKind} /></div><div className="wishlist-copy"><div><span>{item.category}</span><Heart size={15} fill="currentColor" /></div><h3>{item.name}</h3><p>{item.variant} · {item.quantity}</p><strong>{formatRupees(Math.min(...item.offers.map((offer) => finalPrice(offer) ?? Infinity)))}</strong><small>best total across {item.offers.length} offers <ArrowUpRight size={12} /></small></div></button>)}</div></div>
}

function HistoryView({ onSearch }: { onSearch: (query: string) => void }) {
  const history = [
    { query: 'Amul Taaza Milk 1L', detail: '6 offers · Today, 10:42 AM', product: catalog[0] },
    { query: 'iPhone 16 128GB black', detail: '5 offers · Yesterday, 8:16 PM', product: catalog[1] },
    { query: 'AirPods Pro 2', detail: '3 offers · Aug 28, 4:02 PM', product: catalog[2] },
    { query: 'Head & Shoulders shampoo', detail: '4 offers · Aug 24, 11:28 AM', product: catalog[3] },
  ]
  return <div className="page-content utility-page"><div className="utility-page-head"><div><p className="eyebrow"><span className="eyebrow-spark"><History size={12} /></span> Pick up where you left off</p><h1>Search history</h1><p>Your recent comparisons, kept in one place.</p></div><button className="secondary-button" onClick={() => undefined}><TrashIcon /> Clear history</button></div><section className="history-list-card">{history.map((item, index) => <button className="history-row" key={item.query} onClick={() => onSearch(item.query)}><div className="history-number">0{index + 1}</div><div className="history-thumb"><ProductArt kind={item.product.imageKind} /></div><div className="history-query"><strong>{item.query}</strong><span>{item.detail}</span></div><div className="history-best"><span>Best total</span><strong>{formatRupees(Math.min(...item.product.offers.map((offer) => finalPrice(offer) ?? Infinity)))}</strong></div><ArrowRight size={17} /></button>)}</section></div>
}

function TrashIcon() {
  return <span className="trash-symbol">⌫</span>
}

export default App
