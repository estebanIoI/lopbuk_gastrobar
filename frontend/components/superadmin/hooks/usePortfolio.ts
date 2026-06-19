'use client'

import { useState, useCallback, useEffect } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PortfolioTenant {
  id: string; name: string; slug: string; plan: string; logoUrl?: string
}

export interface TeamCard {
  id: number; name: string; role: string; bio: string; photo_url: string
  band_image_url: string
  accent_color: string; sort_order: number; is_active: boolean
  github_url: string; linkedin_url: string
}

export interface FeatureCard {
  id: number; icon: string; title: string; description: string
  sort_order: number; is_active: boolean
}

export interface PfServiceOption {
  id: number; category_id: number; title: string; description: string
  savings: string; price: number; is_popular: boolean; sort_order: number; is_active: boolean
}

export interface PfServiceCategory {
  id: number; icon: string; label: string; type: 'package' | 'subscription' | 'addon'
  sort_order: number; is_active: boolean; options: PfServiceOption[]
}

const emptyTeamCard = (): Omit<TeamCard, 'id'> => ({
  name: '', role: '', bio: '', photo_url: '', band_image_url: '', accent_color: '#06b6d4',
  sort_order: 0, is_active: true, github_url: '', linkedin_url: '',
})
const emptyFeatureCard = (): Omit<FeatureCard, 'id'> => ({
  icon: '⚡', title: '', description: '', sort_order: 0, is_active: true,
})
const emptyServiceCat = (): Omit<PfServiceCategory, 'id' | 'options'> => ({
  icon: '📦', label: '', type: 'package', sort_order: 0, is_active: true,
})
const emptyServiceOpt = (categoryId: number): Omit<PfServiceOption, 'id'> => ({
  category_id: categoryId, title: '', description: '', savings: '',
  price: 0, is_popular: false, sort_order: 0, is_active: true,
})

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePortfolio() {
  // Config
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
  const [pfRobotSpline, setPfRobotSpline] = useState('')
  const [pfLanyardOffsetX, setPfLanyardOffsetX] = useState(0)
  const [pfLanyardOffsetY, setPfLanyardOffsetY] = useState(0)
  const [pfLanyardScale, setPfLanyardScale] = useState(100)
  const [pfTenants, setPfTenants] = useState<PortfolioTenant[]>([])
  const [pfLoading, setPfLoading] = useState(false)
  const [pfSaving, setPfSaving] = useState(false)
  const [pfSaved, setPfSaved] = useState(false)

  // Team cards
  const [teamCards, setTeamCards] = useState<TeamCard[]>([])
  const [teamLoading, setTeamLoading] = useState(false)
  const [teamDialog, setTeamDialog] = useState(false)
  const [editingCard, setEditingCard] = useState<TeamCard | null>(null)
  const [teamForm, setTeamForm] = useState<Omit<TeamCard, 'id'>>(emptyTeamCard())
  const [teamSaving, setTeamSaving] = useState(false)
  const [teamDeletingId, setTeamDeletingId] = useState<number | null>(null)

  // Feature cards
  const [featureCards, setFeatureCards] = useState<FeatureCard[]>([])
  const [featureLoading, setFeatureLoading] = useState(false)
  const [featureDialog, setFeatureDialog] = useState(false)
  const [editingFeature, setEditingFeature] = useState<FeatureCard | null>(null)
  const [featureForm, setFeatureForm] = useState<Omit<FeatureCard, 'id'>>(emptyFeatureCard())
  const [featureSaving, setFeatureSaving] = useState(false)
  const [featureDeletingId, setFeatureDeletingId] = useState<number | null>(null)

  // Service catalog
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

  // ── Fetchers ────────────────────────────────────────────────────────────────

  const fetchPortfolioConfig = useCallback(async () => {
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
      setPfRobotSpline(d.robotSplineUrl || '')
      setPfLanyardOffsetX(Number(d.lanyardOffsetX) || 0)
      setPfLanyardOffsetY(Number(d.lanyardOffsetY) || 0)
      setPfLanyardScale(Number(d.lanyardScale) || 100)
      setPfTenants(d.tenants || [])
    }
    setPfLoading(false)
  }, [])

  const fetchTeamCards = useCallback(async () => {
    setTeamLoading(true)
    const res = await api.getPortfolioTeamAll()
    if (res.success && res.data) setTeamCards(res.data as TeamCard[])
    setTeamLoading(false)
  }, [])

  const fetchFeatureCards = useCallback(async () => {
    setFeatureLoading(true)
    const res = await api.getPortfolioFeaturesAll()
    if (res.success && res.data) setFeatureCards(res.data as FeatureCard[])
    setFeatureLoading(false)
  }, [])

  const fetchServiceCatalog = useCallback(async () => {
    setServiceLoading(true)
    const res = await api.getPortfolioServicesAll()
    if (res.success && res.data) setServiceCategories(res.data as PfServiceCategory[])
    setServiceLoading(false)
  }, [])

  useEffect(() => {
    fetchPortfolioConfig()
    fetchTeamCards()
    fetchFeatureCards()
    fetchServiceCatalog()
  }, [fetchPortfolioConfig, fetchTeamCards, fetchFeatureCards, fetchServiceCatalog])

  // ── Portfolio config save ────────────────────────────────────────────────────

  const handleSavePortfolio = async () => {
    setPfSaving(true)
    const res = await api.updatePortfolioConfig({
      heroTitle: pfHeroTitle, heroSubtitle: pfHeroSubtitle, heroImageUrl: pfHeroImage,
      brandDescription: pfBrandDescription, showPricing: pfShowPricing,
      showFeaturedStores: pfShowStores, featuredTenantIds: pfFeaturedIds,
      contactEmail: pfContactEmail, contactWhatsapp: pfContactWhatsapp,
      contactInstagram: pfContactInstagram, accentColor: pfAccentColor, isPublished: pfIsPublished,
      robotSplineUrl: pfRobotSpline,
      lanyardOffsetX: pfLanyardOffsetX, lanyardOffsetY: pfLanyardOffsetY, lanyardScale: pfLanyardScale,
    })
    if (res.success) {
      setPfSaved(true); toast.success('Portafolio guardado')
      setTimeout(() => setPfSaved(false), 3000)
    } else {
      toast.error(res.error || 'Error al guardar')
    }
    setPfSaving(false)
  }

  // ── Team card handlers ───────────────────────────────────────────────────────

  const openNewCard = () => { setEditingCard(null); setTeamForm(emptyTeamCard()); setTeamDialog(true) }

  const openEditCard = (card: TeamCard) => {
    setEditingCard(card)
    setTeamForm({
      name: card.name, role: card.role, bio: card.bio, photo_url: card.photo_url,
      band_image_url: card.band_image_url || '',
      accent_color: card.accent_color, sort_order: card.sort_order,
      is_active: Boolean(card.is_active), github_url: card.github_url, linkedin_url: card.linkedin_url,
    })
    setTeamDialog(true)
  }

  const handleSaveTeamCard = async () => {
    if (!teamForm.name.trim()) { toast.error('El nombre es requerido'); return }
    setTeamSaving(true)
    const payload = {
      name: teamForm.name, role: teamForm.role, bio: teamForm.bio,
      photoUrl: teamForm.photo_url, bandImageUrl: teamForm.band_image_url,
      accentColor: teamForm.accent_color,
      sortOrder: teamForm.sort_order, isActive: teamForm.is_active,
      githubUrl: teamForm.github_url, linkedinUrl: teamForm.linkedin_url,
    }
    const res = editingCard
      ? await api.updatePortfolioTeamCard(editingCard.id, payload)
      : await api.createPortfolioTeamCard(payload)
    if (res.success) {
      toast.success(editingCard ? 'Tarjeta actualizada' : 'Tarjeta creada')
      setTeamDialog(false); fetchTeamCards()
    } else { toast.error(res.error || 'Error al guardar') }
    setTeamSaving(false)
  }

  const handleDeleteTeamCard = async (id: number) => {
    setTeamDeletingId(id)
    const res = await api.deletePortfolioTeamCard(id)
    if (res.success) { toast.success('Tarjeta eliminada'); fetchTeamCards() }
    else toast.error(res.error || 'Error al eliminar')
    setTeamDeletingId(null)
  }

  // ── Feature card handlers ────────────────────────────────────────────────────

  const openNewFeature = () => { setEditingFeature(null); setFeatureForm(emptyFeatureCard()); setFeatureDialog(true) }

  const openEditFeature = (f: FeatureCard) => {
    setEditingFeature(f)
    setFeatureForm({ icon: f.icon, title: f.title, description: f.description, sort_order: f.sort_order, is_active: Boolean(f.is_active) })
    setFeatureDialog(true)
  }

  const handleSaveFeature = async () => {
    if (!featureForm.title.trim()) { toast.error('El título es requerido'); return }
    setFeatureSaving(true)
    const payload = { icon: featureForm.icon, title: featureForm.title, description: featureForm.description, sortOrder: featureForm.sort_order, isActive: featureForm.is_active }
    const res = editingFeature ? await api.updatePortfolioFeature(editingFeature.id, payload) : await api.createPortfolioFeature(payload)
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

  // ── Service catalog handlers ─────────────────────────────────────────────────

  const openNewServiceCat = () => { setEditingCat(null); setServiceCatForm(emptyServiceCat()); setServiceCatDialog(true) }

  const openEditServiceCat = (cat: PfServiceCategory) => {
    setEditingCat(cat)
    setServiceCatForm({ icon: cat.icon, label: cat.label, type: cat.type, sort_order: cat.sort_order, is_active: Boolean(cat.is_active) })
    setServiceCatDialog(true)
  }

  const handleSaveServiceCat = async () => {
    if (!serviceCatForm.label.trim()) { toast.error('La etiqueta es requerida'); return }
    setServiceCatSaving(true)
    const payload = { icon: serviceCatForm.icon, label: serviceCatForm.label, type: serviceCatForm.type, sortOrder: serviceCatForm.sort_order, isActive: serviceCatForm.is_active }
    const res = editingCat ? await api.updatePortfolioServiceCategory(editingCat.id, payload) : await api.createPortfolioServiceCategory(payload)
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

  const openNewServiceOpt = (categoryId: number) => { setEditingOpt(null); setServiceOptForm(emptyServiceOpt(categoryId)); setServiceOptDialog(true) }

  const openEditServiceOpt = (opt: PfServiceOption) => {
    setEditingOpt(opt)
    setServiceOptForm({ category_id: opt.category_id, title: opt.title, description: opt.description, savings: opt.savings, price: opt.price, is_popular: Boolean(opt.is_popular), sort_order: opt.sort_order, is_active: Boolean(opt.is_active) })
    setServiceOptDialog(true)
  }

  const handleSaveServiceOpt = async () => {
    if (!serviceOptForm.title.trim()) { toast.error('El título es requerido'); return }
    setServiceOptSaving(true)
    const payload = { categoryId: serviceOptForm.category_id, title: serviceOptForm.title, description: serviceOptForm.description, savings: serviceOptForm.savings, price: serviceOptForm.price, isPopular: serviceOptForm.is_popular, sortOrder: serviceOptForm.sort_order, isActive: serviceOptForm.is_active }
    const res = editingOpt ? await api.updatePortfolioServiceOption(editingOpt.id, payload) : await api.createPortfolioServiceOption(payload)
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

  return {
    // config
    pfHeroTitle, setPfHeroTitle, pfHeroSubtitle, setPfHeroSubtitle,
    pfHeroImage, setPfHeroImage, pfBrandDescription, setPfBrandDescription,
    pfShowPricing, setPfShowPricing, pfShowStores, setPfShowStores,
    pfFeaturedIds, setPfFeaturedIds, pfContactEmail, setPfContactEmail,
    pfContactWhatsapp, setPfContactWhatsapp, pfContactInstagram, setPfContactInstagram,
    pfAccentColor, setPfAccentColor, pfIsPublished, setPfIsPublished,
    pfRobotSpline, setPfRobotSpline,
    pfLanyardOffsetX, setPfLanyardOffsetX, pfLanyardOffsetY, setPfLanyardOffsetY, pfLanyardScale, setPfLanyardScale,
    pfTenants, pfLoading, pfSaving, pfSaved, handleSavePortfolio,
    // team
    teamCards, teamLoading, teamDialog, setTeamDialog,
    editingCard, teamForm, setTeamForm, teamSaving, teamDeletingId,
    openNewCard, openEditCard, handleSaveTeamCard, handleDeleteTeamCard,
    // features
    featureCards, featureLoading, featureDialog, setFeatureDialog,
    editingFeature, featureForm, setFeatureForm, featureSaving, featureDeletingId,
    openNewFeature, openEditFeature, handleSaveFeature, handleDeleteFeature,
    // services
    serviceCategories, serviceLoading, expandedCatId, setExpandedCatId,
    serviceCatDialog, setServiceCatDialog, editingCat, serviceCatForm, setServiceCatForm,
    serviceCatSaving, serviceCatDeletingId, openNewServiceCat, openEditServiceCat,
    handleSaveServiceCat, handleDeleteServiceCat,
    serviceOptDialog, setServiceOptDialog, editingOpt, serviceOptForm, setServiceOptForm,
    serviceOptSaving, serviceOptDeletingId, openNewServiceOpt, openEditServiceOpt,
    handleSaveServiceOpt, handleDeleteServiceOpt,
  }
}
