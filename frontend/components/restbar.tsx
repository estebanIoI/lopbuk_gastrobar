'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  UtensilsCrossed, Users, ChefHat, GlassWater, Receipt,
  Plus, Minus, Trash2, Send, CheckCircle2, Clock, RefreshCw,
  TableProperties, Edit2, X, Check, AlertCircle, TrendingUp,
  BookOpen, Search, ToggleLeft, ToggleRight, ChevronLeft,
  Banknote, CreditCard, Smartphone, ArrowLeftRight, Layers,
  ChevronRight, User, DollarSign,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── helpers ─────────────────────────────────────────────────────────────────
const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

const TABLE_STATUS_COLORS: Record<string, string> = {
  libre:     'border-green-500/40 bg-green-500/10 text-green-400',
  ocupada:   'border-amber-500/40 bg-amber-500/10 text-amber-400',
  reservada: 'border-blue-500/40 bg-blue-500/10 text-blue-400',
  inactiva:  'border-zinc-700 bg-zinc-800/40 text-zinc-500',
}
const ITEM_STATUS: Record<string, { label: string; color: string }> = {
  pendiente:      { label: 'Pendiente',    color: 'bg-zinc-700 text-zinc-300' },
  en_preparacion: { label: 'Preparando',   color: 'bg-amber-500/20 text-amber-400' },
  listo:          { label: 'Listo',        color: 'bg-green-500/20 text-green-400' },
  entregado:      { label: 'Entregado',    color: 'bg-blue-500/20 text-blue-400' },
  cancelado:      { label: 'Cancelado',    color: 'bg-red-500/20 text-red-400' },
}

type Tab = 'mesas' | 'comandas' | 'cocina' | 'bar' | 'caja' | 'reportes' | 'menu'

const RESTAURANT_ROLES = ['mesero', 'cocinero', 'cajero', 'bartender', 'administrador_rb']

