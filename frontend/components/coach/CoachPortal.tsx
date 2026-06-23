'use client'

/**
 * CoachPortal — portal del entrenador (T6). Auth propia (trainerToken).
 * Vistas: Resumen (wallet + retiros), Programas (CRUD ofertas), Clientes (feed
 * de coaching), Retiros (historial) y Perfil. El coach vive aquí; el consumidor
 * lo ve desde su OS (CoachSection / ProgramFeed).
 */
import { useEffect, useState } from 'react'
import {
  Loader2, Wallet, Dumbbell, Users, ArrowDownToLine, UserCog, LogOut,
  Plus, Send, Star, TrendingUp, Clock, CheckCircle2, Crown, ArrowLeft,
} from 'lucide-react'
import { api } from '@/lib/api'

const COP = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n) || 0)
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
const ASSET = API_URL.replace(/\/api$/, '')
const abs = (u?: string | null) => (!u ? '' : u.startsWith('http') ? u : `${ASSET}${u}`)
const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')

const KIND_LABEL: Record<string, string> = { programa: 'Programa', sesion: 'Sesión', mensual: 'Mensualidad', combo: 'Combo' }
const WD_STATUS: Record<string, { label: string; cls: string }> = {
  requested: { label: 'Solicitado', cls: 'bg-amber-100 text-amber-700' },
  processing: { label: 'En proceso', cls: 'bg-sky-100 text-sky-700' },
  paid: { label: 'Pagado', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rechazado', cls: 'bg-red-100 text-red-700' },
}
const COMM_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Reteniendo (7d)', cls: 'bg-amber-100 text-amber-700' },
  available: { label: 'Disponible', cls: 'bg-emerald-100 text-emerald-700' },
  paid: { label: 'Pagado', cls: 'bg-neutral-200 text-neutral-600' },
}

type Tab = 'resumen' | 'programas' | 'clientes' | 'retiros' | 'perfil'

