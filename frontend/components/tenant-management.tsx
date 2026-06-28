'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import type { Tenant, TenantPlan, TenantStatus } from '@/lib/types'
import { formatCOP } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Building2,
  Users,
  Package,
  ShoppingCart,
  TrendingUp,
  Search,
  Plus,
  Eye,
  Edit,
  Power,
  RefreshCw,
  Crown,
  Store,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Mail,
  User,
  Lock,
  Globe,
  Truck,
  Phone,
  UserPlus,
  Palette,
  X,
  Sparkles,
  CreditCard,
  ShieldCheck,
  EyeOff,
  Tags,
  Zap,
  ZapOff,
  Settings,
  LayoutGrid,
  Trash2,
  MoreVertical,
  CalendarDays,
  Ban,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ALL_MODULES, BUSINESS_PRESETS, getPresetForBusinessType } from '@/lib/modules'
import { toast } from 'sonner'

interface PlatformStats {
  totalTenants: number
  activeTenants: number
  suspendedTenants: number
  totalUsers: number
  totalProducts: number
  totalSales: number
  totalRevenue: number
}

interface TenantDetail extends Tenant {
  businessType?: string
  totalCustomers?: number
  inventoryValue?: number
  trialEndsAt?: string | null
}

// Trial activo = tiene fecha de fin y aún no ha pasado
function hasActiveTrial(t: { trialEndsAt?: string | null }): boolean {
  return !!t.trialEndsAt && new Date(t.trialEndsAt).getTime() > Date.now()
}

