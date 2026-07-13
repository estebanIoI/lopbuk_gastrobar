'use client'

/**
 * Componentes de CAJA POR TURNOS (evolución de cash-sessions).
 * ShiftSelector · EmployeePicker · ShiftEmployeeManager · BonusDiscountPanel ·
 * DailySummaryView · ShiftBadge
 */
import React, { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import {
  Sun, Sunset, Circle, UserPlus, Trash2, Pencil, Check, X, Loader2, Users,
  CalendarDays, ArrowDownUp, AlertTriangle,
} from 'lucide-react'

export type ShiftType = 'mañana' | 'tarde' | 'unico'
export interface PickedEmployee { userId?: string | null; name: string; role?: string | null; shiftValue?: number }
export interface ShiftBonus { shiftEmpId: string; type: 'bono' | 'descuento'; amount: number; concept?: string | null }

const SHIFTS: { v: ShiftType; label: string; icon: React.ElementType }[] = [
  { v: 'mañana', label: 'Mañana', icon: Sun },
  { v: 'tarde', label: 'Tarde', icon: Sunset },
  { v: 'unico', label: 'Único', icon: Circle },
]

// ── ShiftSelector ──────────────────────────────────────────────────────────────
export function ShiftSelector({ value, onChange }: { value: ShiftType; onChange: (v: ShiftType) => void }) {
  return (
    <div>
      <p className="text-sm font-medium mb-1.5">Turno</p>
      <div className="flex gap-2">
        {SHIFTS.map(s => {
          const I = s.icon as React.ComponentType<{ className?: string }>
          const on = value === s.v
          return (
            <button key={s.v} type="button" onClick={() => onChange(s.v)}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition ${on ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'}`}>
              <I className="w-4 h-4" /> {s.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── EmployeePicker ─────────────────────────────────────────────────────────────
export function EmployeePicker({ value, onChange }: { value: PickedEmployee[]; onChange: (v: PickedEmployee[]) => void }) {
  const [roster, setRoster] = useState<{ id: string; name: string; role: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [adhocName, setAdhocName] = useState('')
  const [adhocRole, setAdhocRole] = useState('')

  useEffect(() => {
    let alive = true
    api.getUsers().then(r => {
      if (!alive) return
      const users = (r?.data as any)?.users || (r as any)?.users || []
      setRoster(users.map((u: any) => ({ id: u.id, name: u.name, role: u.cargoName || u.cargo_name || u.role || '' })))
    }).catch(() => {}).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const isPicked = (id: string) => value.some(v => v.userId === id)
  const toggle = (u: { id: string; name: string; role: string }) => {
    if (isPicked(u.id)) onChange(value.filter(v => v.userId !== u.id))
    else onChange([...value, { userId: u.id, name: u.name, role: u.role, shiftValue: 0 }])
  }
  const addAdhoc = () => {
    const name = adhocName.trim(); if (!name) return
    onChange([...value, { userId: null, name, role: adhocRole.trim() || null, shiftValue: 0 }])
    setAdhocName(''); setAdhocRole('')
  }
  const removeAt = (idx: number) => onChange(value.filter((_, i) => i !== idx))
  const setShiftValue = (idx: number, val: string) =>
    onChange(value.map((v, i) => i === idx ? { ...v, shiftValue: Math.max(0, Number(val) || 0) } : v))

  const nominaTotal = value.reduce((s, v) => s + (Number(v.shiftValue) || 0), 0)

  return (
    <div>
      <p className="text-sm font-medium mb-1.5 flex items-center gap-1.5"><Users className="w-4 h-4" /> Empleados en este turno</p>
      <div className="border rounded-lg divide-y max-h-44 overflow-y-auto">
        {loading ? <div className="p-3 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div> :
          roster.length === 0 ? <p className="p-3 text-xs text-muted-foreground">Sin empleados registrados. Agrega ad-hoc abajo.</p> :
          roster.map(u => (
            <label key={u.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted/50">
              <input type="checkbox" checked={isPicked(u.id)} onChange={() => toggle(u)} className="accent-primary" />
              <span className="text-sm flex-1">{u.name}</span>
              {u.role && <span className="text-xs text-muted-foreground">({u.role})</span>}
            </label>
          ))}
      </div>

      {/* Agregar empleado sin cuenta */}
      <div className="flex gap-2 mt-2">
        <input value={adhocName} onChange={e => setAdhocName(e.target.value)} placeholder="Nombre (sin cuenta)" className="flex-1 border rounded-lg px-3 py-1.5 text-sm" />
        <input value={adhocRole} onChange={e => setAdhocRole(e.target.value)} placeholder="Rol" className="w-24 border rounded-lg px-3 py-1.5 text-sm" />
        <button type="button" onClick={addAdhoc} className="px-3 rounded-lg bg-muted hover:bg-muted/70 inline-flex items-center"><UserPlus className="w-4 h-4" /></button>
      </div>

      {/* Seleccionados: valor del turno (pago) por empleado */}
      {value.length > 0 && (
        <div className="mt-3 border rounded-lg p-2.5 space-y-2 bg-muted/30">
          <p className="text-xs font-semibold text-muted-foreground">Valor del turno por empleado</p>
          {value.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-sm flex-1 truncate">
                {v.name}{v.role && <span className="text-xs text-muted-foreground"> ({v.role})</span>}{!v.userId && <span className="text-xs text-amber-600"> · ad-hoc</span>}
              </span>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                <input type="number" min={0} value={v.shiftValue || ''} onChange={e => setShiftValue(i, e.target.value)}
                  placeholder="0" className="w-28 border rounded-lg pl-5 pr-2 py-1.5 text-sm" />
              </div>
              <button type="button" onClick={() => removeAt(i)} className="text-red-500 p-1" title="Quitar"><X className="w-4 h-4" /></button>
            </div>
          ))}
          <div className="flex justify-between items-center pt-1.5 border-t text-sm">
            <span className="font-medium">Nómina del turno</span>
            <span className="font-bold text-primary">{formatCOP(nominaTotal)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── ShiftEmployeeManager (durante el turno) ─────────────────────────────────────
export function ShiftEmployeeManager({ sessionId }: { sessionId: string }) {
  const [emps, setEmps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [roleVal, setRoleVal] = useState('')
  const [svVal, setSvVal] = useState('')
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState(''); const [role, setRole] = useState(''); const [sv, setSv] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { setEmps((await api.getShiftEmployees(sessionId))?.data || []) } catch { /* */ } finally { setLoading(false) }
  }, [sessionId])
  useEffect(() => { load() }, [load])

  const saveEdit = async (id: string) => { try { await api.updateShiftEmployee(sessionId, id, { role: roleVal, shiftValue: Math.max(0, Number(svVal) || 0) }); setEditing(null); load() } catch { /* */ } }
  const darBaja = async (id: string) => {
    const reason = prompt('Motivo de la baja (ej. canceló):') || ''
    try { await api.updateShiftEmployee(sessionId, id, { status: 'baja', bajaReason: reason }); load() } catch { /* */ }
  }
  const agregar = async () => {
    if (!name.trim()) return
    try { await api.addShiftEmployee(sessionId, { name: name.trim(), role: role.trim() || null, shiftValue: Math.max(0, Number(sv) || 0) }); setName(''); setRole(''); setSv(''); setAdding(false); load() } catch { /* */ }
  }

  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
  const nominaTotal = emps.reduce((s, e) => s + (Number(e.toPay) || 0), 0)
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold flex items-center gap-1.5"><Users className="w-4 h-4" /> Empleados del turno</p>
      {emps.length === 0 && <p className="text-xs text-muted-foreground">Sin empleados asignados.</p>}
      {emps.map(e => (
        <div key={e.id} className={`flex items-center gap-2 border rounded-lg px-3 py-2 ${e.status === 'baja' ? 'opacity-60 bg-red-50' : ''}`}>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{e.name} {e.status === 'baja' && <span className="text-xs text-red-600">❌ baja{e.bajaReason ? ` · ${e.bajaReason}` : ''}</span>}</p>
            {editing === e.id ? (
              <div className="flex gap-1 mt-1 flex-wrap">
                <input value={roleVal} onChange={ev => setRoleVal(ev.target.value)} className="border rounded px-2 py-0.5 text-xs w-24" placeholder="Rol" />
                <input type="number" min={0} value={svVal} onChange={ev => setSvVal(ev.target.value)} className="border rounded px-2 py-0.5 text-xs w-24" placeholder="Valor turno $" />
                <button onClick={() => saveEdit(e.id)} className="text-emerald-600"><Check className="w-4 h-4" /></button>
                <button onClick={() => setEditing(null)} className="text-gray-400"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {e.role || 'sin rol'}{e.userId ? '' : ' · ad-hoc'} · Turno: <span className="font-medium text-foreground">{formatCOP(Number(e.shiftValue) || 0)}</span>
              </p>
            )}
          </div>
          {e.status !== 'baja' && <>
            <button onClick={() => { setEditing(e.id); setRoleVal(e.role || ''); setSvVal(String(e.shiftValue || '')) }} className="p-1.5 rounded hover:bg-muted text-muted-foreground" title="Editar rol y valor"><Pencil className="w-4 h-4" /></button>
            <button onClick={() => darBaja(e.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Dar de baja"><Trash2 className="w-4 h-4" /></button>
          </>}
        </div>
      ))}
      {emps.length > 0 && (
        <div className="flex justify-between items-center text-sm px-1 pt-1">
          <span className="text-muted-foreground">Nómina del turno (a pagar)</span>
          <span className="font-bold text-primary">{formatCOP(nominaTotal)}</span>
        </div>
      )}
      {adding ? (
        <div className="flex gap-2 flex-wrap">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre" className="flex-1 min-w-[120px] border rounded-lg px-3 py-1.5 text-sm" />
          <input value={role} onChange={e => setRole(e.target.value)} placeholder="Rol" className="w-20 border rounded-lg px-3 py-1.5 text-sm" />
          <input type="number" min={0} value={sv} onChange={e => setSv(e.target.value)} placeholder="Valor $" className="w-24 border rounded-lg px-3 py-1.5 text-sm" />
          <button onClick={agregar} className="px-3 rounded-lg bg-primary text-primary-foreground text-sm">Agregar</button>
          <button onClick={() => setAdding(false)} className="text-gray-400 px-2"><X className="w-4 h-4" /></button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="text-sm text-primary inline-flex items-center gap-1"><UserPlus className="w-4 h-4" /> Agregar empleado al turno</button>
      )}
    </div>
  )
}

// ── BonusDiscountPanel (en el cierre) ───────────────────────────────────────────
export function BonusDiscountPanel({ sessionId, onChange }: { sessionId: string; onChange: (bonuses: ShiftBonus[]) => void }) {
  const [emps, setEmps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  // state[empId] = { bono, bonoC, desc, descC }
  const [vals, setVals] = useState<Record<string, { bono: string; bonoC: string; desc: string; descC: string }>>({})

  useEffect(() => {
    let alive = true
    api.getShiftEmployees(sessionId).then(r => { if (alive) setEmps(r?.data || []) }).catch(() => {}).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [sessionId])

  const set = (id: string, k: 'bono' | 'bonoC' | 'desc' | 'descC', v: string) => {
    setVals(prev => {
      const next = { ...prev, [id]: { ...prev[id], bono: '', bonoC: '', desc: '', descC: '', [k]: v } }
      // recalcula y emite
      const out: ShiftBonus[] = []
      for (const [empId, val] of Object.entries(next)) {
        if (Number(val.bono) > 0) out.push({ shiftEmpId: empId, type: 'bono', amount: Number(val.bono), concept: val.bonoC || null })
        if (Number(val.desc) > 0) out.push({ shiftEmpId: empId, type: 'descuento', amount: Number(val.desc), concept: val.descC || null })
      }
      onChange(out)
      return next
    })
  }

  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
  if (emps.length === 0) return <p className="text-xs text-muted-foreground">Este turno no tiene empleados asignados.</p>
  const nominaTotal = emps.reduce((s, e) => {
    const v = vals[e.id] || {}
    const toPay = Math.max(0, (Number(e.shiftValue) || 0) + (Number(v.bono) || 0) - (Number(v.desc) || 0))
    return s + toPay
  }, 0)
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">Pago del turno · bonos y descuentos</p>
      {emps.map(e => {
        const v = vals[e.id] || { bono: '', bonoC: '', desc: '', descC: '' }
        const toPay = Math.max(0, (Number(e.shiftValue) || 0) + (Number(v.bono) || 0) - (Number(v.desc) || 0))
        return (
          <div key={e.id} className={`border rounded-lg p-3 ${e.status === 'baja' ? 'opacity-70' : ''}`}>
            <div className="flex items-center justify-between flex-wrap gap-1">
              <p className="text-sm font-medium">{e.name} <span className="text-xs text-muted-foreground">({e.role || 'sin rol'}{e.status === 'baja' ? ' · baja' : ''})</span></p>
              <p className="text-xs text-muted-foreground">Valor turno: <span className="font-medium text-foreground">{formatCOP(Number(e.shiftValue) || 0)}</span></p>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 mt-2">
              <div className="flex gap-1.5 items-center">
                <span className="text-xs text-emerald-700 w-10">Bono</span>
                <input type="number" min={0} value={v.bono} onChange={ev => set(e.id, 'bono', ev.target.value)} placeholder="$" className="w-24 border rounded px-2 py-1 text-sm" />
                <input value={v.bonoC} onChange={ev => set(e.id, 'bonoC', ev.target.value)} placeholder="concepto" className="flex-1 border rounded px-2 py-1 text-sm" />
              </div>
              <div className="flex gap-1.5 items-center">
                <span className="text-xs text-red-700 w-10">Desc</span>
                <input type="number" min={0} value={v.desc} onChange={ev => set(e.id, 'desc', ev.target.value)} placeholder="$" className="w-24 border rounded px-2 py-1 text-sm" />
                <input value={v.descC} onChange={ev => set(e.id, 'descC', ev.target.value)} placeholder="concepto" className="flex-1 border rounded px-2 py-1 text-sm" />
              </div>
            </div>
            <div className="flex justify-end mt-2 text-sm">
              <span className="text-muted-foreground mr-2">A pagar:</span><span className="font-semibold">{formatCOP(toPay)}</span>
            </div>
          </div>
        )
      })}
      <div className="flex justify-between items-center border-t pt-2 text-sm">
        <span className="font-semibold">Total nómina a pagar</span>
        <span className="font-bold text-primary text-base">{formatCOP(nominaTotal)}</span>
      </div>
    </div>
  )
}

// ── ShiftBadge ─────────────────────────────────────────────────────────────────
export function ShiftBadge({ shiftType, shiftLabel }: { shiftType?: ShiftType; shiftLabel?: string | null }) {
  if (!shiftType || shiftType === 'unico') return null
  const meta = SHIFTS.find(s => s.v === shiftType)!
  const I = meta.icon as React.ComponentType<{ className?: string }>
  const color = shiftType === 'mañana' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${color}`}>
      <I className="w-3.5 h-3.5" /> Turno {shiftLabel || meta.label}
    </span>
  )
}

// ── DailySummaryView ───────────────────────────────────────────────────────────
export function DailySummaryView({ date }: { date?: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [d, setD] = useState(date || new Date().toISOString().slice(0, 10))

  const load = useCallback(async (day: string) => {
    setLoading(true)
    try { setData((await api.getCashDailySummary(day))?.data || null) } catch { setData(null) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load(d) }, [d, load])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> Resumen del día</h3>
        <input type="date" value={d} onChange={e => setD(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm" />
      </div>

      {loading ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> :
        !data || data.shifts.length === 0 ? <p className="text-sm text-muted-foreground">Sin cajas registradas este día.</p> :
        <>
          {/* Consolidado */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { l: 'Ventas efectivo', v: data.totals.cashSales },
              { l: 'Ventas tarjeta', v: data.totals.cardSales },
              { l: 'Nómina a pagar', v: data.totals.payroll },
              { l: 'Bonos / Desc.', v: (Number(data.totals.bonuses || 0) - Number(data.totals.discounts || 0)) },
            ].map(c => (
              <div key={c.l} className="rounded-lg border p-3"><p className="text-lg font-bold">{formatCOP(Number(c.v || 0))}</p><p className="text-xs text-muted-foreground">{c.l}</p></div>
            ))}
          </div>

          {/* Por turno */}
          {data.shifts.map((s: any) => (
            <div key={s.id} className="border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold capitalize flex items-center gap-2"><ShiftBadge shiftType={s.shiftType} shiftLabel={s.shiftLabel} />{s.shiftType === 'unico' && 'Caja'}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === 'cerrada' ? 'bg-gray-100 text-gray-600' : 'bg-emerald-100 text-emerald-700'}`}>{s.status}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-sm">
                <Row l="Apertura" v={s.openingAmount} />
                <Row l="Ventas efectivo" v={s.totalCashSales} />
                <Row l="Esperado" v={s.expectedCash} />
                <Row l="Contado" v={s.actualCash} />
                <Row l="Diferencia" v={s.difference} warn={s.difference < 0} />
              </div>
              {s.employees.length > 0 && (
                <div className="mt-3 border-t pt-2 space-y-1">
                  {s.employees.map((e: any) => {
                    const bono = e.bonuses.filter((b: any) => b.type === 'bono').reduce((a: number, b: any) => a + b.amount, 0)
                    const desc = e.bonuses.filter((b: any) => b.type === 'descuento').reduce((a: number, b: any) => a + b.amount, 0)
                    return (
                      <div key={e.id} className="flex items-center justify-between text-xs">
                        <span>{e.name} <span className="text-muted-foreground">({e.role || 'sin rol'})</span> {e.status === 'baja' && <span className="text-red-600">❌ {e.bajaReason || 'baja'}</span>}</span>
                        <span className="font-medium flex items-center gap-2">
                          <span className="text-muted-foreground">Turno {formatCOP(Number(e.shiftValue) || 0)}</span>
                          {bono > 0 && <span className="text-emerald-700">+{formatCOP(bono)}</span>}
                          {desc > 0 && <span className="text-red-700">-{formatCOP(desc)}</span>}
                          <span className="text-foreground font-semibold">= {formatCOP(Number(e.toPay) || 0)}</span>
                        </span>
                      </div>
                    )
                  })}
                  <div className="flex items-center justify-between text-xs pt-1 border-t mt-1">
                    <span className="font-semibold">Nómina del turno</span>
                    <span className="font-bold text-primary">{formatCOP(Number(s.payrollTotal) || 0)}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </>}
    </div>
  )
}
function Row({ l, v, warn }: { l: string; v: number; warn?: boolean }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{l}</span><span className={`font-medium ${warn ? 'text-red-600' : ''}`}>{formatCOP(Number(v || 0))}{warn && ' ⚠️'}</span></div>
}
