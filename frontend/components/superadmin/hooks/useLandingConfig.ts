'use client'

import { useState, useCallback, useEffect } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { clearCloudinaryCache } from '@/components/ui/cloudinary-upload'
import { type HeroSlide, type PromoCardConfig, PROMO_CARD_CATALOG, DEFAULT_PROMO_CARDS } from '@/components/home-theme2'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

const genId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `slide_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export interface Drop {
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
  name: '', description: '', bannerUrl: '', globalDiscount: 0,
  startsAt: '', endsAt: '', isActive: true,
})

export function useLandingConfig() {
  // Hero
  const [heroUrl, setHeroUrl] = useState('')
  const [heroTitle, setHeroTitle] = useState('')
  const [heroSubtitle, setHeroSubtitle] = useState('')
  const [isSavingHero, setIsSavingHero] = useState(false)

  // Login image
  const [loginImageUrl, setLoginImageUrl] = useState('')
  const [isSavingLogin, setIsSavingLogin] = useState(false)

  // Logo / favicon de la plataforma (DAIMUZ). Por defecto el icono navy.
  const DEFAULT_PLATFORM_LOGO = '/daimuz-icon.png'
  const [platformLogo, setPlatformLogo] = useState(DEFAULT_PLATFORM_LOGO)
  const [isSavingPlatformLogo, setIsSavingPlatformLogo] = useState(false)

  // Theme
  const [panelTheme, setPanelTheme] = useState<'classic' | 'comerciante'>('classic')
  const [isSavingTheme, setIsSavingTheme] = useState(false)

  // Home theme (Tema 1 clásico / Tema 2 marketplace estilo Mercado Libre)
  const [homeTheme, setHomeTheme] = useState<'theme1' | 'theme2'>('theme1')
  const [isSavingHomeTheme, setIsSavingHomeTheme] = useState(false)

  // Slides del carrusel del Hero (Página de Inicio, Tema 2)
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([])
  const [isSavingSlides, setIsSavingSlides] = useState(false)

  // Layout del hero del Tema 2 (proporción del split + contenido panel derecho)
  const [heroSplit, setHeroSplit] = useState<'70-30' | '60-40' | '50-50'>('60-40')
  const [heroRight, setHeroRight] = useState<'producto' | 'comercio' | 'cta'>('producto')
  const [isSavingHeroLayout, setIsSavingHeroLayout] = useState(false)

  // Barra de bienvenida (Página de Inicio, Tema 2): activable + contenido editable
  const [welcomeEnabled, setWelcomeEnabled] = useState(true)
  const [welcomeTitle, setWelcomeTitle] = useState('')
  const [welcomeSubtitle, setWelcomeSubtitle] = useState('')
  const [isSavingWelcome, setIsSavingWelcome] = useState(false)

  // Tarjetas del carrusel "Para ti"
  const [promoCards, setPromoCards] = useState<PromoCardConfig[]>(DEFAULT_PROMO_CARDS)
  const [isSavingPromos, setIsSavingPromos] = useState(false)
  const promoCatalog = PROMO_CARD_CATALOG

  // Offers
  const [offers, setOffers] = useState<any[]>([])
  const [isLoadingOffers, setIsLoadingOffers] = useState(false)

  // Drops
  const [drops, setDrops] = useState<Drop[]>([])
  const [isLoadingDrops, setIsLoadingDrops] = useState(false)
  const [isDropDialogOpen, setIsDropDialogOpen] = useState(false)
  const [editingDrop, setEditingDrop] = useState<Drop | null>(null)
  const [dropForm, setDropForm] = useState<Omit<Drop, 'id'>>(emptyDrop())
  const [isSavingDrop, setIsSavingDrop] = useState(false)
  const [deletingDropId, setDeletingDropId] = useState<number | null>(null)

  const fetchPlatformSettings = useCallback(async () => {
    const result = await api.getPlatformSettings()
    if (result.success && result.data) {
      if (result.data.hero_image_url) setHeroUrl(result.data.hero_image_url)
      if (result.data.hero_title) setHeroTitle(result.data.hero_title)
      if (result.data.hero_subtitle) setHeroSubtitle(result.data.hero_subtitle)
      if (result.data.login_image_url) setLoginImageUrl(result.data.login_image_url)
      if (result.data.platform_logo) setPlatformLogo(result.data.platform_logo)
      if (result.data.panel_theme === 'comerciante' || result.data.panel_theme === 'classic') {
        setPanelTheme(result.data.panel_theme)
      }
      if (result.data.home_theme === 'theme2' || result.data.home_theme === 'theme1') {
        setHomeTheme(result.data.home_theme)
      }
      if (result.data.home_hero_slides) {
        try {
          const parsed = JSON.parse(result.data.home_hero_slides)
          if (Array.isArray(parsed)) setHeroSlides(parsed as HeroSlide[])
        } catch { /* JSON inválido */ }
      }
      if (['70-30', '60-40', '50-50'].includes(result.data.home_hero_split)) {
        setHeroSplit(result.data.home_hero_split as '70-30' | '60-40' | '50-50')
      }
      if (['producto', 'comercio', 'cta'].includes(result.data.home_hero_right)) {
        setHeroRight(result.data.home_hero_right as 'producto' | 'comercio' | 'cta')
      }
      if (result.data.home_welcome_enabled !== undefined) setWelcomeEnabled(result.data.home_welcome_enabled !== 'false')
      if (result.data.home_welcome_title !== undefined) setWelcomeTitle(result.data.home_welcome_title)
      if (result.data.home_welcome_subtitle !== undefined) setWelcomeSubtitle(result.data.home_welcome_subtitle)
      if (result.data.home_promo_cards) {
        try {
          const parsed = JSON.parse(result.data.home_promo_cards)
          if (Array.isArray(parsed) && parsed.length) setPromoCards(parsed as PromoCardConfig[])
        } catch { /* JSON inválido */ }
      }
    }
  }, [])

  const fetchOffers = useCallback(async () => {
    setIsLoadingOffers(true)
    try {
      const res = await fetch(`${API_URL}/storefront/products?limit=100&store=all`)
      const json = await res.json()
      if (json.success && json.data?.products) {
        setOffers(json.data.products.filter((p: any) => p.isOnOffer))
      }
    } catch { /* silent */ }
    setIsLoadingOffers(false)
  }, [])

  const fetchDrops = useCallback(async () => {
    setIsLoadingDrops(true)
    try {
      const res = await fetch(`${API_URL}/storefront/drops`, {
        headers: { Authorization: `Bearer ${api.getToken()}` },
      })
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) setDrops(json.data)
      else if (Array.isArray(json)) setDrops(json)
    } catch { /* silent */ }
    setIsLoadingDrops(false)
  }, [])

  useEffect(() => {
    fetchPlatformSettings()
    fetchOffers()
    fetchDrops()
  }, [fetchPlatformSettings, fetchOffers, fetchDrops])

  const handleSaveHero = async () => {
    setIsSavingHero(true)
    try {
      const results = await Promise.all([
        api.updatePlatformSetting('hero_image_url', heroUrl),
        api.updatePlatformSetting('hero_title', heroTitle),
        api.updatePlatformSetting('hero_subtitle', heroSubtitle),
      ])
      if (results.every(r => r.success)) toast.success('Hero principal actualizado')
      else toast.error('Error al guardar algunos campos')
    } catch { toast.error('Error de conexión') }
    setIsSavingHero(false)
  }

  const handleSavePlatformLogo = async (value?: string) => {
    const next = (value ?? platformLogo) || DEFAULT_PLATFORM_LOGO
    setPlatformLogo(next)
    setIsSavingPlatformLogo(true)
    const result = await api.updatePlatformSetting('platform_logo', next)
    if (result.success) toast.success('Logo de la plataforma actualizado')
    else toast.error(result.error || 'Error al guardar el logo')
    setIsSavingPlatformLogo(false)
  }

  const handleSaveLoginImage = async () => {
    setIsSavingLogin(true)
    const result = await api.updatePlatformSetting('login_image_url', loginImageUrl)
    if (result.success) toast.success('Imagen del login actualizada')
    else toast.error(result.error || 'Error al guardar')
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

  const handleSaveHomeTheme = async (value: 'theme1' | 'theme2') => {
    setIsSavingHomeTheme(true)
    const prev = homeTheme
    setHomeTheme(value)
    const result = await api.updatePlatformSetting('home_theme', value)
    if (result.success) {
      toast.success(value === 'theme2' ? 'Tema 2 (Marketplace) activado en la página de inicio' : 'Tema clásico activado en la página de inicio')
    } else {
      setHomeTheme(prev)
      toast.error(result.error || 'Error al guardar el tema de la home')
    }
    setIsSavingHomeTheme(false)
  }

  const handleSaveHeroSplit = async (value: '70-30' | '60-40' | '50-50') => {
    const prev = heroSplit
    setHeroSplit(value)
    setIsSavingHeroLayout(true)
    const result = await api.updatePlatformSetting('home_hero_split', value)
    if (result.success) toast.success('Proporción del hero actualizada')
    else { setHeroSplit(prev); toast.error(result.error || 'Error al guardar') }
    setIsSavingHeroLayout(false)
  }

  const handleSaveHeroRight = async (value: 'producto' | 'comercio' | 'cta') => {
    const prev = heroRight
    setHeroRight(value)
    setIsSavingHeroLayout(true)
    const result = await api.updatePlatformSetting('home_hero_right', value)
    if (result.success) toast.success('Panel derecho del hero actualizado')
    else { setHeroRight(prev); toast.error(result.error || 'Error al guardar') }
    setIsSavingHeroLayout(false)
  }

  const handleSaveWelcome = async () => {
    setIsSavingWelcome(true)
    const results = await Promise.all([
      api.updatePlatformSetting('home_welcome_enabled', welcomeEnabled ? 'true' : 'false'),
      api.updatePlatformSetting('home_welcome_title', welcomeTitle),
      api.updatePlatformSetting('home_welcome_subtitle', welcomeSubtitle),
    ])
    if (results.every(r => r.success)) toast.success('Barra de bienvenida actualizada')
    else toast.error('Error al guardar la barra de bienvenida')
    setIsSavingWelcome(false)
  }

  // ── Tarjetas del carrusel "Para ti" ──
  const addPromoCard = (key: string) => {
    const cat = PROMO_CARD_CATALOG.find(c => c.key === key)
    if (!cat) return
    setPromoCards(p => [...p, { key: cat.key, label: cat.label }])
  }
  const removePromoCard = (index: number) =>
    setPromoCards(p => p.filter((_, i) => i !== index))
  const updatePromoLabel = (index: number, label: string) =>
    setPromoCards(p => p.map((c, i) => (i === index ? { ...c, label } : c)))
  const movePromoCard = (index: number, dir: -1 | 1) =>
    setPromoCards(p => {
      const j = index + dir
      if (j < 0 || j >= p.length) return p
      const copy = [...p]
      ;[copy[index], copy[j]] = [copy[j], copy[index]]
      return copy
    })
  const handleSavePromoCards = async () => {
    setIsSavingPromos(true)
    const result = await api.updatePlatformSetting('home_promo_cards', JSON.stringify(promoCards))
    if (result.success) toast.success('Tarjetas del carrusel actualizadas')
    else toast.error(result.error || 'Error al guardar las tarjetas')
    setIsSavingPromos(false)
  }

  // ── CRUD local de slides del carrusel ──
  const addSlide = () =>
    setHeroSlides(s => [...s, { id: genId(), type: 'image', url: '', link: '', title: '', subtitle: '' }])

  const updateSlide = (id: string, patch: Partial<HeroSlide>) =>
    setHeroSlides(s => s.map(sl => (sl.id === id ? { ...sl, ...patch } : sl)))

  const removeSlide = (id: string) =>
    setHeroSlides(s => s.filter(sl => sl.id !== id))

  const moveSlide = (id: string, dir: -1 | 1) =>
    setHeroSlides(s => {
      const i = s.findIndex(sl => sl.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= s.length) return s
      const copy = [...s]
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })

  const handleSaveHeroSlides = async () => {
    // Descarta slides sin URL
    const clean = heroSlides
      .filter(s => s.url && s.url.trim())
      .map(s => ({
        id: s.id,
        type: s.type === 'video' ? 'video' : 'image',
        url: s.url.trim(),
        link: s.link?.trim() || undefined,
        title: s.title?.trim() || undefined,
        subtitle: s.subtitle?.trim() || undefined,
      }))
    setIsSavingSlides(true)
    const result = await api.updatePlatformSetting('home_hero_slides', JSON.stringify(clean))
    if (result.success) toast.success('Carrusel del hero actualizado')
    else toast.error(result.error || 'Error al guardar el carrusel')
    setIsSavingSlides(false)
  }

  const openCreateDrop = () => { setEditingDrop(null); setDropForm(emptyDrop()); setIsDropDialogOpen(true) }

  const openEditDrop = (drop: Drop) => {
    setEditingDrop(drop)
    setDropForm({
      name: drop.name, description: drop.description || '', bannerUrl: drop.bannerUrl || '',
      globalDiscount: drop.globalDiscount,
      startsAt: drop.startsAt ? drop.startsAt.slice(0, 16) : '',
      endsAt: drop.endsAt ? drop.endsAt.slice(0, 16) : '',
      isActive: drop.isActive,
    })
    setIsDropDialogOpen(true)
  }

  const handleSaveDrop = async () => {
    if (!dropForm.name || !dropForm.startsAt || !dropForm.endsAt) {
      toast.error('Nombre, fecha de inicio y fin son requeridos'); return
    }
    setIsSavingDrop(true)
    const payload = {
      name: dropForm.name, description: dropForm.description || undefined,
      bannerUrl: dropForm.bannerUrl || undefined,
      globalDiscount: Number(dropForm.globalDiscount),
      startsAt: dropForm.startsAt, endsAt: dropForm.endsAt, isActive: dropForm.isActive,
    }
    const result = editingDrop ? await api.updateDrop(editingDrop.id, payload) : await api.createDrop(payload)
    if (result.success) { toast.success(editingDrop ? 'Drop actualizado' : 'Drop creado'); setIsDropDialogOpen(false); fetchDrops() }
    else toast.error(result.error || 'Error al guardar drop')
    setIsSavingDrop(false)
  }

  const handleDeleteDrop = async (id: number) => {
    const result = await api.deleteDrop(id)
    if (result.success) { toast.success('Drop eliminado'); setDeletingDropId(null); fetchDrops() }
    else toast.error(result.error || 'Error al eliminar')
  }

  return {
    // hero
    heroUrl, setHeroUrl, heroTitle, setHeroTitle, heroSubtitle, setHeroSubtitle,
    isSavingHero, handleSaveHero,
    // login
    loginImageUrl, setLoginImageUrl, isSavingLogin, handleSaveLoginImage,
    // logo/favicon de plataforma
    platformLogo, setPlatformLogo, isSavingPlatformLogo, handleSavePlatformLogo,
    // theme
    panelTheme, isSavingTheme, handleSavePanelTheme,
    // home theme + carrusel hero
    homeTheme, isSavingHomeTheme, handleSaveHomeTheme,
    heroSlides, isSavingSlides, addSlide, updateSlide, removeSlide, moveSlide, handleSaveHeroSlides,
    // layout del hero (split + panel derecho)
    heroSplit, heroRight, isSavingHeroLayout, handleSaveHeroSplit, handleSaveHeroRight,
    welcomeEnabled, setWelcomeEnabled, welcomeTitle, setWelcomeTitle, welcomeSubtitle, setWelcomeSubtitle, isSavingWelcome, handleSaveWelcome,
    // tarjetas del carrusel "Para ti"
    promoCards, promoCatalog, isSavingPromos, addPromoCard, removePromoCard, updatePromoLabel, movePromoCard, handleSavePromoCards,
    // offers
    offers, isLoadingOffers, fetchOffers,
    // drops
    drops, isLoadingDrops, fetchDrops,
    isDropDialogOpen, setIsDropDialogOpen,
    editingDrop, dropForm, setDropForm,
    isSavingDrop, deletingDropId, setDeletingDropId,
    openCreateDrop, openEditDrop, handleSaveDrop, handleDeleteDrop,
  }
}
