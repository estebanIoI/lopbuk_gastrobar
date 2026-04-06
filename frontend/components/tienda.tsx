'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Store,
  Search,
  Eye,
  EyeOff,
  Package,
  CheckCircle,
  XCircle,
  RefreshCw,
  Filter,
  Globe,
  ShoppingBag,
  Flame,
  X,
  DollarSign,
  Tag,
  Calendar,
  Layout,
  Truck,
  Sparkles,
  Rocket,
  Zap,
  ShoppingCart,
  ToggleLeft,
  ToggleRight,
  Settings,
  Save,
  AlertCircle,
  Share2,
  Copy,
  Check,
  Download,
  QrCode,
  ExternalLink,
  Link2,
  MessageCircle,
  Phone,
  Mail,
  Trash2,
  PlusCircle,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { StoreCustomization } from '@/components/store-customization'
import { CloudinaryUpload } from '@/components/ui/cloudinary-upload'

interface StoreProduct {
  id: string
  name: string
  category: string
  brand: string | null
  salePrice: number
  imageUrl: string | null
  stock: number
  publishedInStore: boolean
  isOnOffer: boolean
  offerPrice: number | null
  offerLabel: string | null
  offerEnd: string | null
  availableForDelivery: boolean
  deliveryType: 'domicilio' | 'envio' | 'ambos' | null
  isNewLaunch: boolean
  launchDate: string | null
}

type ActiveTab = 'catalog' | 'new-launches' | 'order-bump' | 'share' | 'contact'

interface OrderBumpConfig {
  isEnabled: boolean
  mode: 'auto' | 'manual'
  title: string
  maxItems: number
  productIds: string[]
}

interface BumpProduct {
  id: string
  name: string
  category: string
  brand: string | null
  imageUrl: string | null
  salePrice: number
  stock: number
}

