'use client'

import { useEffect, useState } from 'react'
import {
  Truck, ShieldCheck, Phone, CreditCard, Star, Heart, Globe,
  Instagram, Facebook, Loader2
} from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

const formatCOP = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v)

const LUCIDE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Truck, Shield: ShieldCheck, ShieldCheck, Phone, CreditCard, Star, Heart, Globe,
}

interface HomepageSection {
  id: string
  type: 'hero' | 'categoryGrid' | 'categoryStrip' | 'productGrid' | 'recipeGrid' | 'brandChips' | 'trustBadges' | 'newsletter' | 'footer' | 'pillRow'
  title: string; icon: string; enabled: boolean; sortOrder: number
  config: Record<string, any>
}

interface Props { storeSlug: string; storeName: string; storeLogo?: string }

/* ──────────────── Helper: product card skeleton ──────────────── */
function SkeletonGrid({ cols, rows, aspect = 'square' }: { cols: number; rows: number; aspect?: 'square' | 'video' }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {Array.from({ length: cols * rows }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl overflow-hidden border border-gray-100">
          <div className={aspect === 'video' ? 'aspect-video bg-gray-100 animate-pulse' : 'aspect-square bg-gray-100 animate-pulse'} />
          <div className="p-3 space-y-2">
            <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ──────────────── Helper: section header with optional "ver más" ──────────────── */
function SectionHeader({ title, link, linkText }: { title?: string; link?: string; linkText?: string }) {
  if (!title) return null
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-bold text-[#1A1A1A]">{title}</h2>
      {link && (
        <a href={link} className="text-sm font-semibold text-[#E30613] hover:underline">
          {linkText || 'Ver más'}
        </a>
      )}
    </div>
  )
}

/* ──────────────── Product card (shared by productGrid & pillRow) ──────────────── */
function ProductCard({ product, showBadges }: { product: any; showBadges?: string[] }) {
  return (
    <div className="bg-white rounded-xl overflow-hidden border border-gray-100 hover:shadow-md transition-shadow group">
      <div className="aspect-square bg-gray-50 relative overflow-hidden">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">📦</div>
        )}
        {showBadges?.includes('Nuevo') && product.isNewLaunch && (
          <span className="absolute top-2 left-2 bg-[#E30613] text-white text-[10px] font-bold px-2 py-0.5 rounded">Nuevo</span>
        )}
        {showBadges?.includes('Oferta') && product.isOnOffer && (
          <span className="absolute top-2 right-2 bg-[#FFC629] text-[#1A1A1A] text-[10px] font-bold px-2 py-0.5 rounded">Oferta</span>
        )}
      </div>
      <div className="p-3 space-y-1">
        {product.brand && <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{product.brand}</p>}
        <p className="text-sm font-medium text-[#1A1A1A] line-clamp-2 leading-tight">{product.name}</p>
        <p className="text-sm font-bold text-[#E30613]">{formatCOP(product.selling_price)}</p>
        <button className="w-full mt-2 text-xs font-semibold text-[#E30613] border border-[#E30613] rounded-lg py-1.5 hover:bg-[#E30613] hover:text-white transition-colors">Agregar</button>
      </div>
    </div>
  )
}

/* ── useFetch hook ── */
function useFetch<T>(url: string, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    setLoading(true)
    fetch(url).then(r => r.json()).then((d: any) => {
      if (alive) setData(d.success !== false ? (d.data ?? d) : null)
    }).catch(() => { if (alive) setData(null) }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, deps)
  return { data, loading }
}

/* ──────────────── SECTION RENDERERS ──────────────── */

function Hero({ config }: { config: Record<string, any> }) {
  return (
    <section className="relative overflow-hidden rounded-2xl" style={{ background: 'linear-gradient(120deg, #E30613, #A80410)' }}>
      {config.bgImage && <div className="absolute inset-0 opacity-20 bg-cover bg-center" style={{ backgroundImage: `url(${config.bgImage})` }} />}
      <div className="relative px-6 py-10 md:px-12 md:py-16 flex flex-col md:flex-row items-start md:items-center gap-6">
        <div className="flex-1 space-y-4">
          {config.eyebrow && <span className="inline-block bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full">{config.eyebrow}</span>}
          {config.title && <h1 className="text-3xl md:text-5xl font-black text-white leading-tight">{config.title}</h1>}
          {config.subtitle && <p className="text-white/80 text-sm md:text-base max-w-md">{config.subtitle}</p>}
          {config.ctaText && (
            <a href={config.ctaLink || '#'} className="inline-block bg-white text-[#E30613] font-bold px-6 py-3 rounded-lg text-sm hover:bg-gray-100 transition-colors">
              {config.ctaText}
            </a>
          )}
        </div>
        {config.badgeText && (
          <div className="shrink-0 w-24 h-24 md:w-32 md:h-32 rounded-full bg-[#FFC629] flex items-center justify-center text-[#1A1A1A] font-black text-lg md:text-xl shadow-lg">{config.badgeText}</div>
        )}
      </div>
    </section>
  )
}

function CategoryStrip({ config }: { config: Record<string, any> }) {
  const { data: categories, loading } = useFetch<any[]>(`${API_URL}/categories`)
  if (loading) return <div className="flex gap-3 overflow-hidden">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="shrink-0 w-20 h-8 bg-gray-200 rounded-full animate-pulse" />)}</div>
  if (!categories?.length) return null
  return (
    <section>
      {config.sectionTitle && <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">{config.sectionTitle}</h2>}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map((cat: any) => (
          <a key={cat.id} href={`#category-${cat.id}`} className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 text-sm font-medium text-[#1A1A1A] hover:border-[#E30613] hover:text-[#E30613] transition-colors bg-white">
            {cat.icon && <span className="text-base">{cat.icon}</span>}{cat.name}
          </a>
        ))}
      </div>
    </section>
  )
}

