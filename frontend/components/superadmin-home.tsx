'use client'

import { useState, useCallback, useEffect } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ImageIcon,
  LayoutTemplate,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  CalendarDays,
  Tag,
  CheckCircle2,
  XCircle,
  Sparkles,
  TrendingUp,
  Store,
  Star,
  Search,
  X,
  BarChart2,
  ShoppingBag,
  Pin,
  Package,
  Plug,
  Bot,
  Eye,
  EyeOff,
  Save,
  Check,
  CreditCard,
  KeyRound,
  BadgeDollarSign,
  ShieldCheck,
} from 'lucide-react'
import { CloudinaryUpload, clearCloudinaryCache } from '@/components/ui/cloudinary-upload'
import { toast } from 'sonner'
import { formatCOP } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

interface Drop {
  id: number
  name: string
  description?: string
  bannerUrl?: string
  globalDiscount: number
  startsAt: string
  endsAt: string
  isActive: boolean
}

const emptyDrop = (): Omit<Drop, 'id'> => ({
  name: '',
  description: '',
  bannerUrl: '',
  globalDiscount: 0,
  startsAt: '',
  endsAt: '',
  isActive: true,
})

// ── Sales Timeline ──
interface TenantTimeline {
  tenantId: string
  tenantName: string
  slug: string
  totalRevenue: number
  totalOrders: number
  timeline: { date: string; revenue: number; orderCount: number }[]
}

// ── Colors for tenants ──
const TENANT_COLORS = [
  '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6',
]