export function Tienda() {
  const { user } = useAuthStore()
  const isEmpresarial = user?.tenantPlan === 'empresarial' || user?.role === 'superadmin'

  const [products, setProducts] = useState<StoreProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [filterPublished, setFilterPublished] = useState<'all' | 'published' | 'unpublished' | 'offers' | 'delivery'>('all')
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [stats, setStats] = useState({ total: 0, published: 0, unpublished: 0, offers: 0, delivery: 0, newLaunches: 0 })
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showCustomization, setShowCustomization] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>('catalog')

  // Order Bump state
  const [bumpConfig, setBumpConfig] = useState<OrderBumpConfig>({
    isEnabled: false, mode: 'auto', title: '¿También te puede interesar?', maxItems: 3, productIds: [],
  })
  const [bumpPublishedProducts, setBumpPublishedProducts] = useState<BumpProduct[]>([])
  const [loadingBump, setLoadingBump] = useState(false)
  const [savingBump, setSavingBump] = useState(false)
  const [bumpSaved, setBumpSaved] = useState(false)
  const [bumpError, setBumpError] = useState<string | null>(null)

  // Share / QR state
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedSlug, setCopiedSlug] = useState(false)
  const qrRef = useRef<HTMLDivElement>(null)
  const contactQrRef = useRef<HTMLDivElement>(null)

  // Contact page state
  const [contactEnabled, setContactEnabled] = useState(false)
  const [contactTitle, setContactTitle] = useState('')
  const [contactDescription, setContactDescription] = useState('')
  const [contactImage, setContactImage] = useState('')
  const [contactLinks, setContactLinks] = useState<{ label: string; url: string }[]>([])
  const [contactProductIds, setContactProductIds] = useState<string[]>([])
  const [loadingContact, setLoadingContact] = useState(false)
  const [savingContact, setSavingContact] = useState(false)
  const [contactSaved, setContactSaved] = useState(false)
  const [contactError, setContactError] = useState<string | null>(null)
  const [copiedContactLink, setCopiedContactLink] = useState(false)

  // Offer modal state
  const [offerModal, setOfferModal] = useState<{ open: boolean; product: StoreProduct | null }>({ open: false, product: null })
  const [offerPrice, setOfferPrice] = useState('')
  const [offerLabel, setOfferLabel] = useState('')
  const [offerEnd, setOfferEnd] = useState('')
  const [savingOffer, setSavingOffer] = useState(false)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const result = await api.getMyPublishedProducts()
      if (result.success && result.data) {
        const prods = (Array.isArray(result.data) ? result.data : []).map((p: any) => ({
          ...p,
          publishedInStore: p.publishedInStore === true || p.publishedInStore === 1 || Number(p.publishedInStore) === 1,
          isOnOffer: p.isOnOffer === true || p.isOnOffer === 1 || Number(p.isOnOffer) === 1,
          availableForDelivery: p.availableForDelivery === true || p.availableForDelivery === 1 || Number(p.availableForDelivery) === 1,
          deliveryType: p.deliveryType || null,
          isNewLaunch: p.isNewLaunch === true || p.isNewLaunch === 1 || Number(p.isNewLaunch) === 1,
        }))
        setProducts(prods)
        const published = prods.filter((p: StoreProduct) => p.publishedInStore).length
        const offers = prods.filter((p: StoreProduct) => p.isOnOffer).length
        const delivery = prods.filter((p: StoreProduct) => p.availableForDelivery).length
        const newLaunches = prods.filter((p: StoreProduct) => p.isNewLaunch).length
        setStats({ total: prods.length, published, unpublished: prods.length - published, offers, delivery, newLaunches })
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchBumpConfig = useCallback(async () => {
    setLoadingBump(true)
    try {
      const result = await api.getOrderBumpConfig()
      if (result.success && result.data) {
        setBumpConfig(result.data.config
          ? { ...result.data.config, isEnabled: !!result.data.config.isEnabled }
          : { isEnabled: false, mode: 'auto', title: '¿También te puede interesar?', maxItems: 3, productIds: [] }
        )
        setBumpPublishedProducts(result.data.publishedProducts || [])
      }
    } catch (e) {
      console.error('Error fetching bump config:', e)
    } finally {
      setLoadingBump(false)
    }
  }, [])

  const fetchContactConfig = useCallback(async () => {
    setLoadingContact(true)
    try {
      const result = await api.getStoreCustomization()
      if (result.success && result.data?.storeInfo) {
        const si = result.data.storeInfo
        setContactEnabled(!!si.contactPageEnabled)
        setContactTitle(si.contactPageTitle || '')
        setContactDescription(si.contactPageDescription || '')
        setContactImage(si.contactPageImage || '')
        try {
          setContactLinks(si.contactPageLinks ? JSON.parse(si.contactPageLinks) : [])
        } catch { setContactLinks([]) }
        try {
          setContactProductIds(si.contactPageProducts ? JSON.parse(si.contactPageProducts) : [])
        } catch { setContactProductIds([]) }
      }
    } catch { /* ignore */ } finally {
      setLoadingContact(false)
    }
  }, [])

  const handleSaveContact = async () => {
    setSavingContact(true)
    setContactError(null)
    try {
      const result = await api.updateContactPage({
        contactPageEnabled: contactEnabled,
        contactPageTitle: contactTitle,
        contactPageDescription: contactDescription,
        contactPageImage: contactImage,
        contactPageLinks: contactLinks,
        contactPageProducts: contactProductIds,
      })
      if (result.success) {
        setContactSaved(true)
        setTimeout(() => setContactSaved(false), 3000)
      } else {
        setContactError(result.error || 'Error al guardar')
      }
    } catch {
      setContactError('Error de conexión al guardar')
    } finally {
      setSavingContact(false)
    }
  }

  const handleSaveBumpConfig = async () => {
    setSavingBump(true)
    setBumpError(null)
    try {
      const result = await api.updateOrderBumpConfig(bumpConfig)
      if (result.success) {
        setBumpSaved(true)
        setTimeout(() => setBumpSaved(false), 3000)
      } else {
        setBumpError(result.error || 'Error al guardar')
      }
    } catch {
      setBumpError('Error de conexión al guardar')
    } finally {
      setSavingBump(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [errorMsg])

  const togglePublish = async (productId: string, currentState: boolean) => {
    setTogglingIds(prev => new Set(prev).add(productId))
    setErrorMsg(null)
    try {
      const result = await api.publishProduct(productId, !currentState)
      if (result.success) {
        setProducts(prev => prev.map(p =>
          p.id === productId ? { ...p, publishedInStore: !currentState } : p
        ))
        setStats(prev => ({
          ...prev,
          published: prev.published + (currentState ? -1 : 1),
          unpublished: prev.unpublished + (currentState ? 1 : -1),
        }))
      } else {
        setErrorMsg(result.error || 'Error al cambiar la visibilidad del producto')
        await fetchProducts()
      }
    } catch (error) {
      console.error('Error toggling publish:', error)
      setErrorMsg('Error de conexión al cambiar la visibilidad del producto')
      await fetchProducts()
    } finally {
      setTogglingIds(prev => {
        const next = new Set(prev)
        next.delete(productId)
        return next
      })
    }
  }

  const setDeliveryType = async (productId: string, deliveryType: 'domicilio' | 'envio' | 'ambos' | null) => {
    setTogglingIds(prev => new Set(prev).add(productId))
    setErrorMsg(null)
    try {
      const result = await api.toggleDeliveryProduct(productId, deliveryType)
      if (result.success) {
        setProducts(prev => {
          const updated = prev.map(p =>
            p.id === productId ? { ...p, deliveryType, availableForDelivery: !!deliveryType } : p
          )
          const deliveryCount = updated.filter(p => !!p.availableForDelivery).length
          setStats(s => ({ ...s, delivery: deliveryCount }))
          return updated
        })
      } else {
        setErrorMsg(result.error || 'Error al cambiar tipo de entrega')
        await fetchProducts()
      }
    } catch {
      setErrorMsg('Error de conexión al cambiar disponibilidad de domicilio')
      await fetchProducts()
    } finally {
      setTogglingIds(prev => {
        const next = new Set(prev)
        next.delete(productId)
        return next
      })
    }
  }

  const toggleNewLaunch = async (productId: string, currentState: boolean) => {
    setTogglingIds(prev => new Set(prev).add(productId))
    setErrorMsg(null)
    try {
      const result = await api.toggleNewLaunch(productId, !currentState)
      if (result.success) {
        setProducts(prev => prev.map(p =>
          p.id === productId ? { ...p, isNewLaunch: !currentState, launchDate: !currentState ? new Date().toISOString().split('T')[0] : null } : p
        ))
        setStats(prev => ({
          ...prev,
          newLaunches: prev.newLaunches + (currentState ? -1 : 1),
        }))
      } else {
        setErrorMsg(result.error || 'Error al cambiar estado de nuevo lanzamiento')
        await fetchProducts()
      }
    } catch {
      setErrorMsg('Error de conexión al cambiar estado de nuevo lanzamiento')
      await fetchProducts()
    } finally {
      setTogglingIds(prev => {
        const next = new Set(prev)
        next.delete(productId)
        return next
      })
    }
  }

  const openOfferModal = (product: StoreProduct) => {
    setOfferModal({ open: true, product })
    setOfferPrice(product.isOnOffer && product.offerPrice ? String(product.offerPrice) : '')
    setOfferLabel(product.offerLabel || '')
    setOfferEnd(product.offerEnd ? product.offerEnd.slice(0, 16) : '')
  }

  const handleSaveOffer = async () => {
    if (!offerModal.product) return
    const price = parseFloat(offerPrice)
    if (!price || price <= 0) {
      setErrorMsg('El precio de oferta debe ser mayor a 0')
      return
    }
    if (price >= offerModal.product.salePrice) {
      setErrorMsg('El precio de oferta debe ser menor al precio de venta')
      return
    }
    setSavingOffer(true)
    try {
      const result = await api.toggleProductOffer(offerModal.product.id, {
        isOnOffer: true,
        offerPrice: price,
        offerLabel: offerLabel || undefined,
        offerEnd: offerEnd || undefined,
      })
      if (result.success) {
        setProducts(prev => prev.map(p =>
          p.id === offerModal.product!.id ? { ...p, isOnOffer: true, offerPrice: price, offerLabel: offerLabel || null, offerEnd: offerEnd || null } : p
        ))
        setStats(prev => ({ ...prev, offers: prev.offers + (offerModal.product!.isOnOffer ? 0 : 1) }))
        setOfferModal({ open: false, product: null })
      } else {
        setErrorMsg(result.error || 'Error al activar oferta')
      }
    } catch {
      setErrorMsg('Error de conexión al activar oferta')
    } finally {
      setSavingOffer(false)
    }
  }

  const handleRemoveOffer = async (productId: string) => {
    setTogglingIds(prev => new Set(prev).add(productId))
    try {
      const result = await api.toggleProductOffer(productId, { isOnOffer: false })
      if (result.success) {
        setProducts(prev => prev.map(p =>
          p.id === productId ? { ...p, isOnOffer: false, offerPrice: null, offerLabel: null, offerEnd: null } : p
        ))
        setStats(prev => ({ ...prev, offers: Math.max(0, prev.offers - 1) }))
      } else {
        setErrorMsg(result.error || 'Error al quitar oferta')
      }
    } catch {
      setErrorMsg('Error de conexión al quitar oferta')
    } finally {
      setTogglingIds(prev => {
        const next = new Set(prev)
        next.delete(productId)
        return next
      })
    }
  }

  const bulkPublish = async (publish: boolean) => {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    try {
      const result = await api.bulkPublishProducts(ids, publish)
      if (result.success) {
        await fetchProducts()
        setSelectedIds(new Set())
        setSelectMode(false)
      }
    } catch (error) {
      console.error('Error bulk publish:', error)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredProducts.map(p => p.id)))
    }
  }

  const categories = Array.from(new Set(products.map(p => p.category))).sort()

  const filteredProducts = products.filter(p => {
    if (selectedCategory !== 'all' && p.category !== selectedCategory) return false
    if (filterPublished === 'published' && !p.publishedInStore) return false
    if (filterPublished === 'unpublished' && p.publishedInStore) return false
    if (filterPublished === 'offers' && !p.isOnOffer) return false
    if (filterPublished === 'delivery' && !p.availableForDelivery) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        p.name.toLowerCase().includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q)
      )
    }
    return true
  })

  const newLaunchProducts = products.filter(p => p.isNewLaunch)

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value)

  const calcDiscount = (sale: number, offer: number) => Math.round(((sale - offer) / sale) * 100)

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  if (showCustomization) {
    return <StoreCustomization onBack={() => setShowCustomization(false)} />
  }

  // ─── Shared product card renderer ───────────────────────────────
  const renderProductCard = (product: StoreProduct, inNewLaunchTab = false) => {
    const isPublished = !!product.publishedInStore
    const isToggling = togglingIds.has(product.id)
    const isSelected = selectedIds.has(product.id)
    const isOffer = !!product.isOnOffer
    const isDelivery = !!product.availableForDelivery
    const isNew = !!product.isNewLaunch

    return (
      <Card
        key={product.id}
        className={`overflow-hidden transition-all relative ${
          isSelected ? 'ring-2 ring-primary' : ''
        } ${isNew ? 'border-purple-300 dark:border-purple-700 shadow-purple-100 dark:shadow-purple-900/20' :
            isOffer ? 'border-orange-300 dark:border-orange-700 shadow-orange-100 dark:shadow-orange-900/20' :
            isPublished ? 'border-green-200 dark:border-green-800' : ''}`}
      >
        {!inNewLaunchTab && selectMode && (
          <div className="absolute top-2 left-2 z-10">
            <button
              onClick={() => toggleSelect(product.id)}
              className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                isSelected
                  ? 'bg-primary border-primary text-primary-foreground'
                  : 'bg-white border-gray-300 dark:bg-gray-800 dark:border-gray-600'
              }`}
            >
              {isSelected && <CheckCircle className="h-4 w-4" />}
            </button>
          </div>
        )}

        <div className="relative">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-40 object-cover"
            />
          ) : (
            <div className="w-full h-40 bg-muted flex items-center justify-center">
              <Package className="h-10 w-10 text-muted-foreground" />
            </div>
          )}

          {/* Badges top-right */}
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            {isNew && (
              <Badge className="text-xs bg-purple-600 hover:bg-purple-700 text-white">
                <Sparkles className="h-3 w-3 mr-1" /> Nuevo
              </Badge>
            )}
            <Badge variant={isPublished ? 'default' : 'secondary'} className="text-xs">
              {isPublished ? (
                <><Eye className="h-3 w-3 mr-1" /> Visible</>
              ) : (
                <><EyeOff className="h-3 w-3 mr-1" /> Oculto</>
              )}
            </Badge>
            {isOffer && (
              <Badge className="text-xs bg-orange-600 hover:bg-orange-700 text-white">
                <Flame className="h-3 w-3 mr-1" /> Oferta
              </Badge>
            )}
            {isDelivery && (
              <Badge className="text-xs bg-blue-600 hover:bg-blue-700 text-white">
                <Truck className="h-3 w-3 mr-1" /> Domicilio
              </Badge>
            )}
          </div>

          {/* Discount badge */}
          {isOffer && product.offerPrice && (
            <div className="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-sm">
              -{calcDiscount(product.salePrice, product.offerPrice)}%
            </div>
          )}
        </div>

        <CardContent className="p-4 space-y-3">
          <div>
            <h3 className="font-semibold text-sm line-clamp-2">{product.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">{product.category}</Badge>
              {product.brand && (
                <span className="text-xs text-muted-foreground">{product.brand}</span>
              )}
            </div>
            {inNewLaunchTab && product.launchDate && (
              <p className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1 mt-1">
                <Calendar className="h-3 w-3" /> Lanzado: {formatDate(product.launchDate)}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              {isOffer && product.offerPrice ? (
                <>
                  <span className="text-lg font-bold text-orange-600">
                    {formatCurrency(product.offerPrice)}
                  </span>
                  <span className="text-xs text-muted-foreground line-through">
                    {formatCurrency(product.salePrice)}
                  </span>
                </>
              ) : (
                <span className="text-lg font-bold text-primary">
                  {formatCurrency(product.salePrice)}
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              Stock: {product.stock}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-1 flex-wrap">
            {!inNewLaunchTab && (
              <>
                <Button
                  variant={isPublished ? 'outline' : 'default'}
                  size="sm"
                  className="flex-1"
                  disabled={isToggling}
                  onClick={() => togglePublish(product.id, isPublished)}
                >
                  {isToggling ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                  ) : isPublished ? (
                    <EyeOff className="h-4 w-4 mr-1" />
                  ) : (
                    <Eye className="h-4 w-4 mr-1" />
                  )}
                  {isToggling ? '...' : isPublished ? 'Ocultar' : 'Publicar'}
                </Button>
                <div className="relative flex items-center" title="Tipo de entrega">
                  <Truck className="absolute left-2 h-3 w-3 pointer-events-none z-10 text-blue-500" />
                  <select
                    value={product.deliveryType ?? ''}
                    onChange={(e) => setDeliveryType(product.id, (e.target.value as any) || null)}
                    disabled={isToggling}
                    className="h-9 pl-6 pr-2 text-xs rounded-md border border-blue-300 bg-transparent text-blue-600 dark:border-blue-700 dark:text-blue-400 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
                  >
                    <option value="">Sin entrega</option>
                    <option value="domicilio">Domicilio</option>
                    <option value="envio">Envío nac.</option>
                    <option value="ambos">Dom.+Envío</option>
                  </select>
                </div>
                {isOffer ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-900/20"
                    disabled={isToggling}
                    onClick={() => handleRemoveOffer(product.id)}
                    title="Quitar oferta"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Oferta
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-900/20"
                    disabled={isToggling || !isPublished}
                    onClick={() => openOfferModal(product)}
                    title={!isPublished ? 'Publica el producto primero' : 'Poner en oferta'}
                  >
                    <Flame className="h-4 w-4 mr-1" />
                    Oferta
                  </Button>
                )}
              </>
            )}

            {/* New Launch toggle — always shown */}
            <Button
              variant={isNew ? 'default' : 'outline'}
              size="sm"
              className={isNew
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'border-purple-300 text-purple-600 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-900/20'
              }
              disabled={isToggling}
              onClick={() => toggleNewLaunch(product.id, isNew)}
              title={isNew ? 'Quitar de nuevos lanzamientos' : 'Marcar como nuevo lanzamiento'}
            >
              <Sparkles className="h-4 w-4" />
              {inNewLaunchTab && <span className="ml-1">{isNew ? 'Quitar' : 'Agregar'}</span>}
            </Button>
          </div>
          {isOffer && product.offerLabel && (
            <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
              <Tag className="h-3 w-3" /> {product.offerLabel}
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  if (!isEmpresarial) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
        <div className="rounded-full bg-amber-400/10 p-5">
          <Store className="h-10 w-10 text-amber-400" />
        </div>
        <h2 className="text-xl font-bold">Plan empresarial requerido</h2>
        <p className="text-muted-foreground max-w-sm">
          El módulo Tienda está disponible únicamente en el plan empresarial. Actualiza tu plan para publicar productos, gestionar pedidos, crear cupones y personalizar tu página.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Store className="h-7 w-7 text-primary" />
            Mi Tienda Online
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestiona productos, publicaciones y ofertas de tu catálogo
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCustomization(true)}>
            <Layout className="h-4 w-4 mr-2" />
            Personalizar Tienda
          </Button>
          <Button variant="outline" size="sm" onClick={fetchProducts} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          {activeTab === 'catalog' && (
            <Button
              variant={selectMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setSelectMode(!selectMode)
                setSelectedIds(new Set())
              }}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {selectMode ? 'Cancelar selección' : 'Selección múltiple'}
            </Button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          <XCircle className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm">{errorMsg}</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-900/30">
              <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-full bg-green-100 p-3 dark:bg-green-900/30">
              <Globe className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Publicados</p>
              <p className="text-2xl font-bold text-green-600">{stats.published}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-full bg-orange-100 p-3 dark:bg-orange-900/30">
              <Flame className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">En Oferta</p>
              <p className="text-2xl font-bold text-orange-600">{stats.offers}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-full bg-purple-100 p-3 dark:bg-purple-900/30">
              <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Lanzamientos</p>
              <p className="text-2xl font-bold text-purple-600">{stats.newLaunches}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-full bg-gray-100 p-3 dark:bg-gray-800">
              <EyeOff className="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sin publicar</p>
              <p className="text-2xl font-bold text-gray-500">{stats.unpublished}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-900/30">
              <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Domicilio</p>
              <p className="text-2xl font-bold text-blue-600">{stats.delivery}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'catalog'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <ShoppingBag className="h-4 w-4" />
          Catálogo
          <Badge variant="secondary" className="ml-1 text-xs">{products.length}</Badge>
        </button>
        <button
          onClick={() => { setActiveTab('new-launches') }}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'new-launches'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Rocket className="h-4 w-4" />
          Nuevos Lanzamientos
          {stats.newLaunches > 0 && (
            <Badge className="ml-1 text-xs bg-purple-600 hover:bg-purple-700 text-white">{stats.newLaunches}</Badge>
          )}
        </button>
        <button
          onClick={() => { setActiveTab('order-bump'); fetchBumpConfig() }}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'order-bump'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Zap className="h-4 w-4" />
          Order Bump
          {bumpConfig.isEnabled && (
            <Badge className="ml-1 text-xs bg-amber-500 hover:bg-amber-600 text-white">ON</Badge>
          )}
        </button>
        <button
          onClick={() => setActiveTab('share')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'share'
              ? 'border-green-500 text-green-600'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Share2 className="h-4 w-4" />
          Compartir
        </button>
        <button
          onClick={() => { setActiveTab('contact'); fetchContactConfig() }}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'contact'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <MessageCircle className="h-4 w-4" />
          Contacto
          {contactEnabled && (
            <Badge className="ml-1 text-xs bg-blue-500 hover:bg-blue-600 text-white">ON</Badge>
          )}
        </button>
      </div>

      {/* ========== CATALOG TAB ========== */}
      {activeTab === 'catalog' && (
        <>
          {/* Filters Bar */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar productos..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="all">Todas las categorías</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                <div className="flex gap-1 flex-wrap">
                  {(['all', 'published', 'offers', 'delivery', 'unpublished'] as const).map(f => (
                    <Button
                      key={f}
                      variant={filterPublished === f ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilterPublished(f)}
                      className={
                        f === 'offers' && filterPublished === f ? 'bg-orange-600 hover:bg-orange-700' :
                        f === 'delivery' && filterPublished === f ? 'bg-blue-600 hover:bg-blue-700' : ''
                      }
                    >
                      {f === 'offers' && <Flame className="h-3 w-3 mr-1" />}
                      {f === 'delivery' && <Truck className="h-3 w-3 mr-1" />}
                      {f === 'all' ? 'Todos' : f === 'published' ? 'Publicados' : f === 'offers' ? 'Ofertas' : f === 'delivery' ? 'Domicilio' : 'Sin publicar'}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bulk Actions */}
          {selectMode && selectedIds.size > 0 && (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
              <span className="text-sm font-medium">{selectedIds.size} producto(s) seleccionado(s)</span>
              <Button size="sm" variant="default" onClick={() => bulkPublish(true)}>
                <Eye className="h-4 w-4 mr-1" /> Publicar
              </Button>
              <Button size="sm" variant="outline" onClick={() => bulkPublish(false)}>
                <EyeOff className="h-4 w-4 mr-1" /> Ocultar
              </Button>
              <Button size="sm" variant="ghost" onClick={selectAll}>
                {selectedIds.size === filteredProducts.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
              </Button>
            </div>
          )}

          {/* Products Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <ShoppingBag className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No se encontraron productos</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  {products.length === 0
                    ? 'Agrega productos en el módulo de Inventario para publicarlos aquí'
                    : 'Prueba con otros filtros de búsqueda'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map(product => renderProductCard(product, false))}
            </div>
          )}
        </>
      )}

      {/* ========== NEW LAUNCHES TAB ========== */}
      {activeTab === 'new-launches' && (
        <div className="space-y-4">
          {/* Section header */}
          <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-purple-100 p-3 dark:bg-purple-900/40 flex-shrink-0">
                  <Rocket className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-semibold text-purple-800 dark:text-purple-200">
                    Módulo de Nuevos Lanzamientos
                  </h2>
                  <p className="text-sm text-purple-600 dark:text-purple-400 mt-0.5">
                    Los productos marcados aquí aparecen como sección destacada en tu tienda online. Usa el botón{' '}
                    <Sparkles className="inline h-3 w-3" /> en el catálogo para agregar productos a este módulo.
                  </p>
                </div>
                <Badge className="bg-purple-600 hover:bg-purple-700 text-white">
                  {stats.newLaunches} producto{stats.newLaunches !== 1 ? 's' : ''}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* New launches grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : newLaunchProducts.length === 0 ? (
            <Card className="border-dashed border-purple-300 dark:border-purple-700">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Rocket className="h-12 w-12 text-purple-300 dark:text-purple-700 mb-4" />
                <h3 className="text-lg font-medium">Sin lanzamientos activos</h3>
                <p className="text-muted-foreground text-sm mt-1 text-center max-w-sm">
                  Ve al <strong>Catálogo</strong> y usa el botón <Sparkles className="inline h-3 w-3 text-purple-600" /> en cualquier producto para marcarlo como nuevo lanzamiento.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 border-purple-300 text-purple-600 hover:bg-purple-50"
                  onClick={() => setActiveTab('catalog')}
                >
                  <ShoppingBag className="h-4 w-4 mr-2" />
                  Ir al Catálogo
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {newLaunchProducts.map(product => renderProductCard(product, true))}
              </div>
              <p className="text-xs text-muted-foreground text-center pt-2">
                Tip: Usa el botón <Sparkles className="inline h-3 w-3 text-purple-600" /> en cada tarjeta para quitar productos de este módulo.
              </p>
            </>
          )}
        </div>
      )}

      {/* ========== ORDER BUMP TAB ========== */}
      {activeTab === 'order-bump' && (
        <div className="space-y-6">
          {/* Header card */}
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-amber-100 p-3 dark:bg-amber-900/40 flex-shrink-0">
                  <Zap className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-semibold text-amber-800 dark:text-amber-200">
                    Order Bump / Cross-sell
                  </h2>
                  <p className="text-sm text-amber-600 dark:text-amber-400 mt-0.5">
                    Muestra productos sugeridos en el formulario de checkout. Aumenta el valor promedio de cada pedido con recomendaciones automáticas o personalizadas.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {loadingBump ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Config panel */}
              <div className="lg:col-span-2 space-y-5">
                {/* Enable toggle */}
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Activar Order Bump</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Muestra sugerencias de productos durante el checkout
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          const newEnabled = !bumpConfig.isEnabled
                          const updated = { ...bumpConfig, isEnabled: newEnabled }
                          setBumpConfig(updated)
                          try {
                            await api.updateOrderBumpConfig(updated)
                          } catch { /* ignore */ }
                        }}
                        className="flex-shrink-0"
                      >
                        {bumpConfig.isEnabled ? (
                          <ToggleRight className="h-10 w-10 text-amber-500" />
                        ) : (
                          <ToggleLeft className="h-10 w-10 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </CardContent>
                </Card>

                {bumpConfig.isEnabled && (
                  <>
                    {/* Title */}
                    <Card>
                      <CardContent className="p-5 space-y-3">
                        <label className="text-sm font-medium">Título de la sección</label>
                        <Input
                          value={bumpConfig.title}
                          onChange={e => setBumpConfig(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="¿También te puede interesar?"
                          maxLength={255}
                        />
                        <p className="text-xs text-muted-foreground">Texto que verá el cliente sobre los productos sugeridos</p>
                      </CardContent>
                    </Card>

                    {/* Max items */}
                    <Card>
                      <CardContent className="p-5 space-y-3">
                        <label className="text-sm font-medium">Cantidad máxima de sugerencias</label>
                        <div className="flex gap-2">
                          {[1, 2, 3, 4].map(n => (
                            <button
                              key={n}
                              onClick={() => setBumpConfig(prev => ({ ...prev, maxItems: n }))}
                              className={`w-12 h-10 rounded-md border text-sm font-medium transition-colors ${
                                bumpConfig.maxItems === n
                                  ? 'bg-amber-500 border-amber-500 text-white'
                                  : 'border-input bg-background hover:bg-muted'
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Mode selector */}
                    <Card>
                      <CardContent className="p-5 space-y-4">
                        <label className="text-sm font-medium">Modo de sugerencias</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <button
                            onClick={() => setBumpConfig(prev => ({ ...prev, mode: 'auto' }))}
                            className={`p-4 rounded-lg border-2 text-left transition-colors ${
                              bumpConfig.mode === 'auto'
                                ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                                : 'border-input bg-background hover:bg-muted'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Sparkles className={`h-4 w-4 ${bumpConfig.mode === 'auto' ? 'text-amber-600' : 'text-muted-foreground'}`} />
                              <span className="font-medium text-sm">Automático</span>
                              {bumpConfig.mode === 'auto' && <Badge className="ml-auto text-xs bg-amber-500 text-white">Activo</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Sugiere productos de la misma categoría o complementarios al carrito del cliente. Se actualiza solo.
                            </p>
                          </button>
                          <button
                            onClick={() => setBumpConfig(prev => ({ ...prev, mode: 'manual' }))}
                            className={`p-4 rounded-lg border-2 text-left transition-colors ${
                              bumpConfig.mode === 'manual'
                                ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                                : 'border-input bg-background hover:bg-muted'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Settings className={`h-4 w-4 ${bumpConfig.mode === 'manual' ? 'text-amber-600' : 'text-muted-foreground'}`} />
                              <span className="font-medium text-sm">Manual</span>
                              {bumpConfig.mode === 'manual' && <Badge className="ml-auto text-xs bg-amber-500 text-white">Activo</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Elige exactamente qué productos mostrar como sugerencia en el checkout.
                            </p>
                          </button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Manual product selector */}
                    {bumpConfig.mode === 'manual' && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <ShoppingCart className="h-4 w-4 text-amber-600" />
                            Productos a sugerir
                            <Badge variant="secondary" className="ml-auto">
                              {bumpConfig.productIds.length} seleccionados
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          {bumpPublishedProducts.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                              <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                              No tienes productos publicados para seleccionar
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                              {bumpPublishedProducts.map(p => {
                                const isSelected = bumpConfig.productIds.includes(p.id)
                                return (
                                  <label
                                    key={p.id}
                                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                      isSelected ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20' : 'border-input hover:bg-muted'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => {
                                        setBumpConfig(prev => ({
                                          ...prev,
                                          productIds: isSelected
                                            ? prev.productIds.filter(id => id !== p.id)
                                            : [...prev.productIds, p.id],
                                        }))
                                      }}
                                      className="accent-amber-500 h-4 w-4 flex-shrink-0"
                                    />
                                    {p.imageUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={p.imageUrl} alt={p.name} className="h-10 w-10 object-cover rounded flex-shrink-0" />
                                    ) : (
                                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                        <Package className="h-5 w-5 text-muted-foreground" />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">{p.name}</p>
                                      <p className="text-xs text-muted-foreground">{p.category} · {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(p.salePrice)}</p>
                                    </div>
                                    {isSelected && <CheckCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />}
                                  </label>
                                )
                              })}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}

                {/* Save button */}
                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleSaveBumpConfig}
                    disabled={savingBump}
                    className="bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    {savingBump ? (
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    ) : bumpSaved ? (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    {savingBump ? 'Guardando...' : bumpSaved ? '¡Guardado!' : 'Guardar configuración'}
                  </Button>
                  {bumpError && (
                    <div className="flex items-center gap-1 text-red-600 text-sm">
                      <AlertCircle className="h-4 w-4" />
                      {bumpError}
                    </div>
                  )}
                </div>
              </div>

              {/* Preview panel */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Vista previa en checkout</p>
                <div className="border-2 border-dashed border-amber-300 dark:border-amber-700 rounded-xl p-4 bg-amber-50/30 dark:bg-amber-900/10">
                  {!bumpConfig.isEnabled ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <Zap className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-xs">Order Bump desactivado</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 mb-3">
                        <Zap className="h-4 w-4 text-amber-500" />
                        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                          {bumpConfig.title || '¿También te puede interesar?'}
                        </span>
                      </div>
                      {Array.from({ length: Math.min(bumpConfig.maxItems, 2) }).map((_, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800 rounded-lg">
                          <div className="h-10 w-10 rounded bg-muted flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="h-2.5 bg-muted rounded w-3/4 mb-1.5" />
                            <div className="h-2 bg-muted rounded w-1/2" />
                          </div>
                          <div className="h-7 w-16 rounded bg-amber-400 opacity-60 flex-shrink-0" />
                        </div>
                      ))}
                      {bumpConfig.maxItems > 2 && (
                        <p className="text-xs text-center text-muted-foreground">+{bumpConfig.maxItems - 2} más...</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">¿Cómo funciona?</p>
                  <p>• <strong>Automático:</strong> analiza las categorías del carrito y sugiere productos relacionados</p>
                  <p>• <strong>Manual:</strong> tú eliges los productos que quieres sugerir siempre</p>
                  <p>• El cliente puede agregar sugerencias con un clic desde el checkout</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========== SHARE TAB ========== */}
      {activeTab === 'share' && (() => {
        const slug = user?.tenantSlug
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
        const catalogUrl = slug ? `${baseUrl}/?store=${slug}` : null

        const copyLink = async () => {
          if (!catalogUrl) return
          await navigator.clipboard.writeText(catalogUrl)
          setCopiedLink(true)
          setTimeout(() => setCopiedLink(false), 2500)
        }

        const copySlug = async () => {
          if (!slug) return
          await navigator.clipboard.writeText(slug)
          setCopiedSlug(true)
          setTimeout(() => setCopiedSlug(false), 2500)
        }

        const downloadQR = () => {
          const svg = qrRef.current?.querySelector('svg')
          if (!svg) return
          const serializer = new XMLSerializer()
          const svgStr = serializer.serializeToString(svg)
          const canvas = document.createElement('canvas')
          const size = 512
          canvas.width = size
          canvas.height = size
          const ctx = canvas.getContext('2d')
          if (!ctx) return
          const img = new Image()
          img.onload = () => {
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, size, size)
            ctx.drawImage(img, 0, 0, size, size)
            const link = document.createElement('a')
            link.download = `qr-catalogo-${slug || 'tienda'}.png`
            link.href = canvas.toDataURL('image/png')
            link.click()
          }
          img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)))
        }

        return (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Share2 className="h-5 w-5 text-green-600" />
                Comparte tu catálogo
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Genera un link o QR para que tus clientes accedan directamente a tu tienda.
              </p>
            </div>

            {!slug ? (
              <Card>
                <CardContent className="p-6 text-center space-y-2">
                  <AlertCircle className="h-8 w-8 text-amber-500 mx-auto" />
                  <p className="text-sm font-medium">Tu tienda no tiene un identificador (slug) configurado.</p>
                  <p className="text-xs text-muted-foreground">Contacta al administrador para activar tu página pública.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* QR Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <QrCode className="h-4 w-4" />
                      Código QR del catálogo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col sm:flex-row items-center gap-6">
                    {/* QR */}
                    <div ref={qrRef} className="p-4 bg-white border rounded-xl shadow-sm flex-shrink-0">
                      <QRCodeSVG
                        value={catalogUrl!}
                        size={180}
                        bgColor="#ffffff"
                        fgColor="#000000"
                        level="H"
                        includeMargin={false}
                        imageSettings={{
                          src: '/image/lopbukicon.png',
                          height: 32,
                          width: 32,
                          excavate: true,
                        }}
                      />
                    </div>
                    {/* Actions */}
                    <div className="flex-1 space-y-3 w-full">
                      <p className="text-sm text-muted-foreground">
                        Imprime o comparte este QR para que tus clientes escaneen y abran tu tienda directamente desde su celular.
                      </p>
                      <Button variant="default" className="w-full sm:w-auto gap-2" onClick={downloadQR}>
                        <Download className="h-4 w-4" />
                        Descargar QR (PNG)
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Link Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Link2 className="h-4 w-4" />
                      Link directo al catálogo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* URL completa */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">URL completa</label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 rounded-md border bg-muted/40 px-3 py-2 text-sm font-mono truncate select-all">
                          {catalogUrl}
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          className="shrink-0 h-9 w-9"
                          onClick={copyLink}
                          title="Copiar link"
                        >
                          {copiedLink ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                        <a
                          href={catalogUrl!}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="outline" size="icon" className="shrink-0 h-9 w-9" title="Abrir en nueva pestaña">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                      </div>
                    </div>

                    {/* Slug */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Identificador de tienda (slug)</label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 rounded-md border bg-muted/40 px-3 py-2 text-sm font-mono">
                          {slug}
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          className="shrink-0 h-9 w-9"
                          onClick={copySlug}
                          title="Copiar slug"
                        >
                          {copiedSlug ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Puedes compartir solo el slug para usar en redes sociales o stickers.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Share tips */}
                <Card className="border-dashed">
                  <CardContent className="p-4 space-y-2">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Globe className="h-4 w-4 text-blue-500" />
                      Sugerencias para compartir
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-1 pl-6 list-disc">
                      <li>Imprime el QR y colócalo en tu local, empaque o tarjeta de presentación.</li>
                      <li>Comparte el link en WhatsApp, Instagram o Facebook.</li>
                      <li>Agrega el QR a tu menú o catálogo físico.</li>
                      <li>Úsalo en historias de Instagram con enlace directo.</li>
                    </ul>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )
      })()}

      {/* ========== CONTACT TAB ========== */}
      {activeTab === 'contact' && (
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-blue-600" />
              Página de Contacto
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configura la información de contacto que verán tus clientes en la tienda.
            </p>
          </div>

          {loadingContact ? (
            <Card>
              <CardContent className="p-6 flex items-center justify-center">
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Enable toggle */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Activar página de contacto</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Muestra una sección de contacto visible a tus clientes
                      </p>
                    </div>
                    <button
                      onClick={() => setContactEnabled(prev => !prev)}
                      className="flex items-center gap-2 transition-colors"
                    >
                      {contactEnabled
                        ? <ToggleRight className="h-8 w-8 text-blue-500" />
                        : <ToggleLeft className="h-8 w-8 text-muted-foreground" />
                      }
                    </button>
                  </div>
                </CardContent>
              </Card>

              {/* Fields */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Contenido de la página
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Título</label>
                    <Input
                      placeholder="Ej: Contáctanos"
                      value={contactTitle}
                      onChange={e => setContactTitle(e.target.value)}
                      maxLength={255}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Descripción</label>
                    <textarea
                      placeholder="Escribe una descripción para la sección de contacto..."
                      value={contactDescription}
                      onChange={e => setContactDescription(e.target.value)}
                      rows={3}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Imagen de portada</label>
                    <CloudinaryUpload
                      value={contactImage}
                      onChange={setContactImage}
                      previewClassName="h-24 w-full object-cover rounded-lg border"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Custom links */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Canales de contacto personalizados
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {contactLinks.map((link, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-2">
                        <Input
                          placeholder="Etiqueta (ej: WhatsApp, Email...)"
                          value={link.label}
                          onChange={e => {
                            const updated = [...contactLinks]
                            updated[i] = { ...updated[i], label: e.target.value }
                            setContactLinks(updated)
                          }}
                        />
                        <Input
                          placeholder="URL o número (ej: https://wa.me/...)"
                          value={link.url}
                          onChange={e => {
                            const updated = [...contactLinks]
                            updated[i] = { ...updated[i], url: e.target.value }
                            setContactLinks(updated)
                          }}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => setContactLinks(prev => prev.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => setContactLinks(prev => [...prev, { label: '', url: '' }])}
                  >
                    <PlusCircle className="h-4 w-4" />
                    Agregar canal
                  </Button>
                </CardContent>
              </Card>

              {/* Productos para Shop */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-blue-500" />
                    Productos en Shop
                    <Badge variant="secondary" className="ml-auto">
                      {contactProductIds.length} seleccionados
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-3">
                    Elige qué productos publicados aparecen en la pestaña Shop de tu página de links. Si no seleccionas ninguno, se mostrarán todos los publicados.
                  </p>
                  {products.filter(p => p.publishedInStore).length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      No tienes productos publicados
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {products.filter(p => p.publishedInStore).map(p => {
                        const isSelected = contactProductIds.includes(p.id)
                        return (
                          <label
                            key={p.id}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                              isSelected ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-input hover:bg-muted'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setContactProductIds(prev =>
                                  isSelected ? prev.filter(id => id !== p.id) : [...prev, p.id]
                                )
                              }}
                              className="accent-blue-500 h-4 w-4 flex-shrink-0"
                            />
                            {p.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.imageUrl} alt={p.name} className="h-10 w-10 object-cover rounded-lg flex-shrink-0" />
                            ) : (
                              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                <Package className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{p.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {p.category} · {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(p.salePrice)}
                              </p>
                            </div>
                            {isSelected && <Check className="h-4 w-4 text-blue-500 flex-shrink-0" />}
                          </label>
                        )
                      })}
                    </div>
                  )}
                  {contactProductIds.length > 0 && (
                    <button
                      onClick={() => setContactProductIds([])}
                      className="mt-2 text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Limpiar selección (mostrar todos)
                    </button>
                  )}
                </CardContent>
              </Card>

              {/* Share — URL + QR de la página de links */}
              {(() => {
                const slug = user?.tenantSlug
                if (!slug) return null
                const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
                const linksUrl = `${baseUrl}/links/${slug}`

                const copyLink = async () => {
                  await navigator.clipboard.writeText(linksUrl)
                  setCopiedContactLink(true)
                  setTimeout(() => setCopiedContactLink(false), 2500)
                }

                const downloadQR = () => {
                  const svg = contactQrRef.current?.querySelector('svg')
                  if (!svg) return
                  const svgStr = new XMLSerializer().serializeToString(svg)
                  const canvas = document.createElement('canvas')
                  canvas.width = 512; canvas.height = 512
                  const ctx = canvas.getContext('2d')
                  if (!ctx) return
                  const img = new Image()
                  img.onload = () => {
                    ctx.fillStyle = '#ffffff'
                    ctx.fillRect(0, 0, 512, 512)
                    ctx.drawImage(img, 0, 0, 512, 512)
                    const a = document.createElement('a')
                    a.download = `links-${slug}.png`
                    a.href = canvas.toDataURL('image/png')
                    a.click()
                  }
                  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)))
                }

                return (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Share2 className="h-4 w-4 text-blue-500" />
                        Compartir página de links
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* URL */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 rounded-md border bg-muted/40 px-3 py-2 text-sm font-mono truncate select-all">
                          {linksUrl}
                        </div>
                        <Button variant="outline" size="icon" className="shrink-0 h-9 w-9" onClick={copyLink} title="Copiar link">
                          {copiedContactLink ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                        <a href={linksUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="icon" className="shrink-0 h-9 w-9" title="Abrir">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                      </div>
                      {/* QR */}
                      <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div ref={contactQrRef} className="p-3 bg-white border rounded-xl shadow-sm shrink-0">
                          <QRCodeSVG value={linksUrl} size={140} bgColor="#ffffff" fgColor="#000000" level="H" includeMargin={false}
                            imageSettings={{ src: '/image/lopbukicon.png', height: 24, width: 24, excavate: true }} />
                        </div>
                        <div className="space-y-2 w-full">
                          <p className="text-xs text-muted-foreground">Comparte este QR para que tus clientes accedan a tus links directamente.</p>
                          <Button variant="outline" size="sm" className="w-full gap-2" onClick={downloadQR}>
                            <Download className="h-4 w-4" />
                            Descargar QR
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })()}

              {/* Save */}
              {contactError && (
                <p className="text-sm text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />{contactError}
                </p>
              )}
              <Button
                className="w-full gap-2"
                onClick={handleSaveContact}
                disabled={savingContact}
              >
                {savingContact
                  ? <RefreshCw className="h-4 w-4 animate-spin" />
                  : contactSaved
                  ? <Check className="h-4 w-4 text-green-400" />
                  : <Save className="h-4 w-4" />
                }
                {savingContact ? 'Guardando...' : contactSaved ? '¡Guardado!' : 'Guardar configuración'}
              </Button>
            </>
          )}
        </div>
      )}

      {/* ========== OFFER MODAL ========== */}
      {offerModal.open && offerModal.product && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setOfferModal({ open: false, product: null })} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-background border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-6 relative animate-in fade-in zoom-in-95 duration-200">
              <button
                onClick={() => setOfferModal({ open: false, product: null })}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-orange-600">
                  <Flame className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Poner en Oferta</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {offerModal.product.name}
                </p>
                <p className="text-sm">
                  Precio actual: <span className="font-semibold">{formatCurrency(offerModal.product.salePrice)}</span>
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-orange-600" />
                    Precio de Oferta *
                  </label>
                  <Input
                    type="number"
                    placeholder="Ej: 25000"
                    value={offerPrice}
                    onChange={e => setOfferPrice(e.target.value)}
                    min={1}
                    max={offerModal.product.salePrice - 1}
                  />
                  {offerPrice && parseFloat(offerPrice) > 0 && parseFloat(offerPrice) < offerModal.product.salePrice && (
                    <p className="text-xs text-orange-600 font-medium">
                      Descuento del {calcDiscount(offerModal.product.salePrice, parseFloat(offerPrice))}% - Ahorro de {formatCurrency(offerModal.product.salePrice - parseFloat(offerPrice))}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Tag className="h-4 w-4 text-orange-600" />
                    Etiqueta (opcional)
                  </label>
                  <Input
                    type="text"
                    placeholder="Ej: Black Friday, Liquidación..."
                    value={offerLabel}
                    onChange={e => setOfferLabel(e.target.value)}
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-orange-600" />
                    Fecha fin (opcional)
                  </label>
                  <Input
                    type="datetime-local"
                    value={offerEnd}
                    onChange={e => setOfferEnd(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Deja vacío para oferta sin fecha límite</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setOfferModal({ open: false, product: null })}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                  onClick={handleSaveOffer}
                  disabled={savingOffer || !offerPrice || parseFloat(offerPrice) <= 0}
                >
                  {savingOffer ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Flame className="h-4 w-4 mr-2" />
                  )}
                  {savingOffer ? 'Guardando...' : 'Activar Oferta'}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
