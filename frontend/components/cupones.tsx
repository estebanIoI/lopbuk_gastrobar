'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    Ticket,
    Plus,
    Search,
    RefreshCw,
    Trash2,
    Edit3,
    ToggleLeft,
    ToggleRight,
    Sparkles,
    Percent,
    DollarSign,
    Calendar,
    Copy,
    X,
    Check,
    AlertCircle,
    Gift,
} from 'lucide-react'
import { toast } from 'sonner'

interface Coupon {
    id: string
    code: string
    description: string | null
    discountType: 'porcentaje' | 'fijo'
    discountValue: number
    minPurchase: number | null
    maxUses: number | null
    timesUsed: number
    isActive: boolean
    expiresAt: string | null
    createdAt: string
    updatedAt: string
}

export function Cupones() {
    const [coupons, setCoupons] = useState<Coupon[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null)
    const [saving, setSaving] = useState(false)

    // Form state
    const [formCode, setFormCode] = useState('')
    const [formDescription, setFormDescription] = useState('')
    const [formDiscountType, setFormDiscountType] = useState<'porcentaje' | 'fijo'>('porcentaje')
    const [formDiscountValue, setFormDiscountValue] = useState('')
    const [formMinPurchase, setFormMinPurchase] = useState('')
    const [formMaxUses, setFormMaxUses] = useState('')
    const [formExpiresAt, setFormExpiresAt] = useState('')

    const fetchCoupons = useCallback(async () => {
        setLoading(true)
        try {
            const result = await api.getCoupons({ search: search || undefined })
            if (result.success && result.data?.coupons) {
                setCoupons(result.data.coupons)
            }
        } catch (error) {
            console.error('Error fetching coupons:', error)
        } finally {
            setLoading(false)
        }
    }, [search])

    useEffect(() => {
        fetchCoupons()
    }, [fetchCoupons])

    const resetForm = () => {
        setFormCode('')
        setFormDescription('')
        setFormDiscountType('porcentaje')
        setFormDiscountValue('')
        setFormMinPurchase('')
        setFormMaxUses('')
        setFormExpiresAt('')
        setEditingCoupon(null)
        setShowForm(false)
    }

    const openCreateForm = () => {
        resetForm()
        setShowForm(true)
    }

    const openEditForm = (coupon: Coupon) => {
        setEditingCoupon(coupon)
        setFormCode(coupon.code)
        setFormDescription(coupon.description || '')
        setFormDiscountType(coupon.discountType)
        setFormDiscountValue(String(coupon.discountValue))
        setFormMinPurchase(coupon.minPurchase ? String(coupon.minPurchase) : '')
        setFormMaxUses(coupon.maxUses ? String(coupon.maxUses) : '')
        setFormExpiresAt(coupon.expiresAt ? coupon.expiresAt.slice(0, 16) : '')
        setShowForm(true)
    }

    const handleSubmit = async () => {
        if (!formCode.trim() || !formDiscountValue) {
            toast.error('Código y valor de descuento son requeridos')
            return
        }

        setSaving(true)
        try {
            if (editingCoupon) {
                const result = await api.updateCoupon(editingCoupon.id, {
                    description: formDescription || undefined,
                    discountType: formDiscountType,
                    discountValue: Number(formDiscountValue),
                    minPurchase: formMinPurchase ? Number(formMinPurchase) : null,
                    maxUses: formMaxUses ? Number(formMaxUses) : null,
                    expiresAt: formExpiresAt || null,
                })
                if (result.success) {
                    toast.success('Cupón actualizado')
                    resetForm()
                    fetchCoupons()
                } else {
                    toast.error(result.error || 'Error al actualizar cupón')
                }
            } else {
                const result = await api.createCoupon({
                    code: formCode.trim(),
                    description: formDescription || undefined,
                    discountType: formDiscountType,
                    discountValue: Number(formDiscountValue),
                    minPurchase: formMinPurchase ? Number(formMinPurchase) : undefined,
                    maxUses: formMaxUses ? Number(formMaxUses) : undefined,
                    expiresAt: formExpiresAt || undefined,
                })
                if (result.success) {
                    toast.success('Cupón creado exitosamente')
                    resetForm()
                    fetchCoupons()
                } else {
                    toast.error(result.error || 'Error al crear cupón')
                }
            }
        } catch (error) {
            toast.error('Error al guardar cupón')
        } finally {
            setSaving(false)
        }
    }

    const handleToggle = async (coupon: Coupon) => {
        try {
            const result = await api.updateCoupon(coupon.id, { isActive: !coupon.isActive })
            if (result.success) {
                toast.success(coupon.isActive ? 'Cupón desactivado' : 'Cupón activado')
                fetchCoupons()
            } else {
                toast.error(result.error || 'Error al actualizar cupón')
            }
        } catch (error) {
            toast.error('Error al actualizar cupón')
        }
    }

    const handleDelete = async (coupon: Coupon) => {
        if (!confirm(`¿Estás seguro de eliminar el cupón "${coupon.code}"?`)) return
        try {
            const result = await api.deleteCoupon(coupon.id)
            if (result.success) {
                toast.success('Cupón eliminado')
                fetchCoupons()
            } else {
                toast.error(result.error || 'Error al eliminar cupón')
            }
        } catch (error) {
            toast.error('Error al eliminar cupón')
        }
    }

    const handleSeedDefaults = async () => {
        try {
            const result = await api.seedDefaultCoupons()
            if (result.success) {
                toast.success(result.message || 'Cupones estándar creados')
                fetchCoupons()
            } else {
                toast.error(result.error || 'Error al crear cupones estándar')
            }
        } catch (error) {
            toast.error('Error al crear cupones estándar')
        }
    }

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code)
        toast.success(`Código "${code}" copiado`)
    }

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value)

    const formatDate = (date: string) =>
        new Date(date).toLocaleDateString('es-CO', {
            year: 'numeric', month: 'short', day: 'numeric',
        })

    const isExpired = (expiresAt: string | null) => {
        if (!expiresAt) return false
        return new Date(expiresAt) < new Date()
    }

    const activeCount = coupons.filter(c => c.isActive && !isExpired(c.expiresAt)).length
    const totalUses = coupons.reduce((sum, c) => sum + c.timesUsed, 0)

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Ticket className="h-7 w-7 text-primary" />
                        Cupones de Descuento
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Administra cupones de descuento para tu tienda online
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSeedDefaults}
                        className="gap-1.5"
                    >
                        <Sparkles className="h-4 w-4" />
                        Crear Estándar (10%, 20%, 30%)
                    </Button>
                    <Button
                        size="sm"
                        onClick={openCreateForm}
                        className="gap-1.5"
                    >
                        <Plus className="h-4 w-4" />
                        Nuevo Cupón
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card variant="glass">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                                <Ticket className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{coupons.length}</p>
                                <p className="text-xs text-muted-foreground">Total Cupones</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card variant="glass">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-500/10">
                                <Check className="h-5 w-5 text-green-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{activeCount}</p>
                                <p className="text-xs text-muted-foreground">Activos</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card variant="glass">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-amber-500/10">
                                <Gift className="h-5 w-5 text-amber-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{totalUses}</p>
                                <p className="text-xs text-muted-foreground">Usos Totales</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search & Refresh */}
            <div className="flex gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por código o descripción..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Button variant="outline" size="icon" onClick={fetchCoupons} title="Refrescar">
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            {/* Create/Edit Form */}
            {showForm && (
                <Card className="border-primary/30">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                {editingCoupon ? <Edit3 className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                                {editingCoupon ? 'Editar Cupón' : 'Nuevo Cupón'}
                            </span>
                            <Button variant="ghost" size="icon" onClick={resetForm}>
                                <X className="h-4 w-4" />
                            </Button>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">CÓDIGO *</label>
                                <Input
                                    placeholder="Ej: DESC10"
                                    value={formCode}
                                    onChange={(e) => setFormCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                                    disabled={!!editingCoupon}
                                    className="font-mono"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">TIPO DE DESCUENTO</label>
                                <select
                                    value={formDiscountType}
                                    onChange={(e) => setFormDiscountType(e.target.value as 'porcentaje' | 'fijo')}
                                    className="w-full h-10 px-3 border border-input rounded-md bg-background text-sm"
                                >
                                    <option value="porcentaje">Porcentaje (%)</option>
                                    <option value="fijo">Valor Fijo ($)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                                    VALOR DE DESCUENTO *
                                </label>
                                <div className="relative">
                                    {formDiscountType === 'porcentaje' ? (
                                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    ) : (
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    )}
                                    <Input
                                        type="number"
                                        placeholder={formDiscountType === 'porcentaje' ? '10' : '5000'}
                                        value={formDiscountValue}
                                        onChange={(e) => setFormDiscountValue(e.target.value)}
                                        className="pl-9"
                                        min="0"
                                        max={formDiscountType === 'porcentaje' ? '100' : undefined}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">DESCRIPCIÓN</label>
                                <Input
                                    placeholder="Descuento del 10%"
                                    value={formDescription}
                                    onChange={(e) => setFormDescription(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">COMPRA MÍNIMA</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="number"
                                        placeholder="Sin mínimo"
                                        value={formMinPurchase}
                                        onChange={(e) => setFormMinPurchase(e.target.value)}
                                        className="pl-9"
                                        min="0"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">LÍMITE DE USOS</label>
                                <Input
                                    type="number"
                                    placeholder="Ilimitado"
                                    value={formMaxUses}
                                    onChange={(e) => setFormMaxUses(e.target.value)}
                                    min="1"
                                />
                            </div>
                            <div className="sm:col-span-2 lg:col-span-1">
                                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">FECHA DE EXPIRACIÓN</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="datetime-local"
                                        value={formExpiresAt}
                                        onChange={(e) => setFormExpiresAt(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-4 justify-end">
                            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
                            <Button onClick={handleSubmit} disabled={saving}>
                                {saving ? 'Guardando...' : editingCoupon ? 'Actualizar' : 'Crear Cupón'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Coupons List */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : coupons.length === 0 ? (
                <Card variant="glass">
                    <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                        <div className="p-4 rounded-full bg-muted">
                            <Ticket className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-medium">No hay cupones</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Crea tu primer cupón o genera los cupones estándar (10%, 20%, 30%)
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleSeedDefaults} className="gap-1.5">
                                <Sparkles className="h-4 w-4" />
                                Crear Estándar
                            </Button>
                            <Button onClick={openCreateForm} className="gap-1.5">
                                <Plus className="h-4 w-4" />
                                Nuevo Cupón
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {coupons.map(coupon => {
                        const expired = isExpired(coupon.expiresAt)
                        const usedUp = coupon.maxUses !== null && coupon.timesUsed >= coupon.maxUses
                        const status = !coupon.isActive
                            ? 'inactive'
                            : expired
                                ? 'expired'
                                : usedUp
                                    ? 'used_up'
                                    : 'active'

                        return (
                            <Card
                                key={coupon.id}
                                className={`relative overflow-hidden transition-all duration-200 hover:shadow-md ${status === 'active'
                                        ? 'border-green-500/30 hover:border-green-500/50'
                                        : 'border-muted opacity-75'
                                    }`}
                            >
                                {/* Decorative stripe */}
                                <div
                                    className={`absolute top-0 left-0 right-0 h-1 ${status === 'active'
                                            ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                                            : status === 'expired'
                                                ? 'bg-gradient-to-r from-red-500 to-orange-500'
                                                : 'bg-gradient-to-r from-gray-400 to-gray-500'
                                        }`}
                                />

                                <CardContent className="pt-5 pb-4">
                                    {/* Code + Status */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => copyCode(coupon.code)}
                                                className="font-mono text-lg font-bold tracking-wider text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                                                title="Clic para copiar"
                                            >
                                                {coupon.code}
                                                <Copy className="h-3.5 w-3.5 opacity-40" />
                                            </button>
                                        </div>
                                        <Badge
                                            variant={status === 'active' ? 'default' : 'secondary'}
                                            className={`text-xs ${status === 'active'
                                                    ? 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30'
                                                    : status === 'expired'
                                                        ? 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30'
                                                        : status === 'used_up'
                                                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                                                            : ''
                                                }`}
                                        >
                                            {status === 'active'
                                                ? 'Activo'
                                                : status === 'expired'
                                                    ? 'Expirado'
                                                    : status === 'used_up'
                                                        ? 'Agotado'
                                                        : 'Inactivo'}
                                        </Badge>
                                    </div>

                                    {/* Discount Display */}
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className={`p-1.5 rounded-md ${coupon.discountType === 'porcentaje'
                                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                            }`}>
                                            {coupon.discountType === 'porcentaje' ? (
                                                <Percent className="h-4 w-4" />
                                            ) : (
                                                <DollarSign className="h-4 w-4" />
                                            )}
                                        </div>
                                        <span className="text-2xl font-bold">
                                            {coupon.discountType === 'porcentaje'
                                                ? `${coupon.discountValue}%`
                                                : formatCurrency(coupon.discountValue)}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {coupon.discountType === 'porcentaje' ? 'de descuento' : 'de descuento'}
                                        </span>
                                    </div>

                                    {/* Description */}
                                    {coupon.description && (
                                        <p className="text-sm text-muted-foreground mb-3">{coupon.description}</p>
                                    )}

                                    {/* Meta info */}
                                    <div className="space-y-1.5 text-xs text-muted-foreground">
                                        {coupon.minPurchase && (
                                            <div className="flex items-center gap-1.5">
                                                <AlertCircle className="h-3 w-3" />
                                                <span>Compra mín: {formatCurrency(coupon.minPurchase)}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-1.5">
                                            <Gift className="h-3 w-3" />
                                            <span>
                                                Usos: {coupon.timesUsed}
                                                {coupon.maxUses !== null ? ` / ${coupon.maxUses}` : ' (ilimitado)'}
                                            </span>
                                        </div>
                                        {coupon.expiresAt && (
                                            <div className="flex items-center gap-1.5">
                                                <Calendar className="h-3 w-3" />
                                                <span className={expired ? 'text-red-500' : ''}>
                                                    {expired ? 'Expiró' : 'Expira'}: {formatDate(coupon.expiresAt)}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-1.5">
                                            <Calendar className="h-3 w-3 opacity-50" />
                                            <span>Creado: {formatDate(coupon.createdAt)}</span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-1.5 mt-4 pt-3 border-t">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleToggle(coupon)}
                                            className="flex-1 gap-1.5 text-xs"
                                        >
                                            {coupon.isActive ? (
                                                <>
                                                    <ToggleRight className="h-4 w-4 text-green-500" />
                                                    Desactivar
                                                </>
                                            ) : (
                                                <>
                                                    <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                                                    Activar
                                                </>
                                            )}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => openEditForm(coupon)}
                                            className="gap-1.5 text-xs"
                                        >
                                            <Edit3 className="h-3.5 w-3.5" />
                                            Editar
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(coupon)}
                                            className="gap-1.5 text-xs text-destructive hover:text-destructive"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