export function SuperadminHome() {
  // ── Tab state ──
  const [activeTab, setActiveTab] = useState<'pagina' | 'timeline' | 'destacados' | 'integraciones' | 'pagos'>('pagina')

  // ── Hero settings ──
  const [heroUrl, setHeroUrl] = useState('')
  const [heroTitle, setHeroTitle] = useState('')
  const [heroSubtitle, setHeroSubtitle] = useState('')
  const [isSavingHero, setIsSavingHero] = useState(false)

  // ── Login image settings ──
  const [loginImageUrl, setLoginImageUrl] = useState('')
  const [isSavingLogin, setIsSavingLogin] = useState(false)

  // ── Offers (products with isOnOffer) ──
  const [offers, setOffers] = useState<any[]>([])
  const [isLoadingOffers, setIsLoadingOffers] = useState(false)

  // ── Drops ──
  const [drops, setDrops] = useState<Drop[]>([])
  const [isLoadingDrops, setIsLoadingDrops] = useState(false)
  const [isDropDialogOpen, setIsDropDialogOpen] = useState(false)
  const [editingDrop, setEditingDrop] = useState<Drop | null>(null)
  const [dropForm, setDropForm] = useState<Omit<Drop, 'id'>>(emptyDrop())
  const [isSavingDrop, setIsSavingDrop] = useState(false)
  const [deletingDropId, setDeletingDropId] = useState<number | null>(null)

  // ── Sales Timeline ──
  const [timelineData, setTimelineData] = useState<{ tenants: TenantTimeline[]; dateRange: string[] } | null>(null)
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false)
  const [timelinePeriod, setTimelinePeriod] = useState(30)

  // ── Platform Featured Products ──
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([])
  const [isLoadingFeatured, setIsLoadingFeatured] = useState(false)
  const [featuredSearch, setFeaturedSearch] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSavingFeatured, setIsSavingFeatured] = useState(false)

  // ── Integrations (Cloudinary + OpenAI) ──
  const [integrations, setIntegrations] = useState({
    cloudinaryCloudName: '',
    cloudinaryUploadPreset: '',
    openaiApiKey: '',
  })
  const [showOpenAIKey, setShowOpenAIKey] = useState(false)
  const [showUploadPreset, setShowUploadPreset] = useState(false)
  const [isSavingIntegrations, setIsSavingIntegrations] = useState(false)
  const [integrationsMsg, setIntegrationsMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  // ── Chatbot per-tenant management ──
  const [chatbotTenants, setChatbotTenants] = useState<any[]>([])
  const [isLoadingChatbotTenants, setIsLoadingChatbotTenants] = useState(false)
  const [togglingTenantId, setTogglingTenantId] = useState<string | null>(null)

  // ── MercadoPago Suscripciones ──
  const [mpPrices, setMpPrices] = useState({ basico: '', profesional: '', empresarial: '' })
  const [mpPlanIds, setMpPlanIds] = useState<Record<string, string | null>>({})
  const [isSavingPrices, setIsSavingPrices] = useState(false)
  const [isSyncingPlans, setIsSyncingPlans] = useState(false)
  const [mpMsg, setMpMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  const fetchPlatformSettings = useCallback(async () => {
    const result = await api.getPlatformSettings()
    if (result.success && result.data) {
      if (result.data.hero_image_url) setHeroUrl(result.data.hero_image_url)
      if (result.data.hero_title) setHeroTitle(result.data.hero_title)
      if (result.data.hero_subtitle) setHeroSubtitle(result.data.hero_subtitle)
      if (result.data.login_image_url) setLoginImageUrl(result.data.login_image_url)
      // Populate MP prices from platform settings
      setMpPrices({
        basico:      result.data.plan_price_basico || '',
        profesional: result.data.plan_price_profesional || '',
        empresarial: result.data.plan_price_empresarial || '',
      })
    }
  }, [])

  const fetchIntegrations = useCallback(async () => {
    const result = await api.getSuperadminIntegrations()
    if (result.success && result.data) {
      setIntegrations({
        cloudinaryCloudName: result.data.cloudinaryCloudName || '',
        cloudinaryUploadPreset: result.data.cloudinaryUploadPreset || '',
        openaiApiKey: result.data.openaiApiKey || '',
      })
    }
  }, [])

  const fetchChatbotTenants = useCallback(async () => {
    setIsLoadingChatbotTenants(true)
    const result = await api.getSuperadminChatbotTenants()
    if (result.success && result.data) setChatbotTenants(result.data as any[])
    setIsLoadingChatbotTenants(false)
  }, [])

  const handleSaveIntegrations = async () => {
    setIsSavingIntegrations(true)
    const result = await api.updateSuperadminIntegrations(integrations)
    if (result.success) {
      clearCloudinaryCache()
      setIntegrationsMsg({ type: 'ok', text: 'Integraciones guardadas correctamente' })
    } else {
      setIntegrationsMsg({ type: 'error', text: result.error || 'Error al guardar' })
    }
    setIsSavingIntegrations(false)
    setTimeout(() => setIntegrationsMsg(null), 4000)
  }

  const handleToggleChatbot = async (tenantId: string, currentEnabled: boolean) => {
    setTogglingTenantId(tenantId)
    const result = await api.toggleChatbotForTenant(tenantId, !currentEnabled)
    if (result.success) {
      setChatbotTenants(prev => prev.map(t =>
        t.id === tenantId ? { ...t, chatbotEnabled: !currentEnabled } : t
      ))
      toast.success(!currentEnabled ? 'Chatbot activado' : 'Chatbot desactivado')
    } else {
      toast.error('Error al actualizar el chatbot')
    }
    setTogglingTenantId(null)
  }

  const fetchOffers = useCallback(async () => {
    setIsLoadingOffers(true)
    try {
      const res = await fetch(`${API_URL}/storefront/products?limit=100&store=all`)
      const json = await res.json()
      if (json.success && json.data?.products) {
        setOffers(json.data.products.filter((p: any) => p.isOnOffer))
      }
    } catch {
      // silent
    }
    setIsLoadingOffers(false)
  }, [])

  const fetchDrops = useCallback(async () => {
    setIsLoadingDrops(true)
    try {
      const res = await fetch(`${API_URL}/storefront/drops`, {
        headers: { Authorization: `Bearer ${api.getToken()}` },
      })
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setDrops(json.data)
      } else if (Array.isArray(json)) {
        setDrops(json)
      }
    } catch {
      // silent
    }
    setIsLoadingDrops(false)
  }, [])

  const fetchTimeline = useCallback(async (period: number) => {
    setIsLoadingTimeline(true)
    const result = await api.getSalesTimeline(period)
    if (result.success && result.data) {
      setTimelineData(result.data)
    }
    setIsLoadingTimeline(false)
  }, [])

  const fetchFeatured = useCallback(async () => {
    setIsLoadingFeatured(true)
    const result = await api.getPlatformFeatured()
    if (result.success && result.data) setFeaturedProducts(result.data)
    setIsLoadingFeatured(false)
  }, [])

  useEffect(() => {
    fetchPlatformSettings()
    fetchOffers()
    fetchDrops()
  }, [fetchPlatformSettings, fetchOffers, fetchDrops])

  useEffect(() => {
    if (activeTab === 'timeline') fetchTimeline(timelinePeriod)
    if (activeTab === 'integraciones') {
      fetchIntegrations()
      fetchChatbotTenants()
    }
    if (activeTab === 'pagos') {
      api.getSubscriptionConfig().then(res => {
        if (res.success && res.data?.planIds) setMpPlanIds(res.data.planIds)
      })
    }
  }, [activeTab, timelinePeriod, fetchTimeline, fetchIntegrations, fetchChatbotTenants])

  useEffect(() => {
    if (activeTab === 'destacados') fetchFeatured()
  }, [activeTab, fetchFeatured])

  // Search products for featured
  const handleFeaturedSearch = async (q: string) => {
    setFeaturedSearch(q)
    if (!q.trim()) { setSearchResults([]); return }
    setIsSearching(true)
    try {
      const res = await fetch(`${API_URL}/storefront/products?limit=30&store=all&search=${encodeURIComponent(q)}`)
      const json = await res.json()
      if (json.success && json.data?.products) setSearchResults(json.data.products)
    } catch {}
    setIsSearching(false)
  }

  const addToFeatured = async (product: any) => {
    if (featuredProducts.find(p => p.id === product.id)) {
      toast.info('Ya está en destacados')
      return
    }
    const newList = [...featuredProducts, product]
    setFeaturedProducts(newList)
    setSearchResults([])
    setFeaturedSearch('')
    const result = await api.updatePlatformFeatured(newList.map((p: any) => p.id))
    if (result.success) {
      toast.success(`"${product.name}" añadido a destacados`)
    } else {
      toast.error(result.error || 'Error al guardar')
      setFeaturedProducts(featuredProducts)
    }
  }

  const removeFromFeatured = async (productId: number) => {
    const newList = featuredProducts.filter((p: any) => p.id !== productId)
    setFeaturedProducts(newList)
    await api.updatePlatformFeatured(newList.map((p: any) => p.id))
    toast.success('Producto removido de destacados')
  }

  const handleSaveHero = async () => {
    setIsSavingHero(true)
    try {
      const results = await Promise.all([
        api.updatePlatformSetting('hero_image_url', heroUrl),
        api.updatePlatformSetting('hero_title', heroTitle),
        api.updatePlatformSetting('hero_subtitle', heroSubtitle),
      ])
      if (results.every(r => r.success)) {
        toast.success('Hero principal actualizado')
      } else {
        toast.error('Error al guardar algunos campos')
      }
    } catch {
      toast.error('Error de conexión')
    }
    setIsSavingHero(false)
  }

  const handleSaveLoginImage = async () => {
    setIsSavingLogin(true)
    const result = await api.updatePlatformSetting('login_image_url', loginImageUrl)
    if (result.success) {
      toast.success('Imagen del login actualizada')
    } else {
      toast.error(result.error || 'Error al guardar')
    }
    setIsSavingLogin(false)
  }

  const openCreateDrop = () => {
    setEditingDrop(null)
    setDropForm(emptyDrop())
    setIsDropDialogOpen(true)
  }

  const openEditDrop = (drop: Drop) => {
    setEditingDrop(drop)
    setDropForm({
      name: drop.name,
      description: drop.description || '',
      bannerUrl: drop.bannerUrl || '',
      globalDiscount: drop.globalDiscount,
      startsAt: drop.startsAt ? drop.startsAt.slice(0, 16) : '',
      endsAt: drop.endsAt ? drop.endsAt.slice(0, 16) : '',
      isActive: drop.isActive,
    })
    setIsDropDialogOpen(true)
  }

  const handleSaveDrop = async () => {
    if (!dropForm.name || !dropForm.startsAt || !dropForm.endsAt) {
      toast.error('Nombre, fecha de inicio y fin son requeridos')
      return
    }
    setIsSavingDrop(true)
    const payload = {
      name: dropForm.name,
      description: dropForm.description || undefined,
      bannerUrl: dropForm.bannerUrl || undefined,
      globalDiscount: Number(dropForm.globalDiscount),
      startsAt: dropForm.startsAt,
      endsAt: dropForm.endsAt,
      isActive: dropForm.isActive,
    }
    const result = editingDrop
      ? await api.updateDrop(editingDrop.id, payload)
      : await api.createDrop(payload)

    if (result.success) {
      toast.success(editingDrop ? 'Drop actualizado' : 'Drop creado')
      setIsDropDialogOpen(false)
      fetchDrops()
    } else {
      toast.error(result.error || 'Error al guardar drop')
    }
    setIsSavingDrop(false)
  }

  const handleDeleteDrop = async (id: number) => {
    const result = await api.deleteDrop(id)
    if (result.success) {
      toast.success('Drop eliminado')
      setDeletingDropId(null)
      fetchDrops()
    } else {
      toast.error(result.error || 'Error al eliminar')
    }
  }

  const handleSaveMpPrices = async () => {
    setIsSavingPrices(true)
    try {
      await api.savePlanPrices(mpPrices)
      setMpMsg({ type: 'ok', text: 'Precios guardados correctamente' })
    } catch {
      setMpMsg({ type: 'error', text: 'Error al guardar los precios' })
    }
    setIsSavingPrices(false)
    setTimeout(() => setMpMsg(null), 4000)
  }

  const handleSyncMpPlans = async () => {
    setIsSyncingPlans(true)
    setMpMsg(null)
    const result = await api.syncMPPlans()
    if (result.success && result.data) {
      setMpPlanIds(result.data as Record<string, string>)
      setMpMsg({ type: 'ok', text: 'Planes sincronizados con MercadoPago correctamente' })
    } else {
      setMpMsg({ type: 'error', text: result.error || 'Error al sincronizar planes' })
    }
    setIsSyncingPlans(false)
    setTimeout(() => setMpMsg(null), 6000)
  }

  // ── Timeline helpers ──
  const getMaxRevenue = (tenants: TenantTimeline[]) =>
    Math.max(...tenants.flatMap(t => t.timeline.map(d => d.revenue)), 1)

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-foreground flex items-center gap-2">
          <LayoutTemplate className="h-6 w-6 text-primary" />
          Panel Superadmin
        </h2>
        <p className="text-sm text-muted-foreground">
          Gestiona la plataforma, analiza rendimiento y configura la página principal
        </p>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {[
          { id: 'pagina', label: 'Página Principal', icon: LayoutTemplate },
          { id: 'timeline', label: 'Línea de Ventas', icon: TrendingUp },
          { id: 'destacados', label: 'Productos Destacados', icon: Star },
          { id: 'integraciones', label: 'Integraciones', icon: Plug },
          { id: 'pagos', label: 'Suscripciones', icon: CreditCard },
        ].map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* ══════════════════════════════════════
          TAB: PÁGINA PRINCIPAL
      ══════════════════════════════════════ */}
      {activeTab === 'pagina' && (
        <div className="space-y-6">
          {/* ── Hero Principal ── */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base lg:text-lg flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-muted-foreground" />
                Hero Principal (Landing)
              </CardTitle>
              <CardDescription>Imagen, título y subtítulo del banner principal de la página pública</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>URL de imagen del hero</Label>
                <Input
                  value={heroUrl}
                  onChange={(e) => setHeroUrl(e.target.value)}
                  placeholder="https://ejemplo.com/imagen.jpg o GIF"
                  className="font-mono text-sm"
                />
              </div>
              {heroUrl && (
                <div className="relative w-full max-w-md h-40 rounded border border-border overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={heroUrl}
                    alt="Preview hero"
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Título del hero</Label>
                  <Input
                    value={heroTitle}
                    onChange={(e) => setHeroTitle(e.target.value)}
                    placeholder="Ej: Bienvenidos a nuestra tienda"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subtítulo del hero</Label>
                  <Input
                    value={heroSubtitle}
                    onChange={(e) => setHeroSubtitle(e.target.value)}
                    placeholder="Ej: Las mejores fragancias"
                  />
                </div>
              </div>
              <Button size="sm" onClick={handleSaveHero} disabled={isSavingHero}>
                {isSavingHero ? 'Guardando...' : 'Guardar Hero'}
              </Button>
            </CardContent>
          </Card>

          {/* ── Login Image/GIF ── */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base lg:text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-muted-foreground" />
                Imagen / GIF del Login
              </CardTitle>
              <CardDescription>Imagen o GIF de fondo que se muestra en la pantalla de inicio de sesión</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <CloudinaryUpload
                value={loginImageUrl}
                onChange={setLoginImageUrl}
                accept="image/*,.gif"
                previewClassName="w-full max-w-xs h-48 object-cover rounded-lg border border-border"
              />
              <p className="text-xs text-muted-foreground">
                Acepta imágenes estáticas (.jpg, .png, .webp) o animadas (.gif). Se mostrará como fondo en la pantalla de login.
              </p>
              <Button size="sm" onClick={handleSaveLoginImage} disabled={isSavingLogin}>
                {isSavingLogin ? 'Guardando...' : 'Guardar imagen de login'}
              </Button>
            </CardContent>
          </Card>

          {/* ── Ofertas activas ── */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base lg:text-lg flex items-center gap-2">
                    <Tag className="h-5 w-5 text-orange-500" />
                    Ofertas Activas en Comercios
                  </CardTitle>
                  <CardDescription>Productos con oferta activa en todas las tiendas</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchOffers} disabled={isLoadingOffers} className="gap-1">
                  <RefreshCw className={`h-4 w-4 ${isLoadingOffers ? 'animate-spin' : ''}`} />
                  Actualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingOffers ? (
                <div className="flex items-center justify-center py-10">
                  <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : offers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <Tag className="h-10 w-10 mb-2 opacity-40" />
                  <p className="text-sm">No hay productos en oferta actualmente</p>
                  <p className="text-xs mt-1">Los comerciantes pueden activar ofertas desde el módulo Tienda</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {offers.map((product: any) => (
                    <div key={product.id} className="flex gap-3 p-3 border border-border rounded-lg bg-background">
                      <div className="w-14 h-14 shrink-0 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.imageUrl.startsWith('http') ? product.imageUrl : `${API_URL.replace('/api', '')}${product.imageUrl}`}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Sparkles className="h-5 w-5 text-muted-foreground/30" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{product.tenantName || product.brand || ''}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-sm font-semibold text-orange-500">{formatCOP(product.offerPrice)}</span>
                          <span className="text-xs text-muted-foreground line-through">{formatCOP(product.salePrice)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Drops ── */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base lg:text-lg flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-purple-500" />
                    Drops / Eventos de Descuento
                  </CardTitle>
                  <CardDescription>Eventos temporales con descuento global para productos seleccionados</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={fetchDrops} disabled={isLoadingDrops} className="gap-1">
                    <RefreshCw className={`h-4 w-4 ${isLoadingDrops ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button size="sm" onClick={openCreateDrop} className="gap-1">
                    <Plus className="h-4 w-4" />
                    Nuevo Drop
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingDrops ? (
                <div className="flex items-center justify-center py-10">
                  <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : drops.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <CalendarDays className="h-10 w-10 mb-2 opacity-40" />
                  <p className="text-sm">No hay drops creados</p>
                  <p className="text-xs mt-1">Crea un drop para activar descuentos temporales</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {drops.map((drop) => {
                    const now = new Date()
                    const start = new Date(drop.startsAt)
                    const end = new Date(drop.endsAt)
                    const isLive = drop.isActive && now >= start && now <= end
                    const isPast = now > end
                    return (
                      <div key={drop.id} className="flex items-center gap-4 p-4 border border-border rounded-lg bg-background">
                        {drop.bannerUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={drop.bannerUrl}
                            alt={drop.name}
                            className="w-16 h-12 rounded object-cover shrink-0 border border-border"
                          />
                        ) : (
                          <div className="w-16 h-12 rounded bg-secondary flex items-center justify-center shrink-0">
                            <CalendarDays className="h-5 w-5 text-muted-foreground/50" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">{drop.name}</p>
                            {isLive && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-green-500/15 text-green-500 border border-green-500/20">EN VIVO</span>
                            )}
                            {isPast && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-muted text-muted-foreground">FINALIZADO</span>
                            )}
                            {!drop.isActive && !isPast && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-yellow-500/15 text-yellow-500 border border-yellow-500/20">INACTIVO</span>
                            )}
                          </div>
                          {drop.description && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{drop.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-xs text-purple-400 font-medium">{drop.globalDiscount}% descuento</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(drop.startsAt).toLocaleDateString('es-CO')} → {new Date(drop.endsAt).toLocaleDateString('es-CO')}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDrop(drop)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70 hover:text-destructive" onClick={() => setDeletingDropId(drop.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB: LÍNEA DE TIEMPO DE VENTAS
      ══════════════════════════════════════ */}
      {activeTab === 'timeline' && (
        <div className="space-y-6">
          {/* Period selector */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Período:</span>
            {[7, 14, 30, 60, 90].map(d => (
              <button
                key={d}
                onClick={() => setTimelinePeriod(d)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  timelinePeriod === d
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {d}d
              </button>
            ))}
            <Button variant="outline" size="sm" onClick={() => fetchTimeline(timelinePeriod)} disabled={isLoadingTimeline} className="ml-auto gap-1">
              <RefreshCw className={`h-4 w-4 ${isLoadingTimeline ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>

          {isLoadingTimeline ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !timelineData || timelineData.tenants.length === 0 ? (
            <Card className="border-border bg-card">
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm font-medium">Sin datos de ventas en este período</p>
                <p className="text-xs mt-1">Las ventas de los comercios aparecerán aquí</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="border-border bg-card">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">Comercios activos</p>
                    <p className="text-2xl font-bold text-foreground">{timelineData.tenants.length}</p>
                  </CardContent>
                </Card>
                <Card className="border-border bg-card">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">Total ventas</p>
                    <p className="text-xl font-bold text-green-500">
                      {formatCOP(timelineData.tenants.reduce((s, t) => s + t.totalRevenue, 0))}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-border bg-card">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">Total pedidos</p>
                    <p className="text-2xl font-bold text-blue-500">
                      {timelineData.tenants.reduce((s, t) => s + t.totalOrders, 0)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-border bg-card">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">Mejor comercio</p>
                    <p className="text-sm font-bold text-foreground truncate">{timelineData.tenants[0]?.tenantName || '—'}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Timeline chart per tenant */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart2 className="h-5 w-5 text-primary" />
                    Rendimiento por Comercio — últimos {timelinePeriod} días
                  </CardTitle>
                  <CardDescription>Cada barra representa el ingreso diario. Hover para ver el valor.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {/* Date axis — show only first/mid/last */}
                  <div className="space-y-4 min-w-[500px]">
                    {timelineData.tenants.map((tenant, idx) => {
                      const maxRev = getMaxRevenue(timelineData.tenants)
                      const color = TENANT_COLORS[idx % TENANT_COLORS.length]
                      return (
                        <div key={tenant.tenantId} className="group">
                          {/* Header row */}
                          <div className="flex items-center justify-between mb-1.5 px-1">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                              <span className="text-sm font-medium text-foreground truncate max-w-[180px]">{tenant.tenantName}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <ShoppingBag className="h-3 w-3" />
                                {tenant.totalOrders} pedidos
                              </span>
                              <span className="font-semibold" style={{ color }}>{formatCOP(tenant.totalRevenue)}</span>
                            </div>
                          </div>
                          {/* Bar chart row */}
                          <div className="flex items-end gap-px h-10 bg-muted/30 rounded px-1">
                            {tenant.timeline.map((day, di) => {
                              const h = maxRev > 0 ? Math.max((day.revenue / maxRev) * 100, day.revenue > 0 ? 8 : 0) : 0
                              return (
                                <div
                                  key={di}
                                  title={`${day.date}: ${formatCOP(day.revenue)} (${day.orderCount} pedidos)`}
                                  className="flex-1 rounded-sm transition-opacity hover:opacity-80 cursor-default"
                                  style={{
                                    height: `${h}%`,
                                    minHeight: day.revenue > 0 ? 3 : 0,
                                    backgroundColor: day.revenue > 0 ? color : 'transparent',
                                    opacity: 0.85,
                                  }}
                                />
                              )
                            })}
                          </div>
                          {/* Date labels (first/mid/last) */}
                          <div className="flex justify-between px-1 mt-0.5">
                            <span className="text-[10px] text-muted-foreground/60">
                              {tenant.timeline[0]?.date ? new Date(tenant.timeline[0].date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : ''}
                            </span>
                            <span className="text-[10px] text-muted-foreground/60">
                              {tenant.timeline[Math.floor(tenant.timeline.length / 2)]?.date
                                ? new Date(tenant.timeline[Math.floor(tenant.timeline.length / 2)].date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
                                : ''}
                            </span>
                            <span className="text-[10px] text-muted-foreground/60">
                              {tenant.timeline[tenant.timeline.length - 1]?.date
                                ? new Date(tenant.timeline[tenant.timeline.length - 1].date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
                                : ''}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Ranking table */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Store className="h-5 w-5 text-amber-500" />
                    Ranking de Comercios
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {timelineData.tenants.map((tenant, idx) => {
                      const maxRev = timelineData.tenants[0]?.totalRevenue || 1
                      const pct = Math.round((tenant.totalRevenue / maxRev) * 100)
                      const color = TENANT_COLORS[idx % TENANT_COLORS.length]
                      return (
                        <div key={tenant.tenantId} className="flex items-center gap-3">
                          <span className="text-xs font-bold text-muted-foreground w-5 text-right">#{idx + 1}</span>
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-0.5">
                              <span className="text-sm font-medium text-foreground truncate">{tenant.tenantName}</span>
                              <span className="text-sm font-bold shrink-0 ml-2" style={{ color }}>{formatCOP(tenant.totalRevenue)}</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${pct}%`, backgroundColor: color }}
                              />
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground w-16 text-right">{tenant.totalOrders} pedidos</span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB: PRODUCTOS DESTACADOS (Platform Featured)
      ══════════════════════════════════════ */}
      {activeTab === 'destacados' && (
        <div className="space-y-6">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base lg:text-lg flex items-center gap-2">
                <Pin className="h-5 w-5 text-amber-500" />
                Productos Destacados en la Página Principal
              </CardTitle>
              <CardDescription>
                Estos productos se muestran de forma prominente en la landing page, antes de las tiendas.
                El admin puede pinear productos de cualquier comercio.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={featuredSearch}
                  onChange={(e) => handleFeaturedSearch(e.target.value)}
                  placeholder="Buscar producto para destacar (nombre, marca...)..."
                  className="pl-9 pr-4"
                />
                {isSearching && (
                  <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* Search results dropdown */}
              {searchResults.length > 0 && (
                <div className="border border-border rounded-lg bg-background shadow-lg divide-y divide-border max-h-64 overflow-y-auto">
                  {searchResults.map((product: any) => (
                    <button
                      key={product.id}
                      onClick={() => addToFeatured(product)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="w-10 h-10 shrink-0 rounded bg-muted overflow-hidden">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.imageUrl.startsWith('http') ? product.imageUrl : `${API_URL.replace('/api', '')}${product.imageUrl}`}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : <Package className="h-5 w-5 m-auto text-muted-foreground/30 mt-2.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.storeName || product.brand || ''} · {formatCOP(product.salePrice)}</p>
                      </div>
                      <Plus className="h-4 w-4 text-primary shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {/* Current featured list */}
              {isLoadingFeatured ? (
                <div className="flex items-center justify-center py-10">
                  <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : featuredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground border border-dashed border-border rounded-lg">
                  <Star className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-sm">No hay productos destacados</p>
                  <p className="text-xs mt-1">Busca y añade productos de cualquier tienda</p>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    {featuredProducts.length} producto(s) destacado(s) — se muestran primero en la landing
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {featuredProducts.map((product: any) => (
                      <div key={product.id} className="relative flex gap-3 p-3 border border-border rounded-lg bg-background group">
                        <div className="w-14 h-14 shrink-0 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                          {product.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={product.imageUrl.startsWith('http') ? product.imageUrl : `${API_URL.replace('/api', '')}${product.imageUrl}`}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="h-5 w-5 text-muted-foreground/30" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{product.storeName || product.brand || ''}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            {product.isOnOffer && product.offerPrice ? (
                              <>
                                <span className="text-sm font-semibold text-orange-500">{formatCOP(product.offerPrice)}</span>
                                <span className="text-xs text-muted-foreground line-through">{formatCOP(product.salePrice)}</span>
                              </>
                            ) : (
                              <span className="text-sm font-semibold text-foreground">{formatCOP(product.salePrice)}</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => removeFromFeatured(product.id)}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <div className="absolute top-2 left-2">
                          <Pin className="h-3 w-3 text-amber-500" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Drop Create/Edit Dialog ── */}
      <Dialog open={isDropDialogOpen} onOpenChange={setIsDropDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-purple-500" />
              {editingDrop ? 'Editar Drop' : 'Nuevo Drop'}
            </DialogTitle>
            <DialogDescription>
              Configura un evento de descuento temporal para la plataforma
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Ej: Black Friday, Temporada de Fraggancias"
                value={dropForm.name}
                onChange={(e) => setDropForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input
                placeholder="Descripción opcional del evento"
                value={dropForm.description}
                onChange={(e) => setDropForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>URL del banner</Label>
              <Input
                placeholder="https://ejemplo.com/banner.jpg"
                value={dropForm.bannerUrl}
                onChange={(e) => setDropForm(f => ({ ...f, bannerUrl: e.target.value }))}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>Descuento global (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={dropForm.globalDiscount}
                onChange={(e) => setDropForm(f => ({ ...f, globalDiscount: Number(e.target.value) }))}
              />
              <p className="text-xs text-muted-foreground">Porcentaje de descuento aplicado a todos los productos del drop</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Fecha inicio <span className="text-destructive">*</span></Label>
                <Input
                  type="datetime-local"
                  value={dropForm.startsAt}
                  onChange={(e) => setDropForm(f => ({ ...f, startsAt: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha fin <span className="text-destructive">*</span></Label>
                <Input
                  type="datetime-local"
                  value={dropForm.endsAt}
                  onChange={(e) => setDropForm(f => ({ ...f, endsAt: e.target.value }))}
                />
              </div>
            </div>
            <div
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                dropForm.isActive ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'
              }`}
              onClick={() => setDropForm(f => ({ ...f, isActive: !f.isActive }))}
            >
              <div className={`w-5 h-5 rounded flex items-center justify-center border-2 flex-shrink-0 transition-colors ${
                dropForm.isActive ? 'border-primary bg-primary' : 'border-muted-foreground'
              }`}>
                {dropForm.isActive && <span className="text-white text-xs font-bold">✓</span>}
              </div>
              <div>
                <p className="text-sm font-medium">Activo</p>
                <p className="text-xs text-muted-foreground">El drop se mostrará en la página pública cuando esté en rango de fechas</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDropDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveDrop} disabled={isSavingDrop}>
              {isSavingDrop ? 'Guardando...' : editingDrop ? 'Guardar cambios' : 'Crear Drop'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Drop Confirm ── */}
      <Dialog open={deletingDropId !== null} onOpenChange={(open) => { if (!open) setDeletingDropId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Eliminar Drop
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar este drop? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeletingDropId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deletingDropId !== null && handleDeleteDrop(deletingDropId)}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════
          TAB: INTEGRACIONES
      ══════════════════════════════════════ */}
      {activeTab === 'integraciones' && (
        <div className="space-y-6">

          {/* ── Cloudinary ── */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-muted-foreground" />
                Cloudinary — Subida de Imágenes
              </CardTitle>
              <CardDescription>
                Credenciales globales para todos los comercios. Configurado aquí, funciona en toda la plataforma.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-xs space-y-1">
                <p className="font-medium text-blue-600 dark:text-blue-400">¿Cómo obtener las credenciales?</p>
                <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground">
                  <li>Crea cuenta en <strong>cloudinary.com</strong> y copia tu <strong>Cloud Name</strong> del dashboard</li>
                  <li>Ve a <strong>Settings → Upload → Upload presets</strong> y crea uno con <strong>Signing Mode: Unsigned</strong></li>
                </ol>
              </div>

              {integrationsMsg && (
                <div className={`rounded-lg p-3 text-sm ${integrationsMsg.type === 'ok' ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'}`}>
                  {integrationsMsg.text}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Cloud Name</Label>
                  <Input
                    placeholder="ej: dxy123abc"
                    value={integrations.cloudinaryCloudName}
                    onChange={e => setIntegrations(p => ({ ...p, cloudinaryCloudName: e.target.value }))}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Upload Preset (Unsigned)</Label>
                  <div className="relative">
                    <Input
                      type={showUploadPreset ? 'text' : 'password'}
                      placeholder="ej: perfumeria_uploads"
                      value={integrations.cloudinaryUploadPreset}
                      onChange={e => setIntegrations(p => ({ ...p, cloudinaryUploadPreset: e.target.value }))}
                      className="font-mono text-sm pr-10"
                    />
                    <button type="button" onClick={() => setShowUploadPreset(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showUploadPreset ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary/40 text-sm">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${integrations.cloudinaryCloudName && integrations.cloudinaryUploadPreset ? 'bg-green-500' : 'bg-amber-400'}`} />
                <span className="text-muted-foreground text-xs">
                  {integrations.cloudinaryCloudName && integrations.cloudinaryUploadPreset
                    ? `Activo — Cloud: ${integrations.cloudinaryCloudName}`
                    : 'Sin configurar'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* ── OpenAI ── */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-5 w-5 text-muted-foreground" />
                OpenAI — Chatbot IA
              </CardTitle>
              <CardDescription>
                API Key de OpenAI. Requerida para activar el chatbot en cualquier comercio.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>API Key de IA (Google Gemini u OpenAI)</Label>
                <div className="relative">
                  <Input
                    type={showOpenAIKey ? 'text' : 'password'}
                    placeholder="AIzaSy... (Gemini) o sk-proj-... (OpenAI)"
                    value={integrations.openaiApiKey}
                    onChange={e => setIntegrations(p => ({ ...p, openaiApiKey: e.target.value }))}
                    className="font-mono text-sm pr-10"
                  />
                  <button type="button" onClick={() => setShowOpenAIKey(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showOpenAIKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Google Gemini (gratis): <strong>aistudio.google.com/apikey</strong> — OpenAI (pago): <strong>platform.openai.com/api-keys</strong>
                </p>
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary/40 text-sm">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${integrations.openaiApiKey ? 'bg-green-500' : 'bg-amber-400'}`} />
                <span className="text-muted-foreground text-xs">
                  {integrations.openaiApiKey ? 'API Key configurada — el chatbot puede activarse en comercios' : 'Sin configurar — el chatbot no funcionará'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSaveIntegrations} disabled={isSavingIntegrations} className="gap-2">
            {isSavingIntegrations ? <RefreshCw className="h-4 w-4 animate-spin" /> : integrationsMsg?.type === 'ok' ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            Guardar Integraciones
          </Button>

          {/* ── Chatbot por comercio ── */}
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bot className="h-5 w-5 text-muted-foreground" />
                  Chatbot IA por Comercio
                </CardTitle>
                <CardDescription>Activa o desactiva el chatbot para cada comercio. El comerciante configura su base de conocimiento.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchChatbotTenants} disabled={isLoadingChatbotTenants}>
                <RefreshCw className={`h-4 w-4 ${isLoadingChatbotTenants ? 'animate-spin' : ''}`} />
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingChatbotTenants ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : chatbotTenants.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No hay comercios activos</p>
              ) : (
                <div className="space-y-2">
                  {chatbotTenants.map(tenant => (
                    <div key={tenant.id} className="flex items-center justify-between p-3 rounded-lg border bg-secondary/20">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{tenant.name}</p>
                        <p className="text-xs text-muted-foreground">/{tenant.slug}</p>
                        {tenant.chatbotEnabled && tenant.botName && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">Bot: {tenant.botName}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${tenant.chatbotEnabled ? 'bg-green-500/15 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                          {tenant.chatbotEnabled ? 'Activo' : 'Inactivo'}
                        </span>
                        <button
                          type="button"
                          disabled={togglingTenantId === tenant.id}
                          onClick={() => handleToggleChatbot(tenant.id, !!tenant.chatbotEnabled)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${tenant.chatbotEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${tenant.chatbotEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      )}

      {/* ══════════════════════════════════════
          TAB: SUSCRIPCIONES (MercadoPago)
      ══════════════════════════════════════ */}
      {activeTab === 'pagos' && (
        <div className="space-y-6">

          {/* Paso 1 — Access Token */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base lg:text-lg flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-muted-foreground" />
                Paso 1 — Access Token
              </CardTitle>
              <CardDescription>
                El Access Token se configura en la pestaña <strong>Integraciones</strong> (campo "Access Token MercadoPago").
                Usa el token de <strong>Pruebas</strong> (TEST-...) para probar o el de <strong>Producción</strong> para cobros reales.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Paso 2 — Webhook */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base lg:text-lg flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                Paso 2 — Configurar Webhook en MercadoPago
              </CardTitle>
              <CardDescription>
                En tu panel de MercadoPago Developers → <strong>Notificaciones → Webhooks</strong>,
                agrega esta URL y marca el evento <strong>subscription_preapproval</strong>:
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border">
                <code className="text-xs text-foreground flex-1 break-all">
                  {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/subscriptions/webhook
                </code>
                <button
                  type="button"
                  className="shrink-0 text-xs text-primary hover:underline"
                  onClick={() => {
                    navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/subscriptions/webhook`)
                    toast.success('URL copiada')
                  }}
                >
                  Copiar
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Paso 3 — Precios */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base lg:text-lg flex items-center gap-2">
                <BadgeDollarSign className="h-5 w-5 text-muted-foreground" />
                Paso 3 — Precios de suscripción (COP / mes)
              </CardTitle>
              <CardDescription>
                Define el precio mensual de cada plan. Guárdalos antes de sincronizar con MercadoPago.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {([
                { key: 'basico' as const,      label: 'Plan Básico',      placeholder: '49900' },
                { key: 'profesional' as const,  label: 'Plan Profesional', placeholder: '99900' },
                { key: 'empresarial' as const,  label: 'Plan Empresarial', placeholder: '199900' },
              ]).map(({ key, label, placeholder }) => (
                <div key={key} className="flex items-center gap-3">
                  <Label className="w-40 shrink-0 text-sm">{label}</Label>
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-sm text-muted-foreground">$</span>
                    <Input
                      type="number"
                      value={mpPrices[key]}
                      onChange={e => setMpPrices(p => ({ ...p, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="text-sm"
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">COP / mes</span>
                  </div>
                </div>
              ))}
              <Button
                onClick={handleSaveMpPrices}
                disabled={isSavingPrices}
                variant="outline"
                size="sm"
                className="mt-2"
              >
                {isSavingPrices
                  ? <><RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" /> Guardando…</>
                  : <><Save className="h-3.5 w-3.5 mr-2" /> Guardar precios</>}
              </Button>
            </CardContent>
          </Card>

          {/* Paso 4 — Sincronizar planes */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base lg:text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                Paso 4 — Sincronizar planes con MercadoPago
              </CardTitle>
              <CardDescription>
                Crea los planes de suscripción recurrente en MercadoPago. Cada vez que cambies los precios
                debes volver a sincronizar para que MP use los nuevos montos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Plan ID status */}
              <div className="grid grid-cols-3 gap-3">
                {(['basico', 'profesional', 'empresarial'] as const).map(key => (
                  <div key={key} className="rounded-lg border border-border p-3 space-y-1">
                    <p className="text-xs font-semibold capitalize text-foreground">{key}</p>
                    {mpPlanIds[key] ? (
                      <>
                        <div className="flex items-center gap-1 text-green-500">
                          <Check className="h-3 w-3" />
                          <span className="text-[10px] font-medium">Plan activo en MP</span>
                        </div>
                        <p className="text-[10px] font-mono text-muted-foreground truncate">{mpPlanIds[key]}</p>
                      </>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">Sin sincronizar</p>
                    )}
                  </div>
                ))}
              </div>
              <Button
                onClick={handleSyncMpPlans}
                disabled={isSyncingPlans}
                className="w-full sm:w-auto"
              >
                {isSyncingPlans
                  ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Sincronizando con MercadoPago…</>
                  : <><RefreshCw className="h-4 w-4 mr-2" /> Sincronizar planes con MercadoPago</>}
              </Button>
            </CardContent>
          </Card>

          {/* Feedback message */}
          {mpMsg && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
              mpMsg.type === 'ok'
                ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                : 'bg-destructive/15 text-destructive border border-destructive/20'
            }`}>
              {mpMsg.type === 'ok' ? <Check className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
              {mpMsg.text}
            </div>
          )}

        </div>
      )}

    </div>
  )
}
