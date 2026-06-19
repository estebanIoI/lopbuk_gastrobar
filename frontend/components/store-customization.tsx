'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Image as ImageIcon,
  Trash2,
  Plus,
  Save,
  RefreshCw,
  Layout,
  Grid3X3,
  Star,
  Info,
  X,
  Check,
  ExternalLink,
  Clock,
  MapPin,
  Shield,
  CreditCard,
  Instagram,
  Facebook,
  Phone,
  Zap,
  Eye,
  EyeOff,
  Truck,
  FileText,
  Bot,
  MessageCircle,
  Bell,
  Package,
  ShoppingCart,
  ToggleLeft,
  Search,
  Smartphone,
  Wifi,
  WifiOff,
  QrCode,
} from 'lucide-react'
import { CloudinaryUpload } from '@/components/ui/cloudinary-upload'
import { LogoThemeGenerator } from '@/components/logo-theme-generator'
import { departamentosMunicipios } from '@/constants'

interface Banner {
  id?: number
  position: string
  imageUrl: string
  videoUrl?: string
  title: string
  subtitle: string
  linkUrl: string
  isActive?: boolean
}

interface CategoryItem {
  id: string
  name: string
  imageUrl: string | null
  hiddenInStore?: boolean
}

interface FeaturedProduct {
  id: number
  productId: string
  sortOrder: number
  name: string
  imageUrl: string | null
  salePrice: number
}

interface PublishedProduct {
  id: string
  name: string
  imageUrl: string | null
  salePrice: number
  category: string
}

interface StoreExtendedInfo {
  logoUrl: string
  logoSize: number
  schedule: string
  locationMapUrl: string
  termsContent: string
  privacyContent: string
  shippingTerms: string
  paymentMethods: string
  socialInstagram: string
  socialFacebook: string
  socialTiktok: string
  socialWhatsapp: string
  department: string
  municipality: string
  productCardStyle: string
  allowContraentrega: boolean
  showInfoModule: boolean
  infoModuleDescription: string
  metaPixelId: string
}

interface AnnouncementBar {
  text: string
  linkUrl: string
  bgColor: string
  textColor: string
  isActive: boolean
  scrollSpeed: number
}

interface Drop {
  id?: number
  name: string
  description: string
  bannerUrl: string
  globalDiscount: number
  startsAt: string
  endsAt: string
  isActive: boolean
  products?: Array<{ productId: string; customDiscount: number | null; name: string; imageUrl: string | null; salePrice: number }>
}

type Tab = 'banners' | 'categories' | 'featured' | 'info' | 'announcement' | 'drops' | 'chatbot' | 'carrito'

