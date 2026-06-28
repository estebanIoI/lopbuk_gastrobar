'use client'

import { useState, useCallback, useEffect } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TenantFull {
  id: string
  name: string
  slug: string
  businessType?: string
  ownerName?: string
  ownerEmail?: string
  plan: string
  status: 'activo' | 'suspendido' | 'cancelado'
  maxUsers: number
  maxProducts: number
  totalUsers: number
  totalProducts: number
  totalSales: number
  bgColor?: string
  createdAt: string
  updatedAt: string
  // Hidden Layer
  isHidden?: boolean
  hiddenAccessToken?: string
  hiddenAccessCode?: string
  hiddenTokenExpiresAt?: string
  allowRegeneration?: boolean
}

export interface WizardData {
  // Step 1: Commerce
  name: string
  slug: string
  businessType: string
  // Step 2: Plan
  plan: 'basico' | 'profesional' | 'empresarial'
  maxUsers: number
  maxProducts: number
  // Step 3: Owner
  ownerName: string
  ownerEmail: string
  ownerPassword: string
  ownerPasswordConfirm: string
}

const WIZARD_DEFAULTS: WizardData = {
  name: '', slug: '', businessType: '',
  plan: 'basico', maxUsers: 5, maxProducts: 500,
  ownerName: '', ownerEmail: '', ownerPassword: '', ownerPasswordConfirm: '',
}

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTenantLifecycle() {
  // Full tenant list (active + trash)
  const [tenants, setTenants] = useState<TenantFull[]>([])
  const [isLoadingTenants, setIsLoadingTenants] = useState(false)
  const [tenantSearch, setTenantSearch] = useState('')
  const [businessTypes, setBusinessTypes] = useState<string[]>([])

  // Wizard
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [wizardData, setWizardData] = useState<WizardData>(WIZARD_DEFAULTS)
  const [wizardErrors, setWizardErrors] = useState<Partial<Record<keyof WizardData, string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Per-row loading state
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [trashingId, setTrashingId] = useState<string | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchTenants = useCallback(async () => {
    setIsLoadingTenants(true)
    const result = await api.getAllTenants({ limit: 200 })
    if (result.success && result.data) {
      setTenants((result.data as any[]).map((t: any): TenantFull => ({
        id:           t.id,
        name:         t.name,
        slug:         t.slug,
        businessType: t.businessType,
        ownerName:    t.ownerName,
        ownerEmail:   t.ownerEmail,
        plan:         t.plan,
        status:       t.status,
        maxUsers:     t.maxUsers,
        maxProducts:  t.maxProducts,
        totalUsers:   t.totalUsers   ?? 0,
        totalProducts:t.totalProducts ?? 0,
        totalSales:   t.totalSales   ?? 0,
        bgColor:              t.bgColor,
        createdAt:            t.createdAt,
        updatedAt:            t.updatedAt,
        isHidden:             Boolean(t.isHidden ?? t.is_hidden),
        hiddenAccessToken:    t.hiddenAccessToken ?? t.hidden_access_token ?? undefined,
        hiddenAccessCode:     t.hiddenAccessCode  ?? t.hidden_access_code  ?? undefined,
        hiddenTokenExpiresAt: t.hiddenTokenExpiresAt ?? t.hidden_token_expires_at ?? undefined,
        allowRegeneration:    (t.allowRegeneration ?? t.allow_regeneration) !== false && (t.allowRegeneration ?? t.allow_regeneration) !== 0,
      })))
    }
    setIsLoadingTenants(false)
  }, [])

  const fetchBusinessTypes = useCallback(async () => {
    const r = await api.getBusinessTypes()
    if (r.success && r.data) setBusinessTypes(r.data as string[])
  }, [])

  useEffect(() => {
    fetchTenants()
    fetchBusinessTypes()
  }, [fetchTenants, fetchBusinessTypes])

  // ── Status actions ────────────────────────────────────────────────────────

  const handleToggleStatus = useCallback(async (tenant: TenantFull) => {
    setTogglingId(tenant.id)
    const result = await api.toggleTenantStatus(tenant.id)
    if (result.success) {
      const next = tenant.status === 'activo' ? 'suspendido' : 'activo'
      setTenants(prev => prev.map(t => t.id === tenant.id ? { ...t, status: next } : t))
      toast.success(next === 'activo' ? 'Comercio activado' : 'Comercio suspendido')
    } else {
      toast.error(result.error || 'Error al cambiar estado')
    }
    setTogglingId(null)
  }, [])

  const handleTrash = useCallback(async (tenant: TenantFull) => {
    setTrashingId(tenant.id)
    const result = await api.softDeleteTenant(tenant.id)
    if (result.success) {
      setTenants(prev => prev.map(t => t.id === tenant.id ? { ...t, status: 'cancelado' } : t))
      toast.success(`${tenant.name} movido a la papelera`)
    } else {
      toast.error(result.error || 'Error al mover a papelera')
    }
    setTrashingId(null)
  }, [])

  const handleRestore = useCallback(async (tenant: TenantFull) => {
    setRestoringId(tenant.id)
    const result = await api.restoreTenant(tenant.id)
    if (result.success) {
      setTenants(prev => prev.map(t => t.id === tenant.id ? { ...t, status: 'activo' } : t))
      toast.success(`${tenant.name} restaurado`)
    } else {
      toast.error(result.error || 'Error al restaurar')
    }
    setRestoringId(null)
  }, [])

  // ── Wizard ────────────────────────────────────────────────────────────────

  const openWizard = useCallback(() => {
    setWizardData(WIZARD_DEFAULTS)
    setWizardErrors({})
    setWizardStep(1)
    setWizardOpen(true)
  }, [])

  const closeWizard = useCallback(() => {
    setWizardOpen(false)
  }, [])

  const patchWizard = useCallback((patch: Partial<WizardData>) => {
    setWizardData(prev => {
      const next = { ...prev, ...patch }
      // Auto-slug when name changes (only if slug hasn't been manually touched)
      if ('name' in patch && !prev.slug) {
        next.slug = slugify(patch.name ?? '')
      }
      return next
    })
    setWizardErrors(prev => {
      const cleared = { ...prev }
      for (const k of Object.keys(patch)) delete cleared[k as keyof WizardData]
      return cleared
    })
  }, [])

  function validateStep(step: number): boolean {
    const errs: Partial<Record<keyof WizardData, string>> = {}
    if (step === 1) {
      if (!wizardData.name.trim())  errs.name  = 'El nombre es requerido'
      if (!wizardData.slug.trim())  errs.slug  = 'El slug es requerido'
      if (!/^[a-z0-9-]+$/.test(wizardData.slug)) errs.slug = 'Solo letras minúsculas, números y guiones'
    }
    if (step === 3) {
      if (!wizardData.ownerName.trim())  errs.ownerName  = 'El nombre del propietario es requerido'
      if (!wizardData.ownerEmail.trim()) errs.ownerEmail = 'El email es requerido'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(wizardData.ownerEmail)) errs.ownerEmail = 'Email inválido'
      if (wizardData.ownerPassword.length < 6)  errs.ownerPassword = 'Mínimo 6 caracteres'
      if (wizardData.ownerPassword !== wizardData.ownerPasswordConfirm) errs.ownerPasswordConfirm = 'Las contraseñas no coinciden'
    }
    setWizardErrors(errs)
    return Object.keys(errs).length === 0
  }

  const wizardNext = useCallback(() => {
    if (validateStep(wizardStep)) setWizardStep(s => Math.min(s + 1, 4))
  }, [wizardStep, wizardData])

  const wizardBack = useCallback(() => {
    setWizardStep(s => Math.max(s - 1, 1))
  }, [])

  const handleWizardSubmit = useCallback(async () => {
    if (!validateStep(3)) return
    setIsSubmitting(true)
    const result = await api.createTenant({
      name:         wizardData.name.trim(),
      slug:         wizardData.slug.trim(),
      businessType: wizardData.businessType || undefined,
      plan:         wizardData.plan,
      maxUsers:     wizardData.maxUsers,
      maxProducts:  wizardData.maxProducts,
      ownerName:    wizardData.ownerName.trim(),
      ownerEmail:   wizardData.ownerEmail.trim(),
      ownerPassword:wizardData.ownerPassword,
    })
    if (result.success) {
      toast.success(`Comercio "${wizardData.name}" creado exitosamente`)
      closeWizard()
      fetchTenants()
    } else {
      toast.error(result.error || 'Error al crear el comercio')
    }
    setIsSubmitting(false)
  }, [wizardData, closeWizard, fetchTenants])

  // ── Derived lists ─────────────────────────────────────────────────────────

  const activeTenants = tenants.filter(t => t.status !== 'cancelado')
  const trashedTenants = tenants.filter(t => t.status === 'cancelado')

  const filteredActive = activeTenants.filter(t => {
    const q = tenantSearch.toLowerCase()
    return !q || t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q) || (t.ownerEmail ?? '').toLowerCase().includes(q)
  })

  const filteredTrashed = trashedTenants.filter(t => {
    const q = tenantSearch.toLowerCase()
    return !q || t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q)
  })

  return {
    // List
    tenants, isLoadingTenants, tenantSearch, setTenantSearch,
    filteredActive, filteredTrashed,
    fetchTenants, businessTypes,
    // Status actions
    togglingId, trashingId, restoringId,
    handleToggleStatus, handleTrash, handleRestore,
    // Wizard
    wizardOpen, wizardStep, wizardData, wizardErrors, isSubmitting,
    openWizard, closeWizard, patchWizard, wizardNext, wizardBack, handleWizardSubmit,
  }
}