// ─── Main component ───────────────────────────────────────────────────────────
export function RestBar() {
  const { user } = useAuthStore()
  const role = user?.role ?? ''
  const isAdmin = role === 'comerciante' || role === 'superadmin' || role === 'administrador_rb'

  const defaultTab = (): Tab => {
    if (role === 'cocinero') return 'cocina'
    if (role === 'bartender') return 'bar'
    if (role === 'cajero') return 'caja'
    if (role === 'mesero' || role === 'vendedor') return 'comandas'
    return 'mesas'
  }

  const [tab, setTab] = useState<Tab>(defaultTab)

  const tabs: { id: Tab; label: string; icon: any; roles?: string[] }[] = [
    { id: 'mesas',    label: 'Mesas',    icon: TableProperties },
    { id: 'menu',     label: 'Menú',     icon: BookOpen },
    { id: 'comandas', label: 'Comandas', icon: UtensilsCrossed },
    { id: 'cocina',   label: 'Cocina',   icon: ChefHat },
    { id: 'bar',      label: 'Bar',      icon: GlassWater },
    { id: 'caja',     label: 'Caja',     icon: Receipt },
    { id: 'reportes', label: 'Reportes', icon: TrendingUp },
  ]

  const visibleTabs = tabs.filter(t => {
    if (!isAdmin && t.id === 'mesas')    return false
    if (!isAdmin && t.id === 'menu')     return false
    if (!isAdmin && t.id === 'reportes') return false
    if (role === 'mesero' && t.id === 'cocina') return false
    if (role === 'mesero' && t.id === 'bar')    return false
    return true
  })

  return (
    <div className="flex flex-col h-full min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
            <UtensilsCrossed className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">RestBar</h1>
            <p className="text-xs text-muted-foreground">Gestión operativa del restaurante</p>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto scrollbar-thin">
          {visibleTabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all',
                tab === t.id
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {tab === 'mesas'    && <MesasTab />}
        {tab === 'menu'     && <MenuTab />}
        {tab === 'comandas' && <ComandasTab role={role} />}
        {tab === 'cocina'   && <AreaDisplayTab area="cocina" />}
        {tab === 'bar'      && <AreaDisplayTab area="bar" />}
        {tab === 'caja'     && <CajaTab />}
        {tab === 'reportes' && <ReportesTab />}
      </div>
    </div>
  )
}

// ─── MENÚ TAB ─────────────────────────────────────────────────────────────────
function MenuTab() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [filterArea, setFilterArea] = useState<string>('todos')
  const [filterMenu, setFilterMenu] = useState<string>('todos')
  const [editing, setEditing]   = useState<any>(null)  // product being configured
  const [form, setForm]         = useState({ preparationArea: 'cocina', prepTimeMinutes: '' })
  const [saving, setSaving]     = useState(false)

  // ── Public menu toggle ──
  const [pubEnabled, setPubEnabled]   = useState(false)
  const [pubSlug, setPubSlug]         = useState('')
  const [pubLoading, setPubLoading]   = useState(false)
  const [pubSettingLoad, setPubSettingLoad] = useState(true)
  const [qrCopied, setQrCopied]       = useState(false)

  const menuUrl = pubSlug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/menu/${pubSlug}`
    : ''

  useEffect(() => {
    api.getPublicMenuSettings().then(r => {
      if (r.success && r.data) { setPubEnabled(r.data.enabled); setPubSlug(r.data.slug) }
      setPubSettingLoad(false)
    })
  }, [])

  const togglePublicMenu = async () => {
    setPubLoading(true)
    const r = await api.setPublicMenuEnabled(!pubEnabled)
    if (r.success && r.data) {
      setPubEnabled(r.data.enabled)
      setPubSlug(r.data.slug)
      toast.success(r.data.enabled ? 'Menú público activado ✓' : 'Menú público desactivado')
    } else {
      toast.error('Error al actualizar')
    }
    setPubLoading(false)
  }

  const copyLink = () => {
    navigator.clipboard.writeText(menuUrl)
    setQrCopied(true)
    setTimeout(() => setQrCopied(false), 2000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const r = await api.getMenuCatalog()
    if (r.success) setProducts(r.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openEdit = (p: any) => {
    setEditing(p)
    setForm({
      preparationArea: p.preparationArea ?? 'cocina',
      prepTimeMinutes: p.prepTimeMinutes ? String(p.prepTimeMinutes) : '',
    })
  }

  const saveSettings = async () => {
    if (!editing) return
    setSaving(true)
    const r = await api.updateMenuItemSettings(editing.id, {
      isMenuItem: true,
      preparationArea: form.preparationArea,
      prepTimeMinutes: form.prepTimeMinutes ? Number(form.prepTimeMinutes) : null,
    })
    if (r.success) { toast.success('Ítem de menú configurado'); setEditing(null); load() }
    else toast.error(r.error)
    setSaving(false)
  }

  const removeFromMenu = async (p: any) => {
    if (!confirm(`¿Quitar "${p.name}" del menú? No afecta el inventario.`)) return
    const r = await api.updateMenuItemSettings(p.id, { isMenuItem: false })
    if (r.success) { toast.success('Quitado del menú'); load() }
    else toast.error(r.error)
  }

  const toggleAvail = async (p: any) => {
    const r = await api.toggleMenuItemAvailability(p.id)
    if (r.success) {
      toast.success(r.data.availableInMenu ? 'Disponible' : 'Oculto del menú')
      load()
    } else toast.error(r.error)
  }

  // Grouped categories for display
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))]

  const filtered = products.filter(p => {
    if (filterMenu === 'en_menu' && !p.isMenuItem)     return false
    if (filterMenu === 'fuera'   &&  p.isMenuItem)     return false
    if (filterArea !== 'todos'   && p.preparationArea !== filterArea && p.isMenuItem) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !(p.category ?? '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Group by category
  const grouped = categories.reduce<Record<string, any[]>>((acc, cat) => {
    const items = filtered.filter(p => p.category === cat)
    if (items.length) acc[cat] = items
    return acc
  }, {})
  const noCategory = filtered.filter(p => !p.category)
  if (noCategory.length) grouped['Sin categoría'] = noCategory

  const AREA_BADGE: Record<string, string> = {
    cocina: 'bg-orange-500/15 text-orange-400',
    bar:    'bg-purple-500/15 text-purple-400',
    ambos:  'bg-blue-500/15 text-blue-400',
  }

  return (
    <div className="space-y-4">

      {/* ── Public Menu Panel ── */}
      <div className={cn(
        'rounded-xl border p-4 space-y-3 transition-all',
        pubEnabled ? 'border-green-500/30 bg-green-500/5' : 'border-border bg-card',
      )}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Menú público con QR</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {pubEnabled ? 'Activo — los clientes pueden escanear el QR' : 'Desactivado — actívalo para compartir tu carta'}
            </p>
          </div>
          <button
            onClick={togglePublicMenu}
            disabled={pubLoading || pubSettingLoad}
            className={cn(
              'relative inline-flex h-7 w-12 items-center rounded-full transition-colors shrink-0',
              pubEnabled ? 'bg-green-500' : 'bg-muted',
              (pubLoading || pubSettingLoad) && 'opacity-50 cursor-not-allowed',
            )}
          >
            <span className={cn(
              'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform',
              pubEnabled ? 'translate-x-6' : 'translate-x-1',
            )} />
          </button>
        </div>

        {pubEnabled && menuUrl && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-1">
            {/* QR Code */}
            <div className="shrink-0 bg-white p-2 rounded-xl">
              {/* eslint-disable-next-line @typescript-eslint/no-var-requires */}
              {(() => { const { QRCodeSVG } = require('qrcode.react'); return <QRCodeSVG value={menuUrl} size={96} /> })()}
            </div>
            {/* Link + actions */}
            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-xs text-muted-foreground truncate font-mono bg-accent rounded-md px-3 py-2">{menuUrl}</p>
              <div className="flex gap-2">
                <button onClick={copyLink}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent transition-colors">
                  {qrCopied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <BookOpen className="h-3.5 w-3.5" />}
                  {qrCopied ? 'Copiado!' : 'Copiar link'}
                </button>
                <a href={menuUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent transition-colors">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Ver menú
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h2 className="text-base font-semibold">Carta del menú</h2>
          <p className="text-xs text-muted-foreground">
            {products.filter(p => p.isMenuItem).length} ítems en menú · {products.filter(p => p.isMenuItem && p.availableInMenu).length} disponibles hoy
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="h-3.5 w-3.5" /></Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            className="pl-8 pr-3 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary w-52"
            placeholder="Buscar producto..."
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none"
          value={filterMenu} onChange={e => setFilterMenu(e.target.value)}>
          <option value="todos">Todos los productos</option>
          <option value="en_menu">Solo en menú</option>
          <option value="fuera">Fuera del menú</option>
        </select>
        <select className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none"
          value={filterArea} onChange={e => setFilterArea(e.target.value)}>
          <option value="todos">Todas las áreas</option>
          <option value="cocina">Cocina</option>
          <option value="bar">Bar</option>
          <option value="ambos">Ambos</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">{cat}</h3>
              <div className="rounded-lg border border-border overflow-hidden">
                {items.map((p, idx) => (
                  <div key={p.id} className={cn(
                    'flex items-center gap-3 px-4 py-3',
                    idx !== items.length - 1 && 'border-b border-border',
                    p.isMenuItem ? 'bg-card' : 'bg-muted/30'
                  )}>
                    {/* Status dot */}
                    <div className={cn('h-2 w-2 rounded-full shrink-0',
                      !p.isMenuItem ? 'bg-zinc-600' :
                      p.availableInMenu ? 'bg-green-500' : 'bg-amber-500'
                    )} />

                    {/* Name & info */}
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium truncate', !p.isMenuItem && 'text-muted-foreground')}>{p.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {p.isMenuItem && p.preparationArea && (
                          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase', AREA_BADGE[p.preparationArea] ?? 'bg-zinc-700 text-zinc-300')}>
                            {p.preparationArea}
                          </span>
                        )}
                        {p.isMenuItem && p.prepTimeMinutes && (
                          <span className="text-[10px] text-muted-foreground">{p.prepTimeMinutes} min</span>
                        )}
                        <span className="text-[10px] text-muted-foreground">Stock: {p.stock}</span>
                      </div>
                    </div>

                    {/* Price */}
                    <p className="text-sm font-semibold shrink-0">
                      {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(p.price)}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {p.isMenuItem ? (
                        <>
                          <button
                            onClick={() => toggleAvail(p)}
                            title={p.availableInMenu ? 'Ocultar del menú hoy' : 'Poner disponible'}
                            className="rounded-md p-1.5 hover:bg-accent transition-colors"
                          >
                            {p.availableInMenu
                              ? <ToggleRight className="h-4 w-4 text-green-400" />
                              : <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                            }
                          </button>
                          <button onClick={() => openEdit(p)} title="Editar configuración"
                            className="rounded-md p-1.5 hover:bg-accent transition-colors">
                            <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                          <button onClick={() => removeFromMenu(p)} title="Quitar del menú"
                            className="rounded-md p-1.5 hover:bg-accent transition-colors">
                            <X className="h-3.5 w-3.5 text-red-400" />
                          </button>
                        </>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                          <Plus className="h-3.5 w-3.5 mr-1" />Agregar al menú
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {Object.keys(grouped).length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <BookOpen className="h-10 w-10 opacity-20" />
              <p>No hay productos que coincidan con los filtros.</p>
            </div>
          )}
        </div>
      )}

      {/* Edit / Add to menu modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold">{editing.name}</p>
                <p className="text-xs text-muted-foreground">{editing.category}</p>
              </div>
              <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Área de preparación *</label>
                <select className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                  value={form.preparationArea} onChange={e => setForm(f => ({ ...f, preparationArea: e.target.value }))}>
                  <option value="cocina">Cocina</option>
                  <option value="bar">Bar</option>
                  <option value="ambos">Ambos (cocina y bar)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Tiempo de preparación (minutos)</label>
                <input type="number" min={1} max={120}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                  value={form.prepTimeMinutes} onChange={e => setForm(f => ({ ...f, prepTimeMinutes: e.target.value }))}
                  placeholder="Opcional — ej. 15" />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button size="sm" onClick={saveSettings} disabled={saving}>
                {saving ? 'Guardando...' : editing.isMenuItem ? 'Guardar cambios' : 'Agregar al menú'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MESAS TAB ────────────────────────────────────────────────────────────────
function MesasTab() {
  const [tables, setTables] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ number: '', capacity: '4', area: '', notes: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const r = await api.getRestbarTables()
    if (r.success) setTables(r.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const save = async () => {
    const data = { number: form.number, capacity: Number(form.capacity), area: form.area || undefined, notes: form.notes || undefined }
    const r = editing
      ? await api.updateRestbarTable(editing.id, data)
      : await api.createRestbarTable(data)
    if (r.success) { toast.success(editing ? 'Mesa actualizada' : 'Mesa creada'); setShowForm(false); setEditing(null); setForm({ number: '', capacity: '4', area: '', notes: '' }); load() }
    else toast.error(r.error)
  }

  const del = async (id: string) => {
    if (!confirm('¿Eliminar esta mesa?')) return
    const r = await api.deleteRestbarTable(id)
    if (r.success) { toast.success('Mesa eliminada'); load() }
    else toast.error(r.error)
  }

  const openEdit = (t: any) => {
    setEditing(t)
    setForm({ number: t.number, capacity: String(t.capacity), area: t.area ?? '', notes: t.notes ?? '' })
    setShowForm(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Mesas ({tables.length})</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="h-3.5 w-3.5" /></Button>
          <Button size="sm" onClick={() => { setEditing(null); setForm({ number: '', capacity: '4', area: '', notes: '' }); setShowForm(true) }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Nueva mesa
          </Button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">{editing ? 'Editar mesa' : 'Nueva mesa'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Número / Nombre *</label>
              <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} placeholder="1, Terraza 2, VIP..." />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Capacidad</label>
              <input type="number" className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Zona</label>
              <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} placeholder="Interior, Terraza, VIP..." />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Notas</label>
              <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button size="sm" onClick={save} disabled={!form.number}>Guardar</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {tables.map(t => (
            <div key={t.id} className={cn('relative rounded-xl border-2 p-3 cursor-pointer transition-all hover:scale-[1.02]', TABLE_STATUS_COLORS[t.status] ?? TABLE_STATUS_COLORS.libre)}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-bold">Mesa {t.number}</p>
                  <p className="text-xs opacity-70"><Users className="inline h-3 w-3 mr-0.5" />{t.capacity} personas</p>
                  {t.area && <p className="text-[10px] opacity-60 mt-0.5">{t.area}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => openEdit(t)} className="rounded p-0.5 hover:bg-white/10"><Edit2 className="h-3 w-3" /></button>
                  <button onClick={() => del(t.id)} className="rounded p-0.5 hover:bg-white/10"><Trash2 className="h-3 w-3" /></button>
                </div>
              </div>
              <div className="mt-2">
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', TABLE_STATUS_COLORS[t.status])}>
                  {t.status}
                </span>
              </div>
              {t.activeOrder && (
                <p className="mt-1 text-[10px] opacity-70">Comanda: {t.activeOrder.orderNumber}</p>
              )}
            </div>
          ))}
          {tables.length === 0 && (
            <div className="col-span-full flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <TableProperties className="h-8 w-8 opacity-30" />
              <p className="text-sm">No hay mesas. Crea la primera.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── COMANDAS TAB ─────────────────────────────────────────────────────────────
function ComandasTab({ role: _role }: { role: string }) {
  const [tables, setTables]           = useState<any[]>([])
  const [menu, setMenu]               = useState<any[]>([])
  const [selected, setSelected]       = useState<any>(null)
  const [selectedTable, setSelectedTable] = useState<any>(null)
  const [loading, setLoading]         = useState(true)
  const [guestsCount, setGuestsCount] = useState('2')
  const [creating, setCreating]       = useState(false)
  const [sending, setSending]         = useState(false)
  const [menuView, setMenuView]       = useState<'categories' | 'products'>('categories')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [addingId, setAddingId]       = useState<string | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [noteText, setNoteText]       = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [tablesR, menuR] = await Promise.all([
      api.getRestbarTables(),
      api.getRestbarMenu(),
    ])
    if (tablesR.success) setTables(tablesR.data ?? [])
    if (menuR.success) setMenu((menuR.data ?? []).filter((m: any) => m.availableInMenu))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const refreshSelected = useCallback(async (orderId: string) => {
    const r = await api.getRestbarOrder(orderId)
    if (r.success) setSelected(r.data)
  }, [])

  const selectTable = async (table: any) => {
    if (table.status === 'inactiva') return
    setSelectedTable(table)
    setSelected(null)
    setMenuView('categories')
    setActiveCategory(null)
    if (table.activeOrder?.id) {
      const r = await api.getRestbarOrder(table.activeOrder.id)
      if (r.success) setSelected(r.data)
    }
  }

  const createOrder = async () => {
    if (!selectedTable) return
    setCreating(true)
    const r = await api.createRestbarOrder({ tableId: selectedTable.id, guestsCount: Number(guestsCount) })
    if (r.success) {
      toast.success('Comanda abierta')
      setSelected(r.data)
      load()
    } else toast.error(r.error)
    setCreating(false)
  }

  const addItem = async (menuItem: any) => {
    if (!selected) return
    setAddingId(menuItem.id)
    const r = await api.addRestbarOrderItem(selected.id, { menuItemId: menuItem.id, quantity: 1 })
    if (r.success) { toast.success(`${menuItem.name} agregado`); refreshSelected(selected.id) }
    else toast.error(r.error)
    setAddingId(null)
  }

  const increaseItem = async (item: any) => {
    if (!selected) return
    const r = await api.updateRestbarOrderItem(selected.id, item.id, { quantity: item.quantity + 1 })
    if (r.success) refreshSelected(selected.id)
    else toast.error(r.error)
  }

  const decreaseItem = async (item: any) => {
    if (!selected) return
    if (item.quantity <= 1) {
      const r = await api.removeRestbarOrderItem(selected.id, item.id)
      if (r.success) refreshSelected(selected.id)
      else toast.error(r.error)
    } else {
      const r = await api.updateRestbarOrderItem(selected.id, item.id, { quantity: item.quantity - 1 })
      if (r.success) refreshSelected(selected.id)
      else toast.error(r.error)
    }
  }

  const removeItem = async (itemId: string) => {
    if (!selected) return
    const r = await api.removeRestbarOrderItem(selected.id, itemId)
    if (r.success) refreshSelected(selected.id)
    else toast.error(r.error)
  }

  const saveNote = async () => {
    if (!selected || !editingNoteId) return
    const r = await api.updateRestbarOrderItem(selected.id, editingNoteId, { itemNotes: noteText || undefined })
    if (r.success) { setEditingNoteId(null); refreshSelected(selected.id) }
    else toast.error(r.error)
  }

  const sendOrder = async () => {
    if (!selected) return
    setSending(true)
    const r = await api.sendRestbarOrderToKitchen(selected.id)
    if (r.success) { toast.success('Pedido enviado a cocina/bar'); refreshSelected(selected.id); load() }
    else toast.error(r.error)
    setSending(false)
  }

  // Menu helpers
  const categories = [...new Set(menu.map(m => m.category || m.preparationArea || 'General'))]
  const CAT_COLORS = [
    'from-pink-500 to-rose-400', 'from-violet-500 to-purple-400',
    'from-blue-500 to-cyan-400',  'from-emerald-500 to-green-400',
    'from-orange-500 to-amber-400','from-indigo-500 to-blue-400',
    'from-teal-500 to-cyan-400',   'from-red-500 to-orange-400',
  ]
  const catColor = (name: string) => {
    let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % CAT_COLORS.length
    return CAT_COLORS[h]
  }
  const productsByCategory = (cat: string) =>
    menu.filter(m => (m.category || m.preparationArea || 'General') === cat)

  const pendingItems = selected?.items?.filter((i: any) => i.status === 'pendiente') ?? []

  // ── Mesas grid (initial view) ─────────────────────────────────────────────────
  if (!selectedTable) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Todas las mesas ({tables.length})</h2>
          <Button size="sm" variant="ghost" onClick={load}><RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /></Button>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : tables.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <TableProperties className="h-10 w-10 opacity-30" />
            <p className="text-sm">Sin mesas configuradas. Créalas en la pestaña Mesas.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {tables.map(t => {
              const isOccupied = t.status === 'ocupada'
              const isInactive = t.status === 'inactiva'
              return (
                <button key={t.id} onClick={() => selectTable(t)} disabled={isInactive}
                  className={cn(
                    'rounded-xl border-2 p-3 text-left transition-all hover:scale-[1.02] active:scale-[0.98] flex flex-col gap-2',
                    isOccupied  ? 'border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10' :
                    isInactive  ? 'border-border opacity-40 cursor-not-allowed' :
                                  'border-border hover:border-primary/40 hover:bg-primary/5'
                  )}>
                  <div className="flex items-start justify-between">
                    <p className="font-bold text-sm">Mesa {t.number}</p>
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                      isOccupied ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-700/50 text-zinc-400'
                    )}>
                      {isOccupied ? 'Ocupada' : t.status === 'reservada' ? 'Reservada' : 'Libre'}
                    </span>
                  </div>
                  {t.area && <p className="text-[10px] text-muted-foreground">{t.area}</p>}
                  {isOccupied && t.activeOrder ? (
                    <div className="mt-auto">
                      <p className="text-[10px] text-muted-foreground font-medium">{t.activeOrder.orderNumber}</p>
                      <p className="text-sm font-bold text-amber-400">{formatCOP(t.activeOrder.total ?? 0)}</p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground mt-auto">Toca para abrir comanda</p>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── 3-panel layout once a table is selected ───────────────────────────────────
  return (
    <div className="flex gap-3 h-[calc(100vh-14rem)] min-h-[500px]">

      {/* ── Panel 1: Mesas (narrow sidebar) ── */}
      <div className="w-36 shrink-0 flex flex-col gap-1.5 overflow-y-auto pr-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Mesas</span>
          <button onClick={load} className="text-muted-foreground hover:text-foreground"><RefreshCw className="h-3 w-3" /></button>
        </div>
        {tables.map(t => {
          const isOcc = t.status === 'ocupada'
          const isSel = selectedTable?.id === t.id
          return (
            <button key={t.id} onClick={() => selectTable(t)} disabled={t.status === 'inactiva'}
              className={cn(
                'rounded-lg border p-2 text-left transition-all text-xs',
                isSel   ? 'border-primary bg-primary/10 text-primary font-semibold' :
                isOcc   ? 'border-amber-500/40 bg-amber-500/5 text-amber-400 hover:bg-amber-500/10' :
                          'border-border hover:bg-accent text-foreground',
                t.status === 'inactiva' && 'opacity-40 cursor-not-allowed'
              )}>
              <p className="font-bold">Mesa {t.number}</p>
              {t.area && <p className="text-[10px] opacity-60 truncate">{t.area}</p>}
              {isOcc && t.activeOrder && <p className="text-[10px] font-medium mt-0.5">{formatCOP(t.activeOrder.total ?? 0)}</p>}
            </button>
          )
        })}
      </div>

      {/* ── Panel 2: Menú (categories → products) ── */}
      <div className="w-72 shrink-0 flex flex-col border border-border rounded-xl overflow-hidden bg-card">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5 shrink-0">
          {menuView === 'products' && (
            <button onClick={() => { setMenuView('categories'); setActiveCategory(null) }}
              className="rounded p-0.5 hover:bg-accent text-muted-foreground">
              <ChefHat className="h-3.5 w-3.5" />
            </button>
          )}
          <UtensilsCrossed className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-sm font-semibold truncate">
            {menuView === 'categories' ? 'Menú' : activeCategory}
          </span>
          {menuView === 'products' && (
            <button onClick={() => { setMenuView('categories'); setActiveCategory(null) }}
              className="ml-auto text-[10px] text-muted-foreground hover:text-foreground">← volver</button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-2">
          {!selected ? (
            /* No order yet */
            <div className="flex flex-col items-center gap-3 py-8 text-center px-2">
              <UtensilsCrossed className="h-8 w-8 text-muted-foreground opacity-30" />
              <p className="text-xs text-muted-foreground">Abre la comanda primero para ver el menú</p>
            </div>
          ) : menuView === 'categories' ? (
            <div className="grid grid-cols-2 gap-1.5">
              {categories.map(cat => {
                const items = productsByCategory(cat)
                const minPrice = Math.min(...items.map(i => i.price ?? 0))
                return (
                  <button key={cat}
                    onClick={() => { setActiveCategory(cat); setMenuView('products') }}
                    className="rounded-lg border border-border bg-background p-2.5 text-left hover:bg-accent/50 transition-all hover:scale-[1.02] active:scale-[0.98]">
                    <div className={cn('h-6 w-6 rounded-md bg-gradient-to-br mb-1.5 flex items-center justify-center', catColor(cat))}>
                      <UtensilsCrossed className="h-3 w-3 text-white" />
                    </div>
                    <p className="text-xs font-bold leading-tight truncate">{cat}</p>
                    <p className="text-[10px] text-muted-foreground">{items.length} prod.</p>
                    {minPrice > 0 && <p className="text-[10px] text-primary font-medium">{formatCOP(minPrice)}</p>}
                  </button>
                )
              })}
              {categories.length === 0 && (
                <p className="col-span-2 text-xs text-muted-foreground text-center py-6">Sin productos disponibles en el menú hoy</p>
              )}
            </div>
          ) : (
            /* Products list */
            <div className="space-y-1.5">
              {productsByCategory(activeCategory!).map(item => (
                <div key={item.id} className="flex items-center gap-2 rounded-lg border border-border bg-background p-2 hover:bg-accent/30 transition-colors">
                  {/* Image */}
                  <div className="h-10 w-10 rounded-lg overflow-hidden shrink-0 bg-accent">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <UtensilsCrossed className="h-4 w-4 text-muted-foreground opacity-40" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{item.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] font-bold text-primary">{formatCOP(item.price ?? 0)}</span>
                      {item.prepTimeMinutes && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />{item.prepTimeMinutes}m
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => addItem(item)} disabled={addingId === item.id}
                    className="h-7 w-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Panel 3: Orden ── */}
      <div className="flex-1 flex flex-col border border-border rounded-xl overflow-hidden bg-card min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5 shrink-0">
          <div className="min-w-0">
            {selected ? (
              <>
                <p className="font-bold text-sm">{selected.orderNumber}</p>
                <p className="text-xs text-muted-foreground truncate">Mesa {selected.tableNumber} · {selected.guestsCount} pers. · {selected.waiterName}</p>
              </>
            ) : (
              <p className="font-bold text-sm">Mesa {selectedTable.number}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => { setSelectedTable(null); setSelected(null) }}
              className="rounded-lg p-1.5 hover:bg-accent text-muted-foreground transition-colors" title="Cerrar">
              <X className="h-4 w-4" />
            </button>
            {selected && (
              <Button size="sm" onClick={sendOrder} disabled={sending || pendingItems.length === 0}>
                <Send className="h-3.5 w-3.5 mr-1" />
                {sending ? 'Enviando...' : `Enviar${pendingItems.length ? ` (${pendingItems.length})` : ''}`}
              </Button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {!selected ? (
            /* No order → create form */
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <UtensilsCrossed className="h-10 w-10 text-muted-foreground opacity-30" />
              <div>
                <p className="font-semibold text-sm">Mesa {selectedTable.number} disponible</p>
                <p className="text-xs text-muted-foreground mt-1">Indica el número de comensales para abrir la comanda</p>
              </div>
              <div className="flex items-center gap-3 w-full max-w-xs">
                <label className="text-sm text-muted-foreground shrink-0">Comensales:</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => setGuestsCount(v => String(Math.max(1, Number(v) - 1)))}
                    className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-accent">
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-8 text-center font-bold text-lg">{guestsCount}</span>
                  <button onClick={() => setGuestsCount(v => String(Number(v) + 1))}
                    className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-accent">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <Button onClick={createOrder} disabled={creating} className="w-full max-w-xs">
                {creating ? 'Abriendo...' : 'Abrir comanda'}
              </Button>
            </div>
          ) : !selected.items?.length ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <UtensilsCrossed className="h-8 w-8 opacity-30" />
              <p className="text-sm">Sin ítems. Selecciona productos del menú.</p>
            </div>
          ) : (
            selected.items.map((item: any, idx: number) => (
              <div key={item.id} className="rounded-lg border border-border overflow-hidden">
                <div className="flex items-center gap-2.5 p-2.5">
                  <div className="h-5 w-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">{idx + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.menuItemName}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', ITEM_STATUS[item.status]?.color ?? 'bg-zinc-700 text-zinc-300')}>
                        {ITEM_STATUS[item.status]?.label ?? item.status}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatCOP(item.unitPrice)} × {item.quantity} = <b>{formatCOP(item.subtotal)}</b></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {item.status === 'pendiente' ? (
                      <>
                        <button onClick={() => decreaseItem(item)} className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-accent text-muted-foreground"><Minus className="h-3 w-3" /></button>
                        <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                        <button onClick={() => increaseItem(item)} className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-accent text-muted-foreground"><Plus className="h-3 w-3" /></button>
                        <button onClick={() => removeItem(item.id)} className="h-6 w-6 rounded bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 ml-0.5"><Trash2 className="h-3 w-3" /></button>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">×{item.quantity}</span>
                    )}
                  </div>
                </div>
                {/* Notes */}
                {editingNoteId === item.id ? (
                  <div className="border-t border-border bg-accent/10 p-2 flex gap-2">
                    <input autoFocus className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
                      placeholder="Instrucciones especiales..." value={noteText} onChange={e => setNoteText(e.target.value)} />
                    <button onClick={() => setEditingNoteId(null)} className="text-xs text-muted-foreground px-1.5 hover:text-foreground">✕</button>
                    <button onClick={saveNote} className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">OK</button>
                  </div>
                ) : item.itemNotes ? (
                  <div className="border-t border-amber-500/20 bg-amber-500/5 px-3 py-1.5 flex items-center gap-2">
                    <span className="text-xs text-amber-400 flex-1 italic truncate">{item.itemNotes}</span>
                    <button onClick={() => { setEditingNoteId(item.id); setNoteText(item.itemNotes ?? '') }} className="text-amber-400 hover:text-amber-300 shrink-0"><Edit2 className="h-3 w-3" /></button>
                  </div>
                ) : item.status === 'pendiente' ? (
                  <div className="border-t border-border px-3 py-1">
                    <button onClick={() => { setEditingNoteId(item.id); setNoteText('') }}
                      className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
                      <Plus className="h-2.5 w-2.5" /> Agregar nota
                    </button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>

        {/* Footer total */}
        {selected && (
          <div className="border-t border-border px-4 py-3 flex items-center justify-between shrink-0 bg-card">
            <span className="text-sm font-semibold text-muted-foreground">Total</span>
            <span className="text-xl font-bold text-primary">{formatCOP(selected.total)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── COCINA / BAR DISPLAY ─────────────────────────────────────────────────────
function AreaDisplayTab({ area }: { area: 'cocina' | 'bar' }) {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const r = area === 'cocina' ? await api.getKitchenDisplay() : await api.getBarDisplay()
    if (r.success) setOrders(r.data ?? [])
    setLoading(false)
  }, [area])

  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t) }, [load])

  const updateStatus = async (itemId: string, status: string) => {
    const r = await api.updateRestbarItemStatus(itemId, status)
    if (r.success) { toast.success('Estado actualizado'); load() }
    else toast.error(r.error)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {area === 'cocina' ? <ChefHat className="h-5 w-5 text-primary" /> : <GlassWater className="h-5 w-5 text-primary" />}
          <h2 className="font-semibold">{area === 'cocina' ? 'Pantalla Cocina' : 'Pantalla Bar'}</h2>
          <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">{orders.reduce((a, o) => a + o.items.length, 0)} ítems</span>
        </div>
        <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="h-3.5 w-3.5 mr-1" />Actualizar</Button>
      </div>
      <p className="text-xs text-muted-foreground">Se actualiza automáticamente cada 20 s</p>

      {loading ? (
        <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
          <CheckCircle2 className="h-10 w-10 opacity-30" />
          <p>Todo al día — sin pedidos pendientes</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map(o => (
            <div key={o.orderId} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border bg-accent/30 px-3 py-2">
                <div>
                  <p className="font-bold text-sm">{o.orderNumber} — Mesa {o.tableNumber}</p>
                  <p className="text-xs text-muted-foreground">{o.waiterName}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {o.openedAt ? new Date(o.openedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '—'}
                </div>
              </div>
              {(() => {
                let displayNote = o.orderNotes as string | undefined
                if (displayNote) {
                  try {
                    const parsed = JSON.parse(displayNote)
                    // If it's the internal guest-list structure, extract actual note or hide it
                    displayNote = parsed?.note || undefined
                  } catch { /* not JSON — show as-is */ }
                }
                return displayNote ? (
                  <div className="border-b border-border px-3 py-2 bg-amber-500/5">
                    <p className="text-xs text-amber-400 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{displayNote}</p>
                  </div>
                ) : null
              })()}
              <div className="p-3 space-y-2">
                {o.items.map((item: any) => (
                  <div key={item.itemId} className="rounded-md border border-border p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{item.quantity}× {item.name}</p>
                        {item.notes && <p className="text-xs text-amber-400 mt-0.5 italic">{item.notes}</p>}
                      </div>
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0', ITEM_STATUS[item.status]?.color ?? 'bg-zinc-700 text-zinc-300')}>
                        {ITEM_STATUS[item.status]?.label}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-1">
                      {item.status === 'pendiente' && (
                        <button onClick={() => updateStatus(item.itemId, 'en_preparacion')}
                          className="flex-1 rounded-md bg-amber-500/15 text-amber-400 text-xs py-1 hover:bg-amber-500/25 transition-colors">
                          Preparando
                        </button>
                      )}
                      {item.status === 'en_preparacion' && (
                        <button onClick={() => updateStatus(item.itemId, 'listo')}
                          className="flex-1 rounded-md bg-green-500/15 text-green-400 text-xs py-1 hover:bg-green-500/25 transition-colors flex items-center justify-center gap-1">
                          <Check className="h-3 w-3" /> Listo
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── CAJA TAB ─────────────────────────────────────────────────────────────────

const CAJA_GUEST_COLORS = [
  'border-violet-500/40 bg-violet-500/10 text-violet-400',
  'border-blue-500/40 bg-blue-500/10 text-blue-400',
  'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  'border-pink-500/40 bg-pink-500/10 text-pink-400',
  'border-amber-500/40 bg-amber-500/10 text-amber-400',
  'border-cyan-500/40 bg-cyan-500/10 text-cyan-400',
]

const PAY_METHODS = [
  { id: 'efectivo',      label: 'Efectivo',      Icon: Banknote },
  { id: 'tarjeta',       label: 'Tarjeta',       Icon: CreditCard },
  { id: 'nequi',         label: 'Nequi',         Icon: Smartphone },
  { id: 'bancolombia',   label: 'Bancolombia',   Icon: ArrowLeftRight },
  { id: 'bbva',          label: 'BBVA',          Icon: ArrowLeftRight },
  { id: 'transferencia', label: 'Transferencia', Icon: Layers },
]

function CajaTab() {
  const [orders, setOrders]         = useState<any[]>([])
  const [selected, setSelected]     = useState<any>(null)
  const [breakdown, setBreakdown]   = useState<any>(null)
  const [loading, setLoading]       = useState(true)
  const [paying, setPaying]         = useState(false)
  // payMode: null=not chosen yet, 'table'=whole table, 'individual'=per guest
  const [payMode, setPayMode]       = useState<null | 'table' | 'individual'>(null)
  // payTarget: null=whole table, 'general'=no-guest items, number=specific guest
  const [payTarget, setPayTarget]   = useState<null | 'general' | number>(null)
  const [payMethod, setPayMethod]   = useState('efectivo')
  const [amountPaid, setAmountPaid] = useState('')
  const [detailOpen, setDetailOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await api.getRestbarOrders()
    if (r.success) setOrders((r.data ?? []).filter((o: any) => ['abierta','en_proceso','lista','entregada'].includes(o.status)))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const selectOrder = async (id: string) => {
    const [orderR, bdR] = await Promise.all([
      api.getRestbarOrder(id),
      api.getRestbarGuestBreakdown(id),
    ])
    if (orderR.success) setSelected(orderR.data)
    if (bdR.success) {
      setBreakdown(bdR.data)
      // If no guest split → auto table mode; else wait for user to choose
      setPayMode((bdR.data?.guests?.length ?? 0) > 0 ? null : 'table')
    }
    setPayTarget(null)
    setAmountPaid('')
  }

  const clearSelection = () => {
    setSelected(null); setBreakdown(null)
    setPayTarget(null); setPayMode(null); setAmountPaid('')
  }

  const refreshBreakdown = async () => {
    if (!selected?.id) return
    const [orderR, bdR] = await Promise.all([
      api.getRestbarOrder(selected.id),
      api.getRestbarGuestBreakdown(selected.id),
    ])
    if (orderR.success) setSelected(orderR.data)
    if (bdR.success)    setBreakdown(bdR.data)
    setPayTarget(null); setAmountPaid('')
  }

  const targetAmount = (() => {
    if (!breakdown) return selected?.total ?? 0
    if (payTarget === null) return selected?.total ?? 0
    const group = breakdown.guests?.find((g: any) =>
      payTarget === 'general' ? g.guestNumber == null : g.guestNumber === payTarget
    )
    return group?.subtotal ?? 0
  })()

  const amountNum = Number(amountPaid)
  const change    = Math.max(0, amountNum - targetAmount)
  const shortage  = amountNum > 0 && amountNum < targetAmount ? targetAmount - amountNum : 0

  const playSuccess = () => {
    try {
      const ctx  = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(880,  ctx.currentTime)
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1)
      gain.gain.setValueAtTime(0.12, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
      osc.start(); osc.stop(ctx.currentTime + 0.35)
    } catch {}
  }

  const processPayment = async () => {
    if (!selected) return
    const paid = Number(amountPaid)
    if (paid < targetAmount) { toast.error('El monto recibido es menor al total a cobrar'); return }
    setPaying(true)
    const guestNumber = payTarget === null ? undefined : payTarget === 'general' ? null : payTarget
    const r = await api.processRestbarPayment(selected.id, {
      paymentMethod: payMethod as any,
      amountPaid: paid,
      guestNumber,
    })
    if (r.success) {
      playSuccess()
      const who = payTarget === null ? 'Toda la mesa'
                : payTarget === 'general' ? 'Mesa general'
                : breakdown?.guests?.find((g: any) => g.guestNumber === payTarget)?.guestName ?? `Comensal ${payTarget}`
      toast.success(`✅ ${who} — Factura ${r.data.invoiceNumber}. Cambio: ${formatCOP(r.data.changeAmount)}`)
      if (r.data.closed) {
        clearSelection(); load()
      } else {
        await refreshBreakdown()
        setPayTarget(null); setAmountPaid('')
      }
    } else toast.error(r.error ?? 'Error al procesar pago')
    setPaying(false)
  }

  const hasSplit    = (breakdown?.guests?.length ?? 0) > 0
  const activeItems = selected?.items?.filter((i: any) => i.status !== 'cancelado') ?? []
  const posActive   = payMode === 'table' || (payMode === 'individual' && payTarget !== null)

  // ── Shared sub-components ──

  /** Left column: list of open orders */
  const OrderList = (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between shrink-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Mesas activas ({orders.length})
        </p>
        <button onClick={load}
          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <CheckCircle2 className="h-10 w-10 opacity-20" />
          <p className="text-sm text-center">Sin comandas pendientes de pago</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
          {orders.map(o => (
            <button key={o.id} onClick={() => selectOrder(o.id)}
              className={cn(
                'w-full rounded-xl border-2 p-4 text-left transition-all group active:scale-[0.98]',
                selected?.id === o.id
                  ? 'border-green-500/60 bg-green-500/8 shadow-[0_0_16px_rgba(34,197,94,0.12)]'
                  : 'border-border hover:border-green-500/30 hover:shadow-[0_0_12px_rgba(34,197,94,0.08)]',
              )}>
              <p className="text-2xl font-black leading-none">Mesa {o.tableNumber}</p>
              <p className="text-xs text-muted-foreground mt-1">{o.guestsCount} personas · {o.orderNumber}</p>
              <p className="text-xl font-bold text-green-400 mt-2 tabular-nums">{formatCOP(o.total)}</p>
              <div className="flex items-center gap-1.5 mt-2">
                <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[11px] text-amber-400 font-medium capitalize">{o.status.replace('_', ' ')}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )

  /** Center column: order detail + mode selector + guest breakdown */
  const OrderDetail = !selected ? (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
      <Receipt className="h-14 w-14 opacity-10" />
      <p className="text-sm">Selecciona una mesa para ver el detalle</p>
    </div>
  ) : (
    <div className="flex flex-col gap-3 overflow-y-auto pr-0.5 h-full">

      {/* ── Header ── */}
      <div className="rounded-2xl border border-border bg-card p-4 shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-2xl font-black leading-none">Mesa {selected.tableNumber}</p>
            <p className="text-xs text-muted-foreground mt-1">{selected.orderNumber} · {selected.waiterName}</p>
            {selected.guestsCount > 0 && (
              <p className="text-xs text-muted-foreground">{selected.guestsCount} persona{selected.guestsCount !== 1 ? 's' : ''}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total comanda</p>
            <p className="text-2xl font-black text-green-400 tabular-nums">{formatCOP(selected.total)}</p>
          </div>
        </div>
      </div>

      {/* ── Selector de modo (solo si hay comensales) ── */}
      {hasSplit && payMode === null && (
        <div className="rounded-2xl border-2 border-dashed border-border bg-card/50 p-5 space-y-3 shrink-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground text-center">¿Cómo deseas cobrar?</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { setPayMode('table'); setPayTarget(null); setAmountPaid(String(selected.total)) }}
              className="flex flex-col items-center gap-2.5 rounded-xl border-2 border-border bg-card p-4 hover:border-green-500/50 hover:bg-green-500/5 transition-all active:scale-[0.98] group"
            >
              <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                <Receipt className="h-5 w-5 text-green-400" />
              </div>
              <div className="text-center">
                <p className="font-bold text-sm">Toda la mesa</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{formatCOP(selected.total)}</p>
              </div>
            </button>
            <button
              onClick={() => { setPayMode('individual'); setPayTarget(null); setAmountPaid('') }}
              className="flex flex-col items-center gap-2.5 rounded-xl border-2 border-border bg-card p-4 hover:border-primary/50 hover:bg-primary/5 transition-all active:scale-[0.98] group"
            >
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-bold text-sm">Por comensal</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{breakdown?.guests?.length ?? 0} personas</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ── Vista: toda la mesa (no split o payMode=table) ── */}
      {(!hasSplit || payMode === 'table') && (
        <div className="rounded-xl border border-border bg-card overflow-hidden shrink-0">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-accent/30">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Todos los productos · {activeItems.length} ítems
            </p>
            {hasSplit && (
              <button onClick={() => { setPayMode('individual'); setPayTarget(null); setAmountPaid('') }}
                className="text-[11px] text-primary font-semibold hover:underline flex items-center gap-1">
                <Users className="h-3 w-3" /> Cobrar individual
              </button>
            )}
          </div>
          <div className="divide-y divide-border">
            {activeItems.map((item: any) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-sm font-black text-muted-foreground/40 w-7 text-center shrink-0">{item.quantity}×</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{item.menuItemName}</p>
                  {item.itemNotes && <p className="text-[11px] text-muted-foreground truncate">{item.itemNotes}</p>}
                </div>
                <p className="text-sm font-bold tabular-nums shrink-0">{formatCOP(item.subtotal)}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between px-4 py-3 bg-green-950/40 border-t border-green-500/20">
            <p className="text-sm font-semibold text-green-400/60">Total comanda</p>
            <p className="text-xl font-black text-green-400 tabular-nums">{formatCOP(selected.total)}</p>
          </div>
        </div>
      )}

      {/* ── Vista: cobro individual por comensal ── */}
      {hasSplit && payMode === 'individual' && (
        <div className="space-y-2">
          {/* Back link */}
          <button onClick={() => { setPayMode(null); setPayTarget(null); setAmountPaid('') }}
            className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground uppercase tracking-wider transition-colors px-1">
            <ChevronLeft className="h-3.5 w-3.5" /> Volver al selector
          </button>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1">Consumo por comensal</p>

          {breakdown.guests.map((g: any) => {
            const colorCls = g.guestNumber != null
              ? CAJA_GUEST_COLORS[(g.guestNumber - 1) % CAJA_GUEST_COLORS.length]
              : 'border-zinc-500/40 bg-zinc-500/10 text-zinc-400'
            const isSelected = payTarget === (g.guestNumber ?? 'general')
            return (
              <div key={g.guestNumber ?? 'general'}
                className={cn(
                  'rounded-2xl border-2 overflow-hidden transition-all',
                  g.paid ? 'opacity-60 border-green-500/30' : isSelected ? 'border-primary shadow-[0_0_16px_rgba(99,102,241,0.15)]' : 'border-border',
                )}>
                {/* Guest header */}
                <div className={cn('flex items-center justify-between px-4 py-3 border-b', colorCls, 'border-current/20')}>
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-bold text-sm">{g.guestName}</span>
                    {g.paid && (
                      <span className="text-[10px] bg-green-500/30 text-green-300 rounded-full px-2 py-0.5 font-semibold">✓ Pagado</span>
                    )}
                  </div>
                  <span className={cn('font-black text-base tabular-nums', g.paid && 'line-through opacity-40')}>
                    {formatCOP(g.subtotal)}
                  </span>
                </div>

                {/* Items */}
                <div className="bg-card divide-y divide-border/40">
                  {(g.items ?? []).map((item: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2">
                      <span className="text-xs font-black text-muted-foreground/40 w-5 text-center shrink-0">{item.quantity}×</span>
                      <p className="flex-1 text-sm text-muted-foreground">{item.menuItemName}</p>
                      <p className="text-sm font-semibold tabular-nums shrink-0">{formatCOP(item.subtotal)}</p>
                    </div>
                  ))}
                </div>

                {/* Cobrar button (if not paid) */}
                {!g.paid && (
                  <div className="px-3 py-2.5 bg-card border-t border-border/40">
                    <button
                      onClick={() => {
                        const target = g.guestNumber ?? 'general'
                        setPayTarget(target)
                        setAmountPaid(String(g.subtotal))
                      }}
                      className={cn(
                        'w-full rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-primary/10 text-primary hover:bg-primary/20',
                      )}
                    >
                      {isSelected ? <Check className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      {isSelected ? 'Seleccionado — ir al POS' : `Cobrar a ${g.guestName}`}
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {/* Total mesa */}
          <div className="flex items-center justify-between rounded-xl bg-green-950/40 border border-green-500/20 px-4 py-3">
            <p className="text-sm font-semibold text-green-400/60">Total mesa</p>
            <p className="text-xl font-black text-green-400 tabular-nums">{formatCOP(selected.total)}</p>
          </div>

          {/* Option: charge all remaining */}
          {breakdown.guests.some((g: any) => !g.paid) && (
            <button
              onClick={() => { setPayMode('table'); setPayTarget(null); setAmountPaid(String(selected.total)) }}
              className="w-full rounded-xl border border-dashed border-green-500/30 py-2.5 text-sm font-semibold text-green-400 hover:bg-green-500/5 transition-colors flex items-center justify-center gap-2">
              <Receipt className="h-4 w-4" /> Cobrar toda la mesa de una vez
            </button>
          )}
        </div>
      )}
    </div>
  )

  /** Right column: POS terminal */
  const posLabel = payMode === 'table' ? 'Mesa completa'
    : payTarget === 'general' ? 'Mesa general'
    : payTarget != null ? (breakdown?.guests?.find((g: any) => g.guestNumber === payTarget)?.guestName ?? `Comensal ${payTarget}`)
    : ''

  const POSTerminal = !selected ? (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
      <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center space-y-3">
        <DollarSign className="h-10 w-10 mx-auto opacity-20" />
        <p className="text-sm leading-relaxed">Selecciona una mesa<br />para cobrar</p>
      </div>
    </div>
  ) : !posActive ? (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
      <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center space-y-3">
        {payMode === 'individual'
          ? <><Users className="h-10 w-10 mx-auto opacity-20" /><p className="text-sm">Selecciona un comensal<br />para activar el cobro</p></>
          : <><Receipt className="h-10 w-10 mx-auto opacity-20" /><p className="text-sm">Elige cómo deseas cobrar<br />en el panel central</p></>
        }
      </div>
    </div>
  ) : (
    <div className="flex flex-col gap-3 overflow-y-auto pl-0.5 h-full">

      {/* Cobrando a */}
      <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center justify-between shrink-0">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Cobrando a</span>
        <span className="font-bold text-sm text-foreground">{posLabel}</span>
      </div>

      {/* Total display */}
      <div className="rounded-2xl bg-gradient-to-b from-green-900/40 to-green-950/60 border border-green-500/30 p-5 text-center shrink-0">
        <p className="text-[11px] font-bold uppercase tracking-widest text-green-500/60">Total a cobrar</p>
        <p className="text-4xl font-black text-green-300 mt-1 tabular-nums">{formatCOP(targetAmount)}</p>
      </div>

      {/* Payment method */}
      <div className="space-y-2 shrink-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1">Método de pago</p>
        <div className="grid grid-cols-3 gap-2">
          {PAY_METHODS.map(m => (
            <button key={m.id} onClick={() => setPayMethod(m.id)}
              className={cn(
                'rounded-xl border-2 py-2.5 px-1 flex flex-col items-center gap-1 transition-all active:scale-95',
                payMethod === m.id
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border hover:border-primary/40 text-muted-foreground',
              )}>
              <m.Icon className="h-4 w-4" />
              <span className="text-[11px] font-semibold">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Amount input */}
      <div className="space-y-1.5 shrink-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1">Monto recibido</p>
        <input
          type="number"
          inputMode="numeric"
          placeholder="0"
          className="w-full h-20 text-4xl font-black text-center rounded-xl border-2 border-border bg-background focus:border-primary focus:outline-none tabular-nums transition-colors"
          value={amountPaid}
          onChange={e => setAmountPaid(e.target.value)}
        />
      </div>

      {/* Change / shortage */}
      {amountPaid && (
        <div className={cn(
          'rounded-xl border-2 p-4 flex justify-between items-center shrink-0',
          amountNum >= targetAmount ? 'border-green-500/40 bg-green-500/10' : 'border-red-500/40 bg-red-500/10',
        )}>
          <p className={cn('text-xs font-bold uppercase tracking-wider',
            amountNum >= targetAmount ? 'text-green-400' : 'text-red-400')}>
            {amountNum >= targetAmount ? 'Cambio' : 'Falta'}
          </p>
          <p className={cn('text-2xl font-black tabular-nums',
            amountNum >= targetAmount ? 'text-green-400' : 'text-red-400')}>
            {amountNum >= targetAmount ? formatCOP(change) : formatCOP(shortage)}
          </p>
        </div>
      )}

      {/* Cobrar button */}
      <button
        onClick={processPayment}
        disabled={paying || !amountPaid || amountNum < targetAmount}
        className={cn(
          'w-full h-16 rounded-2xl font-black text-xl text-white transition-all shrink-0',
          paying || !amountPaid || amountNum < targetAmount
            ? 'bg-muted text-muted-foreground cursor-not-allowed'
            : 'bg-green-600 hover:bg-green-500 active:scale-[0.98] shadow-lg shadow-green-900/40',
        )}
      >
        {paying ? 'Procesando...' : `Cobrar · ${posLabel}`}
      </button>

      {/* Link to switch mode */}
      {payMode === 'table' && hasSplit && (
        <button onClick={() => { setPayMode('individual'); setPayTarget(null); setAmountPaid('') }}
          className="text-[11px] text-muted-foreground hover:text-foreground text-center transition-colors">
          Cambiar a cobro por comensal
        </button>
      )}
    </div>
  )

  return (
    <>
      {/* ══════════════════ DESKTOP (3 columns) ══════════════════ */}
      <div className="hidden md:grid md:grid-cols-[260px_1fr_320px] md:gap-5" style={{ height: 'calc(100vh - 160px)' }}>
        {/* Col 1 – Mesas */}
        <div className="overflow-y-auto">{OrderList}</div>
        {/* Col 2 – Detalle */}
        <div className="overflow-y-auto">{OrderDetail}</div>
        {/* Col 3 – POS */}
        <div className="flex flex-col overflow-y-auto">{POSTerminal}</div>
      </div>

      {/* ══════════════════ MOBILE (stacked) ══════════════════ */}
      <div className="md:hidden flex flex-col gap-4 pb-4">
        {!selected ? (
          /* List of orders */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Mesas activas ({orders.length})</p>
              <button onClick={load} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground">
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              </button>
            </div>
            {loading ? (
              <div className="flex justify-center py-10"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 opacity-20" />
                <p className="text-sm">Sin comandas pendientes de pago</p>
              </div>
            ) : orders.map(o => (
              <button key={o.id} onClick={() => selectOrder(o.id)}
                className="w-full rounded-xl border-2 border-border p-4 text-left hover:border-green-500/40 transition-all active:scale-[0.98]">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-2xl font-black">Mesa {o.tableNumber}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{o.guestsCount} personas · {o.orderNumber}</p>
                  </div>
                  <p className="text-2xl font-black text-green-400 tabular-nums">{formatCOP(o.total)}</p>
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-[11px] text-amber-400 font-medium capitalize">{o.status.replace('_', ' ')}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          /* Selected order — reuse OrderDetail + POSTerminal stacked */
          <div className="space-y-4 pb-4">
            {/* Back header */}
            <div className="flex items-center gap-3">
              <button onClick={clearSelection}
                className="h-9 w-9 rounded-full bg-accent flex items-center justify-center shrink-0 active:scale-95 transition-transform">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="font-black text-lg">Mesa {selected.tableNumber}</p>
                <p className="text-xs text-muted-foreground">{selected.orderNumber}</p>
              </div>
              <p className="text-xl font-black text-green-400 tabular-nums shrink-0">{formatCOP(selected.total)}</p>
            </div>
            {OrderDetail}
            {posActive && (
              <div className="space-y-3">
                <div className="rounded-2xl bg-gradient-to-b from-green-900/40 to-green-950/60 border border-green-500/30 p-5 text-center">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-green-500/60">Cobrando a · {posLabel}</p>
                  <p className="text-4xl font-black text-green-300 mt-1 tabular-nums">{formatCOP(targetAmount)}</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {PAY_METHODS.map(m => (
                    <button key={m.id} onClick={() => setPayMethod(m.id)}
                      className={cn(
                        'rounded-xl border-2 py-2.5 flex flex-col items-center gap-1 transition-all active:scale-95',
                        payMethod === m.id ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground',
                      )}>
                      <m.Icon className="h-4 w-4" />
                      <span className="text-[11px] font-semibold">{m.label}</span>
                    </button>
                  ))}
                </div>
                <input
                  type="number" inputMode="numeric" placeholder="0"
                  className="w-full h-20 text-4xl font-black text-center rounded-xl border-2 border-border bg-background focus:border-primary focus:outline-none tabular-nums"
                  value={amountPaid} onChange={e => setAmountPaid(e.target.value)}
                />
                {amountPaid && (
                  <div className={cn('rounded-xl border-2 p-4 flex justify-between items-center',
                    amountNum >= targetAmount ? 'border-green-500/40 bg-green-500/10' : 'border-red-500/40 bg-red-500/10')}>
                    <p className={cn('text-sm font-bold', amountNum >= targetAmount ? 'text-green-400' : 'text-red-400')}>
                      {amountNum >= targetAmount ? 'Cambio' : 'Falta'}
                    </p>
                    <p className={cn('text-2xl font-black tabular-nums', amountNum >= targetAmount ? 'text-green-400' : 'text-red-400')}>
                      {amountNum >= targetAmount ? formatCOP(change) : formatCOP(shortage)}
                    </p>
                  </div>
                )}
                <div className="sticky bottom-0 pt-1 pb-2 bg-background/90 backdrop-blur-sm">
                  <button onClick={processPayment}
                    disabled={paying || !amountPaid || amountNum < targetAmount}
                    className={cn('w-full h-14 rounded-2xl font-black text-lg text-white transition-all',
                      paying || !amountPaid || amountNum < targetAmount
                        ? 'bg-muted text-muted-foreground cursor-not-allowed'
                        : 'bg-green-600 active:scale-[0.98] shadow-lg shadow-green-900/40')}>
                    {paying ? 'Procesando...' : `Cobrar · ${posLabel}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ─── REPORTES TAB ─────────────────────────────────────────────────────────────
function ReportesTab() {
  const [summary, setSummary] = useState<any>(null)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await api.getRestbarDailySummary(date)
    if (r.success) setSummary(r.data)
    setLoading(false)
  }, [date])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <input type="date" className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          value={date} onChange={e => setDate(e.target.value)} />
        <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="h-3.5 w-3.5" /></Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : !summary ? (
        <p className="text-sm text-muted-foreground">Sin datos</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Ventas del día',    value: formatCOP(summary.revenue),        color: 'text-green-400' },
              { label: 'Comandas cerradas', value: summary.closedOrders,              color: 'text-blue-400' },
              { label: 'Mesas ocupadas',    value: `${summary.occupiedTables} / ${summary.totalTables}`, color: 'text-amber-400' },
              { label: 'Total comandas',    value: summary.totalOrders,               color: 'text-foreground' },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={cn('text-2xl font-bold mt-1', s.color)}>{s.value}</p>
              </div>
            ))}
          </div>

          {summary.topItems?.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold mb-3">Top 5 ítems vendidos</h3>
              <div className="space-y-2">
                {summary.topItems.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-sm">{item.name}</span>
                    <span className="text-sm font-semibold text-primary">{item.qtySold} und.</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