function CategoryGrid({ config }: { config: Record<string, any> }) {
  const { data: categories, loading } = useFetch<any[]>(`${API_URL}/categories`)
  const cols = config.columns || 6
  if (loading) return <SkeletonGrid cols={cols} rows={1} />
  if (!categories?.length) return null
  return (
    <section>
      <SectionHeader title={config.sectionTitle} link={config.seeMoreLink} linkText={config.seeMoreText} />
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {categories.map((cat: any) => (
          <a key={cat.id} href={`#category-${cat.id}`} className="flex flex-col items-center gap-2 group">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-2xl md:text-3xl font-bold transition-transform group-hover:scale-105" style={{ backgroundColor: cat.color || '#FFC629' }}>
              {cat.icon || cat.name.charAt(0)}
            </div>
            <span className="text-xs md:text-sm font-medium text-[#1A1A1A] text-center line-clamp-2">{cat.name}</span>
          </a>
        ))}
      </div>
    </section>
  )
}

function ProductGrid({ config }: { config: Record<string, any> }) {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const cols = config.columns || 6

  useEffect(() => {
    setLoading(true)
    const params: any = { limit: 24 }
    if (config.source === 'category' && config.categoryId) params.category = config.categoryId
    if (config.source === 'tag' && config.tagId) params.category = config.tagId
    api.getProducts(params).then(r => { if (r.success) setProducts(r.data?.products ?? []) }).catch(() => {}).finally(() => setLoading(false))
  }, [config.source, config.categoryId, config.tagId])

  if (loading) return <section><SectionHeader title={config.sectionTitle} link={config.seeMoreLink} linkText={config.seeMoreText} /><SkeletonGrid cols={cols} rows={2} /></section>
  if (!products.length) return null
  return (
    <section>
      <SectionHeader title={config.sectionTitle} link={config.seeMoreLink} linkText={config.seeMoreText} />
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {products.map((p: any) => <ProductCard key={p.id} product={p} showBadges={config.showBadges} />)}
      </div>
    </section>
  )
}