export default function CoachPortal() {
  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState<any>(null)
  const [tab, setTab] = useState<Tab>('resumen')

  useEffect(() => {
    api.getTrainerMe().then(r => { if (r.success) setMe(r.data) }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-neutral-950"><Loader2 className="w-7 h-7 animate-spin text-sky-400" /></div>
  if (!me) return <AuthView onAuthed={setMe} />

  const NAV: { id: Tab; label: string; icon: any }[] = [
    { id: 'resumen', label: 'Resumen', icon: Wallet },
    { id: 'programas', label: 'Programas', icon: Dumbbell },
    { id: 'clientes', label: 'Clientes', icon: Users },
    { id: 'retiros', label: 'Retiros', icon: ArrowDownToLine },
    { id: 'perfil', label: 'Perfil', icon: UserCog },
  ]

  const logout = async () => { await api.trainerLogout(); setMe(null) }

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col md:flex-row">
      {/* Sidebar (desktop) / topbar (mobile) */}
      <aside className="md:w-64 bg-neutral-950 text-white md:min-h-screen flex md:flex-col">
        <div className="p-4 md:p-6 flex items-center gap-2 border-b border-white/10 md:border-b-0">
          <Crown className="w-5 h-5 text-amber-400" />
          <div className="min-w-0">
            <p className="font-bold leading-tight truncate">{me.name}</p>
            <p className="text-[11px] text-white/50">Coach DAIMUZ</p>
          </div>
        </div>
        <nav className="flex md:flex-col gap-1 p-2 md:p-3 overflow-x-auto flex-1">
          {NAV.map(n => {
            const Icon = n.icon
            return (
              <button key={n.id} onClick={() => setTab(n.id)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${tab === n.id ? 'bg-sky-500 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
                <Icon className="w-4 h-4" /> {n.label}
              </button>
            )
          })}
        </nav>
        <button onClick={logout} className="hidden md:flex items-center gap-2 m-3 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5">
          <LogOut className="w-4 h-4" /> Cerrar sesión
        </button>
      </aside>

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full">
        {tab === 'resumen' && <ResumenView me={me} />}
        {tab === 'programas' && <ProgramasView />}
        {tab === 'clientes' && <ClientesView />}
        {tab === 'retiros' && <RetirosView />}
        {tab === 'perfil' && <PerfilView me={me} onUpdate={setMe} onLogout={logout} />}
      </main>
    </div>
  )
}

// ── Auth (login / registro) ──────────────────────────────────────────────────
function AuthView({ onAuthed }: { onAuthed: (t: any) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [form, setForm] = useState({ name: '', email: '', password: '', handle: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setErr(''); setBusy(true)
    try {
      const r = mode === 'login'
        ? await api.trainerLogin(form.email, form.password)
        : await api.trainerRegister({ name: form.name, email: form.email, password: form.password, handle: form.handle || undefined })
      if (r.success && r.data?.trainer) { onAuthed(r.data.trainer); return }
      setErr(r.error || 'No se pudo continuar.')
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-6">
          <Crown className="w-6 h-6 text-amber-400" />
          <h1 className="text-xl font-extrabold">Portal Coach</h1>
        </div>
        <div className="bg-neutral-900 rounded-2xl p-6 border border-white/10 space-y-3">
          <p className="text-sm text-white/60 text-center mb-2">{mode === 'login' ? 'Entra a tu panel de entrenador' : 'Crea tu cuenta de coach'}</p>
          {mode === 'register' && (
            <input placeholder="Nombre completo" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-xl bg-neutral-800 border border-white/10 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400" />
          )}
          <input placeholder="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
            className="w-full rounded-xl bg-neutral-800 border border-white/10 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400" />
          <input placeholder="Contraseña" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && submit()}
            className="w-full rounded-xl bg-neutral-800 border border-white/10 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400" />
          {mode === 'register' && (
            <input placeholder="@usuario (opcional)" value={form.handle} onChange={e => setForm({ ...form, handle: e.target.value })}
              className="w-full rounded-xl bg-neutral-800 border border-white/10 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400" />
          )}
          {err && <p className="text-sm text-red-400">{err}</p>}
          <button onClick={submit} disabled={busy}
            className="w-full rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold py-2.5 disabled:opacity-60 flex items-center justify-center gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
          <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr('') }}
            className="w-full text-center text-xs text-white/50 hover:text-white pt-1">
            {mode === 'login' ? '¿No tienes cuenta? Regístrate como coach' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Resumen / Wallet ─────────────────────────────────────────────────────────
function ResumenView({ me }: { me: any }) {
  const [wallet, setWallet] = useState<any>(null)
  const [commissions, setCommissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const [w, c] = await Promise.all([api.getTrainerWallet(), api.getTrainerCommissions()])
    if (w.success) setWallet(w.data)
    if (c.success) setCommissions(c.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  if (loading) return <Center />

  return (
    <div className="space-y-6">
      <Header title="Tu billetera" subtitle="Comisiones liberadas 7 días después de cada venta (antifraude)." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Wallet} label="Disponible" value={COP(wallet?.balanceCop || 0)} accent="text-emerald-600" />
        <StatCard icon={Clock} label="Reteniendo" value={COP(wallet?.pendingCop || 0)} accent="text-amber-600" />
        <StatCard icon={TrendingUp} label="Neto histórico" value={COP(wallet?.lifetimeNetCop || 0)} />
        <StatCard icon={Star} label="Ventas" value={String(wallet?.salesCount || 0)} />
      </div>

      <WithdrawCard balance={wallet?.balanceCop || 0} onDone={load} />

      <div>
        <h3 className="text-sm font-bold text-neutral-800 mb-2">Comisiones recientes</h3>
        {commissions.length === 0 ? (
          <p className="text-sm text-neutral-400 py-6 text-center">Aún no tienes ventas. Publica tus programas para empezar.</p>
        ) : (
          <div className="space-y-2">
            {commissions.map(c => {
              const st = COMM_STATUS[c.status] || COMM_STATUS.pending
              return (
                <div key={c.id} className="bg-white rounded-xl border border-black/[0.06] p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-neutral-900 truncate">{c.program}</p>
                    <p className="text-[11px] text-neutral-400">{fmtDate(c.createdAt)} · venta {COP(c.grossCop)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-neutral-900">{COP(c.trainerCop)}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <p className="text-[11px] text-neutral-400">
        Comisión plataforma: {me.commissionPct}% (mín. {COP(me.minCommissionCop)}). La pasarela la absorbe el coach.
      </p>
    </div>
  )
}

function WithdrawCard({ balance, onDone }: { balance: number; onDone: () => void }) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('')
  const [err, setErr] = useState(''); const [okMsg, setOkMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setErr(''); setOkMsg(''); setBusy(true)
    try {
      const r = await api.requestTrainerWithdrawal({ amountCop: Number(amount), paymentMethod: method.trim() })
      if (r.success) { setOkMsg('Retiro solicitado. El equipo lo procesará pronto.'); setAmount(''); setMethod(''); onDone() }
      else setErr(r.error || 'No se pudo solicitar el retiro.')
    } finally { setBusy(false) }
  }

  return (
    <div className="bg-white rounded-2xl border border-black/[0.06] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-neutral-800">Solicitar retiro</h3>
        <span className="text-xs text-neutral-400">Disponible: {COP(balance)}</span>
      </div>
      <div className="grid sm:grid-cols-[1fr_1.4fr_auto] gap-2">
        <input inputMode="numeric" placeholder="Monto COP" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
          className="rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400" />
        <input placeholder="Nequi / cuenta / etc." value={method} onChange={e => setMethod(e.target.value)}
          className="rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400" />
        <button onClick={submit} disabled={busy || !amount || !method.trim()}
          className="rounded-xl bg-neutral-900 text-white text-sm font-semibold px-5 py-2.5 hover:bg-black disabled:opacity-50 flex items-center justify-center gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Solicitar'}
        </button>
      </div>
      {err && <p className="text-xs text-red-500 mt-2">{err}</p>}
      {okMsg && <p className="text-xs text-emerald-600 mt-2">{okMsg}</p>}
      <p className="text-[11px] text-neutral-400 mt-2">Retiro mínimo: {COP(50000)}.</p>
    </div>
  )
}

// ── Programas (ofertas) ──────────────────────────────────────────────────────
function ProgramasView() {
  const [offers, setOffers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any | null>(null)
  const [creating, setCreating] = useState(false)

  const load = async () => { const r = await api.getTrainerOffers(); if (r.success) setOffers(r.data || []); setLoading(false) }
  useEffect(() => { load() }, [])

  const remove = async (id: string) => { await api.deleteTrainerOffer(id); load() }

  if (loading) return <Center />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Header title="Tus programas" subtitle="Vendes transformaciones, no sesiones sueltas." />
        <button onClick={() => setCreating(true)} className="rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-semibold px-4 py-2 flex items-center gap-1.5 shrink-0">
          <Plus className="w-4 h-4" /> Nuevo
        </button>
      </div>

      {offers.length === 0 ? (
        <p className="text-sm text-neutral-400 py-10 text-center">Aún no publicas programas. Crea el primero.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {offers.map(o => (
            <div key={o.id} className={`bg-white rounded-2xl border p-4 ${o.isActive ? 'border-black/[0.06]' : 'border-dashed border-neutral-300 opacity-70'}`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600">{KIND_LABEL[o.kind] || o.kind}</span>
                {o.durationDays ? <span className="text-[11px] text-neutral-400">{o.durationDays} días</span> : null}
              </div>
              <p className="font-bold text-neutral-900 mt-1">{o.title}</p>
              {o.description && <p className="text-sm text-neutral-500 mt-1 line-clamp-2">{o.description}</p>}
              <div className="flex items-center justify-between mt-3">
                <span className="text-lg font-extrabold text-neutral-900">{COP(o.priceCop)}</span>
                <div className="flex gap-1.5">
                  <button onClick={() => setEditing(o)} className="text-xs font-medium text-sky-600 hover:underline px-2 py-1">Editar</button>
                  <button onClick={() => remove(o.id)} className="text-xs font-medium text-red-500 hover:underline px-2 py-1">{o.isActive ? 'Despublicar' : 'Quitar'}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <OfferModal offer={editing} onClose={() => { setCreating(false); setEditing(null) }} onSaved={() => { setCreating(false); setEditing(null); load() }} />
      )}
    </div>
  )
}

function OfferModal({ offer, onClose, onSaved }: { offer: any | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: offer?.title || '', description: offer?.description || '', kind: offer?.kind || 'programa',
    priceCop: offer?.priceCop ? String(offer.priceCop) : '', durationDays: offer?.durationDays ? String(offer.durationDays) : '',
  })
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)

  const save = async () => {
    setErr(''); setBusy(true)
    try {
      const body: any = {
        title: form.title.trim(), description: form.description.trim() || undefined, kind: form.kind,
        priceCop: Number(form.priceCop), durationDays: form.durationDays ? Number(form.durationDays) : undefined,
      }
      const r = offer ? await api.updateTrainerOffer(offer.id, body) : await api.createTrainerOffer(body)
      if (r.success) onSaved()
      else setErr(r.error || 'No se pudo guardar.')
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-lg text-neutral-900">{offer ? 'Editar programa' : 'Nuevo programa'}</h3>
        <input placeholder="Título (ej. Recomposición 12 semanas)" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
          className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400" />
        <textarea placeholder="¿Qué incluye? ¿Para quién es?" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3}
          className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400 resize-none" />
        <div className="grid grid-cols-2 gap-2">
          <select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}
            className="rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400">
            {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input inputMode="numeric" placeholder="Duración (días)" value={form.durationDays} onChange={e => setForm({ ...form, durationDays: e.target.value.replace(/[^0-9]/g, '') })}
            className="rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400" />
        </div>
        <input inputMode="numeric" placeholder="Precio COP (mín. 500.000)" value={form.priceCop} onChange={e => setForm({ ...form, priceCop: e.target.value.replace(/[^0-9]/g, '') })}
          className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400" />
        {err && <p className="text-sm text-red-500">{err}</p>}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 rounded-xl border border-neutral-200 text-sm font-medium py-2.5 hover:bg-neutral-50">Cancelar</button>
          <button onClick={save} disabled={busy || !form.title.trim() || !form.priceCop}
            className="flex-1 rounded-xl bg-neutral-900 text-white text-sm font-semibold py-2.5 hover:bg-black disabled:opacity-50 flex items-center justify-center gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Clientes + feed ──────────────────────────────────────────────────────────
function ClientesView() {
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState<any | null>(null)

  useEffect(() => { api.getCoachClients().then(r => { if (r.success) setClients(r.data || []) }).finally(() => setLoading(false)) }, [])

  if (loading) return <Center />
  if (sel) return <ClientFeed client={sel} onBack={() => setSel(null)} />

  return (
    <div className="space-y-5">
      <Header title="Tus clientes" subtitle="Acompaña cada transformación desde el feed." />
      {clients.length === 0 ? (
        <p className="text-sm text-neutral-400 py-10 text-center">Aún no tienes clientes activos.</p>
      ) : (
        <div className="space-y-2">
          {clients.map(c => (
            <button key={c.bookingId} onClick={() => setSel(c)}
              className="w-full text-left bg-white rounded-xl border border-black/[0.06] p-3 flex items-center justify-between gap-3 hover:shadow-sm">
              <div className="min-w-0">
                <p className="font-medium text-neutral-900 truncate">{c.userName}</p>
                <p className="text-[11px] text-neutral-400">{c.program} · desde {fmtDate(c.startedAt)}</p>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.activationStatus === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-200 text-neutral-600'}`}>
                {c.activationStatus === 'active' ? 'Activo' : c.activationStatus}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const POST_KINDS = [
  { k: 'feedback', label: 'Feedback' },
  { k: 'checkin', label: 'Check-in' },
  { k: 'adjustment', label: 'Ajuste' },
  { k: 'task', label: 'Tarea' },
  { k: 'announcement', label: 'Anuncio' },
]

function ClientFeed({ client, onBack }: { client: any; onBack: () => void }) {
  const [feed, setFeed] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [kind, setKind] = useState('feedback')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => { const r = await api.getCoachClientFeed(client.bookingId); if (r.success) setFeed(r.data || []); setLoading(false) }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [client.bookingId])

  const post = async () => {
    const body = text.trim(); if (!body || busy) return
    setBusy(true); setText('')
    try { await api.postCoachClientFeed(client.bookingId, { kind, body }); await load() } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-neutral-500 hover:text-neutral-900 flex items-center gap-1.5"><ArrowLeft className="w-4 h-4" /> Clientes</button>
      <div className="bg-white rounded-2xl border border-black/[0.06] p-4">
        <p className="font-bold text-neutral-900">{client.userName}</p>
        <p className="text-xs text-neutral-400">{client.program}</p>
      </div>

      {loading ? <Center /> : (
        <div className="space-y-3">
          {feed.length === 0 && <p className="text-sm text-neutral-400 text-center py-4">Inicia la conversación con tu cliente.</p>}
          {feed.map(e => {
            const mine = e.author === 'coach'
            return (
              <div key={e.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${mine ? 'bg-sky-500 text-white' : 'bg-white border border-black/[0.06]'}`}>
                  {mine && e.kind !== 'reply' && <p className="text-[10px] font-bold uppercase mb-0.5 text-white/70">{POST_KINDS.find(p => p.k === e.kind)?.label || e.kind}</p>}
                  <p className="text-sm whitespace-pre-wrap">{e.body}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="sticky bottom-0 bg-neutral-100 pt-2 space-y-2">
        <div className="flex gap-1.5 overflow-x-auto">
          {POST_KINDS.map(p => (
            <button key={p.k} onClick={() => setKind(p.k)}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${kind === p.k ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-500 border border-neutral-200'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && post()} placeholder="Escribe a tu cliente…"
            className="flex-1 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400" />
          <button onClick={post} disabled={busy || !text.trim()} className="rounded-xl bg-neutral-900 text-white px-4 disabled:opacity-50 flex items-center justify-center"><Send className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  )
}

// ── Retiros (historial) ──────────────────────────────────────────────────────
function RetirosView() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { api.getTrainerWithdrawals().then(r => { if (r.success) setItems(r.data || []) }).finally(() => setLoading(false)) }, [])

  if (loading) return <Center />
  return (
    <div className="space-y-5">
      <Header title="Tus retiros" subtitle="Historial de solicitudes de pago." />
      {items.length === 0 ? (
        <p className="text-sm text-neutral-400 py-10 text-center">No has solicitado retiros todavía.</p>
      ) : (
        <div className="space-y-2">
          {items.map(w => {
            const st = WD_STATUS[w.status] || WD_STATUS.requested
            return (
              <div key={w.id} className="bg-white rounded-xl border border-black/[0.06] p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-neutral-900">{COP(w.amountCop)}</p>
                  <p className="text-[11px] text-neutral-400">{w.paymentMethod} · {fmtDate(w.createdAt)}</p>
                  {w.note && <p className="text-[11px] text-neutral-400 italic mt-0.5">{w.note}</p>}
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Perfil ───────────────────────────────────────────────────────────────────
function PerfilView({ me, onUpdate, onLogout }: { me: any; onUpdate: (t: any) => void; onLogout: () => void }) {
  const [form, setForm] = useState({ name: me.name || '', bio: me.bio || '', photoUrl: me.photoUrl || '', specialties: (me.specialties || []).join(', ') })
  const [busy, setBusy] = useState(false); const [okMsg, setOkMsg] = useState('')

  const save = async () => {
    setBusy(true); setOkMsg('')
    try {
      const r = await api.updateTrainerProfile({
        name: form.name.trim(), bio: form.bio.trim(), photoUrl: form.photoUrl.trim() || undefined,
        specialties: form.specialties.split(',').map((s: string) => s.trim()).filter(Boolean),
      })
      if (r.success) { onUpdate(r.data); setOkMsg('Perfil actualizado.') }
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-5 max-w-lg">
      <Header title="Tu perfil" subtitle="Así te ven los clientes en el catálogo." />
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-2xl bg-neutral-200 overflow-hidden shrink-0">
          {form.photoUrl ? <img src={abs(form.photoUrl)} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-neutral-400"><Dumbbell className="w-8 h-8" /></div>}
        </div>
        <div className="text-sm text-neutral-500">
          <p className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-400" /> {Number(me.ratingAvg || 0).toFixed(1)} · {me.sessionsCount || 0} transformaciones</p>
          <p className="text-[11px] mt-0.5">Comisión: {me.commissionPct}% (mín. {COP(me.minCommissionCop)})</p>
        </div>
      </div>
      <div className="space-y-3">
        <Field label="Nombre"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400" /></Field>
        <Field label="Bio"><textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} rows={3} className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400 resize-none" /></Field>
        <Field label="Foto (URL)"><input value={form.photoUrl} onChange={e => setForm({ ...form, photoUrl: e.target.value })} placeholder="https://…" className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400" /></Field>
        <Field label="Especialidades (separadas por coma)"><input value={form.specialties} onChange={e => setForm({ ...form, specialties: e.target.value })} placeholder="Hipertrofia, Pérdida de grasa…" className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400" /></Field>
      </div>
      {okMsg && <p className="text-sm text-emerald-600">{okMsg}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={busy} className="rounded-xl bg-neutral-900 text-white text-sm font-semibold px-5 py-2.5 hover:bg-black disabled:opacity-50 flex items-center gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Guardar
        </button>
        <button onClick={onLogout} className="rounded-xl border border-neutral-200 text-sm font-medium px-4 py-2.5 hover:bg-neutral-50 flex items-center gap-1.5 text-neutral-600 md:hidden">
          <LogOut className="w-4 h-4" /> Salir
        </button>
      </div>
    </div>
  )
}

// ── Primitivos ───────────────────────────────────────────────────────────────
function Center() { return <div className="flex justify-center py-16 text-neutral-300"><Loader2 className="w-7 h-7 animate-spin" /></div> }
function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return <div><h2 className="text-xl font-extrabold text-neutral-900">{title}</h2>{subtitle && <p className="text-sm text-neutral-500">{subtitle}</p>}</div>
}
function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-black/[0.06] p-3">
      <Icon className={`w-4 h-4 ${accent || 'text-neutral-400'}`} />
      <p className={`text-lg font-extrabold mt-1.5 ${accent || 'text-neutral-900'}`}>{value}</p>
      <p className="text-[11px] text-neutral-400">{label}</p>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-medium text-neutral-500 mb-1 block">{label}</span>{children}</label>
}
