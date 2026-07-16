'use client'

// Panel admin de fidelización (Fase 3 → P1 Customer Engagement Platform):
// reglas de puntos, catálogo de recompensas, cuentas de clientes,
// wallet config, CRM, analytics, campañas y automatizaciones.
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { WalletCard } from '@/components/wallet/wallet-card'
import { Customer360 } from '@/components/wallet/customer-360'
import { LiveActivityFeed } from '@/components/wallet/live-activity-feed'
import { AIInsights } from '@/components/wallet/ai-insights'
import { RevenueAttribution } from '@/components/wallet/revenue-attribution'
import { AICopilot } from '@/components/wallet/ai-copilot'

export default function LoyaltyAdminPage() {
  const [tab, setTab] = useState<'config' | 'rewards' | 'accounts' | 'wallet' | 'crm' | 'analytics' | 'automations' | 'campaigns' | 'copilot'>('config')

  // Config
  const [enabled, setEnabled] = useState(true)
  const [ppt, setPpt] = useState(1)
  const [savingCfg, setSavingCfg] = useState(false)

  // Rewards
  const [rewards, setRewards] = useState<any[]>([])
  const [rName, setRName] = useState('')
  const [rDesc, setRDesc] = useState('')
  const [rCost, setRCost] = useState('')
  const [rType, setRType] = useState('points')

  // Accounts
  const [accounts, setAccounts] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [earnPhone, setEarnPhone] = useState('')
  const [earnName, setEarnName] = useState('')
  const [earnAmount, setEarnAmount] = useState('')

  // Wallet config
  const [walletEnabled, setWalletEnabled] = useState(false)
  const [walletLogoUrl, setWalletLogoUrl] = useState('')
  const [walletColor, setWalletColor] = useState('#000000')
  const [walletBizName, setWalletBizName] = useState('')
  const [walletDesc, setWalletDesc] = useState('')
  const [geoRadius, setGeoRadius] = useState(300)
  const [geoPush, setGeoPush] = useState(false)
  const [geoMsg, setGeoMsg] = useState('')
  const [savingWallet, setSavingWallet] = useState(false)

  // CRM
  const [crmSearch, setCrmSearch] = useState('')
  const [crmLevel, setCrmLevel] = useState('')
  const [crmCustomers, setCrmCustomers] = useState<any[]>([])
  const [crmTotal, setCrmTotal] = useState(0)

  // Analytics
  const [analytics, setAnalytics] = useState<any>(null)

  const loadCfg = useCallback(async () => {
    const r = await api.getLoyaltyConfig()
    if (r.success && r.data) { setEnabled(r.data.enabled); setPpt(r.data.pointsPerThousand) }
  }, [])
  const loadRewards = useCallback(async () => {
    const r = await api.getLoyaltyRewards()
    if (r.success) setRewards(r.data?.rewards || [])
  }, [])
  const loadAccounts = useCallback(async (q = '') => {
    const r = await api.getLoyaltyAccounts(q)
    if (r.success) setAccounts(r.data?.accounts || [])
  }, [])

  useEffect(() => { loadCfg(); loadRewards(); loadAccounts() }, [loadCfg, loadRewards, loadAccounts])

  const saveCfg = async () => {
    setSavingCfg(true)
    const r = await api.updateLoyaltyConfig({ enabled, pointsPerThousand: Number(ppt) })
    setSavingCfg(false)
    r.success ? toast.success('Configuración guardada') : toast.error(r.error ?? 'Error')
  }

  const addReward = async () => {
    if (!rName.trim() || !(Number(rCost) > 0)) { toast.error('Nombre y costo válido requeridos'); return }
    const r = await api.createLoyaltyReward({ name: rName.trim(), description: rDesc.trim(), pointsCost: Number(rCost) })
    if (r.success) { setRName(''); setRDesc(''); setRCost(''); loadRewards(); toast.success('Recompensa creada') }
    else toast.error(r.error ?? 'Error')
  }
  const toggleReward = async (rw: any) => {
    const r = await api.updateLoyaltyReward(rw.id, { isActive: rw.isActive ? 0 : 1 })
    if (r.success) loadRewards()
  }
  const delReward = async (id: string) => {
    const r = await api.deleteLoyaltyReward(id)
    if (r.success) loadRewards()
  }

  const doEarn = async () => {
    if (!earnPhone.trim() || !(Number(earnAmount) > 0)) { toast.error('Teléfono y monto requeridos'); return }
    const r = await api.loyaltyEarn({ phone: earnPhone.trim(), name: earnName.trim(), amount: Number(earnAmount) })
    if (r.success) { toast.success(`+${r.data?.points ?? 0} pts otorgados`); setEarnPhone(''); setEarnName(''); setEarnAmount(''); loadAccounts(search) }
    else toast.error(r.error ?? 'Error')
  }

  // Wallet
  const loadWalletCfg = useCallback(async () => {
    try {
      const r = await api.getEngagementConfig()
      if (r.success && r.data) {
        setWalletEnabled(!!r.data.wallet_enabled)
        setWalletLogoUrl(r.data.wallet_logo_url || '')
        setWalletColor(r.data.wallet_primary_color || '#000000')
        setWalletBizName(r.data.wallet_business_name || '')
        setWalletDesc(r.data.wallet_short_description || '')
        setGeoRadius(r.data.geo_radius_meters || 300)
        setGeoPush(!!r.data.geo_push_enabled)
        setGeoMsg(r.data.geo_push_message || '')
      }
    } catch {}
  }, [])
  useEffect(() => { loadWalletCfg() }, [loadWalletCfg])

  const saveWalletCfg = async () => {
    setSavingWallet(true)
    const r = await api.updateEngagementConfig({
      walletEnabled, walletLogoUrl, walletPrimaryColor: walletColor,
      walletBusinessName: walletBizName, walletShortDescription: walletDesc,
      geoRadiusMeters: geoRadius, geoPushEnabled: geoPush, geoPushMessage: geoMsg,
    })
    setSavingWallet(false)
    r.success ? toast.success('Wallet guardada') : toast.error(r.error ?? 'Error')
  }

  // CRM
  const loadCrm = useCallback(async (q?: string, lvl?: string) => {
    try {
      const r = await api.getEngagementCustomers({ search: q, level: lvl, limit: 50 })
      if (r.success && r.data) { setCrmCustomers(r.data.customers); setCrmTotal(r.data.total) }
    } catch {}
  }, [])
  useEffect(() => { if (tab === 'crm') loadCrm(crmSearch, crmLevel) }, [tab, crmSearch, crmLevel, loadCrm])

  const viewCrmDetail = async (id: string) => {
    setSelectedCustomerId(id)
  }

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)

  // Analytics
  const loadAnalytics = useCallback(async () => {
    try {
      const r = await api.getEngagementAnalytics()
      if (r.success) setAnalytics(r.data)
    } catch {}
  }, [])
  useEffect(() => { if (tab === 'analytics') loadAnalytics() }, [tab, loadAnalytics])

  // Automations
  const [automations, setAutomations] = useState<any[]>([])
  const [autoName, setAutoName] = useState('')
  const [autoTrigger, setAutoTrigger] = useState('sale_completed')
  const [autoAction, setAutoAction] = useState('push')
  const [autoTitle, setAutoTitle] = useState('')
  const [autoBody, setAutoBody] = useState('')
  const loadAutomations = useCallback(async () => {
    try { const r = await api.getEngagementAutomations(); if (r.success && r.data) setAutomations(r.data.automations) } catch {}
  }, [])
  useEffect(() => { if (tab === 'automations') loadAutomations() }, [tab, loadAutomations])

  const createAutomation = async () => {
    if (!autoName.trim()) { toast.error('Nombre requerido'); return }
    const r = await api.createEngagementAutomation({
      name: autoName.trim(),
      triggerType: autoTrigger,
      actionType: autoAction,
      actionConfig: { title: autoTitle, body: autoBody },
    })
    if (r.success) { setAutoName(''); setAutoTitle(''); setAutoBody(''); loadAutomations(); toast.success('Automatización creada') }
    else toast.error(r.error ?? 'Error')
  }
  const toggleAutomation = async (a: any, active: boolean) => {
    const r = await api.updateEngagementAutomation(a.id, { isActive: active })
    if (r.success) loadAutomations()
  }
  const deleteAutomation = async (id: string) => {
    await api.deleteEngagementAutomation(id); loadAutomations()
  }

  // Campaigns
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [cmpName, setCmpName] = useState('')
  const [cmpObjective, setCmpObjective] = useState('increase_sales')
  const [cmpOfferType, setCmpOfferType] = useState('percentage')
  const [cmpOfferValue, setCmpOfferValue] = useState('')
  const [cmpChannels, setCmpChannels] = useState<string[]>(['push'])
  const loadCampaigns = useCallback(async () => {
    try { const r = await api.getEngagementCampaigns(); if (r.success && r.data) setCampaigns(r.data.campaigns) } catch {}
  }, [])
  useEffect(() => { if (tab === 'campaigns') loadCampaigns() }, [tab, loadCampaigns])

  const createCampaign = async () => {
    if (!cmpName.trim()) { toast.error('Nombre requerido'); return }
    const r = await api.createEngagementCampaign({
      name: cmpName.trim(), objective: cmpObjective,
      offerType: cmpOfferType, offerValue: Number(cmpOfferValue) || 0,
      channels: cmpChannels,
    })
    if (r.success) { setCmpName(''); setCmpOfferValue(''); loadCampaigns(); toast.success('Campaña creada') }
    else toast.error(r.error ?? 'Error')
  }
  const toggleChannel = (ch: string) => {
    setCmpChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch])
  }

  const TABS = [['config', '⚙️ Reglas'], ['wallet', '📱 Wallet'], ['rewards', '🎁 Recompensas'], ['accounts', '👤 Cuentas'], ['crm', '📊 CRM'], ['analytics', '📈 Analytics'], ['automations', '🔁 Automatización'], ['campaigns', '📢 Campañas'], ['copilot', '🤖 AI Copilot']] as const

  return (
    <div className="min-h-screen bg-background text-foreground p-5 max-w-4xl mx-auto">
      <h1 className="text-2xl font-black mb-1">⭐ Customer Engagement</h1>
      <p className="text-sm text-muted-foreground mb-5">Fidelización, wallet, CRM y analytics para tu negocio.</p>

      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as any)}
            className={`px-3 py-2 rounded-lg text-sm font-semibold ${tab === id ? 'bg-amber-500 text-black' : 'border border-border'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'config' && (
        <div className="rounded-2xl border border-border bg-card p-5 max-w-md space-y-4">
          <label className="flex items-center justify-between">
            <span className="font-semibold">Programa activo</span>
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="w-5 h-5 accent-amber-500" />
          </label>
          <div>
            <label className="block text-sm font-semibold mb-1">Puntos por cada $1.000 de consumo</label>
            <input type="number" min={0} step="0.5" value={ppt} onChange={e => setPpt(Number(e.target.value))}
              className="w-full rounded-lg bg-background border border-border px-3 py-2.5" />
            <p className="text-xs text-muted-foreground mt-1">Ej.: con 1, un consumo de $50.000 otorga 50 puntos.</p>
          </div>
          <button onClick={saveCfg} disabled={savingCfg} className="rounded-lg bg-amber-500 text-black font-semibold px-4 py-2.5 disabled:opacity-60">
            {savingCfg ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      )}

      {tab === 'wallet' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">📱</span>
            <h2 className="font-bold text-lg">Wallet Designer</h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Editor */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <p className="font-semibold text-sm">Configuración</p>
                <label className="flex items-center justify-between">
                  <span className="text-sm">Google Wallet habilitado</span>
                  <input type="checkbox" checked={walletEnabled} onChange={e => setWalletEnabled(e.target.checked)} className="w-5 h-5 accent-amber-500" />
                </label>
                <div>
                  <label className="block text-xs font-semibold mb-1">Nombre del negocio</label>
                  <input value={walletBizName} onChange={e => setWalletBizName(e.target.value)} placeholder="Fast Not Young"
                    className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Descripción</label>
                  <input value={walletDesc} onChange={e => setWalletDesc(e.target.value)} placeholder="Programa de fidelización"
                    className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Color principal</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={walletColor} onChange={e => setWalletColor(e.target.value)} className="w-10 h-10 rounded-lg border cursor-pointer" />
                    <input value={walletColor} onChange={e => setWalletColor(e.target.value)} className="flex-1 rounded-lg bg-background border border-border px-3 py-2 text-sm font-mono" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">URL del logo</label>
                  <input value={walletLogoUrl} onChange={e => setWalletLogoUrl(e.target.value)} placeholder="https://..."
                    className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm" />
                </div>
              </div>

              {/* Geo Push */}
              <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <p className="font-semibold text-sm">📍 Geo Push</p>
                <label className="flex items-center justify-between">
                  <span className="text-sm">Activar geo push</span>
                  <input type="checkbox" checked={geoPush} onChange={e => setGeoPush(e.target.checked)} className="w-5 h-5 accent-amber-500" />
                </label>
                <div>
                  <label className="block text-xs font-semibold mb-1">Radio (metros)</label>
                  <input type="number" value={geoRadius} onChange={e => setGeoRadius(Number(e.target.value))}
                    className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Mensaje</label>
                  <input value={geoMsg} onChange={e => setGeoMsg(e.target.value)} placeholder="¡Estás cerca! Ven por tu descuento 🍔"
                    className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm" />
                </div>
              </div>

              <button onClick={saveWalletCfg} disabled={savingWallet} className="w-full rounded-lg bg-amber-500 text-black font-semibold px-4 py-2.5 disabled:opacity-60">
                {savingWallet ? 'Guardando…' : 'Guardar configuración'}
              </button>
            </div>

            {/* Live Preview */}
            <div className="flex flex-col items-center gap-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vista previa del pass</p>

              {/* Google Wallet Pass Preview */}
              <div className="w-72 rounded-2xl overflow-hidden shadow-xl border border-border">
                {/* Header */}
                <div className="p-4 text-white" style={{ backgroundColor: walletColor || '#1a1a1a' }}>
                  <div className="flex items-center gap-3 mb-3">
                    {walletLogoUrl ? (
                      <img src={walletLogoUrl} alt="Logo" className="w-10 h-10 rounded-lg object-cover bg-white/20" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center text-lg">⭐</div>
                    )}
                    <div>
                      <p className="font-bold text-sm">{walletBizName || 'Tu Negocio'}</p>
                      <p className="text-xs opacity-80">Lopbuk Rewards</p>
                    </div>
                  </div>
                  <p className="text-xs opacity-70">{walletDesc || 'Programa de fidelización'}</p>
                </div>

                {/* Body */}
                <div className="bg-card p-4 space-y-3">
                  {/* Points */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Puntos</p>
                      <p className="text-2xl font-black">1,250</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Nivel</p>
                      <p className="text-sm font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">🥇 Oro</p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-accent/50 rounded-lg p-2 text-center">
                      <p className="font-bold text-sm">12</p>
                      <p className="text-[10px] text-muted-foreground">Visitas</p>
                    </div>
                    <div className="bg-accent/50 rounded-lg p-2 text-center">
                      <p className="font-bold text-sm">$480K</p>
                      <p className="text-[10px] text-muted-foreground">Total</p>
                    </div>
                  </div>

                  {/* Progress to next level */}
                  <div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>Progreso a Platino</span>
                      <span>12/40 visitas</span>
                    </div>
                    <div className="w-full bg-accent rounded-full h-2">
                      <div className="bg-amber-500 h-2 rounded-full" style={{ width: '30%' }} />
                    </div>
                  </div>

                  {/* Barcode placeholder */}
                  <div className="flex justify-center pt-2">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 30 }).map((_, i) => (
                        <div key={i} className="w-0.5 bg-foreground/80" style={{ height: `${12 + Math.random() * 12}px` }} />
                      ))}
                    </div>
                  </div>
                  <p className="text-center text-[10px] text-muted-foreground">312 456 789 012</p>
                </div>
              </div>

              {/* Info */}
              <div className="text-center max-w-xs">
                <p className="text-xs text-muted-foreground mt-2">
                  Este es el pass que verán tus clientes en Google Wallet. Se actualiza automáticamente con cada compra.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'rewards' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-card p-4 grid sm:grid-cols-4 gap-2 items-end">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1">Nombre</label>
              <input value={rName} onChange={e => setRName(e.target.value)} placeholder="Postre gratis" className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Costo (pts)</label>
              <input type="number" value={rCost} onChange={e => setRCost(e.target.value)} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm" />
            </div>
            <button onClick={addReward} className="rounded-lg bg-amber-500 text-black font-semibold px-4 py-2 text-sm">Agregar</button>
            <div className="sm:col-span-4">
              <input value={rDesc} onChange={e => setRDesc(e.target.value)} placeholder="Descripción (opcional)" className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm" />
            </div>
          </div>
          {rewards.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Aún no hay recompensas.</p>
          ) : (
            <div className="space-y-2">
              {rewards.map(rw => (
                <div key={rw.id} className={`flex items-center gap-3 rounded-xl border p-3 ${rw.isActive ? 'border-border bg-card' : 'border-border bg-card opacity-50'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{rw.name}</p>
                    {rw.description && <p className="text-xs text-muted-foreground">{rw.description}</p>}
                  </div>
                  <span className="font-bold text-amber-500">{rw.pointsCost} pts</span>
                  <button onClick={() => toggleReward(rw)} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-border">{rw.isActive ? 'Ocultar' : 'Activar'}</button>
                  <button onClick={() => delReward(rw.id)} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-border text-red-400">Eliminar</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'accounts' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="font-semibold mb-2">Otorgar puntos por consumo</p>
            <div className="grid sm:grid-cols-4 gap-2 items-end">
              <input value={earnPhone} onChange={e => setEarnPhone(e.target.value)} placeholder="Teléfono" className="rounded-lg bg-background border border-border px-3 py-2 text-sm" />
              <input value={earnName} onChange={e => setEarnName(e.target.value)} placeholder="Nombre (opcional)" className="rounded-lg bg-background border border-border px-3 py-2 text-sm" />
              <input type="number" value={earnAmount} onChange={e => setEarnAmount(e.target.value)} placeholder="Monto $" className="rounded-lg bg-background border border-border px-3 py-2 text-sm" />
              <button onClick={doEarn} className="rounded-lg bg-amber-500 text-black font-semibold px-4 py-2 text-sm">Otorgar</button>
            </div>
          </div>
          <div className="flex gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadAccounts(search)} placeholder="Buscar por nombre o teléfono"
              className="flex-1 rounded-lg bg-background border border-border px-3 py-2 text-sm" />
            <button onClick={() => loadAccounts(search)} className="rounded-lg border border-border px-4 text-sm font-semibold">Buscar</button>
          </div>
          {accounts.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Sin cuentas.</p>
          ) : (
            <div className="space-y-2">
              {accounts.map(a => (
                <div key={a.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{a.name || 'Sin nombre'}</p>
                    <p className="text-xs text-muted-foreground">{a.phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-amber-500">{a.balance} pts</p>
                    <p className="text-[11px] text-muted-foreground">acumulado {a.totalEarned}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'crm' && (
        <div className="space-y-5">
          {/* CRM Search + Filters */}
          <div className="flex gap-2">
            <input value={crmSearch} onChange={e => setCrmSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadCrm(crmSearch, crmLevel)}
              placeholder="Buscar cliente" className="flex-1 rounded-lg bg-background border border-border px-3 py-2 text-sm" />
            <select value={crmLevel} onChange={e => setCrmLevel(e.target.value)}
              className="rounded-lg bg-background border border-border px-3 py-2 text-sm">
              <option value="">Todos los niveles</option>
              <option value="bronze">Bronce</option>
              <option value="silver">Plata</option>
              <option value="gold">Oro</option>
              <option value="platinum">Platino</option>
            </select>
            <button onClick={() => loadCrm(crmSearch, crmLevel)} className="rounded-lg border border-border px-4 text-sm font-semibold">Buscar</button>
          </div>

          <div className="text-xs text-muted-foreground">{crmTotal} clientes encontrados</div>

          {/* Customer list */}
          <div className="space-y-2">
            {crmCustomers.map(c => (
              <div key={c.id} onClick={() => viewCrmDetail(c.id)}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 cursor-pointer hover:bg-accent/50 transition">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{c.name || 'Sin nombre'}</p>
                  <p className="text-xs text-muted-foreground">{c.phone}</p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-bold text-amber-500">{c.balance} pts</p>
                  <p className="text-muted-foreground">{c.level} · {c.visits} visitas</p>
                </div>
              </div>
            ))}
          </div>

          {/* Customer 360° Panel */}
          {selectedCustomerId && (
            <Customer360 accountId={selectedCustomerId} onClose={() => setSelectedCustomerId(null)} />
          )}
        </div>
      )}

      {tab === 'analytics' && analytics && (
        <div className="space-y-5">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border bg-card p-3 text-center">
              <p className="text-2xl font-black">{analytics.totalCustomers}</p>
              <p className="text-[11px] text-muted-foreground">Total clientes</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 text-center">
              <p className="text-2xl font-black text-green-500">{analytics.activeCustomers}</p>
              <p className="text-[11px] text-muted-foreground">Activos (30d)</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 text-center">
              <p className="text-2xl font-black text-amber-500">{analytics.recurrentCustomers}</p>
              <p className="text-[11px] text-muted-foreground">Recurrentes</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 text-center">
              <p className="text-2xl font-black text-red-400">{analytics.lostCustomers}</p>
              <p className="text-[11px] text-muted-foreground">Perdidos (60d+)</p>
            </div>
          </div>

          {/* Retention & Churn */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">Tasa de retención</p>
              <p className="text-xl font-black text-green-500">{analytics.retentionRate}%</p>
              <div className="w-full bg-accent rounded-full h-2 mt-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: `${analytics.retentionRate}%` }} />
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">Tasa de abandono</p>
              <p className="text-xl font-black text-red-400">{analytics.churnRate}%</p>
              <div className="w-full bg-accent rounded-full h-2 mt-2">
                <div className="bg-red-400 h-2 rounded-full" style={{ width: `${analytics.churnRate}%` }} />
              </div>
            </div>
          </div>

          {/* By Level */}
          {analytics.byLevel && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="font-semibold text-sm mb-3">Distribución por nivel</p>
              <div className="space-y-2">
                {(['bronze', 'silver', 'gold', 'platinum'] as const).map(lvl => (
                  <div key={lvl} className="flex items-center gap-2 text-sm">
                    <span className="w-16 font-semibold capitalize">{lvl}</span>
                    <div className="flex-1 bg-accent rounded-full h-3 overflow-hidden">
                      <div className="bg-amber-500 h-3 rounded-full" style={{ width: `${analytics.totalCustomers > 0 ? ((analytics.byLevel[lvl] || 0) / analytics.totalCustomers) * 100 : 0}%` }} />
                    </div>
                    <span className="w-8 text-right font-bold">{analytics.byLevel[lvl] || 0}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Wallet & Engagement */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-lg font-black">{analytics.walletInstalls}</p>
              <p className="text-[11px] text-muted-foreground">Wallets instaladas</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-lg font-black">{analytics.redemptions30d}</p>
              <p className="text-[11px] text-muted-foreground">Canjes (30d)</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-lg font-black">{analytics.pushEvents30d}</p>
              <p className="text-[11px] text-muted-foreground">Push enviados (30d)</p>
            </div>
          </div>

          {/* AI Insights */}
          <AIInsights />

          {/* Revenue Attribution */}
          <div className="rounded-xl border border-border bg-card p-4">
            <RevenueAttribution />
          </div>

          {/* Live Activity Feed */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </span>
              <p className="font-semibold text-sm">Actividad en vivo</p>
            </div>
            <LiveActivityFeed />
          </div>
        </div>
      )}

      {tab === 'automations' && (
        <div className="space-y-5">
          {/* Automation Builder */}
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <p className="font-semibold text-sm">Nueva automatización</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold mb-1">Nombre</label>
                <input value={autoName} onChange={e => setAutoName(e.target.value)} placeholder="Reactivar inactivos"
                  className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Disparador</label>
                <select value={autoTrigger} onChange={e => setAutoTrigger(e.target.value)}
                  className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm">
                  <option value="sale_completed">Venta completada</option>
                  <option value="points_earned">Puntos ganados</option>
                  <option value="level_up">Subió de nivel</option>
                  <option value="inactive_7d">Inactivo 7 días</option>
                  <option value="inactive_30d">Inactivo 30 días</option>
                  <option value="birthday">Cumpleaños</option>
                  <option value="geo_enter">Entró a geozona</option>
                  <option value="time_of_day">Horario del día</option>
                  <option value="near_reward">Cerca de recompensa</option>
                  <option value="first_purchase">Primera compra</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold mb-1">Acción</label>
                <select value={autoAction} onChange={e => setAutoAction(e.target.value)}
                  className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm">
                  <option value="push">Push Notification</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="notification">Notificación In-App</option>
                  <option value="coupon">Cupón automático</option>
                </select>
              </div>
              {autoTrigger === 'time_of_day' && (
                <div>
                  <label className="block text-xs font-semibold mb-1">Hora (HH:MM)</label>
                  <input type="time" value={autoName} placeholder="12:00"
                    className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm" />
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Título del mensaje</label>
              <input value={autoTitle} onChange={e => setAutoTitle(e.target.value)} placeholder="¡Hola de nuevo!"
                className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Cuerpo del mensaje</label>
              <textarea value={autoBody} onChange={e => setAutoBody(e.target.value)} placeholder="Te extrañamos. Hoy tienes 10% de descuento."
                rows={2} className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm" />
            </div>
            <button onClick={createAutomation} className="rounded-lg bg-amber-500 text-black font-semibold px-4 py-2 text-sm w-full">Crear automatización</button>
          </div>

          {/* Automation List */}
          {automations.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No hay automatizaciones. Crea la primera.</p>
          ) : (
            <div className="space-y-2">
              {automations.map(a => (
                <div key={a.id} className={`flex items-center gap-3 rounded-xl border p-3 ${a.is_active ? 'border-border bg-card' : 'bg-card opacity-50'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.trigger_type} → {a.action_type}
                    </p>
                  </div>
                  <button onClick={() => toggleAutomation(a, !a.is_active)} className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-border ${a.is_active ? 'text-green-400' : ''}`}>
                    {a.is_active ? 'ON' : 'OFF'}
                  </button>
                  <button onClick={() => deleteAutomation(a.id)} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-border text-red-400">Eliminar</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'campaigns' && (
        <div className="space-y-5">
          {/* Campaign Builder */}
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <p className="font-semibold text-sm">Nueva campaña</p>
            <div>
              <label className="block text-xs font-semibold mb-1">Nombre</label>
              <input value={cmpName} onChange={e => setCmpName(e.target.value)} placeholder="Reactivación Julio"
                className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold mb-1">Objetivo</label>
                <select value={cmpObjective} onChange={e => setCmpObjective(e.target.value)}
                  className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm">
                  <option value="increase_sales">Aumentar ventas</option>
                  <option value="recover_inactive">Recuperar inactivos</option>
                  <option value="reward_loyal">Premiar leales</option>
                  <option value="birthday">Cumpleaños</option>
                  <option value="anniversary">Aniversario</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Tipo de oferta</label>
                <select value={cmpOfferType} onChange={e => setCmpOfferType(e.target.value)}
                  className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm">
                  <option value="percentage">Porcentaje (%)</option>
                  <option value="fixed">Monto fijo ($)</option>
                  <option value="free_item">Producto gratis</option>
                  <option value="points_multiplier">Puntos x2</option>
                  <option value="free_delivery">Delivery gratis</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Valor</label>
              <input type="number" value={cmpOfferValue} onChange={e => setCmpOfferValue(e.target.value)} placeholder="15"
                className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Canales</label>
              <div className="flex gap-2 flex-wrap">
                {['push', 'whatsapp', 'wallet', 'notification'].map(ch => (
                  <button key={ch} onClick={() => toggleChannel(ch)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${cmpChannels.includes(ch) ? 'bg-amber-500 text-black border-amber-500' : 'border-border'}`}>
                    {ch === 'push' ? '📲 Push' : ch === 'whatsapp' ? '💬 WhatsApp' : ch === 'wallet' ? '📱 Wallet' : '🔔 In-App'}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={createCampaign} className="rounded-lg bg-amber-500 text-black font-semibold px-4 py-2 text-sm w-full">Crear campaña</button>
          </div>

          {/* Campaign List */}
          {campaigns.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No hay campañas activas.</p>
          ) : (
            <div className="space-y-2">
              {campaigns.map(c => (
                <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.objective} · {c.channels?.join(', ')} · {c.status}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-bold">{c.sentCount} enviados</p>
                    <p className="text-muted-foreground">{c.convertedCount} convertidos</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'copilot' && (
        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl border border-border bg-card p-5">
            <AICopilot />
          </div>
        </div>
      )}
    </div>
  )
}