export function TenantManagement() {
  const [tenants, setTenants] = useState<TenantDetail[]>([])
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '',
    slug: '',
    businessType: '',
    plan: 'basico' as TenantPlan,
    maxUsers: 5,
    maxProducts: 500,
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
  })

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [editingTenant, setEditingTenant] = useState<TenantDetail | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    slug: '',
    businessType: '',
    plan: 'basico' as TenantPlan,
    maxUsers: 5,
    maxProducts: 500,
    bgColor: '#000000',
    ownerName: '',
    ownerEmail: '',
  })

  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [detailTenant, setDetailTenant] = useState<TenantDetail | null>(null)

  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false)
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const [createUserForm, setCreateUserForm] = useState({
    tenantId: '',
    role: 'repartidor' as 'repartidor' | 'cliente',
    name: '',
    email: '',
    phone: '',
    password: '',
    isGlobal: false,
  })

  const [businessTypes, setBusinessTypes] = useState<string[]>([])
  const [newBusinessType, setNewBusinessType] = useState('')
  const [isSavingBusinessType, setIsSavingBusinessType] = useState(false)

  const [activatingTrialId, setActivatingTrialId] = useState<string | null>(null)

  const [trialConfirmTenant, setTrialConfirmTenant] = useState<TenantDetail | null>(null)
  const [trialDays, setTrialDays] = useState(7)
  const [isActivatingTrial, setIsActivatingTrial] = useState(false)

  const [tenantToDelete, setTenantToDelete] = useState<TenantDetail | null>(null)
  const [isDeletingTenant, setIsDeletingTenant] = useState(false)

  // Borrado DEFINITIVO (irreversible)
  const [tenantToPurge, setTenantToPurge] = useState<TenantDetail | null>(null)
  const [purgeConfirmText, setPurgeConfirmText] = useState('')
  const [isPurging, setIsPurging] = useState(false)

  // Desactivar trial
  const [tenantToDeactivateTrial, setTenantToDeactivateTrial] = useState<TenantDetail | null>(null)
  const [isDeactivatingTrial, setIsDeactivatingTrial] = useState(false)

  const [isModulesOpen, setIsModulesOpen] = useState(false)
  const [modulesForTenant, setModulesForTenant] = useState<TenantDetail | null>(null)
  const [editingModules, setEditingModules] = useState<string[]>([])
  const [isSavingModules, setIsSavingModules] = useState(false)

  const [platformBgColor, setPlatformBgColor] = useState('#000000')
  const [isSavingPlatformBg, setIsSavingPlatformBg] = useState(false)

  const [mpAccessToken, setMpAccessToken] = useState('')
  const [mpFrontendUrl, setMpFrontendUrl] = useState('')
  const [mpTokenSaved, setMpTokenSaved] = useState(false)
  const [showMpToken, setShowMpToken] = useState(false)
  const [isSavingMP, setIsSavingMP] = useState(false)

  const [addiClientId, setAddiClientId] = useState('')
  const [addiClientSecret, setAddiClientSecret] = useState('')
  const [addiStoreSlug, setAddiStoreSlug] = useState('')
  const [addiProduction, setAddiProduction] = useState(false)
  const [addiSaved, setAddiSaved] = useState(false)
  const [showAddiSecret, setShowAddiSecret] = useState(false)
  const [isSavingAddi, setIsSavingAddi] = useState(false)

  const [sisteApiKey, setSisteApiKey] = useState('')
  const [sisteApiSecret, setSisteApiSecret] = useState('')
  const [sisteAllyCode, setSisteAllyCode] = useState('')
  const [sisteProduction, setSisteProduction] = useState(false)
  const [sisteSaved, setSisteSaved] = useState(false)
  const [showSisteSecret, setShowSisteSecret] = useState(false)
  const [isSavingSiste, setIsSavingSiste] = useState(false)

  const [users, setUsers] = useState<any[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all')
  const [usersPage, setUsersPage] = useState(1)
  const [usersTotalPages, setUsersTotalPages] = useState(1)
  const [isDeletingUser, setIsDeletingUser] = useState(false)
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null)
  const [deleteUserName, setDeleteUserName] = useState('')
  const [isResetPassOpen, setIsResetPassOpen] = useState(false)
  const [resetPassUserId, setResetPassUserId] = useState<string | null>(null)
  const [resetPassUserName, setResetPassUserName] = useState('')
  const [resetPassValue, setResetPassValue] = useState('')
  const [isSavingPass, setIsSavingPass] = useState(false)

  const [productSearchQuery, setProductSearchQuery] = useState('')
  const [productSearchResults, setProductSearchResults] = useState<any[]>([])
  const [isSearchingProducts, setIsSearchingProducts] = useState(false)

  const productSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

  const handleProductSearch = (query: string) => {
    setProductSearchQuery(query)
    if (!query.trim()) { setProductSearchResults([]); return }
    if (productSearchTimeoutRef.current) clearTimeout(productSearchTimeoutRef.current)
    productSearchTimeoutRef.current = setTimeout(async () => {
      setIsSearchingProducts(true)
      try {
        const res = await fetch(`${API_URL}/storefront/products?limit=50&store=all`)
        const json = await res.json()
        if (json.success && json.data?.products) {
          const filtered = json.data.products.filter((p: any) =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            p.brand?.toLowerCase().includes(query.toLowerCase()) ||
            p.category?.toLowerCase().includes(query.toLowerCase())
          )
          setProductSearchResults(filtered)
        }
      } catch (e) {
        console.error('Error searching products:', e)
      } finally {
        setIsSearchingProducts(false)
      }
    }, 300)
  }

  const fetchTenants = useCallback(async () => {
    setIsLoading(true)
    const result = await api.getTenants({ page, limit: 20, search: search || undefined })
    if (result.success && result.data) {
      setTenants(Array.isArray(result.data) ? result.data : result.data.tenants || [])
      if (result.data.totalPages) setTotalPages(result.data.totalPages)
    }
    setIsLoading(false)
  }, [page, search])

  const fetchStats = useCallback(async () => {
    const result = await api.getTenantStats()
    if (result.success && result.data) setStats(result.data)
  }, [])

  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true)
    const result = await api.getUsers({ page: usersPage, limit: 30 })
    if (result.success && result.data) {
      setUsers(Array.isArray(result.data) ? result.data : result.data.users || [])
      if (result.data.pagination?.totalPages) setUsersTotalPages(result.data.pagination.totalPages)
    }
    setIsLoadingUsers(false)
  }, [usersPage])

  const handleDeleteUser = async () => {
    if (!deleteUserId) return
    setIsDeletingUser(true)
    const result = await api.deleteUser(deleteUserId)
    if (result.success) {
      toast.success('Usuario eliminado')
      setDeleteUserId(null)
      fetchUsers()
      fetchStats()
    } else {
      toast.error(result.error || 'Error al eliminar usuario')
    }
    setIsDeletingUser(false)
  }

  // Cambiar el rol de un usuario (superadmin). Al pasar a cliente se le quita el comercio.
  const handleChangeRole = async (user: any, role: string) => {
    if (!role || role === user.role) return
    const r = await api.superadminSetUserRole(user.id, role)
    if (r.success) {
      toast.success(`Rol actualizado a ${role}`)
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role, tenantId: role === 'cliente' ? null : u.tenantId, tenantName: role === 'cliente' ? null : u.tenantName } : u))
    } else {
      toast.error(r.error || 'No se pudo cambiar el rol')
    }
  }

  // Suspender / activar una cuenta (superadmin).
  const handleToggleActive = async (user: any) => {
    const next = !user.isActive
    const r = await api.superadminSetUserActive(user.id, next)
    if (r.success) {
      toast.success(next ? 'Cuenta activada' : 'Cuenta suspendida')
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isActive: next } : u))
    } else {
      toast.error(r.error || 'No se pudo cambiar el estado')
    }
  }

  const handleResetPassword = async () => {
    if (!resetPassUserId || resetPassValue.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setIsSavingPass(true)
    const result = await api.resetUserPassword(resetPassUserId, resetPassValue)
    if (result.success) {
      toast.success('Contraseña actualizada')
      setIsResetPassOpen(false)
      setResetPassValue('')
      setResetPassUserId(null)
    } else {
      toast.error(result.error || 'Error al actualizar contraseña')
    }
    setIsSavingPass(false)
  }

  const fetchBusinessTypes = useCallback(async () => {
    const result = await api.getBusinessTypes()
    if (result.success && result.data) setBusinessTypes(result.data)
  }, [])

  const handleCreateBusinessType = async () => {
    if (!newBusinessType.trim()) return
    setIsSavingBusinessType(true)
    const result = await api.createBusinessType(newBusinessType.trim())
    if (result.success && result.data) {
      setBusinessTypes(result.data)
      setNewBusinessType('')
      toast.success('Categoría creada')
    } else {
      toast.error(result.error || 'Error al crear categoría')
    }
    setIsSavingBusinessType(false)
  }

  const handleDeleteBusinessType = async (name: string) => {
    const result = await api.deleteBusinessType(name)
    if (result.success && result.data) {
      setBusinessTypes(result.data)
      toast.success('Categoría eliminada')
    } else {
      toast.error(result.error || 'Error al eliminar categoría')
    }
  }

  const openTrialConfirm = (tenant: TenantDetail) => {
    setTrialDays(7)
    setTrialConfirmTenant(tenant)
  }

  const handleConfirmActivateTrial = async () => {
    if (!trialConfirmTenant) return
    setIsActivatingTrial(true)
    const result = await api.activateTenantTrial(trialConfirmTenant.id, trialDays)
    if (result.success) {
      toast.success(`Trial de ${trialDays} días activado con plan Empresarial`)
      setTrialConfirmTenant(null)
      fetchTenants()
    } else {
      toast.error(result.error || 'Error al activar trial')
    }
    setIsActivatingTrial(false)
  }

  const handleDeleteTenant = async () => {
    if (!tenantToDelete) return
    setIsDeletingTenant(true)
    const result = await api.softDeleteTenant(tenantToDelete.id)
    if (result.success) {
      toast.success(`Comercio "${tenantToDelete.name}" enviado a la papelera`)
      setTenantToDelete(null)
      fetchTenants(); fetchStats()
    } else {
      toast.error(result.error || 'Error al cancelar comercio')
    }
    setIsDeletingTenant(false)
  }

  const handlePurgeTenant = async () => {
    if (!tenantToPurge) return
    setIsPurging(true)
    const result = await api.hardDeleteTenant(tenantToPurge.id)
    if (result.success) {
      toast.success(`Comercio "${tenantToPurge.name}" eliminado definitivamente`)
      setTenantToPurge(null)
      setPurgeConfirmText('')
      fetchTenants(); fetchStats()
    } else {
      toast.error(result.error || 'Error al eliminar el comercio')
    }
    setIsPurging(false)
  }

  const handleDeactivateTrial = async () => {
    if (!tenantToDeactivateTrial) return
    setIsDeactivatingTrial(true)
    const result = await api.deactivateTenantTrial(tenantToDeactivateTrial.id, 'basico')
    if (result.success) {
      toast.success(`Trial de "${tenantToDeactivateTrial.name}" desactivado`)
      setTenantToDeactivateTrial(null)
      fetchTenants()
    } else {
      toast.error(result.error || 'Error al desactivar el trial')
    }
    setIsDeactivatingTrial(false)
  }

  const fetchPlatformSettings = useCallback(async () => {
    const result = await api.getPlatformSettings()
    if (result.success && result.data) {
      if (result.data.bg_color) setPlatformBgColor(result.data.bg_color)
      if (result.data.mp_access_token) { setMpAccessToken(result.data.mp_access_token); setMpTokenSaved(true) }
      if (result.data.frontend_url) setMpFrontendUrl(result.data.frontend_url)
      if (result.data.addi_client_id) { setAddiClientId(result.data.addi_client_id); setAddiSaved(true) }
      if (result.data.addi_client_secret) setAddiClientSecret(result.data.addi_client_secret)
      if (result.data.addi_store_slug) setAddiStoreSlug(result.data.addi_store_slug)
      if (result.data.addi_production === 'true') setAddiProduction(true)
      if (result.data.sistecredito_api_key) { setSisteApiKey(result.data.sistecredito_api_key); setSisteSaved(true) }
      if (result.data.sistecredito_api_secret) setSisteApiSecret(result.data.sistecredito_api_secret)
      if (result.data.sistecredito_ally_code) setSisteAllyCode(result.data.sistecredito_ally_code)
      if (result.data.sistecredito_production === 'true') setSisteProduction(true)
    }
  }, [])

  useEffect(() => {
    fetchTenants()
    fetchStats()
    fetchPlatformSettings()
    fetchUsers()
    fetchBusinessTypes()
  }, [fetchTenants, fetchStats, fetchPlatformSettings, fetchUsers, fetchBusinessTypes])

  const generateSlug = (name: string) =>
    name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()

  const handleCreateTenant = async () => {
    if (!createForm.name || !createForm.slug || !createForm.ownerName || !createForm.ownerEmail || !createForm.ownerPassword) {
      toast.error('Complete todos los campos requeridos'); return
    }
    if (createForm.ownerPassword.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return }
    setIsCreating(true)
    const result = await api.createTenant({
      name: createForm.name, slug: createForm.slug,
      businessType: createForm.businessType || undefined, plan: createForm.plan,
      maxUsers: createForm.maxUsers, maxProducts: createForm.maxProducts,
      ownerName: createForm.ownerName, ownerEmail: createForm.ownerEmail, ownerPassword: createForm.ownerPassword,
    })
    if (result.success) {
      toast.success('Comercio creado exitosamente')
      setIsCreateOpen(false)
      setCreateForm({ name: '', slug: '', businessType: '', plan: 'basico', maxUsers: 5, maxProducts: 500, ownerName: '', ownerEmail: '', ownerPassword: '' })
      fetchTenants(); fetchStats()
    } else {
      toast.error(result.error || 'Error al crear comercio')
    }
    setIsCreating(false)
  }

  const handleUpdateTenant = async () => {
    if (!editingTenant) return
    setIsUpdating(true)
    const result = await api.updateTenant(editingTenant.id, {
      name: editForm.name,
      slug: editForm.slug || undefined,
      businessType: editForm.businessType || undefined,
      plan: editForm.plan,
      maxUsers: editForm.maxUsers,
      maxProducts: editForm.maxProducts,
      bgColor: editForm.bgColor,
    })
    if (result.success) { toast.success('Comercio actualizado'); setIsEditOpen(false); fetchTenants() }
    else toast.error(result.error || 'Error al actualizar')
    setIsUpdating(false)
  }

  const handleToggleStatus = async (tenant: TenantDetail) => {
    const result = await api.toggleTenantStatus(tenant.id)
    if (result.success) { toast.success(tenant.status === 'activo' ? 'Comercio suspendido' : 'Comercio activado'); fetchTenants(); fetchStats() }
    else toast.error(result.error || 'Error al cambiar estado')
  }

  const handleSavePlatformBgColor = async () => {
    setIsSavingPlatformBg(true)
    const result = await api.updatePlatformSetting('bg_color', platformBgColor)
    if (result.success) toast.success('Color actualizado')
    else toast.error(result.error || 'Error al actualizar color')
    setIsSavingPlatformBg(false)
  }

  const handleSaveMPSettings = async () => {
    if (!mpAccessToken.trim()) { toast.error('Ingresa el Access Token de MercadoPago'); return }
    setIsSavingMP(true)
    try {
      const updates = [api.updatePlatformSetting('mp_access_token', mpAccessToken.trim())]
      if (mpFrontendUrl.trim()) updates.push(api.updatePlatformSetting('frontend_url', mpFrontendUrl.trim()))
      const results = await Promise.all(updates)
      if (results.every(r => r.success)) { setMpTokenSaved(true); toast.success('Configuración de MercadoPago guardada') }
      else toast.error('Error al guardar la configuración')
    } catch { toast.error('Error de conexión') }
    setIsSavingMP(false)
  }

  const handleSaveAddiSettings = async () => {
    if (!addiClientId.trim() || !addiClientSecret.trim()) { toast.error('Ingresa el Client ID y Client Secret de ADDI'); return }
    setIsSavingAddi(true)
    try {
      const updates = [
        api.updatePlatformSetting('addi_client_id', addiClientId.trim()),
        api.updatePlatformSetting('addi_client_secret', addiClientSecret.trim()),
        api.updatePlatformSetting('addi_production', addiProduction ? 'true' : 'false'),
      ]
      if (addiStoreSlug.trim()) updates.push(api.updatePlatformSetting('addi_store_slug', addiStoreSlug.trim()))
      const results = await Promise.all(updates)
      if (results.every(r => r.success)) { setAddiSaved(true); toast.success('Configuración de ADDI guardada') }
      else toast.error('Error al guardar la configuración de ADDI')
    } catch { toast.error('Error de conexión') }
    setIsSavingAddi(false)
  }

  const handleSaveSisteSettings = async () => {
    if (!sisteApiKey.trim()) { toast.error('Ingresa el API Key de Sistecredito'); return }
    setIsSavingSiste(true)
    try {
      const updates = [
        api.updatePlatformSetting('sistecredito_api_key', sisteApiKey.trim()),
        api.updatePlatformSetting('sistecredito_production', sisteProduction ? 'true' : 'false'),
      ]
      if (sisteApiSecret.trim()) updates.push(api.updatePlatformSetting('sistecredito_api_secret', sisteApiSecret.trim()))
      if (sisteAllyCode.trim()) updates.push(api.updatePlatformSetting('sistecredito_ally_code', sisteAllyCode.trim()))
      const results = await Promise.all(updates)
      if (results.every(r => r.success)) { setSisteSaved(true); toast.success('Configuración de Sistecredito guardada') }
      else toast.error('Error al guardar la configuración de Sistecredito')
    } catch { toast.error('Error de conexión') }
    setIsSavingSiste(false)
  }

  const handleCreateUser = async () => {
    const requireTenant = !(createUserForm.isGlobal && createUserForm.role === 'repartidor')
    if (requireTenant && !createUserForm.tenantId) { toast.error('Selecciona un comercio'); return }
    if (!createUserForm.name || !createUserForm.email || !createUserForm.password) { toast.error('Complete todos los campos requeridos'); return }
    if (!createUserForm.phone) { toast.error('El teléfono es requerido'); return }
    if (createUserForm.password.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return }
    setIsCreatingUser(true)
    const result = await api.createUser({
      email: createUserForm.email, password: createUserForm.password, name: createUserForm.name,
      role: createUserForm.role, phone: createUserForm.phone,
      tenantId: createUserForm.isGlobal && createUserForm.role === 'repartidor' ? null : createUserForm.tenantId,
    })
    if (result.success) {
      toast.success(`${createUserForm.role === 'repartidor' ? 'Repartidor' : 'Cliente'} creado exitosamente`)
      setIsCreateUserOpen(false)
      setCreateUserForm({ tenantId: '', role: 'repartidor', name: '', email: '', phone: '', password: '', isGlobal: false })
      fetchStats()
    } else {
      toast.error(result.error || 'Error al crear usuario')
    }
    setIsCreatingUser(false)
  }

  const openEdit = (tenant: TenantDetail) => {
    setEditingTenant(tenant)
    setEditForm({
      name: tenant.name,
      slug: tenant.slug || '',
      businessType: tenant.businessType || '',
      plan: tenant.plan,
      maxUsers: tenant.maxUsers,
      maxProducts: tenant.maxProducts,
      bgColor: (tenant as any).bgColor || '#000000',
      ownerName: (tenant as any).ownerName || '',
      ownerEmail: (tenant as any).ownerEmail || '',
    })
    setIsEditOpen(true)
  }

  const openDetail = async (tenant: TenantDetail) => {
    const result = await api.getTenant(tenant.id)
    setDetailTenant(result.success && result.data ? result.data : tenant)
    setIsDetailOpen(true)
  }

  const openModules = async (tenant: TenantDetail) => {
    setModulesForTenant(tenant)
    setEditingModules(getPresetForBusinessType(tenant.businessType))
    setIsModulesOpen(true)
    const result = await api.getTenantModules(tenant.id)
    if (result.success && result.data) {
      const { enabledModules, businessType } = result.data
      setEditingModules(enabledModules ?? getPresetForBusinessType(businessType))
    }
  }

  const handleSaveModules = async () => {
    if (!modulesForTenant) return
    setIsSavingModules(true)
    const result = await api.updateTenantModules(modulesForTenant.id, editingModules)
    if (result.success) {
      toast.success('Módulos actualizados')
      setIsModulesOpen(false)
    } else {
      toast.error(result.error || 'Error al actualizar módulos')
    }
    setIsSavingModules(false)
  }

  const toggleModule = (id: string) =>
    setEditingModules(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id])

  const statusConfig: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    activo: { label: 'Activo', className: 'bg-green-500/15 text-green-500 border-green-500/30', icon: <CheckCircle2 className="h-3 w-3" /> },
    suspendido: { label: 'Suspendido', className: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30', icon: <AlertTriangle className="h-3 w-3" /> },
    cancelado: { label: 'Cancelado', className: 'bg-red-500/15 text-red-500 border-red-500/30', icon: <XCircle className="h-3 w-3" /> },
  }

  const planConfig: Record<string, { label: string; className: string }> = {
    basico: { label: 'Básico', className: 'bg-secondary text-secondary-foreground' },
    profesional: { label: 'Profesional', className: 'bg-blue-500/15 text-blue-500 border-blue-500/30' },
    empresarial: { label: 'Empresarial', className: 'bg-purple-500/15 text-purple-500 border-purple-500/30' },
  }

  return (
    <div className="space-y-6 lg:space-y-8">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-foreground flex items-center gap-2">
            <Crown className="h-6 w-6 text-amber-500" />
            Panel Superadmin
          </h2>
          <p className="text-sm lg:text-base text-muted-foreground">Gestión de comercios y plataforma</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar tienda, producto..."
              value={search}
              onChange={(e) => { const q = e.target.value; setSearch(q); setPage(1); handleProductSearch(q) }}
              className="pl-9 pr-8 w-52 sm:w-64 h-9 text-sm"
            />
            {search && (
              <button onClick={() => { setSearch(''); setPage(1); handleProductSearch('') }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => { fetchTenants(); fetchStats() }} className="gap-1">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => setIsCreateUserOpen(true)} className="gap-1">
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Nuevo Usuario</span>
          </Button>
          <Button size="sm" onClick={() => setIsCreateOpen(true)} className="gap-1">
            <Plus className="h-4 w-4" />
            Nuevo Comercio
          </Button>
        </div>
      </div>

      {/* ── Platform Stats ── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <StatCard title="Comercios" value={stats.totalTenants} icon={<Building2 className="h-5 w-5 text-primary" />} />
          <StatCard title="Activos" value={stats.activeTenants} icon={<CheckCircle2 className="h-5 w-5 text-green-500" />} />
          <StatCard title="Suspendidos" value={stats.suspendedTenants} icon={<AlertTriangle className="h-5 w-5 text-yellow-500" />} />
          <StatCard title="Usuarios" value={stats.totalUsers} icon={<Users className="h-5 w-5 text-blue-500" />} />
          <StatCard title="Productos" value={stats.totalProducts} icon={<Package className="h-5 w-5 text-purple-500" />} />
          <StatCard title="Ventas" value={stats.totalSales} icon={<ShoppingCart className="h-5 w-5 text-orange-500" />} />
          <StatCard title="Ingresos" value={formatCOP(stats.totalRevenue || 0)} icon={<TrendingUp className="h-5 w-5 text-green-500" />} isText />
        </div>
      )}

      {/* ── Product search results (shown when typing) ── */}
      {productSearchQuery && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base lg:text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-muted-foreground" />
              Productos para &quot;{productSearchQuery}&quot;
            </CardTitle>
            <CardDescription>Publicados en todas las tiendas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isSearchingProducts && (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Buscando...</span>
              </div>
            )}
            {!isSearchingProducts && productSearchResults.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No se encontraron productos</p>
              </div>
            )}
            {productSearchResults.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{productSearchResults.length} resultado{productSearchResults.length !== 1 ? 's' : ''}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto">
                  {productSearchResults.map((product: any) => (
                    <div key={product.id} className="flex gap-3 p-3 border border-border rounded-lg bg-background hover:bg-accent/50 transition-colors">
                      <div className="w-14 h-14 shrink-0 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                        {product.imageUrl
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={product.imageUrl.startsWith('http') ? product.imageUrl : `${API_URL.replace('/api', '')}${product.imageUrl}`} alt={product.name} className="w-full h-full object-cover" />
                          : <Sparkles className="h-5 w-5 text-muted-foreground/30" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{product.brand || product.category || ''}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {product.isOnOffer && product.offerPrice
                            ? <><span className="text-sm font-semibold text-orange-500">{formatCOP(product.offerPrice)}</span><span className="text-xs text-muted-foreground line-through">{formatCOP(product.salePrice)}</span></>
                            : <span className="text-sm font-semibold text-foreground">{formatCOP(product.salePrice)}</span>}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Stock: {product.stock}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Main Tabs ── */}
      <Tabs defaultValue="comercios" className="space-y-4">
        <TabsList className="h-10 w-full sm:w-auto grid grid-cols-3 sm:inline-flex">
          <TabsTrigger value="comercios" className="gap-1.5">
            <Store className="h-4 w-4" />
            <span>Comercios</span>
            {stats && (
              <span className="rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-semibold text-primary leading-none">
                {stats.totalTenants}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="usuarios" className="gap-1.5">
            <Users className="h-4 w-4" />
            <span>Usuarios</span>
          </TabsTrigger>
          <TabsTrigger value="configuracion" className="gap-1.5">
            <Settings className="h-4 w-4" />
            <span>Configuración</span>
          </TabsTrigger>
        </TabsList>

        {/* ══════════════ Tab: Comercios ══════════════ */}
        <TabsContent value="comercios" className="space-y-4 mt-0">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base lg:text-lg flex items-center gap-2">
                <Store className="h-5 w-5 text-muted-foreground" />
                Comercios Registrados
              </CardTitle>
              <CardDescription>
                {tenants.length} comercio{tenants.length !== 1 ? 's' : ''} encontrado{tenants.length !== 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : tenants.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Building2 className="h-12 w-12 mb-3 opacity-50" />
                  <p className="font-medium">No hay comercios registrados</p>
                  <p className="text-sm mt-1">Crea uno nuevo para comenzar</p>
                </div>
              ) : (
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-muted-foreground">Comercio</TableHead>
                      <TableHead className="text-muted-foreground">Propietario</TableHead>
                      <TableHead className="text-muted-foreground text-center">Plan</TableHead>
                      <TableHead className="text-muted-foreground text-center">Estado</TableHead>
                      <TableHead className="text-muted-foreground text-right">Usuarios</TableHead>
                      <TableHead className="text-muted-foreground text-right">Productos</TableHead>
                      <TableHead className="text-muted-foreground text-right">Ventas</TableHead>
                      <TableHead className="text-muted-foreground text-center">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenants.map((tenant) => {
                      const sc = statusConfig[tenant.status] || statusConfig.activo
                      const pc = planConfig[tenant.plan] || planConfig.basico
                      return (
                        <TableRow key={tenant.id} className="border-border">
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm text-foreground">{tenant.name}</p>
                              <p className="text-xs text-muted-foreground">{tenant.slug}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm text-foreground">{tenant.ownerName || '-'}</p>
                              <p className="text-xs text-muted-foreground">{tenant.ownerEmail || '-'}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={`text-xs ${pc.className}`}>{pc.label}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={`text-xs gap-1 ${sc.className}`}>
                              {sc.icon}{sc.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm">{tenant.totalUsers ?? 0}/{tenant.maxUsers}</TableCell>
                          <TableCell className="text-right text-sm">{tenant.totalProducts ?? 0}/{tenant.maxProducts}</TableCell>
                          <TableCell className="text-right text-sm">{tenant.totalSales ?? 0}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onClick={() => openDetail(tenant)} className="gap-2">
                                  <Eye className="h-4 w-4" /> Ver detalle
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEdit(tenant)} className="gap-2">
                                  <Edit className="h-4 w-4" /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleToggleStatus(tenant)}
                                  className={`gap-2 ${tenant.status === 'activo' ? 'text-yellow-600 focus:text-yellow-600' : 'text-green-600 focus:text-green-600'}`}
                                >
                                  <Power className="h-4 w-4" />
                                  {tenant.status === 'activo' ? 'Suspender' : 'Activar'}
                                </DropdownMenuItem>
                                {hasActiveTrial(tenant) ? (
                                  <DropdownMenuItem onClick={() => setTenantToDeactivateTrial(tenant)} className="gap-2 text-orange-600 focus:text-orange-600">
                                    <ZapOff className="h-4 w-4" /> Desactivar trial
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => openTrialConfirm(tenant)} className="gap-2 text-purple-600 focus:text-purple-600">
                                    <Zap className="h-4 w-4" /> Trial Empresarial
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => openModules(tenant)} className="gap-2 text-blue-600 focus:text-blue-600">
                                  <LayoutGrid className="h-4 w-4" /> Módulos
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {tenant.status !== 'cancelado' && (
                                  <DropdownMenuItem
                                    onClick={() => setTenantToDelete(tenant)}
                                    className="gap-2 text-yellow-600 focus:text-yellow-600"
                                  >
                                    <Trash2 className="h-4 w-4" /> Enviar a papelera
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => { setPurgeConfirmText(''); setTenantToPurge(tenant) }}
                                  className="gap-2 text-destructive focus:text-destructive"
                                >
                                  <AlertTriangle className="h-4 w-4" /> Eliminar definitivamente
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
            </div>
          )}
        </TabsContent>

        {/* ══════════════ Tab: Usuarios ══════════════ */}
        <TabsContent value="usuarios" className="mt-0">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base lg:text-lg flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-500" />
                    Todos los Usuarios
                  </CardTitle>
                  <CardDescription>Comerciantes, vendedores, repartidores y clientes de la plataforma</CardDescription>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nombre o email..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-9 h-9 w-52"
                    />
                  </div>
                  <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                    <SelectTrigger className="h-9 w-40">
                      <SelectValue placeholder="Todos los roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los roles</SelectItem>
                      <SelectItem value="comerciante">Comerciantes</SelectItem>
                      <SelectItem value="vendedor">Vendedores</SelectItem>
                      <SelectItem value="repartidor">Repartidores</SelectItem>
                      <SelectItem value="cliente">Clientes</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={fetchUsers} className="h-9 gap-1">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {isLoadingUsers ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (() => {
                const roleColors: Record<string, string> = {
                  superadmin: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
                  comerciante: 'bg-purple-500/15 text-purple-500 border-purple-500/30',
                  vendedor: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
                  repartidor: 'bg-green-500/15 text-green-500 border-green-500/30',
                  cliente: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
                }
                const roleLabels: Record<string, string> = {
                  superadmin: 'Superadmin', comerciante: 'Comerciante',
                  vendedor: 'Vendedor', repartidor: 'Repartidor', cliente: 'Cliente',
                }
                const filtered = users.filter(u => {
                  const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter
                  const q = userSearch.toLowerCase()
                  const matchesSearch = !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
                  return matchesRole && matchesSearch
                })
                return filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <User className="h-12 w-12 mb-3 opacity-50" />
                    <p className="font-medium">No se encontraron usuarios</p>
                  </div>
                ) : (
                  <Table className="min-w-[700px]">
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="text-muted-foreground">Usuario</TableHead>
                        <TableHead className="text-muted-foreground">Email</TableHead>
                        <TableHead className="text-muted-foreground text-center">Rol</TableHead>
                        <TableHead className="text-muted-foreground">Comercio</TableHead>
                        <TableHead className="text-muted-foreground text-center">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((user) => (
                        <TableRow key={user.id} className="border-border">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                <User className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                  {user.name}
                                  {user.isActive === false && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-semibold">Suspendido</span>}
                                </p>
                                {user.phone && <p className="text-xs text-muted-foreground">{user.phone}</p>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={`text-xs ${roleColors[user.role] || ''}`}>
                              {roleLabels[user.role] || user.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {user.tenantName || (user.tenantId ? user.tenantId.slice(0, 8) + '…' : <span className="italic text-xs">Global</span>)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              {/* Cambiar rol (no aplica a superadmin) */}
                              {user.role !== 'superadmin' && (
                                <select
                                  value={user.role}
                                  onChange={(e) => handleChangeRole(user, e.target.value)}
                                  title="Cambiar rol"
                                  className="h-8 rounded-md border border-border bg-background text-xs px-1.5 text-foreground"
                                >
                                  <option value="cliente">Cliente</option>
                                  <option value="comerciante">Comerciante</option>
                                  <option value="vendedor">Vendedor</option>
                                  <option value="repartidor">Repartidor</option>
                                  <option value="auxiliar_bodega">Aux. bodega</option>
                                  {!['cliente', 'comerciante', 'vendedor', 'repartidor', 'auxiliar_bodega'].includes(user.role) && (
                                    <option value={user.role}>{user.role}</option>
                                  )}
                                </select>
                              )}
                              {/* Suspender / activar */}
                              {user.role !== 'superadmin' && (
                                <Button
                                  variant="ghost" size="icon" className="h-8 w-8"
                                  title={user.isActive ? 'Suspender cuenta' : 'Activar cuenta'}
                                  onClick={() => handleToggleActive(user)}
                                >
                                  {user.isActive
                                    ? <Ban className="h-4 w-4 text-amber-500" />
                                    : <Power className="h-4 w-4 text-green-500" />}
                                </Button>
                              )}
                              <Button
                                variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                title="Resetear contraseña"
                                onClick={() => { setResetPassUserId(user.id); setResetPassUserName(user.name); setResetPassValue(''); setIsResetPassOpen(true) }}
                              >
                                <Lock className="h-4 w-4" />
                              </Button>
                              {user.role !== 'superadmin' && (
                                <Button
                                  variant="ghost" size="icon" className="h-8 w-8 text-destructive/70 hover:text-destructive"
                                  title="Eliminar usuario"
                                  onClick={() => { setDeleteUserId(user.id); setDeleteUserName(user.name) }}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )
              })()}
            </CardContent>
            {usersTotalPages > 1 && (
              <div className="flex items-center justify-center gap-2 p-4 border-t border-border">
                <Button variant="outline" size="sm" disabled={usersPage <= 1} onClick={() => setUsersPage(p => p - 1)}>Anterior</Button>
                <span className="text-sm text-muted-foreground">Página {usersPage} de {usersTotalPages}</span>
                <Button variant="outline" size="sm" disabled={usersPage >= usersTotalPages} onClick={() => setUsersPage(p => p + 1)}>Siguiente</Button>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ══════════════ Tab: Configuración ══════════════ */}
        <TabsContent value="configuracion" className="space-y-4 mt-0">

          {/* Top row: Personalización + Categorías */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Palette className="h-4 w-4 text-muted-foreground" />
                  Personalización
                </CardTitle>
                <CardDescription>Color de fondo de la página pública</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>Color de fondo general</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={platformBgColor}
                      onChange={(e) => setPlatformBgColor(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border border-border"
                    />
                    <Input
                      value={platformBgColor}
                      onChange={(e) => setPlatformBgColor(e.target.value)}
                      className="w-28 font-mono text-sm"
                      maxLength={7}
                    />
                    <div className="w-16 h-10 rounded border border-border shrink-0" style={{ backgroundColor: platformBgColor }} />
                    <Button size="sm" onClick={handleSavePlatformBgColor} disabled={isSavingPlatformBg}>
                      {isSavingPlatformBg ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Tags className="h-4 w-4 text-muted-foreground" />
                  Categorías de Comercio
                </CardTitle>
                <CardDescription>Tipos de negocio al crear un comercio</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Nueva categoría (ej: Heladería)"
                    value={newBusinessType}
                    onChange={(e) => setNewBusinessType(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateBusinessType() }}
                    className="flex-1"
                  />
                  <Button size="sm" onClick={handleCreateBusinessType} disabled={isSavingBusinessType || !newBusinessType.trim()} className="gap-1 shrink-0">
                    <Plus className="h-4 w-4" />
                    Agregar
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {businessTypes.map((type) => (
                    <div key={type} className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-border bg-secondary text-secondary-foreground text-sm">
                      <span>{type}</span>
                      <button onClick={() => handleDeleteBusinessType(type)} className="ml-1 text-muted-foreground hover:text-destructive transition-colors" title="Eliminar">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {businessTypes.length === 0 && <p className="text-sm text-muted-foreground">No hay categorías</p>}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment Gateways — one card, inner tabs */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base lg:text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                Pasarelas de Pago
              </CardTitle>
              <CardDescription>Configura los métodos de pago disponibles en la plataforma</CardDescription>
              {/* Status pills */}
              <div className="flex flex-wrap gap-2 pt-1">
                {([
                  { label: 'MercadoPago', saved: mpTokenSaved },
                  { label: 'ADDI', saved: addiSaved },
                  { label: 'Sistecredito', saved: sisteSaved },
                ] as const).map(({ label, saved }) => (
                  <span key={label} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${saved ? 'bg-green-500/10 border-green-500/30 text-green-600' : 'bg-muted border-border text-muted-foreground'}`}>
                    {saved ? <ShieldCheck className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                    {label}
                  </span>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="mercadopago" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="mercadopago" className="gap-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-blue-500" />
                    MercadoPago
                    {mpTokenSaved && <span className="h-1.5 w-1.5 rounded-full bg-green-500" />}
                  </TabsTrigger>
                  <TabsTrigger value="addi" className="gap-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-[#FF5E00]" />
                    ADDI
                    {addiSaved && <span className="h-1.5 w-1.5 rounded-full bg-green-500" />}
                  </TabsTrigger>
                  <TabsTrigger value="sistecredito" className="gap-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-[#1A3FA0]" />
                    Sistecredito
                    {sisteSaved && <span className="h-1.5 w-1.5 rounded-full bg-green-500" />}
                  </TabsTrigger>
                </TabsList>

                {/* MercadoPago */}
                <TabsContent value="mercadopago" className="space-y-5 mt-0">
                  <p className="text-sm text-muted-foreground">
                    Conecta tu cuenta de MercadoPago para recibir pagos online con 10% de descuento al comprador.
                  </p>
                  {mpTokenSaved ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded bg-green-50 border border-green-200 text-green-700 text-sm">
                      <ShieldCheck className="h-4 w-4 shrink-0" />
                      Access Token configurado y activo.
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 rounded bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      Sin configurar — el botón de pago en línea no aparecerá a los clientes.
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Access Token <span className="text-[10px] text-muted-foreground font-normal">(Mercado Pago → Tus integraciones → Credenciales)</span></Label>
                    <div className="relative">
                      <input
                        type={showMpToken ? 'text' : 'password'}
                        value={mpAccessToken}
                        onChange={(e) => { setMpAccessToken(e.target.value); setMpTokenSaved(false) }}
                        placeholder="APP_USR-xxxxxxxxxxxxxxxx"
                        className="w-full h-9 px-3 pr-10 border border-input bg-background rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button type="button" onClick={() => setShowMpToken(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <EyeOff className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Usa el token de <strong>Producción</strong> para cobros reales, o el de <strong>Pruebas</strong> para sandbox.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>URL del frontend (redirección tras el pago)</Label>
                    <Input value={mpFrontendUrl} onChange={(e) => setMpFrontendUrl(e.target.value)} placeholder="https://tu-dominio.com" className="font-mono text-sm" />
                  </div>
                  <Button onClick={handleSaveMPSettings} disabled={isSavingMP} className="gap-2">
                    <CreditCard className="h-4 w-4" />
                    {isSavingMP ? 'Guardando...' : 'Guardar configuración MP'}
                  </Button>
                </TabsContent>

                {/* ADDI */}
                <TabsContent value="addi" className="space-y-5 mt-0">
                  <p className="text-sm text-muted-foreground">
                    Conecta ADDI para ofrecer crédito inmediato a tus clientes. Pagan en cuotas, tú recibes el dinero de contado.
                  </p>
                  {addiSaved ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded bg-green-50 border border-green-200 text-green-700 text-sm">
                      <ShieldCheck className="h-4 w-4 shrink-0" />
                      Credenciales configuradas. El botón "Pagar con ADDI" ya es funcional.
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 rounded bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      Sin configurar — el botón de ADDI no aparecerá a los clientes.
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => { setAddiProduction(v => !v); setAddiSaved(false) }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${addiProduction ? 'bg-[#FF5E00]' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${addiProduction ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                    <span className="text-sm font-medium">{addiProduction ? 'Producción (cobros reales)' : 'Staging (pruebas)'}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Client ID</Label>
                      <Input value={addiClientId} onChange={(e) => { setAddiClientId(e.target.value); setAddiSaved(false) }} placeholder="Client ID" className="font-mono text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label>Client Secret</Label>
                      <div className="relative">
                        <input
                          type={showAddiSecret ? 'text' : 'password'}
                          value={addiClientSecret}
                          onChange={(e) => { setAddiClientSecret(e.target.value); setAddiSaved(false) }}
                          placeholder="Client Secret"
                          className="w-full h-9 px-3 pr-10 border border-input bg-background rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <button type="button" onClick={() => setShowAddiSecret(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          <EyeOff className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Store Slug <span className="text-[10px] text-muted-foreground font-normal">(opcional — provisto por ADDI)</span></Label>
                    <Input value={addiStoreSlug} onChange={(e) => { setAddiStoreSlug(e.target.value); setAddiSaved(false) }} placeholder="mi-tienda" className="font-mono text-sm max-w-xs" />
                  </div>
                  <Button onClick={handleSaveAddiSettings} disabled={isSavingAddi} className="gap-2 bg-[#FF5E00] hover:bg-[#e05500] text-white">
                    <CreditCard className="h-4 w-4" />
                    {isSavingAddi ? 'Guardando...' : 'Guardar configuración ADDI'}
                  </Button>
                </TabsContent>

                {/* Sistecredito */}
                <TabsContent value="sistecredito" className="space-y-5 mt-0">
                  <p className="text-sm text-muted-foreground">
                    Conecta Sistecredito para ofrecer crédito sin tarjeta a tus clientes. Ampliamente usado en Colombia para compras a cuotas.
                  </p>
                  {sisteSaved ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded bg-green-50 border border-green-200 text-green-700 text-sm">
                      <ShieldCheck className="h-4 w-4 shrink-0" />
                      API Key configurada. El botón "Pagar con Sistecredito" ya es funcional.
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 rounded bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      Sin configurar — el botón de Sistecredito no aparecerá a los clientes.
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => { setSisteProduction(v => !v); setSisteSaved(false) }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${sisteProduction ? 'bg-[#1A3FA0]' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${sisteProduction ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                    <span className="text-sm font-medium">{sisteProduction ? 'Producción (cobros reales)' : 'Sandbox (pruebas)'}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>API Key</Label>
                      <Input value={sisteApiKey} onChange={(e) => { setSisteApiKey(e.target.value); setSisteSaved(false) }} placeholder="API Key de Sistecredito" className="font-mono text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label>API Secret <span className="text-[10px] text-muted-foreground font-normal">(opcional)</span></Label>
                      <div className="relative">
                        <input
                          type={showSisteSecret ? 'text' : 'password'}
                          value={sisteApiSecret}
                          onChange={(e) => { setSisteApiSecret(e.target.value); setSisteSaved(false) }}
                          placeholder="API Secret"
                          className="w-full h-9 px-3 pr-10 border border-input bg-background rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <button type="button" onClick={() => setShowSisteSecret(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          <EyeOff className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Código de Aliado <span className="text-[10px] text-muted-foreground font-normal">(opcional — provisto por Sistecredito)</span></Label>
                    <Input value={sisteAllyCode} onChange={(e) => { setSisteAllyCode(e.target.value); setSisteSaved(false) }} placeholder="Ej: ALIADO-001" className="font-mono text-sm max-w-xs" />
                  </div>
                  <Button onClick={handleSaveSisteSettings} disabled={isSavingSiste} className="gap-2 bg-[#1A3FA0] hover:bg-[#142e80] text-white">
                    <CreditCard className="h-4 w-4" />
                    {isSavingSiste ? 'Guardando...' : 'Guardar configuración Sistecredito'}
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ══════════════ Dialogs ══════════════ */}

      {/* Create Tenant */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Nuevo Comercio
            </DialogTitle>
            <DialogDescription>
              Crea un nuevo comercio con su propietario. Se generarán automáticamente las secuencias y configuración inicial.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Información del Negocio</p>
              <div className="space-y-2">
                <Label>Nombre del Comercio <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Ej: Tienda La Esquina"
                    value={createForm.name}
                    onChange={(e) => { const name = e.target.value; setCreateForm(f => ({ ...f, name, slug: generateSlug(name) })) }}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Slug (URL) <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="tienda-la-esquina" value={createForm.slug} onChange={(e) => setCreateForm(f => ({ ...f, slug: e.target.value }))} className="pl-9" />
                </div>
                <p className="text-xs text-muted-foreground">Solo letras minúsculas, números y guiones</p>
              </div>
              <div className="space-y-2">
                <Label>Categoría del Negocio</Label>
                <Select value={createForm.businessType || ''} onValueChange={(v) => setCreateForm(f => ({ ...f, businessType: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar categoría..." /></SelectTrigger>
                  <SelectContent>
                    {businessTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Plan</Label>
                  <Select value={createForm.plan} onValueChange={(v) => setCreateForm(f => ({ ...f, plan: v as TenantPlan }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basico">Básico</SelectItem>
                      <SelectItem value="profesional">Profesional</SelectItem>
                      <SelectItem value="empresarial">Empresarial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Máx. Usuarios</Label>
                  <Input type="number" min={1} value={createForm.maxUsers} onChange={(e) => setCreateForm(f => ({ ...f, maxUsers: parseInt(e.target.value) || 5 }))} />
                </div>
                <div className="space-y-2">
                  <Label>Máx. Productos</Label>
                  <Input type="number" min={1} value={createForm.maxProducts} onChange={(e) => setCreateForm(f => ({ ...f, maxProducts: parseInt(e.target.value) || 500 }))} />
                </div>
              </div>
            </div>
            <div className="space-y-3 border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Propietario (Comerciante)</p>
              <div className="space-y-2">
                <Label>Nombre <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Nombre del propietario" value={createForm.ownerName} onChange={(e) => setCreateForm(f => ({ ...f, ownerName: e.target.value }))} className="pl-9" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="email" placeholder="email@ejemplo.com" value={createForm.ownerEmail} onChange={(e) => setCreateForm(f => ({ ...f, ownerEmail: e.target.value }))} className="pl-9" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Contraseña <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="password" placeholder="Mínimo 6 caracteres" value={createForm.ownerPassword} onChange={(e) => setCreateForm(f => ({ ...f, ownerPassword: e.target.value }))} className="pl-9" />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateTenant} disabled={isCreating}>{isCreating ? 'Creando...' : 'Crear Comercio'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Tenant */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Edit className="h-5 w-5 text-primary" />Editar Comercio</DialogTitle>
            <DialogDescription>{editingTenant?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2">
                <Label>Nombre del Comercio</Label>
                <Input value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Slug <span className="text-xs text-muted-foreground">(URL única del comercio)</span></Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={editForm.slug}
                    onChange={(e) => setEditForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                    className="pl-9 font-mono text-sm"
                    placeholder="mi-comercio"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Categoría del Negocio</Label>
              <Select value={editForm.businessType || ''} onValueChange={(v) => setEditForm(f => ({ ...f, businessType: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar categoría..." /></SelectTrigger>
                <SelectContent>{businessTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={editForm.plan} onValueChange={(v) => setEditForm(f => ({ ...f, plan: v as TenantPlan }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basico">Básico</SelectItem>
                  <SelectItem value="profesional">Profesional</SelectItem>
                  <SelectItem value="empresarial">Empresarial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Máx. Usuarios</Label>
                <Input type="number" min={1} value={editForm.maxUsers} onChange={(e) => setEditForm(f => ({ ...f, maxUsers: parseInt(e.target.value) || 5 }))} />
              </div>
              <div className="space-y-2">
                <Label>Máx. Productos</Label>
                <Input type="number" min={1} value={editForm.maxProducts} onChange={(e) => setEditForm(f => ({ ...f, maxProducts: parseInt(e.target.value) || 500 }))} />
              </div>
            </div>
            {(editForm.ownerName || editForm.ownerEmail) && (
              <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Propietario (solo lectura)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Nombre</p>
                    <p className="text-sm font-medium">{editForm.ownerName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm font-medium break-all">{editForm.ownerEmail || '-'}</p>
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-2 border-t border-border pt-4">
              <Label className="flex items-center gap-2"><Palette className="h-4 w-4" />Color de fondo de la tienda</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={editForm.bgColor} onChange={(e) => setEditForm(f => ({ ...f, bgColor: e.target.value }))} className="w-10 h-10 rounded cursor-pointer border border-border" />
                <Input value={editForm.bgColor} onChange={(e) => setEditForm(f => ({ ...f, bgColor: e.target.value }))} className="w-28 font-mono text-sm" maxLength={7} />
                <div className="flex-1 h-10 rounded border border-border" style={{ backgroundColor: editForm.bgColor }} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdateTenant} disabled={isUpdating}>{isUpdating ? 'Guardando...' : 'Guardar Cambios'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" />Detalle del Comercio</DialogTitle>
          </DialogHeader>
          {detailTenant && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`${statusConfig[detailTenant.status]?.className || ''} gap-1`}>
                  {statusConfig[detailTenant.status]?.icon}{statusConfig[detailTenant.status]?.label}
                </Badge>
                <Badge variant="outline" className={planConfig[detailTenant.plan]?.className || ''}>
                  {planConfig[detailTenant.plan]?.label}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label="Nombre" value={detailTenant.name} />
                <InfoRow label="Slug" value={detailTenant.slug} />
                <InfoRow label="Propietario" value={detailTenant.ownerName || '-'} />
                <InfoRow label="Email" value={detailTenant.ownerEmail || '-'} />
                <InfoRow label="Creado" value={new Date(detailTenant.createdAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })} />
                <InfoRow label="Tipo" value={detailTenant.businessType || 'General'} />
              </div>
              <div className="rounded-lg border border-border p-3 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Uso y Límites</p>
                <div className="grid grid-cols-2 gap-3">
                  <UsageBar label="Usuarios" current={detailTenant.totalUsers || 0} max={detailTenant.maxUsers} />
                  <UsageBar label="Productos" current={detailTenant.totalProducts || 0} max={detailTenant.maxProducts} />
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-md bg-secondary p-2">
                    <p className="text-xs text-muted-foreground">Ventas</p>
                    <p className="text-sm font-semibold">{detailTenant.totalSales || 0}</p>
                  </div>
                  <div className="rounded-md bg-secondary p-2">
                    <p className="text-xs text-muted-foreground">Clientes</p>
                    <p className="text-sm font-semibold">{detailTenant.totalCustomers || 0}</p>
                  </div>
                  <div className="rounded-md bg-secondary p-2">
                    <p className="text-xs text-muted-foreground">Inventario</p>
                    <p className="text-sm font-semibold">{formatCOP(detailTenant.inventoryValue || 0)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>Cerrar</Button>
            {detailTenant && (
              <Button onClick={() => { setIsDetailOpen(false); openEdit(detailTenant) }}>
                <Edit className="h-4 w-4 mr-2" />Editar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User */}
      <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary" />Nuevo Usuario</DialogTitle>
            <DialogDescription>Crea un repartidor (por comercio o global) o un cliente asignado a un comercio.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Rol <span className="text-destructive">*</span></Label>
              <Select value={createUserForm.role} onValueChange={(v) => setCreateUserForm(f => ({ ...f, role: v as 'repartidor' | 'cliente', isGlobal: false }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="repartidor"><span className="flex items-center gap-2"><Truck className="h-4 w-4" /> Repartidor</span></SelectItem>
                  <SelectItem value="cliente"><span className="flex items-center gap-2"><User className="h-4 w-4" /> Cliente</span></SelectItem>
                </SelectContent>
              </Select>
            </div>
            {createUserForm.role === 'repartidor' && (
              <div
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${createUserForm.isGlobal ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'}`}
                onClick={() => setCreateUserForm(f => ({ ...f, isGlobal: !f.isGlobal, tenantId: '' }))}
              >
                <div className={`w-5 h-5 rounded flex items-center justify-center border-2 flex-shrink-0 transition-colors ${createUserForm.isGlobal ? 'border-primary bg-primary' : 'border-muted-foreground'}`}>
                  {createUserForm.isGlobal && <span className="text-white text-xs font-bold">✓</span>}
                </div>
                <div>
                  <p className="text-sm font-medium">Repartidor Global</p>
                  <p className="text-xs text-muted-foreground">Puede ver y tomar pedidos de todos los comercios</p>
                </div>
              </div>
            )}
            {!(createUserForm.isGlobal && createUserForm.role === 'repartidor') && (
              <div className="space-y-2">
                <Label>Comercio <span className="text-destructive">*</span></Label>
                <Select value={createUserForm.tenantId} onValueChange={(v) => setCreateUserForm(f => ({ ...f, tenantId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar comercio..." /></SelectTrigger>
                  <SelectContent>
                    {tenants.filter(t => t.status === 'activo').map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Nombre <span className="text-destructive">*</span></Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Nombre completo" value={createUserForm.name} onChange={(e) => setCreateUserForm(f => ({ ...f, name: e.target.value }))} className="pl-9" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="email" placeholder="email@ejemplo.com" value={createUserForm.email} onChange={(e) => setCreateUserForm(f => ({ ...f, email: e.target.value }))} className="pl-9" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Teléfono <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="+57 300 123 4567" value={createUserForm.phone} onChange={(e) => setCreateUserForm(f => ({ ...f, phone: e.target.value }))} className="pl-9" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Contraseña <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="password" placeholder="Mínimo 6 caracteres" value={createUserForm.password} onChange={(e) => setCreateUserForm(f => ({ ...f, password: e.target.value }))} className="pl-9" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateUserOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateUser} disabled={isCreatingUser}>{isCreatingUser ? 'Creando...' : 'Crear Usuario'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirm */}
      <Dialog open={!!deleteUserId} onOpenChange={(open) => { if (!open) setDeleteUserId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><XCircle className="h-5 w-5" />Eliminar Usuario</DialogTitle>
            <DialogDescription>¿Estás seguro de que deseas eliminar a <strong>{deleteUserName}</strong>? Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteUserId(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={isDeletingUser} onClick={handleDeleteUser}>{isDeletingUser ? 'Eliminando...' : 'Eliminar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password */}
      <Dialog open={isResetPassOpen} onOpenChange={(open) => { if (!open) setIsResetPassOpen(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Lock className="h-5 w-5 text-primary" />Resetear Contraseña</DialogTitle>
            <DialogDescription>Nueva contraseña para <strong>{resetPassUserName}</strong></DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Nueva contraseña</Label>
            <Input type="password" placeholder="Mínimo 6 caracteres" value={resetPassValue} onChange={(e) => setResetPassValue(e.target.value)} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsResetPassOpen(false)}>Cancelar</Button>
            <Button disabled={isSavingPass || resetPassValue.length < 6} onClick={handleResetPassword}>{isSavingPass ? 'Guardando...' : 'Guardar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modules Manager */}
      <Dialog open={isModulesOpen} onOpenChange={setIsModulesOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-blue-500" />
              Módulos — {modulesForTenant?.name}
            </DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-foreground">{editingModules.length}</span> de {ALL_MODULES.length} módulos activos
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Preset selector */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Aplicar preset por tipo de negocio</Label>
              <Select onValueChange={(v) => {
                const preset = BUSINESS_PRESETS[v]
                if (preset) setEditingModules([...preset.modules])
              }}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Seleccionar preset..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(BUSINESS_PRESETS).map(([key, p]) => (
                    <SelectItem key={key} value={key}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Module groups */}
            {Object.entries(
              ALL_MODULES.reduce((acc, m) => {
                if (!acc[m.groupLabel]) acc[m.groupLabel] = []
                acc[m.groupLabel].push(m)
                return acc
              }, {} as Record<string, typeof ALL_MODULES>)
            ).map(([groupLabel, mods]) => (
              <div key={groupLabel}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">{groupLabel}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {mods.map(mod => {
                    const active = editingModules.includes(mod.id)
                    return (
                      <label
                        key={mod.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors select-none ${active ? 'border-primary/50 bg-primary/5 text-foreground' : 'border-border bg-transparent text-muted-foreground hover:bg-accent/40'}`}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleModule(mod.id)}
                          className="h-3.5 w-3.5 accent-primary"
                        />
                        <span className="text-sm leading-none">{mod.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsModulesOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveModules} disabled={isSavingModules} className="gap-2">
              <LayoutGrid className="h-4 w-4" />
              {isSavingModules ? 'Guardando...' : 'Guardar Módulos'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Trial Confirmation */}
      <Dialog open={!!trialConfirmTenant} onOpenChange={(open) => { if (!open) setTrialConfirmTenant(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-purple-500" />
              Activar Trial Empresarial
            </DialogTitle>
            <DialogDescription>
              Activa el plan Empresarial por prueba para <strong>{trialConfirmTenant?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                Días de trial
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="icon" className="h-9 w-9 shrink-0"
                  onClick={() => setTrialDays(d => Math.max(1, d - 1))}
                  disabled={trialDays <= 1}
                >−</Button>
                <Input
                  type="number" min={1} max={365}
                  value={trialDays}
                  onChange={(e) => setTrialDays(Math.max(1, Math.min(365, parseInt(e.target.value) || 7)))}
                  className="text-center font-semibold text-lg"
                />
                <Button
                  variant="outline" size="icon" className="h-9 w-9 shrink-0"
                  onClick={() => setTrialDays(d => Math.min(365, d + 1))}
                  disabled={trialDays >= 365}
                >+</Button>
              </div>
              <div className="flex gap-2">
                {[7, 14, 30].map(d => (
                  <Button key={d} variant={trialDays === d ? 'default' : 'outline'} size="sm" className="flex-1 text-xs" onClick={() => setTrialDays(d)}>
                    {d} días
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTrialConfirmTenant(null)}>Cancelar</Button>
            <Button
              onClick={handleConfirmActivateTrial}
              disabled={isActivatingTrial}
              className="gap-2 bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Zap className="h-4 w-4" />
              {isActivatingTrial ? 'Activando...' : `Activar ${trialDays} días`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enviar a papelera (soft delete / cancelar) */}
      <Dialog open={!!tenantToDelete} onOpenChange={(open) => { if (!open) setTenantToDelete(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-600">
              <Trash2 className="h-5 w-5" />
              Enviar a papelera
            </DialogTitle>
            <DialogDescription>
              El comercio <strong>{tenantToDelete?.name}</strong> quedará <strong>cancelado</strong>:
              sus usuarios no podrán iniciar sesión y dejará de aparecer en la página principal.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-yellow-300 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20 px-3 py-2 text-xs text-yellow-800 dark:text-yellow-300 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            <span>No se borran datos. Puedes reactivarlo cuando quieras desde el botón <strong>Activar</strong>. Para borrar todo de forma permanente usa <strong>Eliminar definitivamente</strong>.</span>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTenantToDelete(null)}>Cancelar</Button>
            <Button disabled={isDeletingTenant} onClick={handleDeleteTenant}
              className="gap-2 bg-yellow-500 hover:bg-yellow-600 text-white">
              <Trash2 className="h-4 w-4" />
              {isDeletingTenant ? 'Enviando...' : 'Enviar a papelera'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Eliminar DEFINITIVAMENTE (hard delete, irreversible) */}
      <Dialog open={!!tenantToPurge} onOpenChange={(open) => { if (!open) { setTenantToPurge(null); setPurgeConfirmText('') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Eliminar definitivamente
            </DialogTitle>
            <DialogDescription>
              Vas a borrar <strong>{tenantToPurge?.name}</strong> y <strong>TODOS</strong> sus datos de forma permanente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-xs text-destructive space-y-1.5">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> Esta acción NO se puede deshacer
              </p>
              <p>Se eliminarán para siempre: productos, inventario, ventas, pedidos, facturas, clientes, usuarios y toda la configuración de este comercio.</p>
              {tenantToPurge && (
                <p className="text-[11px] opacity-80">
                  Afecta aprox.: {tenantToPurge.totalProducts ?? 0} producto(s), {tenantToPurge.totalSales ?? 0} venta(s), {tenantToPurge.totalUsers ?? 0} usuario(s).
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Para confirmar, escribe el nombre del comercio: <strong>{tenantToPurge?.name}</strong>
              </Label>
              <Input
                value={purgeConfirmText}
                onChange={(e) => setPurgeConfirmText(e.target.value)}
                placeholder={tenantToPurge?.name || ''}
                autoFocus
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setTenantToPurge(null); setPurgeConfirmText('') }}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={isPurging || purgeConfirmText.trim() !== (tenantToPurge?.name || '').trim()}
              onClick={handlePurgeTenant}
              className="gap-2"
            >
              <AlertTriangle className="h-4 w-4" />
              {isPurging ? 'Eliminando...' : 'Eliminar para siempre'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Desactivar trial */}
      <Dialog open={!!tenantToDeactivateTrial} onOpenChange={(open) => { if (!open) setTenantToDeactivateTrial(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <ZapOff className="h-5 w-5" />
              Desactivar trial
            </DialogTitle>
            <DialogDescription>
              Se cancelará el período de prueba de <strong>{tenantToDeactivateTrial?.name}</strong> y el plan volverá a <strong>Básico</strong>.
              {tenantToDeactivateTrial?.trialEndsAt && (
                <> El trial estaba vigente hasta el {new Date(tenantToDeactivateTrial.trialEndsAt).toLocaleDateString('es-CO')}.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTenantToDeactivateTrial(null)}>Cancelar</Button>
            <Button disabled={isDeactivatingTrial} onClick={handleDeactivateTrial}
              className="gap-2 bg-orange-500 hover:bg-orange-600 text-white">
              <ZapOff className="h-4 w-4" />
              {isDeactivatingTrial ? 'Desactivando...' : 'Desactivar trial'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Helper Components ──

function StatCard({ title, value, icon, isText }: { title: string; value: number | string; icon: React.ReactNode; isText?: boolean }) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] sm:text-xs text-muted-foreground">{title}</span>
          {icon}
        </div>
        <p className="text-sm sm:text-lg font-semibold text-foreground truncate">
          {isText ? value : typeof value === 'number' ? value.toLocaleString('es-CO') : value}
        </p>
      </CardContent>
    </Card>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

function UsageBar({ label, current, max }: { label: string; current: number; max: number }) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-green-500'
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-medium">{current}/{max}</span>
      </div>
      <div className="w-full bg-secondary rounded-full h-1.5">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
