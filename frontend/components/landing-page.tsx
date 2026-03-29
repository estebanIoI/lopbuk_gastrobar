'use client'

import { useState, useEffect, useRef } from 'react'

const formatCOP = (value: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
import { Button } from '@/components/ui/button'
import {
  ArrowRight,
  ChevronDown,
  Sparkles,
  Heart,
  Star,
  Eye,
  Target,
  Mail,
  Instagram,
  Facebook,
  ShoppingCart,
  Plus,
  Minus,
  X,
  Search,
  MapPin,
  Menu,
  Store,
  ArrowLeft,
  Package,
  Flame,
  Zap,
  ChevronLeft,
  ChevronRight,
  Clock,
  Bell,
  Tag,
  Timer,
  LogOut,
  LogIn,
  User,
  Percent,
  Settings,
  Shield,
  RotateCcw,
  CheckCircle,
  ShieldCheck,
  Navigation,
  Loader2,
  Truck,
  FileText,
  Phone,
  CreditCard,
  Info,
  UtensilsCrossed,
  Link,
} from 'lucide-react'
import { CheckoutView } from '@/components/checkout/CheckoutView'
import { ServiceBookingModal } from '@/components/service-booking-modal'
import { ChatWidget } from '@/components/ChatWidget'
import { ensureAbsoluteUrl } from '@/utils/url'
import { departamentosMunicipios } from '@/constants'
import { useAuthStore } from '@/lib/auth-store'
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google'
import { api } from '@/lib/api'
import type { ProductoCarrito, PedidoForm, PedidoConfirmado, CuponValidacion } from '@/types'

interface LandingPageProps {
  onGoToLogin: () => void
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}


// ====== Storefront product type ======
interface StorefrontProduct {
  id: number
  name: string
  category: string
  brand: string
  description: string
  salePrice: number
  imageUrl: string
  images?: string[] | null
  stock: number
  color?: string
  size?: string
  gender?: string
  isOnOffer?: boolean | number
  offerPrice?: number | null
  offerLabel?: string | null
  productType?: string
  material?: string
  netWeight?: number
  weightUnit?: string
  warrantyMonths?: number
  dimensions?: string
  tenantId?: string
  storeName?: string
  storeSlug?: string
  availableForDelivery?: boolean | number
  deliveryType?: 'domicilio' | 'envio' | 'ambos' | null
  sedeId?: string | null
}

export function LandingPage({ onGoToLogin }: LandingPageProps) {
  const [showCatalog, setShowCatalog] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => { setIsMobile(window.innerWidth < 640) }, [])
  // Theme
  let theme = 'dark';
  try {
    // next-themes puede usarse en client
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const useTheme = require('next-themes').useTheme;
    if (typeof window !== 'undefined') {
      theme = useTheme().theme || 'dark';
    }
  } catch {}

  // ====== CATALOG FILTER STATE ======
  const [catalogSpecialFilter, setCatalogSpecialFilter] = useState<'all' | 'trending' | 'featured' | 'offers'>('all')
  const [catalogPriceMin, setCatalogPriceMin] = useState<number>(0)
  const [catalogPriceMax, setCatalogPriceMax] = useState<number>(0)
  const [catalogSelectedSizes, setCatalogSelectedSizes] = useState<Set<string>>(new Set())
  const [catalogSelectedCategories, setCatalogSelectedCategories] = useState<Set<string>>(new Set())
  const [catalogSelectedBrands, setCatalogSelectedBrands] = useState<Set<string>>(new Set())
  const [catalogSelectedGenders, setCatalogSelectedGenders] = useState<Set<string>>(new Set())
  const [catalogSidebarOpen, setCatalogSidebarOpen] = useState(false)

  // ====== STOREFRONT STATE ======
  const [products, setProducts] = useState<StorefrontProduct[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [stores, setStores] = useState<{ id: string; name: string; slug: string; businessType: string | null; logoUrl: string | null; address: string | null; productCount: number }[]>([])
  const [selectedStore, setSelectedStore] = useState<string>('all')
  const [showStoresView, setShowStoresView] = useState(true)
  const [businessTypeFilter, setBusinessTypeFilter] = useState<string>('all')
  const [allProducts, setAllProducts] = useState<StorefrontProduct[]>([])
  const [loadingAllProducts, setLoadingAllProducts] = useState(false)
  const [storesWithServices, setStoresWithServices] = useState<Set<string>>(new Set())
  const [loadingStores, setLoadingStores] = useState(true)

  // ====== SEDES STATE ======
  const [storeSedes, setStoreSedes] = useState<{ id: string; name: string; address?: string }[]>([])
  const [activeSede, setActiveSede] = useState<string | null>(null)
  const [sedesViewMode, setSedesViewMode] = useState(false)

  // ====== OFFERS STATE ======
  const [offerProducts, setOfferProducts] = useState<StorefrontProduct[]>([])
  const [loadingOffers, setLoadingOffers] = useState(false)

  // ====== PLATFORM BG COLOR ======
  const [platformBgColor, setPlatformBgColor] = useState('#000000')

  // ====== PLATFORM HERO SETTINGS ======
  const [platformHeroUrl, setPlatformHeroUrl] = useState('')
  const [platformHeroTitle, setPlatformHeroTitle] = useState('')
  const [platformHeroSubtitle, setPlatformHeroSubtitle] = useState('')

  // ====== STORE CONFIG STATE (Hero Sections) ======
  const [storeConfig, setStoreConfig] = useState<{
    banners: Array<{ id: number; position: string; imageUrl: string; videoUrl?: string | null; title: string | null; subtitle: string | null; linkUrl: string | null }>
    categories: Array<{ name: string; displayName?: string; imageUrl: string | null }>
    featuredProducts: StorefrontProduct[]
    trendingProducts: StorefrontProduct[]
    newLaunches?: StorefrontProduct[]
    storeInfo: {
      name: string; address: string | null; phone: string | null; email: string | null; logoUrl: string | null
      schedule: string | null; locationMapUrl: string | null;
      termsContent: string | null; privacyContent: string | null; shippingTerms: string | null
      paymentMethods: string | null; socialInstagram: string | null; socialFacebook: string | null
      socialTiktok: string | null; socialWhatsapp: string | null; productCardStyle?: string | null
      showInfoModule?: boolean | null; infoModuleDescription?: string | null
    } | null
    announcementBar: { text: string; linkUrl: string | null; bgColor: string; textColor: string; isActive: boolean } | null
    activeDrop: {
      id: number; name: string; description: string | null; bannerUrl: string | null
      globalDiscount: number; startsAt: string; endsAt: string
      products: Array<StorefrontProduct & { customDiscount: number | null; finalPrice: number }>
    } | null
    bgColor?: string
    platformBgColor?: string
    publicMenuEnabled?: boolean
  } | null>(null)

  // ====== PRODUCT DETAIL MODAL STATE ======
  const [selectedProduct, setSelectedProduct] = useState<StorefrontProduct | null>(null)
  const [showProductModal, setShowProductModal] = useState(false)
  const [productQuantity, setProductQuantity] = useState(1)
  const [activeImageIdx, setActiveImageIdx] = useState(0)
  const [viewersCount, setViewersCount] = useState(0)
  const viewersIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [ctaVisible, setCtaVisible] = useState(false)
  const ctaRef = useRef<HTMLDivElement>(null)

  // ====== PRODUCT REVIEWS STATE ======
  const [productReviews, setProductReviews] = useState<any[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewForm, setReviewForm] = useState({ reviewerName: '', reviewerEmail: '', rating: 5, title: '', body: '' })
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewSuccess, setReviewSuccess] = useState(false)
  const [reviewError, setReviewError] = useState('')

  // ====== DECANT STATE ======
  const [showDecantModal, setShowDecantModal] = useState(false)
  const [decantProduct, setDecantProduct] = useState<StorefrontProduct | null>(null)
  const [decantSize, setDecantSize] = useState<'5ml' | '10ml'>('5ml')
  const [selectedPerfumeId, setSelectedPerfumeId] = useState<string>('')

  const handleConfirmDecant = () => {
    if (!decantProduct) return
    if (!selectedPerfumeId) {
      alert('Por favor selecciona un perfume')
      return
    }
    const perfumeName = products.find(p => String(p.id) === selectedPerfumeId)?.name || 'Desconocido'

    agregarAlCarrito(decantProduct, {
      isDecant: true,
      size: decantSize,
      perfume: perfumeName
    })
    setShowDecantModal(false)
    setDecantSize('5ml')
    setSelectedPerfumeId('')
  }

  // ====== PAYMENT CONFIG STATE ======
  const [paymentConfig, setPaymentConfig] = useState<{
    mercadopago: boolean; addi: boolean; sistecredito: boolean; contraentrega: boolean
  }>({ mercadopago: false, addi: false, sistecredito: false, contraentrega: true })

  // ====== CART STATE ======
  const [carrito, setCarrito] = useState<ProductoCarrito[]>([])
  const [showCart, setShowCart] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showDrop, setShowDrop] = useState(false)
  const [showServices, setShowServices] = useState(false)
  const [showNewLaunches, setShowNewLaunches] = useState(false)
  const [showOffers, setShowOffers] = useState(false)
  const [offerSearch, setOfferSearch] = useState('')
  const [newLaunchSearch, setNewLaunchSearch] = useState('')
  const [publicServices, setPublicServices] = useState<any[]>([])
  const [bookingService, setBookingService] = useState<any | null>(null)
  const [dropPopupSeen, setDropPopupSeen] = useState(false)
  const [showDropPopup, setShowDropPopup] = useState(false)
  const [showMyOrders, setShowMyOrders] = useState(false)
  const [showAccountPanel, setShowAccountPanel] = useState(false)
  const [accountTab, setAccountTab] = useState<'perfil' | 'pedidos' | 'favoritos'>('perfil')

  // ====== MOBILE BOTTOM NAV STATE ======
  const [mobileActiveTab, setMobileActiveTab] = useState<'tienda' | 'ofertas' | 'buscar' | 'cuenta' | null>('tienda')
  const [allStoreOffers, setAllStoreOffers] = useState<StorefrontProduct[]>([])
  const [loadingAllOffers, setLoadingAllOffers] = useState(false)

  // ====== PLATFORM FEATURED PRODUCTS (superadmin pinned) ======
  const [platformFeatured, setPlatformFeatured] = useState<StorefrontProduct[]>([])
  const [globalSearchQuery, setGlobalSearchQuery] = useState('')
  const [globalSearchResults, setGlobalSearchResults] = useState<StorefrontProduct[]>([])
  const [globalSearchStores, setGlobalSearchStores] = useState<typeof stores>([])
  const [loadingGlobalSearch, setLoadingGlobalSearch] = useState(false)
  const globalSearchInputRef = useRef<HTMLInputElement>(null)
  const [showDesktopSearch, setShowDesktopSearch] = useState(false)
  const desktopSearchInputRef = useRef<HTMLInputElement>(null)
  const carouselCategoriesRef = useRef<HTMLDivElement>(null)
  const carouselTrendingRef = useRef<HTMLDivElement>(null)
  const carouselFeaturedRef = useRef<HTMLDivElement>(null)
  const carouselNewLaunchRef = useRef<HTMLDivElement>(null)
  const carouselOffersRef = useRef<HTMLDivElement>(null)
  const carouselStoresRef = useRef<HTMLDivElement>(null)
  const carouselProductsRef = useRef<HTMLDivElement>(null)

  // ====== FAVORITES STATE ======
  const [favorites, setFavorites] = useState<Set<number>>(new Set())

  // ====== LOCATION STATE ======
  const [clientMunicipality, setClientMunicipality] = useState<string | null>(null)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [locationDept, setLocationDept] = useState('')
  const [locationMun, setLocationMun] = useState('')
  const [isLocatingModal, setIsLocatingModal] = useState(false)
  const [locationModalError, setLocationModalError] = useState('')
  const [detectedModalCity, setDetectedModalCity] = useState('')
  const [locationSkipped, setLocationSkipped] = useState(false)

  const [legalModal, setLegalModal] = useState<{ title: string; content: string } | null>(null)

  useEffect(() => {
    // Read localStorage only after mount to avoid SSR hydration mismatch
    const saved = localStorage.getItem('clientMunicipality') || null
    setClientMunicipality(saved)
    const skipped = sessionStorage.getItem('locationSkipped') === '1'
    setLocationSkipped(skipped)
    // Show location modal only once per session if location not set
    if (!saved && !skipped) {
      const timer = setTimeout(() => setShowLocationModal(true), 800)
      return () => clearTimeout(timer)
    }
  }, [])

  // Handle ?store=slug URL param (QR/share link)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const storeSlug = params.get('store')
    if (storeSlug) {
      setSelectedStore(storeSlug)
      setShowStoresView(false)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  // Handle MercadoPago return URL (?mp=success|failure|pending&order=<id>)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const mp = params.get('mp')
    const orderId = params.get('order')
    if (!mp) return

    // Clean the URL so a refresh doesn't retrigger
    const cleanUrl = window.location.pathname
    window.history.replaceState({}, '', cleanUrl)

    if (mp === 'success') {
      setMpReturnMsg({ type: 'success', text: '¡Pago exitoso! Tu pedido fue confirmado. Pronto recibirás novedades.' })
    } else if (mp === 'failure') {
      setMpReturnMsg({ type: 'failure', text: 'El pago no fue completado. Tu pedido fue cancelado.' })
      // Cancel the pending order so it doesn't appear in merchant dashboard
      if (orderId) {
        fetch(`${API_URL}/orders/cancel-gateway/${orderId}`, { method: 'PUT' }).catch(() => {/* ignore */})
      }
    } else if (mp === 'pending') {
      setMpReturnMsg({ type: 'pending', text: 'Tu pago está pendiente de aprobación. Te notificaremos cuando se confirme.' })
    }
  }, [])

  const saveClientLocation = () => {
    if (locationMun) {
      localStorage.setItem('clientMunicipality', locationMun)
      setClientMunicipality(locationMun)
      setLocationSkipped(false)
      sessionStorage.removeItem('locationSkipped')
    }
    setDetectedModalCity('')
    setLocationModalError('')
    setShowLocationModal(false)
  }

  const skipClientLocation = () => {
    sessionStorage.setItem('locationSkipped', '1')
    setLocationSkipped(true)
    if (clientMunicipality) {
      localStorage.removeItem('clientMunicipality')
      setClientMunicipality(null)
    }
    setShowLocationModal(false)
  }

  const handleModalLocation = () => {
    if (!navigator.geolocation) {
      setLocationModalError('Tu navegador no soporta geolocalización')
      return
    }
    setIsLocatingModal(true)
    setLocationModalError('')
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=es`
          )
          const data = await res.json()
          const addr = data.address || {}
          const dept = addr.state || addr.region || ''
          const mun = addr.city || addr.town || addr.municipality || addr.county || addr.village || ''
          if (dept) setLocationDept(dept)
          if (mun) setLocationMun(mun)
          const label = [mun, dept].filter(Boolean).join(', ')
          setDetectedModalCity(label || 'Ubicación detectada')
        } catch {
          setDetectedModalCity('Ubicación detectada')
        }
        setIsLocatingModal(false)
      },
      (err) => {
        setIsLocatingModal(false)
        if (err.code === 1) {
          setLocationModalError('Permiso denegado. Activa la ubicación en tu navegador.')
        } else {
          setLocationModalError('No se pudo obtener tu ubicación.')
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const toggleFavorite = (productId: number) => {
    const key = authUser?.id ? `storeFavorites_${authUser.id}` : 'storeFavorites_guest'
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      localStorage.setItem(key, JSON.stringify([...next]))
      return next
    })
  }

  // ====== AUTH (unified) ======
  const { user: authUser, isAuthenticated, logout, updateProfile, login, googleLogin } = useAuthStore()

  // Cargar favoritos del cliente autenticado; limpiar si no hay sesión
  useEffect(() => {
    if (authUser?.id) {
      try {
        const saved = localStorage.getItem(`storeFavorites_${authUser.id}`)
        setFavorites(saved ? new Set(JSON.parse(saved)) : new Set())
      } catch { setFavorites(new Set()) }
    } else {
      try {
        const saved = localStorage.getItem('storeFavorites_guest')
        setFavorites(saved ? new Set(JSON.parse(saved)) : new Set())
      } catch { setFavorites(new Set()) }
    }
  }, [authUser?.id])

  const [clientOrders, setClientOrders] = useState<any[]>([])
  const [clientOrdersLoading, setClientOrdersLoading] = useState(false)

  // ====== CLIENT LOGIN MODAL ======
  const [showClientLogin, setShowClientLogin] = useState(false)
  const [clientLoginTab, setClientLoginTab] = useState<'login' | 'register'>('login')
  const [clientLoginForm, setClientLoginForm] = useState({ email: '', password: '', name: '', cedula: '' })
  const [clientLoginError, setClientLoginError] = useState('')
  const [clientLoginLoading, setClientLoginLoading] = useState(false)
  const clientGoogleBtnRef = useRef<HTMLDivElement>(null)
  const [clientGoogleBtnWidth, setClientGoogleBtnWidth] = useState(320)
  useEffect(() => {
    if (!showClientLogin) return
    const measure = () => {
      const el = clientGoogleBtnRef.current
      if (!el) return
      const w = Math.floor(el.getBoundingClientRect().width)
      if (w > 0) setClientGoogleBtnWidth(Math.min(w, 400))
    }
    const timer = setTimeout(measure, 50)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showClientLogin])

  const handleClientLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setClientLoginError('')
    setClientLoginLoading(true)
    const result = await login(clientLoginForm.email, clientLoginForm.password)
    setClientLoginLoading(false)
    if (result.success) {
      setShowClientLogin(false)
      setClientLoginForm({ email: '', password: '', name: '', cedula: '' })
    } else {
      setClientLoginError(result.error || 'Credenciales incorrectas')
    }
  }

  const handleClientGoogleLogin = async (response: CredentialResponse) => {
    if (!response.credential) return
    setClientLoginLoading(true)
    setClientLoginError('')
    const result = await googleLogin(response.credential, selectedStore !== 'all' ? selectedStore : undefined)
    setClientLoginLoading(false)
    if (result.success) {
      setShowClientLogin(false)
    } else {
      setClientLoginError(result.error || 'Error al iniciar sesión con Google')
    }
  }

  const handleClientRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setClientLoginError('')
    if (!clientLoginForm.name.trim()) { setClientLoginError('Ingresa tu nombre'); return }
    if (!clientLoginForm.cedula.trim()) { setClientLoginError('Ingresa tu número de documento'); return }
    setClientLoginLoading(true)
    const result = await api.registerClient({
      email: clientLoginForm.email,
      password: clientLoginForm.password,
      name: clientLoginForm.name,
      cedula: clientLoginForm.cedula,
      storeSlug: selectedStore !== 'all' ? selectedStore : '',
    })
    setClientLoginLoading(false)
    if (result.success && result.data) {
      // Manually set auth state by logging in after register
      const loginResult = await login(clientLoginForm.email, clientLoginForm.password)
      if (loginResult.success) {
        setShowClientLogin(false)
        setClientLoginForm({ email: '', password: '', name: '', cedula: '' })
      } else {
        setClientLoginError('Cuenta creada. Por favor inicia sesión.')
        setClientLoginTab('login')
      }
    } else {
      setClientLoginError(result.error || 'Error al registrarse')
    }
  }

  // ====== PROFILE COMPLETION MODAL ======
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [profileForm, setProfileForm] = useState({
    phone: '', cedula: '', department: '', municipality: '', address: '', neighborhood: '',
  })
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileLat, setProfileLat] = useState<number | null>(null)
  const [profileLng, setProfileLng] = useState<number | null>(null)

  // ====== DELIVERY ORDER STATE ======
  const [showDeliveryLoginAlert, setShowDeliveryLoginAlert] = useState(false)
  const [showWhatsappModal, setShowWhatsappModal] = useState(false)
  const [whatsappMessage, setWhatsappMessage] = useState('Hola, me gustaría obtener más información.')
  // Chatbot IA
  const [chatbotStatus, setChatbotStatus] = useState<{ enabled: boolean; botName: string; botAvatarUrl?: string | null; accentColor?: string } | null>(null)
  const [showChatWidget, setShowChatWidget] = useState(false)

  // ====== CHECKOUT STATE ======
  const [formData, setFormData] = useState<PedidoForm>({
    nombre: '', telefono: '', email: '', cedula: '',
    departamento: '', municipio: '', direccion: '', barrio: '', notas: '',
  })
  const [enviandoEmail, setEnviandoEmail] = useState(false)
  const [mostrarModalExito, setMostrarModalExito] = useState(false)
  const [pedidoConfirmado, setPedidoConfirmado] = useState<PedidoConfirmado | null>(null)
  const [mpReturnMsg, setMpReturnMsg] = useState<{ type: 'success' | 'failure' | 'pending'; text: string } | null>(null)
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null)
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null)

  // ====== CART FUNCTIONS ======
  const totalCarrito = carrito.reduce((sum, item) => sum + item.precio * item.cantidad, 0)
  const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0)

  // ====== COUPON STATE ======
  const [cuponCodigo, setCuponCodigo] = useState('')
  const [cuponAplicado, setCuponAplicado] = useState<CuponValidacion | null>(null)

  // ====== ORDER BUMP STATE ======
  const [orderBumpProducts, setOrderBumpProducts] = useState<any[]>([])
  const [orderBumpTitle, setOrderBumpTitle] = useState('¿También te puede interesar?')
  const totalConDescuento = cuponAplicado?.valido && cuponAplicado?.descuento
    ? Math.max(0, totalCarrito - cuponAplicado.descuento)
    : totalCarrito

  const handleValidarCupon = async (codigo: string, subtotal: number): Promise<CuponValidacion> => {
    try {
      const res = await fetch(`${API_URL}/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codigo, subtotal }),
      })
      const json = await res.json()
      if (json.success && json.data) {
        return json.data as CuponValidacion
      }
      return { valido: false, mensaje: 'Error al validar cupón' }
    } catch {
      return { valido: false, mensaje: 'Error de conexión al validar cupón' }
    }
  }

  const handleAplicarCupon = (codigo: string, resultado: CuponValidacion) => {
    setCuponCodigo(codigo)
    setCuponAplicado(resultado)
  }

  const handleRemoverCupon = () => {
    setCuponCodigo('')
    setCuponAplicado(null)
  }

  // ====== AUTO-FILL from authenticated user ======
  useEffect(() => {
    if (isAuthenticated && authUser) {
      setFormData(prev => ({
        ...prev,
        nombre: authUser.name || prev.nombre,
        email: authUser.email || prev.email,
        telefono: authUser.phone || prev.telefono,
        cedula: authUser.cedula || prev.cedula,
        departamento: authUser.department || prev.departamento,
        municipio: authUser.municipality || prev.municipio,
        direccion: authUser.address || prev.direccion,
        barrio: authUser.neighborhood || prev.barrio,
      }))
      // Pre-fill GPS coordinates if stored
      if (authUser.deliveryLatitude && authUser.deliveryLongitude) {
        setDeliveryLat(authUser.deliveryLatitude)
        setDeliveryLng(authUser.deliveryLongitude)
      }
      // Show profile completion modal if profile not completed yet
      if (!authUser.profileCompleted) {
        setShowProfileModal(true)
        setProfileForm({
          phone: authUser.phone || '',
          cedula: authUser.cedula || '',
          department: authUser.department || '',
          municipality: authUser.municipality || '',
          address: authUser.address || '',
          neighborhood: authUser.neighborhood || '',
        })
        setProfileLat(authUser.deliveryLatitude || null)
        setProfileLng(authUser.deliveryLongitude || null)
      }
    }
  }, [isAuthenticated, authUser?.id])

  const handleClientLogout = () => {
    logout()
    setShowMyOrders(false)
    setClientOrders([])
  }

  const fetchClientOrders = async () => {
    const token = api.getToken()
    if (!token) return
    setClientOrdersLoading(true)
    try {
      const res = await fetch(`${API_URL}/client/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (json.success && json.data) {
        setClientOrders(json.data)
      }
    } catch (e) {
      console.error('Error fetching client orders:', e)
    } finally {
      setClientOrdersLoading(false)
    }
  }

  // ====== FETCH ALL OFFERS (cross-store for Ofertas tab) ======
  const fetchAllStoreOffers = async () => {
    setLoadingAllOffers(true)
    try {
      const res = await fetch(`${API_URL}/storefront/offers`)
      const json = await res.json()
      if (json.success && json.data) {
        setAllStoreOffers(json.data)
      }
    } catch (e) {
      console.error('Error fetching all offers:', e)
    } finally {
      setLoadingAllOffers(false)
    }
  }

  // ====== GLOBAL SEARCH (cross-store) ======
  const handleGlobalSearch = async (query: string) => {
    setGlobalSearchQuery(query)
    if (!query.trim()) {
      setGlobalSearchResults([])
      setGlobalSearchStores([])
      return
    }
    const q = query.toLowerCase()

    // Immediate client-side store filter (if already loaded)
    if (stores.length > 0) {
      setGlobalSearchStores(
        stores.filter(s =>
          s.name?.toLowerCase().includes(q) ||
          s.businessType?.toLowerCase().includes(q) ||
          s.slug?.toLowerCase().includes(q)
        )
      )
    }

    setLoadingGlobalSearch(true)
    try {
      const [storesRes, productsRes] = await Promise.all([
        fetch(`${API_URL}/storefront/stores`),
        fetch(`${API_URL}/storefront/products?limit=200&store=all`),
      ])
      const storesJson = await storesRes.json()
      const productsJson = await productsRes.json()

      if (storesJson.success && storesJson.data) {
        setGlobalSearchStores(
          storesJson.data.filter((s: any) =>
            s.name?.toLowerCase().includes(q) ||
            s.businessType?.toLowerCase().includes(q) ||
            s.slug?.toLowerCase().includes(q)
          )
        )
      }
      if (productsJson.success && productsJson.data?.products) {
        setGlobalSearchResults(
          productsJson.data.products.filter((p: StorefrontProduct) =>
            p.name.toLowerCase().includes(q) ||
            p.brand?.toLowerCase().includes(q) ||
            p.category?.toLowerCase().includes(q)
          )
        )
      }
    } catch (e) {
      console.error('Error buscando:', e)
    } finally {
      setLoadingGlobalSearch(false)
    }
  }

  // ====== FETCH ALL PRODUCTS (for stores view and catalog all-stores view) ======
  useEffect(() => {
    if ((!showStoresView && !showCatalog) || selectedStore !== 'all') return
    const load = async () => {
      setLoadingAllProducts(true)
      try {
        const res = await fetch(`${API_URL}/storefront/products?limit=200&store=all`)
        const json = await res.json()
        if (json.success && json.data?.products) {
          setAllProducts(json.data.products)
          // Also populate categories from all products
          const cats = Array.from(new Set(json.data.products.map((p: any) => p.category).filter(Boolean))) as string[]
          setCategories(cats)
        }
      } catch (e) { console.error(e) }
      finally { setLoadingAllProducts(false) }
    }
    load()
  }, [showStoresView, showCatalog, selectedStore, API_URL])

  // ====== FETCH PRODUCTS ======
  useEffect(() => {
    // Don't fetch products when showing stores view
    if (showStoresView && selectedStore === 'all') return

    const fetchProducts = async () => {
      setLoadingProducts(true)
      try {
        const storeParam = selectedStore !== 'all' ? `&store=${selectedStore}` : '&store=all'
        const munParam = clientMunicipality ? `&municipality=${encodeURIComponent(clientMunicipality)}` : ''
        const noLocationParam = !clientMunicipality && locationSkipped ? '&no_location=true' : ''
        const sedeParam = activeSede ? `&sede=${activeSede}` : ''
        const res = await fetch(`${API_URL}/storefront/products?limit=200${storeParam}${munParam}${noLocationParam}${sedeParam}`)
        const json = await res.json()
        if (json.success && json.data?.products) {
          setProducts(json.data.products)
        }
      } catch (e) {
        console.error('Error fetching storefront products:', e)
      } finally {
        setLoadingProducts(false)
      }
    }
    const fetchCategories = async () => {
      try {
        const storeParam = selectedStore !== 'all' ? `?store=${selectedStore}` : ''
        const res = await fetch(`${API_URL}/storefront/categories${storeParam}`)
        const json = await res.json()
        if (json.success && json.data) {
          setCategories(json.data)
        }
      } catch (e) {
        console.error('Error fetching categories:', e)
      }
    }
    const fetchPublicServices = async () => {
      if (!selectedStore || selectedStore === 'all') return
      try {
        const res = await fetch(`${API_URL}/services/public?store=${selectedStore}`)
        const json = await res.json()
        if (json.success && json.data) setPublicServices(json.data)
      } catch {}
    }
    const fetchSedes = async () => {
      if (!selectedStore || selectedStore === 'all') { setStoreSedes([]); setActiveSede(null); return }
      try {
        const res = await fetch(`${API_URL}/storefront/sedes?store=${selectedStore}`)
        const json = await res.json()
        if (json.success && json.data) {
          setStoreSedes(json.data)
          // Don't auto-select a sede; show selector only if 2+
        }
      } catch {}
    }
    fetchProducts()
    fetchCategories()
    fetchPublicServices()
    fetchSedes()
  }, [selectedStore, showStoresView, clientMunicipality, activeSede])

  // ====== FETCH STORES ======
  useEffect(() => {
    let cancelled = false
    const fetchStores = async () => {
      setLoadingStores(true)
      try {
        // Always fetch all active stores (no municipality filter) — products are filtered separately
        const res = await fetch(`${API_URL}/storefront/stores`)
        const json = await res.json()
        if (cancelled) return
        if (json.success && json.data) {
          setStores(json.data)
          // Only auto-select when there's truly a single store on the entire platform
          if (json.data.length === 1) {
            setSelectedStore(json.data[0].slug)
            setShowStoresView(false)
          }
          // Check which stores have published services (non-blocking — runs after stores are shown)
          Promise.allSettled(
            json.data.map((s: { slug: string }) =>
              fetch(`${API_URL}/services/public?store=${s.slug}`)
                .then(r => r.json())
                .then(j => j.success && j.data?.length > 0 ? s.slug : null)
                .catch(() => null)
            )
          ).then(results => {
            if (cancelled) return
            const slugsWithServices = new Set<string>(
              results
                .map(r => r.status === 'fulfilled' ? r.value : null)
                .filter((v): v is string => !!v)
            )
            setStoresWithServices(slugsWithServices)
          })
        }
      } catch (e) {
        console.error('Error fetching stores:', e)
      } finally {
        if (!cancelled) setLoadingStores(false)
      }
    }
    fetchStores()

    // Fetch platform bg color
    const fetchPlatformSettings = async () => {
      try {
        const res = await fetch(`${API_URL}/storefront/platform-settings`)
        const json = await res.json()
        if (cancelled) return
        if (json.success && json.data) {
          if (json.data.bg_color) setPlatformBgColor(json.data.bg_color)
          if (json.data.hero_image_url) setPlatformHeroUrl(json.data.hero_image_url)
          if (json.data.hero_title) setPlatformHeroTitle(json.data.hero_title)
          if (json.data.hero_subtitle) setPlatformHeroSubtitle(json.data.hero_subtitle)
        }
      } catch {}
    }
    fetchPlatformSettings()

    // Fetch platform featured products (superadmin pinned)
    const fetchPlatformFeatured = async () => {
      try {
        const res = await fetch(`${API_URL}/storefront/platform-featured`)
        const json = await res.json()
        if (cancelled) return
        if (json.success && json.data) setPlatformFeatured(json.data)
      } catch {}
    }
    fetchPlatformFeatured()

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ====== FETCH OFFERS ======
  useEffect(() => {
    const fetchOffers = async () => {
      setLoadingOffers(true)
      try {
        const storeParam = selectedStore !== 'all' ? `?store=${selectedStore}` : ''
        const res = await fetch(`${API_URL}/storefront/offers${storeParam}`)
        const json = await res.json()
        if (json.success && json.data) {
          setOfferProducts(json.data)
        }
      } catch (e) {
        console.error('Error fetching offers:', e)
      } finally {
        setLoadingOffers(false)
      }
    }
    fetchOffers()
  }, [selectedStore])

  // ====== FETCH STORE CONFIG (Hero Sections) ======
  useEffect(() => {
    if (selectedStore === 'all') {
      setStoreConfig(null)
      return
    }
    const fetchStoreConfig = async () => {
      try {
        const res = await fetch(`${API_URL}/storefront/store-config/${selectedStore}`)
        const json = await res.json()
        if (json.success && json.data) {
          setStoreConfig(json.data)
        }
      } catch (e) {
        console.error('Error fetching store config:', e)
      }
    }
    const fetchPaymentConfig = async () => {
      try {
        const res = await fetch(`${API_URL}/storefront/payment-config/${selectedStore}`)
        const json = await res.json()
        if (json.success && json.data) {
          setPaymentConfig(json.data)
        }
      } catch (e) {
        console.error('Error fetching payment config:', e)
      }
    }
    const fetchChatbotStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/chatbot/status/${selectedStore}`)
        const json = await res.json()
        if (json.success && json.data?.enabled) {
          setChatbotStatus({ enabled: true, botName: json.data.botName || 'Asistente', botAvatarUrl: json.data.botAvatarUrl, accentColor: json.data.accentColor || '#f59e0b' })
        } else {
          setChatbotStatus(null)
        }
      } catch { setChatbotStatus(null) }
    }
    fetchStoreConfig()
    fetchPaymentConfig()
    fetchChatbotStatus()
  }, [selectedStore])

  // ====== DROP POPUP LOGIC ======
  useEffect(() => {
    if (storeConfig?.activeDrop) {
      const key = `drop_seen_${storeConfig.activeDrop.id}`
      const seen = localStorage.getItem(key)
      if (!seen) {
        setShowDropPopup(true)
        setDropPopupSeen(false)
      } else {
        setDropPopupSeen(true)
      }
    } else {
      setShowDropPopup(false)
    }
  }, [storeConfig?.activeDrop])

  // ====== COUNTDOWN HELPER ======
  const [countdownText, setCountdownText] = useState('')
  useEffect(() => {
    if (!storeConfig?.activeDrop) { setCountdownText(''); return }
    const update = () => {
      const end = new Date(storeConfig.activeDrop!.endsAt).getTime()
      const now = Date.now()
      const diff = end - now
      if (diff <= 0) { setCountdownText('Finalizado'); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdownText(`${d > 0 ? `${d}d ` : ''}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [storeConfig?.activeDrop])

  // ====== INFINITE CAROUSEL (GPU, seamless loop) — mobile & desktop ======
  useEffect(() => {
    if (typeof window === 'undefined') return

    const SPEED = window.innerWidth < 640 ? 38 : 55
    const refs = [
      carouselTrendingRef,
      carouselFeaturedRef,
      carouselOffersRef,
      carouselProductsRef,
      carouselStoresRef,
    ]

    const cleanups: Array<() => void> = []

    // Defer 2 frames: first frame paints, second gives accurate rects
    let outerRaf: number
    const outerSetup = () => {
      outerRaf = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          refs.forEach(ref => {
            const el = ref.current
            if (!el || el.children.length === 0) return

            // Clone originals and append — React children stay untouched
            const origChildren = Array.from(el.children) as HTMLElement[]
            const clones = origChildren.map(child => {
              const clone = child.cloneNode(true) as HTMLElement
              clone.setAttribute('aria-hidden', 'true')
              el.appendChild(clone)
              return clone
            })

            // Precise measurement: distance from container start to first clone
            void el.offsetWidth // flush layout
            const containerLeft = el.getBoundingClientRect().left
            const firstCloneLeft = clones[0].getBoundingClientRect().left
            const oneSetWidth = firstCloneLeft - containerLeft
            const containerWidth = el.getBoundingClientRect().width

            if (oneSetWidth <= 0) {
              clones.forEach(c => c.remove())
              return
            }

            // If all original items fit in the viewport, no scrolling is needed
            if (oneSetWidth <= containerWidth) {
              clones.forEach(c => c.remove())
              return
            }

            // Clones must NOT receive pointer events — they have no React handlers
            clones.forEach(c => { (c as HTMLElement).style.pointerEvents = 'none' })

            // safeZoneEnd: max scroll position where only originals are visible
            const safeZoneEnd = Math.max(0, oneSetWidth - containerWidth)

            // Parent clips the viewport; el must NOT clip so clones are visible
            const parent = el.parentElement
            const prevOverflow = parent?.style.overflow ?? ''
            if (parent) parent.style.overflow = 'hidden'
            el.style.overflow = 'visible'   // let content overflow freely — parent clips
            el.style.willChange = 'transform'

            let pos = 0
            let lastTime: number | null = null
            let paused = false
            let resumeTimer: ReturnType<typeof setTimeout>
            let rafId: number

            const onTouchStart: EventListener = () => { paused = true; clearTimeout(resumeTimer) }
            const onTouchEnd: EventListener = () => { resumeTimer = setTimeout(() => { paused = false }, 2000) }
            const onMouseEnter: EventListener = () => {
              paused = true
              clearTimeout(resumeTimer)
              // Snap out of clone zone so user always interacts with original items
              if (pos > safeZoneEnd) {
                pos = safeZoneEnd
                el.style.transform = `translateX(${-pos}px)`
              }
            }
            const onMouseLeave: EventListener = () => { resumeTimer = setTimeout(() => { paused = false }, 600) }
            el.addEventListener('touchstart', onTouchStart, { passive: true })
            el.addEventListener('touchend', onTouchEnd, { passive: true })
            el.addEventListener('mouseenter', onMouseEnter)
            el.addEventListener('mouseleave', onMouseLeave)

            const tick = (now: number) => {
              const dt = lastTime !== null ? (now - lastTime) / 1000 : 0
              lastTime = now
              if (!paused) {
                pos += SPEED * dt
                if (pos >= oneSetWidth) pos -= oneSetWidth // modular — no visual jump
                el.style.transform = `translateX(${-pos}px)`
              }
              rafId = requestAnimationFrame(tick)
            }
            rafId = requestAnimationFrame(tick)

            cleanups.push(() => {
              cancelAnimationFrame(rafId)
              clearTimeout(resumeTimer)
              el.removeEventListener('touchstart', onTouchStart)
              el.removeEventListener('touchend', onTouchEnd)
              el.removeEventListener('mouseenter', onMouseEnter)
              el.removeEventListener('mouseleave', onMouseLeave)
              clones.forEach(c => c.remove())
              el.style.overflow = ''
              el.style.transform = ''
              el.style.willChange = ''
              if (parent) parent.style.overflow = prevOverflow
            })
          })
        })
      })
    }

    outerSetup()

    return () => {
      cancelAnimationFrame(outerRaf)
      cleanups.forEach(fn => fn())
    }
  }, [storeConfig, offerProducts, products])

  const dismissDropPopup = () => {
    if (storeConfig?.activeDrop) {
      localStorage.setItem(`drop_seen_${storeConfig.activeDrop.id}`, '1')
    }
    setShowDropPopup(false)
    setDropPopupSeen(true)
  }

  // ====== PRODUCT MODAL FUNCTIONS ======
  const openProductModal = (product: StorefrontProduct) => {
    setSelectedProduct(product)
    setProductQuantity(1)
    setActiveImageIdx(0)
    setShowProductModal(true)
    // Seed viewers count uniquely per product and fluctuate over time
    const seed = (product.id * 2654435761) >>> 0
    const base = 4 + (seed % 28)
    setViewersCount(base)
    if (viewersIntervalRef.current) clearInterval(viewersIntervalRef.current)
    viewersIntervalRef.current = setInterval(() => {
      setViewersCount(prev => {
        const delta = Math.random() < 0.5 ? 1 : -1
        return Math.max(2, Math.min(base + 12, prev + delta))
      })
    }, 3500 + Math.random() * 3000)
    setProductReviews([])
    window.history.pushState({}, '', `${window.location.pathname}?product=${product.id}`)
    setReviewSuccess(false)
    setShowReviewForm(false)
    setReviewForm({ reviewerName: '', reviewerEmail: '', rating: 5, title: '', body: '' })
    setReviewError('')
    // Load approved reviews for this product
    const tid = product.tenantId || stores.find(s => s.slug === selectedStore)?.id
    if (tid) {
      setReviewsLoading(true)
      api.getPublicReviews(tid, String(product.id))
        .then(res => { if (res.success && res.data) setProductReviews(res.data as any[]) })
        .finally(() => setReviewsLoading(false))
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const closeProductModal = () => {
    if (viewersIntervalRef.current) { clearInterval(viewersIntervalRef.current); viewersIntervalRef.current = null }
    setShowProductModal(false)
    setSelectedProduct(null)
    setProductQuantity(1)
    window.history.replaceState({}, '', window.location.pathname)
  }

  // Observe CTA visibility for sticky mobile bar
  useEffect(() => {
    if (!showProductModal) return
    let observer: IntersectionObserver
    const timer = setTimeout(() => {
      const el = ctaRef.current
      if (!el) return
      observer = new IntersectionObserver(
        ([entry]) => setCtaVisible(entry.isIntersecting),
        { threshold: 0.1 }
      )
      observer.observe(el)
    }, 100)
    return () => {
      clearTimeout(timer)
      observer?.disconnect()
      setCtaVisible(false)
    }
  }, [showProductModal, selectedProduct])

  // Detect ?product= on load and open modal
  useEffect(() => {
    if (products.length === 0) return
    const params = new URLSearchParams(window.location.search)
    const productId = params.get('product')
    if (!productId) return
    const match = products.find(p => String(p.id) === productId)
    if (match) { setShowCatalog(true); openProductModal(match) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products])

  const addFromModal = () => {
    if (!selectedProduct) return

    // Check if this product is in the active drop
    const dropProduct = showDrop && storeConfig?.activeDrop
      ? storeConfig.activeDrop.products.find(dp => dp.id === selectedProduct.id)
      : null

    let finalPrice = selectedProduct.salePrice
    let precioOriginal: number | undefined
    let descuentoPorcentaje: number | undefined

    if (dropProduct) {
      finalPrice = dropProduct.finalPrice
      precioOriginal = selectedProduct.salePrice
      descuentoPorcentaje = dropProduct.customDiscount ?? storeConfig!.activeDrop!.globalDiscount
    } else if (selectedProduct.isOnOffer && selectedProduct.offerPrice) {
      finalPrice = selectedProduct.offerPrice
      precioOriginal = selectedProduct.salePrice
    }

    setCarrito(prev => {
      const tempId = String(selectedProduct.id)
      const existingIndex = prev.findIndex(p => (p.tempId || String(p.id)) === tempId)
      if (existingIndex >= 0) {
        const newCart = [...prev]
        newCart[existingIndex] = {
          ...newCart[existingIndex],
          cantidad: newCart[existingIndex].cantidad + productQuantity
        }
        return newCart
      }
      return [...prev, {
        id: selectedProduct.id,
        tempId,
        nombre: selectedProduct.name,
        precio: finalPrice,
        precioOriginal,
        descuentoPorcentaje,
        cantidad: productQuantity,
        imagen: selectedProduct.imageUrl || '',
        tenantId: selectedProduct.tenantId,
        storeName: selectedProduct.storeName,
        availableForDelivery: !!selectedProduct.availableForDelivery,
        deliveryType: selectedProduct.deliveryType || null,
      }]
    })
    setShowCart(true)
    closeProductModal()
  }



  const agregarAlCarrito = (product: StorefrontProduct, options?: { size?: string, perfume?: string, isDecant?: boolean, dropPrice?: number, dropDiscount?: number }) => {
    // Intercept Decant products
    if (!options?.isDecant && (product.category === 'DECANTS' || product.category === 'decants')) {
      setDecantProduct(product)

      // Auto-detect size from product details
      let detectedSize: '5ml' | '10ml' | null = null
      const lowerName = product.name.toLowerCase()
      const lowerSize = product.size?.toLowerCase() || ''

      if (lowerSize.includes('5ml') || lowerSize.includes('5 ml') || lowerName.includes('5ml') || lowerName.includes('5 ml')) {
        detectedSize = '5ml'
      } else if (lowerSize.includes('10ml') || lowerSize.includes('10 ml') || lowerName.includes('10ml') || lowerName.includes('10 ml')) {
        detectedSize = '10ml'
      }

      if (detectedSize) {
        setDecantSize(detectedSize)
      } else {
        setDecantSize('5ml') // Default
      }

      setShowDecantModal(true)
      return
    }

    setCarrito(prev => {
      // Generate unique tempId for cart item
      // For standard products, use ID string. For Decants, composite key.
      const newItemTempId = options?.isDecant
        ? `${product.id}-${options.size}-${options.perfume}`
        : String(product.id)

      const existingIndex = prev.findIndex(p => (p.tempId || String(p.id)) === newItemTempId)

      if (existingIndex >= 0) {
        const newCart = [...prev]
        newCart[existingIndex] = {
          ...newCart[existingIndex],
          cantidad: newCart[existingIndex].cantidad + 1
        }
        return newCart
      }

      // Priority: dropPrice > offerPrice > salePrice
      let finalPrice = product.salePrice
      let precioOriginal: number | undefined
      let descuentoPorcentaje: number | undefined

      if (options?.dropPrice != null) {
        finalPrice = options.dropPrice
        precioOriginal = product.salePrice
        descuentoPorcentaje = options.dropDiscount
      } else if (product.isOnOffer && product.offerPrice) {
        finalPrice = product.offerPrice
        precioOriginal = product.salePrice
      }

      return [...prev, {
        id: product.id,
        tempId: newItemTempId,
        nombre: options?.isDecant ? `${product.name} (${options.size})` : product.name,
        precio: finalPrice,
        precioOriginal,
        descuentoPorcentaje,
        cantidad: 1,
        imagen: product.imageUrl || '',
        tallaSeleccionada: options?.size,
        perfumeSeleccionado: options?.perfume,
        tenantId: product.tenantId,
        storeName: product.storeName,
        availableForDelivery: !!product.availableForDelivery,
        deliveryType: (product as any).deliveryType || null,
      }]
    })
    setShowCart(true) // Always show cart after adding
  }

  const actualizarCantidad = (id: number, cambio: number, tempId?: string) => {
    setCarrito(prev =>
      prev.map(p => {
        // Match by tempId if available (preferred), otherwise fallback to id
        const match = tempId ? (p.tempId === tempId) : (p.id === id)
        if (match) {
          const nueva = p.cantidad + cambio
          return nueva > 0 ? { ...p, cantidad: nueva } : p
        }
        return p
      }).filter(p => p.cantidad > 0)
    )
  }

  const removerProducto = (producto: ProductoCarrito) => {
    setCarrito(prev => prev.filter(p => {
      if (producto.tempId) return p.tempId !== producto.tempId
      return p.id !== producto.id
    }))
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => {
      if (name === 'departamento') {
        return { ...prev, departamento: value, municipio: '' }
      }
      return { ...prev, [name]: value }
    })
  }

  const handleConfirmarPedido = async () => {
    if (!formData.nombre || !formData.telefono || !formData.email || !formData.cedula || !formData.departamento || !formData.municipio || !formData.direccion) {
      alert('Por favor completa todos los campos obligatorios')
      return
    }
    if (carrito.length === 0) {
      alert('El carrito está vacío')
      return
    }

    setEnviandoEmail(true)
    try {
      // Group cart items by tenant for separate orders
      const itemsByTenant = new Map<string, ProductoCarrito[]>()
      for (const item of carrito) {
        const tid = item.tenantId || '__default__'
        if (!itemsByTenant.has(tid)) itemsByTenant.set(tid, [])
        itemsByTenant.get(tid)!.push(item)
      }

      const orderNumbers: string[] = []

      for (const [tid, tenantItems] of itemsByTenant) {
        const orderPayload: Record<string, any> = {
          customerName: formData.nombre,
          customerPhone: formData.telefono,
          customerEmail: formData.email,
          customerCedula: formData.cedula,
          department: formData.departamento,
          municipality: formData.municipio,
          address: formData.direccion,
          neighborhood: formData.barrio,
          notes: formData.notas,
          items: tenantItems.map(p => ({
            productId: String(p.id),
            productName: p.nombre,
            quantity: p.cantidad,
            unitPrice: p.precio,
            originalPrice: p.precioOriginal || p.precio,
            discountPercent: p.descuentoPorcentaje || 0,
            productImage: p.imagen || undefined,
          })),
        }

        // Set tenant ID so the backend routes the order correctly
        if (tid !== '__default__') {
          orderPayload.tenantId = tid
        }

        // Include delivery location if set
        if (deliveryLat !== null && deliveryLng !== null) {
          orderPayload.deliveryLatitude = deliveryLat
          orderPayload.deliveryLongitude = deliveryLng
        }
        // Include client user ID if logged in
        if (isAuthenticated && authUser?.id) {
          orderPayload.clientUserId = authUser.id
        }

        // Apply coupon only to the first order to avoid double-discount
        if (orderNumbers.length === 0 && cuponAplicado?.valido && cuponAplicado?.descuento) {
          orderPayload.discount = cuponAplicado.descuento
          orderPayload.couponCode = cuponCodigo
        }

        try {
          const orderRes = await fetch(`${API_URL}/orders/public`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderPayload),
          })
          const orderJson = await orderRes.json()
          if (orderJson.success && orderJson.data?.orderNumber) {
            orderNumbers.push(orderJson.data.orderNumber)
          }
        } catch (e) {
          console.error('Error saving order to backend:', e)
        }
      }

      // Register coupon usage (once)
      if (cuponCodigo && cuponAplicado?.valido) {
        try {
          await fetch(`${API_URL}/coupons/use`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: cuponCodigo }),
          })
        } catch (e2) {
          console.error('Error registering coupon use:', e2)
        }
      }

      const numeroPedido = orderNumbers.length > 0
        ? orderNumbers.join(', ')
        : `PM-${Date.now().toString(36).toUpperCase()}`

      const fecha = new Date().toLocaleDateString('es-CO', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
      })

      const pedido: PedidoConfirmado = {
        numeroPedido,
        email: formData.email,
        productos: carrito,
        total: totalConDescuento,
        fecha,
      }

      setPedidoConfirmado(pedido)
      setMostrarModalExito(true)
    } catch (error) {
      console.error('Error al procesar pedido:', error)
      alert('Error al procesar el pedido. Intenta de nuevo.')
    } finally {
      setEnviandoEmail(false)
    }
  }

  const handlePagarEnLinea = async () => {
    if (carrito.length === 0) return
    // Group by tenant (for now use the first tenant's items — MP preference per tenant)
    const firstTenantId = carrito.find(i => i.tenantId)?.tenantId || undefined
    const payload: Record<string, any> = {
      customerName: formData.nombre,
      customerPhone: formData.telefono,
      customerEmail: formData.email,
      customerCedula: formData.cedula,
      department: formData.departamento,
      municipality: formData.municipio,
      address: formData.direccion,
      neighborhood: formData.barrio,
      notes: formData.notas,
      items: carrito.map(p => ({
        productId: String(p.id),
        productName: p.nombre,
        quantity: p.cantidad,
        unitPrice: p.precio,
        originalUnitPrice: p.precioOriginal || p.precio,
        productImage: p.imagen || undefined,
      })),
    }
    if (firstTenantId) payload.tenantId = firstTenantId
    if (cuponAplicado?.valido && cuponAplicado?.descuento) {
      payload.discount = cuponAplicado.descuento
      payload.couponCode = cuponCodigo
    }

    const res = await fetch(`${API_URL}/orders/mp-preference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || 'Error al crear preferencia')
    // Redirect to Checkout Pro
    const url = json.data.initPoint || json.data.sandboxInitPoint
    if (url) window.location.href = url
    else throw new Error('No se recibió URL de pago')
  }

  const handlePagarConAddi = async () => {
    if (carrito.length === 0) return
    const firstTenantId = carrito.find(i => i.tenantId)?.tenantId || undefined
    const payload: Record<string, any> = {
      customerName: formData.nombre,
      customerPhone: formData.telefono,
      customerEmail: formData.email,
      customerCedula: formData.cedula,
      department: formData.departamento,
      municipality: formData.municipio,
      address: formData.direccion,
      neighborhood: formData.barrio,
      notes: formData.notas,
      items: carrito.map(p => ({
        productId: String(p.id),
        productName: p.nombre,
        quantity: p.cantidad,
        unitPrice: p.precio,
        originalUnitPrice: p.precioOriginal || p.precio,
        productImage: p.imagen || undefined,
      })),
    }
    if (firstTenantId) payload.tenantId = firstTenantId
    if (cuponAplicado?.valido && cuponAplicado?.descuento) {
      payload.discount = cuponAplicado.descuento
      payload.couponCode = cuponCodigo
    }

    const res = await fetch(`${API_URL}/orders/addi-application`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || 'Error al crear aplicación ADDI')
    const url = json.data.applicationUrl
    if (url) window.location.href = url
    else throw new Error('No se recibió URL de ADDI')
  }

  const handlePagarConSistecredito = async () => {
    if (carrito.length === 0) return
    const firstTenantId = carrito.find(i => i.tenantId)?.tenantId || undefined
    const payload: Record<string, any> = {
      customerName: formData.nombre,
      customerPhone: formData.telefono,
      customerEmail: formData.email,
      customerCedula: formData.cedula,
      department: formData.departamento,
      municipality: formData.municipio,
      address: formData.direccion,
      neighborhood: formData.barrio,
      notes: formData.notas,
      items: carrito.map(p => ({
        productId: String(p.id),
        productName: p.nombre,
        quantity: p.cantidad,
        unitPrice: p.precio,
        originalUnitPrice: p.precioOriginal || p.precio,
        productImage: p.imagen || undefined,
      })),
    }
    if (firstTenantId) payload.tenantId = firstTenantId
    if (cuponAplicado?.valido && cuponAplicado?.descuento) {
      payload.discount = cuponAplicado.descuento
      payload.couponCode = cuponCodigo
    }

    const res = await fetch(`${API_URL}/orders/sistecredito-application`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!json.success) {
      if (json.rejected) throw new Error('Tu solicitud de crédito fue rechazada por Sistecredito. Puedes intentar con otro método de pago.')
      throw new Error(json.error || 'Error al crear solicitud Sistecredito')
    }
    // Approved inline (no redirect needed)
    if (json.data?.approved) return
    const url = json.data?.applicationUrl
    if (url) window.location.href = url
    else throw new Error('No se recibió URL de Sistecredito')
  }

  const handleCerrarModal = () => {
    setMostrarModalExito(false)
    setPedidoConfirmado(null)
    setCarrito([])
    setShowCheckout(false)
    setCuponCodigo('')
    setCuponAplicado(null)
    setFormData({
      nombre: '', telefono: '', email: '', cedula: '',
      departamento: '', municipio: '', direccion: '', barrio: '', notas: '',
    })
  }

  // ====== DELIVERY DETECTION ======
  // domicilio/ambos = pedido de entrega local (requiere GPS y autenticación)
  // envio/null = compra regular (requiere depto/municipio)
  const carritoTieneDelivery = carrito.some(
    item => item.deliveryType === 'domicilio' || item.deliveryType === 'ambos'
  )

  const fetchOrderBump = async () => {
    if (!selectedStore || selectedStore === 'all') return
    try {
      const cartCategories = [...new Set(carrito.map(item => (item as any).category).filter(Boolean))]
      const excludeIds = carrito.map(item => String(item.id))
      const res = await api.getPublicOrderBump(selectedStore, cartCategories, excludeIds)
      if (res?.success && res.data) {
        setOrderBumpProducts(res.data.products || [])
        setOrderBumpTitle(res.data.title || '¿También te puede interesar?')
      }
    } catch (e) {
      // silently ignore — order bump is optional
    }
  }

  const handleAddBumpProduct = (product: any) => {
    setCarrito(prev => {
      const tempId = String(product.id)
      const existing = prev.findIndex(p => (p.tempId || String(p.id)) === tempId)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = { ...updated[existing], cantidad: updated[existing].cantidad + 1 }
        return updated
      }
      const price = product.isOnOffer && product.offerPrice ? product.offerPrice : product.salePrice
      return [...prev, {
        id: product.id,
        tempId,
        nombre: product.name,
        precio: price,
        precioOriginal: product.isOnOffer && product.offerPrice ? product.salePrice : undefined,
        cantidad: 1,
        imagen: product.imageUrl || '',
        tenantId: product.tenantId,
        storeName: product.storeName,
        availableForDelivery: !!product.availableForDelivery,
        deliveryType: (product as any).deliveryType || null,
      }]
    })
  }

  const handleIrAlCheckout = () => {
    if (carritoTieneDelivery && !isAuthenticated) {
      setShowDeliveryLoginAlert(true)
      return
    }
    fetchOrderBump()
    setShowCheckout(true)
  }

  // ====== SAVE DELIVERY PROFILE ======
  const handleSaveProfile = async () => {
    if (!profileForm.department || !profileForm.municipality || !profileForm.address) return
    setSavingProfile(true)
    try {
      await updateProfile({
        phone: profileForm.phone || undefined,
        cedula: profileForm.cedula || undefined,
        department: profileForm.department,
        municipality: profileForm.municipality,
        address: profileForm.address,
        neighborhood: profileForm.neighborhood || undefined,
        deliveryLatitude: profileLat ?? undefined,
        deliveryLongitude: profileLng ?? undefined,
      })
      // Also pre-fill checkout form
      setFormData(prev => ({
        ...prev,
        telefono: profileForm.phone || prev.telefono,
        cedula: profileForm.cedula || prev.cedula,
        departamento: profileForm.department || prev.departamento,
        municipio: profileForm.municipality || prev.municipio,
        direccion: profileForm.address || prev.direccion,
        barrio: profileForm.neighborhood || prev.barrio,
      }))
      if (profileLat && profileLng) {
        setDeliveryLat(profileLat)
        setDeliveryLng(profileLng)
      }
      setShowProfileModal(false)
    } catch (e) {
      console.error('Error saving profile:', e)
    } finally {
      setSavingProfile(false)
    }
  }

  // ====== FILTERED PRODUCTS ======
  const filteredProducts = products.filter(p => {
    const matchCategory = selectedCategory === 'all' || p.category === selectedCategory
    const matchSearch = !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.brand && p.brand.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchCategory && matchSearch
  })

  // ====== CATALOG DERIVED VALUES ======
  const availableSizes = Array.from(new Set(products.filter(p => p.size).map(p => p.size!))).sort()
  const availableBrands = Array.from(new Set(products.filter(p => p.brand).map(p => p.brand!))).sort()
  const availableGenders = Array.from(new Set(products.filter(p => p.gender).map(p => p.gender!))).sort()

  const catalogFilteredProducts = products.filter(p => {
    // Special section filters
    if (catalogSpecialFilter === 'trending') {
      const ids = new Set(storeConfig?.trendingProducts.map(t => String(t.id)) ?? [])
      if (!ids.has(String(p.id))) return false
    } else if (catalogSpecialFilter === 'featured') {
      const ids = new Set(storeConfig?.featuredProducts.map(f => String(f.id)) ?? [])
      if (!ids.has(String(p.id))) return false
    } else if (catalogSpecialFilter === 'offers') {
      if (!p.isOnOffer || !p.offerPrice) return false
    }
    const q = searchQuery.toLowerCase()
    const matchSearch = !searchQuery ||
      p.name.toLowerCase().includes(q) ||
      (p.brand && p.brand.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q))
    const finalPrice = (p.isOnOffer && p.offerPrice) ? p.offerPrice : p.salePrice
    const matchPrice = (catalogPriceMin === 0 && catalogPriceMax === 0) ||
      (finalPrice >= catalogPriceMin && (catalogPriceMax === 0 || finalPrice <= catalogPriceMax))
    const matchSize = catalogSelectedSizes.size === 0 || (p.size != null && catalogSelectedSizes.has(p.size))
    const matchCategory = catalogSelectedCategories.size === 0 || catalogSelectedCategories.has(p.category)
    const matchBrand = catalogSelectedBrands.size === 0 || (p.brand != null && catalogSelectedBrands.has(p.brand))
    const matchGender = catalogSelectedGenders.size === 0 || (p.gender != null && catalogSelectedGenders.has(p.gender))
    return matchSearch && matchPrice && matchSize && matchCategory && matchBrand && matchGender
  })

  const clearCatalogFilters = () => {
    setCatalogPriceMin(0)
    setCatalogPriceMax(0)
    setCatalogSelectedSizes(new Set())
    setCatalogSelectedCategories(new Set())
    setCatalogSelectedBrands(new Set())
    setCatalogSelectedGenders(new Set())
    setSearchQuery('')
    setCatalogSpecialFilter('all')
  }

  const openCatalogWithFilter = (filter: 'all' | 'trending' | 'featured' | 'offers') => {
    setCatalogSpecialFilter(filter)
    setCatalogPriceMin(0); setCatalogPriceMax(0)
    setCatalogSelectedSizes(new Set()); setCatalogSelectedCategories(new Set())
    setCatalogSelectedBrands(new Set()); setCatalogSelectedGenders(new Set())
    setSearchQuery('')
    setShowCatalog(true); setShowDrop(false); setShowServices(false); setShowNewLaunches(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const scrollToDiscover = () => {
    document.getElementById('presentacion')?.scrollIntoView({ behavior: 'smooth' })
  }



  const scrollToOffers = () => {
    document.getElementById('ofertas')?.scrollIntoView({ behavior: 'smooth' })
  }

  const scrollToNewLaunches = () => {
    document.getElementById('nuevos-lanzamientos')?.scrollIntoView({ behavior: 'smooth' })
  }

  const scrollToPerfumes = () => {
    document.getElementById('perfumes')?.scrollIntoView({ behavior: 'smooth' })
  }

  // Effective background color: store-specific overrides platform global
  const effectiveBgColor = (storeConfig?.bgColor && storeConfig.bgColor !== '#000000') ? storeConfig.bgColor : platformBgColor
  // Card style chosen by the merchant
  const productCardStyle = storeConfig?.storeInfo?.productCardStyle || 'style1'

  // Compute a slightly lighter/darker variant for alternate sections
  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return { r, g, b }
  }
  const rgb = hexToRgb(effectiveBgColor)
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  const isLightBg = luminance > 0.5
  // For light backgrounds: text should be dark; for dark: text stays white
  const textClass = isLightBg ? 'text-black' : 'text-white'
  // Alt bg: slightly shifted for visual contrast
  const altOffset = isLightBg ? -12 : 8
  const altR = clamp(rgb.r + altOffset, 0, 255)
  const altG = clamp(rgb.g + altOffset, 0, 255)
  const altB = clamp(rgb.b + altOffset, 0, 255)
  const altBgColor = `#${altR.toString(16).padStart(2, '0')}${altG.toString(16).padStart(2, '0')}${altB.toString(16).padStart(2, '0')}`

  // ====== IF CHECKOUT VIEW IS ACTIVE ======
  if (showCheckout) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Minimal checkout header — store logo + back link */}
        <header className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
            {storeConfig?.storeInfo?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={storeConfig.storeInfo.logoUrl}
                alt={storeConfig.storeInfo.name || 'Tienda'}
                className="h-12 w-auto object-contain"
              />
            ) : (
              <span className="text-base font-medium tracking-[0.2em] uppercase text-gray-900">
                {storeConfig?.storeInfo?.name || 'Tienda'}
              </span>
            )}
            <button
              onClick={() => setShowCheckout(false)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors tracking-wide uppercase"
            >
              <ChevronLeft className="w-4 h-4" />
              Volver a la tienda
            </button>
          </div>
        </header>
        <CheckoutView
          carrito={carrito}
          totalCarrito={totalCarrito}
          formData={formData}
          enviandoEmail={enviandoEmail}
          mostrarModalExito={mostrarModalExito}
          pedidoConfirmado={pedidoConfirmado}
          cuponCodigo={cuponCodigo}
          cuponAplicado={cuponAplicado}
          totalConDescuento={totalConDescuento}
          deliveryLatitude={deliveryLat}
          deliveryLongitude={deliveryLng}
          isDeliveryOrder={carritoTieneDelivery}
          onLocationChange={(lat, lng) => { setDeliveryLat(lat); setDeliveryLng(lng) }}
          onValidarCupon={handleValidarCupon}
          onAplicarCupon={handleAplicarCupon}
          onRemoverCupon={handleRemoverCupon}
          onInputChange={handleInputChange}
          onActualizarCantidad={actualizarCantidad}
          onRemoverProducto={removerProducto}
          onConfirmar={handleConfirmarPedido}
          onCerrarModal={handleCerrarModal}
          onVolver={() => setShowCheckout(false)}
          orderBumpProducts={orderBumpProducts}
          orderBumpTitle={orderBumpTitle}
          onAddBumpProduct={handleAddBumpProduct}
          onPagarEnLinea={paymentConfig.mercadopago ? handlePagarEnLinea : undefined}
          onPagarConAddi={paymentConfig.addi ? handlePagarConAddi : undefined}
          onPagarConSistecredito={paymentConfig.sistecredito ? handlePagarConSistecredito : undefined}
          allowContraentrega={paymentConfig.contraentrega}
        />
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${textClass} overflow-x-hidden pb-16 md:pb-0`} style={{ scrollBehavior: 'smooth', backgroundColor: effectiveBgColor }}>
      {/* Dynamic background overrides */}
      <style>{`
        .landing-nav { background-color: ${effectiveBgColor}cc !important; }
        .landing-section-bg { background-color: ${effectiveBgColor} !important; }
        .landing-section-alt { background-color: ${altBgColor} !important; }
        .landing-sidebar { background-color: ${effectiveBgColor} !important; }
        .landing-sidebar-blur { background-color: ${effectiveBgColor}f2 !important; }
        .landing-card { background-color: ${altBgColor} !important; }
        .landing-footer { background-color: ${effectiveBgColor} !important; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        html { scrollbar-width: none; }
        html::-webkit-scrollbar { display: none; }
        ${isLightBg ? `
        /* ── Text colors ── */
        .text-white { color: #111 !important; }
        .text-white\\/90 { color: rgba(0,0,0,0.9) !important; }
        .text-white\\/80 { color: rgba(0,0,0,0.8) !important; }
        .text-white\\/70 { color: rgba(0,0,0,0.7) !important; }
        .text-white\\/60 { color: rgba(0,0,0,0.6) !important; }
        .text-white\\/50 { color: rgba(0,0,0,0.5) !important; }
        .text-white\\/40 { color: rgba(0,0,0,0.4) !important; }
        .text-white\\/30 { color: rgba(0,0,0,0.3) !important; }
        .text-white\\/20 { color: rgba(0,0,0,0.2) !important; }
        .text-white\\/10 { color: rgba(0,0,0,0.1) !important; }
        .hover\\:text-white:hover { color: #111 !important; }
        /* ── Backgrounds ── */
        .bg-white\\/5  { background-color: rgba(0,0,0,0.04) !important; }
        .bg-white\\/10 { background-color: rgba(0,0,0,0.07) !important; }
        .bg-white\\/20 { background-color: rgba(0,0,0,0.12) !important; }
        .hover\\:bg-white\\/5:hover  { background-color: rgba(0,0,0,0.04) !important; }
        .hover\\:bg-white\\/10:hover { background-color: rgba(0,0,0,0.07) !important; }
        /* ── Borders ── */
        .border-white\\/5  { border-color: rgba(0,0,0,0.05) !important; }
        .border-white\\/10 { border-color: rgba(0,0,0,0.10) !important; }
        .border-white\\/20 { border-color: rgba(0,0,0,0.20) !important; }
        .border-white\\/30 { border-color: rgba(0,0,0,0.30) !important; }
        .border-white\\/40 { border-color: rgba(0,0,0,0.40) !important; }
        .hover\\:border-white:hover { border-color: rgba(0,0,0,0.5) !important; }
        /* ── Placeholders ── */
        .placeholder-white\\/20::placeholder { color: rgba(0,0,0,0.25) !important; }
        .placeholder-white\\/30::placeholder { color: rgba(0,0,0,0.35) !important; }
        /* ── Nav accent colors → negro en fondo claro ── */
        nav .text-amber-400 { color: #111 !important; }
        nav .text-orange-400 { color: #111 !important; }
        nav .text-red-400 { color: rgba(0,0,0,0.75) !important; }
        nav .hover\\:text-amber-400:hover { color: #111 !important; }
        nav .hover\\:text-orange-300:hover { color: rgba(0,0,0,0.8) !important; }
        nav .hover\\:text-red-300:hover { color: rgba(0,0,0,0.8) !important; }
        /* ── data-dark exemptions: preserve white on dark surfaces (category tiles, hero images) ── */
        [data-dark] .text-white,        [data-dark].text-white        { color: #fff !important; }
        [data-dark] .text-white\\/90,   [data-dark].text-white\\/90   { color: rgba(255,255,255,0.9) !important; }
        [data-dark] .text-white\\/80,   [data-dark].text-white\\/80   { color: rgba(255,255,255,0.8) !important; }
        [data-dark] .text-white\\/70,   [data-dark].text-white\\/70   { color: rgba(255,255,255,0.7) !important; }
        [data-dark] .text-white\\/60,   [data-dark].text-white\\/60   { color: rgba(255,255,255,0.6) !important; }
        [data-dark] .text-white\\/50,   [data-dark].text-white\\/50   { color: rgba(255,255,255,0.5) !important; }
        [data-dark] .text-white\\/40,   [data-dark].text-white\\/40   { color: rgba(255,255,255,0.4) !important; }
        [data-dark] .text-white\\/30,   [data-dark].text-white\\/30   { color: rgba(255,255,255,0.3) !important; }
        [data-dark] .border-white\\/10, [data-dark].border-white\\/10 { border-color: rgba(255,255,255,0.1) !important; }
        [data-dark] .border-white\\/20, [data-dark].border-white\\/20 { border-color: rgba(255,255,255,0.2) !important; }
        [data-dark] .bg-white\\/5,      [data-dark].bg-white\\/5      { background-color: rgba(255,255,255,0.05) !important; }
        [data-dark] .bg-white\\/10,     [data-dark].bg-white\\/10     { background-color: rgba(255,255,255,0.10) !important; }
        [data-dark] .hover\\:text-white:hover { color: #fff !important; }
        ` : ''}
      `}</style>
      {/* ========== ANNOUNCEMENT BAR ========== */}
      {storeConfig?.announcementBar?.isActive && (
        <div
          className="fixed top-0 left-0 right-0 z-[55] h-10 flex items-center overflow-hidden text-sm font-medium"
          style={{ backgroundColor: storeConfig.announcementBar.bgColor, color: storeConfig.announcementBar.textColor }}
        >
          {/* Social icons — left side, padding generoso */}
          {storeConfig.storeInfo && (storeConfig.storeInfo.socialInstagram || storeConfig.storeInfo.socialFacebook || storeConfig.storeInfo.socialWhatsapp || storeConfig.storeInfo.socialTiktok) && (
            <div className="shrink-0 flex items-center gap-4 px-5">
              {storeConfig.storeInfo.socialInstagram && (
                <a href={storeConfig.storeInfo.socialInstagram} target="_blank" rel="noopener noreferrer" className="hover:opacity-60 transition-opacity">
                  <Instagram className="w-4 h-4" />
                </a>
              )}
              {storeConfig.storeInfo.socialFacebook && (
                <a href={storeConfig.storeInfo.socialFacebook} target="_blank" rel="noopener noreferrer" className="hover:opacity-60 transition-opacity">
                  <Facebook className="w-4 h-4" />
                </a>
              )}
              {storeConfig.storeInfo.socialTiktok && (
                <a href={storeConfig.storeInfo.socialTiktok} target="_blank" rel="noopener noreferrer" className="hover:opacity-60 transition-opacity">
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z"/>
                  </svg>
                </a>
              )}
              {storeConfig.storeInfo.socialWhatsapp && (
                <a href={`https://wa.me/${storeConfig.storeInfo.socialWhatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="hover:opacity-60 transition-opacity">
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </a>
              )}
            </div>
          )}
          {/* Marquee text — ocupa el resto */}
          <div className="flex-1 overflow-hidden">
            <div className="flex whitespace-nowrap" style={{ animation: `marquee ${isMobile ? '20s' : '60s'} linear infinite` }}>
              {[...Array(20)].map((_, i) => (
                <span key={i} className="inline-flex items-center mx-12 shrink-0">
                  {storeConfig.announcementBar!.linkUrl ? (
                    <a href={storeConfig.announcementBar!.linkUrl} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
                      {storeConfig.announcementBar!.text}
                    </a>
                  ) : (
                    <span>{storeConfig.announcementBar!.text}</span>
                  )}
                </span>
              ))}
            </div>
          </div>
          <style>{`@keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
        </div>
      )}

      {/* ========== MP RETURN BANNER ========== */}
      {mpReturnMsg && (
        <div className={`fixed top-0 left-0 right-0 z-[70] flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium shadow-lg ${
          mpReturnMsg.type === 'success' ? 'bg-green-600 text-white' :
          mpReturnMsg.type === 'failure' ? 'bg-red-600 text-white' :
          'bg-amber-500 text-black'
        }`}>
          <span>{mpReturnMsg.text}</span>
          <button onClick={() => setMpReturnMsg(null)} className="shrink-0 opacity-70 hover:opacity-100 transition-opacity text-lg leading-none">✕</button>
        </div>
      )}

      {/* ========== NAVBAR ========== */}
      <nav className={`fixed left-0 right-0 z-50 backdrop-blur-xl landing-nav border-b border-white/10 transition-all duration-500 ${storeConfig?.announcementBar?.isActive ? 'top-10' : 'top-0'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-2 text-white/70 hover:text-white transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            {storeConfig?.storeInfo?.logoUrl ? (
              <>
                {/* Desktop: logo on the left */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={storeConfig.storeInfo.logoUrl}
                  alt={storeConfig.storeInfo.name || 'Logo'}
                  className="hidden md:block h-14 w-auto object-contain"
                />
              </>
            ) : (
              <span className="text-xl font-light tracking-[0.3em] text-white uppercase">{storeConfig?.storeInfo?.name || 'DAIMUZ'}</span>
            )}
          </div>
          {/* Mobile: logo centered */}
          {storeConfig?.storeInfo?.logoUrl && (
            <div className="absolute left-1/2 -translate-x-1/2 md:hidden pointer-events-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={storeConfig.storeInfo.logoUrl}
                alt={storeConfig.storeInfo.name || 'Logo'}
                className="h-12 w-auto object-contain"
              />
            </div>
          )}
          <div className="hidden md:flex items-center gap-8 text-sm tracking-wide font-bold">
            <button onClick={() => { closeProductModal(); setShowCatalog(false); setShowDrop(false); setShowServices(false); setShowNewLaunches(false); setShowOffers(false); setSedesViewMode(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className={`${!showCatalog && !showDrop && !showServices && !showNewLaunches && !showOffers && !showProductModal ? 'text-white' : 'text-white/50'} hover:text-white transition-colors uppercase text-xs tracking-[0.2em]`}>Inicio</button>
            {offerProducts.length > 0 && <button onClick={() => { closeProductModal(); setShowOffers(true); setShowCatalog(false); setShowDrop(false); setShowServices(false); setShowNewLaunches(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className={`${showOffers ? 'text-white' : 'text-white/50'} hover:text-white transition-colors uppercase text-xs tracking-[0.2em]`}>Ofertas</button>}
            {storeConfig?.newLaunches && storeConfig.newLaunches.length > 0 && (
              <button onClick={() => { closeProductModal(); setShowNewLaunches(true); setShowCatalog(false); setShowDrop(false); setShowServices(false); setShowOffers(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className={`${showNewLaunches ? 'text-white' : 'text-white/50'} hover:text-white transition-colors uppercase text-xs tracking-[0.2em]`}>
                Nuevos Lanzamientos
              </button>
            )}

            {/* ── Categories mega-dropdown ── */}
            {categories.length > 0 && (
              <div className="relative group">
                <button className={`flex items-center gap-1 ${showCatalog && catalogSelectedCategories.size > 0 ? 'text-white' : 'text-white/50'} group-hover:text-white transition-colors uppercase text-xs tracking-[0.2em]`}>
                  {stores.find(s => s.slug === selectedStore)?.businessType || 'Categorías'}
                  <ChevronDown className="w-3 h-3 transition-transform duration-200 group-hover:rotate-180" />
                </button>
                {/* Vertical dropdown below the button */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2
                                opacity-0 invisible pointer-events-none
                                group-hover:opacity-100 group-hover:visible group-hover:pointer-events-auto
                                transition-all duration-150 z-40">
                  <div className="bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 min-w-[160px]">
                    <button
                      onClick={() => {
                        closeProductModal(); setCatalogSpecialFilter('all'); setSedesViewMode(false)
                        setCatalogSelectedCategories(new Set()); setShowCatalog(true)
                        setShowDrop(false); setShowServices(false); setShowNewLaunches(false); setShowOffers(false)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                      className="w-full text-left px-4 py-2 text-[11px] text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-colors uppercase tracking-widest border-b border-gray-100 mb-1"
                    >
                      Todas
                    </button>
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => {
                          closeProductModal(); setCatalogSpecialFilter('all'); setSedesViewMode(false)
                          setCatalogSelectedCategories(new Set([cat])); setShowCatalog(true)
                          setShowDrop(false); setShowServices(false); setShowNewLaunches(false); setShowOffers(false)
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        className={`w-full text-left px-4 py-2 text-[11px] uppercase tracking-widest transition-colors hover:bg-gray-50 ${
                          catalogSelectedCategories.has(cat) && showCatalog
                            ? 'text-gray-900 font-semibold'
                            : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <button onClick={() => { closeProductModal(); setCatalogSpecialFilter('all'); setSedesViewMode(false); setShowCatalog(true); setShowDrop(false); setShowServices(false); setShowNewLaunches(false); setShowOffers(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className={`${showCatalog && !sedesViewMode ? 'text-white' : 'text-white/50'} hover:text-white transition-colors uppercase text-xs tracking-[0.2em]`}>Catálogo</button>
            {storeSedes.length >= 2 && (
              <button onClick={() => { closeProductModal(); setSedesViewMode(true); setActiveSede(null); setCatalogSpecialFilter('all'); setShowCatalog(true); setShowDrop(false); setShowServices(false); setShowNewLaunches(false); setShowOffers(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className={`flex items-center gap-1 ${showCatalog && sedesViewMode ? 'text-white' : 'text-white/50'} hover:text-white transition-colors uppercase text-xs tracking-[0.2em]`}>
                <Store className="w-3.5 h-3.5" />
                Sedes
              </button>
            )}
            {publicServices.length > 0 && <button onClick={() => { closeProductModal(); setShowServices(true); setShowCatalog(false); setShowDrop(false); setShowNewLaunches(false); setShowOffers(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className={`${showServices ? 'text-white' : 'text-white/50'} hover:text-white transition-colors uppercase text-xs tracking-[0.2em]`}>Servicios</button>}
            {storeConfig?.activeDrop && <button onClick={() => { closeProductModal(); setShowDrop(true); setShowCatalog(false); setShowServices(false); setShowNewLaunches(false); setShowOffers(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className={`${showDrop ? 'text-white' : 'text-white/50'} hover:text-white transition-colors uppercase text-xs tracking-[0.2em]`}>Drop</button>}
            {storeConfig?.publicMenuEnabled && selectedStore !== 'all' && (
              <a href={`/menu/${selectedStore}`} target="_blank" rel="noreferrer"
                className="text-white/50 hover:text-white transition-colors uppercase text-xs tracking-[0.2em]">
                Menú
              </a>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated && authUser ? (
              <>
                <button
                  onClick={() => { fetchClientOrders(); setAccountTab('pedidos'); setShowAccountPanel(true) }}
                  className="hidden md:flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors uppercase tracking-wider"
                >
                  <Package className="w-4 h-4" />
                  Mis Pedidos
                </button>
                <button
                  onClick={() => { setAccountTab('perfil'); setShowAccountPanel(true) }}
                  className="hidden md:flex w-9 h-9 rounded-full bg-white/10 hover:bg-amber-500/20 border border-white/20 hover:border-amber-400/40 items-center justify-center transition-all duration-300 group"
                  title={authUser.name}
                >
                  <User className="w-4 h-4 text-white/70 group-hover:text-amber-400 transition-colors" />
                </button>
              </>
            ) : null}
            <button
              onClick={() => { setShowDesktopSearch(s => !s); setTimeout(() => desktopSearchInputRef.current?.focus(), 50) }}
              className="hidden md:flex p-2 text-white/70 hover:text-white transition-colors"
              title="Buscar"
            >
              <Search className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowCart(true)}
              className="relative p-2 text-white/70 hover:text-white transition-colors"
            >
              <ShoppingCart className="w-5 h-5" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-black text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </button>
            {!isAuthenticated && (
              <button
                onClick={() => { setShowClientLogin(true); setClientLoginTab('login'); setClientLoginError('') }}
                className="hidden md:flex w-9 h-9 rounded-full bg-white/10 hover:bg-amber-500/20 border border-white/20 hover:border-amber-400/40 items-center justify-center transition-all duration-300 group"
                title="Mi Cuenta"
              >
                <User className="w-4 h-4 text-white/70 group-hover:text-amber-400 transition-colors" />
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ========== DESKTOP SEARCH OVERLAY ========== */}
      {showDesktopSearch && (
        <>
          <div
            className="fixed inset-0 z-[48] hidden md:block"
            onClick={() => { setShowDesktopSearch(false); setGlobalSearchQuery(''); setGlobalSearchResults([]); setGlobalSearchStores([]) }}
          />
          <div
            className="fixed left-0 right-0 z-[49] hidden md:block border-b border-white/10 shadow-2xl"
            style={{
              top: storeConfig?.announcementBar?.isActive ? '104px' : '64px',
              backgroundColor: effectiveBgColor,
            }}
          >
            <div className="max-w-3xl mx-auto px-6 py-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                <input
                  ref={desktopSearchInputRef}
                  type="text"
                  value={globalSearchQuery}
                  onChange={(e) => handleGlobalSearch(e.target.value)}
                  placeholder="Buscar productos, marcas o categorías..."
                  className="w-full pl-12 pr-12 py-3 bg-white/5 border border-white/15 text-white placeholder-white/30 text-sm focus:outline-none focus:border-amber-500/50 rounded-sm"
                />
                {globalSearchQuery ? (
                  <button
                    onClick={() => { setGlobalSearchQuery(''); setGlobalSearchResults([]); setGlobalSearchStores([]); desktopSearchInputRef.current?.focus() }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => { setShowDesktopSearch(false) }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Results */}
              {!globalSearchQuery ? (
                <p className="text-center text-white/30 text-sm py-6">Escribe para buscar tiendas, productos o servicios...</p>
              ) : loadingGlobalSearch ? (
                <div className="flex items-center justify-center gap-3 py-6">
                  <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-white/40 text-sm">Buscando...</span>
                </div>
              ) : globalSearchResults.length === 0 && globalSearchStores.length === 0 ? (
                <p className="text-center text-white/30 text-sm py-6">Sin resultados para &ldquo;{globalSearchQuery}&rdquo;</p>
              ) : (
                <div className="mt-4 pb-4 max-h-[60vh] overflow-y-auto space-y-4">
                  {/* Stores */}
                  {globalSearchStores.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-white/20 mb-3 font-light">Tiendas</p>
                      <div className="flex flex-col gap-1.5">
                        {globalSearchStores.map(store => (
                          <button
                            key={store.id}
                            onClick={() => { setSelectedStore(store.slug); setShowDesktopSearch(false); setGlobalSearchQuery(''); setGlobalSearchResults([]); setGlobalSearchStores([]) }}
                            className="group flex items-center gap-4 px-4 py-3 rounded-none border-b border-white/5 hover:bg-white/4 hover:border-amber-500/20 transition-all duration-150 text-left w-full"
                          >
                            {/* Logo / icon */}
                            <div className="shrink-0 w-10 h-10 rounded-sm overflow-hidden border border-white/8 bg-white/3 flex items-center justify-center">
                              {store.logoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={ensureAbsoluteUrl(store.logoUrl)} alt={store.name} className="w-full h-full object-cover" />
                              ) : (
                                <Store className="w-4 h-4 text-white/20" />
                              )}
                            </div>
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-light text-white/90 tracking-wide truncate group-hover:text-white transition-colors">
                                {store.name}
                              </p>
                              {store.businessType && (
                                <p className="text-[11px] text-amber-500/60 uppercase tracking-widest font-light mt-0.5 truncate">
                                  {store.businessType}
                                </p>
                              )}
                            </div>
                            {/* Arrow */}
                            <ChevronRight className="w-3.5 h-3.5 text-white/15 group-hover:text-amber-500/50 transition-colors shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Products */}
                  {globalSearchResults.length > 0 && (
                    <div>
                      {globalSearchStores.length > 0 && <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">Productos</p>}
                      <div className="grid grid-cols-4 gap-3">
                        {globalSearchResults.slice(0, 12).map(product => {
                    const isOffer = product.isOnOffer && product.offerPrice
                    const inCart = carrito.find(c => c.id === product.id)
                    return (
                      <div
                        key={product.id}
                        className={`group relative bg-white/5 border ${isOffer ? 'border-orange-500/30' : 'border-white/10'} overflow-hidden cursor-pointer hover:border-amber-500/40 transition-colors`}
                        onClick={() => { openProductModal(product); setShowDesktopSearch(false); setGlobalSearchQuery(''); setGlobalSearchResults([]); setGlobalSearchStores([]) }}
                      >
                        <div data-dark className="relative aspect-square bg-black/50 overflow-hidden">
                          {product.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={ensureAbsoluteUrl(product.imageUrl)} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><Sparkles className="w-6 h-6 text-white/10" /></div>
                          )}
                          {isOffer && (
                            <div className="absolute top-1.5 left-1.5 bg-gradient-to-r from-red-600 to-orange-600 text-white text-[9px] font-bold px-1.5 py-0.5">OFERTA</div>
                          )}
                          {inCart && (
                            <div className="absolute bottom-1.5 right-1.5 bg-amber-500 text-black text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{inCart.cantidad}</div>
                          )}
                        </div>
                        <div className="p-2">
                          <p className="text-xs text-white/80 truncate leading-tight">{product.name}</p>
                          <p className="text-xs text-amber-400 font-medium mt-0.5">
                            {isOffer ? formatCOP(product.offerPrice!) : formatCOP(product.salePrice)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ========== MOBILE SIDEBAR MENU ========== */}
      {mobileMenuOpen && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed top-0 left-0 h-full w-[280px] landing-sidebar border-r border-white/10 z-[70] p-6 animate-in slide-in-from-left duration-300 flex flex-col">
            <div className="flex items-center justify-between mb-8">
              {storeConfig?.storeInfo?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={storeConfig.storeInfo.logoUrl} alt={storeConfig.storeInfo.name || 'Logo'} className="h-14 w-auto object-contain" />
              ) : (
                <span className="text-lg font-light tracking-[0.3em] text-white uppercase">{storeConfig?.storeInfo?.name || 'Tienda'}</span>
              )}
              <button onClick={() => setMobileMenuOpen(false)} className="text-white/50 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex flex-col gap-6 text-sm font-bold tracking-widest text-white/70">
              <button onClick={() => { closeProductModal(); setShowCatalog(false); setShowDrop(false); setShowServices(false); setShowNewLaunches(false); setShowOffers(false); setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className={`text-left py-2 ${!showCatalog && !showDrop && !showServices && !showNewLaunches && !showOffers && !showProductModal ? 'text-white' : 'text-white/50'} hover:text-white transition-colors uppercase border-b border-white/5`}>Inicio</button>
              <button onClick={() => { closeProductModal(); setSedesViewMode(false); setShowCatalog(true); setShowDrop(false); setShowServices(false); setShowNewLaunches(false); setShowOffers(false); setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className={`text-left py-2 ${showCatalog && !sedesViewMode ? 'text-white' : 'text-white/50'} hover:text-white transition-colors uppercase border-b border-white/5`}>Catálogo</button>
              {storeSedes.length >= 2 && (
                <button onClick={() => { closeProductModal(); setSedesViewMode(true); setActiveSede(null); setCatalogSpecialFilter('all'); setShowCatalog(true); setShowDrop(false); setShowServices(false); setShowNewLaunches(false); setShowOffers(false); setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className={`text-left py-2 flex items-center gap-2 ${showCatalog && sedesViewMode ? 'text-white' : 'text-white/50'} hover:text-white transition-colors uppercase border-b border-white/5`}>
                  <Store className="w-4 h-4" />
                  Sedes
                </button>
              )}
              {storeConfig?.newLaunches && storeConfig.newLaunches.length > 0 && (
                <button onClick={() => { closeProductModal(); setShowNewLaunches(true); setShowCatalog(false); setShowDrop(false); setShowServices(false); setShowOffers(false); setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className={`text-left py-2 ${showNewLaunches ? 'text-white' : 'text-white/50'} hover:text-white transition-colors uppercase border-b border-white/5`}>
                  Nuevos Lanzamientos
                </button>
              )}
              {publicServices.length > 0 && <button onClick={() => { closeProductModal(); setShowServices(true); setShowCatalog(false); setShowDrop(false); setShowNewLaunches(false); setShowOffers(false); setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className={`text-left py-2 ${showServices ? 'text-white' : 'text-white/50'} hover:text-white transition-colors uppercase border-b border-white/5`}>Servicios</button>}
              {storeConfig?.activeDrop && <button onClick={() => { closeProductModal(); setShowDrop(true); setShowCatalog(false); setShowServices(false); setShowNewLaunches(false); setShowOffers(false); setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className={`text-left py-2 ${showDrop ? 'text-white' : 'text-white/50'} hover:text-white transition-colors uppercase border-b border-white/5`}>Drop</button>}
              {offerProducts.length > 0 && <button onClick={() => { closeProductModal(); setShowOffers(true); setShowCatalog(false); setShowDrop(false); setShowServices(false); setShowNewLaunches(false); setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className={`text-left py-2 ${showOffers ? 'text-white' : 'text-white/50'} hover:text-white transition-colors uppercase border-b border-white/5`}>Ofertas</button>}
              {storeConfig?.publicMenuEnabled && selectedStore !== 'all' && (
                <a href={`/menu/${selectedStore}`} target="_blank" rel="noreferrer"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-left py-2 text-amber-400 hover:text-amber-300 transition-colors uppercase border-b border-white/5 flex items-center gap-2">
                  <UtensilsCrossed className="w-4 h-4" />
                  Menú
                </a>
              )}
              {isAuthenticated && authUser ? (
                <>
                  <button onClick={() => { fetchClientOrders(); setShowMyOrders(true); setMobileMenuOpen(false) }} className="text-left py-2 text-amber-400 hover:text-amber-300 transition-colors uppercase border-b border-white/5 flex items-center gap-2"><Package className="w-4 h-4" />Mis Pedidos</button>
                  <button onClick={() => { handleClientLogout(); setMobileMenuOpen(false) }} className="text-left py-2 text-red-400 hover:text-red-300 transition-colors uppercase border-b border-white/5 flex items-center gap-2"><LogOut className="w-4 h-4" />Cerrar Sesión ({authUser.name})</button>
                </>
              ) : (
                <button onClick={() => { setMobileMenuOpen(false); setShowClientLogin(true); setClientLoginTab('login'); setClientLoginError('') }} className="text-left py-2 text-amber-400 hover:text-amber-300 transition-colors uppercase border-b border-white/5 flex items-center gap-2"><LogIn className="w-4 h-4" />Mi Cuenta</button>
              )}
            </div>
          </div>
        </>
      )}

      {/* ========== PRODUCT DETAIL VIEW (fixed overlay) ========== */}
      {showProductModal && selectedProduct && (() => {
        // Parse gallery images
        let parsedImgs: string[] = []
        const rawImgs = selectedProduct.images
        if (Array.isArray(rawImgs)) {
          parsedImgs = (rawImgs as string[]).filter(Boolean)
        } else if (typeof rawImgs === 'string') {
          try { parsedImgs = (JSON.parse(rawImgs) as string[]).filter(Boolean) } catch { /* noop */ }
        }
        const gallery: string[] = parsedImgs.length > 0
          ? parsedImgs
          : selectedProduct.imageUrl ? [selectedProduct.imageUrl] : []
        const activeUrl = gallery[activeImageIdx] || gallery[0] || ''

        // Related products: same category, different product
        const relatedProducts = products
          .filter(p => p.id !== selectedProduct.id && (p.category === selectedProduct.category || p.brand === selectedProduct.brand))
          .slice(0, 8)

        // Color name → CSS color mapper
        const colorToCss = (name: string): string | null => {
          const map: Record<string, string> = {
            negro: '#111', blanco: '#f5f5f5', rojo: '#ef4444', azul: '#3b82f6',
            verde: '#22c55e', amarillo: '#eab308', rosa: '#ec4899', rosado: '#f9a8d4',
            morado: '#a855f7', violeta: '#8b5cf6', naranja: '#f97316', gris: '#6b7280',
            café: '#92400e', marron: '#92400e', marrón: '#92400e', dorado: '#d97706',
            plateado: '#9ca3af', beige: '#d4b896', turquesa: '#14b8a6', coral: '#fb7185',
            vino: '#7f1d1d', camel: '#c4a265', crema: '#fef3c7', lavanda: '#c4b5fd',
          }
          const lower = name.toLowerCase().trim()
          if (/^#[0-9a-f]{3,6}$/i.test(lower)) return lower
          return map[lower] ?? null
        }

        return (
          <div
            className="fixed z-[150] overflow-y-auto animate-in fade-in duration-200"
            style={{
              top: storeConfig?.announcementBar?.isActive ? '104px' : '64px',
              left: 0, right: 0, bottom: 0,
              backgroundColor: effectiveBgColor,
            }}
          >
            {/* ══════════════════════════════════════════
                MOBILE LAYOUT
            ══════════════════════════════════════════ */}
            <div className="sm:hidden relative" style={{ paddingBottom: '24px' }}>
              {/* Close button */}
              <button
                onClick={closeProductModal}
                className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>

              {/* ── Main image ── */}
              <div className="relative w-full" style={{ aspectRatio: '1 / 1', backgroundColor: isLightBg ? '#f0f0f0' : '#111' }}>
                {activeUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={activeUrl} src={ensureAbsoluteUrl(activeUrl)} alt={selectedProduct.name} className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Sparkles className="w-16 h-16 text-white/10" /></div>
                )}
                {!!(selectedProduct.isOnOffer && selectedProduct.offerPrice) && (
                  <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-gradient-to-r from-red-600 to-orange-500 text-white text-xs font-bold px-2.5 py-1 shadow-lg">
                    <Flame className="w-3.5 h-3.5" />
                    -{Math.round(((selectedProduct.salePrice - selectedProduct.offerPrice) / selectedProduct.salePrice) * 100)}% OFF
                  </div>
                )}
              </div>

              {/* ── Thumbnail strip ── */}
              {gallery.length > 1 && (
                <div className="flex gap-2.5 px-4 mt-3 overflow-x-auto scrollbar-hide">
                  {gallery.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImageIdx(i)}
                      className={`flex-shrink-0 w-[64px] h-[64px] rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                        i === activeImageIdx ? 'border-amber-400 opacity-100' : 'border-transparent opacity-45'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ensureAbsoluteUrl(url)} alt={`${selectedProduct.name} ${i + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* ── Content ── */}
              <div className="px-4 mt-5 space-y-4">

                {/* Product name */}
                <h1 className={`text-2xl font-semibold leading-tight ${isLightBg ? 'text-black' : 'text-white'}`}>{selectedProduct.name}</h1>

                {/* Price */}
                <div>
                  {selectedProduct.isOnOffer && selectedProduct.offerPrice ? (
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`text-2xl font-bold ${isLightBg ? 'text-black' : 'text-amber-400'}`}>{formatCOP(selectedProduct.offerPrice)}</span>
                      <span className="text-base text-white/30 line-through">{formatCOP(selectedProduct.salePrice)}</span>
                    </div>
                  ) : (
                    <span className={`text-2xl font-bold ${isLightBg ? 'text-black' : 'text-amber-400'}`}>{formatCOP(selectedProduct.salePrice)}</span>
                  )}
                </div>

                {/* Viewers count */}
                <div className={`flex items-center gap-2 text-sm ${isLightBg ? 'text-black/50' : 'text-white/50'}`}>
                  <Eye className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span><strong className={isLightBg ? 'text-black/80' : 'text-white/80'}>{viewersCount}</strong> personas viendo este producto</span>
                </div>

                {/* Variants */}
                {(selectedProduct.color || selectedProduct.size) && (
                  <div className="space-y-3">
                    {selectedProduct.color && (
                      <div>
                        <p className={`text-[11px] uppercase tracking-widest mb-2.5 ${isLightBg ? 'text-black/40' : 'text-white/40'}`}>
                          Color — <span className={isLightBg ? 'text-black/70' : 'text-white/70'}>{selectedProduct.color}</span>
                        </p>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-9 h-9 rounded-full border-[3px] border-amber-400 shadow-lg ring-2 ring-amber-400/30"
                            style={{ backgroundColor: colorToCss(selectedProduct.color) ?? (isLightBg ? '#444' : '#bbb') }}
                          />
                        </div>
                      </div>
                    )}
                    {selectedProduct.size && (
                      <div>
                        <p className={`text-[11px] uppercase tracking-widest mb-2.5 ${isLightBg ? 'text-black/40' : 'text-white/40'}`}>Talla</p>
                        <div className="flex gap-2 flex-wrap">
                          <div className="px-5 py-2 rounded-full border-2 border-amber-400 text-sm font-medium text-amber-400 bg-amber-400/10">
                            {selectedProduct.size}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Quantity + Heart */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <button
                      onClick={() => setProductQuantity(q => Math.max(1, q - 1))}
                      disabled={selectedProduct.stock === 0}
                      className={`w-11 h-11 flex items-center justify-center border rounded-l-xl transition-colors ${isLightBg ? 'border-black/20 text-black/60 hover:bg-black/5' : 'border-white/20 text-white/60 hover:bg-white/5'}`}
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className={`w-12 h-11 flex items-center justify-center border-y text-base font-light ${isLightBg ? 'border-black/20 text-black' : 'border-white/20 text-white'}`}>{productQuantity}</span>
                    <button
                      onClick={() => setProductQuantity(q => Math.min(selectedProduct.stock, q + 1))}
                      disabled={selectedProduct.stock === 0}
                      className={`w-11 h-11 flex items-center justify-center border rounded-r-xl transition-colors ${isLightBg ? 'border-black/20 text-black/60 hover:bg-black/5' : 'border-white/20 text-white/60 hover:bg-white/5'}`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => toggleFavorite(selectedProduct.id)}
                    className={`w-11 h-11 flex items-center justify-center rounded-full border transition-colors ${isLightBg ? 'border-black/20 hover:bg-red-50' : 'border-white/20 hover:bg-red-500/10'}`}
                  >
                    <Heart className={`w-5 h-5 ${favorites.has(selectedProduct.id) ? 'fill-red-500 text-red-500' : isLightBg ? 'text-black/40' : 'text-white/40'}`} />
                  </button>
                </div>

                {/* Stock status */}
                {selectedProduct.stock === 0 ? (
                  <div className="flex items-center gap-2 text-red-400 text-sm"><div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />Agotado</div>
                ) : selectedProduct.stock <= 5 ? (
                  <div className="flex items-center gap-2 text-amber-400 text-sm"><div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />¡Últimas {selectedProduct.stock} unidades!</div>
                ) : null}

                {/* Action buttons */}
                <div className="space-y-3 pt-1">
                  <button
                    onClick={addFromModal}
                    disabled={selectedProduct.stock === 0}
                    style={selectedProduct.stock > 0 ? { backgroundColor: isLightBg ? '#111111' : '#ffffff', color: isLightBg ? '#ffffff' : '#000000' } : undefined}
                    className={`w-full py-4 flex items-center justify-center gap-2.5 text-sm uppercase tracking-[0.15em] font-medium rounded-xl transition-opacity ${
                      selectedProduct.stock === 0 ? 'opacity-30 cursor-not-allowed bg-black/10 text-white/30' : 'hover:opacity-85'
                    }`}
                  >
                    <ShoppingCart className="w-4 h-4 flex-shrink-0" />
                    Añadir al carrito
                  </button>
                  <button
                    onClick={() => {
                      if (selectedProduct.stock === 0) return
                      addFromModal()
                      setShowCart(false)
                      handleIrAlCheckout()
                    }}
                    disabled={selectedProduct.stock === 0}
                    style={selectedProduct.stock > 0 ? { backgroundColor: isLightBg ? '#111111' : '#ffffff', color: isLightBg ? '#ffffff' : '#000000' } : undefined}
                    className={`w-full py-4 flex items-center justify-center gap-2 text-sm uppercase tracking-[0.15em] font-semibold rounded-xl transition-opacity ${
                      selectedProduct.stock === 0 ? 'opacity-30 cursor-not-allowed bg-black/10 text-white/30' : 'hover:opacity-85'
                    }`}
                  >
                    Comprar ahora
                  </button>
                </div>

                {/* Verified store info */}
                {selectedProduct.storeName && (
                  <div className={`flex items-center gap-3 py-4 border-t ${isLightBg ? 'border-black/10' : 'border-white/8'}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isLightBg ? 'bg-black/5 border border-black/10' : 'bg-white/5 border border-white/10'}`}>
                      <Store className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-medium ${isLightBg ? 'text-black/80' : 'text-white/80'}`}>{selectedProduct.storeName}</p>
                        <span className={`flex items-center gap-1 text-[10px] border px-2 py-0.5 rounded-full ${isLightBg ? 'text-black/40 border-black/15' : 'text-white/40 border-white/15'}`}>
                          <CheckCircle className="w-3 h-3 text-green-400" /> Verificado
                        </span>
                      </div>
                      <p className={`text-[11px] mt-0.5 ${isLightBg ? 'text-black/40' : 'text-white/40'}`}>Tienda oficial · Envíos a todo Colombia</p>
                    </div>
                  </div>
                )}

                {/* Description */}
                {selectedProduct.description && (
                  <div className={`py-4 border-t ${isLightBg ? 'border-black/10' : 'border-white/8'}`}>
                    <h4 className={`text-[10px] uppercase tracking-widest mb-3 ${isLightBg ? 'text-black/40' : 'text-white/40'}`}>Descripción</h4>
                    <div className="space-y-2">
                      {selectedProduct.description.split(/\n+/).map(l => l.trim()).filter(Boolean).map((line, i) => {
                        const isBullet = /^[-•*►▸→✓✔·]\s/.test(line)
                        const cleanLine = isBullet ? line.replace(/^[-•*►▸→✓✔·]\s*/, '') : line
                        return isBullet ? (
                          <div key={i} className="flex items-start gap-2">
                            <span className="mt-[5px] shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500/70" />
                            <p className={`text-sm font-light leading-relaxed ${isLightBg ? 'text-black/70' : 'text-white/60'}`}>{cleanLine}</p>
                          </div>
                        ) : <p key={i} className={`text-sm font-light leading-relaxed ${isLightBg ? 'text-black/70' : 'text-white/60'}`}>{line}</p>
                      })}
                    </div>
                  </div>
                )}

                {/* Mobile reviews */}
                <div className={`py-4 border-t ${isLightBg ? 'border-black/10' : 'border-white/8'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-[10px] uppercase tracking-widest ${isLightBg ? 'text-black/40' : 'text-white/40'}`}>Reseñas</h3>
                    <button onClick={() => { setShowReviewForm(p => !p); setReviewSuccess(false); setReviewError('') }}
                      className="text-xs text-amber-400 border border-amber-400/30 px-3 py-1.5 rounded-full hover:bg-amber-400/10 transition-colors">
                      {showReviewForm ? 'Cancelar' : '+ Reseña'}
                    </button>
                  </div>
                  {showReviewForm && !reviewSuccess && (
                    <div className="mb-5 p-4 border border-white/10 bg-white/3 space-y-3 rounded-xl">
                      <div>
                        <label className={`text-[10px] uppercase tracking-widest block mb-1 ${isLightBg ? 'text-black/40' : 'text-white/40'}`}>Tu nombre *</label>
                        <input className={`w-full border text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-amber-400/50 ${isLightBg ? 'bg-black/5 border-black/10 text-black placeholder-black/30' : 'bg-white/5 border-white/10 text-white placeholder-white/30'}`} placeholder="Nombre" value={reviewForm.reviewerName} onChange={e => setReviewForm(p => ({ ...p, reviewerName: e.target.value }))} />
                      </div>
                      <div>
                        <label className={`text-[10px] uppercase tracking-widest block mb-1 ${isLightBg ? 'text-black/40' : 'text-white/40'}`}>Calificación</label>
                        <div className="flex gap-1">{[1,2,3,4,5].map(n => <button key={n} type="button" onClick={() => setReviewForm(p => ({ ...p, rating: n }))}><Star size={22} className={n <= reviewForm.rating ? 'fill-amber-400 text-amber-400' : 'text-white/20'} /></button>)}</div>
                      </div>
                      <div>
                        <label className={`text-[10px] uppercase tracking-widest block mb-1 ${isLightBg ? 'text-black/40' : 'text-white/40'}`}>Comentario</label>
                        <textarea rows={3} className={`w-full border text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-amber-400/50 resize-none ${isLightBg ? 'bg-black/5 border-black/10 text-black placeholder-black/30' : 'bg-white/5 border-white/10 text-white placeholder-white/30'}`} placeholder="Tu experiencia..." value={reviewForm.body} onChange={e => setReviewForm(p => ({ ...p, body: e.target.value }))} />
                      </div>
                      {reviewError && <p className="text-red-400 text-xs">{reviewError}</p>}
                      <button
                        disabled={reviewSubmitting || !reviewForm.reviewerName.trim()}
                        onClick={async () => {
                          const tenantId = selectedProduct?.tenantId || stores.find(s => s.slug === selectedStore)?.id
                          if (!tenantId || !selectedProduct) { setReviewError('No se pudo identificar la tienda.'); return }
                          setReviewSubmitting(true); setReviewError('')
                          const res = await api.createReview({ tenantId, productId: String(selectedProduct.id), reviewerName: reviewForm.reviewerName, reviewerEmail: reviewForm.reviewerEmail || undefined, rating: reviewForm.rating, title: reviewForm.title || undefined, body: reviewForm.body || undefined })
                          setReviewSubmitting(false)
                          if (res.success) { setReviewSuccess(true); setShowReviewForm(false) } else { setReviewError(res.error || 'Error al enviar') }
                        }}
                        className="w-full py-3 bg-amber-500 text-black text-sm font-semibold uppercase tracking-wider rounded-xl hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >{reviewSubmitting ? 'Enviando…' : 'Enviar reseña'}</button>
                    </div>
                  )}
                  {reviewSuccess && <div className="mb-4 flex items-center gap-2 text-green-400 text-sm p-3 bg-green-400/10 border border-green-400/20 rounded-xl"><CheckCircle className="w-4 h-4" />¡Reseña enviada!</div>}
                  {reviewsLoading ? (
                    <div className="text-center py-4"><Loader2 className="w-5 h-5 animate-spin mx-auto text-white/30" /></div>
                  ) : productReviews.length > 0 ? (
                    <div className="space-y-3">
                      {productReviews.map((r: any) => (
                        <div key={r.id} className={`p-3 rounded-xl border ${isLightBg ? 'bg-black/3 border-black/8' : 'bg-white/3 border-white/8'}`}>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div>
                              <p className={`text-sm font-medium ${isLightBg ? 'text-black/80' : 'text-white/80'}`}>{r.reviewerName}</p>
                              <div className="flex gap-0.5 mt-0.5">{[1,2,3,4,5].map(s => <Star key={s} size={12} className={s <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-white/15'} />)}</div>
                            </div>
                            <span className={`text-[10px] ${isLightBg ? 'text-black/30' : 'text-white/30'}`}>{new Date(r.createdAt).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}</span>
                          </div>
                          {r.body && <p className={`text-sm font-light leading-relaxed mt-1 ${isLightBg ? 'text-black/70' : 'text-white/60'}`}>{r.body}</p>}
                        </div>
                      ))}
                    </div>
                  ) : <p className={`text-sm ${isLightBg ? 'text-black/30' : 'text-white/20'}`}>Aún no hay reseñas. ¡Sé el primero!</p>}
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════
                DESKTOP LAYOUT
            ══════════════════════════════════════════ */}
            <div className="hidden sm:block">
              {/* Close button */}
              <button
                onClick={closeProductModal}
                className="fixed top-20 right-6 z-20 w-10 h-10 rounded-full bg-black/70 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:bg-black transition-all shadow-lg"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                {/* Back button */}
                <button onClick={closeProductModal} className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-xs uppercase tracking-widest mb-6">
                  <ChevronLeft className="w-4 h-4" />Volver
                </button>

                {/* ── Two-column layout ── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">

                  {/* ════ LEFT — Gallery + Info ════ */}
                  <div className="lg:col-span-7 space-y-8">

                    {/* Gallery */}
                    <div className="flex gap-3 lg:max-h-[520px]">
                      {gallery.length > 1 && (
                        <div className="hidden sm:flex flex-col gap-2 w-[64px] flex-shrink-0 overflow-y-auto scrollbar-hide">
                          {gallery.map((url, i) => (
                            <button key={i} onClick={() => setActiveImageIdx(i)}
                              className={`w-[64px] h-[64px] overflow-hidden flex-shrink-0 transition-all duration-200 ${i === activeImageIdx ? 'border-2 border-amber-400/80' : 'border border-white/10 opacity-50 hover:opacity-100'}`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={ensureAbsoluteUrl(url)} alt={`${selectedProduct.name} ${i + 1}`} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="flex-1 relative overflow-hidden lg:max-h-[520px]" style={{ aspectRatio: '4/5', backgroundColor: effectiveBgColor }}>
                        {activeUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={activeUrl} src={ensureAbsoluteUrl(activeUrl)} alt={selectedProduct.name} className="w-full h-full object-contain transition-opacity duration-300" />
                        ) : <div className="w-full h-full flex items-center justify-center"><Sparkles className="w-20 h-20 text-white/10" /></div>}
                        {!!(selectedProduct.isOnOffer && selectedProduct.offerPrice) && (
                          <div className="absolute top-4 left-4 flex flex-col gap-2">
                            <div className="flex items-center gap-1.5 bg-gradient-to-r from-red-600 to-orange-600 text-white text-sm font-bold px-3 py-1.5 shadow-lg shadow-red-500/30">
                              <Flame className="w-4 h-4" />-{Math.round(((selectedProduct.salePrice - selectedProduct.offerPrice) / selectedProduct.salePrice) * 100)}% OFF
                            </div>
                            {selectedProduct.offerLabel && <div className="bg-black/75 backdrop-blur-sm text-white/70 text-xs font-medium px-3 py-1 uppercase tracking-wider">{selectedProduct.offerLabel}</div>}
                          </div>
                        )}
                        {selectedProduct.availableForDelivery && (
                          <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white/70 text-[10px] font-medium px-2.5 py-1.5 uppercase tracking-wider">
                            <MapPin className="w-3 h-3" /> Domicilio disponible
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Store info */}
                    {selectedProduct.storeName && (
                      <div className="flex items-center gap-3 py-4 border-t border-white/5">
                        <div className="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                          <Store className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-white/80">{selectedProduct.storeName}</p>
                            <span className="flex items-center gap-1 text-[10px] text-white/40 border border-white/10 px-2 py-0.5 rounded-full">
                              <CheckCircle className="w-3 h-3 text-green-400" /> Verificado
                            </span>
                          </div>
                          <p className="text-[11px] text-white/40 mt-0.5">Tienda oficial · Envíos a todo Colombia</p>
                        </div>
                      </div>
                    )}

                    {/* Description */}
                    {selectedProduct.description && (
                      <div className="py-4 border-t border-white/5">
                        <h4 className={`text-[10px] uppercase tracking-widest mb-4 ${isLightBg ? 'text-black/40' : 'text-white/40'}`}>Descripción</h4>
                        <div className="space-y-2.5">
                          {selectedProduct.description.split(/\n+/).map(l => l.trim()).filter(Boolean).map((line, i) => {
                            const isBullet = /^[-•*►▸→✓✔·]\s/.test(line)
                            const cleanLine = isBullet ? line.replace(/^[-•*►▸→✓✔·]\s*/, '') : line
                            return isBullet ? (
                              <div key={i} className="flex items-start gap-2.5"><span className="mt-[5px] shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500/70" /><p className={`text-sm font-light leading-relaxed ${isLightBg ? 'text-black/75' : 'text-white/65'}`}>{cleanLine}</p></div>
                            ) : <p key={i} className={`text-sm font-light leading-relaxed ${isLightBg ? 'text-black/75' : 'text-white/65'}`}>{line}</p>
                          })}
                        </div>
                      </div>
                    )}

                    {/* Specs */}
                    <div className={`py-4 border-t ${isLightBg ? 'border-black/10' : 'border-white/5'}`}>
                      <h4 className={`text-[10px] uppercase tracking-widest mb-4 ${isLightBg ? 'text-black/40' : 'text-white/40'}`}>Especificaciones</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[
                          { label: 'Categoría', value: selectedProduct.category },
                          { label: 'Marca', value: selectedProduct.brand },
                          { label: 'Color', value: selectedProduct.color },
                          { label: 'Tamaño', value: selectedProduct.size },
                          { label: 'Género', value: selectedProduct.gender },
                          { label: 'Material', value: selectedProduct.material },
                          { label: 'Peso', value: selectedProduct.netWeight ? `${selectedProduct.netWeight} ${selectedProduct.weightUnit || ''}` : null },
                          { label: 'Garantía', value: selectedProduct.warrantyMonths ? `${selectedProduct.warrantyMonths} meses` : null },
                        ].filter(s => s.value).map(s => (
                          <div key={s.label} className={`px-3 py-2 border ${isLightBg ? 'bg-black/5 border-black/10' : 'bg-white/4 border-white/5'}`}>
                            <p className={`text-[10px] uppercase ${isLightBg ? 'text-black/40' : 'text-white/40'}`}>{s.label}</p>
                            <p className={`text-sm font-light ${isLightBg ? 'text-black/70' : 'text-white/70'}`}>{s.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ════ RIGHT — Purchase zone ════ */}
                  <div className="lg:col-span-5">
                    <div className="lg:sticky lg:top-8 space-y-6">

                      <nav className="flex items-center gap-1 text-[11px] text-white/40 flex-wrap">
                        <button onClick={closeProductModal} className="hover:text-white/70 transition-colors">Inicio</button>
                        <ChevronRight className="w-3 h-3 flex-shrink-0" />
                        {selectedProduct.category && <><span className="uppercase">{selectedProduct.category}</span><ChevronRight className="w-3 h-3 flex-shrink-0" /></>}
                        <span className={`uppercase ${isLightBg ? 'text-black/60' : 'text-white/60'}`}>{selectedProduct.name}</span>
                      </nav>

                      <div><span className={`text-[10px] uppercase tracking-widest border px-2.5 py-1 ${isLightBg ? 'border-black/20 text-black/50' : 'border-white/15 text-white/50'}`}>{selectedProduct.category}</span></div>

                      <h1 className="text-3xl sm:text-4xl font-light leading-tight">{selectedProduct.name}</h1>

                      <div className="space-y-2">
                        {selectedProduct.isOnOffer && selectedProduct.offerPrice ? (
                          <div className="space-y-2">
                            <div className="flex items-end gap-3 flex-wrap">
                              <span className={`text-4xl font-light ${isLightBg ? 'text-black' : 'text-amber-400'}`}>{formatCOP(selectedProduct.offerPrice)}</span>
                              <span className="text-xl text-white/30 line-through pb-0.5">{formatCOP(selectedProduct.salePrice)}</span>
                              <span className="bg-red-600/20 text-red-400 text-xs font-bold px-2 py-1 border border-red-600/30 self-center">
                                -{Math.round(((selectedProduct.salePrice - selectedProduct.offerPrice) / selectedProduct.salePrice) * 100)}% OFF
                              </span>
                            </div>
                            <p className="text-sm text-white/60 flex items-center gap-1.5">
                              <Tag className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />Ahorras {formatCOP(selectedProduct.salePrice - selectedProduct.offerPrice)}
                              {selectedProduct.offerLabel && <span className="text-white/40 ml-1">· {selectedProduct.offerLabel}</span>}
                            </p>
                          </div>
                        ) : <span className={`text-4xl font-light ${isLightBg ? 'text-black' : 'text-amber-400'}`}>{formatCOP(selectedProduct.salePrice)}</span>}
                      </div>

                      <div>
                        {selectedProduct.stock === 0 ? (
                          <div className="flex items-center gap-2 text-red-400 text-sm"><div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />Agotado por el momento</div>
                        ) : selectedProduct.stock <= 5 ? (
                          <div className="flex items-center gap-2 text-amber-400 text-sm"><div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />¡Últimas unidades!</div>
                        ) : (
                          <div className="flex items-center gap-2 text-white/60 text-sm"><div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />En stock</div>
                        )}
                      </div>

                      {/* Variants — desktop */}
                      {(selectedProduct.color || selectedProduct.size) && (
                        <div className="space-y-3">
                          {selectedProduct.color && (
                            <div>
                              <p className={`text-[10px] uppercase tracking-widest mb-2.5 ${isLightBg ? 'text-black/40' : 'text-white/40'}`}>
                                Color — <span className={isLightBg ? 'text-black/70' : 'text-white/70'}>{selectedProduct.color}</span>
                              </p>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full border-[3px] border-amber-400 shadow-md ring-2 ring-amber-400/30"
                                  style={{ backgroundColor: colorToCss(selectedProduct.color) ?? (isLightBg ? '#444' : '#bbb') }}
                                />
                              </div>
                            </div>
                          )}
                          {selectedProduct.size && (
                            <div>
                              <p className={`text-[10px] uppercase tracking-widest mb-2.5 ${isLightBg ? 'text-black/40' : 'text-white/40'}`}>Talla</p>
                              <div className="px-5 py-2 rounded-full border-2 border-amber-400 text-sm font-medium text-amber-400 bg-amber-400/10 inline-block">{selectedProduct.size}</div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Quantity + heart */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <button onClick={() => setProductQuantity(q => Math.max(1, q - 1))} disabled={selectedProduct.stock === 0}
                            className="w-10 h-10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 border border-white/10 transition-colors">
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-12 text-center text-sm font-light border-y border-white/10 h-10 flex items-center justify-center">{productQuantity}</span>
                          <button onClick={() => setProductQuantity(q => Math.min(selectedProduct.stock, q + 1))} disabled={selectedProduct.stock === 0}
                            className="w-10 h-10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 border border-white/10 transition-colors">
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <button onClick={() => toggleFavorite(selectedProduct.id)}
                          className="w-10 h-10 flex items-center justify-center border border-white/10 hover:bg-red-500/10 transition-colors">
                          <Heart className={`w-5 h-5 ${favorites.has(selectedProduct.id) ? 'fill-red-500 text-red-500' : 'text-white/40'}`} />
                        </button>
                      </div>

                      {/* CTAs */}
                      <div ref={ctaRef} className="flex gap-3 mt-2">
                        <button
                          onClick={addFromModal}
                          disabled={selectedProduct.stock === 0}
                          style={selectedProduct.stock > 0 ? { backgroundColor: isLightBg ? '#f5f5f5' : '#1a1a1a', color: isLightBg ? '#111111' : '#ffffff', border: `1px solid ${isLightBg ? '#d1d5db' : '#333333'}` } : undefined}
                          className={`flex-1 py-4 text-sm uppercase tracking-[0.15em] font-medium transition-all duration-200 flex items-center justify-center gap-2 rounded-xl ${
                            selectedProduct.stock === 0 ? 'bg-black/5 text-black/20 cursor-not-allowed border border-black/10' : 'hover:opacity-75'
                          }`}
                        >
                          <ShoppingCart className="w-4 h-4 flex-shrink-0" />
                          <span className="leading-tight">{selectedProduct.stock === 0 ? 'Agotado' : 'Añadir al carrito'}</span>
                        </button>
                        <button
                          onClick={() => { if (selectedProduct.stock === 0) return; addFromModal(); setShowCart(false); handleIrAlCheckout() }}
                          disabled={selectedProduct.stock === 0}
                          style={selectedProduct.stock > 0 ? { backgroundColor: isLightBg ? '#111111' : '#ffffff', color: isLightBg ? '#ffffff' : '#000000' } : undefined}
                          className={`flex-1 py-4 text-sm uppercase tracking-[0.15em] font-semibold flex items-center justify-center gap-2 rounded-xl transition-opacity ${
                            selectedProduct.stock === 0 ? 'bg-black/5 text-black/20 cursor-not-allowed border border-black/10' : 'hover:opacity-80'
                          }`}
                        >
                          Comprar ahora
                        </button>
                      </div>

                      {/* Trust badges */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="flex flex-col items-center gap-1.5 p-3 border border-white/5 text-center">
                          <Zap className="w-4 h-4 text-white/30" /><p className="text-[10px] text-white/40 leading-tight">Envío Colombia</p>
                        </div>
                        <div className="flex flex-col items-center gap-1.5 p-3 border border-white/5 text-center">
                          <ShieldCheck className="w-4 h-4 text-white/30" /><p className="text-[10px] text-white/40 leading-tight">Pago seguro</p>
                        </div>
                        <div className="flex flex-col items-center gap-1.5 p-3 border border-white/5 text-center">
                          <RotateCcw className="w-4 h-4 text-white/30" /><p className="text-[10px] text-white/40 leading-tight">Devoluciones</p>
                        </div>
                      </div>

                      <div className={`flex items-center gap-2 px-3 py-2.5 text-sm border ${isLightBg ? 'bg-black/4 border-black/8 text-black/60' : 'bg-white/4 border-white/8 text-white/60'}`}>
                        <Eye className="w-4 h-4 flex-shrink-0 text-white/40" />
                        <span><strong className={isLightBg ? 'text-black/80' : 'text-white/80'}>{viewersCount}</strong> personas viendo ahora</span>
                      </div>

                      {/* Share */}
                      <div className="pt-1">
                        <p className={`text-[10px] uppercase tracking-widest mb-2 ${isLightBg ? 'text-black/40' : 'text-white/40'}`}>Compartir</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?product=${selectedProduct.id}`).catch(() => {})}
                            className={`flex items-center gap-1.5 px-3 py-2 text-xs border transition-colors ${isLightBg ? 'border-black/10 text-black/60 hover:bg-black/5' : 'border-white/10 text-white/50 hover:bg-white/5'}`}>
                            <Link className="w-3.5 h-3.5" />Copiar enlace
                          </button>
                          <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}${window.location.pathname}?product=${selectedProduct.id}`)}`} target="_blank" rel="noopener noreferrer"
                            className={`flex items-center gap-1.5 px-3 py-2 text-xs border transition-colors ${isLightBg ? 'border-black/10 text-black/60 hover:bg-black/5' : 'border-white/10 text-white/50 hover:bg-white/5'}`}>
                            <Facebook className="w-3.5 h-3.5" />Facebook
                          </a>
                          {storeConfig?.storeInfo?.socialWhatsapp && (
                            <a href={`https://wa.me/${storeConfig.storeInfo.socialWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, me interesa: ${selectedProduct.name}`)}`} target="_blank" rel="noopener noreferrer"
                              className={`flex items-center gap-1.5 px-3 py-2 text-xs border transition-colors ${isLightBg ? 'border-black/10 text-black/60 hover:bg-black/5' : 'border-white/10 text-white/50 hover:bg-white/5'}`}>
                              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                              WhatsApp
                            </a>
                          )}
                          {storeConfig?.storeInfo?.socialInstagram && (
                            <a href={storeConfig.storeInfo.socialInstagram.startsWith('http') ? storeConfig.storeInfo.socialInstagram : `https://instagram.com/${storeConfig.storeInfo.socialInstagram}`} target="_blank" rel="noopener noreferrer"
                              className={`flex items-center gap-1.5 px-3 py-2 text-xs border transition-colors ${isLightBg ? 'border-black/10 text-black/60 hover:bg-black/5' : 'border-white/10 text-white/50 hover:bg-white/5'}`}>
                              <Instagram className="w-3.5 h-3.5" />Instagram
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Desktop reviews */}
                <div className={`mt-16 pt-10 border-t ${isLightBg ? 'border-black/10' : 'border-white/8'}`}>
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xs text-white/40 uppercase tracking-widest">Reseñas del producto</h3>
                    <button onClick={() => { setShowReviewForm(p => !p); setReviewSuccess(false); setReviewError('') }}
                      className="text-xs text-amber-400 border border-amber-400/30 px-3 py-1.5 hover:bg-amber-400/10 transition-colors">
                      {showReviewForm ? 'Cancelar' : '+ Escribir reseña'}
                    </button>
                  </div>
                  {/* Review form */}
                  {showReviewForm && !reviewSuccess && (
                    <div className="mb-8 p-4 border border-white/10 bg-white/3 space-y-4">
                      <p className="text-sm text-white/60">Comparte tu experiencia con este producto</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-white/40 uppercase tracking-widest block mb-1">Tu nombre *</label>
                          <input
                            className="w-full bg-white/5 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-amber-400/50"
                            placeholder="Nombre"
                            value={reviewForm.reviewerName}
                            onChange={e => setReviewForm(p => ({ ...p, reviewerName: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-white/40 uppercase tracking-widest block mb-1">Email (opcional)</label>
                          <input
                            type="email"
                            className="w-full bg-white/5 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-amber-400/50"
                            placeholder="tu@email.com"
                            value={reviewForm.reviewerEmail}
                            onChange={e => setReviewForm(p => ({ ...p, reviewerEmail: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-white/40 uppercase tracking-widest block mb-2">Calificación *</label>
                        <div className="flex gap-1">
                          {[1,2,3,4,5].map(n => (
                            <button key={n} type="button" onClick={() => setReviewForm(p => ({ ...p, rating: n }))}>
                              <Star size={22} className={n <= reviewForm.rating ? 'fill-amber-400 text-amber-400' : 'text-white/20'} />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-white/40 uppercase tracking-widest block mb-1">Título (opcional)</label>
                        <input
                          className="w-full bg-white/5 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-amber-400/50"
                          placeholder="Resumen de tu reseña"
                          value={reviewForm.title}
                          onChange={e => setReviewForm(p => ({ ...p, title: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-white/40 uppercase tracking-widest block mb-1">Tu reseña</label>
                        <textarea
                          rows={3}
                          className="w-full bg-white/5 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-amber-400/50 resize-none"
                          placeholder="Cuéntanos qué te pareció el producto..."
                          value={reviewForm.body}
                          onChange={e => setReviewForm(p => ({ ...p, body: e.target.value }))}
                        />
                      </div>
                      {reviewError && <p className="text-red-400 text-xs">{reviewError}</p>}
                      <button
                        disabled={reviewSubmitting || !reviewForm.reviewerName.trim()}
                        onClick={async () => {
                          const tenantId = selectedProduct?.tenantId || stores.find(s => s.slug === selectedStore)?.id
                          if (!tenantId || !selectedProduct) {
                            setReviewError('No se pudo identificar la tienda. Intenta recargar la página.')
                            return
                          }
                          setReviewSubmitting(true)
                          setReviewError('')
                          const res = await api.createReview({
                            tenantId,
                            productId: String(selectedProduct.id),
                            reviewerName: reviewForm.reviewerName,
                            reviewerEmail: reviewForm.reviewerEmail || undefined,
                            rating: reviewForm.rating,
                            title: reviewForm.title || undefined,
                            body: reviewForm.body || undefined,
                          })
                          setReviewSubmitting(false)
                          if (res.success) {
                            setReviewSuccess(true)
                            setShowReviewForm(false)
                          } else {
                            setReviewError(res.error || 'Error al enviar la reseña')
                          }
                        }}
                        className="w-full py-3 text-sm uppercase tracking-[0.2em] font-semibold bg-amber-500 hover:bg-amber-400 text-black disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {reviewSubmitting ? 'Enviando…' : 'Enviar reseña'}
                      </button>
                    </div>
                  )}

                  {reviewSuccess && (
                    <div className="mb-8 p-4 border border-green-500/30 bg-green-500/10 text-green-400 text-sm">
                      Gracias por tu reseña. Sera revisada y publicada pronto.
                    </div>
                  )}

                  {/* Approved reviews list */}
                  {reviewsLoading ? (
                    <p className="text-white/30 text-sm">Cargando reseñas…</p>
                  ) : productReviews.length === 0 ? (
                    <p className="text-white/20 text-sm">Este producto aún no tiene reseñas. ¡Sé el primero!</p>
                  ) : (
                    <div className="space-y-4">
                      {productReviews.map((r: any) => (
                        <div key={r.id} className="p-4 border border-white/5 bg-white/2 space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div>
                              <span className="text-sm font-medium text-white/80">{r.reviewerName}</span>
                              <span className="text-xs text-white/30 ml-2">{new Date(r.createdAt).toLocaleDateString('es-CO')}</span>
                            </div>
                            <div className="flex gap-0.5">
                              {[1,2,3,4,5].map(n => (
                                <Star key={n} size={14} className={n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-white/15'} />
                              ))}
                            </div>
                          </div>
                          {r.title && <p className="text-sm font-medium text-white/70">{r.title}</p>}
                          {r.body && <p className="text-sm text-white/50 leading-relaxed">{r.body}</p>}
                          {(r.imageUrl1 || r.imageUrl2) && (
                            <div className="flex gap-2 mt-1">
                              {r.imageUrl1 && <img src={r.imageUrl1} alt="reseña" className="w-16 h-16 object-cover border border-white/10" />}
                              {r.imageUrl2 && <img src={r.imageUrl2} alt="reseña" className="w-16 h-16 object-cover border border-white/10" />}
                            </div>
                          )}
                          {r.reply && (
                            <div className="mt-2 pl-3 border-l-2 border-amber-400/40 text-xs text-white/40">
                              <span className="text-amber-400/70 font-medium">Respuesta de la tienda: </span>{r.reply}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Related products ── */}
                {relatedProducts.length > 0 && (
                  <div className="mt-20 pt-12 border-t border-white/5">
                    <h3 className="text-xs text-white/40 uppercase tracking-widest mb-8">Productos relacionados</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {relatedProducts.map(rp => {
                        const rpOffer = rp.isOnOffer && rp.offerPrice
                        return (
                          <button
                            key={rp.id}
                            onClick={() => openProductModal(rp)}
                            className="group text-left border border-white/5 hover:border-white/15 transition-all duration-300"
                          >
                            <div className="aspect-square overflow-hidden bg-black relative">
                              {rp.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={ensureAbsoluteUrl(rp.imageUrl)}
                                  alt={rp.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Sparkles className="w-8 h-8 text-white/10" />
                                </div>
                              )}
                              {rpOffer && (
                                <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5">
                                  -{Math.round(((rp.salePrice - rp.offerPrice!) / rp.salePrice) * 100)}%
                                </div>
                              )}
                            </div>
                            <div className="p-3 space-y-1">
                              {rp.brand && <p className="text-[10px] text-white/40 uppercase tracking-wider truncate">{rp.brand}</p>}
                              <p className="text-sm text-white/80 font-light leading-snug line-clamp-2">{rp.name}</p>
                              <p className={`text-sm font-light ${isLightBg ? 'text-black' : 'text-white/70'}`}>
                                {rpOffer ? formatCOP(rp.offerPrice!) : formatCOP(rp.salePrice)}
                              </p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        )
      })()}

      {/* ========== CATALOG VIEW ========== */}
      {showCatalog && !showProductModal && (
        <div className="pt-16 min-h-screen" style={{ backgroundColor: effectiveBgColor }}>
          <div className="flex">
            {/* LEFT SIDEBAR — Desktop */}
            <aside className="hidden lg:block w-72 shrink-0 border-r border-white/10 landing-sidebar sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
              <CatalogSidebar
                categories={categories}
                availableBrands={availableBrands}
                availableGenders={availableGenders}
                availableSizes={availableSizes}
                selectedCategories={catalogSelectedCategories}
                setSelectedCategories={setCatalogSelectedCategories}
                selectedBrands={catalogSelectedBrands}
                setSelectedBrands={setCatalogSelectedBrands}
                selectedGenders={catalogSelectedGenders}
                setSelectedGenders={setCatalogSelectedGenders}
                selectedSizes={catalogSelectedSizes}
                setSelectedSizes={setCatalogSelectedSizes}
                priceMin={catalogPriceMin}
                priceMax={catalogPriceMax}
                setPriceMin={setCatalogPriceMin}
                setPriceMax={setCatalogPriceMax}
                onClear={clearCatalogFilters}
              />
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 min-w-0">
              {/* Header */}
              <div className="sticky top-16 z-10 landing-sidebar-blur backdrop-blur-sm border-b border-white/10 px-4 sm:px-6 lg:px-8 py-4">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <h1 className="text-xl sm:text-2xl font-light text-white tracking-wide">
                    {sedesViewMode && !activeSede ? 'Sedes'
                      : sedesViewMode && activeSede ? (storeSedes.find(s => s.id === activeSede)?.name ?? 'Sede')
                      : catalogSpecialFilter === 'trending' ? 'Tendencia'
                      : catalogSpecialFilter === 'featured' ? 'Productos Destacados'
                      : catalogSpecialFilter === 'offers' ? 'Ofertas'
                      : catalogSelectedCategories.size === 1 ? Array.from(catalogSelectedCategories)[0]
                      : 'Catálogo'}
                  </h1>
                  <div className="flex items-center gap-3">
                    {selectedStore === 'all' && !sedesViewMode && <span className="text-xs text-white/40">{stores.filter(s => businessTypeFilter === 'all' || s.businessType === businessTypeFilter).length} comercio{stores.filter(s => businessTypeFilter === 'all' || s.businessType === businessTypeFilter).length !== 1 ? 's' : ''}</span>}
                    {selectedStore !== 'all' && !(sedesViewMode && !activeSede) && <span className="text-xs text-white/40">{catalogFilteredProducts.length} producto{catalogFilteredProducts.length !== 1 ? 's' : ''}</span>}
                    {sedesViewMode && !activeSede && <span className="text-xs text-white/40">{storeSedes.length} sede{storeSedes.length !== 1 ? 's' : ''}</span>}
                    {/* Mobile filter toggle */}
                    <button
                      onClick={() => setCatalogSidebarOpen(true)}
                      className="lg:hidden flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 text-white text-xs hover:bg-white/10 transition-colors"
                    >
                      <Target className="w-4 h-4" />
                      Filtros
                    </button>
                  </div>
                </div>
                {/* Search bar (hidden in sede picker view and all-stores view) */}
                {!(sedesViewMode && !activeSede) && selectedStore !== 'all' && <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="text"
                    placeholder="Buscar productos..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 text-white placeholder-white/30 font-light text-sm focus:border-amber-500/50 focus:outline-none"
                  />
                </div>}
                {/* Sede selector (only when store has 2+ sedes and not in sedes view mode or a sede is active) */}
                {storeSedes.length >= 2 && (!sedesViewMode || activeSede) && (
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {sedesViewMode && activeSede && (
                      <button
                        onClick={() => setActiveSede(null)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-white/50 hover:text-white transition-colors"
                      >
                        <ArrowLeft className="w-3 h-3" />
                        Sedes
                      </button>
                    )}
                    {!sedesViewMode && <span className="text-xs text-white/40 uppercase tracking-wider">Sede:</span>}
                    {!sedesViewMode && (
                      <button
                        onClick={() => setActiveSede(null)}
                        className={`px-3 py-1 text-xs rounded-full border transition-colors ${activeSede === null ? 'bg-amber-500 border-amber-500 text-black font-medium' : 'border-white/20 text-white/60 hover:border-white/40 hover:text-white'}`}
                      >
                        Todas
                      </button>
                    )}
                    {storeSedes.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setActiveSede(activeSede === s.id ? (sedesViewMode ? null : null) : s.id)}
                        className={`px-3 py-1 text-xs rounded-full border transition-colors ${activeSede === s.id ? 'bg-amber-500 border-amber-500 text-black font-medium' : 'border-white/20 text-white/60 hover:border-white/40 hover:text-white'}`}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
                {/* Active filter pills */}
                {(catalogSelectedCategories.size > 0 || catalogSelectedBrands.size > 0 || catalogSelectedGenders.size > 0 || catalogSelectedSizes.size > 0 || catalogPriceMin > 0 || catalogPriceMax > 0) && (
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    {Array.from(catalogSelectedCategories).map(v => (
                      <FilterPill key={`cat-${v}`} label={v} onRemove={() => { const s = new Set(catalogSelectedCategories); s.delete(v); setCatalogSelectedCategories(s) }} />
                    ))}
                    {Array.from(catalogSelectedBrands).map(v => (
                      <FilterPill key={`brand-${v}`} label={v} onRemove={() => { const s = new Set(catalogSelectedBrands); s.delete(v); setCatalogSelectedBrands(s) }} />
                    ))}
                    {Array.from(catalogSelectedGenders).map(v => (
                      <FilterPill key={`gender-${v}`} label={v} onRemove={() => { const s = new Set(catalogSelectedGenders); s.delete(v); setCatalogSelectedGenders(s) }} />
                    ))}
                    {Array.from(catalogSelectedSizes).map(v => (
                      <FilterPill key={`size-${v}`} label={v} onRemove={() => { const s = new Set(catalogSelectedSizes); s.delete(v); setCatalogSelectedSizes(s) }} />
                    ))}
                    {(catalogPriceMin > 0 || catalogPriceMax > 0) && (
                      <FilterPill label={`${catalogPriceMin > 0 ? formatCOP(catalogPriceMin) : '$0'} — ${catalogPriceMax > 0 ? formatCOP(catalogPriceMax) : '∞'}`} onRemove={() => { setCatalogPriceMin(0); setCatalogPriceMax(0) }} />
                    )}
                    <button onClick={clearCatalogFilters} className="text-[10px] text-amber-400 hover:text-amber-300 uppercase tracking-wider ml-2">Limpiar todo</button>
                  </div>
                )}
              </div>

              {/* Products Grid */}
              <div className="px-4 sm:px-6 lg:px-8 py-6">

                {/* ── Mobile category quick-filter (only inside a specific store, sidebar is hidden on mobile) ── */}
                {selectedStore !== 'all' && !sedesViewMode && categories.length > 0 && (
                  <div className="lg:hidden mb-4 -mx-4 px-4 overflow-x-auto scrollbar-hide">
                    <div className="flex gap-2 pb-2">
                      <button
                        onClick={() => setCatalogSelectedCategories(new Set())}
                        className={`shrink-0 px-3 py-1.5 text-[11px] uppercase tracking-widest rounded-full border transition-all ${
                          catalogSelectedCategories.size === 0
                            ? 'bg-amber-500 border-amber-500 text-black font-medium'
                            : 'border-white/20 text-white/50 hover:border-white/40 hover:text-white'
                        }`}
                      >
                        Todos
                      </button>
                      {categories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => {
                            const next = new Set<string>([cat])
                            setCatalogSelectedCategories(
                              catalogSelectedCategories.has(cat) && catalogSelectedCategories.size === 1 ? new Set() : next
                            )
                          }}
                          className={`shrink-0 px-3 py-1.5 text-[11px] uppercase tracking-widest rounded-full border transition-all ${
                            catalogSelectedCategories.has(cat)
                              ? 'bg-amber-500 border-amber-500 text-black font-medium'
                              : 'border-white/20 text-white/50 hover:border-white/40 hover:text-white'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── ALL-STORES CATALOG: grouped by business type ── */}
                {selectedStore === 'all' && !sedesViewMode ? (
                  <div className="space-y-10">
                    {/* Business type filter pills */}
                    {(() => {
                      const types = Array.from(new Set(stores.map(s => s.businessType).filter(Boolean))) as string[]
                      return types.length > 1 ? (
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => setBusinessTypeFilter('all')}
                            className={`px-4 py-1.5 text-xs uppercase tracking-wider border transition-colors ${businessTypeFilter === 'all' ? 'bg-amber-500 border-amber-500 text-black font-medium' : 'border-white/20 text-white/50 hover:border-white/40 hover:text-white'}`}
                          >
                            Todos
                          </button>
                          {types.map(t => (
                            <button
                              key={t}
                              onClick={() => setBusinessTypeFilter(businessTypeFilter === t ? 'all' : t)}
                              className={`px-4 py-1.5 text-xs uppercase tracking-wider border transition-colors ${businessTypeFilter === t ? 'bg-amber-500 border-amber-500 text-black font-medium' : 'border-white/20 text-white/50 hover:border-white/40 hover:text-white'}`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      ) : null
                    })()}

                    {loadingAllProducts ? (
                      <div className="text-center py-20">
                        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-white/40 text-sm font-light">Cargando catálogo...</p>
                      </div>
                    ) : (() => {
                      const types = Array.from(new Set(
                        stores
                          .filter(s => businessTypeFilter === 'all' || s.businessType === businessTypeFilter)
                          .map(s => s.businessType || 'General')
                      ))
                      return types.map(type => {
                        const typeStores = stores.filter(s => (s.businessType || 'General') === type && (businessTypeFilter === 'all' || s.businessType === businessTypeFilter))
                        if (typeStores.length === 0) return null
                        return (
                          <div key={type} className="space-y-4">
                            {/* Category section header */}
                            <div className="flex items-center gap-4">
                              <div className="h-px flex-1 bg-white/5" />
                              <div className="flex items-center gap-2">
                                <Store className="w-3 h-3 text-amber-500/60" />
                                <span className="text-[10px] uppercase tracking-[0.3em] text-amber-500/70 font-light">{type}</span>
                                <span className="text-[10px] text-white/20">· {typeStores.length} comercio{typeStores.length !== 1 ? 's' : ''}</span>
                              </div>
                              <div className="h-px flex-1 bg-white/5" />
                            </div>

                            {/* Store cards for this type */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                              {typeStores
                                .sort((a, b) => (b.productCount > 0 ? 1 : 0) - (a.productCount > 0 ? 1 : 0))
                                .map(store => {
                                const storeProds = allProducts.filter(p =>
                                  p.storeSlug === store.slug ||
                                  p.storeName === store.name
                                )
                                const preview = storeProds.slice(0, 4)
                                const isDarkEmpty = store.productCount === 0
                                return (
                                  <div
                                    key={store.id}
                                    className={`group relative bg-white/[0.03] border border-white/8 transition-all duration-300 overflow-hidden ${isDarkEmpty ? 'cursor-default opacity-60' : 'hover:border-amber-500/30 hover:bg-white/[0.05] cursor-pointer'}`}
                                    onClick={() => {
                                      if (isDarkEmpty) return
                                      setSelectedStore(store.slug)
                                      setBusinessTypeFilter('all')
                                    }}
                                  >
                                    {isDarkEmpty && (
                                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/50 backdrop-blur-[1px]">
                                        <span style={{ fontSize: '1.4rem', lineHeight: 1, marginBottom: '0.3rem' }}>🚧</span>
                                        <p style={{ color: '#fbbf24', fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Próximamente</p>
                                      </div>
                                    )}
                                    {/* Store header */}
                                    <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                                      <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                                        {store.logoUrl ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img src={store.logoUrl} alt={store.name} className="w-full h-full object-cover" />
                                        ) : (
                                          <Store className="w-4 h-4 text-white/30" />
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-white text-sm font-medium leading-tight truncate">{store.name}</p>
                                        <p className="text-white/30 text-[10px] uppercase tracking-wider mt-0.5">{storeProds.length} producto{storeProds.length !== 1 ? 's' : ''}</p>
                                      </div>
                                      <ArrowRight className="w-3.5 h-3.5 text-white/20 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                                    </div>

                                    {/* Product preview strip */}
                                    {preview.length > 0 ? (
                                      <div className="grid grid-cols-4 gap-px bg-white/5">
                                        {preview.map((p, i) => (
                                          <div key={p.id} className="relative aspect-square bg-black/40 overflow-hidden">
                                            {p.imageUrl ? (
                                              // eslint-disable-next-line @next/next/no-img-element
                                              <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                            ) : (
                                              <div className="w-full h-full flex items-center justify-center">
                                                <Package className="w-4 h-4 text-white/10" />
                                              </div>
                                            )}
                                            {i === 3 && storeProds.length > 4 && (
                                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                                <span className="text-white text-xs font-medium">+{storeProds.length - 4}</span>
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                        {Array.from({ length: Math.max(0, 4 - preview.length) }).map((_, i) => (
                                          <div key={`empty-${i}`} className="aspect-square bg-black/20" />
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="h-16 bg-white/[0.01] flex items-center justify-center border-t border-white/5">
                                        <p className="text-white/15 text-[10px] uppercase tracking-wider">Sin productos</p>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })
                    })()}
                  </div>

                ) : (
                /* Sede Picker View */
                sedesViewMode && !activeSede ? (
                  <div className="space-y-8">
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-white/5" />
                      <p className="text-white/30 text-xs font-light tracking-[0.2em] uppercase">Selecciona una sede</p>
                      <div className="h-px flex-1 bg-white/5" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {storeSedes.map((sede, idx) => {
                        const exclusiveCount = products.filter(p => p.sedeId === sede.id).length
                        const sharedCount = products.filter(p => !p.sedeId).length
                        return (
                          <button
                            key={sede.id}
                            onClick={() => setActiveSede(sede.id)}
                            className={`group relative flex flex-col gap-5 p-6 bg-white/[0.03] border ${isLightBg ? 'border-black/10 hover:border-black/30 hover:bg-black/[0.03]' : 'border-white/8 hover:border-white/20 hover:bg-white/[0.06]'} transition-all duration-300 text-left rounded-2xl overflow-hidden`}
                          >
                            {/* Ambient glow on hover */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${isLightBg ? 'group-hover:from-black/3' : 'group-hover:from-white/3'} to-transparent transition-all duration-500 rounded-2xl pointer-events-none`} />
                            {/* Corner number */}
                            <span className={`absolute top-4 right-5 text-[40px] font-bold ${isLightBg ? 'text-black/[0.04] group-hover:text-black/10' : 'text-white/[0.04] group-hover:text-white/10'} leading-none select-none transition-colors`}>
                              {String(idx + 1).padStart(2, '0')}
                            </span>

                            {/* Icon + arrow row */}
                            <div className="flex items-center justify-between w-full">
                              <div className={`w-11 h-11 rounded-xl ${isLightBg ? 'bg-black/5 border border-black/10 group-hover:bg-black/10 group-hover:border-black/20' : 'bg-white/5 border border-white/10 group-hover:bg-white/10 group-hover:border-white/20'} flex items-center justify-center transition-all duration-300`}>
                                <MapPin className={`w-5 h-5 ${isLightBg ? 'text-black/60' : 'text-white/60'}`} />
                              </div>
                              <div className={`w-8 h-8 rounded-full border ${isLightBg ? 'border-black/10 group-hover:border-black/30 group-hover:bg-black/5' : 'border-white/8 group-hover:border-white/30 group-hover:bg-white/5'} flex items-center justify-center transition-all duration-300`}>
                                <ArrowRight className={`w-3.5 h-3.5 ${isLightBg ? 'text-black/20 group-hover:text-black group-hover:translate-x-0.5' : 'text-white/20 group-hover:text-white group-hover:translate-x-0.5'} transition-all`} />
                              </div>
                            </div>

                            {/* Name & address */}
                            <div className="flex-1">
                              <p className={`${isLightBg ? 'text-black' : 'text-white'} font-semibold tracking-wide uppercase text-sm leading-tight`}>{sede.name}</p>
                              {sede.address && (
                                <p className={`${isLightBg ? 'text-black/40' : 'text-white/35'} text-xs mt-1.5 leading-relaxed`}>{sede.address}</p>
                              )}
                            </div>

                            {/* Stats divider */}
                            <div className={`flex items-center gap-0 border-t ${isLightBg ? 'border-black/5' : 'border-white/5'} pt-4 w-full`}>
                              <div className="flex-1 text-center">
                                <p className={`${isLightBg ? 'text-black' : 'text-white'} font-bold text-lg leading-none`}>{exclusiveCount}</p>
                                <p className={`${isLightBg ? 'text-black/25' : 'text-white/25'} text-[10px] mt-1 uppercase tracking-wider`}>Exclusivos</p>
                              </div>
                              <div className={`w-px h-8 ${isLightBg ? 'bg-black/8' : 'bg-white/8'} mx-2`} />
                              <div className="flex-1 text-center">
                                <p className={`${isLightBg ? 'text-black/50' : 'text-white/50'} font-bold text-lg leading-none`}>{sharedCount}</p>
                                <p className={`${isLightBg ? 'text-black/25' : 'text-white/25'} text-[10px] mt-1 uppercase tracking-wider`}>Compartidos</p>
                              </div>
                              <div className={`w-px h-8 ${isLightBg ? 'bg-black/8' : 'bg-white/8'} mx-2`} />
                              <div className="flex-1 text-center">
                                <p className={`${isLightBg ? 'text-black/70' : 'text-white/70'} font-bold text-lg leading-none`}>{exclusiveCount + sharedCount}</p>
                                <p className={`${isLightBg ? 'text-black/25' : 'text-white/25'} text-[10px] mt-1 uppercase tracking-wider`}>Total</p>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                    {/* General products banner */}
                    {products.filter(p => !p.sedeId).length > 0 && (
                      <div className="flex items-center gap-4 px-5 py-4 rounded-xl bg-white/[0.02] border border-white/5">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                          <Store className="w-4 h-4 text-white/30" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-white/40 text-xs uppercase tracking-wider">Disponibles en todas las sedes</span>
                          <p className="text-white/20 text-[11px] mt-0.5">Estos productos están disponibles sin importar qué sede selecciones.</p>
                        </div>
                        <span className="text-white/30 text-sm font-semibold flex-shrink-0">{products.filter(p => !p.sedeId).length}</span>
                      </div>
                    )}
                  </div>
                ) : loadingProducts ? (
                  <div className="text-center py-20">
                    <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-white/40 text-sm font-light">Cargando productos...</p>
                  </div>
                ) : selectedStore !== 'all' && products.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
                    <div style={{ fontSize: '4rem', lineHeight: 1, marginBottom: '1.5rem' }}>🚧</div>
                    <p style={{ color: '#fbbf24', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
                      PRÓXIMAMENTE
                    </p>
                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.9rem', maxWidth: '320px', lineHeight: 1.6 }}>
                      Este comercio está preparando su catálogo. Vuelve pronto para descubrir sus productos.
                    </p>
                    <div style={{ marginTop: '2rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#fbbf24', animation: 'pulse 1.5s infinite' }} />
                      <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#fbbf24', animation: 'pulse 1.5s infinite 0.3s' }} />
                      <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#fbbf24', animation: 'pulse 1.5s infinite 0.6s' }} />
                    </div>
                  </div>
                ) : catalogFilteredProducts.length === 0 ? (
                  <div className="text-center py-20">
                    <Sparkles className="w-12 h-12 text-white/10 mx-auto mb-4" />
                    <p className="text-white/40 text-sm font-light">No se encontraron productos con estos filtros</p>
                    <button onClick={clearCatalogFilters} className="mt-4 text-amber-400 text-sm font-light hover:text-amber-300 transition-colors underline underline-offset-4">
                      Limpiar filtros
                    </button>
                  </div>
                ) : (
                  <div className={`grid gap-3 sm:gap-4 ${productCardStyle === 'style2' ? 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4'}`}>
                    {catalogFilteredProducts.map(product => {
                      const inCart = carrito.find(c => c.id === product.id)
                      const isOffer = product.isOnOffer && product.offerPrice
                      const discount = isOffer ? Math.round(((product.salePrice - product.offerPrice!) / product.salePrice) * 100) : 0

                      if (productCardStyle === 'style2') {
                        return (
                          <div
                            key={product.id}
                            className="group relative bg-white rounded-lg overflow-hidden shadow-sm border border-gray-100 cursor-pointer hover:shadow-lg transition-all duration-300"
                            onClick={() => openProductModal(product)}
                          >
                            {/* Image area */}
                            <div className="relative aspect-[4/3] sm:aspect-square overflow-hidden bg-gray-50">
                              {product.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={ensureAbsoluteUrl(product.imageUrl)} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Package className="w-10 h-10 text-gray-300" />
                                </div>
                              )}

                              {/* Discount badge */}
                              {isOffer && (
                                <div className="absolute top-2 left-2 z-20 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-sm">
                                  -{discount}%
                                </div>
                              )}

                              {/* In-cart indicator */}
                              {inCart && (
                                <div className="absolute top-2 right-2 z-20 flex items-center gap-0.5 bg-amber-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-sm">
                                  <ShoppingCart className="w-2.5 h-2.5" />×{inCart.cantidad}
                                </div>
                              )}

                              {/* Hover action icons overlay */}
                              <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-3 z-10">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); agregarAlCarrito(product) }}
                                    className="w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center text-gray-700 hover:bg-amber-500 hover:text-white transition-colors"
                                    title="Agregar al carrito"
                                  >
                                    <ShoppingCart className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); openProductModal(product) }}
                                    className="w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center text-gray-700 hover:bg-gray-800 hover:text-white transition-colors"
                                    title="Ver detalle"
                                  >
                                    <Search className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); openProductModal(product) }}
                                    className="w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center text-gray-700 hover:bg-gray-800 hover:text-white transition-colors"
                                    title="Comparar"
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleFavorite(product.id) }}
                                    className={`w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center transition-colors ${favorites.has(product.id) ? 'text-red-500' : 'text-gray-700 hover:text-red-500'}`}
                                    title="Favorito"
                                  >
                                    <Heart className={`w-4 h-4 ${favorites.has(product.id) ? 'fill-current' : ''}`} />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Card info */}
                            <div className="p-3">
                              <h3 className="text-xs sm:text-sm font-medium text-gray-800 line-clamp-2 mb-1 leading-snug">
                                {product.name}
                              </h3>
                              <div className="flex items-center gap-2 mb-1">
                                {isOffer ? (
                                  <>
                                    <span className="text-gray-400 text-xs line-through">{formatCOP(product.salePrice)}</span>
                                    <span className="text-gray-900 font-bold text-sm">{formatCOP(product.offerPrice!)}</span>
                                  </>
                                ) : (
                                  <span className="text-gray-900 font-bold text-sm">{formatCOP(product.salePrice)}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-gray-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                                1 Opción disponible
                              </div>
                            </div>
                          </div>
                        )
                      }

                      // Style 1 — original dark card
                      return (
                        <div
                          key={product.id}
                          className="group relative overflow-hidden cursor-pointer hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/60 transition-all duration-500"
                          onClick={() => openProductModal(product)}
                        >
                          {/* Image — portrait ratio */}
                          <div data-dark className="relative aspect-[3/4] overflow-hidden bg-black/60">
                            {product.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={ensureAbsoluteUrl(product.imageUrl)} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-white/3">
                                <Sparkles className="w-10 h-10 text-white/10" />
                              </div>
                            )}

                            {/* Permanent bottom gradient for readability */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                            {/* Offer badge — top left */}
                            {isOffer && (
                              <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1 bg-gradient-to-r from-red-600 to-orange-500 text-white text-[10px] font-bold px-2 py-0.5 shadow-lg shadow-red-900/40">
                                <Flame className="w-2.5 h-2.5" />
                                -{discount}%
                              </div>
                            )}

                            {/* Brand tag — top right */}
                            {product.brand && (
                              <div className="absolute top-2.5 right-2.5 z-20 px-2 py-0.5 text-[9px] text-white/60 uppercase tracking-[0.2em]">
                                {product.brand}
                              </div>
                            )}

                            {/* In-cart indicator */}
                            {inCart && (
                              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-amber-500 text-black text-[9px] font-bold px-2 py-0.5">
                                <ShoppingCart className="w-2.5 h-2.5" />
                                ×{inCart.cantidad}
                              </div>
                            )}

                            {/* Favorite — always visible */}
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleFavorite(product.id) }}
                              className={`absolute bottom-[56px] right-2.5 z-20 w-7 h-7 flex items-center justify-center transition-all duration-300 ${favorites.has(product.id) ? 'text-red-500' : 'text-white/50 hover:text-red-400'}`}
                              title="Favorito"
                            >
                              <Heart className={`w-3 h-3 ${favorites.has(product.id) ? 'fill-current' : ''}`} />
                            </button>

                            {/* Info overlay */}
                            <div className="absolute bottom-0 left-0 right-0 z-10 px-3 pt-2 pb-[52px]">
                              <h3 className="text-xs sm:text-sm font-light text-white leading-snug line-clamp-2 mb-1">
                                {product.name}
                              </h3>
                              {product.size && <p className="text-[9px] text-white/35 mb-1">{product.size}</p>}
                              <div className="flex items-center gap-2">
                                {isOffer ? (
                                  <>
                                    <span className="text-orange-400 font-semibold text-sm">{formatCOP(product.offerPrice!)}</span>
                                    <span className="text-white/30 text-xs line-through">{formatCOP(product.salePrice)}</span>
                                  </>
                                ) : (
                                  <span className="text-amber-400 font-light text-sm">{formatCOP(product.salePrice)}</span>
                                )}
                              </div>
                            </div>

                            {/* Action bar — slides up from bottom */}
                            <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center gap-0 translate-y-0 sm:translate-y-full sm:group-hover:translate-y-0 transition-transform duration-300 ease-out">
                              <button
                                onClick={(e) => { e.stopPropagation(); agregarAlCarrito(product) }}
                                className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-amber-500/70 hover:bg-amber-500/90 text-black text-[9px] font-semibold uppercase tracking-wider transition-colors"
                              >
                                <ShoppingCart className="w-3 h-3" />
                                Añadir
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); openProductModal(product) }}
                                className="w-10 h-full flex items-center justify-center text-white/70 hover:text-white transition-all"
                                title="Ver detalle"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </main>
          </div>

          {/* Mobile Sidebar Overlay */}
          {catalogSidebarOpen && (
            <>
              <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm lg:hidden" onClick={() => setCatalogSidebarOpen(false)} />
              <div className="fixed top-0 left-0 h-full w-[300px] landing-sidebar border-r border-white/10 z-[70] overflow-y-auto lg:hidden">
                <div className="sticky top-0 landing-sidebar border-b border-white/10 p-4 flex items-center justify-between">
                  <h3 className="text-sm uppercase tracking-wider text-white">Filtros</h3>
                  <button onClick={() => setCatalogSidebarOpen(false)} className="text-white/50 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <CatalogSidebar
                  categories={categories}
                  availableBrands={availableBrands}
                  availableGenders={availableGenders}
                  availableSizes={availableSizes}
                  selectedCategories={catalogSelectedCategories}
                  setSelectedCategories={setCatalogSelectedCategories}
                  selectedBrands={catalogSelectedBrands}
                  setSelectedBrands={setCatalogSelectedBrands}
                  selectedGenders={catalogSelectedGenders}
                  setSelectedGenders={setCatalogSelectedGenders}
                  selectedSizes={catalogSelectedSizes}
                  setSelectedSizes={setCatalogSelectedSizes}
                  priceMin={catalogPriceMin}
                  priceMax={catalogPriceMax}
                  setPriceMin={setCatalogPriceMin}
                  setPriceMax={setCatalogPriceMax}
                  onClear={clearCatalogFilters}
                />
                <div className="sticky bottom-0 p-4 border-t border-white/10 landing-sidebar">
                  <button
                    onClick={() => setCatalogSidebarOpen(false)}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-black py-3 text-xs uppercase tracking-wider font-medium transition-colors"
                  >
                    Ver {catalogFilteredProducts.length} producto{catalogFilteredProducts.length !== 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========== NUEVOS LANZAMIENTOS VIEW ========== */}
      {showNewLaunches && !showProductModal && (
        <div className="pt-16 min-h-screen" style={{ backgroundColor: effectiveBgColor }}>
          {/* Hero header */}
          <div className="relative overflow-hidden border-b border-red-500/20">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-1/4 w-96 h-32 bg-red-500 rounded-full blur-[80px]" />
              <div className="absolute top-0 right-1/4 w-72 h-32 bg-red-400 rounded-full blur-[60px]" />
            </div>
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/30 px-3 py-1.5 rounded-full">
                    <Sparkles className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                    <span className="text-red-400 uppercase tracking-[0.3em] text-[10px] font-medium">Recién Llegados</span>
                  </div>
                  <h1 className="text-3xl sm:text-5xl font-extralight tracking-tight">
                    <span className="bg-gradient-to-r from-red-400 via-red-400 to-red-500 bg-clip-text text-transparent">
                      Nuevos Lanzamientos
                    </span>
                  </h1>
                  <p className="text-white/40 text-sm font-light">
                    {storeConfig?.newLaunches?.length ?? 0} producto{(storeConfig?.newLaunches?.length ?? 0) !== 1 ? 's' : ''} recién incorporados
                  </p>
                </div>
                <button
                  onClick={() => { setShowNewLaunches(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 uppercase tracking-wider transition-colors self-start sm:self-auto"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Volver
                </button>
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div className="sticky top-16 z-10 landing-sidebar-blur backdrop-blur-sm border-b border-white/10 px-4 sm:px-6 lg:px-8 py-3">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400/50" />
              <input
                type="text"
                placeholder="Buscar en nuevos lanzamientos..."
                value={newLaunchSearch}
                onChange={e => setNewLaunchSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-red-500/5 border border-red-500/20 text-white placeholder-white/30 font-light text-sm focus:border-red-500/50 focus:outline-none"
              />
            </div>
          </div>

          {/* Products grid */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {(() => {
              const launches = (storeConfig?.newLaunches ?? []).filter(p =>
                !newLaunchSearch ||
                p.name.toLowerCase().includes(newLaunchSearch.toLowerCase()) ||
                (p.brand && p.brand.toLowerCase().includes(newLaunchSearch.toLowerCase())) ||
                (p.category && p.category.toLowerCase().includes(newLaunchSearch.toLowerCase()))
              )
              if (launches.length === 0) {
                return (
                  <div className="text-center py-24">
                    <Sparkles className="w-12 h-12 text-red-500/20 mx-auto mb-4" />
                    <p className="text-white/40 text-sm font-light">
                      {newLaunchSearch ? 'No se encontraron lanzamientos con esa búsqueda' : 'No hay nuevos lanzamientos disponibles'}
                    </p>
                    {newLaunchSearch && (
                      <button onClick={() => setNewLaunchSearch('')} className="mt-4 text-red-400 text-sm hover:text-red-300 transition-colors underline underline-offset-4">
                        Limpiar búsqueda
                      </button>
                    )}
                  </div>
                )
              }
              return (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {launches.map(product => {
                    const inCart = carrito.find(c => c.id === product.id)
                    const isOffer = product.isOnOffer && product.offerPrice
                    const discount = isOffer ? Math.round(((product.salePrice - product.offerPrice!) / product.salePrice) * 100) : 0
                    return (
                      <div
                        key={product.id}
                        className="group relative overflow-hidden cursor-pointer hover:-translate-y-1 hover:shadow-2xl hover:shadow-red-900/40 transition-all duration-500"
                        onClick={() => openProductModal(product)}
                      >
                        <div data-dark className="relative aspect-[3/4] overflow-hidden bg-black/60">
                          {product.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={ensureAbsoluteUrl(product.imageUrl)} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-red-900/20">
                              <Sparkles className="w-10 h-10 text-white/10" />
                            </div>
                          )}

                          {/* Gradient */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                          {/* New badge */}
                          <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1 bg-gradient-to-r from-red-600 to-red-400 text-white text-[9px] font-bold px-2 py-0.5 shadow-lg shadow-red-900/40">
                            <Sparkles className="w-2.5 h-2.5" />
                            NUEVO
                          </div>

                          {/* Offer badge */}
                          {isOffer && (
                            <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 bg-gradient-to-r from-red-600 to-orange-500 text-white text-[9px] font-bold px-2 py-0.5">
                              <Flame className="w-2.5 h-2.5" />
                              -{discount}%
                            </div>
                          )}

                          {/* Brand */}
                          {product.brand && !isOffer && (
                            <div className="absolute top-2.5 right-2.5 z-20 px-2 py-0.5 text-[9px] text-white/55 uppercase tracking-[0.2em]">
                              {product.brand}
                            </div>
                          )}

                          {/* In-cart */}
                          {inCart && (
                            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-amber-500 text-black text-[9px] font-bold px-2 py-0.5">
                              <ShoppingCart className="w-2.5 h-2.5" />
                              ×{inCart.cantidad}
                            </div>
                          )}

                          {/* Favorite */}
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(product.id) }}
                            className={`absolute bottom-[56px] right-2.5 z-20 w-7 h-7 flex items-center justify-center transition-all duration-300 ${favorites.has(product.id) ? 'text-red-500' : 'text-white/50 hover:text-red-400'}`}
                            title="Favorito"
                          >
                            <Heart className={`w-3 h-3 ${favorites.has(product.id) ? 'fill-current' : ''}`} />
                          </button>

                          {/* Info overlay */}
                          <div className="absolute bottom-0 left-0 right-0 z-10 px-3 pt-2 pb-[52px]">
                            <h3 className="text-xs sm:text-sm font-light text-white leading-snug line-clamp-2 mb-1">{product.name}</h3>
                            {product.size && <p className="text-[9px] text-white/35 mb-1">{product.size}</p>}
                            <div className="flex items-center gap-2">
                              {isOffer ? (
                                <>
                                  <span className="text-orange-400 font-semibold text-sm">{formatCOP(product.offerPrice!)}</span>
                                  <span className="text-white/30 text-xs line-through">{formatCOP(product.salePrice)}</span>
                                </>
                              ) : (
                                <span className="text-amber-400 font-light text-sm">{formatCOP(product.salePrice)}</span>
                              )}
                            </div>
                          </div>

                          {/* Action bar */}
                          <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center gap-0 translate-y-0 sm:translate-y-full sm:group-hover:translate-y-0 transition-transform duration-300 ease-out">
                            <button
                              onClick={(e) => { e.stopPropagation(); agregarAlCarrito(product) }}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-amber-500/70 hover:bg-amber-500/90 text-black text-[9px] font-semibold uppercase tracking-wider transition-colors"
                            >
                              <ShoppingCart className="w-3 h-3" />
                              Añadir
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); openProductModal(product) }}
                              className="w-10 h-full flex items-center justify-center text-white/70 hover:text-white transition-all"
                              title="Ver detalle"
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* ========== OFERTAS VIEW ========== */}
      {showOffers && !showProductModal && (
        <div className="pt-16 min-h-screen" style={{ backgroundColor: effectiveBgColor }}>
          {/* Header */}
          <div className="relative overflow-hidden border-b border-orange-500/20">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-1/4 w-96 h-32 bg-orange-500 rounded-full blur-[80px]" />
              <div className="absolute top-0 right-1/4 w-72 h-32 bg-red-500 rounded-full blur-[60px]" />
            </div>
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 px-3 py-1.5 rounded-full">
                    <Flame className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
                    <span className="text-orange-400 uppercase tracking-[0.3em] text-[10px] font-medium">Precios Especiales</span>
                  </div>
                  <h1 className="text-3xl sm:text-5xl font-extralight tracking-tight">
                    <span className="bg-gradient-to-r from-orange-400 via-orange-400 to-red-500 bg-clip-text text-transparent">
                      Ofertas
                    </span>
                  </h1>
                  <p className="text-white/40 text-sm font-light">
                    {offerProducts.length} producto{offerProducts.length !== 1 ? 's' : ''} en oferta
                  </p>
                </div>
                <button
                  onClick={() => { setShowOffers(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 uppercase tracking-wider transition-colors self-start sm:self-auto"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Volver
                </button>
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div className="sticky top-16 z-10 landing-sidebar-blur backdrop-blur-sm border-b border-white/10 px-4 sm:px-6 lg:px-8 py-3">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400/50" />
              <input
                type="text"
                placeholder="Buscar en ofertas..."
                value={offerSearch}
                onChange={e => setOfferSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-orange-500/5 border border-orange-500/20 text-white placeholder-white/30 font-light text-sm focus:border-orange-500/50 focus:outline-none"
              />
            </div>
          </div>

          {/* Products grid */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {(() => {
              const filtered = offerProducts.filter(p =>
                !offerSearch ||
                p.name.toLowerCase().includes(offerSearch.toLowerCase()) ||
                (p.brand && p.brand.toLowerCase().includes(offerSearch.toLowerCase())) ||
                (p.category && p.category.toLowerCase().includes(offerSearch.toLowerCase()))
              )
              if (filtered.length === 0) {
                return (
                  <div className="text-center py-24">
                    <Flame className="w-12 h-12 text-orange-500/20 mx-auto mb-4" />
                    <p className="text-white/40 text-sm font-light">
                      {offerSearch ? 'No se encontraron ofertas con esa búsqueda' : 'No hay ofertas disponibles'}
                    </p>
                    {offerSearch && (
                      <button onClick={() => setOfferSearch('')} className="mt-4 text-orange-400 text-sm hover:text-orange-300 transition-colors underline underline-offset-4">
                        Limpiar búsqueda
                      </button>
                    )}
                  </div>
                )
              }
              return (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {filtered.map(product => {
                    const inCart = carrito.find(c => c.id === product.id)
                    const discount = product.offerPrice ? Math.round(((product.salePrice - product.offerPrice) / product.salePrice) * 100) : 0
                    return (
                      <div
                        key={product.id}
                        className="group relative overflow-hidden cursor-pointer hover:-translate-y-1 hover:shadow-2xl hover:shadow-orange-900/40 transition-all duration-500"
                        onClick={() => openProductModal(product)}
                      >
                        <div data-dark className="relative aspect-[3/4] overflow-hidden bg-black/60">
                          {product.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={ensureAbsoluteUrl(product.imageUrl)} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-orange-900/20">
                              <Flame className="w-10 h-10 text-white/10" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                          {discount > 0 && (
                            <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1 bg-gradient-to-r from-red-600 to-orange-500 text-white text-[9px] font-bold px-2 py-0.5 shadow-lg shadow-orange-900/40">
                              <Flame className="w-2.5 h-2.5" />-{discount}%
                            </div>
                          )}
                          {product.brand && (
                            <div className="absolute top-2.5 right-2.5 z-20 px-2 py-0.5 text-[9px] text-white/55 uppercase tracking-[0.2em]">{product.brand}</div>
                          )}
                          {inCart && (
                            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-amber-500 text-black text-[9px] font-bold px-2 py-0.5">
                              <ShoppingCart className="w-2.5 h-2.5" />×{inCart.cantidad}
                            </div>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(product.id) }}
                            className={`absolute bottom-[56px] right-2.5 z-20 w-7 h-7 flex items-center justify-center transition-all duration-300 ${favorites.has(product.id) ? 'text-red-500' : 'text-white/50 hover:text-red-400'}`}
                            title="Favorito"
                          >
                            <Heart className={`w-3 h-3 ${favorites.has(product.id) ? 'fill-current' : ''}`} />
                          </button>
                          <div className="absolute bottom-0 left-0 right-0 z-10 px-3 pt-2 pb-[52px]">
                            <h3 className="text-xs sm:text-sm font-light text-white leading-snug line-clamp-2 mb-1">{product.name}</h3>
                            {product.offerLabel && <p className="text-[9px] text-orange-400/80 mb-1 uppercase tracking-wider">{product.offerLabel}</p>}
                            <div className="flex items-center gap-2">
                              {product.offerPrice ? (
                                <>
                                  <span className="text-orange-400 font-semibold text-sm">{formatCOP(product.offerPrice)}</span>
                                  <span className="text-white/30 text-xs line-through">{formatCOP(product.salePrice)}</span>
                                </>
                              ) : (
                                <span className="text-amber-400 font-light text-sm">{formatCOP(product.salePrice)}</span>
                              )}
                            </div>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center gap-0 translate-y-0 sm:translate-y-full sm:group-hover:translate-y-0 transition-transform duration-300 ease-out">
                            <button
                              onClick={(e) => { e.stopPropagation(); agregarAlCarrito(product) }}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-amber-500/70 hover:bg-amber-500/90 text-black text-[9px] font-semibold uppercase tracking-wider transition-colors"
                            >
                              <ShoppingCart className="w-3 h-3" />Añadir
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); openProductModal(product) }}
                              className="w-10 h-full flex items-center justify-center text-white/70 hover:text-white transition-all"
                              title="Ver detalle"
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* ========== DROP VIEW ========== */}
      {showDrop && !showProductModal && storeConfig?.activeDrop && (
        <div className="pt-20 min-h-screen" style={{ backgroundColor: effectiveBgColor }}>
          {/* Drop Header */}
          <div className="relative overflow-hidden">
            {storeConfig.activeDrop.bannerUrl && (
              <div className="relative h-48 sm:h-64 md:h-80">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={storeConfig.activeDrop.bannerUrl} alt={storeConfig.activeDrop.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black" />
              </div>
            )}
            <div className={`${storeConfig.activeDrop.bannerUrl ? 'absolute bottom-0 left-0 right-0' : ''} px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto`}>
              <button onClick={() => setShowDrop(false)} className="flex items-center gap-2 text-white/50 hover:text-white text-sm mb-4 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Volver
              </button>
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                  <p className="text-amber-400 text-xs uppercase tracking-[0.3em] mb-2 flex items-center gap-2"><Flame className="w-4 h-4" /> Drop Activo</p>
                  <h1 className="text-3xl sm:text-4xl font-light text-white tracking-wide">{storeConfig.activeDrop.name}</h1>
                  {storeConfig.activeDrop.description && <p className="text-white/50 font-light mt-2 max-w-xl">{storeConfig.activeDrop.description}</p>}
                </div>
                <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-5 py-3 shrink-0">
                  <Timer className="w-5 h-5 text-amber-400" />
                  <div>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest">Termina en</p>
                    <p className="text-lg font-mono text-white tracking-wider">{countdownText}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Drop Products Grid */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            {storeConfig.activeDrop.globalDiscount > 0 && (
              <div className="mb-8 text-center">
                <span className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-6 py-2 text-sm font-light tracking-wide">
                  <Tag className="w-4 h-4" /> Hasta {storeConfig.activeDrop.globalDiscount}% de descuento en este drop
                </span>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {storeConfig.activeDrop.products.map(product => {
                const discount = product.customDiscount ?? storeConfig.activeDrop!.globalDiscount
                const finalPrice = product.finalPrice
                const inCart = carrito.find(c => c.id === product.id)
                if (productCardStyle === 'style2') {
                  return (
                    <div
                      key={product.id}
                      className="group relative bg-white rounded-lg overflow-hidden shadow-sm border border-gray-100 cursor-pointer hover:shadow-lg transition-all duration-300"
                      onClick={() => openProductModal(product)}
                    >
                      <div className="relative aspect-[4/3] sm:aspect-square overflow-hidden bg-gray-50">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={ensureAbsoluteUrl(product.imageUrl)} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Package className="w-10 h-10 text-gray-300" /></div>
                        )}
                        {discount > 0 && (
                          <div className="absolute top-2 left-2 z-20 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-sm">-{discount}%</div>
                        )}
                        {inCart && (
                          <div className="absolute top-2 right-2 z-20 flex items-center gap-0.5 bg-amber-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-sm">
                            <ShoppingCart className="w-2.5 h-2.5" />×{inCart.cantidad}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-3 z-10">
                          <div className="flex items-center gap-2">
                            <button onClick={(e) => { e.stopPropagation(); agregarAlCarrito(product, { dropPrice: finalPrice, dropDiscount: discount }) }} className="w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center text-gray-700 hover:bg-amber-500 hover:text-white transition-colors" title="Agregar al carrito">
                              <ShoppingCart className="w-4 h-4" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); openProductModal(product) }} className="w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center text-gray-700 hover:bg-gray-800 hover:text-white transition-colors" title="Ver detalle">
                              <Search className="w-4 h-4" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); openProductModal(product) }} className="w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center text-gray-700 hover:bg-gray-800 hover:text-white transition-colors" title="Comparar">
                              <RotateCcw className="w-4 h-4" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); toggleFavorite(product.id) }} className={`w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center transition-colors ${favorites.has(product.id) ? 'text-red-500' : 'text-gray-700 hover:text-red-500'}`} title="Favorito">
                              <Heart className={`w-4 h-4 ${favorites.has(product.id) ? 'fill-current' : ''}`} />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="p-3">
                        <h3 className="text-xs sm:text-sm font-medium text-gray-800 line-clamp-2 mb-1 leading-snug">{product.name}</h3>
                        <div className="flex items-center gap-2">
                          {discount > 0 ? (
                            <>
                              <span className="text-gray-400 text-xs line-through">{formatCOP(product.salePrice)}</span>
                              <span className="text-gray-900 font-bold text-sm">{formatCOP(finalPrice)}</span>
                            </>
                          ) : (
                            <span className="text-gray-900 font-bold text-sm">{formatCOP(finalPrice)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                }
                return (
                  <div
                    key={product.id}
                    className="group relative overflow-hidden cursor-pointer hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/60 transition-all duration-500"
                    onClick={() => openProductModal(product)}
                  >
                    <div data-dark className="relative aspect-[3/4] overflow-hidden bg-black/60">
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ensureAbsoluteUrl(product.imageUrl)} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-white/3">
                          <Sparkles className="w-10 h-10 text-white/10" />
                        </div>
                      )}

                      {/* Permanent bottom gradient */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                      {/* Discount badge — top left */}
                      {discount > 0 && (
                        <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1 bg-gradient-to-r from-red-600 to-orange-500 text-white text-[10px] font-bold px-2 py-0.5 shadow-lg shadow-red-900/40">
                          <Flame className="w-2.5 h-2.5" />
                          -{discount}%
                        </div>
                      )}

                      {/* Brand tag — top right */}
                      {product.brand && (
                        <div className="absolute top-2.5 right-2.5 z-20 px-2 py-0.5 text-[9px] text-white/60 uppercase tracking-[0.2em]">
                          {product.brand}
                        </div>
                      )}

                      {/* In-cart indicator */}
                      {inCart && (
                        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-amber-500 text-black text-[9px] font-bold px-2 py-0.5">
                          <ShoppingCart className="w-2.5 h-2.5" />
                          ×{inCart.cantidad}
                        </div>
                      )}

                      {/* Favorite */}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(product.id) }}
                        className={`absolute bottom-[56px] right-2.5 z-20 w-7 h-7 flex items-center justify-center transition-all duration-300 ${favorites.has(product.id) ? 'text-red-500' : 'text-white/50 hover:text-red-400'}`}
                        title="Favorito"
                      >
                        <Heart className={`w-3 h-3 ${favorites.has(product.id) ? 'fill-current' : ''}`} />
                      </button>

                      {/* Info overlay */}
                      <div className="absolute bottom-0 left-0 right-0 z-10 px-3 pt-2 pb-[52px]">
                        <h3 className="text-xs sm:text-sm font-light text-white leading-snug line-clamp-2 mb-1">{product.name}</h3>
                        {product.size && <p className="text-[9px] text-white/35 mb-1">{product.size}</p>}
                        <div className="flex items-center gap-2">
                          <span className="text-amber-400 font-semibold text-sm">{formatCOP(finalPrice)}</span>
                          {discount > 0 && <span className="text-white/30 text-xs line-through">{formatCOP(product.salePrice)}</span>}
                        </div>
                      </div>

                      {/* Action bar */}
                      <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center gap-0 translate-y-0 sm:translate-y-full sm:group-hover:translate-y-0 transition-transform duration-300 ease-out">
                        <button
                          onClick={(e) => { e.stopPropagation(); agregarAlCarrito(product, { dropPrice: finalPrice, dropDiscount: discount }) }}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-amber-500/70 hover:bg-amber-500/90 text-black text-[9px] font-semibold uppercase tracking-wider transition-colors"
                        >
                          <ShoppingCart className="w-3 h-3" />
                          Añadir
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openProductModal(product) }}
                          className="w-10 h-full flex items-center justify-center text-white/70 hover:text-white transition-all"
                          title="Ver detalle"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            {storeConfig.activeDrop.products.length === 0 && (
              <div className="text-center py-20">
                <Sparkles className="w-12 h-12 text-white/10 mx-auto mb-4" />
                <p className="text-white/40 text-sm font-light">Este drop aún no tiene productos</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== SERVICES VIEW ========== */}
      {showServices && !showProductModal && !showCatalog && !showDrop && (
        <div className="pt-20 min-h-screen" style={{ backgroundColor: effectiveBgColor }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <button
              onClick={() => setShowServices(false)}
              className="flex items-center gap-2 text-white/50 hover:text-white text-sm mb-8 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Volver
            </button>
            <div className="mb-10">
              <p className="text-amber-400 uppercase text-xs tracking-[0.3em] mb-2">Nuestros Servicios</p>
              <h2 className="text-3xl font-light text-white">
                {storeConfig?.storeInfo?.name || 'Servicios'}
              </h2>
            </div>
            {publicServices.length === 0 ? (
              <div className="text-center py-24">
                <p className="text-white/40 text-sm font-light">No hay servicios disponibles en este momento.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {publicServices.map((service: any) => (
                  <div
                    key={service.id}
                    className="group relative overflow-hidden cursor-pointer hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/60 transition-all duration-500"
                    onClick={() => setBookingService(service)}
                  >
                    <div className="relative aspect-[3/4] overflow-hidden bg-black/60">
                      {service.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={service.imageUrl}
                          alt={service.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-white/3">
                          <Sparkles className="w-10 h-10 text-white/10" />
                        </div>
                      )}

                      {/* Gradient */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                      {/* Service type badge — top left */}
                      <div className={`absolute top-2.5 left-2.5 z-20 flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em] shadow-lg ${
                        service.serviceType === 'cita'
                          ? 'bg-amber-500 text-black'
                          : service.serviceType === 'asesoria'
                          ? 'bg-blue-600 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}>
                        {service.serviceType === 'cita' ? 'Cita' : service.serviceType === 'asesoria' ? 'Asesoría' : 'Contacto'}
                      </div>

                      {/* Duration — top right */}
                      {service.durationMinutes && (
                        <div className="absolute top-2.5 right-2.5 z-20 bg-black/55 backdrop-blur-sm border border-white/10 px-2 py-0.5 text-[9px] text-white/60 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />{service.durationMinutes} min
                        </div>
                      )}

                      {/* Info overlay */}
                      <div className="absolute bottom-0 left-0 right-0 z-10 px-3 pt-2 pb-[52px]">
                        <h3 className="text-xs sm:text-sm font-light text-white leading-snug line-clamp-2 mb-1">{service.name}</h3>
                        {service.category && (
                          <p className="text-[9px] text-white/35 mb-1 uppercase tracking-wider">{service.category}</p>
                        )}
                        <div className="flex items-center gap-2">
                          {service.priceType === 'gratis' ? (
                            <span className="text-green-400 font-semibold text-sm">Gratis</span>
                          ) : service.priceType === 'cotizacion' ? (
                            <span className="text-white/50 text-sm font-light">A cotizar</span>
                          ) : (
                            <span className="text-amber-400 font-light text-sm">
                              {service.priceType === 'desde' && <span className="text-white/40 text-xs mr-1">Desde</span>}
                              {formatCOP(service.price)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action bar */}
                      <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center gap-0 translate-y-0 sm:translate-y-full sm:group-hover:translate-y-0 transition-transform duration-300 ease-out">
                        <button
                          onClick={(e) => { e.stopPropagation(); setBookingService(service) }}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-amber-500/70 hover:bg-amber-500/90 text-black text-[9px] font-semibold uppercase tracking-wider transition-colors"
                        >
                          {service.serviceType === 'cita' ? 'Reservar' : service.serviceType === 'asesoria' ? 'Consultar' : 'Contactar'}
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== HERO VIEW (Inicio) ========== */}
      {!showCatalog && !showDrop && !showServices && !showOffers && !showProductModal && (
      <>
      {/* ========== HERO 1 — Banner Principal (Editable) ========== */}
      <section
        data-dark
        className={`relative w-full${isMobile ? '' : ' px-4 py-3'}`}
        style={{
          marginTop: storeConfig?.announcementBar?.isActive ? '104px' : '64px',
          height: isMobile ? 'auto' : storeConfig?.announcementBar?.isActive ? 'calc(100vh - 104px)' : 'calc(100vh - 64px)',
        }}
      >
        <div className={`relative w-full overflow-hidden bg-black${isMobile ? '' : ' h-full rounded-xl'}`}>
          {(storeConfig?.banners?.find(b => b.position === 'hero1')?.imageUrl || platformHeroUrl) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={storeConfig?.banners?.find(b => b.position === 'hero1')?.imageUrl || platformHeroUrl}
              alt={storeConfig?.banners?.find(b => b.position === 'hero1')?.title || platformHeroTitle || 'Banner principal'}
              className={isMobile ? 'w-full h-auto block object-cover' : 'absolute inset-0 w-full h-full object-cover object-center'}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/10 to-black/70 pointer-events-none" />
        </div>

        {/* Platform hero title & subtitle overlay (when no store selected) */}
        {!storeConfig && (platformHeroTitle || platformHeroSubtitle) && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="text-center px-4 max-w-3xl">
              {platformHeroTitle && (
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-extralight tracking-tight text-white mb-4 drop-shadow-lg">
                  {platformHeroTitle}
                </h1>
              )}
              {platformHeroSubtitle && (
                <p className="text-lg sm:text-xl text-white/70 font-light drop-shadow-md">
                  {platformHeroSubtitle}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Nuevos Lanzamientos — film strip (desktop only) ── */}
        {storeConfig?.newLaunches && storeConfig.newLaunches.length > 0 && !showNewLaunches && (
          <div className="absolute bottom-0 left-0 right-0 z-20 hidden md:block">
            {/* top border accent */}
            <div className="h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent" />
            <div className="bg-black/50 backdrop-blur-md px-6 lg:px-12 py-3 flex items-center gap-5">

              {/* Label */}
              <div className="flex items-center gap-2 shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                <span className="text-[10px] font-medium tracking-[0.35em] text-red-300 uppercase whitespace-nowrap">
                  Nuevos Lanzamientos
                </span>
              </div>

              {/* Divider */}
              <div className="w-px h-8 bg-red-500/25 shrink-0" />

              {/* Thumbnails row */}
              <div className="flex items-center gap-2 flex-1 overflow-hidden">
                {storeConfig.newLaunches.slice(0, 6).map((product) => (
                  <button
                    key={product.id}
                    onClick={() => { setShowNewLaunches(true); setShowCatalog(false); setShowDrop(false); setShowServices(false); setShowOffers(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                    className="group/thumb relative w-12 h-12 shrink-0 overflow-hidden border border-red-500/20 hover:border-red-400/60 transition-all duration-300"
                    title={product.name}
                  >
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={ensureAbsoluteUrl(product.imageUrl)}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-red-900/30 flex items-center justify-center">
                        <Sparkles className="w-3 h-3 text-red-400/40" />
                      </div>
                    )}
                    {/* index dot */}
                    <div className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-red-400/70" />
                  </button>
                ))}

                {/* count badge if more than 6 */}
                {storeConfig.newLaunches.length > 6 && (
                  <div className="w-12 h-12 shrink-0 border border-red-500/20 bg-red-900/20 flex items-center justify-center">
                    <span className="text-[10px] text-red-300/70 font-light">+{storeConfig.newLaunches.length - 6}</span>
                  </div>
                )}
              </div>

              {/* CTA button */}
              <button
                onClick={() => { setShowNewLaunches(true); setShowCatalog(false); setShowDrop(false); setShowServices(false); setShowOffers(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                className="shrink-0 flex items-center gap-2 px-4 py-2 border border-red-500/40 hover:border-red-400 hover:bg-red-500/15 text-red-300 hover:text-white text-[10px] uppercase tracking-[0.25em] transition-all duration-300 group/cta"
              >
                Ver todos
                <ArrowRight className="w-3 h-3 group-hover/cta:translate-x-0.5 transition-transform duration-300" />
              </button>
            </div>
          </div>
        )}

        {/* Scroll indicator */}
        <div className="hidden sm:block absolute bottom-20 left-1/2 -translate-x-1/2">
          <button onClick={scrollToPerfumes} className="text-white/40 hover:text-amber-400 transition-colors animate-bounce">
            <ChevronDown className="w-8 h-8" />
          </button>
        </div>
      </section>


      {/* ========== SEDES BANNER (only when 2+ sedes) ========== */}
      {storeSedes.length >= 2 && (
        <div className="landing-section-bg border-t border-white/5 py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-white/40 text-xs uppercase tracking-[0.2em]">
              <Store className="w-4 h-4 text-amber-500/70" />
              <span>Nuestras sedes</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {storeSedes.map(sede => (
                <button
                  key={sede.id}
                  onClick={() => {
                    setSedesViewMode(true)
                    setActiveSede(sede.id)
                    setCatalogSpecialFilter('all')
                    setShowCatalog(true)
                    setShowDrop(false)
                    setShowServices(false)
                    setShowNewLaunches(false)
                    setShowOffers(false)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 hover:border-amber-500/40 hover:bg-amber-500/10 text-white/60 hover:text-white text-xs uppercase tracking-wider transition-all duration-200"
                >
                  <MapPin className="w-3 h-3 text-amber-500/60" />
                  {sede.name}
                  {sede.address && <span className="hidden sm:inline text-white/30">· {sede.address}</span>}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setSedesViewMode(true)
                setActiveSede(null)
                setCatalogSpecialFilter('all')
                setShowCatalog(true)
                setShowDrop(false)
                setShowServices(false)
                setShowNewLaunches(false)
                setShowOffers(false)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              className="ml-auto flex items-center gap-1 text-amber-400/70 hover:text-amber-400 text-xs uppercase tracking-wider transition-colors"
            >
              Ver todas <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* ========== HERO 2 — Quick store-type selector (platform) / Categorías (store) ========== */}
      {(showStoresView && selectedStore === 'all' && stores.length > 0) ? (
        <RevealSection className="py-5 sm:py-8 landing-section-bg relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Label */}
            <p className={`text-center text-[10px] uppercase tracking-[0.4em] mb-4 ${isLightBg ? 'text-black/30' : 'text-white/30'}`}>
              ¿Qué estás buscando?
            </p>
            {/* Business-type pills */}
            {(() => {
              const businessTypeIconMap: Record<string, React.ReactNode> = {
                restaurante: <UtensilsCrossed className="w-4 h-4" />,
                comida: <UtensilsCrossed className="w-4 h-4" />,
                tecnologia: <Zap className="w-4 h-4" />,
                tecnología: <Zap className="w-4 h-4" />,
                ropa: <Tag className="w-4 h-4" />,
                moda: <Tag className="w-4 h-4" />,
                drogueria: <Package className="w-4 h-4" />,
                droguería: <Package className="w-4 h-4" />,
                farmacia: <Package className="w-4 h-4" />,
                fruver: <Sparkles className="w-4 h-4" />,
                supermercado: <Store className="w-4 h-4" />,
              }
              const getIcon = (type: string) =>
                businessTypeIconMap[type.toLowerCase()] ?? <Store className="w-4 h-4" />
              const types = Array.from(new Set(stores.map(s => s.businessType).filter(Boolean))) as string[]
              return (
                <div className="flex flex-wrap gap-2 sm:gap-3 justify-center">
                  {/* Todos */}
                  <button
                    onClick={() => { setBusinessTypeFilter('all'); scrollToPerfumes() }}
                    className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-3 rounded-full border transition-all duration-200 text-[11px] sm:text-sm uppercase tracking-wider font-light ${
                      businessTypeFilter === 'all'
                        ? 'bg-amber-500 border-amber-500 text-black'
                        : isLightBg
                          ? 'bg-transparent border-black/15 text-black/50 hover:border-black/40 hover:text-black/80'
                          : 'bg-transparent border-white/15 text-white/50 hover:border-white/40 hover:text-white/80'
                    }`}
                  >
                    <Store className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Todos
                  </button>
                  {types.map(type => (
                    <button
                      key={type}
                      onClick={() => { setBusinessTypeFilter(type); scrollToPerfumes() }}
                      className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-3 rounded-full border transition-all duration-200 text-[11px] sm:text-sm uppercase tracking-wider font-light ${
                        businessTypeFilter === type
                          ? 'bg-amber-500 border-amber-500 text-black'
                          : isLightBg
                            ? 'bg-transparent border-black/15 text-black/50 hover:border-black/40 hover:text-black/80'
                            : 'bg-transparent border-white/15 text-white/50 hover:border-white/40 hover:text-white/80'
                      }`}
                    >
                      {getIcon(type)}
                      {type}
                    </button>
                  ))}
                </div>
              )
            })()}
          </div>
        </RevealSection>
      ) : (
        /* Original image carousel — only shown inside individual store */
        (() => {
          const heroCategories: Array<{ name: string; displayName?: string; imageUrl: string | null }> =
            storeConfig && storeConfig.categories.length > 0
              ? storeConfig.categories
              : categories.length > 0
                ? categories.map(c => ({ name: c, imageUrl: null }))
                : []
          const categoryGradients = [
            'from-red-900/60 to-red-950/80',
            'from-amber-900/60 to-yellow-950/80',
            'from-red-900/60 to-red-950/80',
            'from-emerald-900/60 to-teal-950/80',
          ]
          return heroCategories.length > 0 ? (
            <RevealSection className="pt-2 pb-6 sm:pt-3 sm:pb-10 landing-section-bg relative">
              <div className="relative">
                <button
                  onClick={() => carouselCategoriesRef.current?.scrollBy({ left: -600, behavior: 'smooth' })}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/80 border border-white/20 flex items-center justify-center text-white hover:bg-amber-500 hover:border-amber-500 hover:text-black transition-all shadow-lg flex sm:hidden"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div ref={carouselCategoriesRef} className="flex gap-2 sm:gap-3 overflow-x-auto sm:overflow-visible scrollbar-hide scroll-smooth px-2 sm:px-3">
                  {heroCategories.map((cat, idx) => (
                    <button
                      key={cat.name}
                      onClick={() => {
                        setCatalogSelectedCategories(new Set([cat.name]))
                        setShowCatalog(true)
                        setShowDrop(false)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                      className="group flex flex-col flex-shrink-0 w-[42vw] sm:flex-1 sm:w-auto transition-all duration-300"
                    >
                      <div data-dark className="relative overflow-hidden w-full aspect-square sm:aspect-auto sm:h-[380px]">
                        {cat.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={cat.imageUrl}
                            alt={cat.name}
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          />
                        ) : (
                          <div className={`absolute inset-0 bg-gradient-to-br ${categoryGradients[idx % categoryGradients.length]} group-hover:scale-105 transition-transform duration-700`}>
                            <div className="absolute inset-0 flex items-center justify-center opacity-10">
                              <Sparkles className="w-20 h-20 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="py-3 text-center">
                        <h3 className={`text-[11px] sm:text-sm font-light uppercase tracking-[0.2em] transition-colors group-hover:text-amber-500 ${isLightBg ? 'text-black/70' : 'text-white/80'}`}>
                          {cat.displayName || cat.name}
                        </h3>
                      </div>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => carouselCategoriesRef.current?.scrollBy({ left: 600, behavior: 'smooth' })}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/80 border border-white/20 flex items-center justify-center text-white hover:bg-amber-500 hover:border-amber-500 hover:text-black transition-all shadow-lg flex sm:hidden"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </RevealSection>
          ) : null
        })()
      )}

      {/* ========== HERO 3 — Productos Tendencia ========== */}
      {storeConfig && storeConfig.trendingProducts.length > 0 && (
        <RevealSection className="py-10 sm:py-14 landing-section-alt relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4 mb-8">
              <div className="flex-1 h-px bg-current opacity-10" />
              <div className="flex items-center gap-2 shrink-0">
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-sm font-light uppercase tracking-[0.3em]">Tendencia</span>
              </div>
              <div className="flex-1 h-px bg-current opacity-10" />
              <button
                onClick={() => openCatalogWithFilter('trending')}
                className="shrink-0 inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-xs uppercase tracking-[0.2em] transition-colors"
              >
                Ver todos <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="relative">
              <div ref={carouselTrendingRef} className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth">
              {storeConfig.trendingProducts.map(product => {
                const isOffer = product.isOnOffer && product.offerPrice
                const discount = isOffer ? Math.round(((product.salePrice - product.offerPrice!) / product.salePrice) * 100) : 0
                const inCart = carrito.find(c => c.id === product.id)
                if (productCardStyle === 'style2') {
                  return (
                    <div
                      key={product.id}
                      className="group relative bg-white rounded-lg overflow-hidden shadow-sm border border-gray-100 cursor-pointer hover:shadow-lg transition-all duration-300 flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(33.33%-11px)] lg:w-[calc(20%-13px)]"
                      onClick={() => openProductModal(product)}
                    >
                      <div className="relative aspect-square overflow-hidden bg-gray-50">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={ensureAbsoluteUrl(product.imageUrl)} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Package className="w-10 h-10 text-gray-300" /></div>
                        )}
                        {isOffer && (
                          <div className="absolute top-2 left-2 z-20 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-sm">-{discount}%</div>
                        )}
                        {inCart && (
                          <div className="absolute top-2 right-2 z-20 flex items-center gap-0.5 bg-amber-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-sm">
                            <ShoppingCart className="w-2.5 h-2.5" />×{inCart.cantidad}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-2 z-10">
                          <div className="flex items-center gap-1.5">
                            <button onClick={(e) => { e.stopPropagation(); agregarAlCarrito(product) }} className="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center text-gray-700 hover:bg-amber-500 hover:text-white transition-colors" title="Agregar al carrito">
                              <ShoppingCart className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); openProductModal(product) }} className="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center text-gray-700 hover:bg-gray-800 hover:text-white transition-colors" title="Ver detalle">
                              <Search className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); openProductModal(product) }} className="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center text-gray-700 hover:bg-gray-800 hover:text-white transition-colors" title="Comparar">
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); toggleFavorite(product.id) }} className={`w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center transition-colors ${favorites.has(product.id) ? 'text-red-500' : 'text-gray-700 hover:text-red-500'}`} title="Favorito">
                              <Heart className={`w-3.5 h-3.5 ${favorites.has(product.id) ? 'fill-current' : ''}`} />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="p-2">
                        <h3 className="text-xs font-medium text-gray-800 line-clamp-2 mb-1 leading-snug">{product.name}</h3>
                        <div className="flex items-center gap-1.5">
                          {isOffer ? (
                            <>
                              <span className="text-gray-400 text-[10px] line-through">{formatCOP(product.salePrice)}</span>
                              <span className="text-gray-900 font-bold text-xs">{formatCOP(product.offerPrice!)}</span>
                            </>
                          ) : (
                            <span className="text-gray-900 font-bold text-xs">{formatCOP(product.salePrice)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                }
                return (
                  <div
                    key={product.id}
                    className="group relative overflow-hidden cursor-pointer hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/60 transition-all duration-500 flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(33.33%-11px)] lg:w-[calc(20%-13px)]"
                    onClick={() => openProductModal(product)}
                  >
                    <div data-dark className="relative aspect-[3/4] overflow-hidden bg-black/60">
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ensureAbsoluteUrl(product.imageUrl)} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-white/3"><Sparkles className="w-10 h-10 text-white/10" /></div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                      {isOffer && (
                        <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1 bg-gradient-to-r from-red-600 to-orange-500 text-white text-[10px] font-bold px-2 py-0.5 shadow-lg shadow-red-900/40">
                          <Flame className="w-2.5 h-2.5" />-{discount}%
                        </div>
                      )}
                      {product.brand && (
                        <div className="absolute top-2.5 right-2.5 z-20 px-2 py-0.5 text-[9px] text-white/60 uppercase tracking-[0.2em]">{product.brand}</div>
                      )}
                      {inCart && (
                        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-amber-500 text-black text-[9px] font-bold px-2 py-0.5">
                          <ShoppingCart className="w-2.5 h-2.5" />×{inCart.cantidad}
                        </div>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(product.id) }}
                        className={`absolute bottom-[56px] right-2.5 z-20 w-7 h-7 flex items-center justify-center transition-all duration-300 ${favorites.has(product.id) ? 'text-red-500' : 'text-white/50 hover:text-red-400'}`}
                        title="Favorito"
                      >
                        <Heart className={`w-3 h-3 ${favorites.has(product.id) ? 'fill-current' : ''}`} />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 z-10 px-3 pt-2 pb-[52px]">
                        <h3 className="text-xs font-light text-white leading-snug line-clamp-2 mb-1">{product.name}</h3>
                        {product.size && <p className="text-[9px] text-white/35 mb-1">{product.size}</p>}
                        <div className="flex items-center gap-2">
                          {isOffer ? (
                            <>
                              <span className="text-orange-400 font-semibold text-sm">{formatCOP(product.offerPrice!)}</span>
                              <span className="text-white/30 text-xs line-through">{formatCOP(product.salePrice)}</span>
                            </>
                          ) : (
                            <span className="text-amber-400 font-light text-sm">{formatCOP(product.salePrice)}</span>
                          )}
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center gap-0 translate-y-0 sm:translate-y-full sm:group-hover:translate-y-0 transition-transform duration-300 ease-out">
                        <button
                          onClick={(e) => { e.stopPropagation(); agregarAlCarrito(product) }}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-amber-500/70 hover:bg-amber-500/90 text-black text-[9px] font-semibold uppercase tracking-wider transition-colors"
                        >
                          <ShoppingCart className="w-3 h-3" />Añadir
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openProductModal(product) }}
                          className="w-10 h-full flex items-center justify-center text-white/70 hover:text-white transition-all"
                          title="Ver detalle"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
              </div>
            </div>
          </div>
        </RevealSection>
      )}

      {/* ========== HERO 4 — Segundo Banner (Editable) ========== */}
      {storeConfig?.banners?.find(b => b.position === 'hero4') && (
        <section
          data-dark
          className={`relative w-full${isMobile ? '' : ' px-4 py-3'}`}
          style={{ height: isMobile ? 'auto' : '70vh' }}
        >
          {(() => {
            const hero4 = storeConfig!.banners.find(b => b.position === 'hero4')!
            return (
              <>
                <div className={`relative w-full overflow-hidden bg-black${isMobile ? '' : ' h-full rounded-xl'}`}>
                  {hero4.videoUrl ? (
                    <video
                      src={hero4.videoUrl}
                      autoPlay
                      muted
                      loop
                      playsInline
                      className={isMobile ? 'w-full h-auto block object-cover' : 'absolute inset-0 w-full h-full object-cover object-center'}
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={hero4.imageUrl}
                      alt={hero4.title || 'Banner'}
                      className={isMobile ? 'w-full h-auto block object-cover' : 'absolute inset-0 w-full h-full object-cover object-center'}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/10 to-black/70 pointer-events-none" />
                </div>
                {(hero4.title || hero4.subtitle) && (
                  <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                    <div className="text-center px-4 max-w-3xl space-y-4 pointer-events-auto">
                      {hero4.title && (
                        <h2 className="text-4xl sm:text-6xl font-extralight tracking-tight drop-shadow-lg">
                          {hero4.title}
                        </h2>
                      )}
                      {hero4.subtitle && (
                        <p className="text-white/70 text-sm sm:text-lg font-light drop-shadow-md max-w-md mx-auto">
                          {hero4.subtitle}
                        </p>
                      )}
                      {hero4.linkUrl && (
                        <a
                          href={hero4.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black px-8 py-3 text-xs uppercase tracking-[0.2em] font-medium transition-all duration-300"
                        >
                          Ver más <ArrowRight className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </>
            )
          })()}
        </section>
      )}

      {/* ========== HERO 5 — Productos Destacados ========== */}
      {storeConfig && storeConfig.featuredProducts.length > 0 && (
        <RevealSection className="py-10 sm:py-14 landing-section-bg relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4 mb-8">
              <div className="flex-1 h-px bg-current opacity-10" />
              <div className="flex items-center gap-2 shrink-0">
                <Star className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-sm font-light uppercase tracking-[0.3em]">Productos Destacados</span>
              </div>
              <div className="flex-1 h-px bg-current opacity-10" />
              <button
                onClick={() => openCatalogWithFilter('featured')}
                className="shrink-0 inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-xs uppercase tracking-[0.2em] transition-colors"
              >
                Ver todos <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="relative">
              <div ref={carouselFeaturedRef} className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth">
              {storeConfig.featuredProducts.map(product => {
                const isOffer = product.isOnOffer && product.offerPrice
                const discount = isOffer ? Math.round(((product.salePrice - product.offerPrice!) / product.salePrice) * 100) : 0
                const inCart = carrito.find(c => c.id === product.id)
                if (productCardStyle === 'style2') {
                  return (
                    <div
                      key={product.id}
                      className="group relative bg-white rounded-lg overflow-hidden shadow-sm border border-gray-100 cursor-pointer hover:shadow-lg transition-all duration-300 flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(33.33%-11px)] lg:w-[calc(20%-13px)]"
                      onClick={() => openProductModal(product)}
                    >
                      <div className="relative aspect-square overflow-hidden bg-gray-50">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={ensureAbsoluteUrl(product.imageUrl)} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Package className="w-10 h-10 text-gray-300" /></div>
                        )}
                        <div className="absolute top-2 left-2 z-20 flex items-center gap-1 bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-sm">
                          <Star className="w-2.5 h-2.5" />
                        </div>
                        {isOffer && (
                          <div className="absolute top-2 left-8 z-20 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-sm">-{discount}%</div>
                        )}
                        {inCart && (
                          <div className="absolute top-2 right-2 z-20 flex items-center gap-0.5 bg-amber-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-sm">
                            <ShoppingCart className="w-2.5 h-2.5" />×{inCart.cantidad}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-2 z-10">
                          <div className="flex items-center gap-1.5">
                            <button onClick={(e) => { e.stopPropagation(); agregarAlCarrito(product) }} className="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center text-gray-700 hover:bg-amber-500 hover:text-white transition-colors" title="Agregar al carrito">
                              <ShoppingCart className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); openProductModal(product) }} className="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center text-gray-700 hover:bg-gray-800 hover:text-white transition-colors" title="Ver detalle">
                              <Search className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); openProductModal(product) }} className="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center text-gray-700 hover:bg-gray-800 hover:text-white transition-colors" title="Comparar">
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); toggleFavorite(product.id) }} className={`w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center transition-colors ${favorites.has(product.id) ? 'text-red-500' : 'text-gray-700 hover:text-red-500'}`} title="Favorito">
                              <Heart className={`w-3.5 h-3.5 ${favorites.has(product.id) ? 'fill-current' : ''}`} />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="p-2">
                        <h3 className="text-xs font-medium text-gray-800 line-clamp-2 mb-1 leading-snug">{product.name}</h3>
                        <div className="flex items-center gap-1.5">
                          {isOffer ? (
                            <>
                              <span className="text-gray-400 text-[10px] line-through">{formatCOP(product.salePrice)}</span>
                              <span className="text-gray-900 font-bold text-xs">{formatCOP(product.offerPrice!)}</span>
                            </>
                          ) : (
                            <span className="text-gray-900 font-bold text-xs">{formatCOP(product.salePrice)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                }
                return (
                  <div
                    key={product.id}
                    className="group relative overflow-hidden cursor-pointer hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/60 transition-all duration-500 flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(33.33%-11px)] lg:w-[calc(20%-13px)]"
                    onClick={() => openProductModal(product)}
                  >
                    <div data-dark className="relative aspect-[3/4] overflow-hidden bg-black/60">
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ensureAbsoluteUrl(product.imageUrl)} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-white/3"><Sparkles className="w-10 h-10 text-white/10" /></div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                      {/* Top badges row */}
                      <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-[9px] font-bold px-2 py-0.5 shadow-lg shrink-0">
                          <Star className="w-2.5 h-2.5" />Destacado
                        </div>
                        {inCart && (
                          <div className="flex items-center gap-1 bg-amber-500 text-black text-[9px] font-bold px-2 py-0.5 shrink-0">
                            <ShoppingCart className="w-2.5 h-2.5" />×{inCart.cantidad}
                          </div>
                        )}
                      </div>
                      {/* Offer badge */}
                      {isOffer && (
                        <div className="absolute top-8 left-2.5 z-20 flex items-center gap-1 bg-gradient-to-r from-red-600 to-orange-500 text-white text-[10px] font-bold px-2 py-0.5 shadow-lg shadow-red-900/40">
                          <Flame className="w-2.5 h-2.5" />-{discount}%
                        </div>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(product.id) }}
                        className={`absolute bottom-[56px] right-2.5 z-20 w-7 h-7 flex items-center justify-center transition-all duration-300 ${favorites.has(product.id) ? 'text-red-500' : 'text-white/50 hover:text-red-400'}`}
                        title="Favorito"
                      >
                        <Heart className={`w-3 h-3 ${favorites.has(product.id) ? 'fill-current' : ''}`} />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 z-10 px-3 pt-2 pb-[52px]">
                        {product.brand && (
                          <p className="text-[9px] text-amber-400/70 uppercase tracking-[0.2em] truncate mb-0.5">{product.brand}</p>
                        )}
                        <h3 className="text-xs font-light text-white leading-snug line-clamp-2 mb-1">{product.name}</h3>
                        {product.size && <p className="text-[9px] text-white/35 mb-1">{product.size}</p>}
                        <div className="flex items-center gap-2">
                          {isOffer ? (
                            <>
                              <span className="text-orange-400 font-semibold text-sm">{formatCOP(product.offerPrice!)}</span>
                              <span className="text-white/30 text-xs line-through">{formatCOP(product.salePrice)}</span>
                            </>
                          ) : (
                            <span className="text-amber-400 font-light text-sm">{formatCOP(product.salePrice)}</span>
                          )}
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center gap-0 translate-y-0 sm:translate-y-full sm:group-hover:translate-y-0 transition-transform duration-300 ease-out">
                        <button
                          onClick={(e) => { e.stopPropagation(); agregarAlCarrito(product) }}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-amber-500/70 hover:bg-amber-500/90 text-black text-[9px] font-semibold uppercase tracking-wider transition-colors"
                        >
                          <ShoppingCart className="w-3 h-3" />Añadir
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openProductModal(product) }}
                          className="w-10 h-full flex items-center justify-center text-white/70 hover:text-white transition-all"
                          title="Ver detalle"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
              </div>
            </div>
          </div>
        </RevealSection>
      )}

      {/* ========== MÓDULO DE INFORMACIÓN (cuando está activo reemplaza la sección de productos) ========== */}
      {storeConfig?.storeInfo?.showInfoModule && selectedStore !== 'all' ? (
        <RevealSection id="perfumes" className="py-10 sm:py-20 landing-section-alt relative">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 space-y-2">
              <p className="text-amber-400/60 uppercase tracking-[0.5em] text-xs">Información</p>
              <h2 className="text-3xl sm:text-4xl font-extralight tracking-tight">
                {storeConfig.storeInfo?.name || stores.find(s => s.slug === selectedStore)?.name || 'Nuestra Tienda'}
              </h2>
              {storeConfig.storeInfo?.infoModuleDescription && (
                <p className="text-white/50 text-sm font-light max-w-lg mx-auto leading-relaxed">
                  {storeConfig.storeInfo.infoModuleDescription}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Horario */}
              {storeConfig.storeInfo?.schedule && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-white/3 hover:bg-white/5 transition-colors">
                  <div className="mt-0.5 w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Horario</p>
                    <p className="text-white/90 text-sm font-light">{storeConfig.storeInfo.schedule}</p>
                  </div>
                </div>
              )}

              {/* Dirección */}
              {storeConfig.storeInfo?.address && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-white/3 hover:bg-white/5 transition-colors">
                  <div className="mt-0.5 w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Dirección</p>
                    {storeConfig.storeInfo.locationMapUrl ? (
                      <a
                        href={storeConfig.storeInfo.locationMapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-400/80 text-sm font-light hover:text-amber-400 transition-colors underline underline-offset-2"
                      >
                        {storeConfig.storeInfo.address}
                      </a>
                    ) : (
                      <p className="text-white/90 text-sm font-light">{storeConfig.storeInfo.address}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Teléfono */}
              {storeConfig.storeInfo?.phone && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-white/3 hover:bg-white/5 transition-colors">
                  <div className="mt-0.5 w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Teléfono</p>
                    <a href={`tel:${storeConfig.storeInfo.phone}`} className="text-white/90 text-sm font-light hover:text-amber-400 transition-colors">
                      {storeConfig.storeInfo.phone}
                    </a>
                  </div>
                </div>
              )}

              {/* WhatsApp */}
              {storeConfig.storeInfo?.socialWhatsapp && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-white/3 hover:bg-white/5 transition-colors">
                  <div className="mt-0.5 w-8 h-8 rounded-full bg-green-500/15 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-4 h-4 text-green-400" />
                  </div>
                  <div>
                    <p className="text-white/50 text-xs uppercase tracking-wider mb-1">WhatsApp</p>
                    <a
                      href={`https://wa.me/${storeConfig.storeInfo.socialWhatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-400/80 text-sm font-light hover:text-green-400 transition-colors"
                    >
                      {storeConfig.storeInfo.socialWhatsapp}
                    </a>
                  </div>
                </div>
              )}

              {/* Métodos de pago */}
              {storeConfig.storeInfo?.paymentMethods && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-white/3 hover:bg-white/5 transition-colors">
                  <div className="mt-0.5 w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                    <CreditCard className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Métodos de pago</p>
                    <p className="text-white/90 text-sm font-light">{storeConfig.storeInfo.paymentMethods}</p>
                  </div>
                </div>
              )}

              {/* Redes sociales */}
              {(storeConfig.storeInfo?.socialInstagram || storeConfig.storeInfo?.socialFacebook || storeConfig.storeInfo?.socialTiktok) && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-white/3 hover:bg-white/5 transition-colors">
                  <div className="mt-0.5 w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                    <Star className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-white/50 text-xs uppercase tracking-wider mb-2">Redes Sociales</p>
                    <div className="flex items-center gap-3 flex-wrap">
                      {storeConfig.storeInfo.socialInstagram && (
                        <a
                          href={storeConfig.storeInfo.socialInstagram.startsWith('http') ? storeConfig.storeInfo.socialInstagram : `https://instagram.com/${storeConfig.storeInfo.socialInstagram}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-white/70 text-sm hover:text-pink-400 transition-colors"
                        >
                          <Instagram className="w-4 h-4" />
                          <span>Instagram</span>
                        </a>
                      )}
                      {storeConfig.storeInfo.socialFacebook && (
                        <a
                          href={storeConfig.storeInfo.socialFacebook.startsWith('http') ? storeConfig.storeInfo.socialFacebook : `https://facebook.com/${storeConfig.storeInfo.socialFacebook}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-white/70 text-sm hover:text-blue-400 transition-colors"
                        >
                          <Facebook className="w-4 h-4" />
                          <span>Facebook</span>
                        </a>
                      )}
                      {storeConfig.storeInfo.socialTiktok && (
                        <a
                          href={storeConfig.storeInfo.socialTiktok.startsWith('http') ? storeConfig.storeInfo.socialTiktok : `https://tiktok.com/@${storeConfig.storeInfo.socialTiktok}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-white/70 text-sm hover:text-white transition-colors"
                        >
                          <Sparkles className="w-4 h-4" />
                          <span>TikTok</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Email */}
              {storeConfig.storeInfo?.email && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-white/3 hover:bg-white/5 transition-colors">
                  <div className="mt-0.5 w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Email</p>
                    <a href={`mailto:${storeConfig.storeInfo.email}`} className="text-white/90 text-sm font-light hover:text-amber-400 transition-colors">
                      {storeConfig.storeInfo.email}
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Ubicación en mapa */}
            {storeConfig.storeInfo?.address && (
              <div className="mt-6">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(storeConfig.storeInfo.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 hover:border-amber-400/40 hover:bg-white/5 transition-all duration-300 group"
                >
                  <MapPin className="w-5 h-5 text-amber-400 shrink-0" />
                  <span className="text-white/70 group-hover:text-white text-sm transition-colors">{storeConfig.storeInfo.address}</span>
                </a>
              </div>
            )}
          </div>
        </RevealSection>
      ) : (
      <RevealSection id="perfumes" className="py-6 sm:py-14 landing-section-alt relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6 sm:mb-10 space-y-2 sm:space-y-4">
            <p className="text-amber-400/60 uppercase tracking-[0.5em] text-xs">
              {showStoresView && selectedStore === 'all' ? 'Epicentro' : 'Tienda Online'}
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extralight tracking-tight">
              {showStoresView && selectedStore === 'all'
                ? 'Productos & Servicios'
                : selectedStore !== 'all'
                  ? stores.find(s => s.slug === selectedStore)?.name || 'Productos'
                  : selectedCategory !== 'all'
                    ? selectedCategory
                    : 'Nuestros Perfumes'}
            </h2>
            <p className="text-white/40 text-sm font-light max-w-md mx-auto">
              {showStoresView && selectedStore === 'all'
                ? 'Descubre los productos y ofertas destacadas de nuestros comercios.'
                : selectedCategory !== 'all'
                  ? `Productos en la categoría ${selectedCategory}`
                  : 'Explora nuestra colección y añade tus favoritos al carrito. Envío a todo Colombia.'}
            </p>
          </div>

          {/* ── All-stores view: featured products + offers first, stores at bottom ── */}
          {showStoresView && selectedStore === 'all' && (
            <>
              {/* Platform Featured Products (superadmin pinned) */}
              {platformFeatured.length > 0 && (
                <div className="mb-12">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-400" />
                      <span className="text-white/60 text-sm font-light uppercase tracking-widest">Productos Destacados</span>
                    </div>
                  </div>
                  <div className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth">
                    {platformFeatured.map(product => {
                      const inCart = carrito.find(c => c.id === product.id)
                      const isOffer = product.isOnOffer && product.offerPrice
                      const discount = isOffer ? Math.round(((product.salePrice - product.offerPrice!) / product.salePrice) * 100) : 0
                      return (
                        <div
                          key={product.id}
                          className="group relative overflow-hidden cursor-pointer hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/60 transition-all duration-500 flex-shrink-0 w-36 sm:w-48 md:w-56"
                          onClick={() => openProductModal(product)}
                        >
                          <div className="relative aspect-[3/4] overflow-hidden bg-black/60">
                            {product.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={ensureAbsoluteUrl(product.imageUrl)} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-white/3"><Sparkles className="w-10 h-10 text-white/10" /></div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                            {isOffer && (
                              <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1 bg-gradient-to-r from-red-600 to-orange-500 text-white text-[10px] font-bold px-2 py-0.5 shadow-lg shadow-red-900/40">
                                <Flame className="w-2.5 h-2.5" />-{discount}%
                              </div>
                            )}
                            <div className="absolute top-2 right-2 z-20 bg-amber-500/90 text-black text-[9px] font-bold px-1.5 py-0.5 flex items-center gap-0.5 rounded-sm">
                              <Star className="w-2.5 h-2.5" />Dest.
                            </div>
                            {inCart && (
                              <div className="absolute top-7 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-amber-500 text-black text-[9px] font-bold px-2 py-0.5">
                                <ShoppingCart className="w-2.5 h-2.5" />×{inCart.cantidad}
                              </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
                              <p className="text-white font-light text-sm leading-snug line-clamp-2">{product.name}</p>
                              {product.storeName && <p className="text-amber-400/70 text-[10px] uppercase tracking-wider mt-0.5">{product.storeName}</p>}
                              <div className="flex items-center gap-2 mt-1.5">
                                {isOffer ? (
                                  <>
                                    <span className="text-white/40 text-xs line-through">{formatCOP(product.salePrice)}</span>
                                    <span className="text-amber-400 font-semibold text-sm">{formatCOP(product.offerPrice!)}</span>
                                  </>
                                ) : (
                                  <span className="text-amber-400 font-semibold text-sm">{formatCOP(product.salePrice)}</span>
                                )}
                              </div>
                              <button
                                onClick={e => { e.stopPropagation(); agregarAlCarrito(product) }}
                                className="mt-2 w-full py-1.5 bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs uppercase tracking-wider hover:bg-amber-500 hover:text-black hover:border-amber-500 transition-colors"
                              >
                                Añadir
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Active Offers from all stores */}
              {offerProducts.length > 0 && (
                <div className="mb-12">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-orange-500" />
                      <span className="text-white/60 text-sm font-light uppercase tracking-widest">Ofertas Activas</span>
                    </div>
                    <button
                      onClick={() => { setMobileActiveTab('ofertas'); fetchAllStoreOffers() }}
                      className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-xs uppercase tracking-[0.2em] transition-colors"
                    >
                      Ver todas <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth">
                    {offerProducts.slice(0, 10).map(product => {
                      const inCart = carrito.find(c => c.id === product.id)
                      const discount = product.offerPrice ? Math.round(((product.salePrice - product.offerPrice) / product.salePrice) * 100) : 0
                      return (
                        <div
                          key={product.id}
                          className="group relative overflow-hidden cursor-pointer hover:-translate-y-1 transition-all duration-500 flex-shrink-0 w-36 sm:w-48 md:w-56"
                          onClick={() => openProductModal(product)}
                        >
                          <div className="relative aspect-[3/4] overflow-hidden bg-black/60">
                            {product.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={ensureAbsoluteUrl(product.imageUrl)} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"><Sparkles className="w-10 h-10 text-white/10" /></div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                            <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1 bg-gradient-to-r from-red-600 to-orange-500 text-white text-[10px] font-bold px-2 py-0.5">
                              <Flame className="w-2.5 h-2.5" />-{discount}%
                            </div>
                            {inCart && (
                              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-amber-500 text-black text-[9px] font-bold px-2 py-0.5">
                                <ShoppingCart className="w-2.5 h-2.5" />×{inCart.cantidad}
                              </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
                              <p className="text-white font-light text-sm leading-snug line-clamp-2">{product.name}</p>
                              {product.storeName && <p className="text-orange-400/70 text-[10px] uppercase tracking-wider mt-0.5">{product.storeName}</p>}
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-white/40 text-xs line-through">{formatCOP(product.salePrice)}</span>
                                <span className="text-orange-400 font-semibold text-sm">{formatCOP(product.offerPrice!)}</span>
                              </div>
                              <button
                                onClick={e => { e.stopPropagation(); agregarAlCarrito(product) }}
                                className="mt-2 w-full py-1.5 bg-orange-500/20 border border-orange-500/40 text-orange-400 text-xs uppercase tracking-wider hover:bg-orange-500 hover:text-white hover:border-orange-500 transition-colors"
                              >
                                Añadir
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Search bar — only when in specific store */}
          {!(showStoresView && selectedStore === 'all') && (
            <div className="flex flex-col sm:flex-row gap-4 mb-6 sm:mb-10 max-w-3xl mx-auto">
              {selectedStore !== 'all' && stores.length > 1 && (
                <button
                  onClick={() => { setSelectedStore('all'); setShowStoresView(true) }}
                  className="flex items-center gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-light hover:bg-amber-500/20 transition-colors whitespace-nowrap"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Todas las tiendas
                </button>
              )}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="text"
                  placeholder="Buscar perfume..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 text-white placeholder-white/30 font-light text-sm focus:border-amber-500/50 focus:outline-none transition-colors rounded-none"
                />
              </div>
            </div>
          )}

          {/* ===== MARKETPLACE: ALL STORES VIEW ===== */}
          {showStoresView && selectedStore === 'all' && (
            <div className="space-y-8 mt-2">


              {/* ── Store cards grid ── */}
              {(() => {
                const visibleStores = stores
                  .filter(s => businessTypeFilter === 'all' || s.businessType === businessTypeFilter)
                  .sort((a, b) => (b.productCount > 0 ? 1 : 0) - (a.productCount > 0 ? 1 : 0))
                if (loadingStores) return (
                  <div>
                    <div className="flex items-center gap-2 mb-5">
                      <Store className="w-3.5 h-3.5 text-amber-500/60" />
                      <span className="text-[10px] uppercase tracking-widest text-white/30 font-light">Cargando comercios...</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                      {[0,1,2,3,4,5].map(i => (
                        <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse shadow-sm border border-gray-100">
                          <div className="bg-gray-100" style={{ aspectRatio: '16/9' }} />
                          <div className="p-3 space-y-2">
                            <div className="h-3 bg-gray-200 rounded w-2/3" />
                            <div className="h-2 bg-gray-100 rounded w-1/3" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
                if (visibleStores.length === 0) return (
                  <div className="text-center py-16 space-y-4">
                    <Store className="w-12 h-12 text-white/10 mx-auto" />
                    <p className="text-white/30 text-sm font-light">No hay comercios disponibles</p>
                    <button
                      onClick={() => window.location.reload()}
                      className="text-xs text-amber-400 border border-amber-400/30 px-4 py-2 hover:bg-amber-400/10 transition-colors"
                    >
                      Reintentar
                    </button>
                  </div>
                )
                return (
                  <div>
                    <div className="flex items-center gap-2 mb-5">
                      <Store className="w-3.5 h-3.5 text-amber-500/60" />
                      <span className="text-[10px] uppercase tracking-widest text-white/30 font-light">
                        {visibleStores.length} Comercio{visibleStores.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                      {visibleStores.map(store => {
                        const storeProducts = allProducts.filter(p => {
                          const matchStore = p.storeName === store.name || (p as any).storeSlug === store.slug || (p as any).tenantSlug === store.slug
                          const matchCat = selectedCategory === 'all' || p.category === selectedCategory
                          return matchStore && matchCat
                        }).slice(0, 4)
                        const isEmpty = store.productCount === 0
                        return (
                          <button
                            key={store.id}
                            onClick={() => {
                              if (isEmpty) return
                              setSelectedStore(store.slug); setShowStoresView(false); setActiveSede(null); setStoreSedes([]); window.scrollTo({ top: 0, behavior: 'smooth' })
                            }}
                            className={`group relative bg-white rounded-2xl overflow-hidden text-left flex flex-col shadow-sm transition-all duration-300 border ${isEmpty ? 'cursor-default border-gray-100 opacity-75' : 'hover:shadow-xl border-gray-100 hover:border-amber-300/60 cursor-pointer'}`}
                          >
                            {/* Próximamente overlay for empty stores */}
                            {isEmpty && (
                              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 backdrop-blur-[2px] rounded-2xl">
                                <span style={{ fontSize: '1.6rem', lineHeight: 1, marginBottom: '0.4rem' }}>🚧</span>
                                <p style={{ color: '#d97706', fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Próximamente</p>
                              </div>
                            )}

                            {/* Services ribbon */}
                            {storesWithServices.has(store.slug) && (
                              <div style={{ position: 'absolute', top: 0, left: 0, width: 80, height: 80, zIndex: 30, pointerEvents: 'none', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: 18, left: -22, width: 100, transform: 'rotate(-45deg)', background: 'linear-gradient(90deg,#7c3aed,#a855f7)', color: '#fff', fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.18em', padding: '3px 0', textAlign: 'center' }}>
                                  Servicios
                                </div>
                              </div>
                            )}

                            {/* Banner image — object-contain so logos no se recortan */}
                            <div className="relative w-full bg-gray-50 overflow-hidden shrink-0" style={{ aspectRatio: '16/9' }}>
                              {store.logoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={ensureAbsoluteUrl(store.logoUrl)}
                                  alt={store.name}
                                  className={`w-full h-full object-contain p-3 ${isEmpty ? '' : 'group-hover:scale-105'} transition-transform duration-500`}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Store className={`w-10 h-10 text-gray-200 ${isEmpty ? '' : 'group-hover:text-amber-300'} transition-colors duration-500`} />
                                </div>
                              )}
                              {/* Product count badge */}
                              <span className="absolute top-2 right-2 bg-white/90 border border-gray-200 text-gray-500 text-[9px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm">
                                <Package className="w-2.5 h-2.5" />{store.productCount}
                              </span>
                            </div>

                            {/* Info */}
                            <div className="px-3 pt-2.5 pb-2">
                              <h3 className={`text-xs sm:text-sm font-semibold text-gray-800 ${isEmpty ? '' : 'group-hover:text-amber-600'} transition-colors truncate`}>{store.name}</h3>
                              {store.businessType && (
                                <p className="text-[9px] sm:text-[10px] text-amber-500 uppercase tracking-widest mt-0.5 font-medium truncate">{store.businessType}</p>
                              )}
                              {store.address && (
                                <p className="hidden sm:flex text-[11px] text-gray-400 items-center gap-1 mt-1 truncate">
                                  <MapPin className="w-2.5 h-2.5 shrink-0" />{store.address}
                                </p>
                              )}
                            </div>

                            {/* Product previews */}
                            {loadingAllProducts ? (
                              <div className="px-3 pb-3 flex gap-1">
                                {[0,1,2,3].map(i => <div key={i} className="flex-1 aspect-square bg-gray-100 animate-pulse rounded-lg" />)}
                              </div>
                            ) : storeProducts.length > 0 ? (
                              <div className="px-3 pb-2 grid grid-cols-4 gap-1">
                                {storeProducts.map(p => (
                                  <div key={p.id} className="aspect-square bg-gray-50 border border-gray-100 overflow-hidden rounded-lg">
                                    {p.imageUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={ensureAbsoluteUrl(p.imageUrl)} alt={p.name} className={`w-full h-full object-cover ${isEmpty ? '' : 'group-hover:scale-110'} transition-transform duration-500`} />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center"><Sparkles className="w-3 h-3 text-gray-200" /></div>
                                    )}
                                  </div>
                                ))}
                                {Array.from({ length: Math.max(0, 4 - storeProducts.length) }).map((_, i) => (
                                  <div key={`ep-${i}`} className="aspect-square bg-gray-50 rounded-lg border border-gray-100" />
                                ))}
                              </div>
                            ) : (
                              <div className="px-3 pb-3">
                                <p className="text-[9px] text-gray-300 italic">Sin productos publicados</p>
                              </div>
                            )}

                            {/* CTA */}
                            {!isEmpty && (
                              <div className="px-3 pb-3 mt-auto flex items-center gap-1 text-amber-500/60 text-[9px] sm:text-[10px] uppercase tracking-widest group-hover:text-amber-500 transition-colors font-medium">
                                <span>Explorar</span>
                                <ArrowRight className="w-2.5 h-2.5" />
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* ── All products across stores ── */}
              {(() => {
                const allCats = Array.from(new Set(allProducts.map(p => p.category).filter(Boolean))) as string[]
                const filtered = allProducts.filter(p => {
                  const matchType = businessTypeFilter === 'all' || stores.find(s => (s.name === p.storeName || (s as any).slug === (p as any).storeSlug || (s as any).slug === (p as any).tenantSlug) && s.businessType === businessTypeFilter)
                  const matchCat = selectedCategory === 'all' || p.category === selectedCategory
                  return matchType && matchCat
                })
                if (filtered.length === 0 && !loadingAllProducts) return null
                return (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Package className="w-3.5 h-3.5 text-amber-500/60" />
                        <span className="text-[10px] uppercase tracking-widest text-white/30 font-light">
                          {loadingAllProducts ? 'Cargando productos...' : 'Productos destacados'}
                        </span>
                      </div>
                    </div>

                    {/* Category filter pills */}
                    {allCats.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3 -mx-4 px-4 sm:mx-0 sm:px-0">
                        <button
                          onClick={() => setSelectedCategory('all')}
                          className={`shrink-0 px-3 py-1.5 text-[10px] uppercase tracking-widest rounded-full border transition-all ${
                            selectedCategory === 'all'
                              ? 'bg-amber-500 text-black border-amber-500'
                              : 'border-white/15 text-white/40 hover:border-white/30 hover:text-white/70'
                          }`}
                        >
                          Todos
                        </button>
                        {allCats.map(cat => (
                          <button
                            key={cat}
                            onClick={() => setSelectedCategory(selectedCategory === cat ? 'all' : cat)}
                            className={`shrink-0 px-3 py-1.5 text-[10px] uppercase tracking-widest rounded-full border transition-all ${
                              selectedCategory === cat
                                ? 'bg-amber-500 text-black border-amber-500'
                                : 'border-white/15 text-white/40 hover:border-white/30 hover:text-white/70'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    )}

                    {loadingAllProducts ? (
                      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
                        {[0,1,2,3,4].map(i => (
                          <div key={i} className="bg-white/5 animate-pulse aspect-[3/4] flex-shrink-0 w-36 sm:w-44" />
                        ))}
                      </div>
                    ) : (
                      <div className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
                        {filtered.slice(0, 5).map(product => {
                          const isOffer = !!(product.isOnOffer && product.offerPrice)
                          const inCart = carrito.find(c => c.id === product.id)
                          return (
                            <button
                              key={product.id}
                              onClick={() => openProductModal(product)}
                              className="group relative bg-white/3 border border-white/8 hover:border-amber-500/30 overflow-hidden transition-all duration-300 text-left flex-shrink-0 w-36 sm:w-44"
                            >
                              <div className="relative aspect-[3/4] bg-black/50 overflow-hidden">
                                {product.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={ensureAbsoluteUrl(product.imageUrl)} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center"><Sparkles className="w-8 h-8 text-white/8" /></div>
                                )}
                                {isOffer && (
                                  <div className="absolute top-2 left-2 bg-gradient-to-r from-red-600 to-orange-600 text-white text-[9px] font-bold px-1.5 py-0.5">OFERTA</div>
                                )}
                                {inCart && (
                                  <div className="absolute bottom-2 right-2 bg-amber-500 text-black text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{inCart.cantidad}</div>
                                )}
                              </div>
                              <div className="p-2.5">
                                <p className="text-[11px] text-white/70 truncate font-light">{product.name}</p>
                                {product.storeName && (
                                  <p className="text-[9px] text-white/25 truncate mt-0.5 uppercase tracking-wide">{product.storeName}</p>
                                )}
                                <p className="text-xs text-amber-400 font-light mt-1">
                                  {isOffer ? formatCOP(product.offerPrice!) : formatCOP(product.salePrice)}
                                </p>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })()}

            </div>
          )}
          {/* Category filter — only when a store is selected */}
          {!(showStoresView && selectedStore === 'all') && categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 mb-6 sm:mb-10 -mx-4 px-4">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`shrink-0 px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs uppercase tracking-wider rounded-full border transition-all duration-300 ${selectedCategory === 'all'
                  ? 'bg-amber-500 text-black border-amber-500'
                  : 'bg-transparent text-white/50 border-white/15 hover:border-white/30'
                  }`}
              >
                Todos
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`shrink-0 px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs uppercase tracking-wider rounded-full border transition-all duration-300 ${selectedCategory === cat
                    ? 'bg-amber-500 text-black border-amber-500'
                    : 'bg-transparent text-white/50 border-white/15 hover:border-white/30'
                    }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Products Carousel */}
          {showStoresView && selectedStore === 'all' ? null : loadingProducts ? (
            <div className="text-center py-20">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white/40 text-sm font-light">Cargando perfumes...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-20">
              <Sparkles className="w-12 h-12 text-white/10 mx-auto mb-4" />
              <p className="text-white/40 text-sm font-light">
                {products.length === 0
                  ? 'Próximamente — Los productos estarán disponibles aquí.'
                  : 'No se encontraron productos con ese criterio.'}
              </p>
            </div>
          ) : (
            <div ref={carouselProductsRef} className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth">
              {filteredProducts.map(product => {
                const inCart = carrito.find(c => c.id === product.id)
                const isOffer = product.isOnOffer && product.offerPrice
                const discount = isOffer ? Math.round(((product.salePrice - product.offerPrice!) / product.salePrice) * 100) : 0
                if (productCardStyle === 'style2') {
                  return (
                    <div
                      key={product.id}
                      className="group relative bg-white rounded-lg overflow-hidden shadow-sm border border-gray-100 cursor-pointer hover:shadow-lg transition-all duration-300 flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(33.33%-11px)] lg:w-[calc(20%-13px)]"
                      onClick={() => openProductModal(product)}
                    >
                      <div className="relative aspect-square overflow-hidden bg-gray-50">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={ensureAbsoluteUrl(product.imageUrl)} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Package className="w-10 h-10 text-gray-300" /></div>
                        )}
                        {isOffer && (
                          <div className="absolute top-2 left-2 z-20 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-sm">-{discount}%</div>
                        )}
                        {inCart && (
                          <div className="absolute top-2 right-2 z-20 flex items-center gap-0.5 bg-amber-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-sm">
                            <ShoppingCart className="w-2.5 h-2.5" />×{inCart.cantidad}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-2 z-10">
                          <div className="flex items-center gap-1.5">
                            <button onClick={(e) => { e.stopPropagation(); agregarAlCarrito(product) }} className="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center text-gray-700 hover:bg-amber-500 hover:text-white transition-colors" title="Agregar al carrito">
                              <ShoppingCart className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); openProductModal(product) }} className="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center text-gray-700 hover:bg-gray-800 hover:text-white transition-colors" title="Ver detalle">
                              <Search className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); toggleFavorite(product.id) }} className={`w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center transition-colors ${favorites.has(product.id) ? 'text-red-500' : 'text-gray-700 hover:text-red-500'}`} title="Favorito">
                              <Heart className={`w-3.5 h-3.5 ${favorites.has(product.id) ? 'fill-current' : ''}`} />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="p-2">
                        <h3 className="text-xs font-medium text-gray-800 line-clamp-2 mb-1 leading-snug">{product.name}</h3>
                        <div className="flex items-center gap-1.5">
                          {isOffer ? (
                            <>
                              <span className="text-gray-400 text-[10px] line-through">{formatCOP(product.salePrice)}</span>
                              <span className="text-gray-900 font-bold text-xs">{formatCOP(product.offerPrice!)}</span>
                            </>
                          ) : (
                            <span className="text-gray-900 font-bold text-xs">{formatCOP(product.salePrice)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                }
                return (
                  <div
                    key={product.id}
                    className="group relative overflow-hidden cursor-pointer hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/60 transition-all duration-500 flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(33.33%-11px)] lg:w-[calc(20%-13px)]"
                    onClick={() => openProductModal(product)}
                  >
                    <div data-dark className="relative aspect-[3/4] overflow-hidden bg-black/60">
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ensureAbsoluteUrl(product.imageUrl)} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-white/3"><Sparkles className="w-10 h-10 text-white/10" /></div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                      {isOffer && (
                        <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1 bg-gradient-to-r from-red-600 to-orange-500 text-white text-[10px] font-bold px-2 py-0.5 shadow-lg shadow-red-900/40">
                          <Flame className="w-2.5 h-2.5" />-{discount}%
                        </div>
                      )}
                      {product.brand && (
                        <div className="absolute top-2.5 right-2.5 z-20 px-2 py-0.5 text-[9px] text-white/60 uppercase tracking-[0.2em]">{product.brand}</div>
                      )}
                      {inCart && (
                        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-amber-500 text-black text-[9px] font-bold px-2 py-0.5">
                          <ShoppingCart className="w-2.5 h-2.5" />×{inCart.cantidad}
                        </div>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(product.id) }}
                        className={`absolute bottom-[56px] right-2.5 z-20 w-7 h-7 flex items-center justify-center transition-all duration-300 ${favorites.has(product.id) ? 'text-red-500' : 'text-white/50 hover:text-red-400'}`}
                        title="Favorito"
                      >
                        <Heart className={`w-3 h-3 ${favorites.has(product.id) ? 'fill-current' : ''}`} />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 z-10 px-3 pt-2 pb-[52px]">
                        <h3 className="text-xs font-light text-white leading-snug line-clamp-2 mb-1">{product.name}</h3>
                        {product.size && <p className="text-[9px] text-white/35 mb-1">{product.size}</p>}
                        <div className="flex items-center gap-2">
                          {isOffer ? (
                            <>
                              <span className="text-orange-400 font-semibold text-sm">{formatCOP(product.offerPrice!)}</span>
                              <span className="text-white/30 text-xs line-through">{formatCOP(product.salePrice)}</span>
                            </>
                          ) : (
                            <span className="text-amber-400 font-light text-sm">{formatCOP(product.salePrice)}</span>
                          )}
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center gap-0 translate-y-0 sm:translate-y-full sm:group-hover:translate-y-0 transition-transform duration-300 ease-out">
                        <button
                          onClick={(e) => { e.stopPropagation(); agregarAlCarrito(product) }}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-amber-500/70 hover:bg-amber-500/90 text-black text-[9px] font-semibold uppercase tracking-wider transition-colors"
                        >
                          <ShoppingCart className="w-3 h-3" />Añadir
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openProductModal(product) }}
                          className="w-10 h-full flex items-center justify-center text-white/70 hover:text-white transition-all"
                          title="Ver detalle"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </RevealSection>
      )}



      {/* ========== HERO 6 — Footer con Logo, Info, Enlaces Legales, Contacto ========== */}
      {!showProductModal && <footer className="border-t border-white/10 landing-footer py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {storeConfig?.storeInfo ? (
            <div className={`grid gap-6 md:gap-8 ${storeConfig.storeInfo.address ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-2 md:grid-cols-4'}`}>
              {/* Logo & Brand */}
              <div className="col-span-2 md:col-span-1 space-y-4">
                {storeConfig.storeInfo.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={storeConfig.storeInfo.logoUrl} alt={storeConfig.storeInfo.name} className="h-20 w-auto object-contain" />
                ) : (
                  <span className="text-lg font-light tracking-[0.4em] text-white/60 uppercase">
                    {storeConfig.storeInfo.name}
                  </span>
                )}
                <p className="text-white/30 text-xs font-light leading-relaxed">
                  {storeConfig.storeInfo.name}
                </p>
                {/* Social Media */}
                <div className="flex items-center gap-4 pt-2">
                  {storeConfig.storeInfo.socialInstagram && (
                    <a href={storeConfig.storeInfo.socialInstagram} target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-pink-400 transition-colors"><Instagram className="w-5 h-5" /></a>
                  )}
                  {storeConfig.storeInfo.socialFacebook && (
                    <a href={storeConfig.storeInfo.socialFacebook} target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-blue-400 transition-colors"><Facebook className="w-5 h-5" /></a>
                  )}
                  {storeConfig.storeInfo.socialTiktok && (
                    <a href={storeConfig.storeInfo.socialTiktok} target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-cyan-400 transition-colors">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.83a8.28 8.28 0 004.76 1.5v-3.4a4.85 4.85 0 01-1-.24z" /></svg>
                    </a>
                  )}
                  {storeConfig.storeInfo.socialWhatsapp && (
                    <button onClick={() => setShowWhatsappModal(true)} className="text-white/30 hover:text-green-400 transition-colors">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.52 3.48A12.07 12.07 0 0 0 12 0C5.37 0 0 5.37 0 12c0 2.12.55 4.19 1.6 6.02L0 24l6.18-1.62A12.07 12.07 0 0 0 12 24c6.63 0 12-5.37 12-12 0-3.21-1.25-6.23-3.48-8.52zM12 22c-1.85 0-3.68-.5-5.26-1.44l-.38-.22-3.67.96.98-3.58-.25-.37A9.94 9.94 0 0 1 2 12C2 6.48 6.48 2 12 2c2.54 0 4.93.99 6.73 2.77A9.48 9.48 0 0 1 22 12c0 5.52-4.48 10-10 10z"/></svg>
                    </button>
                  )}
                  {storeConfig.storeInfo.email && (
                    <a href={`mailto:${storeConfig.storeInfo.email}`} className="text-white/30 hover:text-amber-400 transition-colors"><Mail className="w-5 h-5" /></a>
                  )}
                </div>
              </div>

              {/* Información Legal */}
              <div className="space-y-3">
                <h4 className="text-xs text-white/50 uppercase tracking-[0.2em] font-medium">Legal</h4>
                <ul className="space-y-2">
                  {storeConfig.storeInfo.termsContent && (
                    <li>
                      <button
                        onClick={() => setLegalModal({ title: 'Términos y condiciones', content: storeConfig.storeInfo!.termsContent! })}
                        className="text-white/40 text-sm font-light hover:text-amber-400 transition-colors flex items-center gap-1.5"
                      >
                        <FileText className="w-3 h-3" />
                        Términos y condiciones
                      </button>
                    </li>
                  )}
                  {storeConfig.storeInfo.privacyContent && (
                    <li>
                      <button
                        onClick={() => setLegalModal({ title: 'Política de privacidad', content: storeConfig.storeInfo!.privacyContent! })}
                        className="text-white/40 text-sm font-light hover:text-amber-400 transition-colors flex items-center gap-1.5"
                      >
                        <Shield className="w-3 h-3" />
                        Política de privacidad
                      </button>
                    </li>
                  )}
                  {storeConfig.storeInfo.shippingTerms && (
                    <li>
                      <button
                        onClick={() => setLegalModal({ title: 'Términos de envío', content: storeConfig.storeInfo!.shippingTerms! })}
                        className="text-white/40 text-sm font-light hover:text-amber-400 transition-colors flex items-center gap-1.5"
                      >
                        <Truck className="w-3 h-3" />
                        Términos de envío
                      </button>
                    </li>
                  )}
                  {storeConfig.storeInfo.paymentMethods && (
                    <li className="text-white/40 text-sm font-light">
                      <span className="text-white/50 text-xs uppercase tracking-wider">Medios de pago:</span>
                      <br />
                      {storeConfig.storeInfo.paymentMethods}
                    </li>
                  )}
                </ul>
              </div>

              {/* Contacto */}
              <div className="space-y-3">
                <h4 className="text-xs text-white/50 uppercase tracking-[0.2em] font-medium">Contacto</h4>
                <ul className="space-y-2 text-white/40 text-sm font-light">
                  {storeConfig.storeInfo.address && (
                    <li className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-amber-400/50" />
                      {storeConfig.storeInfo.locationMapUrl ? (
                        <a href={storeConfig.storeInfo.locationMapUrl} target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition-colors">
                          {storeConfig.storeInfo.address}
                        </a>
                      ) : (
                        <span>{storeConfig.storeInfo.address}</span>
                      )}
                    </li>
                  )}
                  {storeConfig.storeInfo.phone && (
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 shrink-0 text-amber-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                      {storeConfig.storeInfo.phone}
                    </li>
                  )}
                  {storeConfig.storeInfo.email && (
                    <li className="flex items-center gap-2">
                      <Mail className="w-4 h-4 shrink-0 text-amber-400/50" />
                      <a href={`mailto:${storeConfig.storeInfo.email}`} className="hover:text-amber-400 transition-colors">
                        {storeConfig.storeInfo.email}
                      </a>
                    </li>
                  )}
                </ul>
              </div>

              {/* Horarios */}
              <div className="space-y-3">
                <h4 className="text-xs text-white/50 uppercase tracking-[0.2em] font-medium">Horarios</h4>
                {storeConfig.storeInfo.schedule ? (
                  <p className="text-white/40 text-sm font-light leading-relaxed whitespace-pre-line">{storeConfig.storeInfo.schedule}</p>
                ) : (
                  <p className="text-white/30 text-sm font-light">Consulta nuestros horarios</p>
                )}
              </div>

              {/* Ubicación — enlace a Google Maps */}
              {storeConfig.storeInfo.address && (
                <div className="space-y-3 col-span-2 md:col-span-1">
                  <h4 className="text-xs text-white/50 uppercase tracking-[0.2em] font-medium">Ubicación</h4>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(storeConfig.storeInfo.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg border border-white/10 hover:border-amber-400/40 hover:bg-white/5 transition-all duration-300 group"
                    title="Abrir en Google Maps"
                  >
                    <MapPin className="w-5 h-5 text-amber-400 shrink-0" />
                    <span className="text-white/70 group-hover:text-white text-sm transition-colors">{storeConfig.storeInfo.address}</span>
                  </a>
                </div>
              )}
            </div>
          ) : (
            /* Default footer when no store config */
            <div className="flex flex-col items-center gap-6">
              <span className="text-lg font-light tracking-[0.4em] text-white/60 uppercase">Tienda</span>
              <p className="text-white/30 text-xs font-light text-center max-w-md">
                Selecciona una tienda para ver su información.
              </p>
            </div>
          )}

          <div className="mt-10 pt-6 border-t border-white/5 text-center">
            <p className="text-white/20 text-xs tracking-wider">
              © {new Date().getFullYear()} {storeConfig?.storeInfo?.name || 'Tienda'} — Todos los derechos reservados
            </p>
          </div>
        </div>
      </footer>}
      </>
      )}

      {/* ========== DROP POPUP (First visit) ========== */}
      {showDropPopup && storeConfig?.activeDrop && (
        <>
          <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm" onClick={dismissDropPopup} />
          <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
            <div className="landing-sidebar border border-white/10 max-w-md w-full shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
              <button onClick={dismissDropPopup} className="absolute top-3 right-3 z-10 text-white/50 hover:text-white transition-colors bg-black/40 rounded-full p-1">
                <X className="w-5 h-5" />
              </button>
              {storeConfig.activeDrop.bannerUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={storeConfig.activeDrop.bannerUrl} alt={storeConfig.activeDrop.name} className="w-full h-48 object-cover" />
              )}
              <div className="p-6 text-center space-y-4">
                <div className="inline-flex items-center gap-2 text-amber-400 text-xs uppercase tracking-[0.3em]">
                  <Flame className="w-4 h-4" /> Nuevo Drop
                </div>
                <h3 className="text-2xl font-light text-white">{storeConfig.activeDrop.name}</h3>
                {storeConfig.activeDrop.description && (
                  <p className="text-white/50 text-sm font-light">{storeConfig.activeDrop.description}</p>
                )}
                {storeConfig.activeDrop.globalDiscount > 0 && (
                  <p className="text-lg text-amber-400 font-light">Hasta {storeConfig.activeDrop.globalDiscount}% OFF</p>
                )}
                <div className="flex items-center justify-center gap-2 text-white/60">
                  <Timer className="w-4 h-4 text-amber-400" />
                  <span className="font-mono text-sm">{countdownText}</span>
                </div>
                <button
                  onClick={() => { dismissDropPopup(); setShowDrop(true); setShowCatalog(false) }}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-black uppercase tracking-[0.2em] text-xs font-bold hover:from-amber-400 hover:to-yellow-400 transition-all"
                >
                  Ver Drop
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ========== SERVICES SIDE TAG (Mobile, when store has services) ========== */}
      {publicServices.length > 0 && !showServices && selectedStore && selectedStore !== 'all' && (
        <button
          onClick={() => { setShowServices(true); setShowCatalog(false); setShowDrop(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          className="md:hidden fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-black border-l border-t border-b border-white/10 text-white px-2 py-4 shadow-lg shadow-black/50 hover:px-3 hover:border-white/20 transition-all duration-300"
        >
          <div className="flex flex-col items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ filter: 'drop-shadow(0 0 0.5px white)' }} />
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', WebkitTextStroke: '0.4px white' }}>
              Servicios
            </span>
          </div>
        </button>
      )}

      {/* ========== DROP SIDE TAG (Persistent) ========== */}
      {dropPopupSeen && !showDrop && storeConfig?.activeDrop && countdownText !== 'Finalizado' && (
        <button
          onClick={() => { setShowDrop(true); setShowCatalog(false) }}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-40 bg-black border-r border-t border-b border-white/10 text-amber-400 px-2 py-4 shadow-lg shadow-black/50 hover:px-3 hover:border-amber-500/30 transition-all duration-300 group"
        >
          <div className="flex flex-col items-center gap-2 writing-vertical">
            <Flame className="w-4 h-4 shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
              DROP
            </span>
            <span className="text-[9px] font-mono" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
              {countdownText}
            </span>
          </div>
        </button>
      )}

      {/* ========== FLOATING CART BUTTON (hidden on mobile, bottom nav handles it) ========== */}
      {totalItems > 0 && !showCart && (
        <button
          onClick={() => setShowCart(true)}
          className="hidden md:flex fixed bottom-6 right-6 z-40 bg-amber-500 hover:bg-amber-400 text-black p-4 rounded-full shadow-2xl shadow-amber-500/30 transition-all duration-300 hover:scale-110 group items-center justify-center"
        >
          <ShoppingCart className="w-6 h-6" />
          <span className="absolute -top-2 -right-2 bg-black text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-amber-500">
            {totalItems}
          </span>
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-black/90 text-white text-xs font-light px-3 py-1.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {formatCOP(totalCarrito)}
          </span>
        </button>
      )}

      {/* ========== CHATBOT FLOATING BUTTON ========== */}
      {chatbotStatus?.enabled && selectedStore !== 'all' && (() => {
        const btnColor = chatbotStatus.accentColor || '#f59e0b'
        const btnColorHex = btnColor.replace('#', '')
        const r = parseInt(btnColorHex.substring(0,2),16), g = parseInt(btnColorHex.substring(2,4),16), b = parseInt(btnColorHex.substring(4,6),16)
        const isLight = (0.299*r + 0.587*g + 0.114*b)/255 > 0.5
        const iconCls = isLight ? 'text-gray-900' : 'text-white'
        return (
          <button
            onClick={() => setShowChatWidget(v => !v)}
            className={`hidden md:flex fixed ${totalItems > 0 && !showCart ? 'bottom-24' : 'bottom-6'} right-6 z-40 p-4 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 group items-center justify-center`}
            style={{ background: btnColor }}
            title={`Chatear con ${chatbotStatus.botName}`}
          >
            <svg className={`w-6 h-6 ${iconCls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
            <span
              className="absolute right-full mr-3 top-1/2 -translate-y-1/2 text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md"
              style={{ background: btnColor, color: isLight ? '#111827' : '#ffffff' }}
            >
              {chatbotStatus.botName}
            </span>
          </button>
        )
      })()}

      {/* ChatWidget */}
      {showChatWidget && chatbotStatus?.enabled && selectedStore !== 'all' && (
        <ChatWidget
          storeSlug={selectedStore}
          botName={chatbotStatus.botName}
          botAvatarUrl={chatbotStatus.botAvatarUrl}
          accentColor={chatbotStatus.accentColor}
          onClose={() => setShowChatWidget(false)}
          onProductClick={async (productId) => {
            // 1. Try products already loaded in state
            const found = products.find(p => String(p.id) === String(productId))
            if (found) { openProductModal(found); return }
            // 2. Fetch full list from storefront API (fallback for paginated stores)
            try {
              const r = await fetch(`${API_URL}/storefront/products?store=${selectedStore}&limit=200`)
              const j = await r.json()
              if (j.success && j.data?.products) {
                const match = (j.data.products as any[]).find((p: any) => String(p.id) === String(productId))
                if (match) { openProductModal(match); return }
              }
            } catch { /* ignore */ }
          }}
        />
      )}

      {/* ========== FLOATING WHATSAPP BUTTON (only when no chatbot) ========== */}
      {!chatbotStatus?.enabled && storeConfig?.storeInfo?.socialWhatsapp && (
        <button
          onClick={() => setShowWhatsappModal(true)}
          className={`hidden md:flex fixed ${totalItems > 0 && !showCart ? 'bottom-24' : 'bottom-6'} right-6 z-40 bg-green-500 hover:bg-green-400 text-white p-4 rounded-full shadow-2xl shadow-green-500/30 transition-all duration-300 hover:scale-110 group items-center justify-center`}
          title="Enviar mensaje por WhatsApp"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-black/90 text-white text-xs font-light px-3 py-1.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            WhatsApp
          </span>
        </button>
      )}

      {/* ========== WHATSAPP MODAL ========== */}
      {showWhatsappModal && storeConfig?.storeInfo?.socialWhatsapp && (
        <>
          <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm" onClick={() => setShowWhatsappModal(false)} />
          <div className={`fixed bottom-6 right-6 z-[71] w-80 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200 ${isLightBg ? 'bg-white border border-gray-200 shadow-gray-300/60' : 'bg-[#111] border border-white/10 shadow-black/60'}`}>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-green-600">
              <svg className="w-5 h-5 text-white flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              <span className="text-white text-sm font-semibold flex-1">WhatsApp</span>
              <button onClick={() => setShowWhatsappModal(false)} className="text-white/70 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Body */}
            <div className="p-4 space-y-3">
              <p className={`text-xs ${isLightBg ? 'text-gray-500' : 'text-white/50'}`}>Edita tu mensaje antes de enviarlo:</p>
              <textarea
                className={`w-full rounded-xl text-sm px-3 py-2.5 resize-none focus:outline-none transition-colors ${isLightBg ? 'bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-green-400 focus:ring-1 focus:ring-green-400/30' : 'bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:border-green-500/50'}`}
                rows={3}
                value={whatsappMessage}
                onChange={(e) => setWhatsappMessage(e.target.value)}
                placeholder="Escribe tu mensaje..."
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowWhatsappModal(false)}
                  className={`flex-1 py-2 rounded-xl text-sm transition-colors ${isLightBg ? 'border border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300 hover:bg-gray-50' : 'border border-white/10 text-white/50 hover:text-white hover:border-white/20'}`}
                >
                  Cancelar
                </button>
                <a
                  href={`https://api.whatsapp.com/send/?phone=${storeConfig.storeInfo.socialWhatsapp}&text=${encodeURIComponent(whatsappMessage)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowWhatsappModal(false)}
                  className="flex-1 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-semibold text-center transition-colors"
                >
                  Enviar mensaje
                </a>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ========== CART SIDEBAR ========== */}
      {showCart && (
        <>
          <div className="fixed inset-0 z-[65] bg-black/60 backdrop-blur-sm" onClick={() => setShowCart(false)} />
          <div
            className="fixed top-0 right-0 h-full w-full max-w-md z-[65] flex flex-col shadow-2xl animate-in slide-in-from-right duration-300"
            style={{ backgroundColor: '#111111', borderLeft: '1px solid rgba(255,255,255,0.12)' }}
          >
            {/* Header */}
            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.12)', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#111111' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ShoppingCart style={{ width: 18, height: 18, color: '#ffffff' }} />
                <span style={{ fontSize: 15, fontWeight: 600, color: '#ffffff', letterSpacing: '0.02em' }}>
                  Mi Carrito
                </span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: 400 }}>
                  ({totalItems})
                </span>
              </div>
              <button
                onClick={() => setShowCart(false)}
                style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}
              >
                <X style={{ width: 15, height: 15 }} />
              </button>
            </div>

            {/* Items */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0', backgroundColor: '#111111' }}>
              {carrito.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 24px' }}>
                  <ShoppingCart style={{ width: 44, height: 44, color: 'rgba(255,255,255,0.15)', margin: '0 auto 16px' }} />
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 20 }}>Tu carrito está vacío</p>
                  <button
                    onClick={() => { setShowCart(false); scrollToPerfumes() }}
                    style={{ width: '100%', backgroundColor: '#ffffff', color: '#000000', fontSize: 12, fontWeight: 700, padding: '12px', textTransform: 'uppercase', letterSpacing: '0.15em', cursor: 'pointer', border: 'none' }}
                  >
                    Explorar productos
                  </button>
                </div>
              ) : (() => {
                const storeGroups = new Map<string, ProductoCarrito[]>()
                for (const item of carrito) {
                  const key = item.storeName || 'Tienda'
                  if (!storeGroups.has(key)) storeGroups.set(key, [])
                  storeGroups.get(key)!.push(item)
                }
                const hasMultipleStores = storeGroups.size > 1

                return Array.from(storeGroups.entries()).map(([storeName, items]) => (
                  <div key={storeName}>
                    {hasMultipleStores && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 24px 4px', paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
                        <Store style={{ width: 13, height: 13, color: 'rgba(255,255,255,0.5)' }} />
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{storeName}</span>
                      </div>
                    )}
                    {items.map((item, index) => (
                      <div
                        key={`${item.id}-${index}`}
                        style={{ display: 'flex', gap: 14, padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#111111' }}
                      >
                        {/* Imagen */}
                        <div style={{ width: 64, height: 64, flexShrink: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.06)' }}>
                          {item.imagen ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={ensureAbsoluteUrl(item.imagen)} alt={item.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Sparkles style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.2)' }} />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#ffffff', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                            {item.nombre}
                          </p>
                          {item.perfumeSeleccionado && (
                            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: '2px 0 0' }}>Perfume: {item.perfumeSeleccionado}</p>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>{formatCOP(item.precio)} c/u</span>
                            {item.precioOriginal && item.precioOriginal > item.precio && (
                              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textDecoration: 'line-through' }}>{formatCOP(item.precioOriginal)}</span>
                            )}
                            {item.descuentoPorcentaje && item.descuentoPorcentaje > 0 && (
                              <span style={{ fontSize: 10, color: '#34d399', fontWeight: 600 }}>-{item.descuentoPorcentaje}%</span>
                            )}
                          </div>

                          {/* Cantidad */}
                          <div style={{ display: 'flex', alignItems: 'center', marginTop: 8, border: '1px solid rgba(255,255,255,0.25)', width: 'fit-content' }}>
                            <button
                              onClick={() => actualizarCantidad(item.id, -1, item.tempId)}
                              style={{ width: 30, height: 30, backgroundColor: '#000000', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRight: '1px solid rgba(255,255,255,0.25)', cursor: 'pointer' }}
                            >
                              <Minus style={{ width: 11, height: 11 }} />
                            </button>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', width: 32, textAlign: 'center' }}>{item.cantidad}</span>
                            <button
                              onClick={() => actualizarCantidad(item.id, 1, item.tempId)}
                              style={{ width: 30, height: 30, backgroundColor: '#000000', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.25)', cursor: 'pointer' }}
                            >
                              <Plus style={{ width: 11, height: 11 }} />
                            </button>
                          </div>
                        </div>

                        {/* Precio total y eliminar */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', flexShrink: 0 }}>
                          <button
                            onClick={() => removerProducto(item)}
                            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 2 }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
                          >
                            <X style={{ width: 14, height: 14 }} />
                          </button>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>{formatCOP(item.precio * item.cantidad)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              })()}
            </div>

            {/* Footer */}
            {carrito.length > 0 && (() => {
              const uniqueStores = new Set(carrito.map(i => i.tenantId).filter(Boolean))
              const multiStore = uniqueStores.size > 1
              return (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', padding: '20px 24px', backgroundColor: '#000000', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {multiStore && (
                    <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', textAlign: 'center' }}>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
                        Productos de {uniqueStores.size} tiendas — se crearán pedidos separados.
                      </p>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600 }}>Total</span>
                    <span style={{ fontSize: 22, fontWeight: 800, color: '#ffffff' }}>{formatCOP(totalCarrito)}</span>
                  </div>
                  <button
                    onClick={() => { setShowCart(false); handleIrAlCheckout() }}
                    style={{ width: '100%', backgroundColor: '#ffffff', color: '#000000', padding: '15px', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.18em', border: 'none', cursor: 'pointer' }}
                  >
                    {carritoTieneDelivery ? 'Pedir Domicilio' : 'Finalizar Compra'}
                  </button>
                  <button
                    onClick={() => { setShowCart(false); scrollToPerfumes() }}
                    style={{ width: '100%', backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.25)', color: '#ffffff', padding: '11px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', cursor: 'pointer' }}
                  >
                    Seguir comprando
                  </button>
                </div>
              )
            })()}
          </div>
        </>
      )}

      {/* ========== DECANT MODAL ========== */}
      {showDecantModal && decantProduct && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="landing-sidebar border border-white/10 w-full max-w-md p-6 sm:p-8 space-y-8 relative shadow-2xl shadow-amber-500/10">
            <button
              onClick={() => setShowDecantModal(false)}
              className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-2">
              <p className="text-amber-500 text-xs uppercase tracking-[0.2em]">Personaliza tu</p>
              <h3 className="text-2xl font-light text-white">{decantProduct.name}</h3>
              <p className="text-white/40 text-xs font-light">Stock disponible (envases): {decantProduct.stock}</p>
            </div>

            <div className="space-y-6">


              {/* Perfume Selector */}
              <div className="space-y-3">
                <label className="text-xs text-white/50 uppercase tracking-widest">Elige el perfume</label>
                <div className="relative">
                  <select
                    value={selectedPerfumeId}
                    onChange={(e) => setSelectedPerfumeId(e.target.value)}
                    className="w-full appearance-none bg-white/5 border border-white/10 text-white py-4 px-4 pr-10 focus:border-amber-500 focus:outline-none rounded-none text-sm font-light cursor-pointer"
                  >
                    <option value="" className="bg-zinc-900 text-white/50">Selecciona una fragancia...</option>
                    {products
                      .filter(p => !p.category.toLowerCase().includes('decant') && p.id !== decantProduct.id)
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(p => {
                        const isAvailable = p.stock > 0
                        return (
                          <option key={p.id} value={p.id} disabled={!isAvailable} className="bg-zinc-900 text-white disabled:text-white/20">
                            {p.name} {p.brand ? `— ${p.brand}` : ''} ({isAvailable ? `Stock: ${p.stock}` : 'Agotado'})
                          </option>
                        )
                      })
                    }
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                </div>
              </div>

              <Button
                onClick={handleConfirmDecant}
                className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black py-6 rounded-none uppercase tracking-[0.2em] text-xs font-bold mt-4"
              >
                Agregar al Carrito
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========== CLIENT LOGIN MODAL ========== */}
      {showClientLogin && !isAuthenticated && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm"
            onClick={() => setShowClientLogin(false)}
          />

          {/* Desktop: centered · Mobile: bottom sheet */}
          <div className="fixed inset-0 z-[81] flex items-end sm:items-center justify-center pointer-events-none">
            <div
              className={`w-full sm:max-w-[400px] pointer-events-auto animate-in sm:fade-in slide-in-from-bottom sm:slide-in-from-bottom-0 duration-300 border-t sm:border ${
                isLightBg
                  ? 'bg-white border-black/12 sm:shadow-[0_32px_80px_rgba(0,0,0,0.18)]'
                  : 'bg-[#0d0d0d] border-white/10 sm:shadow-[0_32px_80px_rgba(0,0,0,0.8)]'
              }`}
              onClick={e => e.stopPropagation()}
            >
              {/* Mobile drag handle */}
              <div className={`sm:hidden flex justify-center pt-3 pb-1 ${isLightBg ? 'bg-white' : 'bg-[#0d0d0d]'}`}>
                <div className={`w-10 h-1 rounded-full ${isLightBg ? 'bg-black/15' : 'bg-white/15'}`} />
              </div>

              {/* Header */}
              <div className={`relative px-8 pt-8 sm:pt-10 pb-6 border-b ${isLightBg ? 'border-black/8' : 'border-white/8'}`}>
                <button
                  onClick={() => setShowClientLogin(false)}
                  className={`absolute top-4 right-5 p-1 transition-colors ${isLightBg ? 'text-black/25 hover:text-black/60' : 'text-white/25 hover:text-white/60'}`}
                  aria-label="Cerrar"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Logo mark */}
                <div className={`w-10 h-10 border flex items-center justify-center mb-5 ${isLightBg ? 'border-black/15' : 'border-white/15'}`}>
                  <User className={`w-4 h-4 ${isLightBg ? 'text-black/50' : 'text-white/50'}`} />
                </div>

                <h2 className={`text-xl font-light tracking-tight ${isLightBg ? 'text-black' : 'text-white'}`}>
                  Inicia sesión
                </h2>
                <p className={`text-[11px] uppercase tracking-[0.2em] mt-1 font-light ${isLightBg ? 'text-black/40' : 'text-white/40'}`}>
                  Accede a tus pedidos y perfil
                </p>
              </div>

              {/* Body */}
              <div className="px-8 py-7 space-y-5">

                {/* Google */}
                <div ref={clientGoogleBtnRef} className="w-full flex justify-center">
                  <GoogleLogin
                    onSuccess={handleClientGoogleLogin}
                    onError={() => setClientLoginError('Error al conectar con Google')}
                    theme={isLightBg ? 'outline' : 'filled_black'}
                    size="large"
                    width={clientGoogleBtnWidth}
                    text="signin_with"
                    shape="rectangular"
                  />
                </div>

                {/* Divider */}
                <div className="flex items-center gap-4">
                  <div className={`flex-1 h-px ${isLightBg ? 'bg-black/8' : 'bg-white/8'}`} />
                  <span className={`text-[9px] uppercase tracking-[0.3em] font-light ${isLightBg ? 'text-black/30' : 'text-white/30'}`}>o continúa con correo</span>
                  <div className={`flex-1 h-px ${isLightBg ? 'bg-black/8' : 'bg-white/8'}`} />
                </div>

                {/* Fields */}
                <form onSubmit={handleClientLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className={`block text-[9px] uppercase tracking-[0.25em] font-light ${isLightBg ? 'text-black/40' : 'text-white/40'}`}>
                      Correo electrónico
                    </label>
                    <input
                      type="email"
                      placeholder="correo@ejemplo.com"
                      value={clientLoginForm.email}
                      onChange={e => setClientLoginForm(p => ({ ...p, email: e.target.value }))}
                      className={`w-full border px-4 py-3 text-sm font-light focus:outline-none transition-colors bg-transparent ${
                        isLightBg
                          ? 'border-black/15 text-black placeholder-black/25 focus:border-black/50'
                          : 'border-white/12 text-white placeholder-white/20 focus:border-white/50'
                      }`}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className={`block text-[9px] uppercase tracking-[0.25em] font-light ${isLightBg ? 'text-black/40' : 'text-white/40'}`}>
                      Contraseña
                    </label>
                    <input
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={clientLoginForm.password}
                      onChange={e => setClientLoginForm(p => ({ ...p, password: e.target.value }))}
                      className={`w-full border px-4 py-3 text-sm font-light focus:outline-none transition-colors bg-transparent ${
                        isLightBg
                          ? 'border-black/15 text-black placeholder-black/25 focus:border-black/50'
                          : 'border-white/12 text-white placeholder-white/20 focus:border-white/50'
                      }`}
                      required
                    />
                  </div>

                  {clientLoginError && (
                    <p className={`text-[11px] font-light px-3 py-2 border border-red-500/30 bg-red-500/8 ${isLightBg ? 'text-red-600' : 'text-red-400'}`}>
                      {clientLoginError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={clientLoginLoading}
                    style={{ backgroundColor: isLightBg ? '#000' : '#fff', color: isLightBg ? '#fff' : '#000' }}
                    className="w-full py-3.5 text-[11px] uppercase tracking-[0.3em] font-light disabled:opacity-40 disabled:cursor-not-allowed transition-opacity hover:opacity-75 flex items-center justify-center gap-2"
                  >
                    {clientLoginLoading ? (
                      <span className={`w-4 h-4 border border-current/30 border-t-current rounded-full animate-spin`} />
                    ) : (
                      'Entrar'
                    )}
                  </button>
                </form>
              </div>

              {/* Footer */}
              <div className={`px-8 pb-8 sm:pb-6 pt-0 text-center border-t ${isLightBg ? 'border-black/6' : 'border-white/6'}`}>
                <button
                  onClick={() => { setShowClientLogin(false); onGoToLogin() }}
                  className={`text-[10px] uppercase tracking-[0.2em] font-light transition-colors pt-5 block w-full ${isLightBg ? 'text-black/35 hover:text-black/70' : 'text-white/35 hover:text-white/70'}`}
                >
                  ¿Eres comerciante?{' '}
                  <span className={`underline underline-offset-4 ${isLightBg ? 'text-black/60' : 'text-white/60'}`}>
                    Accede al panel
                  </span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ========== DESKTOP: MI CUENTA PANEL ========== */}
      {showAccountPanel && isAuthenticated && authUser && (
        <>
          <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm" onClick={() => setShowAccountPanel(false)} />
          <div className="fixed top-0 right-0 bottom-0 z-[71] w-full max-w-md flex flex-col landing-sidebar border-l border-white/10 shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                  <User className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white leading-tight">{authUser.name}</p>
                  <p className="text-xs text-white/40 leading-tight">{authUser.email}</p>
                </div>
              </div>
              <button onClick={() => setShowAccountPanel(false)} className="text-white/30 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/10 shrink-0">
              {([
                { key: 'perfil',    label: 'Mi Perfil',    icon: <MapPin className="w-3.5 h-3.5" /> },
                { key: 'pedidos',   label: 'Pedidos',      icon: <Package className="w-3.5 h-3.5" /> },
                { key: 'favoritos', label: 'Favoritos',    icon: <Heart className="w-3.5 h-3.5" /> },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setAccountTab(tab.key); if (tab.key === 'pedidos') fetchClientOrders() }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs uppercase tracking-wider transition-colors border-b-2 ${
                    accountTab === tab.key
                      ? 'border-amber-400 text-amber-400'
                      : 'border-transparent text-white/40 hover:text-white/70'
                  }`}
                >
                  {tab.icon}{tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">

              {/* ── MI PERFIL ── */}
              {accountTab === 'perfil' && (
                <div className="p-6 space-y-6">

                  {/* Datos personales */}
                  <section className="space-y-3">
                    <h4 className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-medium">Datos personales</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Teléfono',  value: authUser.phone },
                        { label: 'Cédula',    value: authUser.cedula },
                      ].map(f => (
                        <div key={f.label} className="bg-white/5 border border-white/10 p-3 space-y-1">
                          <p className="text-[10px] text-white/30 uppercase tracking-wider">{f.label}</p>
                          <p className="text-sm text-white font-light">{f.value || <span className="text-white/20 italic text-xs">Sin datos</span>}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Dirección de entrega */}
                  <section className="space-y-3">
                    <h4 className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-medium">Dirección de entrega</h4>
                    <div className="space-y-2">
                      {[
                        { label: 'Departamento',  value: authUser.department },
                        { label: 'Municipio',     value: authUser.municipality },
                        { label: 'Dirección',     value: authUser.address },
                        { label: 'Barrio',        value: authUser.neighborhood },
                      ].map(f => (
                        <div key={f.label} className="flex items-start justify-between gap-3 bg-white/5 border border-white/10 px-3 py-2.5">
                          <span className="text-[10px] text-white/30 uppercase tracking-wider shrink-0 pt-0.5">{f.label}</span>
                          <span className="text-xs text-white/80 text-right font-light">{f.value || <span className="text-white/20 italic">—</span>}</span>
                        </div>
                      ))}
                    </div>

                    {/* GPS */}
                    {authUser.deliveryLatitude && authUser.deliveryLongitude && (
                      <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-3 py-2.5">
                        <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="text-xs text-blue-300 font-light">
                          {Number(authUser.deliveryLatitude).toFixed(5)}, {Number(authUser.deliveryLongitude).toFixed(5)}
                        </span>
                      </div>
                    )}
                  </section>

                  {/* Estado del perfil */}
                  <div className={`flex items-center gap-2 px-3 py-2.5 border text-xs ${
                    authUser.profileCompleted
                      ? 'bg-green-500/10 border-green-500/20 text-green-400'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  }`}>
                    {authUser.profileCompleted
                      ? '✓ Perfil de entrega completo'
                      : '⚠ Completa tu dirección para pedir a domicilio'}
                  </div>

                  {/* Edit button */}
                  <button
                    onClick={() => { setShowAccountPanel(false); setShowProfileModal(true) }}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-white/5 border border-white/20 hover:border-amber-400/40 hover:bg-amber-500/10 text-white/70 hover:text-amber-400 text-sm transition-all uppercase tracking-wider"
                  >
                    <Settings className="w-4 h-4" />
                    Editar datos de entrega
                  </button>
                </div>
              )}

              {/* ── MIS PEDIDOS ── */}
              {accountTab === 'pedidos' && (
                <div className="p-6">
                  {clientOrdersLoading ? (
                    <div className="text-center py-16">
                      <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-white/40 text-sm">Cargando pedidos...</p>
                    </div>
                  ) : clientOrders.length === 0 ? (
                    <div className="text-center py-16">
                      <Package className="w-12 h-12 text-white/10 mx-auto mb-4" />
                      <p className="text-white/40 text-sm font-light">No tienes pedidos aún</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {clientOrders.map((order: any) => (
                        <div key={order.id} className="border border-white/10 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-white">{order.orderNumber || `#${order.id}`}</span>
                            <span className={`text-[10px] uppercase tracking-wider px-2 py-1 ${
                              order.status === 'entregado'  ? 'bg-green-500/10 text-green-400 border border-green-500/30' :
                              order.status === 'en_camino'  ? 'bg-blue-500/10  text-blue-400  border border-blue-500/30'  :
                              order.status === 'preparando' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                              order.status === 'cancelado'  ? 'bg-red-500/10   text-red-400   border border-red-500/30'   :
                              'bg-white/5 text-white/50 border border-white/10'
                            }`}>{order.status}</span>
                          </div>
                          {order.storeName && (
                            <div className="flex items-center gap-1.5">
                              <Store className="w-3 h-3 text-white/30" />
                              <span className="text-xs text-white/50">{order.storeName}</span>
                            </div>
                          )}
                          <div className="text-xs text-white/40">
                            {new Date(order.createdAt || order.created_at).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                          {order.items?.length > 0 && (
                            <div className="space-y-1.5 pt-2 border-t border-white/5">
                              {order.items.map((item: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between text-xs">
                                  <span className="text-white/60 truncate mr-2">{item.quantity}x {item.productName}</span>
                                  <span className="text-white/40 shrink-0">{formatCOP(item.totalPrice || item.unitPrice * item.quantity)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="text-sm text-amber-400 font-medium">{formatCOP(order.total || 0)}</div>
                          {order.deliveryStatus && order.deliveryStatus !== 'sin_asignar' && (
                            <div className="pt-2 border-t border-white/5">
                              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Estado del envío</p>
                              <div className="flex items-center gap-1">
                                {['asignado','recogido','en_camino','entregado'].map((step, i) => {
                                  const steps = ['asignado','recogido','en_camino','entregado']
                                  const cur = steps.indexOf(order.deliveryStatus || '')
                                  return (
                                    <div key={step} className="flex items-center gap-1 flex-1">
                                      <div className={`w-2 h-2 rounded-full ${i <= cur ? 'bg-amber-400' : 'bg-white/10'}`} />
                                      {i < 3 && <div className={`flex-1 h-px ${i < cur ? 'bg-amber-400' : 'bg-white/10'}`} />}
                                    </div>
                                  )
                                })}
                              </div>
                              <div className="flex justify-between mt-1">
                                <span className="text-[9px] text-white/30">Asignado</span>
                                <span className="text-[9px] text-white/30">Entregado</span>
                              </div>
                              {order.driverName && <p className="text-xs text-white/50 mt-2">Repartidor: {order.driverName}</p>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── FAVORITOS ── */}
              {accountTab === 'favoritos' && (
                <div className="p-6">
                  {favorites.size === 0 ? (
                    <div className="text-center py-16">
                      <Heart className="w-12 h-12 text-white/10 mx-auto mb-4" />
                      <p className="text-white/40 text-sm font-light">Aún no tienes favoritos</p>
                      <p className="text-white/20 text-xs mt-1">Toca el corazón en cualquier producto</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {products.filter(p => favorites.has(p.id)).map(product => {
                        const isOffer = product.isOnOffer && product.offerPrice
                        return (
                          <div key={product.id} className="flex items-center gap-3 bg-white/5 border border-white/10 hover:border-amber-500/20 p-3 transition-all">
                            <div className="w-14 h-14 shrink-0 bg-black/40 overflow-hidden">
                              {product.imageUrl
                                ? <img src={ensureAbsoluteUrl(product.imageUrl)} alt={product.name} className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center"><Sparkles className="w-5 h-5 text-white/10" /></div>
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white font-light truncate">{product.name}</p>
                              <p className="text-xs text-white/40">{product.brand}</p>
                              {isOffer ? (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-orange-400 text-xs font-medium">{formatCOP(product.offerPrice!)}</span>
                                  <span className="text-white/20 text-[10px] line-through">{formatCOP(product.salePrice)}</span>
                                </div>
                              ) : (
                                <span className="text-amber-400 text-xs">{formatCOP(product.salePrice)}</span>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              <button
                                onClick={() => agregarAlCarrito(product)}
                                className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/30 hover:bg-amber-500 flex items-center justify-center text-amber-400 hover:text-black transition-all"
                              >
                                <ShoppingCart className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => toggleFavorite(product.id)}
                                className="w-7 h-7 rounded-full bg-red-500/10 border border-red-500/20 hover:bg-red-500/30 flex items-center justify-center text-red-400 transition-all"
                              >
                                <Heart className="w-3 h-3 fill-current" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer: Cerrar sesión */}
            <div className="shrink-0 p-4 border-t border-white/10">
              <button
                onClick={() => { handleClientLogout(); setShowAccountPanel(false) }}
                className="w-full flex items-center justify-center gap-2 py-3 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-sm uppercase tracking-wider transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Cerrar Sesión
              </button>
            </div>
          </div>
        </>
      )}

      {/* ========== MIS PEDIDOS (CLIENT ORDERS) ========== */}
      {showMyOrders && isAuthenticated && (
        <>
          <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm" onClick={() => setShowMyOrders(false)} />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="landing-sidebar border border-white/10 w-full max-w-lg max-h-[80vh] flex flex-col relative shadow-2xl">
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-amber-400" />
                  <h3 className="text-lg font-light text-white tracking-wide">Mis Pedidos</h3>
                </div>
                <button onClick={() => setShowMyOrders(false)} className="text-white/30 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {clientOrdersLoading ? (
                  <div className="text-center py-12">
                    <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-white/40 text-sm">Cargando pedidos...</p>
                  </div>
                ) : clientOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 text-white/10 mx-auto mb-4" />
                    <p className="text-white/40 text-sm font-light">No tienes pedidos aún</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {clientOrders.map((order: any) => (
                      <div key={order.id} className="border border-white/10 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-white">{order.orderNumber || `#${order.id}`}</span>
                          <span className={`text-[10px] uppercase tracking-wider px-2 py-1 ${
                            order.status === 'entregado' ? 'bg-green-500/10 text-green-400 border border-green-500/30' :
                            order.status === 'enviado' || order.status === 'en_camino' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' :
                            order.status === 'preparando' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                            order.status === 'cancelado' ? 'bg-red-500/10 text-red-400 border border-red-500/30' :
                            'bg-white/5 text-white/50 border border-white/10'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                        {order.storeName && (
                          <div className="flex items-center gap-1.5">
                            <Store className="w-3 h-3 text-white/30" />
                            <span className="text-xs text-white/50">{order.storeName}</span>
                          </div>
                        )}
                        <div className="text-xs text-white/40">
                          {new Date(order.createdAt || order.created_at).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {/* Order items */}
                        {order.items && order.items.length > 0 && (
                          <div className="space-y-1.5 pt-2 border-t border-white/5">
                            {order.items.map((item: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between text-xs">
                                <span className="text-white/60 truncate mr-2">{item.quantity}x {item.productName}</span>
                                <span className="text-white/40 shrink-0">{formatCOP(item.totalPrice || item.unitPrice * item.quantity)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="text-sm text-amber-400 font-medium">
                          {formatCOP(order.total || order.totalAmount || 0)}
                        </div>
                        {/* Delivery status timeline */}
                        {order.deliveryStatus && order.deliveryStatus !== 'sin_asignar' && (
                          <div className="pt-2 border-t border-white/5">
                            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Estado del envío</p>
                            <div className="flex items-center gap-1">
                              {['asignado', 'recogido', 'en_camino', 'entregado'].map((step, i) => {
                                const steps = ['asignado', 'recogido', 'en_camino', 'entregado']
                                const currentIndex = steps.indexOf(order.deliveryStatus || '')
                                const isActive = i <= currentIndex
                                return (
                                  <div key={step} className="flex items-center gap-1 flex-1">
                                    <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-amber-400' : 'bg-white/10'}`} />
                                    {i < 3 && <div className={`flex-1 h-px ${isActive && i < currentIndex ? 'bg-amber-400' : 'bg-white/10'}`} />}
                                  </div>
                                )
                              })}
                            </div>
                            <div className="flex justify-between mt-1">
                              <span className="text-[9px] text-white/30">Asignado</span>
                              <span className="text-[9px] text-white/30">Entregado</span>
                            </div>
                            {order.driverName && (
                              <p className="text-xs text-white/50 mt-2">Repartidor: {order.driverName}</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ========== MOBILE: OFERTAS FULL VIEW ========== */}
      {mobileActiveTab === 'ofertas' && (
        <div className="fixed inset-0 z-[60] overflow-y-auto md:hidden" style={{ backgroundColor: effectiveBgColor, top: storeConfig?.announcementBar?.isActive ? '104px' : '64px', bottom: '64px' }}>
          <div className="px-4 py-6">
            <div className="text-center mb-6 space-y-3">
              <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 px-4 py-2 rounded-full">
                <Flame className="w-4 h-4 text-orange-500 animate-pulse" />
                <span className="text-orange-400 uppercase tracking-[0.3em] text-xs font-medium">Ofertas</span>
                <Flame className="w-4 h-4 text-orange-500 animate-pulse" />
              </div>
              <h2 className="text-2xl font-extralight tracking-tight">
                <span className="bg-gradient-to-r from-orange-400 via-red-400 to-orange-500 bg-clip-text text-transparent">
                  Precios de Fuego
                </span>
              </h2>
            </div>

            {loadingAllOffers ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-white/40 text-sm">Cargando ofertas...</p>
              </div>
            ) : allStoreOffers.length === 0 ? (
              <div className="text-center py-12">
                <Tag className="w-12 h-12 text-white/10 mx-auto mb-4" />
                <p className="text-white/40 text-sm font-light">No hay ofertas disponibles</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {allStoreOffers.map(product => {
                  const discount = product.offerPrice ? Math.round(((product.salePrice - product.offerPrice) / product.salePrice) * 100) : 0
                  const inCart = carrito.find(c => c.id === product.id)
                  return (
                    <div key={product.id} className="group relative bg-white/5 border border-orange-500/20 hover:border-orange-500/50 transition-all duration-500 overflow-hidden">
                      <div data-dark className="relative aspect-square bg-black/50 overflow-hidden cursor-pointer" onClick={() => openProductModal(product)}>
                        <div className="absolute top-2 left-2 z-20 flex items-center gap-1 bg-gradient-to-r from-red-600 to-orange-600 text-white text-xs font-bold px-2 py-0.5 rounded-sm shadow-lg">
                          <Flame className="w-3 h-3" />
                          -{discount}%
                        </div>
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={ensureAbsoluteUrl(product.imageUrl)} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Sparkles className="w-8 h-8 text-white/10" /></div>
                        )}
                        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1.5">
                          <button onClick={(e) => { e.stopPropagation(); agregarAlCarrito(product) }} className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-orange-500 hover:text-black transition-all">
                            <ShoppingCart className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {inCart && (
                          <div className="absolute bottom-2 right-2 z-10 bg-orange-500 text-black text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{inCart.cantidad}</div>
                        )}
                      </div>
                      <div className="p-3 space-y-1">
                        <h3 className="text-xs font-light text-white truncate">{product.name}</h3>
                        <div className="flex items-end gap-2">
                          <span className="text-orange-400 font-medium text-sm">{formatCOP(product.offerPrice || product.salePrice)}</span>
                          {product.offerPrice && (
                            <span className="text-white/30 text-[10px] line-through">{formatCOP(product.salePrice)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== MOBILE: SEARCH OVERLAY ========== */}
      {mobileActiveTab === 'buscar' && (
        <div className="fixed inset-0 z-[60] md:hidden flex flex-col" style={{ backgroundColor: effectiveBgColor, top: storeConfig?.announcementBar?.isActive ? '104px' : '64px', bottom: '64px' }}>
          <div className="p-4 border-b border-white/10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
              <input
                ref={globalSearchInputRef}
                type="text"
                value={globalSearchQuery}
                onChange={(e) => handleGlobalSearch(e.target.value)}
                placeholder="Buscar productos en todas las tiendas..."
                className="w-full pl-10 pr-10 py-3 bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-amber-500/50"
                autoFocus
              />
              {globalSearchQuery && (
                <button onClick={() => { setGlobalSearchQuery(''); setGlobalSearchResults([]); setGlobalSearchStores([]) }} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {!globalSearchQuery ? (
              <div className="text-center py-16">
                <Search className="w-12 h-12 text-white/10 mx-auto mb-4" />
                <p className="text-white/40 text-sm font-light">Busca tiendas, productos o servicios</p>
              </div>
            ) : loadingGlobalSearch ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-white/40 text-sm">Buscando...</p>
              </div>
            ) : globalSearchResults.length === 0 && globalSearchStores.length === 0 ? (
              <div className="text-center py-12">
                <Search className="w-12 h-12 text-white/10 mx-auto mb-4" />
                <p className="text-white/40 text-sm font-light">No se encontraron resultados para &quot;{globalSearchQuery}&quot;</p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Stores */}
                {globalSearchStores.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-white/20 mb-3 font-light">Tiendas</p>
                    <div className="flex flex-col gap-1">
                      {globalSearchStores.map(store => (
                        <button
                          key={store.id}
                          onClick={() => { setSelectedStore(store.slug); setShowStoresView(false); setMobileActiveTab('tienda'); setGlobalSearchQuery(''); setGlobalSearchResults([]); setGlobalSearchStores([]); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                          className="group flex items-center gap-4 px-1 py-3 border-b border-white/5 active:bg-white/4 transition-all text-left w-full"
                        >
                          <div className="shrink-0 w-11 h-11 rounded-sm overflow-hidden border border-white/8 bg-white/3 flex items-center justify-center">
                            {store.logoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={ensureAbsoluteUrl(store.logoUrl)} alt={store.name} className="w-full h-full object-cover" />
                            ) : (
                              <Store className="w-4 h-4 text-white/20" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-light text-white/90 tracking-wide truncate">
                              {store.name}
                            </p>
                            {store.businessType && (
                              <p className="text-[11px] text-amber-500/60 uppercase tracking-widest font-light mt-0.5 truncate">
                                {store.businessType}
                              </p>
                            )}
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-white/15 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* Products */}
                {globalSearchResults.length > 0 && (
                  <div>
                    {globalSearchStores.length > 0 && <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">Productos</p>}
                    <div className="grid grid-cols-2 gap-3">
                      {globalSearchResults.map(product => {
                  const isOffer = product.isOnOffer && product.offerPrice
                  const inCart = carrito.find(c => c.id === product.id)
                  const openFromSearch = () => {
                    setMobileActiveTab(null)
                    setGlobalSearchQuery('')
                    setGlobalSearchResults([])
                    setGlobalSearchStores([])
                    openProductModal(product)
                  }
                  return (
                    <div key={product.id} className={`group relative bg-white/5 border ${isOffer ? 'border-orange-500/30' : 'border-white/10'} overflow-hidden cursor-pointer`} onClick={openFromSearch}>
                      <div data-dark className="relative aspect-square bg-black/50 overflow-hidden">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={ensureAbsoluteUrl(product.imageUrl)} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Sparkles className="w-8 h-8 text-white/10" /></div>
                        )}
                        <div className="absolute top-2 right-2 z-10">
                          <button onClick={(e) => { e.stopPropagation(); agregarAlCarrito(product) }} className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-amber-500 hover:text-black transition-all">
                            <ShoppingCart className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {isOffer && (
                          <div className="absolute top-2 left-2 z-20 bg-gradient-to-r from-red-600 to-orange-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-sm">
                            OFERTA
                          </div>
                        )}
                        {inCart && (
                          <div className="absolute bottom-2 right-2 z-10 bg-amber-500 text-black text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{inCart.cantidad}</div>
                        )}
                      </div>
                      <div className="p-3 space-y-1">
                        <h3 className="text-xs font-light text-white truncate">{product.name}</h3>
                        {isOffer ? (
                          <div className="flex items-center gap-2">
                            <span className="text-orange-400 font-medium text-sm">{formatCOP(product.offerPrice!)}</span>
                            <span className="text-white/30 text-[10px] line-through">{formatCOP(product.salePrice)}</span>
                          </div>
                        ) : (
                          <span className="text-amber-400 font-light text-sm">{formatCOP(product.salePrice)}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== MOBILE: MI CUENTA VIEW ========== */}
      {mobileActiveTab === 'cuenta' && (
        <div className="fixed inset-0 z-[60] overflow-y-auto md:hidden" style={{ backgroundColor: effectiveBgColor, top: storeConfig?.announcementBar?.isActive ? '104px' : '64px', bottom: '64px' }}>
          <div className="px-4 py-6">
            {isAuthenticated && authUser ? (
              <div className="space-y-6">
                {/* User Info */}
                <div className="text-center space-y-3">
                  <div className="w-20 h-20 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center mx-auto">
                    <User className="w-10 h-10 text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-light text-white">{authUser.name}</h2>
                    <p className="text-sm text-white/40">{authUser.email}</p>
                  </div>
                </div>

                {/* Menu Options */}
                <div className="space-y-2">
                  {/* Mis Pedidos */}
                  <button
                    onClick={() => { fetchClientOrders(); setShowMyOrders(true) }}
                    className="w-full flex items-center gap-4 p-4 bg-white/5 border border-white/10 hover:border-amber-500/30 transition-all"
                  >
                    <Package className="w-5 h-5 text-amber-400" />
                    <div className="text-left flex-1">
                      <span className="text-sm text-white">Mis Pedidos</span>
                      <p className="text-[11px] text-white/40">Ver historial de pedidos</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/20" />
                  </button>

                  {/* Ubicación */}
                  <button
                    onClick={() => {
                      // Open location picker (scroll to show it)
                      const el = document.getElementById('cuenta-location-picker')
                      if (el) el.scrollIntoView({ behavior: 'smooth' })
                    }}
                    className="w-full flex items-center gap-4 p-4 bg-white/5 border border-white/10 hover:border-amber-500/30 transition-all"
                  >
                    <MapPin className="w-5 h-5 text-amber-400" />
                    <div className="text-left flex-1">
                      <span className="text-sm text-white">Mi Ubicación</span>
                      <p className="text-[11px] text-white/40">Configurar dirección de entrega</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/20" />
                  </button>

                  {/* Favoritos */}
                  <button
                    onClick={() => { setMobileActiveTab('tienda'); setShowCatalog(true) }}
                    className="w-full flex items-center gap-4 p-4 bg-white/5 border border-white/10 hover:border-amber-500/30 transition-all"
                  >
                    <Heart className="w-5 h-5 text-amber-400" />
                    <div className="text-left flex-1">
                      <span className="text-sm text-white">Favoritos</span>
                      <p className="text-[11px] text-white/40">{favorites.size} productos guardados</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/20" />
                  </button>
                </div>

                {/* Location Picker */}
                <div id="cuenta-location-picker" className="space-y-3">
                  <h3 className="text-sm font-light text-white/70 uppercase tracking-wider">Mi Ubicación de Entrega</h3>
                  <div className="border border-white/10 p-4 bg-white/5">
                    {deliveryLat && deliveryLng ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-white/60">
                          <MapPin className="w-4 h-4 text-amber-400" />
                          <span>Lat: {deliveryLat.toFixed(4)}, Lng: {deliveryLng.toFixed(4)}</span>
                        </div>
                        <button
                          onClick={() => { setDeliveryLat(null); setDeliveryLng(null) }}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Cambiar ubicación
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(
                              (pos) => { setDeliveryLat(pos.coords.latitude); setDeliveryLng(pos.coords.longitude) },
                              () => alert('No se pudo obtener tu ubicación')
                            )
                          }
                        }}
                        className="w-full py-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm flex items-center justify-center gap-2 hover:bg-amber-500/20 transition-colors"
                      >
                        <MapPin className="w-4 h-4" />
                        Establecer mi ubicación
                      </button>
                    )}
                  </div>
                </div>

                {/* Logout */}
                <button
                  onClick={handleClientLogout}
                  className="w-full flex items-center justify-center gap-2 p-4 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="text-sm">Cerrar Sesión</span>
                </button>
              </div>
            ) : (
              <div className="text-center space-y-6 py-12">
                <div className="w-20 h-20 rounded-full bg-white/5 border-2 border-white/10 flex items-center justify-center mx-auto">
                  <User className="w-10 h-10 text-white/20" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-lg font-light text-white">Inicia Sesión</h2>
                  <p className="text-sm text-white/40 max-w-xs mx-auto">Accede a tu cuenta para ver tus pedidos, guardar favoritos y más</p>
                </div>
                <button
                  onClick={() => { setShowClientLogin(true); setClientLoginTab('login'); setClientLoginError('') }}
                  className="px-8 py-3 bg-amber-500 text-black text-sm font-medium uppercase tracking-wider hover:bg-amber-400 transition-colors"
                >
                  Iniciar Sesión
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== MOBILE BOTTOM NAVIGATION BAR ========== */}
      <div className="fixed bottom-0 left-0 right-0 z-[55] md:hidden border-t border-white/10 landing-nav" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center justify-around h-16">
          <button
            onClick={() => { setShowCart(false); setMobileActiveTab('cuenta') }}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${mobileActiveTab === 'cuenta' ? 'text-white' : 'text-white/40'}`}
          >
            <User className="w-6 h-6" />
            <span className="text-[10px] leading-tight">Mi cuenta</span>
          </button>

          <button
            onClick={() => { setShowCart(false); setMobileActiveTab('ofertas'); fetchAllStoreOffers() }}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${mobileActiveTab === 'ofertas' ? 'text-orange-400' : 'text-white/40'}`}
          >
            <Percent className="w-6 h-6" />
            <span className={`text-[10px] leading-tight font-bold ${mobileActiveTab === 'ofertas' ? 'text-orange-400' : 'text-white/40'}`}>Ofertas</span>
          </button>

          <button
            onClick={() => { setShowCart(false); setMobileActiveTab('buscar'); setTimeout(() => globalSearchInputRef.current?.focus(), 100) }}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${mobileActiveTab === 'buscar' ? 'text-white' : 'text-white/40'}`}
          >
            <Search className="w-6 h-6" />
          </button>

          <button
            onClick={() => setShowCart(true)}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors relative text-white/40`}
          >
            <div className="relative">
              <ShoppingCart className="w-6 h-6" />
              {totalItems > 0 && (
                <span className="absolute -top-1.5 -right-2.5 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </div>
            <span className="text-[10px] leading-tight">Carrito</span>
          </button>

          <button
            onClick={() => { setShowCart(false); setMobileActiveTab('tienda'); setShowCatalog(false); setShowDrop(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${mobileActiveTab === 'tienda' ? 'text-amber-400' : 'text-white/40'}`}
          >
            <Store className="w-6 h-6" />
            <span className="text-[10px] leading-tight">Tienda</span>
          </button>
        </div>
      </div>

      {/* ====== DELIVERY LOGIN ALERT MODAL ====== */}
      {showDeliveryLoginAlert && (
        <>
          <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm" onClick={() => setShowDeliveryLoginAlert(false)} />
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4 relative">
              <button onClick={() => setShowDeliveryLoginAlert(false)} className="absolute top-3 right-3 text-gray-400 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-3 text-blue-600">
                <MapPin className="h-6 w-6 flex-shrink-0" />
                <h3 className="text-lg font-semibold text-gray-900">Inicia sesión para pedir domicilio</h3>
              </div>
              <p className="text-sm text-gray-600">
                Tu carrito contiene productos para domicilio. Debes iniciar sesión para continuar con el pedido.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeliveryLoginAlert(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => { setShowDeliveryLoginAlert(false); setShowClientLogin(true); setClientLoginTab('login'); setClientLoginError('') }}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <LogIn className="h-4 w-4" />
                  Iniciar Sesión
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ====== PROFILE COMPLETION MODAL ====== */}
      {showProfileModal && isAuthenticated && (
        <>
          <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm" />
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5 relative my-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-600">
                  <MapPin className="h-5 w-5" />
                  <h3 className="text-lg font-semibold text-gray-900">Completa tu dirección de domicilio</h3>
                </div>
                <button onClick={() => setShowProfileModal(false)} className="text-gray-400 hover:text-gray-700">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-gray-500">
                Guarda tu dirección para que el formulario de pedido se llene automáticamente.
              </p>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono</label>
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                      placeholder="3001234567"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Cédula</label>
                    <input
                      type="text"
                      value={profileForm.cedula}
                      onChange={e => setProfileForm(p => ({ ...p, cedula: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                      placeholder="Número de documento"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Departamento *</label>
                    <select
                      value={profileForm.department}
                      onChange={e => setProfileForm(p => ({ ...p, department: e.target.value, municipality: '' }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                    >
                      <option value="">Selecciona</option>
                      {Object.keys(departamentosMunicipios).sort().map(dep => (
                        <option key={dep} value={dep}>{dep}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Municipio *</label>
                    <select
                      value={profileForm.municipality}
                      onChange={e => setProfileForm(p => ({ ...p, municipality: e.target.value }))}
                      disabled={!profileForm.department}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      <option value="">
                        {profileForm.department ? 'Selecciona' : 'Elige depto.'}
                      </option>
                      {profileForm.department && departamentosMunicipios[profileForm.department]?.map(mun => (
                        <option key={mun} value={mun}>{mun}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Dirección *</label>
                  <input
                    type="text"
                    value={profileForm.address}
                    onChange={e => setProfileForm(p => ({ ...p, address: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                    placeholder="Calle 123 # 45-67"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Barrio</label>
                  <input
                    type="text"
                    value={profileForm.neighborhood}
                    onChange={e => setProfileForm(p => ({ ...p, neighborhood: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                    placeholder="Nombre del barrio"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Ubicación GPS (opcional)
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (navigator.geolocation) {
                          navigator.geolocation.getCurrentPosition(pos => {
                            setProfileLat(pos.coords.latitude)
                            setProfileLng(pos.coords.longitude)
                          })
                        }
                      }}
                      className="flex-1 px-3 py-2 border border-blue-300 text-blue-600 rounded text-xs hover:bg-blue-50 transition-colors flex items-center justify-center gap-1"
                    >
                      <MapPin className="h-3 w-3" />
                      Usar mi ubicación
                    </button>
                    {profileLat && profileLng && (
                      <span className="text-xs text-green-600 flex items-center gap-1 px-2">
                        ✓ {profileLat.toFixed(4)}, {profileLng.toFixed(4)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowProfileModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Ahora no
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile || !profileForm.department || !profileForm.municipality || !profileForm.address}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded text-sm font-medium transition-colors"
                >
                  {savingProfile ? 'Guardando...' : 'Guardar dirección'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ========== SERVICE BOOKING MODAL ========== */}
      {bookingService && selectedStore && selectedStore !== 'all' && (
        <ServiceBookingModal
          service={bookingService}
          storeSlug={selectedStore}
          onClose={() => setBookingService(null)}
        />
      )}

      {/* ========== LEGAL CONTENT MODAL ========== */}
      {legalModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b shrink-0">
              <h2 className="font-semibold text-base">{legalModal.title}</h2>
              <button onClick={() => setLegalModal(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {legalModal.content}
            </div>
          </div>
        </div>
      )}

      {/* ========== LOCATION MODAL ========== */}
      {showLocationModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-sm bg-black/40">
          <div className="bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden">
            {/* Header */}
            <div className="flex flex-col items-center text-center px-7 pt-8 pb-6">
              <div className="h-12 w-12 rounded-full bg-black dark:bg-white flex items-center justify-center mb-4">
                <MapPin className="h-5 w-5 text-white dark:text-black" />
              </div>
              <h2 className="font-semibold text-lg tracking-tight text-black dark:text-white">¿Dónde estás?</h2>
              <p className="text-xs text-black/50 dark:text-white/50 mt-1 leading-relaxed">
                Para mostrarte tiendas y domicilios disponibles en tu zona.
              </p>
            </div>

            {/* Divider */}
            <div className="h-px bg-black/8 dark:bg-white/8" />

            {/* Body */}
            <div className="px-7 py-5 space-y-3">
              {detectedModalCity ? (
                <div className="flex items-center justify-between px-4 py-3 bg-black/5 dark:bg-white/5 rounded-xl">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MapPin className="h-4 w-4 text-black/40 dark:text-white/40 flex-shrink-0" />
                    <span className="text-sm font-medium text-black dark:text-white truncate">{detectedModalCity}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setDetectedModalCity(''); setLocationMun(''); setLocationDept('') }}
                    className="ml-3 text-xs text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors flex-shrink-0 font-medium"
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleModalLocation}
                  disabled={isLocatingModal}
                  className="w-full flex items-center justify-center gap-2.5 px-4 py-3 border border-black/10 dark:border-white/10 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50 rounded-xl transition-colors"
                >
                  {isLocatingModal ? (
                    <Loader2 className="h-4 w-4 animate-spin text-black dark:text-white" />
                  ) : (
                    <Navigation className="h-4 w-4 text-black dark:text-white" />
                  )}
                  <span className="font-medium text-sm text-black dark:text-white">
                    {isLocatingModal ? 'Detectando ubicación...' : 'Usar mi ubicación'}
                  </span>
                </button>
              )}
              {locationModalError && (
                <p className="text-xs text-red-500 dark:text-red-400 text-center">{locationModalError}</p>
              )}
            </div>

            {/* Footer */}
            <div className="px-7 pb-7 flex gap-2.5">
              <button
                className="flex-1 py-2.5 px-4 text-sm font-medium border border-black/10 dark:border-white/10 rounded-xl text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                onClick={skipClientLocation}
              >
                Omitir
              </button>
              <button
                className="flex-1 py-2.5 px-4 text-sm font-medium rounded-xl bg-black dark:bg-white text-white dark:text-black disabled:opacity-30 transition-opacity hover:opacity-80"
                disabled={!locationMun}
                onClick={saveClientLocation}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== FLOATING BACK TO STORES BUTTON ========== */}
      {selectedStore !== 'all' && stores.length > 1 && !showProductModal && (
        <button
          onClick={() => { setSelectedStore('all'); setShowStoresView(true); setShowCatalog(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[55] flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg shadow-black/40 border border-white/15 backdrop-blur-md bg-black/70 text-white text-xs font-medium uppercase tracking-widest hover:bg-black/90 transition-all duration-200 whitespace-nowrap md:bottom-6"
          style={{ animation: 'none' }}
        >
          <ArrowLeft className="w-3.5 h-3.5 flex-shrink-0" />
          Ver todas las tiendas
        </button>
      )}

      {/* ========== LOCATION CHANGE BUTTON (bottom of header) ========== */}
      {clientMunicipality && (
        <button
          className="fixed top-20 right-4 z-50 flex items-center gap-1.5 bg-background/90 border rounded-full px-3 py-1.5 text-xs text-muted-foreground shadow hover:shadow-md transition-shadow"
          onClick={() => {
            setLocationDept('')
            setLocationMun('')
            setDetectedModalCity('')
            setLocationModalError('')
            setShowLocationModal(true)
          }}
        >
          <MapPin className="h-3 w-3 text-blue-500" />
          {clientMunicipality}
        </button>
      )}
    </div>
  )
}

/* ========== RevealSection ========== */
function RevealSection({ children, className = '', id }: { children: React.ReactNode; className?: string; id?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.disconnect() } },
      { threshold: 0.08, rootMargin: '0px 0px -60px 0px' }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={ref} id={id} className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(40px)',
        transition: 'opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1), transform 0.9s cubic-bezier(0.16, 1, 0.3, 1)',
        willChange: 'opacity, transform',
      }}>
      {children}
    </section>
  )
}

/* ========== CountUpStat ========== */
function CountUpStat({ value, suffix = '', label }: { value: number; suffix?: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [count, setCount] = useState(0)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !started) { setStarted(true); observer.disconnect() } },
      { threshold: 0.5 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [started])

  useEffect(() => {
    if (!started) return
    const duration = 1800
    const startTime = performance.now()
    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(eased * value))
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [started, value])

  return (
    <div ref={ref} className="text-center">
      <p className="text-3xl font-light text-amber-400">{count}{suffix}</p>
      <p className="text-xs text-white/40 uppercase tracking-widest mt-1">{label}</p>
    </div>
  )
}

/* ========== CatalogSidebar ========== */
function CatalogSidebar({
  categories, availableBrands, availableGenders, availableSizes,
  selectedCategories, setSelectedCategories,
  selectedBrands, setSelectedBrands,
  selectedGenders, setSelectedGenders,
  selectedSizes, setSelectedSizes,
  priceMin, priceMax, setPriceMin, setPriceMax, onClear,
}: {
  categories: string[]; availableBrands: string[]; availableGenders: string[]; availableSizes: string[]
  selectedCategories: Set<string>; setSelectedCategories: (v: Set<string>) => void
  selectedBrands: Set<string>; setSelectedBrands: (v: Set<string>) => void
  selectedGenders: Set<string>; setSelectedGenders: (v: Set<string>) => void
  selectedSizes: Set<string>; setSelectedSizes: (v: Set<string>) => void
  priceMin: number; priceMax: number; setPriceMin: (v: number) => void; setPriceMax: (v: number) => void
  onClear: () => void
}) {
  const toggle = (value: string, set: Set<string>, setter: (v: Set<string>) => void) => {
    const next = new Set(set)
    if (next.has(value)) next.delete(value); else next.add(value)
    setter(next)
  }

  const hasFilters = selectedCategories.size > 0 || selectedBrands.size > 0 || selectedGenders.size > 0 || selectedSizes.size > 0 || priceMin > 0 || priceMax > 0

  return (
    <div className="p-5 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xs text-white/60 uppercase tracking-widest font-medium">Filtros</h3>
        {hasFilters && (
          <button onClick={onClear} className="text-[10px] text-amber-400 hover:text-amber-300 uppercase tracking-wider">Limpiar</button>
        )}
      </div>

      {/* Price */}
      <div className="border-b border-white/5 pb-6">
        <h4 className="text-[11px] text-white/40 uppercase tracking-widest mb-4">Precio</h4>
        {/* Range values */}
        <div className="flex items-center justify-between mb-5">
          <span className="text-xs text-amber-400 font-light tabular-nums">{formatCOP(priceMin)}</span>
          <span className="text-[10px] text-white/20">—</span>
          <span className="text-xs text-amber-400 font-light tabular-nums">
            {priceMax > 0 ? formatCOP(priceMax) : '$500k+'}
          </span>
        </div>
        {/* Slider track */}
        <div className="relative px-0 py-2">
          {/* Background track */}
          <div className="h-[3px] bg-white/10 rounded-full">
            {/* Active fill */}
            <div
              className="absolute h-[3px] bg-amber-500 rounded-full top-2"
              style={{
                left: `${(priceMin / 500000) * 100}%`,
                right: `${100 - ((priceMax || 500000) / 500000) * 100}%`,
              }}
            />
          </div>
          {/* Min thumb indicator */}
          <div
            className="absolute top-2 w-3.5 h-3.5 bg-amber-500 rounded-full border-2 border-black shadow-lg -translate-y-1/2 -translate-x-1/2 pointer-events-none ring-1 ring-amber-500/40"
            style={{ left: `${(priceMin / 500000) * 100}%` }}
          />
          {/* Max thumb indicator */}
          <div
            className="absolute top-2 w-3.5 h-3.5 bg-amber-500 rounded-full border-2 border-black shadow-lg -translate-y-1/2 -translate-x-1/2 pointer-events-none ring-1 ring-amber-500/40"
            style={{ left: `${((priceMax || 500000) / 500000) * 100}%` }}
          />
          {/* Inputs overlay */}
          <div className="dual-range absolute inset-0">
            <input
              type="range" min={0} max={500000} step={10000}
              value={priceMin}
              onChange={e => { const v = Number(e.target.value); if (v < (priceMax || 500000)) setPriceMin(v) }}
              style={{ zIndex: priceMin >= 490000 ? 5 : 3 }}
            />
            <input
              type="range" min={0} max={500000} step={10000}
              value={priceMax || 500000}
              onChange={e => { const v = Number(e.target.value); if (v > priceMin) setPriceMax(v >= 500000 ? 0 : v) }}
              style={{ zIndex: 4 }}
            />
          </div>
        </div>
        {/* Track labels */}
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-white/20">$0</span>
          <span className="text-[10px] text-white/20">$500k+</span>
        </div>
      </div>

      {/* Categories */}
      {categories.length > 0 && (
        <div className="border-b border-white/5 pb-5">
          <h4 className="text-[11px] text-white/40 uppercase tracking-widest mb-3">Categorías</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {categories.map(cat => (
              <label key={cat} className="flex items-center gap-2.5 cursor-pointer group">
                <span className={`w-4 h-4 border flex items-center justify-center shrink-0 transition-colors ${selectedCategories.has(cat) ? 'bg-amber-500 border-amber-500' : 'border-white/20 group-hover:border-white/40'}`}>
                  {selectedCategories.has(cat) && <svg className="w-3 h-3 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                </span>
                <button onClick={() => toggle(cat, selectedCategories, setSelectedCategories)} className="text-xs text-white/60 group-hover:text-white transition-colors text-left">{cat}</button>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Brands */}
      {availableBrands.length > 0 && (
        <div className="border-b border-white/5 pb-5">
          <h4 className="text-[11px] text-white/40 uppercase tracking-widest mb-3">Marcas</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {availableBrands.map(brand => (
              <label key={brand} className="flex items-center gap-2.5 cursor-pointer group">
                <span className={`w-4 h-4 border flex items-center justify-center shrink-0 transition-colors ${selectedBrands.has(brand) ? 'bg-amber-500 border-amber-500' : 'border-white/20 group-hover:border-white/40'}`}>
                  {selectedBrands.has(brand) && <svg className="w-3 h-3 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                </span>
                <button onClick={() => toggle(brand, selectedBrands, setSelectedBrands)} className="text-xs text-white/60 group-hover:text-white transition-colors text-left">{brand}</button>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Gender */}
      {availableGenders.length > 0 && (
        <div className="border-b border-white/5 pb-5">
          <h4 className="text-[11px] text-white/40 uppercase tracking-widest mb-3">Género</h4>
          <div className="space-y-2">
            {availableGenders.map(g => (
              <label key={g} className="flex items-center gap-2.5 cursor-pointer group">
                <span className={`w-4 h-4 border flex items-center justify-center shrink-0 transition-colors ${selectedGenders.has(g) ? 'bg-amber-500 border-amber-500' : 'border-white/20 group-hover:border-white/40'}`}>
                  {selectedGenders.has(g) && <svg className="w-3 h-3 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                </span>
                <button onClick={() => toggle(g, selectedGenders, setSelectedGenders)} className="text-xs text-white/60 group-hover:text-white transition-colors text-left capitalize">{g}</button>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Sizes */}
      {availableSizes.length > 0 && (
        <div className="pb-5">
          <h4 className="text-[11px] text-white/40 uppercase tracking-widest mb-3">Tamaños</h4>
          <div className="flex flex-wrap gap-2">
            {availableSizes.map(size => (
              <button key={size} onClick={() => toggle(size, selectedSizes, setSelectedSizes)}
                className={`px-3 py-1.5 text-xs border transition-colors ${selectedSizes.has(size) ? 'bg-amber-500 text-black border-amber-500' : 'bg-white/5 text-white/60 border-white/10 hover:border-white/30'}`}>
                {size}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ========== FilterPill ========== */
function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 text-[11px] text-amber-400">
      {label}
      <button onClick={onRemove} className="hover:text-amber-200 transition-colors"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
    </span>
  )
}
