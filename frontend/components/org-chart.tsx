'use client'

/**
 * Organigrama del comercio — el comerciante ve a todo su equipo en un árbol
 * jerárquico. Al tocar una tarjeta se abre el expediente completo del
 * colaborador: cargo, salario, comisión, ventas generadas, vacaciones, nómina,
 * novedades, ajustes y vehículo asignado (ferretería). Sin cambios de backend.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Users, Loader2, RefreshCw, X, Phone, Mail, IdCard, MapPin, DollarSign,
  TrendingUp, Umbrella, FileText, Award, Truck, Network, Briefcase, Search,
  Calendar, ChevronRight, Wallet,
} from 'lucide-react'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(n) || 0)

const ROLE_LABEL: Record<string, string> = {
  comerciante: 'Dueño / Admin', vendedor: 'Vendedor', repartidor: 'Repartidor',
  auxiliar_bodega: 'Aux. Bodega', despachador: 'Despachador', cajero: 'Cajero',
  mesero: 'Mesero', cocinero: 'Cocinero', bartender: 'Bartender', administrador_rb: 'Admin RestBar',
}
const ROLE_COLOR: Record<string, string> = {
  comerciante: 'from-indigo-500 to-violet-600',
  vendedor: 'from-emerald-500 to-teal-600',
  repartidor: 'from-orange-500 to-amber-600',
  despachador: 'from-blue-500 to-cyan-600',
  auxiliar_bodega: 'from-stone-500 to-stone-600',
}
const VEHICLE_ICON: Record<string, string> = { planta: '🚛', ligera: '🚐', moto: '🏍️' }

interface Node {
  id: string; name: string; email: string; role: string; avatar: string | null;
  phone: string | null; cedula: string | null; isActive: number; managerId: string | null; cargoName: string | null;
  children: Node[];
}
type RawUser = Omit<Node, 'children'>

const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

export function OrgChart() {
  const [users, setUsers] = useState<RawUser[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    const res = await api.getOrgChart()
    if (res.success && Array.isArray(res.data)) setUsers(res.data)
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  // Construir el árbol por managerId. Los que no tienen jefe (o jefe inválido) cuelgan de la raíz.
  const { roots, byId } = useMemo(() => {
    const map = new Map<string, Node>()
    users.forEach(u => map.set(u.id, { ...u, children: [] }))
    const roots: Node[] = []
    map.forEach(n => {
      const parent = n.managerId ? map.get(n.managerId) : null
      if (parent && parent.id !== n.id) parent.children.push(n)
      else roots.push(n)
    })
    // Ordenar: comerciante primero
    roots.sort((a, b) => (a.role === 'comerciante' ? -1 : 1) - (b.role === 'comerciante' ? -1 : 1))
    return { roots, byId: map }
  }, [users])

  const matchesSearch = (n: Node) =>
    !search.trim() || [n.name, n.cargoName, ROLE_LABEL[n.role], n.email].some(f => (f || '').toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Network className="h-6 w-6 text-indigo-500" />Jerarquía</h1>
          <p className="text-sm text-muted-foreground">Tu equipo completo entrelazado. Toca una tarjeta para ver todo su expediente: cargo, responsabilidades, sueldo, vacaciones, novedades y asignaciones.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar colaborador…"
              className="pl-8 pr-3 py-2 text-sm border rounded-lg bg-background w-52" />
          </div>
          <Button variant="outline" size="icon" onClick={load}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
      ) : users.length <= 1 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aún no tienes colaboradores. Créalos en <b>Empleados</b> y aquí podrás organizarlos jerárquicamente.</p>
        </CardContent></Card>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="inline-flex flex-col items-center min-w-full gap-0">
            {roots.map(root => (
              <TreeNode key={root.id} node={root} onSelect={setSelectedId} selectedId={selectedId} matches={matchesSearch} depth={0} />
            ))}
          </div>
        </div>
      )}

      {selectedId && (
        <DossierDrawer
          userId={selectedId}
          allUsers={users}
          onClose={() => setSelectedId(null)}
          onManagerChanged={load}
        />
      )}
    </div>
  )
}

// ── Nodo del árbol (recursivo con líneas conectoras) ───────────────────────────
function TreeNode({ node, onSelect, selectedId, matches, depth }: {
  node: Node; onSelect: (id: string) => void; selectedId: string | null; matches: (n: Node) => boolean; depth: number;
}) {
  const dim = !matches(node);
  return (
    <div className="flex flex-col items-center">
      <PersonCard node={node} selected={selectedId === node.id} dim={dim} onClick={() => onSelect(node.id)} />
      {node.children.length > 0 && (
        <>
          {/* Conector vertical desde el padre */}
          <div className="w-px h-5 bg-gray-300" />
          <div className="flex items-start gap-6 relative">
            {/* Línea horizontal que une a los hijos */}
            {node.children.length > 1 && (
              <div className="absolute top-0 left-0 right-0 h-px bg-gray-300"
                style={{ left: 'calc(50% / ' + node.children.length + ')', right: 'calc(50% / ' + node.children.length + ')' }} />
            )}
            {node.children.map(child => (
              <div key={child.id} className="flex flex-col items-center">
                <div className="w-px h-5 bg-gray-300" />
                <TreeNode node={child} onSelect={onSelect} selectedId={selectedId} matches={matches} depth={depth + 1} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function PersonCard({ node, selected, dim, onClick }: { node: Node; selected: boolean; dim: boolean; onClick: () => void }) {
  const grad = ROLE_COLOR[node.role] || 'from-gray-400 to-gray-500';
  return (
    <button
      onClick={onClick}
      className={`relative w-44 rounded-xl border bg-white shadow-sm hover:shadow-md transition-all text-center p-3 ${selected ? 'ring-2 ring-indigo-400' : ''} ${dim ? 'opacity-30' : ''} ${node.isActive ? '' : 'grayscale'}`}
    >
      <div className="flex justify-center -mt-8 mb-1">
        {node.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={node.avatar} alt={node.name} className="w-14 h-14 rounded-full object-cover border-4 border-white shadow" />
        ) : (
          <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${grad} text-white flex items-center justify-center text-lg font-bold border-4 border-white shadow`}>
            {initials(node.name)}
          </div>
        )}
      </div>
      <p className="text-sm font-bold text-gray-800 truncate leading-tight">{node.name}</p>
      <p className="text-[11px] text-indigo-600 font-medium truncate">{node.cargoName || ROLE_LABEL[node.role] || node.role}</p>
      {(node as any).sedeName && <p className="text-[9px] text-gray-400 truncate">📍 {(node as any).sedeName}</p>}
      {!node.isActive && <span className="text-[9px] text-red-400">inactivo</span>}
      {node.children.length > 0 && (
        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full border">
          {node.children.length} a cargo
        </span>
      )}
    </button>
  )
}

// ── Expediente consolidado (drawer lateral) ────────────────────────────────────
function DossierDrawer({ userId, allUsers, onClose, onManagerChanged }: {
  userId: string; allUsers: RawUser[]; onClose: () => void; onManagerChanged: () => void;
}) {
  const [d, setD] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingMgr, setSavingMgr] = useState(false)
  const [sedes, setSedes] = useState<{ id: string; name: string }[]>([])
  const [savingSede, setSavingSede] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.getUserDossier(userId).then(r => { if (r.success) setD(r.data); setLoading(false) })
    api.getSedes().then(r => { if (r.success && Array.isArray(r.data)) setSedes(r.data as any[]) }).catch(() => {})
  }, [userId])

  const changeSede = async (sedeId: string) => {
    setSavingSede(true)
    const res = await api.setUserSede(userId, sedeId || null)
    setSavingSede(false)
    if (res.success) { api.getUserDossier(userId).then(r => { if (r.success) setD(r.data) }) }
    else alert((res as any).error || 'No se pudo asignar la sede')
  }

  const changeManager = async (managerId: string) => {
    setSavingMgr(true)
    const res = await api.setUserManager(userId, managerId || null)
    setSavingMgr(false)
    if (res.success) { onManagerChanged(); api.getUserDossier(userId).then(r => { if (r.success) setD(r.data) }) }
    else alert(res.error || 'No se pudo cambiar la jerarquía')
  }

  const p = d?.person
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-200" onClick={e => e.stopPropagation()}>
        {loading || !d ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* Cabecera */}
            <div className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white p-5 relative">
              <button onClick={onClose} className="absolute top-3 right-3 text-white/80 hover:text-white"><X size={18} /></button>
              <div className="flex items-center gap-3">
                {p.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatar} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-white/50" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold">{initials(p.name)}</div>
                )}
                <div className="min-w-0">
                  <h2 className="text-lg font-bold truncate">{p.name}</h2>
                  <p className="text-sm text-white/80">{p.cargoName || ROLE_LABEL[p.role] || p.role}</p>
                  {p.managerName && <p className="text-xs text-white/60">Reporta a {p.managerName}</p>}
                </div>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Contacto */}
              <div className="grid grid-cols-1 gap-1.5 text-sm">
                {p.email && <Row icon={<Mail size={14} />} label={p.email} />}
                {p.phone && <Row icon={<Phone size={14} />} label={p.phone} />}
                {p.cedula && <Row icon={<IdCard size={14} />} label={`CC ${p.cedula}`} />}
                {(p.address || p.municipality) && <Row icon={<MapPin size={14} />} label={[p.address, p.municipality].filter(Boolean).join(', ')} />}
              </div>

              {/* Reporta a (editar jerarquía) */}
              <SectionCard icon={<Network size={15} />} title="Posición en el organigrama">
                <label className="text-xs text-muted-foreground">Reporta a</label>
                <select
                  value={p.managerId || ''} disabled={savingMgr}
                  onChange={e => changeManager(e.target.value)}
                  className="w-full mt-1 text-sm border rounded-lg px-2 py-1.5 bg-white"
                >
                  <option value="">— Nadie (raíz) —</option>
                  {allUsers.filter(u => u.id !== userId).map(u => (
                    <option key={u.id} value={u.id}>{u.name} · {u.cargoName || ROLE_LABEL[u.role] || u.role}</option>
                  ))}
                </select>
                {sedes.length > 0 && (
                  <>
                    <label className="text-xs text-muted-foreground mt-2 block">Sede / bodega asignada</label>
                    <select
                      value={p.sedeId || ''} disabled={savingSede}
                      onChange={e => changeSede(e.target.value)}
                      className="w-full mt-1 text-sm border rounded-lg px-2 py-1.5 bg-white"
                    >
                      <option value="">— Sin sede —</option>
                      {sedes.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </>
                )}
              </SectionCard>

              {/* Picking: productividad de bodega (si tiene actividad) */}
              {d.picking?.completedTasks > 0 && (
                <SectionCard icon={<Briefcase size={15} />} title="Productividad en bodega (picking)">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold text-gray-800">{d.picking.completedTasks}</p>
                      <p className="text-[10px] text-muted-foreground">pedidos preparados</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-800">{d.picking.thisMonth}</p>
                      <p className="text-[10px] text-muted-foreground">este mes</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-800">{d.picking.avgMinutes ?? '—'}</p>
                      <p className="text-[10px] text-muted-foreground">min promedio</p>
                    </div>
                  </div>
                </SectionCard>
              )}

              {/* Responsabilidades del cargo */}
              {(d.responsibilities?.description || (d.responsibilities?.permissions?.length > 0)) && (
                <SectionCard icon={<Briefcase size={15} />} title="Responsabilidades y permisos">
                  {d.responsibilities.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed mb-2">{d.responsibilities.description}</p>
                  )}
                  {d.responsibilities.permissions?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {d.responsibilities.permissions.slice(0, 20).map((perm: string, i: number) => (
                        <span key={i} className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.5 rounded-full capitalize">
                          {String(perm).replace(/[._]/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </SectionCard>
              )}

              {/* Compensación */}
              <SectionCard icon={<Wallet size={15} />} title="Sueldo y comisión">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Stat label="Salario base" value={fmt(d.compensation.salaryBase)} />
                  <Stat label="Meta mensual" value={fmt(d.compensation.monthlyGoal)} />
                  <Stat label="Comisión" value={d.compensation.commissionType === 'sin_comision' ? '—' : `${d.compensation.commissionType === 'porcentaje' ? d.compensation.commissionValue + '%' : fmt(d.compensation.commissionValue)}`} />
                  <Stat label="Bono meta" value={fmt(d.compensation.goalBonus)} />
                </div>
              </SectionCard>

              {/* Ventas generadas */}
              <SectionCard icon={<TrendingUp size={15} />} title="Ventas generadas">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Stat label="Este mes" value={fmt(d.generated.thisMonth.amount)} sub={`${d.generated.thisMonth.count} ventas`} />
                  <Stat label="Histórico" value={fmt(d.generated.allTime.amount)} sub={`${d.generated.allTime.count} ventas`} />
                </div>
              </SectionCard>

              {/* Vacaciones */}
              <SectionCard icon={<Umbrella size={15} />} title={`Vacaciones ${d.vacation.year}`}>
                <div className="flex items-center justify-between text-sm">
                  <Stat label="Disponibles" value={`${d.vacation.daysLeft} días`} />
                  <span className="text-xs text-muted-foreground">{d.vacation.daysUsed} usados de {d.vacation.daysGranted}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-sky-500" style={{ width: `${d.vacation.daysGranted > 0 ? (d.vacation.daysUsed / d.vacation.daysGranted) * 100 : 0}%` }} />
                </div>
              </SectionCard>

              {/* Vehículo asignado (ferretería) */}
              {d.vehicles.length > 0 && (
                <SectionCard icon={<Truck size={15} />} title="Vehículo asignado ahora">
                  {d.vehicles.map((v: any) => (
                    <div key={v.id} className="flex items-center justify-between text-sm rounded-lg border p-2 mb-1.5 last:mb-0">
                      <span className="font-medium">{VEHICLE_ICON[v.type] || '🚗'} {v.name}{v.plate ? ` (${v.plate})` : ''}</span>
                      <Badge variant="outline" className="text-[10px]">{v.routeNumber ? `Ruta ${v.routeNumber}` : v.routeStatus}</Badge>
                    </div>
                  ))}
                </SectionCard>
              )}

              {/* Nómina */}
              <SectionCard icon={<FileText size={15} />} title={`Nómina (${d.payroll.length})`}>
                {d.payroll.length === 0 ? <p className="text-xs text-muted-foreground">Sin registros de nómina</p> : (
                  <div className="space-y-1">
                    {d.payroll.slice(0, 6).map((r: any) => (
                      <div key={r.id} className="flex items-center justify-between text-xs border-b last:border-0 py-1">
                        <span className="text-muted-foreground">{r.periodLabel}</span>
                        <span className="flex items-center gap-1.5">
                          <b>{fmt(r.totalPagar)}</b>
                          <Badge variant={r.status === 'pagado' ? 'default' : 'secondary'} className="text-[9px]">{r.status}</Badge>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              {/* Ajustes (bonos / descuentos) */}
              {d.adjustments.length > 0 && (
                <SectionCard icon={<Award size={15} />} title="Bonos y descuentos">
                  <div className="space-y-1">
                    {d.adjustments.slice(0, 6).map((a: any) => (
                      <div key={a.id} className="flex items-center justify-between text-xs py-0.5">
                        <span className="text-muted-foreground truncate">{a.concept}</span>
                        <span className={a.type === 'bono' ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
                          {a.type === 'bono' ? '+' : '−'}{fmt(a.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

              {/* Novedades */}
              {d.novelties.length > 0 && (
                <SectionCard icon={<Calendar size={15} />} title="Novedades recientes">
                  <div className="space-y-1">
                    {d.novelties.slice(0, 6).map((n: any) => (
                      <div key={n.id} className="flex items-center justify-between text-xs py-0.5">
                        <span className="text-muted-foreground capitalize">{String(n.type).replace(/_/g, ' ')} · {n.daysCount}d</span>
                        <Badge variant={n.status === 'aprobado' ? 'default' : n.status === 'rechazado' ? 'secondary' : 'outline'} className="text-[9px]">{n.status}</Badge>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Row({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <div className="flex items-center gap-2 text-muted-foreground"><span className="text-gray-400 shrink-0">{icon}</span><span className="truncate">{label}</span></div>
}
function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5 mb-2">{icon}{title}</p>
      {children}
    </div>
  )
}
function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="font-semibold text-gray-800">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  )
}
