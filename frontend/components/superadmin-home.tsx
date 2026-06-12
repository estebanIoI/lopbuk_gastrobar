'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
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
  MapPin,
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
  Briefcase,
  Globe,
  QrCode,
  Copy,
  ExternalLink,
  Phone,
  Mail,
  Instagram,
  Building2,
  UserRound,
  Github,
  Linkedin,
  GripVertical,
  Zap,
  ChevronDown,
  MessageSquarePlus,
  Clock,
  Wrench,
  Target,
  Bug,
  HelpCircle,
  ChevronUp,
  AlertCircle,
  Loader2,
  DollarSign,
} from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { CloudinaryUpload, clearCloudinaryCache } from '@/components/ui/cloudinary-upload'
import { QRCodeSVG } from 'qrcode.react'
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

// ── Portafolio ──
interface PortfolioTenant { id: string; name: string; slug: string; plan: string; logoUrl?: string }

const PF_PLANS = [
  {
    name: 'Micro',
    tag: 'Tienda única',
    price: '$80.000',
    period: '/mes',
    specs: ['1 sede', '1–3 usuarios', 'POS + Inventario', 'Tienda online básica'],
    highlighted: false,
    isEnterprise: false,
  },
  {
    name: 'Pyme',
    tag: 'Negocio en crecimiento',
    price: '$300.000',
    period: '/mes',
    specs: ['2–5 sedes', '4–15 usuarios', 'Tienda + RestBar', 'Reportes avanzados'],
    highlighted: true,
    isEnterprise: false,
  },
  {
    name: 'Mediana',
    tag: 'Empresa establecida',
    price: '$4.000.000',
    period: '/mes',
    specs: ['6–20 sedes', '16–60 usuarios', 'Multi-sede + Finanzas', 'Soporte prioritario'],
    highlighted: false,
    isEnterprise: false,
  },
  {
    name: 'Enterprise',
    tag: '+20 sedes',
    price: 'Desde $5.000.000',
    period: '/mes',
    specs: ['Sedes ilimitadas', 'Usuarios ilimitados', 'SLA garantizado', 'Soporte 24/7 dedicado'],
    highlighted: false,
    isEnterprise: true,
  },
]

const PF_EXTRAS = [
  { label: 'Implementación / Onboarding', value: '$300.000 – $3.000.000' },
  { label: 'Soporte premium / 24×7', value: '+20% a +50%' },
  { label: 'Hardware (impresoras, lector, cajas)', value: 'Se cotiza aparte' },
  { label: 'Personalizaciones a medida', value: '$100.000/hora o bolsa mensual' },
]

// ── Team Cards ──
interface TeamCard {
  id: number
  name: string
  role: string
  bio: string
  photo_url: string
  accent_color: string
  sort_order: number
  is_active: boolean
  github_url: string
  linkedin_url: string
}
const emptyTeamCard = (): Omit<TeamCard, 'id'> => ({
  name: '', role: '', bio: '', photo_url: '', accent_color: '#06b6d4',
  sort_order: 0, is_active: true, github_url: '', linkedin_url: '',
})

// ── Feature Cards ──
interface FeatureCard {
  id: number
  icon: string
  title: string
  description: string
  sort_order: number
  is_active: boolean
}
const emptyFeatureCard = (): Omit<FeatureCard, 'id'> => ({
  icon: '⚡', title: '', description: '', sort_order: 0, is_active: true,
})

// ── Service Catalog ──
interface PfServiceOption {
  id: number
  category_id: number
  title: string
  description: string
  savings: string
  price: number
  is_popular: boolean
  sort_order: number
  is_active: boolean
}
interface PfServiceCategory {
  id: number
  icon: string
  label: string
  type: 'package' | 'subscription' | 'addon'
  sort_order: number
  is_active: boolean
  options: PfServiceOption[]
}
const emptyServiceCat = (): Omit<PfServiceCategory, 'id' | 'options'> => ({
  icon: '📦', label: '', type: 'package', sort_order: 0, is_active: true,
})
const emptyServiceOpt = (categoryId: number): Omit<PfServiceOption, 'id'> => ({
  category_id: categoryId, title: '', description: '', savings: '',
  price: 0, is_popular: false, sort_order: 0, is_active: true,
})

// ── Colors for tenants ──
const TENANT_COLORS = [
  '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6',
]

