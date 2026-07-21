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
  ShieldX, ShieldAlert, Camera, Activity, Clock, BarChart3,
  Flame, Target, BookOpen, Stethoscope, Image as ImageIcon, FileText, Tag, UserCog,
  Wallet, Banknote, Receipt, AlertCircle, CircleDollarSign, ArrowDownCircle,
  CheckCircle2, RotateCcw, Filter,
} from 'lucide-react'
import { BrowserMultiFormatReader } from '@zxing/library'
import { api } from '@/lib/api'

const fmt = (n: number) => `$${Number(n || 0).toLocaleString('es-CO')}`
const CYCLES = ['mensual', 'trimestral', 'semestral', 'anual']
const STATUSES = ['activa', 'pausada', 'vencida', 'cancelada']

const PAYMENT_METHODS: Record<string, { label: string; icon: string; color: string }> = {
  efectivo:    { label: 'Efectivo',     icon: '💵', color: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  nequi:       { label: 'Nequi',        icon: '💜', color: 'bg-purple-50 text-purple-700 ring-purple-200' },
  daviplata:   { label: 'Daviplata',    icon: '🔴', color: 'bg-red-50 text-red-700 ring-red-200' },
  bancolombia: { label: 'Bancolombia',  icon: '🟡', color: 'bg-yellow-50 text-yellow-700 ring-yellow-200' },
  transferencia:{ label: 'Transferencia', icon: '🏦', color: 'bg-sky-50 text-sky-700 ring-sky-200' },
  tarjeta:     { label: 'Tarjeta',      icon: '💳', color: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  sistecredito:{ label: 'Sistecrédito', icon: '🟢', color: 'bg-teal-50 text-teal-700 ring-teal-200' },
  addi:        { label: 'Addi',         icon: '🟣', color: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200' },
  cheque:      { label: 'Cheque',       icon: '📝', color: 'bg-gray-50 text-gray-700 ring-gray-200' },
  otro:        { label: 'Otro',         icon: '💰', color: 'bg-slate-50 text-slate-700 ring-slate-200' },
}

export function GymManagement() {
  const [tab, setTab] = useState<'miembros' | 'asistencia' | 'entrenamiento' | 'salud' | 'pagos' | 'acceso'>('miembros')
  const [stats, setStats] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [detail, setDetail] = useState<any | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null)

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

  const handleDelete = useCallback(async (userId: string) => {
    const r = await api.removeGymMember(userId)
    if (r.success) {
      setConfirmDelete(null)
      setDetail(null)
      loadAll()
    } else {
      alert(r.error || 'Error al eliminar miembro')
    }
  }, [loadAll])

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => { if (tab === 'asistencia') loadAttendance() }, [tab, loadAttendance])

  const statCards = [
    { label: 'Miembros activos', value: stats?.miembrosActivos ?? 0, icon: Users, gradient: 'from-emerald-500 to-teal-600', ring: 'ring-emerald-500/20', change: '+12%' },
    { label: 'Asistencia hoy', value: stats?.asistenciaHoy ?? 0, icon: CalendarCheck, gradient: 'from-sky-500 to-blue-600', ring: 'ring-sky-500/20', change: '+8%' },
    { label: 'Pagos por vencer', value: stats?.pagosPorVencer ?? 0, icon: CreditCard, gradient: 'from-orange-500 to-amber-600', ring: 'ring-orange-500/20', change: null },
    { label: 'Ingreso recurrente', value: fmt(stats?.ingresoRecurrente ?? 0), icon: DollarSign, gradient: 'from-violet-500 to-purple-600', ring: 'ring-violet-500/20', change: '+15%' },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-8 shadow-2xl shadow-violet-500/30">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-white/15 blur-2xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm shadow-lg shadow-black/10">
              <Dumbbell className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Gimnasio</h1>
              <p className="text-violet-100 text-sm mt-1">Miembros, planes, progreso y asistencia</p>
            </div>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="hidden sm:flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-6 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 border border-white/20 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
          >
            <Plus className="w-4 h-4" /> Agregar miembro
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((c, i) => (
          <div key={c.label} className={`group relative overflow-hidden rounded-2xl bg-white/80 backdrop-blur-sm border border-white/60 p-6 shadow-lg shadow-gray-200/50 hover:shadow-xl hover:shadow-gray-300/50 transition-all duration-500 ring-1 ${c.ring} hover:-translate-y-1`}>
            <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br ${c.gradient} opacity-10 group-hover:opacity-20 group-hover:scale-150 transition-all duration-700`} />
            <div className={`absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-gradient-to-br ${c.gradient} opacity-5 group-hover:opacity-10 transition-opacity duration-500`} />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className={`flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br ${c.gradient} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <c.icon className="w-6 h-6 text-white" />
                </div>
                {c.change && (
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50/80 backdrop-blur-sm px-2.5 py-1 rounded-full flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> {c.change}
                  </span>
                )}
              </div>
              <div className="text-3xl font-extrabold text-gray-900 tracking-tight">{c.value}</div>
              <div className="text-sm text-gray-500 mt-1 font-medium">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white/60 backdrop-blur-sm rounded-2xl p-2 border border-white/60 shadow-lg shadow-gray-200/30 overflow-x-auto">
        {([
          ['miembros', 'Miembros', Users],
          ['asistencia', 'Asistencia', Activity],
          ['pagos', 'Pagos', Banknote],
          ['entrenamiento', 'Entrenamiento', Flame],
          ['salud', 'Salud', Stethoscope],
          ['acceso', 'Acceso QR', QrCode],
        ] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-semibold rounded-xl transition-all duration-300 whitespace-nowrap ${
              tab === k
                ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/30 scale-[1.02]'
                : 'text-gray-500 hover:text-gray-700 hover:bg-white/80 hover:shadow-sm'
            }`}>
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Contenido */}
      {loading && tab !== 'acceso' && tab !== 'entrenamiento' && tab !== 'salud' && tab !== 'pagos' ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <div className="relative">
            <Loader2 className="w-10 h-10 animate-spin text-violet-500" />
            <div className="absolute inset-0 rounded-full bg-violet-500/20 animate-ping" />
          </div>
          <span className="text-sm mt-4 font-medium">Cargando datos del gimnasio...</span>
        </div>
      ) : tab === 'miembros' ? (
        <MembersTable members={members} onOpen={setDetail} onCheckIn={async (id: string) => { await api.gymCheckIn(id); alert('Entrada registrada') }} onDelete={setConfirmDelete} />
      ) : tab === 'asistencia' ? (
        <AttendanceTable rows={attendance} onCheckout={async (id: string) => { await api.gymCheckOut(id); loadAttendance() }} />
      ) : tab === 'pagos' ? (
        <PaymentsView members={members} onOpenMember={(m) => setDetail(m)} />
      ) : tab === 'entrenamiento' ? (
        <TrainingView members={members} />
      ) : tab === 'salud' ? (
        <HealthView members={members} />
      ) : (
        <AccessScanner onScanned={() => { loadAll() }} />
      )}

      {showAdd && <AddMemberModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); loadAll() }} />}
      {detail && <MemberDetailModal userId={detail.userId} name={detail.name} onClose={() => setDetail(null)} onChanged={loadAll} />}
      {confirmDelete && (
        <ConfirmDeleteModal
          member={confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => handleDelete(confirmDelete.userId)}
        />
      )}
    </div>
  )
}

function ConfirmDeleteModal({ member, onClose, onConfirm }: any) {
  return (
    <Modal title="Eliminar miembro" onClose={onClose}>
      <div className="space-y-5">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-500/30">
            <Trash2 className="w-8 h-8 text-white" />
          </div>
          <p className="text-sm text-gray-500">¿Estás seguro que deseas eliminar a</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{member.name}?</p>
        </div>
        <div className="bg-red-50/80 backdrop-blur-sm border border-red-200/60 rounded-xl p-4 text-sm text-red-700">
          <p className="font-semibold mb-1">Esta acción no se puede deshacer.</p>
          <p>Se eliminarán también todas las membresías, planes, progreso y registros de asistencia asociados.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 bg-gray-100/80 backdrop-blur-sm text-gray-700 py-3 rounded-2xl text-sm font-semibold hover:bg-gray-200/80 transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm}
            className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white py-3 rounded-2xl text-sm font-semibold shadow-lg shadow-red-500/30 hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
            Eliminar miembro
          </button>
        </div>
      </div>
    </Modal>
  )
}

function MembersTable({ members, onOpen, onCheckIn, onDelete }: any) {
  if (!members.length) return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center mb-6 shadow-lg shadow-violet-200/50">
        <Users className="w-10 h-10 text-violet-500" />
      </div>
      <p className="text-lg font-semibold text-gray-600">Aún no tienes miembros</p>
      <p className="text-sm text-gray-400 mt-2">Agrega el primero para comenzar a gestionar tu gimnasio</p>
    </div>
  )
  const badge: Record<string, { bg: string; text: string; dot: string }> = {
    activa: { bg: 'bg-emerald-50/80', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    pausada: { bg: 'bg-amber-50/80', text: 'text-amber-700', dot: 'bg-amber-500' },
    vencida: { bg: 'bg-red-50/80', text: 'text-red-700', dot: 'bg-red-500' },
    cancelada: { bg: 'bg-gray-50/80', text: 'text-gray-500', dot: 'bg-gray-400' },
  }
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/60 shadow-xl shadow-gray-200/50 overflow-hidden">
      <div className="p-6 border-b border-gray-100/50">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-violet-500" />
            Lista de Miembros
          </h3>
          <span className="text-sm text-gray-500 bg-gray-100/80 backdrop-blur-sm px-3 py-1.5 rounded-full font-medium">{members.length} miembros</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/50">
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Miembro</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Próx. pago</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100/50">
            {members.map((m: any) => {
              const b = badge[m.status] || badge.cancelada
              return (
                <tr key={m.userId} className="group hover:bg-violet-50/30 transition-colors duration-200">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-violet-500/30">
                        {(m.name || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{m.name}</div>
                        <div className="text-xs text-gray-400">{m.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-700">{m.planName || '—'}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{fmt(m.price)} / {m.paymentCycle}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${b.bg} ${b.text} backdrop-blur-sm`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${b.dot}`} />
                      {m.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      {m.nextPaymentAt ? String(m.nextPaymentAt).slice(0, 10) : '—'}
                      {m.status === 'activa' && m.nextPaymentAt && new Date(m.nextPaymentAt) < new Date() && (
                        <span className="text-[10px] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                          <AlertCircle className="w-2.5 h-2.5" />Vencido
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button title="Check-in" onClick={() => onCheckIn(m.userId)}
                        className="p-2 rounded-xl text-sky-600 hover:bg-sky-50/80 transition-all duration-200 hover:scale-110 active:scale-95 backdrop-blur-sm">
                        <LogIn className="w-4 h-4" />
                      </button>
                      <button onClick={() => onOpen(m)}
                        className="p-2 rounded-xl text-gray-400 hover:bg-violet-50/80 hover:text-violet-600 transition-all duration-200 hover:scale-110 active:scale-95 backdrop-blur-sm">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button title="Eliminar" onClick={() => onDelete?.(m)}
                        className="p-2 rounded-xl text-gray-300 hover:bg-red-50/80 hover:text-red-500 transition-all duration-200 hover:scale-110 active:scale-95 backdrop-blur-sm">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AttendanceTable({ rows, onCheckout }: any) {
  if (!rows.length) return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-sky-100 to-blue-100 flex items-center justify-center mb-6 shadow-lg shadow-sky-200/50">
        <Activity className="w-10 h-10 text-sky-500" />
      </div>
      <p className="text-lg font-semibold text-gray-600">Sin entradas registradas hoy</p>
      <p className="text-sm text-gray-400 mt-2">Las asistencias aparecerán aquí en tiempo real</p>
    </div>
  )
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/60 shadow-xl shadow-gray-200/50 overflow-hidden">
      <div className="p-6 border-b border-gray-100/50">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-sky-500" />
            Asistencia de Hoy
          </h3>
          <span className="text-sm text-gray-500 bg-gray-100/80 backdrop-blur-sm px-3 py-1.5 rounded-full font-medium">{rows.length} entradas</span>
        </div>
      </div>
      <div className="divide-y divide-gray-100/50">
        {rows.map((r: any) => (
          <div key={r.id} className="flex items-center justify-between px-6 py-4 hover:bg-sky-50/20 transition-colors duration-200 group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-sky-500/30">
                {(r.name || '?')[0].toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-gray-900">{r.name}</div>
                <div className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                  <Clock className="w-3 h-3" />
                  Entró {new Date(r.checkedInAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                  {r.checkedOutAt && (
                    <>
                      <span className="text-gray-300">•</span>
                      Salió {new Date(r.checkedOutAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!r.checkedOutAt && (
                <button onClick={() => onCheckout(r.id)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl px-4 py-2 hover:bg-gray-50/80 hover:border-gray-300/60 transition-all duration-200 shadow-sm hover:shadow-md hover:scale-105 active:scale-95">
                  <LogOut className="w-3.5 h-3.5" /> Marcar salida
                </button>
              )}
              {r.checkedOutAt && (
                <span className="text-xs text-emerald-600 bg-emerald-50/80 backdrop-blur-sm px-3 py-1.5 rounded-full font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Completado
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
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
      <div className="space-y-5">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-500/30">
            <Users className="w-8 h-8 text-white" />
          </div>
          <p className="text-sm text-gray-500">Completa los datos para agregar un nuevo miembro</p>
        </div>
        <Field label="Email del cliente">
          <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="modal-input" placeholder="cliente@email.com" />
          <p className="text-xs text-gray-400 mt-1.5">Debe tener una cuenta en la plataforma</p>
        </Field>
        <Field label="Nombre del plan">
          <input value={form.planName} onChange={e => setForm({ ...form, planName: e.target.value })} className="modal-input" placeholder="Plan mensual premium" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Precio">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} inputMode="numeric" className="modal-input !pl-8" placeholder="80,000" />
            </div>
          </Field>
          <Field label="Ciclo de pago">
            <select value={form.paymentCycle} onChange={e => setForm({ ...form, paymentCycle: e.target.value })} className="modal-input">
              {CYCLES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </Field>
        </div>
        {err && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50/80 backdrop-blur-sm p-3 rounded-xl border border-red-200/60">
            <ShieldX className="w-4 h-4 flex-shrink-0" />
            {err}
          </div>
        )}
        <button onClick={save} disabled={saving}
          className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white py-3.5 rounded-2xl text-sm font-semibold disabled:opacity-50 transition-all duration-300 shadow-lg shadow-violet-500/30 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]">
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Guardando...
            </span>
          ) : 'Agregar miembro'}
        </button>
      </div>
    </Modal>
  )
}

function MemberDetailModal({ userId, name, onClose, onChanged }: any) {
  const [data, setData] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [showPlan, setShowPlan] = useState(false)
  const [showProg, setShowProg] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showProfileEdit, setShowProfileEdit] = useState(false)
  const [showPayFromMember, setShowPayFromMember] = useState(false)
  const [memberTab, setMemberTab] = useState<'general' | 'pagos' | 'deudas'>('general')
  const load = useCallback(async () => {
    const r = await api.getGymMember(userId)
    if (r.success) setData(r.data)
    const p = await api.getGymMemberProfile(userId)
    if (p.success) setProfile(p.data)
  }, [userId])
  useEffect(() => { load() }, [load])

  const setStatus = async (status: string) => { await api.updateGymMembership(userId, { status }); load(); onChanged() }
  const setMemberStatus = async (status: string) => {
    const r = await api.changeGymMemberStatus(userId, status)
    if (r.success) { load(); onChanged() }
    else alert(r.error || 'Error al cambiar estado')
  }

  // Detecta si el pago está vencido (last_payment_at + cycle < hoy, o next_payment_at < hoy)
  const isOverdue = data?.membership?.nextPaymentAt && new Date(data.membership.nextPaymentAt) < new Date()
    && data?.membership?.status === 'activa'

  const statusColors: Record<string, { bg: string; text: string; btn: string }> = {
    activa: { bg: 'bg-emerald-50/80', text: 'text-emerald-700', btn: 'bg-emerald-100/80 text-emerald-700 hover:bg-emerald-200/80' },
    pausada: { bg: 'bg-amber-50/80', text: 'text-amber-700', btn: 'bg-amber-100/80 text-amber-700 hover:bg-amber-200/80' },
    vencida: { bg: 'bg-red-50/80', text: 'text-red-700', btn: 'bg-red-100/80 text-red-700 hover:bg-red-200/80' },
    cancelada: { bg: 'bg-gray-50/80', text: 'text-gray-500', btn: 'bg-gray-100/80 text-gray-500 hover:bg-gray-200/80' },
  }

  const memberStatusOptions = [
    { value: 'activo', label: 'Activo', color: 'bg-emerald-50 text-emerald-700' },
    { value: 'inactivo', label: 'Inactivo', color: 'bg-gray-100 text-gray-500' },
    { value: 'congelado', label: 'Congelado', color: 'bg-sky-50 text-sky-700' },
    { value: 'lesionado', label: 'Lesionado', color: 'bg-amber-50 text-amber-700' },
    { value: 'dado_de_baja', label: 'Dado de baja', color: 'bg-red-50 text-red-700' },
  ]

  return (
    <Modal title={name} onClose={onClose} wide>
      {!data ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
          <span className="text-sm mt-3 font-medium">Cargando perfil...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Membership Card */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-700 p-6 text-white shadow-xl shadow-violet-500/30">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/20 blur-2xl" />
              <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-white/15 blur-xl" />
            </div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-medium text-violet-200">Membresía</div>
                  <div className="text-2xl font-bold mt-1">{data.membership.planName || 'Sin plan'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowEdit(true)} title="Editar"
                    className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition-colors duration-200 backdrop-blur-sm">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={async () => { await api.gymRegistrarPago(userId); load(); onChanged() }}
                    className="flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white text-sm px-4 py-2.5 rounded-xl font-semibold transition-all duration-200 hover:scale-105 active:scale-95 border border-white/20">
                    <CreditCard className="w-4 h-4" /> Registrar Pago
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm text-violet-200 flex-wrap">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  <span>{fmt(data.membership.price)} / {data.membership.paymentCycle}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>Próx. pago: {data.membership.nextPaymentAt ? String(data.membership.nextPaymentAt).slice(0, 10) : '—'}</span>
                </div>
                {isOverdue && (
                  <div className="flex items-center gap-1.5 bg-red-500/30 text-red-100 px-3 py-1 rounded-full font-semibold text-xs border border-red-400/40">
                    <AlertCircle className="w-3.5 h-3.5" />
                    PAGO VENCIDO
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-4">
                {data.membership.status !== 'activa' && (
                  <button onClick={() => setStatus('activa')}
                    className="text-xs px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-100 font-semibold hover:bg-emerald-500/30 transition-colors border border-emerald-400/30 backdrop-blur-sm">
                    Activar
                  </button>
                )}
                {data.membership.status !== 'pausada' && (
                  <button onClick={() => setStatus('pausada')}
                    className="text-xs px-4 py-2 rounded-xl bg-amber-500/20 text-amber-100 font-semibold hover:bg-amber-500/30 transition-colors border border-amber-400/30 backdrop-blur-sm">
                    Pausar
                  </button>
                )}
                {data.membership.status !== 'cancelada' && (
                  <button onClick={() => setStatus('cancelada')}
                    className="text-xs px-4 py-2 rounded-xl bg-red-500/20 text-red-100 font-semibold hover:bg-red-500/30 transition-colors border border-red-400/30 backdrop-blur-sm">
                    Cancelar
                   </button>
                 )}
               </div>
             </div>
           </div>

          {/* Tabs internos del modal */}
          <div className="flex gap-1.5 bg-white/60 backdrop-blur-sm rounded-xl p-1.5 border border-white/60 shadow-sm">
            {([
              ['general', 'General', UserCog],
              ['pagos', 'Pagos', Banknote],
              ['deudas', 'Deudas', ArrowDownCircle],
            ] as const).map(([k, label, Icon]) => (
              <button key={k} onClick={() => setMemberTab(k)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                  memberTab === k
                    ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-white/80'
                }`}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>

          {memberTab === 'general' && (<>
           {/* Perfil de miembro: objetivo, entrenador, estado */}
           <Section title="Perfil de miembro" icon={<UserCog className="w-5 h-5 text-violet-500" />}
             action={<button onClick={() => setShowProfileEdit(true)} className="text-violet-600 text-sm flex items-center gap-1.5 font-semibold hover:text-violet-700 transition-colors">
               <Pencil className="w-3.5 h-3.5" />Editar
             </button>}>
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
               {/* Objetivo */}
               <div className="bg-gradient-to-br from-violet-50/80 to-purple-50/80 border border-violet-100/60 rounded-2xl p-4">
                 <div className="text-xs text-violet-600 font-semibold mb-1 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" />Objetivo
                </div>
                <div className="text-sm font-semibold text-gray-900">{profile?.objectiveName || data?.objectiveName || 'Sin objetivo'}</div>
              </div>
              {/* Entrenador */}
              <div className="bg-gradient-to-br from-sky-50/80 to-blue-50/80 border border-sky-100/60 rounded-2xl p-4">
                <div className="text-xs text-sky-600 font-semibold mb-1 flex items-center gap-1">
                  <UserCog className="w-3.5 h-3.5" />Entrenador
                </div>
                <div className="text-sm font-semibold text-gray-900">{profile?.trainerName || 'Sin asignar'}</div>
              </div>
              {/* Estado del miembro */}
              <div className="bg-gradient-to-br from-emerald-50/80 to-teal-50/80 border border-emerald-100/60 rounded-2xl p-4">
                <div className="text-xs text-emerald-600 font-semibold mb-1 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />Estado
                </div>
                <div className="text-sm font-semibold text-gray-900">
                  {memberStatusOptions.find(o => o.value === (profile?.status || data?.status))?.label || profile?.status || data?.status || '—'}
                </div>
              </div>
            </div>
            {/* Quick status change */}
            <div className="flex flex-wrap gap-2 pt-2">
              {memberStatusOptions.map(opt => (
                <button key={opt.value}
                  onClick={() => setMemberStatus(opt.value)}
                  className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${
                    (profile?.status || data?.status) === opt.value
                      ? 'bg-violet-100/80 text-violet-700 ring-1 ring-violet-300'
                      : 'bg-gray-100/60 text-gray-500 hover:bg-gray-200/80'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </Section>

          {/* Planes */}
          <Section title="Planes de entrenamiento" icon={<Dumbbell className="w-5 h-5 text-violet-500" />}
            action={<button onClick={() => setShowPlan(true)} className="text-violet-600 text-sm flex items-center gap-1.5 font-semibold hover:text-violet-700 transition-colors">
              <Plus className="w-4 h-4" />Nuevo Plan
            </button>}>
            {data.plans?.length ? data.plans.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between bg-gradient-to-r from-gray-50/80 to-white/80 backdrop-blur-sm border border-gray-100/60 rounded-2xl px-5 py-4 text-sm hover:shadow-md transition-all duration-300 group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                    <Target className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900">{p.name}</span>
                    {p.daysPerWeek && <span className="text-xs text-gray-400 ml-2">• {p.daysPerWeek}x/sem</span>}
                  </div>
                </div>
                <button onClick={async () => { await api.deleteGymPlan(p.id); load() }}
                  className="text-gray-300 hover:text-red-500 transition-colors p-2 rounded-xl hover:bg-red-50/80 backdrop-blur-sm">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )) : (
              <div className="text-center py-8">
                <Dumbbell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Sin planes asignados</p>
              </div>
            )}
          </Section>

          {/* Progreso */}
          <Section title="Progreso corporal" icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
            action={<button onClick={() => setShowProg(true)} className="text-violet-600 text-sm flex items-center gap-1.5 font-semibold hover:text-violet-700 transition-colors">
              <Plus className="w-4 h-4" />Registrar
            </button>}>
            {data.progress?.length ? (
              <div className="grid grid-cols-2 gap-3">
                {data.progress.slice(-6).reverse().map((p: any, i: number) => (
                  <div key={i} className="bg-gradient-to-br from-gray-50/80 to-white/80 backdrop-blur-sm border border-gray-100/60 rounded-2xl p-4 hover:shadow-md transition-all duration-300">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100/80 flex items-center justify-center">
                        <CalendarCheck className="w-4 h-4 text-emerald-600" />
                      </div>
                      <span className="text-xs text-gray-500 font-medium">{String(p.logDate).slice(0, 10)}</span>
                    </div>
                    <div className="space-y-2">
                      {p.weightKg && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">Peso</span>
                          <span className="text-sm font-bold text-gray-900">{p.weightKg} kg</span>
                        </div>
                      )}
                      {p.bodyFatPct && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">Grasa</span>
                          <span className="text-sm font-bold text-gray-900">{p.bodyFatPct}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Sin registros de progreso</p>
              </div>
            )}
          </Section>

          {/* Asistencia */}
          <Section title="Asistencia reciente" icon={<CalendarCheck className="w-5 h-5 text-sky-500" />}>
            {data.attendance?.length ? (
              <div className="space-y-2">
                {data.attendance.slice(0, 8).map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between bg-gradient-to-r from-gray-50/80 to-white/80 backdrop-blur-sm border border-gray-100/60 rounded-xl px-4 py-3 hover:shadow-sm transition-all duration-200">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-gray-600 text-sm font-medium">{new Date(a.checkedInAt).toLocaleDateString('es-CO')}</span>
                    </div>
                    <span className="text-gray-400 text-sm">
                      {new Date(a.checkedInAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                      {a.checkedOutAt ? ` – ${new Date(a.checkedOutAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}` : ' • abierto'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CalendarCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Sin asistencias registradas</p>
              </div>
            )}
          </Section>
          </>)}

          {memberTab === 'pagos' && (
            <div className="space-y-4">
              <MemberPaymentsTab userId={userId} onRegister={() => setShowPayFromMember(true)} />
            </div>
          )}

          {memberTab === 'deudas' && <MemberDebtsTab userId={userId} />}
        </div>
      )}

      {showPlan && <NewPlanModal userId={userId} onClose={() => setShowPlan(false)} onSaved={() => { setShowPlan(false); load() }} />}
      {showProg && <NewProgressModal userId={userId} onClose={() => setShowProg(false)} onSaved={() => { setShowProg(false); load() }} />}
      {showEdit && data && <EditMembershipModal userId={userId} current={data.membership} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); load(); onChanged() }} />}
      {showProfileEdit && <EditProfileModal userId={userId} current={profile} onClose={() => setShowProfileEdit(false)} onSaved={() => { setShowProfileEdit(false); load() }} />}
      {showPayFromMember && data?.membership && (
        <RegisterPaymentFromMemberModal
          userId={userId}
          membresiaId={data.membership.id}
          memberName={name}
          onClose={() => setShowPayFromMember(false)}
          onSaved={() => { setShowPayFromMember(false); load() }}
        />
      )}
    </Modal>
  )
}

/** Modal simplificado para registrar un pago desde el detalle del miembro. */
function RegisterPaymentFromMemberModal({ userId, membresiaId, memberName, onClose, onSaved }: any) {
  const [f, setF] = useState({ amount: '', method: 'efectivo', reference: '', concept: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const save = async () => {
    if (!Number(f.amount) || Number(f.amount) <= 0) { setErr('Monto inválido'); return }
    setSaving(true); setErr('')
    const r = await api.registerGymPayment({
      membresiaId,
      amount: Number(f.amount),
      method: f.method,
      reference: f.reference || undefined,
      concept: f.concept || undefined,
      notes: f.notes || undefined,
    })
    setSaving(false)
    if (r.success) onSaved()
    else setErr(r.error || 'Error al registrar el pago')
  }
  return (
    <Modal title={`Registrar pago — ${memberName}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto *">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input type="number" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} className="modal-input !pl-8" placeholder="80000" />
            </div>
          </Field>
          <Field label="Método">
            <select value={f.method} onChange={e => setF({ ...f, method: e.target.value })} className="modal-input">
              {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Referencia (opcional)">
          <input value={f.reference} onChange={e => setF({ ...f, reference: e.target.value })} className="modal-input" placeholder="Núm. transacción" />
        </Field>
        <Field label="Concepto (opcional)">
          <input value={f.concept} onChange={e => setF({ ...f, concept: e.target.value })} className="modal-input" placeholder="Membresía mensual" />
        </Field>
        {err && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50/80 p-3 rounded-xl border border-red-200/60">
            <ShieldX className="w-4 h-4 flex-shrink-0" /> {err}
          </div>
        )}
        <button onClick={save} disabled={saving}
          className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-3.5 rounded-2xl text-sm font-semibold shadow-lg shadow-emerald-500/30 disabled:opacity-50 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
          {saving ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</span> : 'Registrar pago'}
        </button>
      </div>
    </Modal>
  )
}

function MemberDebtsTab({ userId }: { userId: string }) {
  const [debts, setDebts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showPay, setShowPay] = useState<any>(null)
  const load = useCallback(() => {
    setLoading(true)
    api.listGymDebts({ memberUserId: userId }).then((r: any) => {
      if (r.success) setDebts(r.data || [])
      setLoading(false)
    })
  }, [userId])
  useEffect(() => { load() }, [load])
  if (loading) {
    return <div className="flex justify-center py-6 text-gray-400"><Loader2 className="w-5 h-5 animate-spin text-violet-500" /></div>
  }
  if (debts.length === 0) {
    return (
      <Section title="Deudas" icon={<ArrowDownCircle className="w-5 h-5 text-violet-500" />}>
        <p className="text-xs text-gray-400 text-center py-4">Este miembro no tiene deudas registradas</p>
      </Section>
    )
  }
  return (
    <Section title="Deudas" icon={<ArrowDownCircle className="w-5 h-5 text-violet-500" />}>
      <div className="space-y-2">
        {debts.map((d: any) => {
          const restante = Number(d.totalDue) - Number(d.paidAmount)
          const statusColors: Record<string, string> = {
            pendiente: 'bg-amber-50 text-amber-700',
            vencido: 'bg-red-50 text-red-700',
            pagado: 'bg-emerald-50 text-emerald-700',
            condonado: 'bg-gray-100 text-gray-500',
          }
          return (
            <div key={d.id} className="flex items-center justify-between bg-gradient-to-r from-gray-50/80 to-white/80 border border-gray-100/60 rounded-xl px-4 py-3 text-sm">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{fmt(restante)}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${statusColors[d.status] || ''}`}>{d.status}</span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{d.concept || 'Membresía'} · Vence: {d.dueDate}</div>
              </div>
              {(d.status === 'pendiente' || d.status === 'vencido') && (
                <button onClick={() => setShowPay(d)}
                  className="text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 rounded-xl shadow-md hover:scale-105 active:scale-95 transition-all">
                  Pagar
                </button>
              )}
            </div>
          )
        })}
      </div>
      {showPay && <PayDebtModal debt={showPay} onClose={() => setShowPay(null)} onSaved={() => { setShowPay(null); load() }} />}
    </Section>
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
      <div className="space-y-5">
        <Field label="Nombre del plan">
          <input value={f.planName} onChange={e => setF({ ...f, planName: e.target.value })} className="modal-input" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Precio">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input value={f.price} onChange={e => setF({ ...f, price: e.target.value })} inputMode="numeric" className="modal-input !pl-8" />
            </div>
          </Field>
          <Field label="Ciclo">
            <select value={f.paymentCycle} onChange={e => setF({ ...f, paymentCycle: e.target.value })} className="modal-input">
              {CYCLES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Fecha de inicio">
            <input type="date" value={f.startDate} onChange={e => setF({ ...f, startDate: e.target.value })} className="modal-input" />
          </Field>
          <Field label="Fecha de fin">
            <input type="date" value={f.endDate} onChange={e => setF({ ...f, endDate: e.target.value })} className="modal-input" />
          </Field>
        </div>
        <Field label="Estado">
          <select value={f.status} onChange={e => setF({ ...f, status: e.target.value })} className="modal-input">
            {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </Field>
        <label className="flex items-center gap-3 text-sm cursor-pointer select-none p-4 rounded-2xl bg-gray-50/80 backdrop-blur-sm hover:bg-gray-100/80 transition-colors border border-gray-100/60">
          <input type="checkbox" checked={f.autoRenew} onChange={e => setF({ ...f, autoRenew: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
          <div>
            <span className="font-medium text-gray-700">Renovación automática</span>
            <p className="text-xs text-gray-400 mt-0.5">Se renovará al finalizar el ciclo</p>
          </div>
        </label>
        <Field label="Notas">
          <textarea value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} className="modal-input" rows={3} placeholder="Notas adicionales..." />
        </Field>
        <button onClick={save} className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white py-3.5 rounded-2xl text-sm font-semibold shadow-lg shadow-violet-500/30 hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
          Guardar cambios
        </button>
      </div>
    </Modal>
  )
}

function EditProfileModal({ userId, current, onClose, onSaved }: any) {
  const [objectives, setObjectives] = useState<any[]>([])
  const [f, setF] = useState({
    objectiveId: current?.objectiveId || '',
    trainerId: current?.trainerId || '',
    trainerName: current?.trainerName || '',
    notes: current?.notes || '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.getGymObjectives().then((r: any) => {
      if (r.success) setObjectives(r.data || [])
    })
  }, [])

  const save = async () => {
    setSaving(true)
    // Update profile
    const profileRes = await api.updateGymMemberProfile(userId, {
      objectiveId: f.objectiveId || null,
      notes: f.notes || null,
    })
    // Reassign trainer if changed
    const trainerRes = await api.reassignGymTrainer(userId, f.trainerId || null)
    setSaving(false)
    if (profileRes.success || trainerRes.success) onSaved()
    else alert(profileRes.error || trainerRes.error || 'Error al guardar')
  }

  return (
    <Modal title="Editar perfil de miembro" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Objetivo del miembro">
          <select value={f.objectiveId} onChange={e => setF({ ...f, objectiveId: e.target.value })} className="modal-input">
            <option value="">Sin objetivo</option>
            {objectives.map((o: any) => (
              <option key={o.id} value={o.id}>{o.name || o.label || o.id}</option>
            ))}
          </select>
        </Field>
        <Field label="Entrenador asignado">
          <input
            value={f.trainerName}
            onChange={e => setF({ ...f, trainerName: e.target.value, trainerId: e.target.value })}
            className="modal-input"
            placeholder="Nombre del entrenador"
          />
        </Field>
        <Field label="Notas">
          <textarea
            value={f.notes}
            onChange={e => setF({ ...f, notes: e.target.value })}
            className="modal-input"
            rows={3}
            placeholder="Observaciones, alergias, preferencias..."
          />
        </Field>
        <button onClick={save} disabled={saving}
          className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white py-3.5 rounded-2xl text-sm font-semibold shadow-lg shadow-violet-500/30 disabled:opacity-50 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
          {saving ? 'Guardando...' : 'Guardar perfil'}
        </button>
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
      <div className="space-y-5">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/30">
            <Flame className="w-8 h-8 text-white" />
          </div>
          <p className="text-sm text-gray-500">Crea un plan de entrenamiento personalizado</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <Field label="Nombre del plan">
              <input value={name} onChange={e => setName(e.target.value)} className="modal-input" placeholder="Hipertrofia 4 días" />
            </Field>
          </div>
          <Field label="Días por semana">
            <input value={days} onChange={e => setDays(e.target.value)} inputMode="numeric" className="modal-input" placeholder="4" />
          </Field>
        </div>
        <Field label="Descripción">
          <input value={desc} onChange={e => setDesc(e.target.value)} className="modal-input" placeholder="Enfocado en fuerza y volumen" />
        </Field>
        <div className="flex items-center gap-2 pt-2">
          <Dumbbell className="w-5 h-5 text-violet-500" />
          <span className="text-sm font-bold text-gray-700">Ejercicios</span>
        </div>
        <div className="space-y-3">
          {exs.map((ex, i) => (
            <div key={i} className="bg-gradient-to-r from-gray-50/80 to-white/80 backdrop-blur-sm border border-gray-100/60 rounded-2xl p-4 space-y-3 hover:shadow-md transition-all duration-300">
              <div className="flex gap-3">
                <input value={ex.dayLabel} onChange={e => upd(i, 'dayLabel', e.target.value)} className="modal-input w-28" placeholder="Día 1" />
                <input value={ex.name} onChange={e => upd(i, 'name', e.target.value)} className="modal-input flex-1" placeholder="Press banca" />
                {exs.length > 1 && (
                  <button onClick={() => setExs(exs.filter((_, j) => j !== i))}
                    className="text-gray-300 hover:text-red-500 px-2 transition-colors rounded-xl hover:bg-red-50/80 backdrop-blur-sm">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-3">
                <input value={ex.sets} onChange={e => upd(i, 'sets', e.target.value)} className="modal-input" placeholder="Sets" inputMode="numeric" />
                <input value={ex.reps} onChange={e => upd(i, 'reps', e.target.value)} className="modal-input" placeholder="Reps" />
                <input value={ex.weightKg} onChange={e => upd(i, 'weightKg', e.target.value)} className="modal-input" placeholder="kg" inputMode="decimal" />
                <input value={ex.restSeconds} onChange={e => upd(i, 'restSeconds', e.target.value)} className="modal-input" placeholder="Desc.s" inputMode="numeric" />
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => setExs([...exs, { dayLabel: '', name: '', sets: '', reps: '', weightKg: '', restSeconds: '' }])}
          className="w-full border-2 border-dashed border-gray-200/60 rounded-2xl py-3.5 text-sm font-semibold text-gray-500 hover:text-violet-600 hover:border-violet-300/60 hover:bg-violet-50/50 transition-all duration-300 flex items-center justify-center gap-2 backdrop-blur-sm">
          <Plus className="w-4 h-4" /> Agregar ejercicio
        </button>
        <button onClick={save} className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white py-3.5 rounded-2xl text-sm font-semibold shadow-lg shadow-violet-500/30 hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
          Crear plan
        </button>
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
      <div className="space-y-5">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30">
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
          <p className="text-sm text-gray-500">Registra el progreso corporal del miembro</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Peso (kg)">
            <input value={f.weightKg} onChange={e => setF({ ...f, weightKg: e.target.value })} inputMode="decimal" className="modal-input" placeholder="75.5" />
          </Field>
          <Field label="% Grasa corporal">
            <input value={f.bodyFatPct} onChange={e => setF({ ...f, bodyFatPct: e.target.value })} inputMode="decimal" className="modal-input" placeholder="15.2" />
          </Field>
          <Field label="Músculo (kg)">
            <input value={f.muscleMassKg} onChange={e => setF({ ...f, muscleMassKg: e.target.value })} inputMode="decimal" className="modal-input" placeholder="32.1" />
          </Field>
        </div>
        <div className="flex items-center gap-2 pt-2">
          <BarChart3 className="w-5 h-5 text-violet-500" />
          <span className="text-sm font-bold text-gray-700">Medidas corporales (cm)</span>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {MEASURES.map(([k, l]) => (
            <Field key={k} label={l}>
              <input value={m[k] || ''} onChange={e => setM({ ...m, [k]: e.target.value })} inputMode="decimal" className="modal-input" placeholder="0" />
            </Field>
          ))}
        </div>
        <Field label="Notas">
          <textarea value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} className="modal-input" rows={3} placeholder="Observaciones adicionales..." />
        </Field>
        <button onClick={save} className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-3.5 rounded-2xl text-sm font-semibold shadow-lg shadow-emerald-500/30 hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
          Guardar progreso
        </button>
      </div>
    </Modal>
  )
}

// ── Escáner de acceso (recepción) ──
const ACCESS_CFG: Record<string, any> = {
  permitido:  { icon: ShieldCheck, color: 'text-emerald-700', bg: 'from-emerald-50/80 to-teal-50/80 border-emerald-200/60', gradient: 'from-emerald-500 to-teal-600', label: 'ACCESO PERMITIDO' },
  por_vencer: { icon: ShieldAlert, color: 'text-amber-700',   bg: 'from-amber-50/80 to-orange-50/80 border-amber-200/60',   gradient: 'from-amber-500 to-orange-600', label: 'POR VENCER' },
  denegado:   { icon: ShieldX,     color: 'text-red-700',     bg: 'from-red-50/80 to-rose-50/80 border-red-200/60',         gradient: 'from-red-500 to-rose-600', label: 'ACCESO DENEGADO' },
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
      <div className={`rounded-3xl border bg-gradient-to-br p-12 text-center shadow-2xl backdrop-blur-sm ${cfg.bg}`}>
        <div className={`inline-flex items-center justify-center w-28 h-28 rounded-full bg-gradient-to-br ${cfg.gradient} shadow-2xl mb-6`}>
          <cfg.icon className="w-14 h-14 text-white" />
        </div>
        <div className={`text-3xl font-extrabold mt-2 ${cfg.color}`}>{cfg.label}</div>
        {result.name && <div className="text-xl font-bold mt-3 text-gray-900">{result.name}</div>}
        <div className="text-sm text-gray-500 mt-2">{result.reason}{result.daysRemaining != null && result.status !== 'denegado' ? ` • ${result.daysRemaining} días restantes` : ''}</div>
        {result.checkedIn && (
          <div className="inline-flex items-center gap-2 text-sm text-emerald-600 mt-4 bg-emerald-100/80 backdrop-blur-sm px-4 py-2 rounded-full font-semibold">
            <ShieldCheck className="w-4 h-4" /> Ingreso registrado
          </div>
        )}
        {result.status === 'denegado' && (
          <div className="inline-flex items-center gap-2 text-sm text-red-600 mt-4 bg-red-100/80 backdrop-blur-sm px-4 py-2 rounded-full font-semibold">
            <ShieldX className="w-4 h-4" /> Renovar membresía en la pestaña Miembros
          </div>
        )}
        <button onClick={() => { setResult(null); setManual('') }}
          className="mt-8 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white px-8 py-3.5 rounded-2xl text-sm font-semibold shadow-lg shadow-violet-500/30 hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95">
          Escanear otro
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="text-center mb-6">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-violet-500/30">
          <QrCode className="w-10 h-10 text-white" />
        </div>
        <h3 className="text-xl font-bold text-gray-900">Escáner de Acceso</h3>
        <p className="text-sm text-gray-500 mt-1">Escanea el código QR del miembro o ingrésalo manualmente</p>
      </div>

      <div className="relative rounded-3xl bg-gray-900 aspect-square overflow-hidden shadow-2xl ring-1 ring-gray-200/60">
        <video ref={videoRef} className="w-full h-full object-cover" />
        {scanning && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 border-2 border-white/30 rounded-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-56 h-0.5 bg-gradient-to-r from-transparent via-violet-500 to-transparent animate-[scanline_2s_ease-in-out_infinite]" />
            <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-white/40 rounded-tl-lg" />
            <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-white/40 rounded-tr-lg" />
            <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-white/40 rounded-bl-lg" />
            <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-white/40 rounded-br-lg" />
          </div>
        )}
        {!scanning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50">
            <QrCode className="w-20 h-20" />
            <span className="text-sm mt-4 font-medium">Cámara apagada</span>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {!scanning
          ? <button onClick={start} className="flex-1 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white py-4 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-violet-500/30 hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
              <Camera className="w-5 h-5" />Escanear QR
            </button>
          : <button onClick={stop} className="flex-1 bg-gray-100/80 backdrop-blur-sm text-gray-700 py-4 rounded-2xl text-sm font-semibold hover:bg-gray-200/80 transition-colors">
              Detener cámara
            </button>}
      </div>

      <div className="flex gap-3">
        <input value={manual} onChange={e => setManual(e.target.value)} placeholder="O ingresa el código manual"
          className="flex-1 border border-gray-200/60 rounded-2xl px-5 py-4 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all duration-300 bg-white/80 backdrop-blur-sm" />
        <button onClick={() => manual.trim() && process(manual.trim())}
          className="bg-gray-800 hover:bg-gray-900 text-white px-6 rounded-2xl text-sm font-semibold transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95">
          Validar
        </button>
      </div>

      {err && (
        <div className="flex items-center justify-center gap-2 text-sm text-red-600 bg-red-50/80 backdrop-blur-sm p-4 rounded-2xl border border-red-200/60">
          <ShieldX className="w-4 h-4 flex-shrink-0" />{err}
        </div>
      )}
    </div>
  )
}

// ── Vista de Entrenamiento (biblioteca de ejercicios + plantillas + sesiones) ──
function TrainingView({ members }: any) {
  const [subTab, setSubTab] = useState<'ejercicios' | 'plantillas' | 'sesiones'>('ejercicios')
  const [exercises, setExercises] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showTemplate, setShowTemplate] = useState<any | null>(null)
  const [showAssign, setShowAssign] = useState<any | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [ex, tpl, asg] = await Promise.all([
      api.listTrainingExercises(),
      api.listTrainingTemplates(),
      api.listTrainingAssignments(),
    ])
    if (ex.success) setExercises(ex.data?.rows || ex.data || [])
    if (tpl.success) setTemplates(tpl.data || [])
    if (asg.success) setAssignments(asg.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('¿Eliminar esta plantilla?')) return
    const r = await api.deleteTrainingTemplate(id)
    if (r.success) load()
    else alert(r.error || 'Error al eliminar')
  }

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-2 bg-white/60 backdrop-blur-sm rounded-2xl p-2 border border-white/60 shadow-md">
        {([
          ['ejercicios', 'Biblioteca de ejercicios', BookOpen],
          ['plantillas', 'Plantillas', Target],
          ['sesiones', 'Asignaciones', Activity],
        ] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setSubTab(k)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 ${
              subTab === k
                ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/30'
                : 'text-gray-500 hover:text-gray-700 hover:bg-white/80'
            }`}>
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          <span className="text-sm mt-3">Cargando...</span>
        </div>
      ) : subTab === 'ejercicios' ? (
        <ExercisesLibrary exercises={exercises} />
      ) : subTab === 'plantillas' ? (
        <TemplatesList templates={templates} onView={setShowTemplate} onDelete={handleDeleteTemplate} onAssign={setShowAssign} />
      ) : (
        <AssignmentsList assignments={assignments} members={members} />
      )}

      {showTemplate && <TemplateDetailModal template={showTemplate} onClose={() => setShowTemplate(null)} />}
      {showAssign && <AssignTemplateModal template={showAssign} members={members} onClose={() => setShowAssign(null)} onSaved={() => { setShowAssign(null); load() }} />}
    </div>
  )
}

function ExercisesLibrary({ exercises }: any) {
  const [search, setSearch] = useState('')
  const filtered = exercises.filter((e: any) =>
    !search || (e.name || '').toLowerCase().includes(search.toLowerCase())
  )
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/60 shadow-xl overflow-hidden">
      <div className="p-6 border-b border-gray-100/50 flex items-center justify-between gap-4">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-orange-500" />
          Biblioteca de Ejercicios
        </h3>
        <input
          type="text"
          placeholder="Buscar ejercicio..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-4 py-2 rounded-xl border border-gray-200/60 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 bg-white/80 backdrop-blur-sm w-64"
        />
      </div>
      <div className="p-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <BookOpen className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-sm">No hay ejercicios en la biblioteca</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((e: any) => (
              <div key={e.id} className="bg-gradient-to-br from-gray-50/80 to-white/80 backdrop-blur-sm border border-gray-100/60 rounded-2xl p-4 hover:shadow-md transition-all duration-300">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-gray-900 text-sm">{e.name}</h4>
                  {e.difficulty && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 font-semibold uppercase">
                      {e.difficulty}
                    </span>
                  )}
                </div>
                {e.muscleGroup && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                    <Target className="w-3 h-3" />
                    {e.muscleGroup}
                  </div>
                )}
                {e.equipment && (
                  <div className="text-xs text-gray-400">{e.equipment}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TemplatesList({ templates, onView, onDelete, onAssign }: any) {
  if (!templates.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Target className="w-12 h-12 text-gray-300 mb-3" />
        <p className="text-lg font-semibold text-gray-600">Sin plantillas de entrenamiento</p>
        <p className="text-sm text-gray-400 mt-1">Crea plantillas para asignarlas a tus miembros</p>
      </div>
    )
  }
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/60 shadow-xl overflow-hidden">
      <div className="p-6 border-b border-gray-100/50">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Target className="w-5 h-5 text-orange-500" />
          Plantillas de Entrenamiento
        </h3>
      </div>
      <div className="divide-y divide-gray-100/50">
        {templates.map((t: any) => (
          <div key={t.id} className="flex items-center justify-between px-6 py-4 hover:bg-orange-50/20 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">{t.name}</div>
                {t.category && <div className="text-xs text-gray-500">{t.category}</div>}
                {t.description && <div className="text-xs text-gray-400 mt-0.5">{t.description}</div>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => onView(t)}
                className="p-2 rounded-xl text-gray-400 hover:bg-gray-100/80 hover:text-gray-600 transition-all">
                <ChevronRight className="w-4 h-4" />
              </button>
              <button onClick={() => onAssign(t)}
                className="text-xs font-semibold text-violet-700 bg-violet-50/80 hover:bg-violet-100/80 px-3 py-2 rounded-xl transition-colors flex items-center gap-1">
                <UserCog className="w-3.5 h-3.5" /> Asignar
              </button>
              <button onClick={() => onDelete(t.id)}
                className="p-2 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50/80 transition-all">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AssignmentsList({ assignments, members }: any) {
  if (!assignments.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Activity className="w-12 h-12 text-gray-300 mb-3" />
        <p className="text-lg font-semibold text-gray-600">Sin asignaciones activas</p>
        <p className="text-sm text-gray-400 mt-1">Asigna una plantilla a un miembro para empezar</p>
      </div>
    )
  }
  const memberMap = new Map<string, any>((members || []).map((m: any) => [m.userId, m]))
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/60 shadow-xl overflow-hidden">
      <div className="p-6 border-b border-gray-100/50">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Activity className="w-5 h-5 text-orange-500" />
          Asignaciones Activas
        </h3>
      </div>
      <div className="divide-y divide-gray-100/50">
        {assignments.map((a: any) => {
          const m = memberMap.get(a.memberId)
          const statusColors: Record<string, string> = {
            activa: 'bg-emerald-50/80 text-emerald-700',
            pausada: 'bg-amber-50/80 text-amber-700',
            finalizada: 'bg-gray-100/80 text-gray-500',
          }
          return (
            <div key={a.id} className="flex items-center justify-between px-6 py-4 hover:bg-orange-50/20 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-violet-500/30">
                  {(m?.name || '?')[0].toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{m?.name || a.memberId}</div>
                  <div className="text-xs text-gray-400">{a.templateName || 'Plantilla'}</div>
                </div>
              </div>
              {a.status && (
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusColors[a.status] || ''}`}>
                  {a.status}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TemplateDetailModal({ template, onClose }: any) {
  return (
    <Modal title={template.name} onClose={onClose} wide>
      <div className="space-y-4">
        {template.description && <p className="text-sm text-gray-500">{template.description}</p>}
        {template.category && (
          <div className="text-xs text-gray-500">
            <span className="font-semibold">Categoría:</span> {template.category}
          </div>
        )}
        {template.exercises?.length ? (
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-gray-900">Ejercicios</h4>
            {template.exercises.map((e: any, i: number) => (
              <div key={i} className="bg-gray-50/80 border border-gray-100/60 rounded-xl p-3 text-sm">
                <div className="font-semibold text-gray-900">{e.name}</div>
                {e.sets && <div className="text-xs text-gray-500">{e.sets}x{e.reps} • {e.weightKg ? `${e.weightKg}kg` : ''} • {e.restSeconds ? `${e.restSeconds}s descanso` : ''}</div>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-6">Sin ejercicios definidos</p>
        )}
      </div>
    </Modal>
  )
}

function AssignTemplateModal({ template, members, onClose, onSaved }: any) {
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  const save = async () => {
    if (!selected.length) return
    setSaving(true)
    const r = await api.assignTrainingTemplate({ templateId: template.id, memberIds: selected })
    setSaving(false)
    if (r.success) onSaved()
    else alert(r.error || 'Error al asignar')
  }
  return (
    <Modal title={`Asignar "${template.name}"`} onClose={onClose} wide>
      <div className="space-y-4">
        <p className="text-sm text-gray-500">Selecciona los miembros a los que deseas asignar esta plantilla</p>
        <div className="max-h-80 overflow-y-auto space-y-2 border border-gray-100/60 rounded-xl p-2">
          {members.map((m: any) => (
            <label key={m.userId} className="flex items-center gap-3 p-3 rounded-xl hover:bg-violet-50/30 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={selected.includes(m.userId)}
                onChange={() => toggle(m.userId)}
                className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
              />
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                {(m.name || '?')[0].toUpperCase()}
              </div>
              <div>
                <div className="font-medium text-sm text-gray-900">{m.name}</div>
                <div className="text-xs text-gray-400">{m.email}</div>
              </div>
            </label>
          ))}
        </div>
        <button onClick={save} disabled={saving || !selected.length}
          className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white py-3.5 rounded-2xl text-sm font-semibold shadow-lg shadow-violet-500/30 disabled:opacity-50 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
          {saving ? 'Asignando...' : `Asignar a ${selected.length || 0} miembro(s)`}
        </button>
      </div>
    </Modal>
  )
}

// ── Vista de Salud (evaluaciones, fotos, condiciones) ──
function HealthView({ members }: any) {
  const [selectedMember, setSelectedMember] = useState<any>(null)
  const [assessments, setAssessments] = useState<any[]>([])
  const [photos, setPhotos] = useState<any[]>([])
  const [conditions, setConditions] = useState<any[]>([])
  const [dashboard, setDashboard] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [showAddAssessment, setShowAddAssessment] = useState(false)
  const [showAddCondition, setShowAddCondition] = useState(false)

  const load = useCallback(async (memberId: string) => {
    setLoading(true)
    const [a, p, c, d] = await Promise.all([
      api.listHealthAssessments(memberId),
      api.listHealthPhotos(memberId),
      api.listHealthConditions(memberId),
      api.getHealthDashboard(memberId),
    ])
    if (a.success) setAssessments(a.data || [])
    if (p.success) setPhotos(p.data || [])
    if (c.success) setConditions(c.data || [])
    if (d.success) setDashboard(d.data)
    setLoading(false)
  }, [])

  useEffect(() => { if (selectedMember) load(selectedMember.userId) }, [selectedMember, load])

  if (!selectedMember) {
    return (
      <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/60 shadow-xl p-6">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
          <Stethoscope className="w-5 h-5 text-emerald-500" />
          Salud de Miembros
        </h3>
        <p className="text-sm text-gray-500 mb-4">Selecciona un miembro para ver su historial de salud</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {members.map((m: any) => (
            <button key={m.userId} onClick={() => setSelectedMember(m)}
              className="flex items-center gap-3 p-4 rounded-2xl border border-gray-100/60 hover:border-emerald-300/60 hover:bg-emerald-50/30 transition-all duration-300 text-left">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-emerald-500/30">
                {(m.name || '?')[0].toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-gray-900 text-sm">{m.name}</div>
                <div className="text-xs text-gray-400">{m.email}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => setSelectedMember(null)}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          ← Volver a la lista
        </button>
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-emerald-500" />
          {selectedMember.name}
        </h3>
        <div />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <span className="text-sm mt-3">Cargando historial de salud...</span>
        </div>
      ) : (
        <>
          {/* Dashboard resumen */}
          {dashboard && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Evaluaciones', value: assessments.length, icon: Stethoscope, gradient: 'from-emerald-500 to-teal-600' },
                { label: 'Fotos de progreso', value: photos.length, icon: ImageIcon, gradient: 'from-pink-500 to-rose-600' },
                { label: 'Condiciones activas', value: conditions.filter((c: any) => c.status === 'activa').length, icon: FileText, gradient: 'from-amber-500 to-orange-600' },
                { label: 'Restricciones', value: dashboard.restrictionsCount || 0, icon: ShieldAlert, gradient: 'from-red-500 to-rose-600' },
              ].map((c) => (
                <div key={c.label} className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/60 p-4 shadow-md">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.gradient} flex items-center justify-center shadow-lg mb-2`}>
                    <c.icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-2xl font-extrabold text-gray-900">{c.value}</div>
                  <div className="text-xs text-gray-500">{c.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Evaluaciones */}
          <Section title="Evaluaciones físicas" icon={<Stethoscope className="w-5 h-5 text-emerald-500" />}
            action={<button onClick={() => setShowAddAssessment(true)} className="text-violet-600 text-sm flex items-center gap-1.5 font-semibold hover:text-violet-700 transition-colors">
              <Plus className="w-4 h-4" />Nueva
            </button>}>
            {assessments.length ? assessments.map((a: any) => (
              <div key={a.id} className="bg-gradient-to-r from-gray-50/80 to-white/80 border border-gray-100/60 rounded-xl p-4 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">{a.type || 'Evaluación'}</div>
                    <div className="text-xs text-gray-500">{a.date ? String(a.date).slice(0, 10) : ''}</div>
                  </div>
                  {a.weightKg && <div className="text-sm font-bold text-gray-700">{a.weightKg} kg</div>}
                </div>
              </div>
            )) : (
              <p className="text-xs text-gray-400 text-center py-4">Sin evaluaciones registradas</p>
            )}
          </Section>

          {/* Condiciones médicas */}
          <Section title="Condiciones médicas" icon={<FileText className="w-5 h-5 text-amber-500" />}
            action={<button onClick={() => setShowAddCondition(true)} className="text-violet-600 text-sm flex items-center gap-1.5 font-semibold hover:text-violet-700 transition-colors">
              <Plus className="w-4 h-4" />Reportar
            </button>}>
            {conditions.length ? conditions.map((c: any) => (
              <div key={c.id} className="bg-gradient-to-r from-gray-50/80 to-white/80 border border-gray-100/60 rounded-xl p-4 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">{c.name || c.condition || 'Condición'}</div>
                    {c.notes && <div className="text-xs text-gray-500 mt-0.5">{c.notes}</div>}
                  </div>
                  {c.severity && (
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                      c.severity === 'alta' ? 'bg-red-50 text-red-700' :
                      c.severity === 'media' ? 'bg-amber-50 text-amber-700' :
                      'bg-emerald-50 text-emerald-700'
                    }`}>
                      {c.severity}
                    </span>
                  )}
                </div>
              </div>
            )) : (
              <p className="text-xs text-gray-400 text-center py-4">Sin condiciones reportadas</p>
            )}
          </Section>

          {/* Fotos de progreso */}
          <Section title="Fotos de progreso" icon={<ImageIcon className="w-5 h-5 text-pink-500" />}>
            {photos.length ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {photos.map((p: any) => (
                  <div key={p.id} className="aspect-square rounded-xl overflow-hidden bg-gray-100">
                    {p.url ? (
                      <img src={p.url} alt={p.category || ''} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <ImageIcon className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-4">Sin fotos de progreso</p>
            )}
          </Section>
        </>
      )}

      {showAddAssessment && (
        <AddAssessmentModal memberId={selectedMember.userId} onClose={() => setShowAddAssessment(false)} onSaved={() => { setShowAddAssessment(false); load(selectedMember.userId) }} />
      )}
      {showAddCondition && (
        <AddConditionModal memberId={selectedMember.userId} onClose={() => setShowAddCondition(false)} onSaved={() => { setShowAddCondition(false); load(selectedMember.userId) }} />
      )}
    </div>
  )
}

function AddAssessmentModal({ memberId, onClose, onSaved }: any) {
  const [f, setF] = useState({ type: 'inicial', date: new Date().toISOString().slice(0, 10), weightKg: '', bodyFatPct: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    const r = await api.createHealthAssessment({ ...f, memberId, weightKg: Number(f.weightKg) || null, bodyFatPct: Number(f.bodyFatPct) || null })
    setSaving(false)
    if (r.success) onSaved()
    else alert(r.error || 'Error al guardar')
  }
  return (
    <Modal title="Nueva evaluación" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo">
            <select value={f.type} onChange={e => setF({ ...f, type: e.target.value })} className="modal-input">
              <option value="inicial">Inicial</option>
              <option value="seguimiento">Seguimiento</option>
              <option value="final">Final</option>
            </select>
          </Field>
          <Field label="Fecha">
            <input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} className="modal-input" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Peso (kg)">
            <input value={f.weightKg} onChange={e => setF({ ...f, weightKg: e.target.value })} inputMode="decimal" className="modal-input" placeholder="75.5" />
          </Field>
          <Field label="% Grasa">
            <input value={f.bodyFatPct} onChange={e => setF({ ...f, bodyFatPct: e.target.value })} inputMode="decimal" className="modal-input" placeholder="15.2" />
          </Field>
        </div>
        <Field label="Notas">
          <textarea value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} className="modal-input" rows={3} />
        </Field>
        <button onClick={save} disabled={saving}
          className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-3.5 rounded-2xl text-sm font-semibold shadow-lg shadow-emerald-500/30 disabled:opacity-50 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
          {saving ? 'Guardando...' : 'Guardar evaluación'}
        </button>
      </div>
    </Modal>
  )
}

function AddConditionModal({ memberId, onClose, onSaved }: any) {
  const [f, setF] = useState({ name: '', severity: 'baja', notes: '' })
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!f.name.trim()) return
    setSaving(true)
    const r = await api.reportHealthCondition({ ...f, memberId })
    setSaving(false)
    if (r.success) onSaved()
    else alert(r.error || 'Error al guardar')
  }
  return (
    <Modal title="Reportar condición médica" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Nombre de la condición">
          <input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className="modal-input" placeholder="Lesión, alergia, enfermedad..." />
        </Field>
        <Field label="Severidad">
          <select value={f.severity} onChange={e => setF({ ...f, severity: e.target.value })} className="modal-input">
            <option value="baja">Baja</option>
            <option value="media">Media</option>
            <option value="alta">Alta</option>
          </select>
        </Field>
        <Field label="Notas">
          <textarea value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} className="modal-input" rows={3} placeholder="Detalles, tratamiento, observaciones..." />
        </Field>
        <button onClick={save} disabled={saving}
          className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white py-3.5 rounded-2xl text-sm font-semibold shadow-lg shadow-amber-500/30 disabled:opacity-50 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
          {saving ? 'Guardando...' : 'Guardar condición'}
        </button>
      </div>
    </Modal>
  )
}

// ── Vista de Pagos y Facturación ──
// Dashboard financiero + historial + morosos + deudas.
function PaymentsView({ members, onOpenMember }: { members: any[]; onOpenMember: (m: any) => void }) {
  const [subTab, setSubTab] = useState<'dashboard' | 'historial' | 'morosos' | 'deudas'>('dashboard')
  const [summary, setSummary] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [overdue, setOverdue] = useState<any[]>([])
  const [debts, setDebts] = useState<any[]>([])
  const [revenue, setRevenue] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showRegister, setShowRegister] = useState<any>(null)
  const [filterMethod, setFilterMethod] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [showPayDebt, setShowPayDebt] = useState<any>(null)
  const [generating, setGenerating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const filters: Record<string, string> = {}
    if (filterMethod) filters.method = filterMethod
    if (filterStatus) filters.status = filterStatus
    const [s, p, o, d, r] = await Promise.all([
      api.getGymBillingSummary(),
      api.listGymPayments(filters),
      api.getGymOverdue(),
      api.listGymDebts({}),
      api.getGymRevenueByPeriod(
        new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10),
        new Date().toISOString().slice(0, 10)
      ),
    ])
    if (s.success) setSummary(s.data)
    else setSummary({ ingresosMes: 0, ingresos30d: 0, ingresos7d: 0, pagosMes: 0, anuladoMes: 0, reembolsadoMes: 0, deudaTotal: 0, numDeudas: 0, morosos: 0, porMetodo: [] })
    if (p.success) setPayments(p.data || [])
    if (o.success) setOverdue(o.data || [])
    if (d.success) setDebts(d.data || [])
    if (r.success) setRevenue(r.data || [])
    setLoading(false)
  }, [filterMethod, filterStatus])

  useEffect(() => { load() }, [load])

  const memberMap = new Map<string, any>((members || []).map((m: any) => [m.userId, m]))

  const handleGenerateDebts = async () => {
    setGenerating(true)
    const r = await api.generateGymDebts()
    setGenerating(false)
    if (r.success) {
      alert(`Se generaron ${r.data?.created || 0} deuda(s) nueva(s).`)
      load()
    } else {
      alert(r.error || 'Error al generar deudas')
    }
  }

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-2 bg-white/60 backdrop-blur-sm rounded-2xl p-2 border border-white/60 shadow-md overflow-x-auto">
        {([
          ['dashboard', 'Dashboard', BarChart3],
          ['historial', 'Historial de pagos', Receipt],
          ['morosos', 'Morosos', AlertCircle],
          ['deudas', 'Deudas', ArrowDownCircle],
        ] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setSubTab(k)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 whitespace-nowrap ${
              subTab === k
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/30'
                : 'text-gray-500 hover:text-gray-700 hover:bg-white/80'
            }`}>
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <span className="text-sm mt-3">Cargando...</span>
        </div>
      ) : subTab === 'dashboard' ? (
        <PaymentsDashboard summary={summary} revenue={revenue} overdueCount={overdue.length} debtTotal={debts.filter((d: any) => d.status !== 'pagado' && d.status !== 'condonado').reduce((s: number, d: any) => s + Number(d.totalDue - d.paidAmount), 0)} onGenerateDebts={handleGenerateDebts} generating={generating} />
      ) : subTab === 'historial' ? (
        <PaymentsHistory
          payments={payments}
          memberMap={memberMap}
          filterMethod={filterMethod}
          setFilterMethod={setFilterMethod}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          onRegister={() => setShowRegister({})}
        />
      ) : subTab === 'morosos' ? (
        <OverdueList overdue={overdue} memberMap={memberMap} onOpenMember={onOpenMember} />
      ) : (
        <DebtsList debts={debts} memberMap={memberMap} onPay={(d: any) => setShowPayDebt(d)} />
      )}

      {showRegister && (
        <RegisterPaymentModal
          preselected={showRegister.preselect}
          members={members}
          onClose={() => setShowRegister(null)}
          onSaved={() => { setShowRegister(null); load() }}
        />
      )}
      {showPayDebt && (
        <PayDebtModal
          debt={showPayDebt}
          onClose={() => setShowPayDebt(null)}
          onSaved={() => { setShowPayDebt(null); load() }}
        />
      )}
    </div>
  )
}

function PaymentsDashboard({ summary, revenue, overdueCount, debtTotal, onGenerateDebts, generating }: any) {
  const s = summary || { ingresosMes: 0, ingresos30d: 0, ingresos7d: 0, pagosMes: 0, anuladoMes: 0, reembolsadoMes: 0, deudaTotal: 0, numDeudas: 0, morosos: 0, porMetodo: [] }
  const maxRevenue = Math.max(1, ...(revenue || []).map((r: any) => Number(r.total) || 0))
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <KpiCard label="Ingresos del mes" value={fmt(s.ingresosMes)} sublabel={`${s.pagosMes} pagos`} gradient="from-emerald-500 to-teal-600" icon={Banknote} />
        <KpiCard label="Ingresos 30d" value={fmt(s.ingresos30d)} sublabel={`7d: ${fmt(s.ingresos7d)}`} gradient="from-sky-500 to-blue-600" icon={Wallet} />
        <KpiCard label="Miembros morosos" value={String(s.morosos)} sublabel="pago vencido" gradient="from-orange-500 to-red-600" icon={AlertCircle} />
        <KpiCard label="Deuda total" value={fmt(debtTotal)} sublabel={`${s.numDeudas} deuda(s)`} gradient="from-violet-500 to-purple-600" icon={CircleDollarSign} />
      </div>

      {/* Acciones rápidas */}
      <div className="flex flex-wrap gap-3">
        <button onClick={onGenerateDebts} disabled={generating}
          className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-orange-500/30 disabled:opacity-50 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
          Actualizar morosidad
        </button>
      </div>

      {/* Gráfico de ingresos últimos 30 días */}
      <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/60 shadow-xl p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-500" />
          Ingresos últimos 30 días
        </h3>
        {revenue.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Sin ingresos registrados en los últimos 30 días</p>
        ) : (
          <div className="flex items-end gap-1 h-40">
            {revenue.map((r: any, i: number) => {
              const h = Math.max(4, (Number(r.total) / maxRevenue) * 100)
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">${Math.round(Number(r.total) / 1000)}k</div>
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-emerald-500 to-teal-400 hover:from-emerald-600 hover:to-teal-500 transition-all cursor-pointer"
                    style={{ height: `${h}%` }}
                    title={`${String(r.day).slice(0, 10)}: ${fmt(r.total)} (${r.count} pagos)`}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Por método de pago */}
      {s.porMetodo?.length > 0 && (
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/60 shadow-xl p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-sky-500" />
            Por método de pago (últimos 30 días)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {s.porMetodo.map((m: any) => {
              const cfg = PAYMENT_METHODS[m.method] || PAYMENT_METHODS.otro
              return (
                <div key={m.method} className={`rounded-2xl p-3 ring-1 ${cfg.color} text-center`}>
                  <div className="text-2xl mb-1">{cfg.icon}</div>
                  <div className="text-xs font-semibold">{cfg.label}</div>
                  <div className="text-sm font-bold mt-1">{fmt(m.total)}</div>
                  <div className="text-[10px] opacity-70">{m.count} pagos</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, sublabel, gradient, icon: Icon }: any) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white/80 backdrop-blur-sm border border-white/60 p-6 shadow-lg shadow-gray-200/50 hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
      <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br ${gradient} opacity-10 group-hover:opacity-20 group-hover:scale-150 transition-all duration-700`} />
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className={`flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
        <div className="text-2xl font-extrabold text-gray-900 tracking-tight">{value}</div>
        <div className="text-sm text-gray-500 mt-1 font-medium">{label}</div>
        {sublabel && <div className="text-xs text-gray-400 mt-0.5">{sublabel}</div>}
      </div>
    </div>
  )
}

function PaymentsHistory({ payments, memberMap, filterMethod, setFilterMethod, filterStatus, setFilterStatus, onRegister }: any) {
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/60 shadow-xl overflow-hidden">
      <div className="p-6 border-b border-gray-100/50 flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 flex-1">
          <Receipt className="w-5 h-5 text-emerald-500" />
          Historial de pagos
        </h3>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-gray-200/60 text-sm outline-none focus:border-emerald-500 bg-white/80 backdrop-blur-sm">
            <option value="">Todos los métodos</option>
            {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-gray-200/60 text-sm outline-none focus:border-emerald-500 bg-white/80 backdrop-blur-sm">
            <option value="">Todos los estados</option>
            <option value="aplicado">Aplicado</option>
            <option value="anulado">Anulado</option>
            <option value="reembolsado">Reembolsado</option>
            <option value="pendiente">Pendiente</option>
          </select>
          <button onClick={onRegister}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-4 py-1.5 rounded-xl text-sm font-semibold shadow-lg shadow-emerald-500/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
            <Plus className="w-4 h-4" /> Registrar pago
          </button>
        </div>
      </div>
      {payments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Receipt className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-sm">No hay pagos registrados</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100/50">
          {payments.map((p: any) => {
            const mCfg = PAYMENT_METHODS[p.method] || PAYMENT_METHODS.otro
            const statusColors: Record<string, string> = {
              aplicado: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
              anulado: 'bg-red-50 text-red-700 ring-red-200',
              reembolsado: 'bg-amber-50 text-amber-700 ring-amber-200',
              pendiente: 'bg-sky-50 text-sky-700 ring-sky-200',
            }
            const m = memberMap.get(p.memberUserId)
            return (
              <div key={p.id} className="flex items-center justify-between px-6 py-4 hover:bg-emerald-50/20 transition-colors">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ring-1 ${mCfg.color}`}>
                    {mCfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{m?.name || p.memberName || 'Miembro'}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ring-1 ${statusColors[p.status] || ''}`}>
                        {p.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {mCfg.label}
                      {p.reference && ` · Ref: ${p.reference}`}
                      {p.concept && ` · ${p.concept}`}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900">{fmt(p.amount)}</div>
                  <div className="text-xs text-gray-400">{p.paymentDate ? String(p.paymentDate).slice(0, 10) : ''}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function OverdueList({ overdue, memberMap, onOpenMember }: any) {
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/60 shadow-xl overflow-hidden">
      <div className="p-6 border-b border-gray-100/50">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-orange-500" />
          Miembros con pago vencido
        </h3>
        <p className="text-sm text-gray-500 mt-1">Membresías activas con next_payment_at anterior a hoy</p>
      </div>
      {overdue.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <CheckCircle2 className="w-12 h-12 text-emerald-300 mb-3" />
          <p className="text-sm font-semibold text-gray-500">¡Todo al día!</p>
          <p className="text-xs text-gray-400 mt-1">No hay miembros con pago vencido</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100/50">
          {overdue.map((o: any) => {
            const m = memberMap.get(o.memberUserId)
            const days = Number(o.daysOverdue) || 0
            const severity = days > 14 ? 'bg-red-50 text-red-700' : days > 7 ? 'bg-amber-50 text-amber-700' : 'bg-orange-50 text-orange-700'
            return (
              <div key={o.membresiaId} className="flex items-center justify-between px-6 py-4 hover:bg-orange-50/20 transition-colors">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-orange-500/30">
                    {(m?.name || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900">{m?.name || 'Miembro'}</div>
                    <div className="text-xs text-gray-400">{m?.email} · {o.planName} · {fmt(o.price)}/{o.paymentCycle}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${severity}`}>
                    {days} día{days !== 1 ? 's' : ''} vencido
                  </span>
                  <button onClick={() => onOpenMember?.(m)}
                    className="text-violet-600 hover:text-violet-700 transition-colors p-2 rounded-xl hover:bg-violet-50/80">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DebtsList({ debts, memberMap, onPay }: any) {
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/60 shadow-xl overflow-hidden">
      <div className="p-6 border-b border-gray-100/50">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <ArrowDownCircle className="w-5 h-5 text-violet-500" />
          Deudas y cargos pendientes
        </h3>
        <p className="text-sm text-gray-500 mt-1">Deudas generadas automáticamente al vencer un pago. Incluye recargos progresivos.</p>
      </div>
      {debts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <CheckCircle2 className="w-12 h-12 text-emerald-300 mb-3" />
          <p className="text-sm font-semibold text-gray-500">Sin deudas registradas</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100/50">
          {debts.map((d: any) => {
            const m = memberMap.get(d.memberUserId)
            const restante = Number(d.totalDue) - Number(d.paidAmount)
            const statusColors: Record<string, string> = {
              pendiente: 'bg-amber-50 text-amber-700 ring-amber-200',
              vencido: 'bg-red-50 text-red-700 ring-red-200',
              pagado: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
              condonado: 'bg-gray-100 text-gray-500 ring-gray-200',
            }
            return (
              <div key={d.id} className="flex items-center justify-between px-6 py-4 hover:bg-violet-50/20 transition-colors">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-violet-500/30">
                    {(m?.name || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{m?.name || 'Miembro'}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ring-1 ${statusColors[d.status] || ''}`}>
                        {d.status}
                      </span>
                      {Number(d.surchargePct) > 0 && (
                        <span className="text-[10px] text-orange-600 font-semibold">+{d.surchargePct}% recargo</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {d.concept || 'Membresía'} · Vence: {d.dueDate}
                      {Number(d.daysOverdue) > 0 && ` · ${d.daysOverdue} días vencida`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-bold text-gray-900">{fmt(restante)}</div>
                    {Number(d.paidAmount) > 0 && <div className="text-xs text-emerald-600">de {fmt(d.totalDue)}</div>}
                  </div>
                  {(d.status === 'pendiente' || d.status === 'vencido') && (
                    <button onClick={() => onPay?.(d)}
                      className="flex items-center gap-1 text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 px-3 py-1.5 rounded-xl shadow-lg shadow-emerald-500/30 transition-all duration-200 hover:scale-105 active:scale-95">
                      <DollarSign className="w-3.5 h-3.5" /> Pagar
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function RegisterPaymentModal({ preselected, members, onClose, onSaved }: any) {
  const [memberSearch, setMemberSearch] = useState('')
  const [selectedMember, setSelectedMember] = useState<any>(preselected || null)
  const [f, setF] = useState({
    amount: '',
    method: 'efectivo',
    reference: '',
    concept: '',
    periodStart: '',
    periodEnd: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // Para simplicidad, asumimos que `selectedMember` es un objeto con userId.
  // Necesitamos el ID de la membresía, que viene de gym_membresias. Como no
  // la tenemos cargada, el backend acepta membresiaId directamente.
  const [membresiaId, setMembresiaId] = useState<string>('')
  const [loadingMemb, setLoadingMemb] = useState(false)

  // Cuando se selecciona un miembro, buscar su membresía
  useEffect(() => {
    if (!selectedMember?.userId) { setMembresiaId(''); return }
    setLoadingMemb(true)
    api.getGymMember(selectedMember.userId).then((r: any) => {
      setLoadingMemb(false)
      if (r.success && r.data?.membership?.id) {
        setMembresiaId(r.data.membership.id)
        if (r.data.membership.price && !f.amount) {
          setF((prev: any) => ({ ...prev, amount: String(r.data.membership.price) }))
        }
      }
    })
  }, [selectedMember?.userId])

  const filteredMembers = (members || []).filter((m: any) =>
    !memberSearch || (m.name || '').toLowerCase().includes(memberSearch.toLowerCase()) || (m.email || '').toLowerCase().includes(memberSearch.toLowerCase())
  )

  const save = async () => {
    if (!membresiaId) { setErr('Selecciona un miembro'); return }
    if (!Number(f.amount) || Number(f.amount) <= 0) { setErr('Monto inválido'); return }
    setSaving(true); setErr('')
    const r = await api.registerGymPayment({
      membresiaId,
      amount: Number(f.amount),
      method: f.method,
      reference: f.reference || undefined,
      concept: f.concept || undefined,
      periodStart: f.periodStart || undefined,
      periodEnd: f.periodEnd || undefined,
      notes: f.notes || undefined,
    })
    setSaving(false)
    if (r.success) onSaved()
    else setErr(r.error || 'Error al registrar el pago')
  }

  return (
    <Modal title="Registrar pago" onClose={onClose} wide>
      <div className="space-y-4">
        {!selectedMember && (
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-2 block">Buscar miembro</label>
            <input
              type="text"
              placeholder="Escribe el nombre o email..."
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
              className="modal-input"
            />
            <div className="mt-2 max-h-48 overflow-y-auto border border-gray-100/60 rounded-xl">
              {filteredMembers.length === 0 ? (
                <p className="p-4 text-center text-sm text-gray-400">No se encontraron miembros</p>
              ) : (
                filteredMembers.slice(0, 10).map((m: any) => (
                  <button key={m.userId} onClick={() => { setSelectedMember(m); setMemberSearch('') }}
                    className="w-full text-left p-3 hover:bg-violet-50/50 transition-colors flex items-center gap-3 border-b border-gray-50 last:border-0">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                      {(m.name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-sm text-gray-900">{m.name}</div>
                      <div className="text-xs text-gray-400">{m.email}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {selectedMember && (
          <>
            <div className="flex items-center gap-3 p-3 bg-violet-50/50 rounded-xl">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                {(selectedMember.name || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-gray-900">{selectedMember.name}</div>
                <div className="text-xs text-gray-500">{selectedMember.email}</div>
              </div>
              <button onClick={() => { setSelectedMember(null); setMembresiaId('') }}
                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-white/60">
                Cambiar
              </button>
            </div>

            {loadingMemb && <p className="text-xs text-gray-400">Cargando membresía...</p>}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Monto *">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" value={f.amount}
                    onChange={e => setF({ ...f, amount: e.target.value })}
                    className="modal-input !pl-8" placeholder="80000" />
                </div>
              </Field>
              <Field label="Método de pago">
                <select value={f.method} onChange={e => setF({ ...f, method: e.target.value })} className="modal-input">
                  {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Referencia (opcional)">
              <input value={f.reference} onChange={e => setF({ ...f, reference: e.target.value })}
                className="modal-input" placeholder="Núm. transacción, comprobante, etc." />
            </Field>

            <Field label="Concepto (opcional)">
              <input value={f.concept} onChange={e => setF({ ...f, concept: e.target.value })}
                className="modal-input" placeholder="Membresía mensual, inscripción, etc." />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Período desde">
                <input type="date" value={f.periodStart} onChange={e => setF({ ...f, periodStart: e.target.value })} className="modal-input" />
              </Field>
              <Field label="Período hasta">
                <input type="date" value={f.periodEnd} onChange={e => setF({ ...f, periodEnd: e.target.value })} className="modal-input" />
              </Field>
            </div>

            <Field label="Notas (opcional)">
              <textarea value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })}
                className="modal-input" rows={2} placeholder="Observaciones internas..." />
            </Field>

            {err && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50/80 backdrop-blur-sm p-3 rounded-xl border border-red-200/60">
                <ShieldX className="w-4 h-4 flex-shrink-0" /> {err}
              </div>
            )}

            <button onClick={save} disabled={saving || !membresiaId}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-3.5 rounded-2xl text-sm font-semibold shadow-lg shadow-emerald-500/30 disabled:opacity-50 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
              {saving ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</span> : 'Registrar pago'}
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}

function PayDebtModal({ debt, onClose, onSaved }: any) {
  const restante = Number(debt.totalDue) - Number(debt.paidAmount)
  const [amount, setAmount] = useState(String(restante))
  const [method, setMethod] = useState('efectivo')
  const [concept, setConcept] = useState('Regularización de deuda')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    setSaving(true); setErr('')
    const r = await api.payGymDebt(debt.id, { amount: Number(amount), method, concept })
    setSaving(false)
    if (r.success) onSaved()
    else setErr(r.error || 'Error al pagar la deuda')
  }

  return (
    <Modal title="Pagar deuda" onClose={onClose}>
      <div className="space-y-4">
        <div className="text-center p-4 bg-violet-50/50 rounded-xl">
          <div className="text-xs text-gray-500 mb-1">Pendiente</div>
          <div className="text-3xl font-extrabold text-gray-900">{fmt(restante)}</div>
          {Number(debt.surchargePct) > 0 && (
            <div className="text-xs text-orange-600 mt-1">Incluye {debt.surchargePct}% de recargo ({fmt(debt.surchargeAmount)})</div>
          )}
        </div>

        <Field label="Monto a pagar">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              className="modal-input !pl-8" max={restante} />
          </div>
        </Field>

        <Field label="Método de pago">
          <select value={method} onChange={e => setMethod(e.target.value)} className="modal-input">
            {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
        </Field>

        <Field label="Concepto">
          <input value={concept} onChange={e => setConcept(e.target.value)} className="modal-input" />
        </Field>

        {err && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50/80 backdrop-blur-sm p-3 rounded-xl border border-red-200/60">
            <ShieldX className="w-4 h-4 flex-shrink-0" /> {err}
          </div>
        )}

        <button onClick={save} disabled={saving}
          className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-3.5 rounded-2xl text-sm font-semibold shadow-lg shadow-emerald-500/30 disabled:opacity-50 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
          {saving ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</span> : 'Confirmar pago'}
        </button>
      </div>
    </Modal>
  )
}

// ── Vista compacta del historial de pagos dentro del modal de miembro ──
export function MemberPaymentsTab({ userId, onRegister }: { userId: string; onRegister: () => void }) {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    api.listGymPayments({ memberUserId: userId }).then((r: any) => {
      if (r.success) setPayments(r.data || [])
      setLoading(false)
    })
  }, [userId])

  if (loading) {
    return (
      <div className="flex justify-center py-6 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <Section title="Historial de pagos" icon={<Receipt className="w-5 h-5 text-emerald-500" />}
      action={<button onClick={onRegister} className="text-violet-600 text-sm flex items-center gap-1.5 font-semibold hover:text-violet-700 transition-colors">
        <Plus className="w-4 h-4" />Nuevo
      </button>}>
      {payments.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">Sin pagos registrados</p>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {payments.slice(0, 10).map((p: any) => {
            const mCfg = PAYMENT_METHODS[p.method] || PAYMENT_METHODS.otro
            const statusColors: Record<string, string> = {
              aplicado: 'text-emerald-700 bg-emerald-50',
              anulado: 'text-red-700 bg-red-50',
              reembolsado: 'text-amber-700 bg-amber-50',
              pendiente: 'text-sky-700 bg-sky-50',
            }
            return (
              <div key={p.id} className="flex items-center justify-between text-sm bg-gradient-to-r from-gray-50/80 to-white/80 border border-gray-100/60 rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="text-lg">{mCfg.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{fmt(p.amount)}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${statusColors[p.status] || ''}`}>{p.status}</span>
                    </div>
                    <div className="text-xs text-gray-400">{mCfg.label} · {p.paymentDate ? String(p.paymentDate).slice(0, 10) : ''} {p.concept && `· ${p.concept}`}</div>
                  </div>
                </div>
              </div>
            )
          })}
          {payments.length > 10 && (
            <p className="text-xs text-center text-gray-400 pt-1">+{payments.length - 10} pago(s) más</p>
          )}
        </div>
      )}
    </Section>
  )
}

// ── Helpers de UI ──
function Modal({ title, onClose, children, wide }: any) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto ring-1 ring-white/60`}>
        <div className="flex items-center justify-between px-8 h-16 border-b border-gray-100/50 sticky top-0 bg-white/80 backdrop-blur-xl rounded-t-3xl z-10">
          <h3 className="font-bold text-gray-900 text-lg">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 hover:bg-gray-100/80 rounded-xl p-2 transition-all duration-200 hover:scale-110 active:scale-95 backdrop-blur-sm">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-8">{children}</div>
      </div>
      <style jsx global>{`
        .modal-input {
          width: 100%;
          border: 1px solid rgba(229, 231, 235, 0.6);
          border-radius: 0.875rem;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          outline: none;
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(8px);
          transition: all 0.2s ease;
        }
        .modal-input:focus {
          border-color: #8b5cf6;
          box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.1);
          transform: translateY(-1px);
        }
        .modal-input::placeholder {
          color: #9ca3af;
        }
        @keyframes scanline {
          0%, 100% { transform: translate(-50%, -50%) translateY(-140px); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          50% { transform: translate(-50%, -50%) translateY(140px); }
        }
      `}</style>
    </div>
  )
}

function Field({ label, children }: any) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-gray-700 mb-2 block">{label}</span>
      {children}
    </label>
  )
}

function Section({ title, icon, action, children }: any) {
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/60 p-6 shadow-lg shadow-gray-200/30 hover:shadow-xl transition-all duration-300">
      <div className="flex items-center justify-between mb-5">
        <h4 className="text-base font-bold text-gray-900 flex items-center gap-3">
          {icon}
          {title}
        </h4>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

export default GymManagement