'use client'

/**
 * consumer-routine.tsx
 * Vista "Mi Rutina" del usuario final (cliente logueado). Overlay full-screen
 * que NO modifica las secciones existentes del marketplace; se abre como el
 * carrito. Cross-comercio: los datos pertenecen al usuario, no a un tenant.
 *
 * Pestañas internas: Hoy (resumen) · Despensa · Recetas · Plan · Compras
 */
import { useState, useEffect, useCallback } from 'react'
import {
  X, Home, Carrot, ChefHat, CalendarDays, ShoppingBasket, Plus, Trash2,
  Check, Clock, AlertTriangle, Sparkles, Loader2,
} from 'lucide-react'
import { api } from '@/lib/api'

type Tab = 'hoy' | 'despensa' | 'recetas' | 'plan' | 'compras'

const MEALS = [
  { key: 'desayuno', label: 'Desayuno' },
  { key: 'media_manana', label: 'Media mañana' },
  { key: 'almuerzo', label: 'Almuerzo' },
  { key: 'onces', label: 'Onces' },
  { key: 'cena', label: 'Cena' },
  { key: 'snack', label: 'Snack' },
]

export default function ConsumerRoutine({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('hoy')
  const [loading, setLoading] = useState(false)

  const [resumen, setResumen] = useState<any>(null)
  const [despensa, setDespensa] = useState<any[]>([])
  const [recetas, setRecetas] = useState<any[]>([])
  const [puedoHacer, setPuedoHacer] = useState<any[]>([])
  const [plan, setPlan] = useState<any[]>([])
  const [compras, setCompras] = useState<any[]>([])

  const today = new Date().toISOString().slice(0, 10)

  const load = useCallback(async (t: Tab) => {
    setLoading(true)
    try {
      if (t === 'hoy') {
        const [r, p] = await Promise.all([api.getRutinaResumen(), api.getPlanComidas(today, today)])
        if (r.success) setResumen(r.data); if (p.success) setPlan(p.data || [])
      } else if (t === 'despensa') {
        const r = await api.getDespensa(); if (r.success) setDespensa(r.data || [])
      } else if (t === 'recetas') {
        const [a, b] = await Promise.all([api.getRutinaRecetas(), api.getRecetasQuePuedoHacer()])
        if (a.success) setRecetas(a.data || []); if (b.success) setPuedoHacer(b.data || [])
      } else if (t === 'plan') {
        const r = await api.getPlanComidas(today, today); if (r.success) setPlan(r.data || [])
      } else if (t === 'compras') {
        const r = await api.getListaCompras(); if (r.success) setCompras(r.data || [])
      }
    } finally { setLoading(false) }
  }, [today])

  useEffect(() => { load(tab) }, [tab, load])

  return (
    <div className="fixed inset-0 z-[80] bg-white text-neutral-900 flex flex-col md:hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-black/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <span className="text-sm font-semibold tracking-wide uppercase">Mi Rutina</span>
        </div>
        <button onClick={onClose} className="p-2 -mr-2 text-neutral-500 hover:text-neutral-900"><X className="w-5 h-5" /></button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-20">
        {loading && (
          <div className="flex justify-center py-10 text-neutral-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        )}

        {!loading && tab === 'hoy' && <HoyView resumen={resumen} plan={plan} onReload={() => load('hoy')} onGoTo={setTab} />}
        {!loading && tab === 'despensa' && <DespensaView items={despensa} onReload={() => load('despensa')} />}
        {!loading && tab === 'recetas' && <RecetasView recetas={recetas} puedoHacer={puedoHacer} onReload={() => load('recetas')} />}
        {!loading && tab === 'plan' && <PlanView plan={plan} recetas={recetas} onReload={() => load('plan')} today={today} />}
        {!loading && tab === 'compras' && <ComprasView items={compras} onReload={() => load('compras')} />}
      </div>

      {/* Internal tab bar */}
      <div className="absolute bottom-0 left-0 right-0 h-16 border-t border-black/10 bg-white flex items-center justify-around" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {([
          { k: 'hoy', icon: Home, label: 'Hoy' },
          { k: 'despensa', icon: Carrot, label: 'Despensa' },
          { k: 'recetas', icon: ChefHat, label: 'Recetas' },
          { k: 'plan', icon: CalendarDays, label: 'Plan' },
          { k: 'compras', icon: ShoppingBasket, label: 'Compras' },
        ] as const).map(({ k, icon: Icon, label }) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex flex-col items-center gap-0.5 flex-1 h-full justify-center transition-colors ${tab === k ? 'text-amber-600' : 'text-neutral-400'}`}>
            <Icon className="w-5 h-5" />
            <span className="text-[10px]">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────── HOY ───────────────────────────
function HoyView({ resumen, plan, onReload, onGoTo }: any) {
  const cards = [
    { label: 'En despensa', value: resumen?.despensaCount ?? 0, icon: Carrot, color: 'text-emerald-400' },
    { label: 'Por vencer', value: resumen?.porVencerCount ?? 0, icon: AlertTriangle, color: 'text-orange-400' },
    { label: 'Por comprar', value: resumen?.comprasPendientes ?? 0, icon: ShoppingBasket, color: 'text-sky-400' },
    { label: 'Comidas hoy', value: resumen?.comidasHoy ?? 0, icon: CalendarDays, color: 'text-amber-400' },
  ]
  return (
    <div className="p-4 space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {cards.map(c => (
          <div key={c.label} className="rounded-2xl bg-black/5 border border-black/10 p-4">
            <c.icon className={`w-5 h-5 ${c.color}`} />
            <div className="text-2xl font-bold mt-2">{c.value}</div>
            <div className="text-[11px] text-neutral-500">{c.label}</div>
          </div>
        ))}
      </div>

      {resumen?.perfil?.dailyCalorieTarget ? (
        <div className="rounded-2xl bg-black/5 border border-black/10 p-4 text-sm text-neutral-600">
          Meta diaria: <span className="text-neutral-900 font-semibold">{resumen.perfil.dailyCalorieTarget} kcal</span>
          {resumen.perfil.goal && <span className="text-neutral-500"> · {String(resumen.perfil.goal).replace('_', ' ')}</span>}
        </div>
      ) : null}

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Comidas de hoy</h3>
          <button onClick={() => onGoTo('plan')} className="text-xs text-amber-600">Ver plan</button>
        </div>
        {plan?.length ? (
          <div className="space-y-2">
            {plan.map((m: any) => (
              <div key={m.id} className="flex items-center gap-3 rounded-xl bg-black/5 border border-black/10 px-3 py-2.5">
                <Check className={`w-4 h-4 ${m.isDone ? 'text-emerald-400' : 'text-neutral-300'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{m.title || 'Comida'}</div>
                  <div className="text-[11px] text-neutral-500 capitalize">{String(m.mealType).replace('_', ' ')}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-neutral-500">Aún no has planeado comidas para hoy.</p>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────── DESPENSA ───────────────────────────
function DespensaView({ items, onReload }: any) {
  const [name, setName] = useState(''); const [qty, setQty] = useState(''); const [unit, setUnit] = useState('')
  const [saving, setSaving] = useState(false)
  const add = async () => {
    if (!name.trim()) return
    setSaving(true)
    await api.addDespensa({ name, quantity: Number(qty) || 0, unit: unit || null })
    setName(''); setQty(''); setUnit(''); setSaving(false); onReload()
  }
  const expSoon = (d: string | null) => d && new Date(d) <= new Date(Date.now() + 3 * 864e5)
  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Pechuga de pollo"
          className="flex-1 bg-black/5 border border-black/10 rounded-xl px-3 py-2.5 text-sm placeholder:text-neutral-400 outline-none focus:border-amber-500/60" />
        <input value={qty} onChange={e => setQty(e.target.value)} placeholder="Cant." inputMode="decimal"
          className="w-16 bg-black/5 border border-black/10 rounded-xl px-2 py-2.5 text-sm text-center placeholder:text-neutral-400 outline-none" />
        <button onClick={add} disabled={saving} className="bg-amber-400 text-black rounded-xl px-3 disabled:opacity-50"><Plus className="w-5 h-5" /></button>
      </div>
      {items?.length ? (
        <div className="space-y-2">
          {items.map((it: any) => (
            <div key={it.id} className="flex items-center gap-3 rounded-xl bg-black/5 border border-black/10 px-3 py-2.5">
              <Carrot className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{it.name}</div>
                <div className="text-[11px] text-neutral-500">
                  {it.quantity}{it.unit ? ` ${it.unit}` : ''}
                  {it.expiresAt && <span className={expSoon(it.expiresAt) ? 'text-orange-400 ml-2' : 'text-neutral-400 ml-2'}>· vence {String(it.expiresAt).slice(0, 10)}</span>}
                </div>
              </div>
              <button onClick={async () => { await api.deleteDespensa(it.id); onReload() }} className="text-neutral-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      ) : <p className="text-xs text-neutral-500">Tu despensa está vacía. Agrega lo que tienes en casa.</p>}
    </div>
  )
}

// ─────────────────────────── RECETAS ───────────────────────────
function RecetasView({ recetas, puedoHacer, onReload }: any) {
  return (
    <div className="p-4 space-y-5">
      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-400" /> Puedo cocinar ahora</h3>
        {puedoHacer?.length ? (
          <div className="space-y-2">
            {puedoHacer.slice(0, 8).map((r: any) => (
              <div key={r.id} className="rounded-xl bg-black/5 border border-black/10 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm">{r.name}</span>
                  <span className={`text-xs font-semibold ${r.canCook ? 'text-emerald-400' : 'text-neutral-500'}`}>{r.matchPct}%</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-black/10 overflow-hidden">
                  <div className={`h-full ${r.canCook ? 'bg-emerald-400' : 'bg-amber-400'}`} style={{ width: `${r.matchPct}%` }} />
                </div>
                {r.missing?.length > 0 && (
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[11px] text-neutral-500 truncate">Falta: {r.missing.join(', ')}</span>
                    <button onClick={async () => { await api.recetaALista(r.id); alert('Agregado a tu lista de compras') }} className="text-[11px] text-sky-600 flex-shrink-0 ml-2">+ Lista</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : <p className="text-xs text-neutral-500">Crea recetas y registra tu despensa para ver qué puedes cocinar.</p>}
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Mis recetas</h3>
        {recetas?.length ? (
          <div className="space-y-2">
            {recetas.map((r: any) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl bg-black/5 border border-black/10 px-3 py-2.5">
                <ChefHat className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{r.name}</div>
                  <div className="text-[11px] text-neutral-500 flex items-center gap-2">
                    {r.prepMinutes ? <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{r.prepMinutes}m</span> : null}
                    {r.calories ? <span>{r.calories} kcal</span> : null}
                  </div>
                </div>
                <button onClick={async () => { await api.deleteRutinaReceta(r.id); onReload() }} className="text-neutral-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        ) : <p className="text-xs text-neutral-500">Aún no tienes recetas guardadas.</p>}
      </div>
    </div>
  )
}

// ─────────────────────────── PLAN ───────────────────────────
function PlanView({ plan, onReload, today }: any) {
  const [meal, setMeal] = useState('almuerzo'); const [title, setTitle] = useState('')
  const add = async () => {
    if (!title.trim()) return
    await api.addPlanComida({ planDate: today, mealType: meal, title })
    setTitle(''); onReload()
  }
  return (
    <div className="p-4 space-y-4">
      <div className="text-xs text-neutral-500">Plan para hoy · {today}</div>
      <div className="flex gap-2">
        <select value={meal} onChange={e => setMeal(e.target.value)} className="bg-black/5 border border-black/10 rounded-xl px-2 py-2.5 text-sm outline-none">
          {MEALS.map(m => <option key={m.key} value={m.key} className="bg-white">{m.label}</option>)}
        </select>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="¿Qué vas a comer?"
          className="flex-1 bg-black/5 border border-black/10 rounded-xl px-3 py-2.5 text-sm placeholder:text-neutral-400 outline-none focus:border-amber-500/60" />
        <button onClick={add} className="bg-amber-400 text-black rounded-xl px-3"><Plus className="w-5 h-5" /></button>
      </div>
      {plan?.length ? (
        <div className="space-y-2">
          {plan.map((m: any) => (
            <div key={m.id} className="flex items-center gap-3 rounded-xl bg-black/5 border border-black/10 px-3 py-2.5">
              <button onClick={async () => { await api.togglePlanComida(m.id); onReload() }}>
                <Check className={`w-5 h-5 ${m.isDone ? 'text-emerald-400' : 'text-neutral-300'}`} />
              </button>
              <div className="flex-1 min-w-0">
                <div className={`text-sm truncate ${m.isDone ? 'line-through text-neutral-500' : ''}`}>{m.title || 'Comida'}</div>
                <div className="text-[11px] text-neutral-500 capitalize">{String(m.mealType).replace('_', ' ')}</div>
              </div>
              <button onClick={async () => { await api.deletePlanComida(m.id); onReload() }} className="text-neutral-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      ) : <p className="text-xs text-neutral-500">Sin comidas planeadas para hoy.</p>}
    </div>
  )
}

// ─────────────────────────── COMPRAS ───────────────────────────
function ComprasView({ items, onReload }: any) {
  const [name, setName] = useState('')
  const add = async () => { if (!name.trim()) return; await api.addListaCompra({ name }); setName(''); onReload() }
  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Leche, huevos…"
          className="flex-1 bg-black/5 border border-black/10 rounded-xl px-3 py-2.5 text-sm placeholder:text-neutral-400 outline-none focus:border-amber-500/60" />
        <button onClick={add} className="bg-amber-400 text-black rounded-xl px-3"><Plus className="w-5 h-5" /></button>
      </div>
      {items?.length ? (
        <div className="space-y-2">
          {items.map((it: any) => (
            <div key={it.id} className="flex items-center gap-3 rounded-xl bg-black/5 border border-black/10 px-3 py-2.5">
              <button onClick={async () => { await api.toggleListaCompra(it.id); onReload() }}>
                <Check className={`w-5 h-5 ${it.isPurchased ? 'text-emerald-400' : 'text-neutral-300'}`} />
              </button>
              <div className="flex-1 min-w-0">
                <div className={`text-sm truncate ${it.isPurchased ? 'line-through text-neutral-500' : ''}`}>{it.name}</div>
                <div className="text-[11px] text-neutral-500">
                  {it.quantity}{it.unit ? ` ${it.unit}` : ''}
                  {it.tenantName && <span className="text-sky-600 ml-2">· {it.tenantName}</span>}
                </div>
              </div>
              <button onClick={async () => { await api.deleteListaCompra(it.id); onReload() }} className="text-neutral-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      ) : <p className="text-xs text-neutral-500">Tu lista de compras está vacía.</p>}
    </div>
  )
}
