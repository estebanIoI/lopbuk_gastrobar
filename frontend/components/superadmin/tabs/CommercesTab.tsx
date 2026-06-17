'use client'

import { useEffect, useState } from 'react'
import {
  CheckCircle2, Eye, EyeOff, RefreshCw, Save, Search, Store,
  Plus, Trash2, RotateCcw, PauseCircle, PlayCircle, Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCommerces } from '../hooks/useCommerces'
import { useTenantLifecycle, type TenantFull } from '../hooks/useTenantLifecycle'
import { CommerceWizard } from '../shared/CommerceWizard'

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TenantFull['status'] }) {
  const cfg = {
    activo:     { label: 'Activo',     cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    suspendido: { label: 'Suspendido', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    cancelado:  { label: 'Eliminado',  cls: 'bg-red-100   text-red-700   dark:bg-red-900/30   dark:text-red-400'   },
  }[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ── Plan badge ────────────────────────────────────────────────────────────────

function PlanBadge({ plan }: { plan: string }) {
  const cls = plan === 'empresarial'
    ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
    : plan === 'profesional'
    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    : 'bg-muted text-muted-foreground'
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>{plan}</span>
}

// ── Active commerce row ───────────────────────────────────────────────────────

function ActiveTenantRow({
  tenant,
  togglingId,
  trashingId,
  onToggle,
  onTrash,
}: {
  tenant: TenantFull
  togglingId: string | null
  trashingId: string | null
  onToggle: () => void
  onTrash: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const isToggling = togglingId === tenant.id
  const isTrashing = trashingId === tenant.id

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3 hover:bg-muted/20 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
          <Store className="h-4 w-4 text-muted-foreground/60" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold truncate">{tenant.name}</span>
            <StatusBadge status={tenant.status} />
            <PlanBadge plan={tenant.plan} />
          </div>
          <div className="text-xs text-muted-foreground">
            /{tenant.slug}
            {tenant.ownerEmail ? ` · ${tenant.ownerEmail}` : ''}
            {` · ${tenant.totalUsers} usuario(s) · ${tenant.totalSales} ventas`}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Suspend / Activate */}
        <button
          onClick={onToggle}
          disabled={isToggling || isTrashing}
          title={tenant.status === 'activo' ? 'Suspender' : 'Activar'}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-input text-xs hover:bg-muted disabled:opacity-50 transition-colors"
        >
          {isToggling
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : tenant.status === 'activo'
            ? <PauseCircle className="h-3.5 w-3.5 text-amber-500" />
            : <PlayCircle  className="h-3.5 w-3.5 text-green-500" />
          }
          <span className="hidden sm:inline">{tenant.status === 'activo' ? 'Suspender' : 'Activar'}</span>
        </button>

        {/* Trash — with confirm */}
        {confirming ? (
          <div className="flex items-center gap-1">
            <span className="text-xs text-red-500">¿Eliminar?</span>
            <button
              onClick={() => { onTrash(); setConfirming(false) }}
              disabled={isTrashing}
              className="px-2 py-1 text-xs rounded-md bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
            >
              {isTrashing ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Sí'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="px-2 py-1 text-xs rounded-md border border-input hover:bg-muted"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            disabled={isTrashing || isToggling}
            title="Mover a papelera"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-input text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Papelera</span>
          </button>
        )}
      </div>
    </div>
  )
}

// ── Trashed commerce row ──────────────────────────────────────────────────────

function TrashedTenantRow({
  tenant,
  restoringId,
  onRestore,
}: {
  tenant: TenantFull
  restoringId: string | null
  onRestore: () => void
}) {
  const isRestoring = restoringId === tenant.id
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50/30 dark:bg-red-900/10 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-muted-foreground line-through truncate">{tenant.name}</span>
          <StatusBadge status="cancelado" />
        </div>
        <div className="text-xs text-muted-foreground">/{tenant.slug} · {tenant.ownerEmail ?? '—'}</div>
      </div>
      <button
        onClick={onRestore}
        disabled={isRestoring}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-input bg-background text-xs font-medium hover:bg-muted disabled:opacity-50 transition-colors"
      >
        {isRestoring
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <RotateCcw className="h-3.5 w-3.5 text-green-500" />
        }
        Restaurar
      </button>
    </div>
  )
}

// ── Tab principal ─────────────────────────────────────────────────────────────

export function CommercesTab() {
  const [showTrash, setShowTrash] = useState(false)

  // Marketplace card editing (existing)
  const {
    marketplaceCards, isLoadingCards, cardSearch, setCardSearch, savingCardId,
    fetchMarketplaceCards, patchCardLocal, saveMarketplaceCard,
    externalCards, fetchExternalCards, patchExternalLocal, savingExternalId,
    newExternal, setNewExternal, creatingExternal, createExternalCard, saveExternalCard, deleteExternalCard,
  } = useCommerces()

  // Tenant lifecycle management (new)
  const {
    isLoadingTenants, tenantSearch, setTenantSearch,
    filteredActive, filteredTrashed, fetchTenants, businessTypes,
    togglingId, trashingId, restoringId,
    handleToggleStatus, handleTrash, handleRestore,
    wizardOpen, wizardStep, wizardData, wizardErrors, isSubmitting,
    openWizard, closeWizard, patchWizard, wizardNext, wizardBack, handleWizardSubmit,
  } = useTenantLifecycle()

  useEffect(() => { fetchMarketplaceCards() }, [fetchMarketplaceCards])
  useEffect(() => { fetchExternalCards() }, [fetchExternalCards])

  const filteredCards = (Array.isArray(marketplaceCards) ? marketplaceCards : []).filter(c => {
    const q = cardSearch.trim().toLowerCase()
    if (!q) return true
    return (c.name || '').toLowerCase().includes(q) || (c.slug || '').toLowerCase().includes(q)
  })

  return (
    <div className="space-y-6">
      {/* ── Header con acciones ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            Gestión de Comercios
          </h3>
          <p className="text-xs text-muted-foreground">
            {filteredActive.length} activos · {filteredTrashed.length} en papelera
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTrash(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm transition-colors ${
              showTrash
                ? 'bg-red-100 border-red-300 text-red-700 dark:bg-red-900/30 dark:border-red-700 dark:text-red-400'
                : 'border-input hover:bg-muted text-muted-foreground'
            }`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Papelera
            {filteredTrashed.length > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold">
                {filteredTrashed.length}
              </span>
            )}
          </button>
          <Button size="sm" onClick={openWizard} className="flex items-center gap-1.5">
            <Plus className="h-4 w-4" />
            Crear comercio
          </Button>
        </div>
      </div>

      {/* ── Búsqueda global ──────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={tenantSearch}
          onChange={e => setTenantSearch(e.target.value)}
          placeholder="Buscar comercio por nombre, slug o email…"
          className="pl-9"
        />
      </div>

      {/* ── Papelera ─────────────────────────────────────────────────────── */}
      {showTrash && (
        <Card className="border-red-200 dark:border-red-900/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-500" />
              Papelera ({filteredTrashed.length})
            </CardTitle>
            <CardDescription>
              Comercios eliminados. Puedes restaurarlos para volver a activarlos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingTenants ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTrashed.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6 italic">
                La papelera está vacía
              </p>
            ) : (
              <div className="space-y-2">
                {filteredTrashed.map(t => (
                  <TrashedTenantRow
                    key={t.id}
                    tenant={t}
                    restoringId={restoringId}
                    onRestore={() => handleRestore(t)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Lista de comercios activos/suspendidos ────────────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Store className="h-4 w-4 text-muted-foreground" />
                Comercios ({filteredActive.length})
              </CardTitle>
              <CardDescription>
                Gestiona el estado de cada comercio y accede a la configuración de su tarjeta en la página principal.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchTenants} disabled={isLoadingTenants}>
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingTenants ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingTenants ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredActive.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              No hay comercios activos
            </p>
          ) : (
            <div className="space-y-2">
              {filteredActive.map(t => (
                <ActiveTenantRow
                  key={t.id}
                  tenant={t}
                  togglingId={togglingId}
                  trashingId={trashingId}
                  onToggle={() => handleToggleStatus(t)}
                  onTrash={() => handleTrash(t)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Configuración de tarjetas en la página principal ─────────────── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Store className="h-4 w-4 text-muted-foreground" />
                Tarjetas en la Página Principal
              </CardTitle>
              <CardDescription>
                Portada, descripción, verificación, visibilidad y orden de cada comercio.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchMarketplaceCards} disabled={isLoadingCards}>
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingCards ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={cardSearch}
              onChange={(e) => setCardSearch(e.target.value)}
              placeholder="Buscar por nombre o slug…"
              className="pl-9 pr-4"
            />
          </div>

          {isLoadingCards ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCards.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Sin resultados</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredCards.map(card => (
                <div key={card.id} className="rounded-xl border border-border bg-background overflow-hidden">
                  {/* Preview header */}
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
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      card.openState === 'closed' ? 'bg-red-500/15 text-red-500' : 'bg-green-500/15 text-green-600'
                    }`}>
                      {card.openState === 'closed' ? 'CERRADO' : 'ABIERTO'}
                    </span>
                  </div>

                  {/* Editable fields */}
                  <div className="p-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">URL de portada</label>
                        <Input
                          value={card.coverUrl ?? ''}
                          onChange={(e) => patchCardLocal(card.id, { coverUrl: e.target.value })}
                          placeholder="https://…"
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
                      <button
                        type="button"
                        onClick={() => patchCardLocal(card.id, { isVerified: !card.isVerified })}
                        className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
                          card.isVerified ? 'bg-blue-500/10 border-blue-500/40 text-blue-600' : 'border-border text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {card.isVerified ? 'Verificado' : 'Sin verificar'}
                      </button>

                      <button
                        type="button"
                        onClick={() => patchCardLocal(card.id, { marketplaceVisible: !card.marketplaceVisible })}
                        className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
                          card.marketplaceVisible ? 'border-border text-foreground hover:bg-muted' : 'bg-amber-500/10 border-amber-500/40 text-amber-600'
                        }`}
                      >
                        {card.marketplaceVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        {card.marketplaceVisible ? 'Visible' : 'Oculto'}
                      </button>

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

                      <Button
                        size="sm"
                        className="ml-auto flex items-center gap-1.5"
                        onClick={() => saveMarketplaceCard(card)}
                        disabled={savingCardId === card.id}
                      >
                        {savingCardId === card.id
                          ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          : <Save className="h-3.5 w-3.5" />}
                        Guardar
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Tarjetas externas (comercios fuera del aplicativo) ───────────── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4 text-muted-foreground" />
            Tarjetas externas (fuera del aplicativo)
          </CardTitle>
          <CardDescription>
            Crea tarjetas para comercios que NO están en la plataforma. Configura su logo, portada y descripción; al abrirlas, el cliente es redirigido al link que indiques.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Crear nueva */}
          <div className="rounded-xl border border-dashed border-border p-4 space-y-3">
            <p className="text-sm font-semibold">Nueva tarjeta externa</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nombre *</label>
                <Input value={newExternal.name} onChange={e => setNewExternal({ ...newExternal, name: e.target.value })} placeholder="Ej: Discoteca La Luna" className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Link externo (redirección) *</label>
                <Input value={newExternal.externalUrl} onChange={e => setNewExternal({ ...newExternal, externalUrl: e.target.value })} placeholder="https://instagram.com/… o https://…" className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">URL del logo</label>
                <Input value={newExternal.logoUrl} onChange={e => setNewExternal({ ...newExternal, logoUrl: e.target.value })} placeholder="https://…" className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">URL de portada</label>
                <Input value={newExternal.coverUrl} onChange={e => setNewExternal({ ...newExternal, coverUrl: e.target.value })} placeholder="https://…" className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Descripción corta</label>
                <Input value={newExternal.cardDescription} onChange={e => setNewExternal({ ...newExternal, cardDescription: e.target.value })} placeholder="Ej: Rumba y eventos en Mocoa" maxLength={300} className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Ciudad</label>
                <Input value={newExternal.city} onChange={e => setNewExternal({ ...newExternal, city: e.target.value })} placeholder="Ej: Mocoa" className="h-9 text-sm" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setNewExternal({ ...newExternal, isVerified: !newExternal.isVerified })} className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${newExternal.isVerified ? 'bg-blue-500/10 border-blue-500/40 text-blue-600' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                <CheckCircle2 className="h-3.5 w-3.5" /> {newExternal.isVerified ? 'Verificado' : 'Sin verificar'}
              </button>
              <button type="button" onClick={() => setNewExternal({ ...newExternal, marketplaceVisible: !newExternal.marketplaceVisible })} className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${newExternal.marketplaceVisible ? 'border-border text-foreground hover:bg-muted' : 'bg-amber-500/10 border-amber-500/40 text-amber-600'}`}>
                {newExternal.marketplaceVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />} {newExternal.marketplaceVisible ? 'Visible' : 'Oculto'}
              </button>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Orden</span>
                <Input type="number" min={0} value={newExternal.marketplaceOrder} onChange={e => setNewExternal({ ...newExternal, marketplaceOrder: e.target.value })} className="h-8 w-16 text-sm" />
              </div>
              <Button size="sm" className="ml-auto flex items-center gap-1.5" onClick={createExternalCard} disabled={creatingExternal}>
                {creatingExternal ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Crear tarjeta
              </Button>
            </div>
          </div>

          {/* Existentes */}
          {externalCards.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Aún no hay tarjetas externas.</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {externalCards.map(card => (
                <div key={card.id} className="rounded-xl border border-border bg-background overflow-hidden">
                  <div className="flex items-center gap-3 p-3 border-b border-border bg-secondary/20">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
                      {(card.coverUrl || card.logoUrl) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={card.coverUrl || card.logoUrl} alt={card.name} className="w-full h-full object-cover" />
                      ) : <Store className="h-5 w-5 text-muted-foreground/40" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold truncate">{card.name}</p>
                        {Boolean(card.isVerified) && <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{card.externalUrl}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-violet-500/15 text-violet-500">EXTERNO</span>
                  </div>
                  <div className="p-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Nombre</label>
                        <Input value={card.name ?? ''} onChange={e => patchExternalLocal(card.id, { name: e.target.value })} className="h-9 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Link externo</label>
                        <Input value={card.externalUrl ?? ''} onChange={e => patchExternalLocal(card.id, { externalUrl: e.target.value })} className="h-9 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">URL del logo</label>
                        <Input value={card.logoUrl ?? ''} onChange={e => patchExternalLocal(card.id, { logoUrl: e.target.value })} className="h-9 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">URL de portada</label>
                        <Input value={card.coverUrl ?? ''} onChange={e => patchExternalLocal(card.id, { coverUrl: e.target.value })} className="h-9 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Descripción corta</label>
                        <Input value={card.cardDescription ?? ''} onChange={e => patchExternalLocal(card.id, { cardDescription: e.target.value })} maxLength={300} className="h-9 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Ciudad</label>
                        <Input value={card.city ?? ''} onChange={e => patchExternalLocal(card.id, { city: e.target.value })} className="h-9 text-sm" />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => patchExternalLocal(card.id, { isVerified: !card.isVerified })} className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${card.isVerified ? 'bg-blue-500/10 border-blue-500/40 text-blue-600' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> {card.isVerified ? 'Verificado' : 'Sin verificar'}
                      </button>
                      <button type="button" onClick={() => patchExternalLocal(card.id, { marketplaceVisible: !card.marketplaceVisible })} className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${card.marketplaceVisible ? 'border-border text-foreground hover:bg-muted' : 'bg-amber-500/10 border-amber-500/40 text-amber-600'}`}>
                        {card.marketplaceVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />} {card.marketplaceVisible ? 'Visible' : 'Oculto'}
                      </button>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>Orden</span>
                        <Input type="number" min={0} value={card.marketplaceOrder ?? 0} onChange={e => patchExternalLocal(card.id, { marketplaceOrder: e.target.value })} className="h-8 w-16 text-sm" />
                      </div>
                      <button type="button" onClick={() => deleteExternalCard(card.id)} className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" /> Eliminar
                      </button>
                      <Button size="sm" className="ml-auto flex items-center gap-1.5" onClick={() => saveExternalCard(card)} disabled={savingExternalId === card.id}>
                        {savingExternalId === card.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Guardar
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Wizard ───────────────────────────────────────────────────────── */}
      {wizardOpen && (
        <CommerceWizard
          step={wizardStep}
          data={wizardData}
          errors={wizardErrors}
          isSubmitting={isSubmitting}
          businessTypes={businessTypes}
          onChange={patchWizard}
          onNext={wizardNext}
          onBack={wizardBack}
          onSubmit={handleWizardSubmit}
          onClose={closeWizard}
        />
      )}
    </div>
  )
}