export function StoreCustomization({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>('banners')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Data
  const [banners, setBanners] = useState<Banner[]>([])
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([])
  const [publishedProducts, setPublishedProducts] = useState<PublishedProduct[]>([])
  // Señal que se incrementa al subir un logo nuevo → dispara la auto-colorimetría
  const [logoAutoSignal, setLogoAutoSignal] = useState(0)
  const [storeInfo, setStoreInfo] = useState<StoreExtendedInfo>({
    logoUrl: '', logoSize: 40, schedule: '', locationMapUrl: '', termsContent: '', privacyContent: '', shippingTerms: '',
    paymentMethods: '', socialInstagram: '', socialFacebook: '',
    socialTiktok: '', socialWhatsapp: '',
    department: '', municipality: '', productCardStyle: 'style1',
    allowContraentrega: true, showInfoModule: false, infoModuleDescription: '', metaPixelId: '',
  })

  // Chatbot config
  const [chatbotConfig, setChatbotConfig] = useState({
    isEnabled: false,
    botName: 'Asistente',
    botAvatarUrl: '',
    accentColor: '#f59e0b',
    businessInfo: '',
    systemPrompt: '',
    faqs: '',
    tone: 'amigable' as 'amigable' | 'profesional' | 'formal' | 'casual',
    notifyEmail: true,
    notifyWhatsapp: true,
  })
  const [isSavingChatbot, setIsSavingChatbot] = useState(false)
  const [chatbotMsg, setChatbotMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  // WhatsApp state
  const [waStatus, setWaStatus] = useState<{
    connected: boolean; state: string;
    whatsappNumber: string | null; evolutionInstance: string | null
  }>({ connected: false, state: 'not_configured', whatsappNumber: null, evolutionInstance: null })
  const [waQr, setWaQr] = useState<string | null>(null)
  const [waLoading, setWaLoading] = useState(false)
  const [waMsg, setWaMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [waPhone, setWaPhone] = useState('')

  // Cart settings
  const [cartMinPurchase, setCartMinPurchase] = useState(0)
  const [cartDeliveryFee, setCartDeliveryFee] = useState(0)
  const [isSavingCartSettings, setIsSavingCartSettings] = useState(false)
  const [cartSettingsMsg, setCartSettingsMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  // Order bump
  const [orderBumpConfig, setOrderBumpConfig] = useState({
    isEnabled: false,
    mode: 'auto' as 'auto' | 'manual',
    title: '¿También te puede interesar?',
    maxItems: 3,
    productIds: [] as string[],
  })
  const [orderBumpPublishedProducts, setOrderBumpPublishedProducts] = useState<PublishedProduct[]>([])
  const [orderBumpSearch, setOrderBumpSearch] = useState('')
  const [isSavingOrderBump, setIsSavingOrderBump] = useState(false)
  const [orderBumpMsg, setOrderBumpMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  // Banner form
  const [bannerForm, setBannerForm] = useState<Banner>({ position: 'hero1', imageUrl: '', videoUrl: '', title: '', subtitle: '', linkUrl: '' })
  const [editingBannerId, setEditingBannerId] = useState<number | null>(null)

  // Announcement bar
  const [announcement, setAnnouncement] = useState<AnnouncementBar>({ text: '', linkUrl: '', bgColor: '#f59e0b', textColor: '#000000', isActive: false, scrollSpeed: 3 })

  // Drops
  const [drops, setDrops] = useState<Drop[]>([])
  const [dropForm, setDropForm] = useState<Drop>({ name: '', description: '', bannerUrl: '', globalDiscount: 0, startsAt: '', endsAt: '', isActive: true })
  const [editingDropId, setEditingDropId] = useState<number | null>(null)
  const [showDropForm, setShowDropForm] = useState(false)
  const [dropProductSearch, setDropProductSearch] = useState('')
  const [selectedDropForProducts, setSelectedDropForProducts] = useState<number | null>(null)

  // Category image editing
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [categoryImageUrl, setCategoryImageUrl] = useState('')

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3000)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await api.getStoreCustomization()
      if (result.success && result.data) {
        setBanners(result.data.banners || [])
        setCategories(result.data.categories || [])
        setFeaturedProducts(result.data.featuredProducts || [])
        setPublishedProducts(result.data.publishedProducts || [])
        if (result.data.announcementBar) {
          setAnnouncement({
            text: result.data.announcementBar.text || '',
            linkUrl: result.data.announcementBar.linkUrl || '',
            bgColor: result.data.announcementBar.bgColor || '#f59e0b',
            textColor: result.data.announcementBar.textColor || '#000000',
            isActive: !!result.data.announcementBar.isActive,
            scrollSpeed: result.data.announcementBar.scrollSpeed ?? 3,
          })
        }
        if (result.data.drops) {
          setDrops(result.data.drops)
        }
        if (result.data.cartMinPurchase !== undefined) {
          setCartMinPurchase(Number(result.data.cartMinPurchase) || 0)
        }
        if (result.data.cartDeliveryFee !== undefined) {
          setCartDeliveryFee(Number(result.data.cartDeliveryFee) || 0)
        }

        if (result.data.storeInfo) {
          setStoreInfo({
            logoUrl: result.data.storeInfo.logoUrl || '',
            logoSize: Number(result.data.storeInfo.logoSize) > 0 ? Number(result.data.storeInfo.logoSize) : 40,
            schedule: result.data.storeInfo.schedule || '',
            locationMapUrl: result.data.storeInfo.locationMapUrl || '',
            termsContent: result.data.storeInfo.termsContent || '',
            privacyContent: result.data.storeInfo.privacyContent || '',
            shippingTerms: result.data.storeInfo.shippingTerms || '',
            paymentMethods: result.data.storeInfo.paymentMethods || '',
            socialInstagram: result.data.storeInfo.socialInstagram || '',
            socialFacebook: result.data.storeInfo.socialFacebook || '',
            socialTiktok: result.data.storeInfo.socialTiktok || '',
            socialWhatsapp: result.data.storeInfo.socialWhatsapp || '',
            department: result.data.storeInfo.department || '',
            municipality: result.data.storeInfo.municipality || '',
            productCardStyle: result.data.storeInfo.productCardStyle || 'style1',
            allowContraentrega: result.data.storeInfo.allowContraentrega !== false,
            showInfoModule: !!result.data.storeInfo.showInfoModule,
            infoModuleDescription: result.data.storeInfo.infoModuleDescription || '',
            metaPixelId: result.data.storeInfo.metaPixelId || '',
          })
        }
      }
    } catch (e) {
      console.error('Error fetching customization:', e)
    } finally {
      setLoading(false)
    }
    // Load chatbot config separately
    try {
      const cbResult = await api.getChatbotConfig()
      if (cbResult.success && cbResult.data) {
        const d = cbResult.data as any
        setChatbotConfig({
          isEnabled: !!d.is_enabled,
          botName: d.bot_name || 'Asistente',
          botAvatarUrl: d.bot_avatar_url || '',
          accentColor: d.accent_color || '#f59e0b',
          businessInfo: d.business_info || '',
          systemPrompt: d.system_prompt || '',
          faqs: d.faqs || '',
          tone: d.tone || 'amigable',
          notifyEmail: d.notify_email !== false && d.notify_email !== 0,
          notifyWhatsapp: d.notify_whatsapp !== false && d.notify_whatsapp !== 0,
        })
      }
    } catch { /* chatbot table may not exist yet */ }

    // Load WhatsApp status
    try {
      const waResult = await api.getWhatsAppStatus()
      if (waResult.success && waResult.data) {
        setWaStatus(waResult.data)
        setWaPhone(waResult.data.whatsappNumber || '')
      }
    } catch { /* evolution api not configured */ }

    // Load cart settings and order bump
    try {
      const bumpResult = await api.getOrderBumpConfig()
      if (bumpResult.success && bumpResult.data) {
        const { config, publishedProducts: bumpPubs } = bumpResult.data
        setOrderBumpConfig({
          isEnabled: !!config.isEnabled,
          mode: config.mode || 'auto',
          title: config.title || '¿También te puede interesar?',
          maxItems: config.maxItems || 3,
          productIds: config.productIds || [],
        })
        setOrderBumpPublishedProducts(bumpPubs || [])
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ========== CHATBOT HANDLERS ==========
  const handleSaveChatbot = async () => {
    setIsSavingChatbot(true)
    const result = await api.updateChatbotConfig({
      botName: chatbotConfig.botName,
      botAvatarUrl: chatbotConfig.botAvatarUrl || undefined,
      accentColor: chatbotConfig.accentColor || '#f59e0b',
      systemPrompt: chatbotConfig.systemPrompt || undefined,
      businessInfo: chatbotConfig.businessInfo || undefined,
      faqs: chatbotConfig.faqs || undefined,
      tone: chatbotConfig.tone,
      notifyEmail: chatbotConfig.notifyEmail,
      notifyWhatsapp: chatbotConfig.notifyWhatsapp,
    })
    if (result.success) {
      setChatbotMsg({ type: 'ok', text: 'Configuración del chatbot guardada' })
    } else {
      setChatbotMsg({ type: 'error', text: result.error || 'Error al guardar' })
    }
    setIsSavingChatbot(false)
    setTimeout(() => setChatbotMsg(null), 4000)
  }

  // ========== WHATSAPP HANDLERS ==========
  const handleConnectWhatsApp = async () => {
    setWaLoading(true)
    setWaMsg(null)
    try {
      const result = await api.connectWhatsApp({ whatsappNumber: waPhone || undefined })
      if (result.success) {
        setWaQr(result.data?.qrcode || null)
        setWaMsg({ type: 'ok', text: 'Escanea el QR con WhatsApp para conectar' })
        // Poll status after 20 seconds
        setTimeout(async () => {
          try {
            const st = await api.getWhatsAppStatus()
            if (st.success) setWaStatus(st.data)
          } catch {}
        }, 20000)
      } else {
        setWaMsg({ type: 'error', text: result.error || 'Error al iniciar conexión' })
      }
    } catch {
      setWaMsg({ type: 'error', text: 'Error de conexión con el servidor' })
    }
    setWaLoading(false)
    setTimeout(() => setWaMsg(null), 6000)
  }

  const handleDisconnectWhatsApp = async () => {
    setWaLoading(true)
    try {
      const result = await api.disconnectWhatsApp()
      if (result.success) {
        setWaStatus({ connected: false, state: 'not_configured', whatsappNumber: null, evolutionInstance: null })
        setWaQr(null)
        setWaPhone('')
        setWaMsg({ type: 'ok', text: 'WhatsApp desconectado correctamente' })
      }
    } catch {}
    setWaLoading(false)
    setTimeout(() => setWaMsg(null), 3000)
  }

  const handleRefreshQR = async () => {
    setWaLoading(true)
    try {
      const result = await api.getWhatsAppQR()
      if (result.success) setWaQr(result.data?.qrcode || null)
    } catch {}
    setWaLoading(false)
  }

  // ========== BANNER HANDLERS ==========
  const handleSaveBanner = async () => {
    if (!bannerForm.imageUrl) {
      showMsg('error', 'La URL de imagen es requerida')
      return
    }
    setSaving(true)
    try {
      const payload = editingBannerId
        ? { ...bannerForm, id: editingBannerId }
        : bannerForm
      const result = await api.updateBanner(payload)
      if (result.success) {
        showMsg('success', editingBannerId ? 'Banner actualizado' : 'Banner creado')
        setBannerForm({ position: 'hero1', imageUrl: '', videoUrl: '', title: '', subtitle: '', linkUrl: '' })
        setEditingBannerId(null)
        fetchData()
      } else {
        showMsg('error', result.error || 'Error al guardar banner')
      }
    } catch {
      showMsg('error', 'Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteBanner = async (id: number) => {
    setSaving(true)
    try {
      const result = await api.deleteBanner(id)
      if (result.success) {
        showMsg('success', 'Banner eliminado')
        fetchData()
      } else {
        showMsg('error', result.error || 'Error al eliminar')
      }
    } catch {
      showMsg('error', 'Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const startEditBanner = (banner: Banner) => {
    setBannerForm({
      position: banner.position,
      imageUrl: banner.imageUrl,
      videoUrl: banner.videoUrl || '',
      title: banner.title || '',
      subtitle: banner.subtitle || '',
      linkUrl: banner.linkUrl || '',
    })
    setEditingBannerId(banner.id || null)
  }

  // ========== CATEGORY HANDLERS ==========
  const handleToggleCategoryVisibility = async (cat: CategoryItem) => {
    const newHidden = !cat.hiddenInStore
    setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, hiddenInStore: newHidden } : c))
    try {
      await api.toggleStorefrontCategoryVisibility(cat.id, newHidden)
      showMsg('success', newHidden ? 'Categoría oculta del Hero 2' : 'Categoría visible en el Hero 2')
    } catch {
      setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, hiddenInStore: cat.hiddenInStore } : c))
      showMsg('error', 'Error al actualizar visibilidad')
    }
  }

  const handleSaveCategoryImage = async (categoryId: string) => {
    setSaving(true)
    try {
      const result = await api.updateCategoryImage(categoryId, categoryImageUrl)
      if (result.success) {
        showMsg('success', 'Imagen de categoría actualizada')
        setEditingCategoryId(null)
        setCategoryImageUrl('')
        fetchData()
      } else {
        showMsg('error', result.error || 'Error al actualizar')
      }
    } catch {
      showMsg('error', 'Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  // ========== FEATURED PRODUCT HANDLERS ==========
  const handleAddFeatured = async (productId: string) => {
    setSaving(true)
    try {
      const result = await api.addFeaturedProduct(productId)
      if (result.success) {
        showMsg('success', 'Producto destacado agregado')
        fetchData()
      } else {
        showMsg('error', result.error || 'Error al agregar')
      }
    } catch {
      showMsg('error', 'Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveFeatured = async (productId: string) => {
    setSaving(true)
    try {
      const result = await api.removeFeaturedProduct(productId)
      if (result.success) {
        showMsg('success', 'Producto destacado eliminado')
        fetchData()
      } else {
        showMsg('error', result.error || 'Error al eliminar')
      }
    } catch {
      showMsg('error', 'Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  // ========== ANNOUNCEMENT BAR HANDLERS ==========
  const handleSaveAnnouncement = async () => {
    if (!announcement.text.trim()) { showMsg('error', 'Escribe un texto para el anuncio'); return }
    setSaving(true)
    try {
      const result = await api.updateAnnouncementBar(announcement)
      if (result.success) { showMsg('success', 'Barra de anuncio actualizada') } else { showMsg('error', result.error || 'Error') }
    } catch { showMsg('error', 'Error de conexión') } finally { setSaving(false) }
  }

  // ========== DROP HANDLERS ==========
  const handleSaveDrop = async () => {
    if (!dropForm.name || !dropForm.startsAt || !dropForm.endsAt) { showMsg('error', 'Completa nombre, fecha inicio y fin'); return }
    setSaving(true)
    try {
      let result
      if (editingDropId) {
        result = await api.updateDrop(editingDropId, dropForm)
      } else {
        result = await api.createDrop(dropForm)
      }
      if (result.success) {
        showMsg('success', editingDropId ? 'Drop actualizado' : 'Drop creado')
        setShowDropForm(false)
        setEditingDropId(null)
        setDropForm({ name: '', description: '', bannerUrl: '', globalDiscount: 0, startsAt: '', endsAt: '', isActive: true })
        fetchData()
      } else { showMsg('error', result.error || 'Error') }
    } catch { showMsg('error', 'Error de conexión') } finally { setSaving(false) }
  }

  const handleDeleteDrop = async (id: number) => {
    setSaving(true)
    try {
      const result = await api.deleteDrop(id)
      if (result.success) { showMsg('success', 'Drop eliminado'); fetchData() }
    } catch { showMsg('error', 'Error de conexión') } finally { setSaving(false) }
  }

  const handleAddDropProduct = async (dropId: number, productId: string, customDiscount?: number | null) => {
    setSaving(true)
    try {
      const result = await api.addDropProduct(dropId, productId, customDiscount)
      if (result.success) { showMsg('success', 'Producto agregado al drop'); fetchData() }
    } catch { showMsg('error', 'Error de conexión') } finally { setSaving(false) }
  }

  const handleRemoveDropProduct = async (dropId: number, productId: string) => {
    setSaving(true)
    try {
      const result = await api.removeDropProduct(dropId, productId)
      if (result.success) { showMsg('success', 'Producto removido del drop'); fetchData() }
    } catch { showMsg('error', 'Error de conexión') } finally { setSaving(false) }
  }

  const getDropStatus = (drop: Drop) => {
    const now = new Date()
    const start = new Date(drop.startsAt)
    const end = new Date(drop.endsAt)
    if (!drop.isActive) return { label: 'Inactivo', color: 'bg-gray-500' }
    if (now < start) return { label: 'Programado', color: 'bg-blue-500' }
    if (now > end) return { label: 'Finalizado', color: 'bg-red-500' }
    return { label: 'Activo', color: 'bg-green-500' }
  }

  // ========== CART SETTINGS HANDLERS ==========
  const handleSaveCartSettings = async () => {
    setIsSavingCartSettings(true)
    try {
      const result = await api.updateCartSettings({ cartMinPurchase, cartDeliveryFee })
      if (result.success) {
        setCartSettingsMsg({ type: 'ok', text: 'Configuración de domicilio guardada' })
      } else {
        setCartSettingsMsg({ type: 'error', text: result.error || 'Error al guardar' })
      }
    } catch {
      setCartSettingsMsg({ type: 'error', text: 'Error de conexión' })
    } finally {
      setIsSavingCartSettings(false)
      setTimeout(() => setCartSettingsMsg(null), 3000)
    }
  }

  const handleSaveOrderBump = async () => {
    setIsSavingOrderBump(true)
    try {
      const result = await api.updateOrderBumpConfig(orderBumpConfig)
      if (result.success) {
        setOrderBumpMsg({ type: 'ok', text: 'Order Bump guardado' })
      } else {
        setOrderBumpMsg({ type: 'error', text: result.error || 'Error al guardar' })
      }
    } catch {
      setOrderBumpMsg({ type: 'error', text: 'Error de conexión' })
    } finally {
      setIsSavingOrderBump(false)
      setTimeout(() => setOrderBumpMsg(null), 3000)
    }
  }

  const toggleOrderBumpProduct = (productId: string) => {
    setOrderBumpConfig(prev => ({
      ...prev,
      productIds: prev.productIds.includes(productId)
        ? prev.productIds.filter(id => id !== productId)
        : [...prev.productIds, productId],
    }))
  }

  // ========== STORE INFO HANDLERS ==========
  const handleSaveStoreInfo = async () => {
    setSaving(true)
    try {
      const result = await api.updateStoreExtendedInfo(storeInfo)
      if (result.success) {
        showMsg('success', 'Información de tienda actualizada')
      } else {
        showMsg('error', result.error || 'Error al actualizar')
      }
    } catch {
      showMsg('error', 'Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value)

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'banners', label: 'Banners', icon: <Layout className="h-4 w-4" /> },
    { key: 'categories', label: 'Categorías', icon: <Grid3X3 className="h-4 w-4" /> },
    { key: 'featured', label: 'Destacados', icon: <Star className="h-4 w-4" /> },
    { key: 'announcement', label: 'Anuncio', icon: <ExternalLink className="h-4 w-4" /> },
    { key: 'drops', label: 'Drops', icon: <Zap className="h-4 w-4" /> },
    { key: 'info', label: 'Info Tienda', icon: <Info className="h-4 w-4" /> },
    { key: 'chatbot', label: 'Chatbot IA', icon: <Bot className="h-4 w-4" /> },
    { key: 'carrito', label: 'Carrito', icon: <ShoppingCart className="h-4 w-4" /> },
  ]

  const featuredIds = new Set(featuredProducts.map(f => f.productId))
  const availableForFeatured = publishedProducts.filter(p => !featuredIds.has(p.id))

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Guardado fijo por pestaña (barra sticky siempre visible)
  const stickySaveByTab: Partial<Record<Tab, { fn: () => void; busy: boolean; label: string }>> = {
    banners: { fn: handleSaveBanner, busy: saving, label: editingBannerId ? 'Actualizar banner' : 'Guardar banner' },
    announcement: { fn: handleSaveAnnouncement, busy: saving, label: 'Guardar barra de anuncio' },
    info: { fn: handleSaveStoreInfo, busy: saving, label: 'Guardar información' },
    chatbot: { fn: handleSaveChatbot, busy: isSavingChatbot, label: 'Guardar chatbot' },
    carrito: { fn: handleSaveCartSettings, busy: isSavingCartSettings, label: 'Guardar carrito' },
  }
  const activeSticky = stickySaveByTab[activeTab]

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layout className="h-7 w-7 text-primary" />
            Personalizar Tienda
          </h1>
          <p className="text-muted-foreground mt-1">
            Configura los banners, categorías, productos destacados e información de tu tienda online
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={onBack}>
            Volver a Productos
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b pb-0 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ========== BANNERS TAB ========== */}
      {activeTab === 'banners' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {editingBannerId ? 'Editar Banner' : 'Agregar Banner'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Posición</label>
                  <select
                    value={bannerForm.position}
                    onChange={e => setBannerForm(prev => ({ ...prev, position: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="hero1">Hero 1 - Banner Principal</option>
                    <option value="hero4">Hero 4 - Segundo Banner</option>
                  </select>
                </div>
                <div>
                  <CloudinaryUpload
                    label="Imagen / GIF del Banner *"
                    value={bannerForm.imageUrl}
                    onChange={url => setBannerForm(prev => ({ ...prev, imageUrl: url }))}
                    previewClassName="h-16 w-28 object-cover rounded-lg border"
                    accept="image/*"
                  />
                </div>
                {bannerForm.position === 'hero4' && (
                  <div>
                    <label className="text-sm font-medium mb-1 block">Video del Banner (opcional)</label>
                    <Input
                      placeholder="https://res.cloudinary.com/.../video.mp4"
                      value={bannerForm.videoUrl || ''}
                      onChange={e => setBannerForm(prev => ({ ...prev, videoUrl: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Si se ingresa un video, se mostrará en lugar de la imagen en el Hero 4.</p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Título (opcional)</label>
                  <Input
                    placeholder="Texto principal del banner"
                    value={bannerForm.title}
                    onChange={e => setBannerForm(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Subtítulo (opcional)</label>
                  <Input
                    placeholder="Texto secundario"
                    value={bannerForm.subtitle}
                    onChange={e => setBannerForm(prev => ({ ...prev, subtitle: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">URL de enlace (opcional)</label>
                <Input
                  placeholder="https://ejemplo.com/seccion"
                  value={bannerForm.linkUrl}
                  onChange={e => setBannerForm(prev => ({ ...prev, linkUrl: e.target.value }))}
                />
              </div>

              {/* Preview */}
              {bannerForm.imageUrl && (
                <div className="relative rounded-lg overflow-hidden border bg-black h-48">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={bannerForm.imageUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                  {(bannerForm.title || bannerForm.subtitle) && (
                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white text-center p-4">
                      {bannerForm.title && <h3 className="text-2xl font-light">{bannerForm.title}</h3>}
                      {bannerForm.subtitle && <p className="text-sm opacity-80 mt-1">{bannerForm.subtitle}</p>}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3 flex-wrap">
                <Button onClick={handleSaveBanner} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {editingBannerId ? 'Actualizar' : 'Guardar'} Banner
                </Button>
                {editingBannerId && (
                  <Button variant="outline" onClick={() => {
                    setEditingBannerId(null)
                    setBannerForm({ position: 'hero1', imageUrl: '', videoUrl: '', title: '', subtitle: '', linkUrl: '' })
                  }}>
                    Cancelar
                  </Button>
                )}
                {msg && (
                  <span className={`text-sm font-medium flex items-center gap-1 ${msg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                    {msg.type === 'success' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    {msg.text}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Existing Banners */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Banners Actuales</h3>
            {banners.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>No hay banners configurados</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {banners.map(banner => (
                  <Card key={banner.id} className="overflow-hidden">
                    <div className="relative h-36 bg-black">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={banner.imageUrl} alt={banner.title || 'Banner'} className="w-full h-full object-cover" />
                      <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        {banner.position === 'hero1' ? 'Banner Principal' : 'Segundo Banner'}
                      </div>
                    </div>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="min-w-0">
                        {banner.title && <p className="text-sm font-medium truncate">{banner.title}</p>}
                        {banner.subtitle && <p className="text-xs text-muted-foreground truncate">{banner.subtitle}</p>}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => startEditBanner(banner)}>
                          <ImageIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => banner.id && handleDeleteBanner(banner.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== CATEGORIES TAB ========== */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Elige qué categorías aparecen en el <strong>Hero 2</strong> (sección visual de categorías en tu tienda). Puedes activar o desactivar cada una con el ícono del ojo. Las categorías desactivadas siguen visibles en el <strong>catálogo</strong> con todos sus productos.
          </p>
          {categories.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Grid3X3 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>No hay categorías creadas. Crea categorías en el módulo de Inventario.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map(cat => (
                <Card key={cat.id} className={`overflow-hidden transition-opacity ${cat.hiddenInStore ? 'opacity-50' : ''}`}>
                  <div className="relative h-32 bg-muted flex items-center justify-center">
                    {cat.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cat.imageUrl} alt={cat.name} className="w-full h-full object-cover" />
                    ) : (
                      <Grid3X3 className="h-10 w-10 text-muted-foreground/30" />
                    )}
                    {cat.hiddenInStore && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <EyeOff className="h-8 w-8 text-white/70" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{cat.name}</p>
                      <button
                        onClick={() => handleToggleCategoryVisibility(cat)}
                        title={cat.hiddenInStore ? 'Mostrar en Hero 2' : 'Ocultar del Hero 2'}
                        className={`p-1 rounded transition-colors shrink-0 ${cat.hiddenInStore ? 'text-muted-foreground hover:text-foreground' : 'text-green-600 hover:text-red-500'}`}
                      >
                        {cat.hiddenInStore ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className={`text-[11px] ${cat.hiddenInStore ? 'text-muted-foreground' : 'text-green-600'}`}>
                      {cat.hiddenInStore ? 'Oculta del Hero 2 · visible en catálogo' : 'Visible en Hero 2'}
                    </p>
                    {editingCategoryId === cat.id ? (
                      <div className="space-y-2">
                        <CloudinaryUpload
                          value={categoryImageUrl}
                          onChange={url => setCategoryImageUrl(url)}
                          previewClassName="h-12 w-12 object-cover rounded border"
                          accept="image/*"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleSaveCategoryImage(cat.id)} disabled={saving}>
                            <Check className="h-3 w-3 mr-1" /> Guardar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setEditingCategoryId(null); setCategoryImageUrl('') }}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setEditingCategoryId(cat.id)
                          setCategoryImageUrl(cat.imageUrl || '')
                        }}
                      >
                        <ImageIcon className="h-3 w-3 mr-1" />
                        {cat.imageUrl ? 'Cambiar imagen' : 'Agregar imagen'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========== FEATURED PRODUCTS TAB ========== */}
      {activeTab === 'featured' && (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Selecciona hasta 8 productos destacados para la sección Hero 5. Solo se muestran productos publicados con stock.
          </p>

          {/* Current featured */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Productos Destacados ({featuredProducts.length}/8)
            </h3>
            {featuredProducts.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-muted-foreground">
                  <Star className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No hay productos destacados</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {featuredProducts.map(fp => (
                  <Card key={fp.productId} className="overflow-hidden border-amber-200 dark:border-amber-800">
                    <div className="relative h-24 bg-muted">
                      {fp.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={fp.imageUrl} alt={fp.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Star className="h-6 w-6 text-muted-foreground/20" />
                        </div>
                      )}
                      <div className="absolute top-1 left-1 bg-amber-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded">
                        Destacado
                      </div>
                    </div>
                    <CardContent className="p-2 flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{fp.name}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(fp.salePrice)}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600 flex-shrink-0"
                        onClick={() => handleRemoveFeatured(fp.productId)}
                        disabled={saving}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Available products */}
          {featuredProducts.length < 8 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Agregar Producto Destacado
              </h3>

              {publishedProducts.length === 0 ? (
                <Card>
                  <CardContent className="py-6 text-center text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">No tienes productos publicados en la tienda</p>
                    <p className="text-xs mt-1 max-w-xs mx-auto">
                      Ve a <strong>Inventario</strong>, selecciona un producto y activa{' '}
                      <strong>"Publicar en tienda"</strong> para que aparezca aquí.
                    </p>
                  </CardContent>
                </Card>
              ) : availableForFeatured.length === 0 ? (
                <Card>
                  <CardContent className="py-6 text-center text-muted-foreground">
                    <Star className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Todos los productos publicados ya están en destacados.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-h-80 overflow-y-auto">
                  {availableForFeatured.map(p => (
                    <Card key={p.id} className="overflow-hidden hover:border-amber-300 dark:hover:border-amber-700 transition-colors cursor-pointer" onClick={() => handleAddFeatured(p.id)}>
                      <div className="relative h-20 bg-muted">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="h-5 w-5 text-muted-foreground/20" />
                          </div>
                        )}
                      </div>
                      <CardContent className="p-2">
                        <p className="text-xs font-medium truncate">{p.name}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-xs text-muted-foreground">{formatCurrency(p.salePrice)}</p>
                          <Plus className="h-3 w-3 text-amber-500" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========== STORE INFO TAB ========== */}
      {/* ========== ANNOUNCEMENT TAB ========== */}
      {activeTab === 'announcement' && (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Configura una barra de anuncio que aparecerá encima del header en tu tienda online (estilo Shopify).
          </p>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2"><ExternalLink className="h-4 w-4" /> Barra de Anuncio</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-sm font-normal text-muted-foreground">{announcement.isActive ? 'Activa' : 'Inactiva'}</span>
                  <button
                    onClick={() => setAnnouncement(prev => ({ ...prev, isActive: !prev.isActive }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${announcement.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${announcement.isActive ? 'translate-x-5' : ''}`} />
                  </button>
                </label>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Texto del anuncio</label>
                <Input
                  placeholder="Envío gratis en pedidos mayores a $100.000"
                  value={announcement.text}
                  onChange={e => setAnnouncement(prev => ({ ...prev, text: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">URL del enlace (opcional)</label>
                <Input
                  placeholder="https://ejemplo.com/promocion"
                  value={announcement.linkUrl}
                  onChange={e => setAnnouncement(prev => ({ ...prev, linkUrl: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Color de fondo</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={announcement.bgColor}
                      onChange={e => setAnnouncement(prev => ({ ...prev, bgColor: e.target.value }))}
                      className="w-10 h-10 border rounded cursor-pointer"
                    />
                    <Input value={announcement.bgColor} onChange={e => setAnnouncement(prev => ({ ...prev, bgColor: e.target.value }))} className="flex-1" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Color del texto</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={announcement.textColor}
                      onChange={e => setAnnouncement(prev => ({ ...prev, textColor: e.target.value }))}
                      className="w-10 h-10 border rounded cursor-pointer"
                    />
                    <Input value={announcement.textColor} onChange={e => setAnnouncement(prev => ({ ...prev, textColor: e.target.value }))} className="flex-1" />
                  </div>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Velocidad del desplazamiento
                  <span className="ml-2 text-muted-foreground font-normal">
                    {['', 'Muy lento', 'Lento', 'Normal', 'Rápido', 'Muy rápido'][announcement.scrollSpeed]}
                  </span>
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground shrink-0">Lento</span>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={announcement.scrollSpeed}
                    onChange={e => setAnnouncement(prev => ({ ...prev, scrollSpeed: Number(e.target.value) }))}
                    className="flex-1 h-2 accent-primary cursor-pointer"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">Rápido</span>
                </div>
                <div className="flex justify-between mt-1">
                  {[1,2,3,4,5].map(v => (
                    <span key={v} className={`text-xs ${announcement.scrollSpeed === v ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>|</span>
                  ))}
                </div>
              </div>
              {announcement.text && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Vista previa:</label>
                  <div className="rounded-lg overflow-hidden">
                    <style>{`@keyframes preview-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
                    <div className="py-2 overflow-hidden text-sm font-medium" style={{ backgroundColor: announcement.bgColor, color: announcement.textColor }}>
                      <div
                        className="flex whitespace-nowrap"
                        style={{ animation: `preview-marquee ${[0, 90, 50, 30, 15, 7][announcement.scrollSpeed]}s linear infinite` }}
                      >
                        {[...Array(8)].map((_, i) => (
                          <span key={i} className="inline-block mx-10 shrink-0">{announcement.text}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={handleSaveAnnouncement} disabled={saving} className="w-full sm:w-auto">
              <Save className="h-4 w-4 mr-2" />
              Guardar Barra de Anuncio
            </Button>
            {msg && (
              <span className={`text-sm font-medium flex items-center gap-1 ${msg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {msg.type === 'success' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                {msg.text}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ========== DROPS TAB ========== */}
      {activeTab === 'drops' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Crea lanzamientos temporales con descuentos exclusivos para tus clientes.
            </p>
            <Button onClick={() => { setShowDropForm(true); setEditingDropId(null); setDropForm({ name: '', description: '', bannerUrl: '', globalDiscount: 0, startsAt: '', endsAt: '', isActive: true }) }} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Nuevo Drop
            </Button>
          </div>

          {/* Drop Form */}
          {showDropForm && (
            <Card className="border-amber-500/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{editingDropId ? 'Editar Drop' : 'Nuevo Drop'}</span>
                  <button onClick={() => setShowDropForm(false)}><X className="h-4 w-4" /></button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Nombre del Drop *</label>
                    <Input placeholder="Summer Sale" value={dropForm.name} onChange={e => setDropForm(prev => ({ ...prev, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Descuento global (%)</label>
                    <Input type="number" min={0} max={100} placeholder="30" value={dropForm.globalDiscount || ''} onChange={e => setDropForm(prev => ({ ...prev, globalDiscount: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Fecha inicio *</label>
                    <Input type="datetime-local" value={dropForm.startsAt} onChange={e => setDropForm(prev => ({ ...prev, startsAt: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Fecha fin *</label>
                    <Input type="datetime-local" value={dropForm.endsAt} onChange={e => setDropForm(prev => ({ ...prev, endsAt: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Descripción</label>
                  <Input placeholder="Los mejores descuentos del verano" value={dropForm.description} onChange={e => setDropForm(prev => ({ ...prev, description: e.target.value }))} />
                </div>
                <CloudinaryUpload
                  label="Imagen / Banner del Drop"
                  value={dropForm.bannerUrl}
                  onChange={url => setDropForm(prev => ({ ...prev, bannerUrl: url }))}
                  previewClassName="max-h-32 w-auto object-contain rounded border"
                  accept="image/*"
                />
                <div className="flex items-center gap-3 flex-wrap">
                  <Button onClick={handleSaveDrop} disabled={saving}>
                    <Save className="h-4 w-4 mr-1" /> {editingDropId ? 'Actualizar' : 'Crear'} Drop
                  </Button>
                  <Button variant="outline" onClick={() => setShowDropForm(false)}>Cancelar</Button>
                  {msg && (
                    <span className={`text-sm font-medium flex items-center gap-1 ${msg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                      {msg.type === 'success' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                      {msg.text}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Drops List */}
          {drops.length === 0 && !showDropForm ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">No hay drops creados. Crea tu primer drop.</CardContent></Card>
          ) : (
            <div className="space-y-4">
              {drops.map(drop => {
                const status = getDropStatus(drop)
                const isManaging = selectedDropForProducts === drop.id
                return (
                  <Card key={drop.id} className={isManaging ? 'border-amber-500/50' : ''}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`${status.color} text-white text-[10px] font-bold px-2 py-0.5 rounded`}>{status.label}</span>
                          <h3 className="font-medium">{drop.name}</h3>
                          {drop.globalDiscount > 0 && <span className="text-xs text-muted-foreground">-{drop.globalDiscount}%</span>}
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedDropForProducts(isManaging ? null : drop.id!) }}>
                            <Grid3X3 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => {
                            setEditingDropId(drop.id!)
                            setDropForm({ ...drop, startsAt: drop.startsAt ? new Date(drop.startsAt).toISOString().slice(0, 16) : '', endsAt: drop.endsAt ? new Date(drop.endsAt).toISOString().slice(0, 16) : '' })
                            setShowDropForm(true)
                          }}>
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteDrop(drop.id!)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {drop.startsAt && new Date(drop.startsAt).toLocaleString('es-CO')} → {drop.endsAt && new Date(drop.endsAt).toLocaleString('es-CO')}
                      </div>

                      {/* Product management for this drop */}
                      {isManaging && (
                        <div className="border-t pt-3 space-y-3">
                          <h4 className="text-sm font-medium">Productos del Drop ({drop.products?.length || 0})</h4>
                          {/* Current products */}
                          {drop.products && drop.products.length > 0 && (
                            <div className="space-y-2">
                              {drop.products.map(dp => (
                                <div key={dp.productId} className="flex items-center justify-between bg-muted/50 p-2 rounded text-sm">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    {dp.imageUrl && (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={dp.imageUrl} alt="" className="w-8 h-8 object-cover rounded" />
                                    )}
                                    <span className="truncate">{dp.name}</span>
                                    <span className="text-muted-foreground">{formatCurrency(dp.salePrice)}</span>
                                    {dp.customDiscount != null ? (
                                      <span className="text-xs text-orange-500 font-medium">-{dp.customDiscount}% custom</span>
                                    ) : drop.globalDiscount > 0 ? (
                                      <span className="text-xs text-green-500">-{drop.globalDiscount}% global</span>
                                    ) : null}
                                  </div>
                                  <Button variant="ghost" size="sm" onClick={() => handleRemoveDropProduct(drop.id!, dp.productId)}>
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Add products */}
                          <div>
                            <Input placeholder="Buscar producto para agregar..." value={dropProductSearch} onChange={e => setDropProductSearch(e.target.value)} className="mb-2" />
                            {dropProductSearch && (
                              <div className="max-h-48 overflow-y-auto border rounded space-y-1 p-1">
                                {publishedProducts
                                  .filter(p => !drop.products?.some(dp => dp.productId === p.id))
                                  .filter(p => p.name.toLowerCase().includes(dropProductSearch.toLowerCase()))
                                  .slice(0, 10)
                                  .map(p => (
                                    <button key={p.id} onClick={() => { handleAddDropProduct(drop.id!, p.id); setDropProductSearch('') }}
                                      className="w-full flex items-center gap-2 p-2 hover:bg-muted rounded text-sm text-left">
                                      {p.imageUrl && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={p.imageUrl} alt="" className="w-8 h-8 object-cover rounded" />
                                      )}
                                      <span className="truncate flex-1">{p.name}</span>
                                      <span className="text-muted-foreground">{formatCurrency(p.salePrice)}</span>
                                      <Plus className="h-4 w-4 text-green-500" />
                                    </button>
                                  ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'info' && (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Configura la información que aparecerá en el footer (Hero 6) de tu tienda online.
          </p>

          {/* Módulo de Información */}
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4 text-amber-500" />
                Módulo de Información
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Cuando está activo, la sección de productos de tu tienda pública es reemplazada por una tarjeta de información de tu negocio (horario, contacto, redes sociales, métodos de pago, etc.).
              </p>
              <div className="flex items-center justify-between p-3 border rounded-lg bg-background">
                <div>
                  <p className="text-sm font-medium">Activar módulo de información</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {storeInfo.showInfoModule
                      ? 'Tu tienda pública muestra la tarjeta de información en lugar del catálogo de productos'
                      : 'Tu tienda pública muestra el catálogo de productos normalmente'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStoreInfo(prev => ({ ...prev, showInfoModule: !prev.showInfoModule }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    storeInfo.showInfoModule ? 'bg-amber-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      storeInfo.showInfoModule ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {storeInfo.showInfoModule && (
                <div>
                  <label className="text-sm font-medium mb-1 block">Descripción del módulo (opcional)</label>
                  <Textarea
                    placeholder="Escribe una descripción o mensaje de bienvenida para tus clientes..."
                    value={storeInfo.infoModuleDescription}
                    onChange={e => setStoreInfo(prev => ({ ...prev, infoModuleDescription: e.target.value }))}
                    rows={3}
                    className="resize-y"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Este texto aparecerá en la tarjeta de información de tu tienda.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Logo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Logo de la Tienda
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Sube la URL de tu logo (imagen o GIF). Se mostrará en la barra de navegación de tu tienda online.
              </p>
              <CloudinaryUpload
                label="Logo de la tienda"
                value={storeInfo.logoUrl}
                onChange={url => {
                  setStoreInfo(prev => ({ ...prev, logoUrl: url }))
                  // Solo dispara la auto-colorimetría con una URL subida (no al limpiar)
                  if (url && !url.startsWith('/')) setLogoAutoSignal(s => s + 1)
                }}
                previewClassName="max-h-20 w-auto object-contain rounded"
                accept="image/*"
              />

              {storeInfo.logoUrl && (
                <div className="space-y-2 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Tamaño del logo en la tienda</Label>
                    <span className="text-xs text-muted-foreground tabular-nums">{storeInfo.logoSize}px de alto</span>
                  </div>
                  <input
                    type="range" min={16} max={120} step={2}
                    value={storeInfo.logoSize}
                    onChange={e => setStoreInfo(prev => ({ ...prev, logoSize: Number(e.target.value) }))}
                    className="w-full accent-primary cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Pequeño</span><span>Grande</span>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2">
                    <span className="text-[10px] text-muted-foreground shrink-0">Vista previa:</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={storeInfo.logoUrl} alt="logo" style={{ height: storeInfo.logoSize }} className="w-auto object-contain" />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Controla el alto del logo en la barra de navegación de tu tienda.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tema automático desde el logo (IA) */}
          <LogoThemeGenerator logoUrl={storeInfo.logoUrl} autoApplySignal={logoAutoSignal} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Schedule & Location */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Horarios y Ubicación
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Horario de atención</label>
                  <Input
                    placeholder="Lun-Vie 9am-6pm, Sáb 9am-2pm"
                    value={storeInfo.schedule}
                    onChange={e => setStoreInfo(prev => ({ ...prev, schedule: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    URL de Google Maps
                  </label>
                  <Input
                    placeholder="https://maps.google.com/..."
                    value={storeInfo.locationMapUrl}
                    onChange={e => setStoreInfo(prev => ({ ...prev, locationMapUrl: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-blue-500" />
                    Ubicación del comercio
                  </label>
                  <p className="text-xs text-muted-foreground mb-2">Necesario para el filtrado por municipio — solo los clientes del mismo municipio verán tus productos de domicilio.</p>
                  <div className="flex gap-2">
                    <select
                      value={storeInfo.department}
                      onChange={e => setStoreInfo(prev => ({ ...prev, department: e.target.value, municipality: '' }))}
                      className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Departamento</option>
                      {Object.keys(departamentosMunicipios).sort().map(dep => (
                        <option key={dep} value={dep}>{dep}</option>
                      ))}
                    </select>
                    <select
                      value={storeInfo.municipality}
                      onChange={e => setStoreInfo(prev => ({ ...prev, municipality: e.target.value }))}
                      disabled={!storeInfo.department}
                      className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    >
                      <option value="">Municipio</option>
                      {(departamentosMunicipios[storeInfo.department] || []).map(mun => (
                        <option key={mun} value={mun}>{mun}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Legal Content */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Información Legal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Términos y condiciones
                    </label>
                    <p className="text-xs text-muted-foreground">Este texto se mostrará a tus clientes como tus términos y condiciones.</p>
                    <Textarea
                      placeholder="Escribe aquí tus términos y condiciones..."
                      value={storeInfo.termsContent}
                      onChange={e => setStoreInfo(prev => ({ ...prev, termsContent: e.target.value }))}
                      rows={8}
                      className="resize-y"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      Política de privacidad
                    </label>
                    <p className="text-xs text-muted-foreground">Este texto se mostrará a tus clientes como tu política de privacidad.</p>
                    <Textarea
                      placeholder="Escribe aquí tu política de privacidad..."
                      value={storeInfo.privacyContent}
                      onChange={e => setStoreInfo(prev => ({ ...prev, privacyContent: e.target.value }))}
                      rows={8}
                      className="resize-y"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium flex items-center gap-1">
                      <Truck className="h-3 w-3" />
                      Términos de envío
                    </label>
                    <p className="text-xs text-muted-foreground">Indica tus políticas de envío, tiempos de entrega, costos, etc.</p>
                    <Textarea
                      placeholder="Escribe aquí tus términos de envío y entrega..."
                      value={storeInfo.shippingTerms}
                      onChange={e => setStoreInfo(prev => ({ ...prev, shippingTerms: e.target.value }))}
                      rows={8}
                      className="resize-y"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 flex items-center gap-1">
                    <CreditCard className="h-3 w-3" />
                    Medios de pago
                  </label>
                  <Input
                    placeholder="Efectivo, Nequi, Daviplata, Transferencia"
                    value={storeInfo.paymentMethods}
                    onChange={e => setStoreInfo(prev => ({ ...prev, paymentMethods: e.target.value }))}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium flex items-center gap-1">
                      <Truck className="h-3 w-3" />
                      Permitir pago contraentrega
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {storeInfo.allowContraentrega
                        ? 'Los clientes pueden pagar al recibir el pedido'
                        : 'Solo se aceptan métodos de pago en línea'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStoreInfo(prev => ({ ...prev, allowContraentrega: !prev.allowContraentrega }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      storeInfo.allowContraentrega ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        storeInfo.allowContraentrega ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Social Media */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Redes Sociales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 flex items-center gap-1">
                      <Instagram className="h-3 w-3" />
                      Instagram
                    </label>
                    <Input
                      placeholder="https://instagram.com/tu_tienda"
                      value={storeInfo.socialInstagram}
                      onChange={e => setStoreInfo(prev => ({ ...prev, socialInstagram: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 flex items-center gap-1">
                      <Facebook className="h-3 w-3" />
                      Facebook
                    </label>
                    <Input
                      placeholder="https://facebook.com/tu_tienda"
                      value={storeInfo.socialFacebook}
                      onChange={e => setStoreInfo(prev => ({ ...prev, socialFacebook: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">TikTok</label>
                    <Input
                      placeholder="https://tiktok.com/@tu_tienda"
                      value={storeInfo.socialTiktok}
                      onChange={e => setStoreInfo(prev => ({ ...prev, socialTiktok: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      WhatsApp
                    </label>
                    <Input
                      placeholder="573001234567"
                      value={storeInfo.socialWhatsapp}
                      onChange={e => setStoreInfo(prev => ({ ...prev, socialWhatsapp: e.target.value }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Card Style Picker */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Layout className="h-4 w-4" />
                Presentación de Tarjetas de Producto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">
                Elige cómo se verán las tarjetas de producto en tu catálogo online.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Style 1 preview */}
                <button
                  type="button"
                  onClick={() => setStoreInfo(prev => ({ ...prev, productCardStyle: 'style1' }))}
                  className={`relative rounded-xl border-2 p-3 text-left transition-all ${
                    storeInfo.productCardStyle === 'style1'
                      ? 'border-primary ring-2 ring-primary/30'
                      : 'border-muted hover:border-muted-foreground/40'
                  }`}
                >
                  {storeInfo.productCardStyle === 'style1' && (
                    <span className="absolute top-2 right-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Activo
                    </span>
                  )}
                  {/* Mini preview style1 */}
                  <div className="w-full aspect-[3/4] bg-gray-900 rounded overflow-hidden mb-2 relative">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-2">
                      <div className="h-2 bg-white/50 rounded mb-1 w-3/4" />
                      <div className="h-2 bg-amber-400/70 rounded w-1/2" />
                      <div className="absolute bottom-0 left-0 right-0 h-7 bg-amber-500/60 flex items-center justify-center">
                        <div className="h-1.5 bg-black/40 rounded w-1/3" />
                      </div>
                    </div>
                  </div>
                  <p className="text-sm font-medium">Estilo 1 — Clásico oscuro</p>
                  <p className="text-xs text-muted-foreground">Imagen con información superpuesta y barra de acción al hacer hover</p>
                </button>

                {/* Style 2 preview */}
                <button
                  type="button"
                  onClick={() => setStoreInfo(prev => ({ ...prev, productCardStyle: 'style2' }))}
                  className={`relative rounded-xl border-2 p-3 text-left transition-all ${
                    storeInfo.productCardStyle === 'style2'
                      ? 'border-primary ring-2 ring-primary/30'
                      : 'border-muted hover:border-muted-foreground/40'
                  }`}
                >
                  {storeInfo.productCardStyle === 'style2' && (
                    <span className="absolute top-2 right-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Activo
                    </span>
                  )}
                  {/* Mini preview style2 */}
                  <div className="w-full bg-white dark:bg-gray-100 rounded overflow-hidden mb-2 shadow-sm border border-gray-200">
                    <div className="aspect-[4/3] bg-gray-100 relative flex items-center justify-center">
                      <div className="w-10 h-12 bg-gray-300 rounded opacity-60" />
                      <div className="absolute top-1.5 left-1.5 bg-orange-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-sm">-12%</div>
                      {/* Hover icons preview */}
                      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
                        {[0,1,2,3].map(i => (
                          <div key={i} className="w-5 h-5 rounded-full bg-white border border-gray-300 flex items-center justify-center">
                            <div className="w-2 h-2 bg-gray-400 rounded-sm" />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="p-2">
                      <div className="h-2 bg-gray-300 rounded mb-1 w-3/4" />
                      <div className="flex items-center gap-1 mb-1">
                        <div className="h-2 bg-gray-200 rounded w-1/3 line-through" />
                        <div className="h-2 bg-gray-800 rounded w-1/3" />
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full" />
                        <div className="h-1.5 bg-gray-200 rounded w-2/3" />
                      </div>
                    </div>
                  </div>
                  <p className="text-sm font-medium">Estilo 2 — Tienda moderna</p>
                  <p className="text-xs text-muted-foreground">Imagen limpia con iconos de acción visibles al hacer hover sobre la tarjeta</p>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Meta Pixel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Meta Pixel (Facebook Ads)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Ingresa tu ID de píxel de Meta para rastrear eventos como visitas, compras y clics en WhatsApp en tu tienda online.
              </p>
              <div>
                <label className="text-sm font-medium mb-1 block">ID del Pixel de Meta</label>
                <Input
                  placeholder="Ej: 1234567890123456"
                  value={storeInfo.metaPixelId}
                  onChange={e => setStoreInfo(prev => ({ ...prev, metaPixelId: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Encuéntralo en Administrador de eventos → Fuentes de datos → Pixel en Meta Business Suite.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={handleSaveStoreInfo} disabled={saving} className="w-full sm:w-auto">
              <Save className="h-4 w-4 mr-2" />
              Guardar Información de Tienda
            </Button>
            {msg && (
              <span className={`text-sm font-medium flex items-center gap-1 ${msg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {msg.type === 'success' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                {msg.text}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────
          TAB: CHATBOT IA
      ────────────────────────────────────────── */}
      {activeTab === 'chatbot' && (
        <div className="space-y-4">
          {/* Status banner */}
          <div className={`flex items-center gap-3 p-3 rounded-lg border ${chatbotConfig.isEnabled ? 'bg-green-500/10 border-green-500/20' : 'bg-muted border-border'}`}>
            <Bot className={`h-5 w-5 flex-shrink-0 ${chatbotConfig.isEnabled ? 'text-green-600' : 'text-muted-foreground'}`} />
            <div>
              <p className="text-sm font-medium">
                {chatbotConfig.isEnabled ? `Chatbot activo — "${chatbotConfig.botName}"` : 'Chatbot inactivo'}
              </p>
              <p className="text-xs text-muted-foreground">
                {chatbotConfig.isEnabled
                  ? 'El chatbot está visible en tu tienda. Configura aquí su base de conocimiento.'
                  : 'El superadmin debe activar el chatbot para tu comercio. Puedes preparar tu configuración aquí.'}
              </p>
            </div>
          </div>

          {/* Identity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Identidad del Bot
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Nombre del asistente</label>
                  <Input
                    placeholder="ej: Luna, Valeria, Asistente..."
                    value={chatbotConfig.botName}
                    onChange={e => setChatbotConfig(p => ({ ...p, botName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Tono de conversación</label>
                  <select
                    value={chatbotConfig.tone}
                    onChange={e => setChatbotConfig(p => ({ ...p, tone: e.target.value as any }))}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="amigable">Amigable y cercano</option>
                    <option value="profesional">Profesional y cordial</option>
                    <option value="formal">Formal y respetuoso</option>
                    <option value="casual">Casual y relajado</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">URL del avatar del bot (opcional)</label>
                <Input
                  placeholder="https://... imagen del avatar"
                  value={chatbotConfig.botAvatarUrl}
                  onChange={e => setChatbotConfig(p => ({ ...p, botAvatarUrl: e.target.value }))}
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Color de acento del chat</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={chatbotConfig.accentColor}
                    onChange={e => setChatbotConfig(p => ({ ...p, accentColor: e.target.value }))}
                    className="w-10 h-10 rounded cursor-pointer border border-gray-200"
                  />
                  <Input
                    value={chatbotConfig.accentColor}
                    onChange={e => setChatbotConfig(p => ({ ...p, accentColor: e.target.value }))}
                    className="font-mono text-sm w-32"
                    maxLength={7}
                  />
                  <span className="text-xs text-gray-500">Color del encabezado y botones del chatbot</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Knowledge base */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4" />
                Base de Conocimiento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Información del negocio</label>
                <p className="text-xs text-muted-foreground mb-1.5">Describe tu tienda: qué vendes, horarios, ubicación, políticas, precios de envío, etc.</p>
                <Textarea
                  placeholder="Somos una perfumería online especializada en fragancias de lujo. Atendemos de Lunes a Sábado 8am-6pm. Envíos a todo Colombia en 2-5 días hábiles. Envío gratis en compras mayores a $150.000..."
                  value={chatbotConfig.businessInfo}
                  onChange={e => setChatbotConfig(p => ({ ...p, businessInfo: e.target.value }))}
                  rows={5}
                  className="resize-y"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Preguntas frecuentes (FAQ)</label>
                <p className="text-xs text-muted-foreground mb-1.5">Escribe preguntas y respuestas. El bot aprenderá de estas.</p>
                <Textarea
                  placeholder="¿Hacen envíos internacionales? — Por ahora solo envíos nacionales en Colombia.&#10;¿Aceptan devoluciones? — Sí, tienes 5 días después de recibir tu pedido para reportar cualquier novedad.&#10;¿Los perfumes son originales? — Sí, todos nuestros productos son 100% originales con garantía."
                  value={chatbotConfig.faqs}
                  onChange={e => setChatbotConfig(p => ({ ...p, faqs: e.target.value }))}
                  rows={6}
                  className="resize-y"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Instrucciones adicionales para el bot</label>
                <p className="text-xs text-muted-foreground mb-1.5">Reglas especiales, frases que debe usar, productos que debe promover, etc.</p>
                <Textarea
                  placeholder="Siempre saluda con '¡Hola! Soy [nombre], ¿en qué te puedo ayudar?'. Cuando el cliente pregunte por el mejor perfume, recomienda primero los productos en oferta. No compartas precios de mayoristas..."
                  value={chatbotConfig.systemPrompt}
                  onChange={e => setChatbotConfig(p => ({ ...p, systemPrompt: e.target.value }))}
                  rows={4}
                  className="resize-y"
                />
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Notificaciones de Pedidos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Recibe notificaciones cuando llegue un pedido nuevo. Se almacenan en tu panel y las verás en el ícono de notificaciones.</p>
              <div className={`flex items-center justify-between p-3 border rounded-lg ${chatbotConfig.notifyEmail ? 'bg-green-500/5 border-green-500/20' : 'bg-muted/30'}`}>
                <div>
                  <p className="text-sm font-medium">Notificaciones de pedidos en panel</p>
                  <p className="text-xs text-muted-foreground">Se registra cada pedido nuevo como notificación en tu panel</p>
                </div>
                <button
                  type="button"
                  onClick={() => setChatbotConfig(p => ({ ...p, notifyEmail: !p.notifyEmail }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${chatbotConfig.notifyEmail ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${chatbotConfig.notifyEmail ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              <div className={`flex items-center justify-between p-3 border rounded-lg ${chatbotConfig.notifyWhatsapp ? 'bg-green-500/5 border-green-500/20' : 'bg-muted/30'}`}>
                <div>
                  <p className="text-sm font-medium">Activar chatbot en WhatsApp flotante</p>
                  <p className="text-xs text-muted-foreground">El botón de WhatsApp abrirá el chat IA en lugar de redirigir a WhatsApp</p>
                </div>
                <button
                  type="button"
                  onClick={() => setChatbotConfig(p => ({ ...p, notifyWhatsapp: !p.notifyWhatsapp }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${chatbotConfig.notifyWhatsapp ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${chatbotConfig.notifyWhatsapp ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </CardContent>
          </Card>

          {/* ── WhatsApp Connection ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-green-600" />
                Agente en WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status badge */}
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${
                waStatus.connected
                  ? 'bg-green-500/10 text-green-700 border-green-500/20'
                  : waStatus.state === 'connecting'
                    ? 'bg-amber-500/10 text-amber-700 border-amber-500/20'
                    : 'bg-muted text-muted-foreground border-border'
              }`}>
                {waStatus.connected
                  ? <Wifi className="h-3.5 w-3.5" />
                  : waStatus.state === 'connecting'
                    ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    : <WifiOff className="h-3.5 w-3.5" />}
                {waStatus.connected
                  ? `Conectado${waStatus.whatsappNumber ? ` · ${waStatus.whatsappNumber}` : ''}`
                  : waStatus.state === 'connecting'
                    ? 'Conectando…'
                    : 'Sin conectar'}
              </div>

              {/* Phone input (only when not connected) */}
              {!waStatus.connected && (
                <div>
                  <label className="text-sm font-medium mb-1 block">Número de WhatsApp del negocio</label>
                  <Input
                    placeholder="+57 300 000 0000"
                    value={waPhone}
                    onChange={e => setWaPhone(e.target.value)}
                    className="max-w-xs"
                  />
                  <p className="text-xs text-muted-foreground mt-1">El número que vas a vincular (opcional, solo para referencia)</p>
                </div>
              )}

              {/* QR code */}
              {waQr && !waStatus.connected && (
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <QrCode className="h-4 w-4" />
                    Escanea este QR con WhatsApp
                  </p>
                  <div className="border rounded-lg p-3 w-fit bg-white">
                    <img src={waQr} alt="QR WhatsApp" className="w-52 h-52 object-contain" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    WhatsApp → Dispositivos vinculados → Vincular dispositivo → Escanear QR
                  </p>
                  <Button variant="outline" size="sm" onClick={handleRefreshQR} disabled={waLoading} className="gap-2">
                    <RefreshCw className={`h-3.5 w-3.5 ${waLoading ? 'animate-spin' : ''}`} />
                    Actualizar QR
                  </Button>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 flex-wrap">
                {!waStatus.connected ? (
                  <Button
                    onClick={handleConnectWhatsApp}
                    disabled={waLoading}
                    variant="outline"
                    className="gap-2 border-green-500/40 hover:bg-green-500/10 text-green-700"
                  >
                    {waLoading
                      ? <RefreshCw className="h-4 w-4 animate-spin" />
                      : <Smartphone className="h-4 w-4" />}
                    Conectar WhatsApp
                  </Button>
                ) : (
                  <Button
                    onClick={handleDisconnectWhatsApp}
                    disabled={waLoading}
                    variant="outline"
                    className="gap-2 border-red-500/30 hover:bg-red-500/10 text-red-600"
                  >
                    {waLoading
                      ? <RefreshCw className="h-4 w-4 animate-spin" />
                      : <WifiOff className="h-4 w-4" />}
                    Desconectar
                  </Button>
                )}
              </div>

              {waMsg && (
                <p className={`text-sm font-medium flex items-center gap-1.5 ${waMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
                  {waMsg.type === 'ok' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                  {waMsg.text}
                </p>
              )}

              <div className="bg-muted/40 rounded-md p-3 text-xs text-muted-foreground space-y-1.5">
                <p className="font-medium text-foreground/70">¿Cómo funciona?</p>
                <p>1. Clic en <strong>Conectar WhatsApp</strong> — aparece un QR</p>
                <p>2. En tu celular: WhatsApp → Dispositivos vinculados → Vincular → Escanear</p>
                <p>3. El agente IA empieza a responder mensajes automáticamente</p>
                <p className="pt-1 text-amber-600/80">Requiere <strong>Evolution API</strong> instalado en el servidor. Consulta la guía de configuración.</p>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={handleSaveChatbot} disabled={isSavingChatbot} className="w-full sm:w-auto gap-2">
              {isSavingChatbot ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar Configuración del Chatbot
            </Button>
            {chatbotMsg && (
              <span className={`text-sm font-medium flex items-center gap-1 ${chatbotMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
                {chatbotMsg.type === 'ok' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                {chatbotMsg.text}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB: CARRITO
      ══════════════════════════════════════════════════════════ */}
      {activeTab === 'carrito' && (
        <div className="space-y-6">

          {/* ── Sección 1: Mínimo de compra ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Mínimo de Compra para Domicilio con Flota
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Cuando el carrito del cliente supere este monto, la barra de progreso se llenará y aparecerá{' '}
                <strong>"¡Domicilio con flota incluido!"</strong> con el botón en verde. Pon <strong>0</strong> para desactivar la barra completamente.
              </p>

              <div className="flex items-end gap-4">
                <div className="flex-1 space-y-2">
                  <label className="text-sm font-medium">Monto mínimo (COP)</label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={cartMinPurchase}
                    onChange={e => setCartMinPurchase(Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="Ej: 80000"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div className="pb-1">
                  <span className="text-sm font-semibold text-primary">
                    {cartMinPurchase > 0 ? formatCurrency(cartMinPurchase) : 'Desactivado'}
                  </span>
                </div>
              </div>

              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">Tarifa de domicilio (COP)</label>
                <p className="text-xs text-muted-foreground">Se cobra cuando el pedido no alcanza el mínimo. Pon <strong>0</strong> para no cobrar tarifa.</p>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={cartDeliveryFee}
                  onChange={e => setCartDeliveryFee(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="Ej: 5000"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              {cartMinPurchase > 0 && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <p className="text-xs text-emerald-700">
                    Al alcanzar <strong>{formatCurrency(cartMinPurchase)}</strong> se desbloqueará el domicilio gratis.
                    {cartDeliveryFee > 0 && <> Por debajo del mínimo se aplicará una tarifa de <strong>{formatCurrency(cartDeliveryFee)}</strong>.</>}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3 flex-wrap">
                <Button onClick={handleSaveCartSettings} disabled={isSavingCartSettings} className="gap-2">
                  {isSavingCartSettings ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar Configuración
                </Button>
                {cartSettingsMsg && (
                  <span className={`text-sm font-medium flex items-center gap-1 ${cartSettingsMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
                    {cartSettingsMsg.type === 'ok' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    {cartSettingsMsg.text}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Sección 2: Order Bump ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Order Bump — Productos Sugeridos en Checkout
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Muestra productos adicionales al cliente justo antes de confirmar su pedido para aumentar el ticket promedio.
              </p>

              {/* Toggle activo */}
              <div className={`flex items-center justify-between p-3 border rounded-lg ${orderBumpConfig.isEnabled ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'}`}>
                <div>
                  <p className="text-sm font-medium">Activar Order Bump</p>
                  <p className="text-xs text-muted-foreground">Muestra sugerencias al cliente en el checkout</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOrderBumpConfig(p => ({ ...p, isEnabled: !p.isEnabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${orderBumpConfig.isEnabled ? 'bg-primary' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${orderBumpConfig.isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {orderBumpConfig.isEnabled && (
                <div className="space-y-4">
                  {/* Título de la sección */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Título de la sección</label>
                    <input
                      type="text"
                      value={orderBumpConfig.title}
                      onChange={e => setOrderBumpConfig(p => ({ ...p, title: e.target.value }))}
                      placeholder="¿También te puede interesar?"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>

                  {/* Modo */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Modo de selección</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['auto', 'manual'] as const).map(mode => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setOrderBumpConfig(p => ({ ...p, mode }))}
                          className={`p-3 rounded-lg border text-sm font-medium text-center transition-colors ${orderBumpConfig.mode === mode ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-muted-foreground/50'}`}
                        >
                          {mode === 'auto' ? '🤖 Automático' : '✋ Manual'}
                          <p className="text-xs font-normal text-muted-foreground mt-1">
                            {mode === 'auto' ? 'Productos de otras categorías del carrito' : 'Tú eliges qué mostrar'}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Máximo de ítems */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Máximo de productos a mostrar ({orderBumpConfig.maxItems})</label>
                    <input
                      type="range"
                      min={1}
                      max={6}
                      value={orderBumpConfig.maxItems}
                      onChange={e => setOrderBumpConfig(p => ({ ...p, maxItems: parseInt(e.target.value) }))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span>
                    </div>
                  </div>

                  {/* Selector de productos (solo en modo manual) */}
                  {orderBumpConfig.mode === 'manual' && (
                    <div className="space-y-3">
                      <label className="text-sm font-medium">
                        Productos seleccionados ({orderBumpConfig.productIds.length}/{orderBumpConfig.maxItems})
                      </label>

                      {/* Buscador */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                          type="text"
                          value={orderBumpSearch}
                          onChange={e => setOrderBumpSearch(e.target.value)}
                          placeholder="Buscar producto..."
                          className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </div>

                      {/* Lista de productos */}
                      <div className="border rounded-lg divide-y max-h-72 overflow-y-auto">
                        {orderBumpPublishedProducts
                          .filter(p =>
                            !orderBumpSearch ||
                            p.name.toLowerCase().includes(orderBumpSearch.toLowerCase()) ||
                            p.category.toLowerCase().includes(orderBumpSearch.toLowerCase())
                          )
                          .map(product => {
                            const selected = orderBumpConfig.productIds.includes(product.id)
                            const limitReached = !selected && orderBumpConfig.productIds.length >= orderBumpConfig.maxItems
                            return (
                              <div
                                key={product.id}
                                className={`flex items-center gap-3 p-3 transition-colors ${selected ? 'bg-primary/5' : limitReached ? 'opacity-40' : 'hover:bg-muted/50'}`}
                              >
                                <div className="w-10 h-10 rounded border overflow-hidden flex-shrink-0 bg-muted">
                                  {product.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Package className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{product.name}</p>
                                  <p className="text-xs text-muted-foreground">{product.category} · {formatCurrency(product.salePrice)}</p>
                                </div>
                                <button
                                  type="button"
                                  disabled={limitReached}
                                  onClick={() => toggleOrderBumpProduct(product.id)}
                                  className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${selected ? 'bg-primary text-primary-foreground' : 'border border-input hover:bg-muted'}`}
                                >
                                  {selected ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                </button>
                              </div>
                            )
                          })}
                        {orderBumpPublishedProducts.length === 0 && (
                          <div className="p-6 text-center text-sm text-muted-foreground">
                            No hay productos publicados en la tienda
                          </div>
                        )}
                      </div>

                      {/* Chips de seleccionados */}
                      {orderBumpConfig.productIds.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {orderBumpConfig.productIds.map(id => {
                            const p = orderBumpPublishedProducts.find(x => x.id === id)
                            if (!p) return null
                            return (
                              <span key={id} className="flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full">
                                {p.name}
                                <button type="button" onClick={() => toggleOrderBumpProduct(id)} className="hover:text-destructive transition-colors">
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3 flex-wrap pt-2 border-t">
                <Button onClick={handleSaveOrderBump} disabled={isSavingOrderBump} className="gap-2">
                  {isSavingOrderBump ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar Order Bump
                </Button>
                {orderBumpMsg && (
                  <span className={`text-sm font-medium flex items-center gap-1 ${orderBumpMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
                    {orderBumpMsg.type === 'ok' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    {orderBumpMsg.text}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

        </div>
      )}

      {/* ===== Barra de guardado fija (siempre visible) ===== */}
      {activeSticky && (
        <div className="sticky bottom-3 z-30 mt-6 flex items-center justify-end gap-3 rounded-xl border border-border bg-background/95 backdrop-blur px-4 py-3 shadow-lg">
          <span className="text-xs text-muted-foreground mr-auto hidden sm:block">
            Sección: {tabs.find(t => t.key === activeTab)?.label}
          </span>
          <Button onClick={activeSticky.fn} disabled={activeSticky.busy} className="gap-2">
            <Save className="h-4 w-4" />
            {activeSticky.busy ? 'Guardando...' : activeSticky.label}
          </Button>
        </div>
      )}
    </div>
  )
}
