'use client'

/**
 * LegendCodesTab — Panel superadmin de Consumer Plans / LEGEND (G6).
 * Generar / listar / desactivar códigos + configurar el reveal (animación + colores).
 */
import { useEffect, useState, useCallback } from 'react'
import { Crown, Check, Copy, RefreshCw, Plus, Save, Ticket, Users, Clock, TrendingUp, Flame, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'

type Unit = 'day' | 'month'
type Stack = 'extend' | 'replace' | 'block'

export function LegendCodesTab() {
  // ── Crear ──
  const [durationValue, setDurationValue] = useState('30')
  const [durationUnit, setDurationUnit] = useState<Unit>('day')
  const [stackPolicy, setStackPolicy] = useState<Stack>('extend')
  const [maxRedemptions, setMaxRedemptions] = useState('')
  const [customCode, setCustomCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [copied, setCopied] = useState(false)

  // ── Lista ──
  const [codes, setCodes] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // ── Config visual ──
  const [cfg, setCfg] = useState<any>({ animation: 'chat-daimuz', primary: '#D4AF37', accent: '#0e0e0e', revealDuration: 2500 })
  const [savingCfg, setSavingCfg] = useState(false)
  const [cfgMsg, setCfgMsg] = useState('')

  // ── Descuentos LEGEND (C7.5) ──
  const [disc, setDisc] = useState<{ percentOff: number; freeShipping: boolean }>({ percentOff: 0, freeShipping: false })
  const [savingDisc, setSavingDisc] = useState(false)
  const [discMsg, setDiscMsg] = useState('')
  const saveDisc = async () => {
    setSavingDisc(true); setDiscMsg('')
    try { const r = await api.adminSaveDiscountConfig(disc); setDiscMsg(r.success ? 'Descuentos guardados' : (r.error || 'No se pudo guardar')) }
    finally { setSavingDisc(false) }
  }

  // ── Analytics ──
  const [stats, setStats] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])

  const loadCodes = useCallback(async () => {
    setLoading(true)
    try { const r = await api.adminListPlanCodes(); if (r.success) setCodes(r.data || []) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    loadCodes()
    api.adminGetLegendConfig().then(r => { if (r.success && r.data) setCfg((c: any) => ({ ...c, ...r.data })) }).catch(() => {})
    api.adminGetPlanAnalytics().then(r => { if (r.success) setStats(r.data) }).catch(() => {})
    api.adminGetDiscountConfig().then(r => { if (r.success && r.data) setDisc({ percentOff: Number(r.data.percentOff) || 0, freeShipping: !!r.data.freeShipping }) }).catch(() => {})
    api.adminGetEventStats(30).then(r => { if (r.success) setEvents(r.data || []) }).catch(() => {})
  }, [loadCodes])

  const create = async () => {
    const dv = parseInt(durationValue, 10)
    if (!Number.isFinite(dv) || dv <= 0) return
    setCreating(true); setNewCode(''); setCopied(false)
    try {
      const r = await api.adminCreatePlanCode({
        tier: 'legend', durationValue: dv, durationUnit, stackPolicy,
        maxRedemptions: maxRedemptions ? parseInt(maxRedemptions, 10) : null,
        code: customCode.trim() || undefined,
      })
      if (r.success && r.data?.code) {
        setNewCode(r.data.code)
        setCustomCode('')
        loadCodes()
      }
    } finally { setCreating(false) }
  }

  const toggleActive = async (id: string, isActive: boolean) => {
    await api.adminUpdatePlanCode(id, { isActive: !isActive })
    loadCodes()
  }

  const deleteCode = async (id: string, redemptions: number) => {
    if (redemptions > 0) {
      if (!confirm('Este código ya fue canjeado. ¿Eliminarlo de todos modos? Se borrará también su historial.')) return
      const r = await api.adminDeletePlanCode(id, true)
      if (!r.success) { alert(r.error || 'No se pudo eliminar'); return }
    } else {
      if (!confirm('¿Eliminar este código?')) return
      const r = await api.adminDeletePlanCode(id)
      if (!r.success) { alert(r.error || 'No se pudo eliminar'); return }
    }
    loadCodes()
  }

  const saveCfg = async () => {
    setSavingCfg(true); setCfgMsg('')
    try {
      const r = await api.adminSaveLegendConfig({
        animation: cfg.animation, primary: cfg.primary, accent: cfg.accent,
        revealDuration: Number(cfg.revealDuration) || 2500,
      })
      setCfgMsg(r.success ? 'Configuración guardada' : (r.error || 'No se pudo guardar'))
    } finally { setSavingCfg(false) }
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'LEGEND activos', value: stats.activeLegends, icon: Crown, color: 'text-amber-500' },
            { label: 'Por vencer (7d)', value: stats.expiringSoon7d, icon: Clock, color: 'text-orange-500' },
            { label: 'Canjes (30d)', value: stats.redeemsLast30, icon: Flame, color: 'text-rose-500' },
            { label: 'Retención', value: `${stats.retentionPct}%`, icon: TrendingUp, color: 'text-green-500' },
          ].map(k => {
            const Icon = k.icon
            return (
              <Card key={k.label} className="border-border bg-card">
                <CardContent className="p-4">
                  <Icon className={`h-4 w-4 ${k.color}`} />
                  <p className="text-2xl font-bold text-foreground mt-1">{k.value}</p>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {stats && (
        <Card className="border-border bg-card">
          <CardContent className="p-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5"><Users className="h-4 w-4" /> Total canjes: <strong className="text-foreground">{stats.redeemsTotal}</strong></span>
            <span className="text-muted-foreground">Usuarios únicos: <strong className="text-foreground">{stats.everRedeemed}</strong></span>
            <span className="text-muted-foreground">Vencidos: <strong className="text-foreground">{stats.expiredTotal}</strong></span>
            <span className="text-muted-foreground ml-auto">Milestones activos — Constante <strong className="text-amber-600">{stats.milestones.constante}</strong> · Elite <strong className="text-amber-600">{stats.milestones.elite}</strong> · Glow <strong className="text-amber-600">{stats.milestones.glow}</strong> · Founder <strong className="text-amber-600">{stats.milestones.founder}</strong></span>
          </CardContent>
        </Card>
      )}

      {/* Crear código */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base lg:text-lg flex items-center gap-2">
            <Plus className="h-5 w-5 text-muted-foreground" /> Generar código LEGEND
          </CardTitle>
          <CardDescription>
            El código real se muestra <strong>una sola vez</strong> al crearlo (en la base solo se guarda su hash). Compártelo con el usuario.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Duración</Label>
              <Input type="number" value={durationValue} onChange={e => setDurationValue(e.target.value)} placeholder="30" className="text-sm" />
            </div>
            <div>
              <Label className="text-xs">Unidad</Label>
              <select value={durationUnit} onChange={e => setDurationUnit(e.target.value as Unit)} className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm">
                <option value="day">Días</option>
                <option value="month">Meses</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Al apilar</Label>
              <select value={stackPolicy} onChange={e => setStackPolicy(e.target.value as Stack)} className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm">
                <option value="extend">Extender (+tope 180d)</option>
                <option value="replace">Reemplazar</option>
                <option value="block">Bloquear</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Cupos (opcional)</Label>
              <Input type="number" value={maxRedemptions} onChange={e => setMaxRedemptions(e.target.value)} placeholder="∞" className="text-sm" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Código personalizado (opcional — si lo dejas vacío se genera)</Label>
            <Input value={customCode} onChange={e => setCustomCode(e.target.value.toUpperCase())} placeholder="LEGEND-VERANO" className="text-sm" />
          </div>
          <Button onClick={create} disabled={creating} size="sm">
            {creating ? <><RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" /> Generando…</> : <><Ticket className="h-3.5 w-3.5 mr-2" /> Generar código</>}
          </Button>

          {newCode && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
              <Crown className="h-4 w-4 text-amber-500 shrink-0" />
              <code className="text-sm font-bold tracking-wide text-foreground flex-1">{newCode}</code>
              <button
                className="shrink-0 text-xs text-primary hover:underline flex items-center gap-1"
                onClick={() => { navigator.clipboard.writeText(newCode); setCopied(true) }}
              >
                {copied ? <><Check className="h-3.5 w-3.5" /> Copiado</> : <><Copy className="h-3.5 w-3.5" /> Copiar</>}
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de códigos */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base lg:text-lg flex items-center gap-2">
            <Ticket className="h-5 w-5 text-muted-foreground" /> Códigos
            <button onClick={loadCodes} className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Recargar
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {codes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Aún no hay códigos.</p>
          ) : (
            <div className="space-y-2">
              {codes.map(c => (
                <div key={c.id} className={`flex items-center gap-3 p-3 rounded-lg border border-border ${c.isActive ? '' : 'opacity-50'}`}>
                  <code className="text-sm font-semibold text-foreground w-32 shrink-0">{c.codePreview}</code>
                  <span className="text-xs text-muted-foreground flex-1">
                    {c.durationValue} {c.durationUnit === 'month' ? 'mes(es)' : 'día(s)'} · {c.stackPolicy}
                    {' · '}{c.redemptions}{c.maxRedemptions != null ? `/${c.maxRedemptions}` : ''} canjes · {c.scope}
                  </span>
                  <button onClick={() => toggleActive(c.id, c.isActive)} className={`text-xs px-2.5 py-1 rounded-full font-medium ${c.isActive ? 'bg-green-500/15 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                    {c.isActive ? 'Activo' : 'Inactivo'}
                  </button>
                  <button onClick={() => deleteCode(c.id, c.redemptions)} title="Eliminar código" className="text-muted-foreground hover:text-red-500 p-1 rounded-md hover:bg-red-500/10">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Config del reveal */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base lg:text-lg flex items-center gap-2">
            <Crown className="h-5 w-5 text-muted-foreground" /> Animación del reveal LEGEND
          </CardTitle>
          <CardDescription>Lo que ve el usuario al activar un código (corto y skippable).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Animación</Label>
              <select value={cfg.animation} onChange={e => setCfg((c: any) => ({ ...c, animation: e.target.value }))} className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm">
                <option value="chat-daimuz">Glitch (Chat Daimuz)</option>
                <option value="flame">Flame</option>
                <option value="confetti">Confetti</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Color primario</Label>
              <Input type="color" value={cfg.primary} onChange={e => setCfg((c: any) => ({ ...c, primary: e.target.value }))} className="h-9 p-1" />
            </div>
            <div>
              <Label className="text-xs">Color acento</Label>
              <Input type="color" value={cfg.accent} onChange={e => setCfg((c: any) => ({ ...c, accent: e.target.value }))} className="h-9 p-1" />
            </div>
            <div>
              <Label className="text-xs">Duración (ms)</Label>
              <Input type="number" value={cfg.revealDuration} onChange={e => setCfg((c: any) => ({ ...c, revealDuration: e.target.value }))} placeholder="2500" className="text-sm" />
            </div>
          </div>
          <Button onClick={saveCfg} disabled={savingCfg} variant="outline" size="sm">
            {savingCfg ? <><RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" /> Guardando…</> : <><Save className="h-3.5 w-3.5 mr-2" /> Guardar configuración</>}
          </Button>
          {cfgMsg && <p className="text-xs text-green-500 flex items-center gap-1"><Check className="h-3.5 w-3.5" />{cfgMsg}</p>}
        </CardContent>
      </Card>

      {/* Eventos (C7.10) */}
      {events.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base lg:text-lg flex items-center gap-2"><TrendingUp className="h-5 w-5 text-muted-foreground" /> Eventos (últimos 30 días)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              {events.map(e => (
                <div key={e.event} className="rounded-lg border border-border p-2">
                  <p className="font-bold text-foreground">{e.count}</p>
                  <p className="text-[11px] text-muted-foreground">{e.event}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Descuentos LEGEND (C7.5) */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base lg:text-lg flex items-center gap-2">
            <Crown className="h-5 w-5 text-muted-foreground" /> Beneficios de descuento LEGEND
          </CardTitle>
          <CardDescription>Lo que ahorran los miembros LEGEND en Explore y el carrito. 0% lo desactiva.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <Label className="text-xs">% de descuento</Label>
              <div className="flex items-center gap-1">
                <Input type="number" value={disc.percentOff} onChange={e => setDisc(d => ({ ...d, percentOff: Number(e.target.value) }))} placeholder="10" className="text-sm w-24" />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none pb-2">
              <input type="checkbox" checked={disc.freeShipping} onChange={e => setDisc(d => ({ ...d, freeShipping: e.target.checked }))} className="h-4 w-4 accent-primary" />
              <span className="text-sm">Envío gratis</span>
            </label>
          </div>
          <Button onClick={saveDisc} disabled={savingDisc} variant="outline" size="sm">
            {savingDisc ? <><RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" /> Guardando…</> : <><Save className="h-3.5 w-3.5 mr-2" /> Guardar descuentos</>}
          </Button>
          {discMsg && <p className="text-xs text-green-500 flex items-center gap-1"><Check className="h-3.5 w-3.5" />{discMsg}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