export function SuperadminHome() {
  // ── Tab state ──
  const [activeTab, setActiveTab] = useState<'pagina' | 'comercios' | 'timeline' | 'destacados' | 'integraciones' | 'pagos' | 'portafolio' | 'solicitudes'>('pagina')

  // ── Tarjetas de comercios (marketplace) ──
  const [marketplaceCards, setMarketplaceCards] = useState<any[]>([])
  const [isLoadingCards, setIsLoadingCards] = useState(false)
  const [cardSearch, setCardSearch] = useState('')
  const [savingCardId, setSavingCardId] = useState<string | null>(null)

  const fetchMarketplaceCards = async () => {
    setIsLoadingCards(true)
    try {
      const res = await api.getMarketplaceCards()
      if (res.success && res.data) setMarketplaceCards(res.data as any[])
    } catch { /* noop */ }
    setIsLoadingCards(false)
  }

  // Actualiza un campo localmente sin guardar todavía
  const patchCardLocal = (id: string, patch: Record<string, any>) => {
    setMarketplaceCards(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)))
  }

  // Guarda en el backend los campos editables de una tarjeta
  const saveMarketplaceCard = async (card: any) => {
    setSavingCardId(card.id)
    try {
      const res = await api.updateMarketplaceCard(card.id, {
        coverUrl: card.coverUrl ?? null,
        cardDescription: card.cardDescription ?? null,
        isVerified: Boolean(card.isVerified),
        marketplaceVisible: Boolean(card.marketplaceVisible),
        marketplaceOrder: Number(card.marketplaceOrder) || 0,
      })
      if (res.success) toast.success('Tarjeta actualizada')
      else toast.error(res.error || 'No se pudo guardar')
    } catch {
      toast.error('Error al guardar la tarjeta')
    }
    setSavingCardId(null)
  }

  // ── Dev Requests ──
  const [devRequests, setDevRequests] = useState<any[]>([])
  const [devRequestsLoading, setDevRequestsLoading] = useState(false)
  const [devHourlyRate, setDevHourlyRate] = useState('')
  const [devWhatsapp, setDevWhatsapp] = useState('')
  const [savingDevRate, setSavingDevRate] = useState(false)
  const [quotingId, setQuotingId] = useState<string | null>(null)
  const [quoteForm, setQuoteForm] = useState({ estimatedHours: '', pricePerHour: '', adminNotes: '' })
  const [statusUpdateId, setStatusUpdateId] = useState<string | null>(null)
  const [statusUpdateValue, setStatusUpdateValue] = useState('')
  const [statusUpdateNotes, setStatusUpdateNotes] = useState('')
  const [statusUpdateReject, setStatusUpdateReject] = useState('')

  const fetchDevRequests = useCallback(async () => {
    setDevRequestsLoading(true)
    const [reqRes, settingsRes] = await Promise.all([
      api.getAllDevRequests(),
      api.getDevSettings(),
    ])
    if (reqRes.success && reqRes.data) setDevRequests(reqRes.data)
    if (settingsRes.success && settingsRes.data) {
      setDevHourlyRate(String(settingsRes.data.hourlyRate || ''))
      setDevWhatsapp(settingsRes.data.whatsapp || '')
    }
    setDevRequestsLoading(false)
  }, [])

  const handleSaveDevRate = async () => {
    setSavingDevRate(true)
    const res = await api.updateDevSettings({ hourlyRate: Number(devHourlyRate), whatsapp: devWhatsapp })
    if (res.success) toast.success('Configuración guardada')
    else toast.error(res.error || 'Error al guardar')
    setSavingDevRate(false)
  }

  const handleQuote = async () => {
    if (!quotingId) return
    const res = await api.quoteDevRequest(quotingId, {
      estimatedHours: Number(quoteForm.estimatedHours),
      pricePerHour: Number(quoteForm.pricePerHour),
      adminNotes: quoteForm.adminNotes || undefined,
    })
    if (res.success) {
      toast.success('Cotización enviada')
      setQuotingId(null)
      setQuoteForm({ estimatedHours: '', pricePerHour: '', adminNotes: '' })
      fetchDevRequests()
    } else {
      toast.error(res.error || 'Error al cotizar')
    }
  }

  const handleStatusUpdate = async () => {
    if (!statusUpdateId || !statusUpdateValue) return
    const res = await api.updateDevRequestStatus(statusUpdateId, {
      status: statusUpdateValue,
      adminNotes: statusUpdateNotes || undefined,
      rejectionReason: statusUpdateReject || undefined,
    })
    if (res.success) {
      toast.success('Estado actualizado')
      setStatusUpdateId(null)
      setStatusUpdateValue('')
      setStatusUpdateNotes('')
      setStatusUpdateReject('')
      fetchDevRequests()
    } else {
      toast.error(res.error || 'Error al actualizar')
    }
  }

  // ── Hero settings ──
  const [heroUrl, setHeroUrl] = useState('')
  const [heroTitle, setHeroTitle] = useState('')
  const [heroSubtitle, setHeroSubtitle] = useState('')
  const [isSavingHero, setIsSavingHero] = useState(false)

  // ── Login image settings ──
  const [loginImageUrl, setLoginImageUrl] = useState('')
  const [isSavingLogin, setIsSavingLogin] = useState(false)

  // ── Tema del panel del comerciante (global) ──
  const [panelTheme, setPanelTheme] = useState<'classic' | 'comerciante'>('classic')
  const [isSavingTheme, setIsSavingTheme] = useState(false)

  // ── Portafolio DAIMUZ ──
  const [pfHeroTitle, setPfHeroTitle] = useState('DAIMUZ')
  const [pfHeroSubtitle, setPfHeroSubtitle] = useState('')
  const [pfHeroImage, setPfHeroImage] = useState('')
  const [pfBrandDescription, setPfBrandDescription] = useState('')
  const [pfShowPricing, setPfShowPricing] = useState(true)
  const [pfShowStores, setPfShowStores] = useState(true)
  const [pfFeaturedIds, setPfFeaturedIds] = useState<string[]>([])
  const [pfContactEmail, setPfContactEmail] = useState('')
  const [pfContactWhatsapp, setPfContactWhatsapp] = useState('')
  const [pfContactInstagram, setPfContactInstagram] = useState('')
  const [pfAccentColor, setPfAccentColor] = useState('#6366f1')
  const [pfIsPublished, setPfIsPublished] = useState(true)
  const [pfTenants, setPfTenants] = useState<PortfolioTenant[]>([])
  const [pfLoading, setPfLoading] = useState(false)
  const [pfSaving, setPfSaving] = useState(false)
  const [pfSaved, setPfSaved] = useState(false)
  const [pfShowQr, setPfShowQr] = useState(false)
  const pfQrRef = useRef<HTMLDivElement>(null)
  const pfUrl = typeof window !== 'undefined' ? `${window.location.origin}/portfolio` : '/portfolio'

  // ── Team Cards ──
  const [teamCards, setTeamCards] = useState<TeamCard[]>([])
  const [teamLoading, setTeamLoading] = useState(false)
  const [teamDialog, setTeamDialog] = useState(false)
  const [editingCard, setEditingCard] = useState<TeamCard | null>(null)
  const [teamForm, setTeamForm] = useState<Omit<TeamCard, 'id'>>(emptyTeamCard())
  const [teamSaving, setTeamSaving] = useState(false)
  const [teamDeletingId, setTeamDeletingId] = useState<number | null>(null)

  // ── Feature Cards ──
  const [featureCards, setFeatureCards] = useState<FeatureCard[]>([])
  const [featureLoading, setFeatureLoading] = useState(false)
  const [featureDialog, setFeatureDialog] = useState(false)
  const [editingFeature, setEditingFeature] = useState<FeatureCard | null>(null)
  const [featureForm, setFeatureForm] = useState<Omit<FeatureCard, 'id'>>(emptyFeatureCard())
  const [featureSaving, setFeatureSaving] = useState(false)
  const [featureDeletingId, setFeatureDeletingId] = useState<number | null>(null)

  // ── Service Catalog ──
  const [serviceCategories, setServiceCategories] = useState<PfServiceCategory[]>([])
  const [serviceLoading, setServiceLoading] = useState(false)
  const [serviceCatDialog, setServiceCatDialog] = useState(false)
  const [editingCat, setEditingCat] = useState<PfServiceCategory | null>(null)
  const [serviceCatForm, setServiceCatForm] = useState<Omit<PfServiceCategory, 'id' | 'options'>>(emptyServiceCat())
  const [serviceCatSaving, setServiceCatSaving] = useState(false)
  const [serviceCatDeletingId, setServiceCatDeletingId] = useState<number | null>(null)
  const [serviceOptDialog, setServiceOptDialog] = useState(false)
  const [editingOpt, setEditingOpt] = useState<PfServiceOption | null>(null)
  const [serviceOptForm, setServiceOptForm] = useState<Omit<PfServiceOption, 'id'>>(emptyServiceOpt(0))
  const [serviceOptSaving, setServiceOptSaving] = useState(false)
  const [serviceOptDeletingId, setServiceOptDeletingId] = useState<number | null>(null)
  const [expandedCatId, setExpandedCatId] = useState<number | null>(null)

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

  // ── Asistente de plataforma (toda la infraestructura) ──
  const [platformAssistant, setPlatformAssistant] = useState(false)
  const [togglingAssistant, setTogglingAssistant] = useState(false)

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
      if (result.data.panel_theme === 'comerciante' || result.data.panel_theme === 'classic') setPanelTheme(result.data.panel_theme)
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
    const pa = await api.getPlatformAssistant()
    if (pa.success) setPlatformAssistant(!!pa.data?.enabled)
  }, [])

  const toggleAssistant = async () => {
    setTogglingAssistant(true)
    const next = !platformAssistant
    const r = await api.setPlatformAssistant(next)
    if (r.success) setPlatformAssistant(next)
    setTogglingAssistant(false)
  }

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
    if (activeTab === 'portafolio') { fetchPortfolioConfig(); fetchTeamCards(); fetchFeatureCards(); fetchServiceCatalog() }
    if (activeTab === 'solicitudes') fetchDevRequests()
    if (activeTab === 'comercios') fetchMarketplaceCards()
  }, [activeTab, timelinePeriod, fetchTimeline, fetchIntegrations, fetchChatbotTenants, fetchDevRequests])

  useEffect(() => {
    if (activeTab === 'destacados') fetchFeatured()
  }, [activeTab, fetchFeatured])

  // ── Portafolio helpers ──────────────────────────────────────────────────────
  const fetchPortfolioConfig = async () => {
    setPfLoading(true)
    const res = await api.getPortfolioConfig()
    if (res.success && res.data) {
      const d = res.data
      setPfHeroTitle(d.heroTitle || 'DAIMUZ')
      setPfHeroSubtitle(d.heroSubtitle || '')
      setPfHeroImage(d.heroImageUrl || '')
      setPfBrandDescription(d.brandDescription || '')
      setPfShowPricing(d.showPricing ?? true)
      setPfShowStores(d.showFeaturedStores ?? true)
      setPfFeaturedIds(d.featuredTenantIds || [])
      setPfContactEmail(d.contactEmail || '')
      setPfContactWhatsapp(d.contactWhatsapp || '')
      setPfContactInstagram(d.contactInstagram || '')
      setPfAccentColor(d.accentColor || '#6366f1')
      setPfIsPublished(d.isPublished ?? true)
      setPfTenants(d.tenants || [])
    }
    setPfLoading(false)
  }

  const handleSavePortfolio = async () => {
    setPfSaving(true)
    const res = await api.updatePortfolioConfig({
      heroTitle: pfHeroTitle,
      heroSubtitle: pfHeroSubtitle,
      heroImageUrl: pfHeroImage,
      brandDescription: pfBrandDescription,
      showPricing: pfShowPricing,
      showFeaturedStores: pfShowStores,
      featuredTenantIds: pfFeaturedIds,
      contactEmail: pfContactEmail,
      contactWhatsapp: pfContactWhatsapp,
      contactInstagram: pfContactInstagram,
      accentColor: pfAccentColor,
      isPublished: pfIsPublished,
    })
    if (res.success) {
      setPfSaved(true)
      toast.success('Portafolio guardado')
      setTimeout(() => setPfSaved(false), 3000)
    } else {
      toast.error(res.error || 'Error al guardar')
    }
    setPfSaving(false)
  }

  // ── Team Cards helpers ──────────────────────────────────────────────────────
  const fetchTeamCards = async () => {
    setTeamLoading(true)
    const res = await api.getPortfolioTeamAll()
    if (res.success && res.data) setTeamCards(res.data as TeamCard[])
    setTeamLoading(false)
  }

  const openNewCard = () => {
    setEditingCard(null)
    setTeamForm(emptyTeamCard())
    setTeamDialog(true)
  }

  const openEditCard = (card: TeamCard) => {
    setEditingCard(card)
    setTeamForm({
      name: card.name, role: card.role, bio: card.bio,
      photo_url: card.photo_url, accent_color: card.accent_color,
      sort_order: card.sort_order, is_active: Boolean(card.is_active),
      github_url: card.github_url, linkedin_url: card.linkedin_url,
    })
    setTeamDialog(true)
  }

  const handleSaveTeamCard = async () => {
    if (!teamForm.name.trim()) { toast.error('El nombre es requerido'); return }
    setTeamSaving(true)
    const payload = {
      name: teamForm.name, role: teamForm.role, bio: teamForm.bio,
      photoUrl: teamForm.photo_url, accentColor: teamForm.accent_color,
      sortOrder: teamForm.sort_order, isActive: teamForm.is_active,
      githubUrl: teamForm.github_url, linkedinUrl: teamForm.linkedin_url,
    }
    const res = editingCard
      ? await api.updatePortfolioTeamCard(editingCard.id, payload)
      : await api.createPortfolioTeamCard(payload)
    if (res.success) {
      toast.success(editingCard ? 'Tarjeta actualizada' : 'Tarjeta creada')
      setTeamDialog(false)
      fetchTeamCards()
    } else {
      toast.error(res.error || 'Error al guardar')
    }
    setTeamSaving(false)
  }

  const handleDeleteTeamCard = async (id: number) => {
    setTeamDeletingId(id)
    const res = await api.deletePortfolioTeamCard(id)
    if (res.success) { toast.success('Tarjeta eliminada'); fetchTeamCards() }
    else toast.error(res.error || 'Error al eliminar')
    setTeamDeletingId(null)
  }

  // ── Feature Cards handlers ──────────────────────────────────────────────────
  const fetchFeatureCards = async () => {
    setFeatureLoading(true)
    const res = await api.getPortfolioFeaturesAll()
    if (res.success && res.data) setFeatureCards(res.data as FeatureCard[])
    setFeatureLoading(false)
  }

  const openNewFeature = () => {
    setEditingFeature(null)
    setFeatureForm(emptyFeatureCard())
    setFeatureDialog(true)
  }

  const openEditFeature = (f: FeatureCard) => {
    setEditingFeature(f)
    setFeatureForm({ icon: f.icon, title: f.title, description: f.description, sort_order: f.sort_order, is_active: Boolean(f.is_active) })
    setFeatureDialog(true)
  }

  const handleSaveFeature = async () => {
    if (!featureForm.title.trim()) { toast.error('El título es requerido'); return }
    setFeatureSaving(true)
    const payload = { icon: featureForm.icon, title: featureForm.title, description: featureForm.description, sortOrder: featureForm.sort_order, isActive: featureForm.is_active }
    const res = editingFeature
      ? await api.updatePortfolioFeature(editingFeature.id, payload)
      : await api.createPortfolioFeature(payload)
    if (res.success) { toast.success(editingFeature ? 'Característica actualizada' : 'Característica creada'); setFeatureDialog(false); fetchFeatureCards() }
    else toast.error(res.error || 'Error al guardar')
    setFeatureSaving(false)
  }

  const handleDeleteFeature = async (id: number) => {
    setFeatureDeletingId(id)
    const res = await api.deletePortfolioFeature(id)
    if (res.success) { toast.success('Característica eliminada'); fetchFeatureCards() }
    else toast.error(res.error || 'Error al eliminar')
    setFeatureDeletingId(null)
  }

  // ── Service Catalog handlers ────────────────────────────────────────────────
  const fetchServiceCatalog = async () => {
    setServiceLoading(true)
    const res = await api.getPortfolioServicesAll()
    if (res.success && res.data) setServiceCategories(res.data as PfServiceCategory[])
    setServiceLoading(false)
  }

  const openNewServiceCat = () => {
    setEditingCat(null)
    setServiceCatForm(emptyServiceCat())
    setServiceCatDialog(true)
  }

  const openEditServiceCat = (cat: PfServiceCategory) => {
    setEditingCat(cat)
    setServiceCatForm({ icon: cat.icon, label: cat.label, type: cat.type, sort_order: cat.sort_order, is_active: Boolean(cat.is_active) })
    setServiceCatDialog(true)
  }

  const handleSaveServiceCat = async () => {
    if (!serviceCatForm.label.trim()) { toast.error('La etiqueta es requerida'); return }
    setServiceCatSaving(true)
    const payload = { icon: serviceCatForm.icon, label: serviceCatForm.label, type: serviceCatForm.type, sortOrder: serviceCatForm.sort_order, isActive: serviceCatForm.is_active }
    const res = editingCat
      ? await api.updatePortfolioServiceCategory(editingCat.id, payload)
      : await api.createPortfolioServiceCategory(payload)
    if (res.success) { toast.success(editingCat ? 'Categoría actualizada' : 'Categoría creada'); setServiceCatDialog(false); fetchServiceCatalog() }
    else toast.error(res.error || 'Error al guardar')
    setServiceCatSaving(false)
  }

  const handleDeleteServiceCat = async (id: number) => {
    setServiceCatDeletingId(id)
    const res = await api.deletePortfolioServiceCategory(id)
    if (res.success) { toast.success('Categoría eliminada'); fetchServiceCatalog() }
    else toast.error(res.error || 'Error')
    setServiceCatDeletingId(null)
  }

  const openNewServiceOpt = (categoryId: number) => {
    setEditingOpt(null)
    setServiceOptForm(emptyServiceOpt(categoryId))
    setServiceOptDialog(true)
  }

  const openEditServiceOpt = (opt: PfServiceOption) => {
    setEditingOpt(opt)
    setServiceOptForm({ category_id: opt.category_id, title: opt.title, description: opt.description, savings: opt.savings, price: opt.price, is_popular: Boolean(opt.is_popular), sort_order: opt.sort_order, is_active: Boolean(opt.is_active) })
    setServiceOptDialog(true)
  }

  const handleSaveServiceOpt = async () => {
    if (!serviceOptForm.title.trim()) { toast.error('El título es requerido'); return }
    setServiceOptSaving(true)
    const payload = { categoryId: serviceOptForm.category_id, title: serviceOptForm.title, description: serviceOptForm.description, savings: serviceOptForm.savings, price: serviceOptForm.price, isPopular: serviceOptForm.is_popular, sortOrder: serviceOptForm.sort_order, isActive: serviceOptForm.is_active }
    const res = editingOpt
      ? await api.updatePortfolioServiceOption(editingOpt.id, payload)
      : await api.createPortfolioServiceOption(payload)
    if (res.success) { toast.success(editingOpt ? 'Opción actualizada' : 'Opción creada'); setServiceOptDialog(false); fetchServiceCatalog() }
    else toast.error(res.error || 'Error al guardar')
    setServiceOptSaving(false)
  }

  const handleDeleteServiceOpt = async (id: number) => {
    setServiceOptDeletingId(id)
    const res = await api.deletePortfolioServiceOption(id)
    if (res.success) { toast.success('Opción eliminada'); fetchServiceCatalog() }
    else toast.error(res.error || 'Error')
    setServiceOptDeletingId(null)
  }

  const handleDownloadQr = () => {
    if (!pfQrRef.current) return
    const svg = pfQrRef.current.querySelector('svg')
    if (!svg) return
    const svgData = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([svgData], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'portafolio-daimuz-qr.svg'
    a.click()
    URL.revokeObjectURL(url)
  }

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

  const handleSavePanelTheme = async (value: 'classic' | 'comerciante') => {
    setIsSavingTheme(true)
    const prev = panelTheme
    setPanelTheme(value)
    const result = await api.updatePlatformSetting('panel_theme', value)
    if (result.success) {
      try { localStorage.setItem('panel_theme', value) } catch { /* ignore */ }
      toast.success(value === 'comerciante' ? 'Tema 2 (Panel Comerciante) activado' : 'Tema clásico activado')
    } else {
      setPanelTheme(prev)
      toast.error(result.error || 'Error al guardar el tema')
    }
    setIsSavingTheme(false)
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
          { id: 'comercios', label: 'Tarjetas de Comercios', icon: Store },
          { id: 'timeline', label: 'Línea de Ventas', icon: TrendingUp },
          { id: 'destacados', label: 'Productos Destacados', icon: Star },
          { id: 'integraciones', label: 'Integraciones', icon: Plug },
          { id: 'pagos', label: 'Suscripciones', icon: CreditCard },
          { id: 'portafolio', label: 'Portafolio', icon: Briefcase },
          { id: 'solicitudes', label: 'Solicitudes Dev', icon: MessageSquarePlus },
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

          {/* ── Tema del Panel del Comerciante ── */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base lg:text-lg flex items-center gap-2">
                <LayoutTemplate className="h-5 w-5 text-muted-foreground" />
                Tema del Panel del Comerciante
              </CardTitle>
              <CardDescription>
                Elige el diseño con el que TODOS los comercios ven su panel de administración. El cambio es global e inmediato.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {([
                  { value: 'classic', title: 'Tema clásico', desc: 'Barra lateral flotante + secciones. El diseño original.', accent: '#6366f1' },
                  { value: 'comerciante', title: 'Tema 2 · Comerciante', desc: 'Navbar verde con mega-menús, accesos rápidos, “Requiere tu atención”, guía interactiva y asistente.', accent: '#00833E' },
                ] as const).map(opt => {
                  const selected = panelTheme === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={isSavingTheme}
                      onClick={() => handleSavePanelTheme(opt.value)}
                      className={`relative text-left rounded-lg border-2 p-4 transition-all disabled:opacity-60 ${
                        selected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/40 bg-background'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-3 w-3 rounded-full" style={{ background: opt.accent }} />
                          <span className="text-sm font-semibold text-foreground">{opt.title}</span>
                        </div>
                        {selected && <Check className="h-4 w-4 text-primary" />}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{opt.desc}</p>
                      {selected && <span className="mt-2 inline-block text-[11px] font-medium text-primary">Activo</span>}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                El superadmin siempre ve el tema clásico. El Tema 2 aplica a comerciantes, vendedores y bodega.
              </p>
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
      {/* ══════════════════════════════════════
          TAB: TARJETAS DE COMERCIOS (marketplace)
      ══════════════════════════════════════ */}
      {activeTab === 'comercios' && (
        <div className="space-y-6">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <div className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base lg:text-lg flex items-center gap-2">
                    <Store className="h-5 w-5 text-muted-foreground" />
                    Tarjetas de Comercios en la Página Principal
                  </CardTitle>
                  <CardDescription>
                    Configura cómo se presenta cada comercio: verificado, portada, descripción, visibilidad y orden. El estado abierto/cerrado es automático según el horario que define el comerciante en Mi Tienda.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchMarketplaceCards} disabled={isLoadingCards}>
                  <RefreshCw className={`h-4 w-4 ${isLoadingCards ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Buscador */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={cardSearch}
                  onChange={(e) => setCardSearch(e.target.value)}
                  placeholder="Buscar comercio por nombre o slug..."
                  className="pl-9 pr-4"
                />
              </div>

              {isLoadingCards ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : marketplaceCards.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">No hay comercios activos</p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {(Array.isArray(marketplaceCards) ? marketplaceCards : [])
                    .filter(c => {
                      const q = cardSearch.trim().toLowerCase()
                      if (!q) return true
                      return (c.name || '').toLowerCase().includes(q) || (c.slug || '').toLowerCase().includes(q)
                    })
                    .map(card => (
                      <div key={card.id} className="rounded-xl border border-border bg-background overflow-hidden">
                        {/* Encabezado: preview */}
                        <div className="flex items-center gap-3 p-3 border-b border-border bg-secondary/20">
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
                            {(card.coverUrl || card.logoUrl) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={card.coverUrl || card.logoUrl} alt={card.name} className="w-full h-full object-cover" />
                            ) : (
                              <Store className="h-5 w-5 text-muted-foreground/40" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-semibold truncate">{card.name}</p>
                              {Boolean(card.isVerified) && <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              /{card.slug}
                              {card.city ? ` · ${card.city}` : ''}
                              {typeof card.sedeCount === 'number' ? ` · ${card.sedeCount} sede(s)` : ''}
                            </p>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${card.openState === 'closed' ? 'bg-red-500/15 text-red-500' : 'bg-green-500/15 text-green-600'}`}>
                            {card.openState === 'closed' ? 'CERRADO' : 'ABIERTO'}
                          </span>
                        </div>

                        {/* Cuerpo: campos editables */}
                        <div className="p-3 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-medium text-muted-foreground mb-1 block">URL de portada</label>
                              <Input
                                value={card.coverUrl ?? ''}
                                onChange={(e) => patchCardLocal(card.id, { coverUrl: e.target.value })}
                                placeholder="https://..."
                                className="h-9 text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-muted-foreground mb-1 block">Descripción corta</label>
                              <Input
                                value={card.cardDescription ?? ''}
                                onChange={(e) => patchCardLocal(card.id, { cardDescription: e.target.value })}
                                placeholder="Ej: Cocina peruana auténtica"
                                maxLength={300}
                                className="h-9 text-sm"
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {/* Verificado */}
                            <button
                              type="button"
                              onClick={() => patchCardLocal(card.id, { isVerified: !card.isVerified })}
                              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${card.isVerified ? 'bg-blue-500/10 border-blue-500/40 text-blue-600' : 'border-border text-muted-foreground hover:bg-muted'}`}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {card.isVerified ? 'Verificado' : 'Sin verificar'}
                            </button>

                            {/* Abierto / Cerrado (automático por horario, solo lectura) */}
                            <span
                              title={card.hasSchedule ? 'Estado calculado automáticamente según el horario que configura el comerciante en Mi Tienda' : 'Sin horario configurado: se muestra abierto por defecto'}
                              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border ${card.openState === 'closed' ? 'bg-red-500/10 border-red-500/40 text-red-600' : 'bg-green-500/10 border-green-500/40 text-green-600'}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${card.openState === 'closed' ? 'bg-red-500' : 'bg-green-500'}`} />
                              {card.openState === 'closed' ? 'Cerrado' : 'Abierto'}
                              <span className="opacity-60">· {card.hasSchedule ? 'horario' : 'sin horario'}</span>
                            </span>

                            {/* Visible */}
                            <button
                              type="button"
                              onClick={() => patchCardLocal(card.id, { marketplaceVisible: !card.marketplaceVisible })}
                              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${card.marketplaceVisible ? 'border-border text-foreground hover:bg-muted' : 'bg-amber-500/10 border-amber-500/40 text-amber-600'}`}
                            >
                              {card.marketplaceVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                              {card.marketplaceVisible ? 'Visible' : 'Oculto'}
                            </button>

                            {/* Orden */}
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span>Orden</span>
                              <Input
                                type="number"
                                min={0}
                                value={card.marketplaceOrder ?? 0}
                                onChange={(e) => patchCardLocal(card.id, { marketplaceOrder: e.target.value })}
                                className="h-8 w-16 text-sm"
                              />
                            </div>

                            {/* Guardar */}
                            <Button
                              size="sm"
                              className="ml-auto"
                              onClick={() => saveMarketplaceCard(card)}
                              disabled={savingCardId === card.id}
                            >
                              {savingCardId === card.id
                                ? <RefreshCw className="h-4 w-4 animate-spin" />
                                : <Save className="h-4 w-4" />}
                              <span className="ml-1.5">Guardar</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

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

          {/* ── Asistente de plataforma ── */}
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bot className="h-5 w-5 text-muted-foreground" />
                  Asistente de Plataforma
                </CardTitle>
                <CardDescription>
                  Actívalo en toda la infraestructura. El usuario verá un asistente que lo ayuda a llenar su perfil, armar su rutina a medida, plan de comidas y recomendarle productos de los comercios. Requiere la API Key de IA configurada arriba.
                </CardDescription>
              </div>
              <button
                onClick={toggleAssistant}
                disabled={togglingAssistant}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors flex-shrink-0 ${platformAssistant ? 'bg-green-500' : 'bg-muted-foreground/30'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${platformAssistant ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary/40 text-sm">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${platformAssistant ? 'bg-green-500' : 'bg-amber-400'}`} />
                <span className="text-muted-foreground text-xs">
                  {platformAssistant ? 'Activo — el asistente aparece para los usuarios de la plataforma' : 'Desactivado — los usuarios no ven el asistente'}
                </span>
              </div>
            </CardContent>
          </Card>

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

      {/* ══════════════════════════════════════
          TAB: PORTAFOLIO DAIMUZ
      ══════════════════════════════════════ */}
      {activeTab === 'portafolio' && (
        <div className="space-y-6">

          {/* ── Encabezado + Link compartir ── */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Globe className="h-4 w-4 text-indigo-500" />
                    Portafolio DAIMUZ
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Vista pública del portafolio de servicios. Comparte el link o QR con clientes potenciales.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${pfIsPublished ? 'bg-green-500/15 text-green-400' : 'bg-muted text-muted-foreground'}`}>
                    {pfIsPublished ? '● Publicado' : '○ Oculto'}
                  </span>
                  <a
                    href="/portfolio"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" /> Ver portafolio
                  </a>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* URL + QR */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border">
                <code className="flex-1 text-xs text-muted-foreground truncate">{pfUrl}</code>
                <button
                  onClick={() => { navigator.clipboard.writeText(pfUrl); toast.success('URL copiada') }}
                  className="flex items-center gap-1 text-xs text-foreground bg-background border border-border rounded px-2 py-1 hover:bg-muted transition-colors"
                >
                  <Copy className="h-3 w-3" /> Copiar
                </button>
                <button
                  onClick={() => setPfShowQr(v => !v)}
                  className="flex items-center gap-1 text-xs text-foreground bg-background border border-border rounded px-2 py-1 hover:bg-muted transition-colors"
                >
                  <QrCode className="h-3 w-3" /> QR
                </button>
              </div>
              {pfShowQr && (
                <div className="mt-4 flex items-start gap-4">
                  <div ref={pfQrRef} className="p-3 bg-white rounded-xl inline-block">
                    <QRCodeSVG value={pfUrl} size={140} />
                  </div>
                  <div className="space-y-2 pt-1">
                    <p className="text-xs text-muted-foreground">Escanea para abrir el portafolio</p>
                    <Button size="sm" variant="outline" onClick={handleDownloadQr}>
                      Descargar QR
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {pfLoading ? (
            <div className="flex justify-center py-10">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* ── Contenido Hero ── */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" /> Hero del portafolio
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Título de marca</Label>
                      <Input
                        value={pfHeroTitle}
                        onChange={e => setPfHeroTitle(e.target.value)}
                        placeholder="DAIMUZ"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Subtítulo</Label>
                      <Input
                        value={pfHeroSubtitle}
                        onChange={e => setPfHeroSubtitle(e.target.value)}
                        placeholder="Soluciones de gestión para tu negocio"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Descripción de la marca</Label>
                    <textarea
                      value={pfBrandDescription}
                      onChange={e => setPfBrandDescription(e.target.value)}
                      placeholder="Describe tu propuesta de valor..."
                      rows={3}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Imagen / logo del hero</Label>
                    <CloudinaryUpload
                      value={pfHeroImage}
                      onChange={(url: string) => setPfHeroImage(url)}
                      label="Subir imagen del hero"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Label className="text-xs">Color de acento</Label>
                    <input
                      type="color"
                      value={pfAccentColor}
                      onChange={e => setPfAccentColor(e.target.value)}
                      className="w-9 h-9 rounded-lg border border-border cursor-pointer"
                    />
                    <code className="text-xs text-muted-foreground">{pfAccentColor}</code>
                  </div>
                </CardContent>
              </Card>

              {/* ── Visibilidad ── */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Eye className="h-4 w-4" /> Visibilidad
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: 'Portafolio publicado (visible al público)', value: pfIsPublished, set: setPfIsPublished },
                    { label: 'Mostrar sección de precios', value: pfShowPricing, set: setPfShowPricing },
                    { label: 'Mostrar comercios integrados', value: pfShowStores, set: setPfShowStores },
                  ].map(({ label, value, set }) => (
                    <label key={label} className="flex items-center justify-between cursor-pointer group">
                      <span className="text-sm">{label}</span>
                      <button
                        onClick={() => set(!value)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${value ? 'bg-indigo-500' : 'bg-muted'}`}
                      >
                        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-1'}`} />
                      </button>
                    </label>
                  ))}
                </CardContent>
              </Card>

              {/* ── Planes & Precios — Preview ── */}
              <Card className="border-border bg-card overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BadgeDollarSign className="h-4 w-4 text-indigo-400" /> Planes & Precios
                  </CardTitle>
                  <CardDescription>
                    Vista previa de la sección de precios del portafolio. Se muestra cuando &quot;Mostrar sección de precios&quot; está activo.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="bg-[#0a0a0f] rounded-b-lg p-6 space-y-6">
                    {/* Encabezado de sección */}
                    <div className="text-center space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: pfAccentColor }}>
                        Planes & Precios
                      </p>
                      <h3 className="text-white text-xl sm:text-2xl font-bold leading-tight">
                        Escala tu negocio con el plan perfecto
                      </h3>
                      <p className="text-gray-500 text-xs">Precios en COP · IVA no incluido · Contrato mensual</p>
                    </div>

                    {/* Grid de planes */}
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {PF_PLANS.map(plan => (
                        <div
                          key={plan.name}
                          className="relative flex flex-col p-4 rounded-xl border"
                          style={
                            plan.highlighted
                              ? { borderColor: pfAccentColor, background: `${pfAccentColor}12` }
                              : { borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.025)' }
                          }
                        >
                          {plan.highlighted && (
                            <div
                              className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest text-white whitespace-nowrap"
                              style={{ background: pfAccentColor }}
                            >
                              Popular
                            </div>
                          )}
                          {plan.isEnterprise && (
                            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-yellow-500 text-black whitespace-nowrap">
                              Enterprise
                            </div>
                          )}
                          <div className="mb-3">
                            <p className="text-white font-bold text-sm">{plan.name}</p>
                            <p className="text-gray-500 text-[11px] mt-0.5">{plan.tag}</p>
                          </div>
                          <div className="mb-4">
                            <span className="text-white text-lg font-black">{plan.price}</span>
                            <span className="text-gray-500 text-xs">{plan.period}</span>
                          </div>
                          <ul className="space-y-1.5 flex-1">
                            {plan.specs.map(s => (
                              <li key={s} className="flex items-center gap-1.5 text-xs text-gray-400">
                                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 flex-shrink-0" style={{ color: pfAccentColor }}>
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>

                    {/* Extras */}
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                      <p className="text-xs font-semibold text-gray-300 mb-3">Costos adicionales frecuentes</p>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {PF_EXTRAS.map(e => (
                          <div key={e.label} className="flex items-start justify-between gap-3 text-xs">
                            <span className="text-gray-500">{e.label}</span>
                            <span className="text-gray-300 font-medium text-right whitespace-nowrap">{e.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ── Contacto ── */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Phone className="h-4 w-4" /> Información de contacto
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" /> Email</Label>
                      <Input
                        value={pfContactEmail}
                        onChange={e => setPfContactEmail(e.target.value)}
                        placeholder="hola@daimuz.com"
                        type="email"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> WhatsApp</Label>
                      <Input
                        value={pfContactWhatsapp}
                        onChange={e => setPfContactWhatsapp(e.target.value)}
                        placeholder="+573001234567"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1"><Instagram className="h-3 w-3" /> Instagram URL</Label>
                      <Input
                        value={pfContactInstagram}
                        onChange={e => setPfContactInstagram(e.target.value)}
                        placeholder="https://instagram.com/daimuz"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ── Comercios destacados ── */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> Comercios destacados
                    <span className="ml-auto text-xs text-muted-foreground font-normal">
                      {pfFeaturedIds.length} seleccionados
                    </span>
                  </CardTitle>
                  <CardDescription>
                    Elige qué negocios mostrar en la sección "Clientes que confían en DAIMUZ".
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {pfTenants.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No hay comercios activos</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {pfTenants.map(t => {
                        const isSelected = pfFeaturedIds.includes(t.id)
                        return (
                          <label
                            key={t.id}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                              isSelected
                                ? 'border-indigo-400 bg-indigo-500/10'
                                : 'border-input hover:bg-muted'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() =>
                                setPfFeaturedIds(prev =>
                                  isSelected ? prev.filter(x => x !== t.id) : [...prev, t.id]
                                )
                              }
                              className="rounded"
                            />
                            {t.logoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={t.logoUrl} alt={t.name} className="w-7 h-7 rounded-full object-cover border border-border" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                                {t.name.charAt(0)}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{t.name}</p>
                              <p className="text-xs text-muted-foreground capitalize">{t.plan} · {t.slug}</p>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  )}
                  {pfFeaturedIds.length > 0 && (
                    <button
                      onClick={() => setPfFeaturedIds([])}
                      className="mt-2 text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Limpiar selección
                    </button>
                  )}
                </CardContent>
              </Card>

              {/* ── Características (Feature Cards) ── */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-400" /> Características
                    </CardTitle>
                    <Button size="sm" onClick={openNewFeature} className="flex items-center gap-1.5">
                      <Plus className="h-4 w-4" /> Nueva
                    </Button>
                  </div>
                  <CardDescription>Tarjetas de funcionalidades de la sección Características del portafolio.</CardDescription>
                </CardHeader>
                <CardContent>
                  {featureLoading ? (
                    <div className="flex justify-center py-6"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                  ) : featureCards.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      <Zap className="h-8 w-8 mx-auto mb-2 opacity-20" />
                      Sin características — se usarán las predeterminadas
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-3">
                      {featureCards.map(feat => (
                        <div key={feat.id} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-muted/30">
                          <span className="text-2xl">{feat.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{feat.title}</p>
                            {feat.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{feat.description}</p>}
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${feat.is_active ? 'bg-green-500/15 text-green-400' : 'bg-muted text-muted-foreground'}`}>
                                {feat.is_active ? 'Activa' : 'Oculta'}
                              </span>
                              <span className="text-[10px] text-muted-foreground">Orden: {feat.sort_order}</span>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => openEditFeature(feat)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => handleDeleteFeature(feat.id)} disabled={featureDeletingId === feat.id} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                              {featureDeletingId === feat.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── Catálogo de Servicios ── */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Package className="h-4 w-4 text-indigo-400" /> Catálogo de Servicios
                    </CardTitle>
                    <Button size="sm" onClick={openNewServiceCat} className="flex items-center gap-1.5">
                      <Plus className="h-4 w-4" /> Nueva categoría
                    </Button>
                  </div>
                  <CardDescription>Categorías y opciones del constructor interactivo de servicios.</CardDescription>
                </CardHeader>
                <CardContent>
                  {serviceLoading ? (
                    <div className="flex justify-center py-6"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                  ) : serviceCategories.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-20" />
                      Sin categorías — se usará el catálogo predeterminado
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {serviceCategories.map(cat => (
                        <div key={cat.id} className="rounded-xl border border-border overflow-hidden">
                          <div className="flex items-center gap-3 p-3 bg-muted/30">
                            <span className="text-xl">{cat.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm truncate">{cat.label}</p>
                              <p className="text-xs text-muted-foreground capitalize">{cat.type} · {cat.options?.length ?? 0} opciones</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => openNewServiceOpt(cat.id)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-xs flex items-center gap-1">
                                <Plus className="h-3 w-3" />
                              </button>
                              <button onClick={() => openEditServiceCat(cat)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => handleDeleteServiceCat(cat.id)} disabled={serviceCatDeletingId === cat.id} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                                {serviceCatDeletingId === cat.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                              </button>
                              <button onClick={() => setExpandedCatId(expandedCatId === cat.id ? null : cat.id)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expandedCatId === cat.id ? 'rotate-180' : ''}`} />
                              </button>
                            </div>
                          </div>
                          {expandedCatId === cat.id && (
                            <div className="p-3 pt-0 space-y-1.5 border-t border-border">
                              {(cat.options || []).length === 0 ? (
                                <p className="text-xs text-muted-foreground py-2 text-center">Sin opciones — agrega una con el botón +</p>
                              ) : (cat.options || []).map(opt => (
                                <div key={opt.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/20">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">{opt.title}</p>
                                    <p className="text-[10px] text-muted-foreground">${Number(opt.price).toLocaleString('es-CO')}{opt.savings ? ` · ${opt.savings}` : ''}{opt.is_popular ? ' · Popular' : ''}</p>
                                  </div>
                                  <button onClick={() => openEditServiceOpt(opt)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  <button onClick={() => handleDeleteServiceOpt(opt.id)} disabled={serviceOptDeletingId === opt.id} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                                    {serviceOptDeletingId === opt.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── Equipo / Carnets ── */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-cyan-400" /> Tarjetas del equipo
                    </CardTitle>
                    <Button size="sm" onClick={openNewCard} className="flex items-center gap-1.5">
                      <Plus className="h-4 w-4" /> Nueva tarjeta
                    </Button>
                  </div>
                  <CardDescription>
                    Carnets 3D interactivos que aparecen en el carrusel del portafolio público.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {teamLoading ? (
                    <div className="flex justify-center py-6"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                  ) : teamCards.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <UserRound className="h-10 w-10 mx-auto mb-2 opacity-20" />
                      Sin tarjetas — crea la primera para mostrarla en el portafolio
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {teamCards.map(card => (
                        <div
                          key={card.id}
                          className="relative rounded-2xl border border-border overflow-hidden"
                          style={{ background: `linear-gradient(135deg, #0f0f1a 0%, ${card.accent_color}18 100%)` }}
                        >
                          {/* mini carnet preview */}
                          <div className="p-4 flex gap-3 items-start">
                            <div
                              className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 border-2"
                              style={{ borderColor: card.accent_color }}
                            >
                              {card.photo_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={card.photo_url} alt={card.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xl font-bold"
                                  style={{ background: `${card.accent_color}33`, color: card.accent_color }}>
                                  {card.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-sm text-white truncate">{card.name}</p>
                              <p className="text-xs truncate" style={{ color: card.accent_color }}>{card.role}</p>
                              {card.bio && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{card.bio}</p>}
                              <div className="flex items-center gap-2 mt-1.5">
                                {card.github_url && <Github className="h-3 w-3 text-gray-500" />}
                                {card.linkedin_url && <Linkedin className="h-3 w-3 text-gray-500" />}
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${card.is_active ? 'bg-green-500/15 text-green-400' : 'bg-muted text-muted-foreground'}`}>
                                  {card.is_active ? 'Activa' : 'Oculta'}
                                </span>
                                <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-0.5">
                                  <GripVertical className="h-3 w-3" /> {card.sort_order}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex border-t border-border">
                            <button
                              onClick={() => openEditCard(card)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                            >
                              <Pencil className="h-3 w-3" /> Editar
                            </button>
                            <button
                              onClick={() => handleDeleteTeamCard(card.id)}
                              disabled={teamDeletingId === card.id}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors border-l border-border"
                            >
                              {teamDeletingId === card.id
                                ? <RefreshCw className="h-3 w-3 animate-spin" />
                                : <><Trash2 className="h-3 w-3" /> Eliminar</>}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── Guardar ── */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleSavePortfolio}
                  disabled={pfSaving}
                  className="flex items-center gap-2"
                >
                  {pfSaving
                    ? <><RefreshCw className="h-4 w-4 animate-spin" /> Guardando…</>
                    : pfSaved
                      ? <><Check className="h-4 w-4" /> Guardado</>
                      : <><Save className="h-4 w-4" /> Guardar portafolio</>}
                </Button>
                <a
                  href="/portfolio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" /> Vista previa
                </a>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════
          DIALOG: CREAR / EDITAR TARJETA
      ══════════════════════════════════════ */}
      <Dialog open={teamDialog} onOpenChange={setTeamDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-cyan-400" />
              {editingCard ? 'Editar tarjeta' : 'Nueva tarjeta de equipo'}
            </DialogTitle>
            <DialogDescription>
              Este carnet aparece como una tarjeta 3D flotante en el portafolio público.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
            {/* Foto */}
            <div className="space-y-1.5">
              <Label className="text-xs">Foto del ingeniero</Label>
              <CloudinaryUpload
                value={teamForm.photo_url}
                onChange={(url: string) => setTeamForm(f => ({ ...f, photo_url: url }))}
                label="Subir foto"
              />
            </div>

            {/* Nombre + Rol */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nombre *</Label>
                <Input
                  value={teamForm.name}
                  onChange={e => setTeamForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Jhon Esteban"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Rol / Cargo</Label>
                <Input
                  value={teamForm.role}
                  onChange={e => setTeamForm(f => ({ ...f, role: e.target.value }))}
                  placeholder="Desarrollador Full Stack"
                />
              </div>
            </div>

            {/* Bio */}
            <div className="space-y-1.5">
              <Label className="text-xs">Bio corta</Label>
              <textarea
                value={teamForm.bio}
                onChange={e => setTeamForm(f => ({ ...f, bio: e.target.value }))}
                placeholder="Especialista en React, Node.js y arquitectura cloud..."
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Color acento + Orden */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Color de acento</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={teamForm.accent_color}
                    onChange={e => setTeamForm(f => ({ ...f, accent_color: e.target.value }))}
                    className="w-9 h-9 rounded-lg border border-border cursor-pointer"
                  />
                  <code className="text-xs text-muted-foreground">{teamForm.accent_color}</code>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Orden</Label>
                <Input
                  type="number"
                  min={0}
                  value={teamForm.sort_order}
                  onChange={e => setTeamForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                />
              </div>
            </div>

            {/* GitHub + LinkedIn */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Github className="h-3 w-3" /> GitHub URL</Label>
                <Input
                  value={teamForm.github_url}
                  onChange={e => setTeamForm(f => ({ ...f, github_url: e.target.value }))}
                  placeholder="https://github.com/user"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Linkedin className="h-3 w-3" /> LinkedIn URL</Label>
                <Input
                  value={teamForm.linkedin_url}
                  onChange={e => setTeamForm(f => ({ ...f, linkedin_url: e.target.value }))}
                  placeholder="https://linkedin.com/in/user"
                />
              </div>
            </div>

            {/* Activa */}
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">Tarjeta activa (visible en el portafolio)</span>
              <button
                type="button"
                onClick={() => setTeamForm(f => ({ ...f, is_active: !f.is_active }))}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${teamForm.is_active ? 'bg-cyan-500' : 'bg-muted'}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${teamForm.is_active ? 'translate-x-4' : 'translate-x-1'}`} />
              </button>
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTeamDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveTeamCard} disabled={teamSaving} className="flex items-center gap-2">
              {teamSaving
                ? <><RefreshCw className="h-4 w-4 animate-spin" /> Guardando…</>
                : <><Save className="h-4 w-4" /> {editingCard ? 'Actualizar' : 'Crear tarjeta'}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Característica */}
      <Dialog open={featureDialog} onOpenChange={setFeatureDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingFeature ? 'Editar característica' : 'Nueva característica'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-[auto_1fr] gap-3 items-start">
              <div>
                <Label className="text-xs mb-1 block">Icono</Label>
                <input
                  type="text"
                  value={featureForm.icon}
                  onChange={e => setFeatureForm(p => ({ ...p, icon: e.target.value }))}
                  className="w-16 h-9 text-center text-xl border rounded-lg bg-background"
                  maxLength={4}
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Título *</Label>
                <Input value={featureForm.title} onChange={e => setFeatureForm(p => ({ ...p, title: e.target.value }))} placeholder="Ej. Punto de Venta" />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Descripción</Label>
              <Textarea value={featureForm.description} onChange={e => setFeatureForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Descripción breve de la funcionalidad" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Orden</Label>
                <Input type="number" value={featureForm.sort_order} onChange={e => setFeatureForm(p => ({ ...p, sort_order: Number(e.target.value) }))} />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={featureForm.is_active} onCheckedChange={v => setFeatureForm(p => ({ ...p, is_active: v }))} />
                <Label className="text-xs">Visible</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeatureDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveFeature} disabled={featureSaving}>
              {featureSaving ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : null}
              {editingFeature ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Categoría de servicio */}
      <Dialog open={serviceCatDialog} onOpenChange={setServiceCatDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingCat ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-[auto_1fr] gap-3 items-start">
              <div>
                <Label className="text-xs mb-1 block">Icono</Label>
                <input type="text" value={serviceCatForm.icon} onChange={e => setServiceCatForm(p => ({ ...p, icon: e.target.value }))} className="w-16 h-9 text-center text-xl border rounded-lg bg-background" maxLength={4} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Etiqueta *</Label>
                <Input value={serviceCatForm.label} onChange={e => setServiceCatForm(p => ({ ...p, label: e.target.value }))} placeholder="Ej. Landing Pages" />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Tipo</Label>
              <select value={serviceCatForm.type} onChange={e => setServiceCatForm(p => ({ ...p, type: e.target.value as 'package' | 'subscription' | 'addon' }))} className="w-full h-9 border rounded-lg px-2 text-sm bg-background">
                <option value="package">Paquete (compra única)</option>
                <option value="subscription">Suscripción mensual</option>
                <option value="addon">Add-on / complemento</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Orden</Label>
                <Input type="number" value={serviceCatForm.sort_order} onChange={e => setServiceCatForm(p => ({ ...p, sort_order: Number(e.target.value) }))} />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={serviceCatForm.is_active} onCheckedChange={v => setServiceCatForm(p => ({ ...p, is_active: v }))} />
                <Label className="text-xs">Activa</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServiceCatDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveServiceCat} disabled={serviceCatSaving}>
              {serviceCatSaving ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : null}
              {editingCat ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Opción de servicio */}
      <Dialog open={serviceOptDialog} onOpenChange={setServiceOptDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingOpt ? 'Editar opción' : 'Nueva opción'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs mb-1 block">Título *</Label>
              <Input value={serviceOptForm.title} onChange={e => setServiceOptForm(p => ({ ...p, title: e.target.value }))} placeholder="Ej. Pack x10 Landings" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Descripción</Label>
              <Input value={serviceOptForm.description} onChange={e => setServiceOptForm(p => ({ ...p, description: e.target.value }))} placeholder="Descripción breve" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Precio (COP)</Label>
                <Input type="number" value={serviceOptForm.price} onChange={e => setServiceOptForm(p => ({ ...p, price: Number(e.target.value) }))} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Ahorro (texto)</Label>
                <Input value={serviceOptForm.savings} onChange={e => setServiceOptForm(p => ({ ...p, savings: e.target.value }))} placeholder="Ej. Ahorro 12%" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Orden</Label>
                <Input type="number" value={serviceOptForm.sort_order} onChange={e => setServiceOptForm(p => ({ ...p, sort_order: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1 pt-1">
                <div className="flex items-center gap-2">
                  <Switch checked={serviceOptForm.is_popular} onCheckedChange={v => setServiceOptForm(p => ({ ...p, is_popular: v }))} />
                  <Label className="text-xs">Popular</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={serviceOptForm.is_active} onCheckedChange={v => setServiceOptForm(p => ({ ...p, is_active: v }))} />
                  <Label className="text-xs">Activa</Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServiceOptDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveServiceOpt} disabled={serviceOptSaving}>
              {serviceOptSaving ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : null}
              {editingOpt ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════
          TAB: SOLICITUDES DE DESARROLLO
      ══════════════════════════════════════ */}
      {activeTab === 'solicitudes' && (
        <div className="space-y-6">

          {/* ── Config tarifa ── */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-yellow-400" />
                Tarifa del Desarrollador
              </CardTitle>
              <CardDescription>
                Define el precio por hora que se usará para calcular el costo de cada solicitud
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-3 max-w-xl">
                <div className="flex-1 min-w-[180px] space-y-1.5">
                  <Label className="text-xs">Precio por hora (COP)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={devHourlyRate}
                    onChange={e => setDevHourlyRate(e.target.value)}
                    placeholder="Ej: 100000"
                  />
                </div>
                <div className="flex-1 min-w-[200px] space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <span>📱</span> WhatsApp de contacto
                  </Label>
                  <Input
                    value={devWhatsapp}
                    onChange={e => setDevWhatsapp(e.target.value)}
                    placeholder="573001234567 (con código país)"
                  />
                </div>
                <Button onClick={handleSaveDevRate} disabled={savingDevRate} className="gap-2 shrink-0">
                  {savingDevRate ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                El número de WhatsApp aparecerá como opción de contacto cuando el comerciante reciba una cotización.
              </p>
            </CardContent>
          </Card>

          {/* ── Lista de solicitudes ── */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquarePlus className="h-5 w-5 text-primary" />
                  Solicitudes de Comerciantes
                </CardTitle>
                <Button variant="outline" size="sm" onClick={fetchDevRequests} className="gap-1">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Actualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {devRequestsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : devRequests.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <MessageSquarePlus className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No hay solicitudes aún</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {devRequests.map((req: any) => {
                    const statusColors: Record<string, string> = {
                      pendiente:   'text-gray-400 bg-gray-400/10 border-gray-400/20',
                      en_revision: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
                      cotizado:    'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
                      aprobado:    'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
                      en_progreso: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
                      completado:  'text-green-400 bg-green-400/10 border-green-400/20',
                      rechazado:   'text-red-400 bg-red-400/10 border-red-400/20',
                    }
                    const statusLabel: Record<string, string> = {
                      pendiente: 'Pendiente', en_revision: 'En revisión', cotizado: 'Cotizado',
                      aprobado: 'Aprobado', en_progreso: 'En progreso', completado: 'Completado', rechazado: 'Rechazado',
                    }
                    const prioColors: Record<string, string> = {
                      baja: 'text-green-400', media: 'text-yellow-400', alta: 'text-red-400',
                    }
                    const typeLabel: Record<string, string> = {
                      objetivo: '🎯', mejora: '✨', actualizacion: '🔄', bug: '🐛', otro: '❓',
                    }

                    return (
                      <div key={req.id} className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-sm">{typeLabel[req.type] || '❓'}</span>
                              <span className="font-medium text-sm truncate">{req.title}</span>
                              <span className={`text-xs font-semibold ${prioColors[req.priority] || 'text-muted-foreground'}`}>
                                {req.priority?.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {req.tenantName || req.tenantId} · {req.requesterName} · {new Date(req.createdAt).toLocaleDateString('es-CO')}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColors[req.status] || ''}`}>
                              {statusLabel[req.status] || req.status}
                            </span>
                            {req.totalPrice !== null && (
                              <span className="text-xs font-bold text-yellow-400">
                                ${req.totalPrice.toLocaleString('es-CO')}
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-sm text-muted-foreground line-clamp-2">{req.description}</p>

                        {req.estimatedHours !== null && (
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{req.estimatedHours}h</span>
                            <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />${(req.pricePerHour || 0).toLocaleString('es-CO')}/h</span>
                          </div>
                        )}

                        {req.adminNotes && (
                          <div className="rounded bg-blue-400/5 border border-blue-400/20 px-3 py-2">
                            <p className="text-xs text-blue-400 font-medium mb-0.5">Notas internas</p>
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{req.adminNotes}</p>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-wrap pt-1">
                          {req.status === 'pendiente' && (
                            <Button
                              size="sm" variant="outline" className="h-7 text-xs gap-1"
                              onClick={() => {
                                setQuotingId(req.id)
                                setQuoteForm({ estimatedHours: '', pricePerHour: devHourlyRate, adminNotes: '' })
                              }}
                            >
                              <DollarSign className="h-3 w-3" /> Cotizar
                            </Button>
                          )}
                          <Button
                            size="sm" variant="outline" className="h-7 text-xs gap-1"
                            onClick={() => {
                              setStatusUpdateId(req.id)
                              setStatusUpdateValue(req.status)
                              setStatusUpdateNotes(req.adminNotes || '')
                              setStatusUpdateReject('')
                            }}
                          >
                            <Wrench className="h-3 w-3" /> Estado
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

      {/* DIALOG: Cotizar solicitud */}
      <Dialog open={!!quotingId} onOpenChange={() => setQuotingId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-yellow-400" /> Cotizar Solicitud
            </DialogTitle>
            <DialogDescription>Define las horas estimadas y el precio por hora</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Horas estimadas</Label>
                <Input
                  type="number" min={0.5} step={0.5}
                  value={quoteForm.estimatedHours}
                  onChange={e => setQuoteForm(p => ({ ...p, estimatedHours: e.target.value }))}
                  placeholder="Ej: 8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Precio/hora (COP)</Label>
                <Input
                  type="number" min={0}
                  value={quoteForm.pricePerHour}
                  onChange={e => setQuoteForm(p => ({ ...p, pricePerHour: e.target.value }))}
                  placeholder="Ej: 100000"
                />
              </div>
            </div>
            {quoteForm.estimatedHours && quoteForm.pricePerHour && (
              <div className="rounded-lg bg-yellow-400/10 border border-yellow-400/20 p-3 text-center">
                <p className="text-xs text-muted-foreground">Total estimado</p>
                <p className="text-xl font-bold text-yellow-400">
                  ${(Number(quoteForm.estimatedHours) * Number(quoteForm.pricePerHour)).toLocaleString('es-CO')}
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Notas para el comerciante (opcional)</Label>
              <Textarea
                value={quoteForm.adminNotes}
                onChange={e => setQuoteForm(p => ({ ...p, adminNotes: e.target.value }))}
                placeholder="Detalles adicionales sobre el alcance o condiciones..."
                rows={3}
                className="resize-none text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuotingId(null)}>Cancelar</Button>
            <Button onClick={handleQuote} className="gap-2">
              <DollarSign className="h-4 w-4" /> Enviar cotización
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Actualizar estado */}
      <Dialog open={!!statusUpdateId} onOpenChange={() => setStatusUpdateId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" /> Actualizar Estado
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nuevo estado</Label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={statusUpdateValue}
                onChange={e => setStatusUpdateValue(e.target.value)}
              >
                <option value="pendiente">Pendiente</option>
                <option value="en_revision">En revisión</option>
                <option value="cotizado">Cotizado</option>
                <option value="aprobado">Aprobado</option>
                <option value="en_progreso">En progreso</option>
                <option value="completado">Completado</option>
                <option value="rechazado">Rechazado</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notas (opcional)</Label>
              <Textarea
                value={statusUpdateNotes}
                onChange={e => setStatusUpdateNotes(e.target.value)}
                placeholder="Comentario para el comerciante..."
                rows={3}
                className="resize-none text-sm"
              />
            </div>
            {statusUpdateValue === 'rechazado' && (
              <div className="space-y-1.5">
                <Label className="text-xs text-red-400">Motivo de rechazo *</Label>
                <Textarea
                  value={statusUpdateReject}
                  onChange={e => setStatusUpdateReject(e.target.value)}
                  placeholder="Explica por qué se rechaza la solicitud..."
                  rows={2}
                  className="resize-none text-sm border-red-400/30"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusUpdateId(null)}>Cancelar</Button>
            <Button onClick={handleStatusUpdate} className="gap-2">
              <Save className="h-4 w-4" /> Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
