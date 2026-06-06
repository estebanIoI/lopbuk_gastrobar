'use client'

/**
 * gym-management.tsx
 * Panel del COMERCIO gimnasio: miembros, membresías con cobro, planes de
 * entrenamiento, progreso y asistencia. Tenant-scoped (el backend filtra por
 * tenant_id del JWT). Se monta en el dashboard del comerciante (case 'gym').
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Dumbbell, Users, CalendarCheck, DollarSign, Plus, Trash2, X, LogIn, LogOut,
  TrendingUp, CreditCard, Loader2, ChevronRight, Pencil, QrCode, ShieldCheck,
  ShieldX, ShieldAlert, Camera,
} from 'lucide-react'
import { BrowserMultiFormatReader } from '@zxing/library'
import { api } from '@/lib/api'

const fmt = (n: number) => `$${Number(n || 0).toLocaleString('es-CO')}`
const CYCLES = ['mensual', 'trimestral', 'semestral', 'anual']
const STATUSES = ['activa', 'pausada', 'vencida', 'cancelada']

export function GymManagement() {
  const [tab, setTab] = useState<'miembros' | 'asistencia' | 'acceso'>('miembros')
  const [stats, setStats] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [detail, setDetail] = useState<any | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [s, m] = await Promise.all([api.getGymStats(), api.getGymMembers()])
    if (s.success) setStats(s.data)
    if (m.success) setMembers(m.data || [])
    setLoading(false)
  }, [])

  const loadAttendance = useCallback(async () => {
    const r = await api.getGymTodayAttendance()
    if (r.success) setAttendance(r.data || [])
  }, [])

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => { if (tab === 'asistencia') loadAttendance() }, [tab, loadAttendance])

  const statCards = [
    { label: 'Miembros activos', value: stats?.miembrosActivos ?? 0, icon: Users, color: 'text-emerald-600' },
    { label: 'Asistencia hoy', value: stats?.asistenciaHoy ?? 0, icon: CalendarCheck, color: 'text-sky-600' },
    { label: 'Pagos por vencer', value: stats?.pagosPorVencer ?? 0, icon: CreditCard, color: 'text-orange-600' },
    { label: 'Ingreso recurrente', value: fmt(stats?.ingresoRecurrente ?? 0), icon: DollarSign, color: 'text-violet-600' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Dumbbell className="w-6 h-6 text-violet-600" />
          <div>
            <h1 className="text-2xl font-bold">Gimnasio</h1>
            <p className="text-gray-500 text-sm">Miembros, planes, progreso y asistencia</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Agregar miembro
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(c => (
          <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <c.icon className={`w-5 h-5 ${c.color}`} />
            <div className="text-2xl font-bold mt-2">{c.value}</div>
            <div className="text-xs text-gray-500">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {([['miembros', 'Miembros'], ['asistencia', 'Asistencia hoy'], ['acceso', 'Acceso QR']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? 'border-violet-600 text-violet-700' : 'border-transparent text-gray-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading && tab !== 'acceso' ? (
        <div className="flex justify-center py-10 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : tab === 'miembros' ? (
        <MembersTable members={members} onOpen={setDetail} onCheckIn={async (id: string) => { await api.gymCheckIn(id); alert('Entrada registrada') }} />
      ) : tab === 'asistencia' ? (
        <AttendanceTable rows={attendance} onCheckout={async (id: string) => { await api.gymCheckOut(id); loadAttendance() }} />
      ) : (
        <AccessScanner onScanned={() => { loadAll() }} />
      )}

      {showAdd && <AddMemberModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); loadAll() }} />}
      {detail && <MemberDetailModal userId={detail.userId} name={detail.name} onClose={() => setDetail(null)} onChanged={loadAll} />}
    </div>
  )
}

function MembersTable({ members, onOpen, onCheckIn }: any) {
  if (!members.length) return <p className="text-sm text-gray-400 py-8 text-center">Aún no tienes miembros. Agrega el primero.</p>
  const badge: Record<string, string> = {
    activa: 'bg-emerald-100 text-emerald-700', pausada: 'bg-amber-100 text-amber-700',
    vencida: 'bg-red-100 text-red-700', cancelada: 'bg-gray-200 text-gray-600',
  }
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-left text-xs uppercase">
          <tr>
            <th className="px-4 py-3">Miembro</th><th className="px-4 py-3">Plan</th>
            <th className="px-4 py-3">Estado</th><th className="px-4 py-3">Próx. pago</th>
            <th className="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {members.map((m: any) => (
            <tr key={m.userId} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <div className="font-medium">{m.name}</div>
                <div className="text-xs text-gray-400">{m.email}</div>
              </td>
              <td className="px-4 py-3">{m.planName || '—'}<div className="text-xs text-gray-400">{fmt(m.price)} / {m.paymentCycle}</div></td>
              <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge[m.status] || ''}`}>{m.status}</span></td>
              <td className="px-4 py-3 text-gray-500">{m.nextPaymentAt ? String(m.nextPaymentAt).slice(0, 10) : '—'}</td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  <button title="Check-in" onClick={() => onCheckIn(m.userId)} className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50"><LogIn className="w-4 h-4" /></button>
                  <button onClick={() => onOpen(m)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AttendanceTable({ rows, onCheckout }: any) {
  if (!rows.length) return <p className="text-sm text-gray-400 py-8 text-center">Sin entradas registradas hoy.</p>
  return (
    <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
      {rows.map((r: any) => (
        <div key={r.id} className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="font-medium text-sm">{r.name}</div>
            <div className="text-xs text-gray-400">
              Entró {new Date(r.checkedInAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
              {r.checkedOutAt && ` · Salió ${new Date(r.checkedOutAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`}
            </div>
          </div>
          {!r.checkedOutAt && (
            <button onClick={() => onCheckout(r.id)} className="flex items-center gap-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50">
              <LogOut className="w-3.5 h-3.5" /> Marcar salida
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function AddMemberModal({ onClose, onSaved }: any) {
  const [form, setForm] = useState({ email: '', planName: '', price: '', paymentCycle: 'mensual' })
  const [err, setErr] = useState(''); const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true); setErr('')
    const r = await api.addGymMember({ ...form, price: Number(form.price) || 0 })
    setSaving(false)
    if (r.success) onSaved(); else setErr(r.error || 'Error')
  }
  return (
    <Modal title="Agregar miembro" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Email del cliente (debe tener cuenta)">
          <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="modal-input" placeholder="cliente@email.com" />
        </Field>
        <Field label="Nombre del plan">
          <input value={form.planName} onChange={e => setForm({ ...form, planName: e.target.value })} className="modal-input" placeholder="Plan mensual" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Precio"><input value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} inputMode="numeric" className="modal-input" placeholder="80000" /></Field>
          <Field label="Ciclo">
            <select value={form.paymentCycle} onChange={e => setForm({ ...form, paymentCycle: e.target.value })} className="modal-input">
              {CYCLES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button onClick={save} disabled={saving} className="w-full bg-violet-600 hover:bg-violet-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
          {saving ? 'Guardando…' : 'Agregar miembro'}
        </button>
      </div>
    </Modal>
  )
}

function MemberDetailModal({ userId, name, onClose, onChanged }: any) {
  const [data, setData] = useState<any>(null)
  const [showPlan, setShowPlan] = useState(false)
  const [showProg, setShowProg] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const load = useCallback(async () => { const r = await api.getGymMember(userId); if (r.success) setData(r.data) }, [userId])
  useEffect(() => { load() }, [load])

  const setStatus = async (status: string) => { await api.updateGymMembership(userId, { status }); load(); onChanged() }

  return (
    <Modal title={name} onClose={onClose} wide>
      {!data ? <div className="flex justify-center py-8 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div> : (
        <div className="space-y-5">
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{data.membership.planName || 'Sin plan'} · <span className="capitalize">{data.membership.status}</span></div>
                <div className="text-gray-400 text-xs">{fmt(data.membership.price)} / {data.membership.paymentCycle} · próx. pago {data.membership.nextPaymentAt ? String(data.membership.nextPaymentAt).slice(0, 10) : '—'}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setShowEdit(true)} title="Editar" className="p-2 rounded-lg text-gray-500 hover:bg-gray-200"><Pencil className="w-4 h-4" /></button>
                <button onClick={async () => { await api.gymRegistrarPago(userId); load(); onChanged() }} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-2 rounded-lg">
                  <CreditCard className="w-3.5 h-3.5" /> Pago
                </button>
              </div>
            </div>
            <div className="flex gap-1.5">
              {data.membership.status !== 'activa' && <button onClick={() => setStatus('activa')} className="text-[11px] px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">Activar</button>}
              {data.membership.status !== 'pausada' && <button onClick={() => setStatus('pausada')} className="text-[11px] px-2 py-1 rounded-full bg-amber-100 text-amber-700">Pausar</button>}
              {data.membership.status !== 'cancelada' && <button onClick={() => setStatus('cancelada')} className="text-[11px] px-2 py-1 rounded-full bg-red-100 text-red-700">Cancelar</button>}
            </div>
          </div>

          <Section title="Planes de entrenamiento" action={<button onClick={() => setShowPlan(true)} className="text-violet-600 text-xs flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Nuevo</button>}>
            {data.plans?.length ? data.plans.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <span>{p.name}{p.daysPerWeek ? ` · ${p.daysPerWeek}x/sem` : ''}</span>
                <button onClick={async () => { await api.deleteGymPlan(p.id); load() }} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            )) : <p className="text-xs text-gray-400">Sin planes.</p>}
          </Section>

          <Section title="Progreso" action={<button onClick={() => setShowProg(true)} className="text-violet-600 text-xs flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" />Registrar</button>}>
            {data.progress?.length ? (
              <div className="space-y-1.5">
                {data.progress.slice(-6).reverse().map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs border border-gray-100 rounded-lg px-3 py-2">
                    <span className="text-gray-500">{String(p.logDate).slice(0, 10)}</span>
                    <span>{p.weightKg ? `${p.weightKg} kg` : ''} {p.bodyFatPct ? `· ${p.bodyFatPct}% grasa` : ''}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-gray-400">Sin registros.</p>}
          </Section>

          <Section title="Asistencia reciente">
            {data.attendance?.length ? (
              <div className="space-y-1.5">
                {data.attendance.slice(0, 8).map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between text-xs border border-gray-100 rounded-lg px-3 py-2">
                    <span className="text-gray-500">{new Date(a.checkedInAt).toLocaleDateString('es-CO')}</span>
                    <span className="text-gray-400">
                      {new Date(a.checkedInAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                      {a.checkedOutAt ? ` – ${new Date(a.checkedOutAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}` : ' · abierto'}
                    </span>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-gray-400">Sin asistencias registradas.</p>}
          </Section>
        </div>
      )}

      {showPlan && <NewPlanModal userId={userId} onClose={() => setShowPlan(false)} onSaved={() => { setShowPlan(false); load() }} />}
      {showProg && <NewProgressModal userId={userId} onClose={() => setShowProg(false)} onSaved={() => { setShowProg(false); load() }} />}
      {showEdit && data && <EditMembershipModal userId={userId} current={data.membership} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); load(); onChanged() }} />}
    </Modal>
  )
}

function EditMembershipModal({ userId, current, onClose, onSaved }: any) {
  const [f, setF] = useState({
    planName: current.planName || '', price: current.price || '', paymentCycle: current.paymentCycle || 'mensual',
    status: current.status || 'activa', startDate: current.startDate ? String(current.startDate).slice(0, 10) : '',
    endDate: current.endDate ? String(current.endDate).slice(0, 10) : '', autoRenew: !!current.autoRenew, notes: current.notes || '',
  })
  const save = async () => {
    await api.updateGymMembership(userId, {
      planName: f.planName || null, price: Number(f.price) || 0, paymentCycle: f.paymentCycle, status: f.status,
      startDate: f.startDate || null, endDate: f.endDate || null, autoRenew: f.autoRenew, notes: f.notes || null,
    })
    onSaved()
  }
  return (
    <Modal title="Editar membresía" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Plan"><input value={f.planName} onChange={e => setF({ ...f, planName: e.target.value })} className="modal-input" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Precio"><input value={f.price} onChange={e => setF({ ...f, price: e.target.value })} inputMode="numeric" className="modal-input" /></Field>
          <Field label="Ciclo"><select value={f.paymentCycle} onChange={e => setF({ ...f, paymentCycle: e.target.value })} className="modal-input">{CYCLES.map(c => <option key={c} value={c}>{c}</option>)}</select></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Inicio"><input type="date" value={f.startDate} onChange={e => setF({ ...f, startDate: e.target.value })} className="modal-input" /></Field>
          <Field label="Fin"><input type="date" value={f.endDate} onChange={e => setF({ ...f, endDate: e.target.value })} className="modal-input" /></Field>
        </div>
        <Field label="Estado"><select value={f.status} onChange={e => setF({ ...f, status: e.target.value })} className="modal-input">{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.autoRenew} onChange={e => setF({ ...f, autoRenew: e.target.checked })} /> Renovación automática</label>
        <Field label="Notas"><textarea value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} className="modal-input" rows={2} /></Field>
        <button onClick={save} className="w-full bg-violet-600 hover:bg-violet-700 text-white py-2.5 rounded-lg text-sm font-medium">Guardar cambios</button>
      </div>
    </Modal>
  )
}

function NewPlanModal({ userId, onClose, onSaved }: any) {
  const [name, setName] = useState(''); const [days, setDays] = useState(''); const [desc, setDesc] = useState('')
  const [exs, setExs] = useState<any[]>([{ dayLabel: '', name: '', sets: '', reps: '', weightKg: '', restSeconds: '' }])
  const upd = (i: number, k: string, v: string) => { const n = [...exs]; n[i][k] = v; setExs(n) }
  const save = async () => {
    if (!name.trim()) return
    await api.createGymPlan(userId, {
      name, description: desc || null, daysPerWeek: Number(days) || null,
      exercises: exs.filter(e => e.name.trim()).map((e, idx) => ({
        dayLabel: e.dayLabel || null, name: e.name, sets: Number(e.sets) || null, reps: e.reps || null,
        weightKg: Number(e.weightKg) || null, restSeconds: Number(e.restSeconds) || null, sortOrder: idx,
      })),
    })
    onSaved()
  }
  return (
    <Modal title="Nuevo plan de entrenamiento" onClose={onClose} wide>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2"><Field label="Nombre"><input value={name} onChange={e => setName(e.target.value)} className="modal-input" placeholder="Hipertrofia 4 días" /></Field></div>
          <Field label="Días/sem"><input value={days} onChange={e => setDays(e.target.value)} inputMode="numeric" className="modal-input" /></Field>
        </div>
        <Field label="Descripción (opcional)"><input value={desc} onChange={e => setDesc(e.target.value)} className="modal-input" placeholder="Enfocado en fuerza" /></Field>
        <div className="text-xs font-medium text-gray-500 pt-1">Ejercicios</div>
        {exs.map((ex, i) => (
          <div key={i} className="border border-gray-100 rounded-lg p-2 space-y-2">
            <div className="flex gap-2">
              <input value={ex.dayLabel} onChange={e => upd(i, 'dayLabel', e.target.value)} className="modal-input w-24" placeholder="Día 1" />
              <input value={ex.name} onChange={e => upd(i, 'name', e.target.value)} className="modal-input flex-1" placeholder="Press banca" />
              {exs.length > 1 && <button onClick={() => setExs(exs.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500 px-1"><Trash2 className="w-4 h-4" /></button>}
            </div>
            <div className="grid grid-cols-4 gap-2">
              <input value={ex.sets} onChange={e => upd(i, 'sets', e.target.value)} className="modal-input" placeholder="Sets" inputMode="numeric" />
              <input value={ex.reps} onChange={e => upd(i, 'reps', e.target.value)} className="modal-input" placeholder="Reps" />
              <input value={ex.weightKg} onChange={e => upd(i, 'weightKg', e.target.value)} className="modal-input" placeholder="kg" inputMode="decimal" />
              <input value={ex.restSeconds} onChange={e => upd(i, 'restSeconds', e.target.value)} className="modal-input" placeholder="Desc.s" inputMode="numeric" />
            </div>
          </div>
        ))}
        <button onClick={() => setExs([...exs, { dayLabel: '', name: '', sets: '', reps: '', weightKg: '', restSeconds: '' }])} className="text-xs text-violet-600 flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Agregar ejercicio</button>
        <button onClick={save} className="w-full bg-violet-600 hover:bg-violet-700 text-white py-2.5 rounded-lg text-sm font-medium">Crear plan</button>
      </div>
    </Modal>
  )
}

const MEASURES = [['cintura', 'Cintura'], ['pecho', 'Pecho'], ['brazo', 'Brazo'], ['pierna', 'Pierna'], ['cadera', 'Cadera']] as const
function NewProgressModal({ userId, onClose, onSaved }: any) {
  const [f, setF] = useState<any>({ weightKg: '', bodyFatPct: '', muscleMassKg: '', notes: '' })
  const [m, setM] = useState<any>({})
  const save = async () => {
    const measurements = Object.fromEntries(Object.entries(m).filter(([, v]) => v).map(([k, v]) => [k, Number(v)]))
    await api.addGymProgress(userId, {
      weightKg: Number(f.weightKg) || null, bodyFatPct: Number(f.bodyFatPct) || null,
      muscleMassKg: Number(f.muscleMassKg) || null,
      measurements: Object.keys(measurements).length ? measurements : null,
      notes: f.notes || null,
    })
    onSaved()
  }
  return (
    <Modal title="Registrar progreso" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Peso (kg)"><input value={f.weightKg} onChange={e => setF({ ...f, weightKg: e.target.value })} inputMode="decimal" className="modal-input" /></Field>
          <Field label="% Grasa"><input value={f.bodyFatPct} onChange={e => setF({ ...f, bodyFatPct: e.target.value })} inputMode="decimal" className="modal-input" /></Field>
          <Field label="Músculo (kg)"><input value={f.muscleMassKg} onChange={e => setF({ ...f, muscleMassKg: e.target.value })} inputMode="decimal" className="modal-input" /></Field>
        </div>
        <div className="text-xs font-medium text-gray-500">Medidas (cm)</div>
        <div className="grid grid-cols-5 gap-2">
          {MEASURES.map(([k, l]) => (
            <Field key={k} label={l}><input value={m[k] || ''} onChange={e => setM({ ...m, [k]: e.target.value })} inputMode="decimal" className="modal-input" /></Field>
          ))}
        </div>
        <Field label="Notas"><textarea value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} className="modal-input" rows={2} /></Field>
        <button onClick={save} className="w-full bg-violet-600 hover:bg-violet-700 text-white py-2.5 rounded-lg text-sm font-medium">Guardar</button>
      </div>
    </Modal>
  )
}

// ── Escáner de acceso (recepción) ──
const ACCESS_CFG: Record<string, any> = {
  permitido:  { icon: ShieldCheck, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', label: 'ACCESO PERMITIDO' },
  por_vencer: { icon: ShieldAlert, color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',     label: 'POR VENCER' },
  denegado:   { icon: ShieldX,     color: 'text-red-700',     bg: 'bg-red-50 border-red-200',         label: 'ACCESO DENEGADO' },
}
function AccessScanner({ onScanned }: any) {
  const [result, setResult] = useState<any>(null)
  const [manual, setManual] = useState('')
  const [scanning, setScanning] = useState(false)
  const [err, setErr] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<any>(null)

  const stop = useCallback(() => {
    try { readerRef.current?.reset() } catch {}
    readerRef.current = null
    setScanning(false)
  }, [])

  const process = useCallback(async (code: string) => {
    stop()
    const r = await api.gymScan(code)
    if (r.success) { setResult(r.data); onScanned?.() }
    else setErr(r.error || 'Error al procesar')
  }, [stop, onScanned])

  const start = async () => {
    setErr(''); setResult(null); setScanning(true)
    try {
      const reader = new BrowserMultiFormatReader()
      readerRef.current = reader
      await reader.decodeFromVideoDevice(null as any, videoRef.current!, (res: any) => {
        if (res) process(res.getText())
      })
    } catch (e: any) {
      setErr('No se pudo acceder a la cámara. Usa el código manual.')
      setScanning(false)
    }
  }

  useEffect(() => () => { try { readerRef.current?.reset() } catch {} }, [])

  if (result) {
    const cfg = ACCESS_CFG[result.status] || ACCESS_CFG.denegado
    return (
      <div className={`rounded-2xl border p-8 text-center ${cfg.bg}`}>
        <cfg.icon className={`w-20 h-20 mx-auto ${cfg.color}`} />
        <div className={`text-2xl font-extrabold mt-3 ${cfg.color}`}>{cfg.label}</div>
        {result.name && <div className="text-lg font-medium mt-1">{result.name}</div>}
        <div className="text-sm text-gray-500 mt-1">{result.reason}{result.daysRemaining != null && result.status !== 'denegado' ? ` · ${result.daysRemaining} días restantes` : ''}</div>
        {result.checkedIn && <div className="text-xs text-emerald-600 mt-2">Ingreso registrado ✓</div>}
        {result.status === 'denegado' && <div className="text-xs text-red-600 mt-2">Renovar membresía en la pestaña Miembros.</div>}
        <button onClick={() => { setResult(null); setManual('') }} className="mt-5 bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium">Escanear otro</button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="rounded-2xl bg-black aspect-square overflow-hidden flex items-center justify-center relative">
        <video ref={videoRef} className="w-full h-full object-cover" />
        {!scanning && <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60"><QrCode className="w-16 h-16" /><span className="text-xs mt-2">Cámara apagada</span></div>}
      </div>
      <div className="flex gap-2">
        {!scanning
          ? <button onClick={start} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2"><Camera className="w-4 h-4" />Escanear QR</button>
          : <button onClick={stop} className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium">Detener cámara</button>}
      </div>
      <div className="flex gap-2">
        <input value={manual} onChange={e => setManual(e.target.value)} placeholder="O ingresa el código manual" className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-violet-500" />
        <button onClick={() => manual.trim() && process(manual.trim())} className="bg-gray-800 text-white px-4 rounded-lg text-sm">Validar</button>
      </div>
      {err && <p className="text-sm text-red-600 text-center">{err}</p>}
    </div>
  )
}

// ── Helpers de UI ──
function Modal({ title, onClose, children, wide }: any) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-lg' : 'max-w-sm'} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-5 h-14 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
      <style jsx global>{`.modal-input{width:100%;border:1px solid #e5e7eb;border-radius:0.5rem;padding:0.5rem 0.75rem;font-size:0.875rem;outline:none}.modal-input:focus{border-color:#8b5cf6}`}</style>
    </div>
  )
}
function Field({ label, children }: any) {
  return <label className="block"><span className="text-xs text-gray-500 mb-1 block">{label}</span>{children}</label>
}
function Section({ title, action, children }: any) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2"><h4 className="text-sm font-semibold">{title}</h4>{action}</div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

export default GymManagement