function RecipeGrid({ storeSlug, config }: { storeSlug: string; config: Record<string, any> }) {
  const { data: recipes, loading } = useFetch<any[]>(`${API_URL}/recipe-pages/public?store=${storeSlug}`, [storeSlug])
  const cols = config.columns || 4
  if (loading) return <section><SectionHeader title={config.sectionTitle} link={config.seeAllLink} linkText={config.seeAllText} /><SkeletonGrid cols={cols} rows={1} aspect="video" /></section>
  if (!recipes?.length) return null
  return (
    <section>
      <SectionHeader title={config.sectionTitle} link={config.seeAllLink} linkText={config.seeAllText} />
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {recipes.map((r: any) => (
          <a key={r.id} href={r.slug ? `/s/${storeSlug}/receta/${r.slug}` : '#'} className="bg-white rounded-xl overflow-hidden border border-gray-100 hover:shadow-md transition-shadow group">
            <div className="aspect-video bg-gray-50 relative overflow-hidden">
              {r.image_url ? <img src={r.image_url} alt={r.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">🍽️</div>}
            </div>
            <div className="p-3 space-y-1">
              {config.tagLabel ? <span className="text-[10px] font-semibold text-[#E30613] uppercase">{config.tagLabel}</span> : r.difficulty && <span className="text-[10px] font-semibold text-gray-400 uppercase">{r.difficulty}</span>}
              <p className="text-sm font-medium text-[#1A1A1A] line-clamp-2 leading-tight">{r.title}</p>
              <p className="text-sm font-bold text-[#E30613]">{r.totalCost != null ? formatCOP(r.totalCost) : ''}</p>
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}

function BrandChips({ config }: { config: Record<string, any> }) {
  const brands = config.brands ? config.brands.split(',').map((b: string) => b.trim()).filter(Boolean) : []
  if (!brands.length) return null
  const rounded = config.chipStyle === 'pill' ? 'rounded-full' : config.chipStyle === 'rounded' ? 'rounded-lg' : 'rounded'
  return (
    <section>
      {config.sectionTitle && <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">{config.sectionTitle}</h2>}
      <div className="flex flex-wrap gap-2">
        {brands.map((brand: string, i: number) => <span key={i} className={`px-4 py-1.5 text-xs font-semibold border border-gray-200 bg-white text-[#1A1A1A] ${rounded}`}>{brand}</span>)}
      </div>
    </section>
  )
}

function TrustBadges({ storeSlug }: { storeSlug: string }) {
  const { data: badges, loading } = useFetch<any[]>(`${API_URL}/trust-badges/public?store=${storeSlug}`, [storeSlug])
  if (loading) return <section className="grid grid-cols-1 md:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="p-5 rounded-xl bg-white border border-gray-100 space-y-3"><div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" /><div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" /><div className="h-3 bg-gray-200 rounded animate-pulse w-3/4" /></div>)}</section>
  if (!badges?.length) return null
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {badges.slice(0, 3).map((b: any) => {
        const Icon = LUCIDE_ICON_MAP[b.icon] || ShieldCheck
        return (
          <div key={b.id} className="p-5 rounded-xl bg-white border border-gray-100 flex flex-col items-center text-center gap-2">
            <div className="w-12 h-12 rounded-full bg-[#F6F5F2] flex items-center justify-center"><Icon className="w-6 h-6 text-[#E30613]" /></div>
            <h3 className="text-sm font-bold text-[#1A1A1A]">{b.title}</h3>
            <p className="text-xs text-gray-500">{b.description}</p>
          </div>
        )
      })}
    </section>
  )
}

function Newsletter({ storeSlug, config }: { storeSlug: string; config: Record<string, any> }) {
  const [email, setEmail] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [sending, setSending] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !accepted) return
    setSending(true)
    const res = await api.subscribeNewsletter(email, accepted, storeSlug)
    if (res.success) { toast.success('¡Suscripción exitosa!'); setEmail(''); setAccepted(false) }
    else toast.error(res.error || 'Error al suscribir')
    setSending(false)
  }

  return (
    <section className="rounded-2xl p-8 md:p-12" style={{ backgroundColor: config.bgColor || '#1A1A1A' }}>
      <div className="max-w-md mx-auto text-center space-y-4">
        {config.title && <h2 className="text-2xl font-black text-white">{config.title}</h2>}
        {config.subtitle && <p className="text-sm text-gray-300">{config.subtitle}</p>}
        <form onSubmit={submit} className="space-y-3">
          <div className="flex gap-2">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={config.emailPlaceholder || 'tu@email.com'} className="flex-1 h-11 px-4 rounded-lg text-sm bg-white/10 border border-white/20 text-white placeholder:text-gray-400 outline-none focus:border-white/40" required />
            <button type="submit" disabled={sending || !accepted} className="h-11 px-6 rounded-lg text-sm font-bold bg-[#E30613] text-white hover:bg-[#A80410] transition-colors disabled:opacity-50">{sending ? <Loader2 className="w-4 h-4 animate-spin" /> : (config.buttonText || 'Suscribirme')}</button>
          </div>
          <label className="flex items-start gap-2 text-xs text-gray-400 cursor-pointer">
            <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-0.5 accent-[#E30613]" />
            <span>{config.termsText || 'Acepto los términos y condiciones y la política de privacidad'}</span>
          </label>
        </form>
      </div>
    </section>
  )
}

function Footer({ storeSlug, config, storeName, storeLogo }: { storeSlug: string; config: Record<string, any>; storeName: string; storeLogo?: string }) {
  const cols: { title: string; links: string }[] = config.columns || []
  return (
    <footer className="text-white" style={{ backgroundColor: '#A80410' }}>
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
        <div className="flex items-center gap-3">
          {storeLogo ? <img src={storeLogo} alt={storeName} className="h-10 w-auto" /> : <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center font-black text-white text-xl">{storeName.charAt(0)}</div>}
          <div>
            <p className="font-bold text-white text-lg">{storeName}</p>
            {config.contactEmail && <p className="text-xs text-white/70">{config.contactEmail}</p>}
            {config.phone && <p className="text-xs text-white/70">{config.phone}</p>}
          </div>
        </div>
        {cols.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {cols.map((col: any, i: number) => {
              const links = col.links ? col.links.split(',').map((l: string) => { const [label, href] = l.split('|').map((p: string) => p.trim()); return { label, href: href || '#' } }) : []
              if (!col.title && !links.length) return null
              return (
                <div key={i}>
                  {col.title && <h4 className="font-bold text-sm mb-2">{col.title}</h4>}
                  <ul className="space-y-1.5">{links.map((l: any, j: number) => <li key={j}><a href={l.href} className="text-xs text-white/70 hover:text-white">{l.label}</a></li>)}</ul>
                </div>
              )
            })}
          </div>
        )}
        <div className="flex gap-4">
          {config.instagramUrl && <a href={config.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white"><Instagram className="w-5 h-5" /></a>}
          {config.facebookUrl && <a href={config.facebookUrl} target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white"><Facebook className="w-5 h-5" /></a>}
          {config.tiktokUrl && <a href={config.tiktokUrl} target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white"><svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg></a>}
        </div>
        <div className="flex gap-3">
          {config.googlePlayUrl && <a href={config.googlePlayUrl} target="_blank" rel="noopener noreferrer"><img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Google Play" className="h-10" /></a>}
          {config.appStoreUrl && <a href={config.appStoreUrl} target="_blank" rel="noopener noreferrer"><img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="App Store" className="h-10" /></a>}
        </div>
        <div className="pt-6 border-t border-white/20 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <p className="text-xs text-white/50">{config.copyright || `© ${new Date().getFullYear()} ${storeName}. Todos los derechos reservados.`}</p>
          <div className="flex gap-2 text-xs text-white/50"><span>💳 Visa</span><span>💳 Mastercard</span><span>💳 American Express</span></div>
        </div>
      </div>
    </footer>
  )
}

function PillRow({ config }: { config: Record<string, any> }) {
  const [selectedPill, setSelectedPill] = useState<string | null>(null)
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const cols = config.columns || 4

  const pills = config.pills ? config.pills.split(',').map((p: string) => p.trim()).filter(Boolean) : []

  useEffect(() => {
    if (!selectedPill) { setProducts([]); return }
    setLoading(true)
    const filterKey = config.productSource === 'byBrand' ? 'brand' : config.productSource === 'byTag' ? 'tag' : 'category'
    const params: any = { limit: 24, [filterKey]: selectedPill }
    api.getProducts(params).then(r => { if (r.success) setProducts(r.data?.products ?? []) }).catch(() => {}).finally(() => setLoading(false))
  }, [selectedPill, config.productSource])

  return (
    <section>
      <SectionHeader title={config.sectionTitle} link={config.seeMoreLink} linkText={config.seeMoreText} />
      {pills.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide mb-4">
          {pills.map((pill: string, i: number) => (
            <button key={i} onClick={() => setSelectedPill(p => p === pill ? null : pill)} className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${selectedPill === pill ? 'bg-[#E30613] text-white' : 'bg-white border border-gray-200 text-[#1A1A1A] hover:border-[#E30613]'}`}>{pill}</button>
          ))}
        </div>
      )}
      {loading && <SkeletonGrid cols={cols} rows={2} />}
      {!loading && products.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {products.map((p: any) => <ProductCard key={p.id} product={p} showBadges={config.showBadges} />)}
        </div>
      )}
      {!loading && selectedPill && !products.length && <p className="text-center text-gray-400 text-sm py-8">No hay productos en esta categoría</p>}
    </section>
  )
}

/* ──────────────── RENDER DISPATCH ──────────────── */
function renderSection(section: HomepageSection, storeSlug: string, storeName: string, storeLogo?: string) {
  switch (section.type) {
    case 'hero': return <Hero key={section.id} config={section.config} />
    case 'categoryStrip': return <CategoryStrip key={section.id} config={section.config} />
    case 'categoryGrid': return <CategoryGrid key={section.id} config={section.config} />
    case 'productGrid': return <ProductGrid key={section.id} config={section.config} />
    case 'recipeGrid': return <RecipeGrid key={section.id} storeSlug={storeSlug} config={section.config} />
    case 'brandChips': return <BrandChips key={section.id} config={section.config} />
    case 'trustBadges': return <TrustBadges key={section.id} storeSlug={storeSlug} />
    case 'newsletter': return <Newsletter key={section.id} storeSlug={storeSlug} config={section.config} />
    case 'footer': return <Footer key={section.id} storeSlug={storeSlug} config={section.config} storeName={storeName} storeLogo={storeLogo} />
    case 'pillRow': return <PillRow key={section.id} config={section.config} />
    default: return null
  }
}

/* ──────────────── MAIN COMPONENT ──────────────── */
export function HomepageRenderer({ storeSlug, storeName, storeLogo }: Props) {
  const [sections, setSections] = useState<HomepageSection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`${API_URL}/homepage/public?store=${storeSlug}`)
      .then(r => r.json())
      .then((data: any) => {
        const raw = data.success !== false ? (data.data?.sections ?? data.sections ?? data.data) : null
        if (Array.isArray(raw) && raw.length) {
          const mapped = raw.map((s: any) => ({
            ...s,
            type: s.sectionType || s.type,
          })).filter((s: HomepageSection) => s.enabled).sort((a: HomepageSection, b: HomepageSection) => a.sortOrder - b.sortOrder)
          setSections(mapped)
        } else {
          setError('No se encontraron secciones configuradas')
        }
      })
      .catch(() => setError('Error al cargar la página'))
      .finally(() => setLoading(false))
  }, [storeSlug])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F5F2] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#E30613] mx-auto" />
          <p className="text-sm text-gray-500">Cargando tienda...</p>
        </div>
      </div>
    )
  }

  if (error || !sections.length) {
    return (
      <div className="min-h-screen bg-[#F6F5F2] flex items-center justify-center">
        <div className="text-center space-y-3 p-8">
          <div className="text-4xl">🏪</div>
          <p className="text-lg font-semibold text-[#1A1A1A]">{storeName}</p>
          <p className="text-sm text-gray-400">{error || 'Esta tienda está en construcción'}</p>
        </div>
      </div>
    )
  }

  const hero = sections.find(s => s.type === 'hero')
  const footer = sections.find(s => s.type === 'footer')
  const rest = sections.filter(s => s.type !== 'hero' && s.type !== 'footer')

  return (
    <div className="min-h-screen bg-[#F6F5F2]">
      {hero?.config?.shippingText && (
        <div className="bg-[#A80410] text-white text-xs py-1 px-4 text-center">📦 Envío Programado  ⚡ Envío D1 Express</div>
      )}
      <header className="bg-[#E30613] sticky top-0 z-50 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center gap-4 px-4 py-3">
          <div className="bg-white text-[#E30613] font-black text-2xl w-9 h-9 rounded flex items-center justify-center shrink-0">{storeName.charAt(0)}</div>
          <div className="flex-1 bg-white rounded flex items-center px-3 h-10">
            <input placeholder="¿Qué estás buscando?" className="flex-1 outline-none text-sm bg-transparent" />
          </div>
          <div className="flex items-center gap-3 text-white text-xs font-semibold shrink-0">
            <span>📍 Dirección</span>
            <span>👤 Perfil</span>
            <div className="bg-[#FFC629] text-[#1A1A1A] rounded px-3 py-1.5 font-bold">🛒 Carrito</div>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-10">
        {hero && renderSection(hero, storeSlug, storeName, storeLogo)}
        {rest.map(s => renderSection(s, storeSlug, storeName, storeLogo))}
      </main>
      {footer && renderSection(footer, storeSlug, storeName, storeLogo)}
    </div>
  )
}
