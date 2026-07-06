"use client";

/**
 * Centro de Comando de Despacho — una sola pantalla, sin pestañas.
 * KPIs en vivo · Kanban con drag&drop (mover tarjeta = cambiar estado) ·
 * panel de detalle persistente a la derecha · tira de vehículos con barra de
 * capacidad · sugerencias de ruta con creación inline · acciones rápidas.
 *
 * Reutiliza el backend existente (fleet/*): cero cambios de lógica de servidor.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api } from '@/lib/api';
import {
  Truck, Package, MapPin, Phone, Weight, RefreshCw, Loader2, Clock, User,
  Navigation, MessageCircle, Search, X, ChevronDown, Zap, Route as RouteIcon,
  CheckCircle2, AlertTriangle, DollarSign, Users, Gauge, PackageCheck,
} from 'lucide-react';

const fmtCOP = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(v) || 0);
const kg = (v: number | null | undefined) => `${(Number(v) || 0).toFixed(1)} kg`;

// ── Estados: color + etiqueta + columna del kanban ─────────────────────────────
const STATUS = {
  pendiente:  { label: 'Pendiente',  dot: 'bg-orange-500', chip: 'bg-orange-50 text-orange-700 border-orange-200', bar: 'bg-orange-500' },
  en_pista:   { label: 'En pista',   dot: 'bg-blue-500',   chip: 'bg-blue-50 text-blue-700 border-blue-200',       bar: 'bg-blue-500' },
  cargado:    { label: 'Cargado',    dot: 'bg-violet-500', chip: 'bg-violet-50 text-violet-700 border-violet-200', bar: 'bg-violet-500' },
  despachado: { label: 'En ruta',    dot: 'bg-emerald-500',chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500' },
  entregado:  { label: 'Entregado',  dot: 'bg-gray-400',   chip: 'bg-gray-100 text-gray-500 border-gray-200',      bar: 'bg-gray-400' },
} as const;

type StatusKey = keyof typeof STATUS;

// Columnas del kanban → estado canónico al soltar una tarjeta
const COLUMNS: { key: string; label: string; statuses: StatusKey[]; drop: StatusKey; accent: string }[] = [
  { key: 'pendientes',  label: '🟠 Pendientes',    statuses: ['pendiente'],           drop: 'pendiente',  accent: 'border-t-orange-400' },
  { key: 'preparacion', label: '🔵 En preparación', statuses: ['en_pista', 'cargado'], drop: 'en_pista',   accent: 'border-t-blue-400' },
  { key: 'ruta',        label: '🟢 En ruta',        statuses: ['despachado'],          drop: 'despachado', accent: 'border-t-emerald-400' },
  { key: 'entregados',  label: '⚪ Entregados',      statuses: ['entregado'],           drop: 'entregado',  accent: 'border-t-gray-300' },
];

const NEXT: Record<string, StatusKey> = { pendiente: 'en_pista', en_pista: 'cargado', cargado: 'despachado', despachado: 'entregado' };
const NEXT_LABEL: Record<string, string> = {
  pendiente: 'Poner en pista', en_pista: 'Marcar cargado', cargado: 'Despachar (salida)', despachado: 'Marcar entregado',
};
const ORDER_RANK: Record<string, number> = { pendiente: 0, en_pista: 1, cargado: 2, despachado: 3, entregado: 4 };
const VEHICLE_ICON: Record<string, string> = { planta: '🚛', ligera: '🚐', moto: '🏍️' };

interface DispatchOrder {
  id: string; orderNumber: string; customerName: string; customerPhone: string;
  address: string; municipality: string; neighborhood: string;
  total: number; totalWeightKg: number | null; dispatchStatus: string;
  dispatchNotes: string | null; dispatchedAt: string | null;
  status: string; createdAt: string; paymentMethod: string;
  deliveryLatitude: number | null; deliveryLongitude: number | null;
  vehicleId: string | null; vehicleName: string | null; vehiclePlate: string | null;
  vehicleType: string | null; driverId: string | null; driverName: string | null;
  routeId?: string | null;
  items: Array<{ productName: string; quantity: number; unitPrice: number; totalPrice: number }>;
}
interface Vehicle { id: string; name: string; plate: string | null; type: string; maxWeightKg: number; status: string; }

const minutesSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
const agoLabel = (iso: string) => {
  const m = minutesSince(iso);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.floor(h / 24)} d`;
};
const isToday = (iso: string | null) => {
  if (!iso) return false;
  const d = new Date(iso); const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};

// ── Urgencia por tiempo de espera (pedidos sin despachar) ──────────────────────
const urgency = (o: DispatchOrder): { label: string; cls: string; ring: string } | null => {
  if (o.dispatchStatus === 'despachado' || o.dispatchStatus === 'entregado') return null;
  const m = minutesSince(o.createdAt);
  if (m > 60) return { label: 'Alta', cls: 'text-red-600 bg-red-50', ring: 'ring-2 ring-red-300' };
  if (m > 30) return { label: 'Media', cls: 'text-amber-600 bg-amber-50', ring: 'ring-1 ring-amber-200' };
  return { label: 'Normal', cls: 'text-emerald-600 bg-emerald-50', ring: '' };
};

export function DispatchCommandCenter() {
  const [orders, setOrders] = useState<DispatchOrder[]>([]);       // activos (4 estados)
  const [delivered, setDelivered] = useState<DispatchOrder[]>([]); // entregados hoy
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [creatingRoute, setCreatingRoute] = useState<any | null>(null);
  const dragId = useRef<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [act, del, veh, sug] = await Promise.all([
        api.getPendingDispatch(),
        api.getPendingDispatch('entregado'),
        api.getFleetVehicles(),
        api.getRouteSuggestions().catch(() => ({ success: false, data: [] })),
      ]);
      if (act.success) setOrders(act.data ?? []);
      // entregados: solo los de HOY, tope 60 (sin cambiar backend)
      if (del.success) setDelivered((del.data ?? []).filter((o: DispatchOrder) => isToday(o.dispatchedAt || o.createdAt)).slice(0, 60));
      if (veh.success) setVehicles(veh.data ?? []);
      if ((sug as any).success) setSuggestions(((sug as any).data ?? []).filter((s: any) => s.orderCount >= 2));
    } finally {
      setLoading(false);
    }
    // Conductores (endpoint existente)
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/delivery/drivers`, { credentials: 'include' })
      .then(r => r.json()).then(j => { if (j.success) setDrivers(j.data || []); }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 25000); // tablero vivo
    return () => clearInterval(t);
  }, [fetchData]);

  const allActiveAndDelivered = useMemo(() => [...orders, ...delivered], [orders, delivered]);
  const selected = allActiveAndDelivered.find(o => o.id === selectedId) || null;

  // Carga asignada por vehículo (para la barra de capacidad)
  const vehicleLoad = useMemo(() => {
    const map = new Map<string, { weight: number; count: number }>();
    for (const o of orders) {
      if (!o.vehicleId || o.dispatchStatus === 'entregado') continue;
      const cur = map.get(o.vehicleId) || { weight: 0, count: 0 };
      cur.weight += Number(o.totalWeightKg) || 0;
      cur.count += 1;
      map.set(o.vehicleId, cur);
    }
    return map;
  }, [orders]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const pend = orders.filter(o => o.dispatchStatus === 'pendiente').length;
    const prep = orders.filter(o => o.dispatchStatus === 'en_pista' || o.dispatchStatus === 'cargado').length;
    const ruta = orders.filter(o => o.dispatchStatus === 'despachado').length;
    const retrasados = orders.filter(o => (o.dispatchStatus === 'pendiente' || o.dispatchStatus === 'en_pista') && minutesSince(o.createdAt) > 60).length;
    const dispWithTime = [...orders, ...delivered].filter(o => o.dispatchedAt);
    const avg = dispWithTime.length
      ? Math.round(dispWithTime.reduce((s, o) => s + Math.max(0, (new Date(o.dispatchedAt!).getTime() - new Date(o.createdAt).getTime()) / 60000), 0) / dispWithTime.length)
      : null;
    const dispon = vehicles.filter(v => v.status === 'disponible').length;
    const totalCap = vehicles.reduce((s, v) => s + (Number(v.maxWeightKg) || 0), 0);
    const usedCap = [...vehicleLoad.values()].reduce((s, x) => s + x.weight, 0);
    const capPct = totalCap > 0 ? Math.round((usedCap / totalCap) * 100) : 0;
    return { pend, prep, ruta, retrasados, avg, dispon, totalVeh: vehicles.length, drivers: drivers.length, capPct, entregadosHoy: delivered.length };
  }, [orders, delivered, vehicles, vehicleLoad, drivers]);

  // ── Filtro de búsqueda ──
  const matches = useCallback((o: DispatchOrder) => {
    if (vehicleFilter && o.vehicleId !== vehicleFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [o.orderNumber, o.customerName, o.customerPhone, o.address, o.neighborhood, o.municipality]
      .some(f => (f || '').toLowerCase().includes(q));
  }, [search, vehicleFilter]);

  const columnOrders = (col: typeof COLUMNS[number]) => {
    const src = col.key === 'entregados' ? delivered : orders;
    return src.filter(o => col.statuses.includes(o.dispatchStatus as StatusKey) && matches(o));
  };

  // ── Acciones ──
  const changeStatus = async (order: DispatchOrder, to: StatusKey) => {
    if (to === order.dispatchStatus) return;
    if (ORDER_RANK[to] < ORDER_RANK[order.dispatchStatus] &&
        !confirm(`¿Devolver el pedido #${order.orderNumber} a "${STATUS[to].label}"?`)) return;
    setBusy(order.id);
    try {
      const res = await api.updateDispatchStatus(order.id, to);
      if (res.success) await fetchData(); else alert(res.error || 'Error al cambiar estado');
    } finally { setBusy(null); }
  };

  const assign = async (order: DispatchOrder, vehicleId: string, driverId?: string) => {
    setBusy(order.id);
    try {
      const res = await api.assignVehicle(order.id, vehicleId || undefined, driverId || undefined);
      if (res.success) await fetchData(); else alert(res.error || 'Error al asignar');
    } finally { setBusy(null); }
  };

  const openMaps = (o: DispatchOrder) => {
    if (o.deliveryLatitude && o.deliveryLongitude)
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${o.deliveryLatitude},${o.deliveryLongitude}`, '_blank');
    else if (o.address)
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.address)}`, '_blank');
  };
  const waLink = (phone: string, orderNumber: string) => {
    const p = String(phone || '').replace(/\D/g, '');
    if (p.length >= 7) window.open(`https://wa.me/${p.startsWith('57') ? p : '57' + p}?text=${encodeURIComponent(`Hola! Sobre tu pedido #${orderNumber}`)}`, '_blank');
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50">
      {/* ═══ KPIs ═══ */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2 p-3">
        <Kpi icon={<Package size={15} />} label="Pendientes" value={kpis.pend} tone="orange" />
        <Kpi icon={<PackageCheck size={15} />} label="En preparación" value={kpis.prep} tone="blue" />
        <Kpi icon={<Truck size={15} />} label="En ruta" value={kpis.ruta} tone="emerald" />
        <Kpi icon={<CheckCircle2 size={15} />} label="Entregados hoy" value={kpis.entregadosHoy} tone="gray" />
        <Kpi icon={<Clock size={15} />} label="Tiempo prom." value={kpis.avg != null ? `${kpis.avg}m` : '—'} tone={kpis.retrasados > 0 ? 'red' : 'gray'} sub={kpis.retrasados > 0 ? `${kpis.retrasados} retrasados` : undefined} />
        <Kpi icon={<Users size={15} />} label="Vehíc./Cond." value={`${kpis.dispon}/${kpis.totalVeh}·${kpis.drivers}`} tone="violet" />
        <Kpi icon={<Gauge size={15} />} label="Capacidad" value={`${kpis.capPct}%`} tone={kpis.capPct > 85 ? 'red' : 'emerald'} bar={kpis.capPct} />
      </div>

      {/* ═══ Búsqueda + filtros ═══ */}
      <div className="px-3 pb-2 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar pedido, cliente, teléfono, dirección…"
            className="w-full pl-8 pr-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:border-gray-400"
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
        </div>
        <select value={vehicleFilter} onChange={e => setVehicleFilter(e.target.value)} className="text-sm border rounded-lg bg-white px-2 py-2">
          <option value="">Todos los vehículos</option>
          {vehicles.map(v => <option key={v.id} value={v.id}>{VEHICLE_ICON[v.type] || '🚗'} {v.name}</option>)}
        </select>
        <button onClick={fetchData} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 border bg-white" title="Actualizar">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ═══ Sugerencias de agrupación ═══ */}
      {suggestions.length > 0 && (
        <div className="px-3 pb-2 flex gap-2 overflow-x-auto">
          {suggestions.slice(0, 4).map((s, i) => (
            <div key={i} className="flex items-center gap-2 shrink-0 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5">
              <Zap className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="text-xs text-emerald-800">
                <b>{s.orderCount}</b> pedidos en <b>{s.zone}</b> · {kg(s.totalWeightKg)}
                {s.joinRoute ? ` → cabe en ${s.joinRoute.routeNumber}` : s.suggestedVehicle ? ` · ${s.suggestedVehicle.name}` : ''}
              </span>
              <button
                disabled={!s.suggestedVehicle && !s.joinRoute}
                onClick={() => setCreatingRoute(s)}
                className="text-xs font-semibold bg-emerald-600 text-white px-2.5 py-1 rounded-lg hover:bg-emerald-700 disabled:opacity-40"
              >
                <RouteIcon className="inline h-3 w-3 mr-1" />Crear ruta
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ═══ Kanban + panel de detalle ═══ */}
      <div className="flex-1 min-h-0 flex gap-3 px-3 pb-3 overflow-hidden">
        {/* Kanban */}
        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 overflow-y-auto">
          {COLUMNS.map(col => {
            const items = columnOrders(col);
            return (
              <div
                key={col.key}
                onDragOver={e => { e.preventDefault(); setDragOverCol(col.key); }}
                onDragLeave={() => setDragOverCol(c => c === col.key ? null : c)}
                onDrop={() => {
                  setDragOverCol(null);
                  const id = dragId.current; dragId.current = null;
                  if (!id) return;
                  const o = orders.find(x => x.id === id);
                  if (o && !o.routeId) changeStatus(o, col.drop);
                }}
                className={`flex flex-col rounded-xl border-t-4 ${col.accent} bg-white border min-h-[120px] ${dragOverCol === col.key ? 'ring-2 ring-blue-300' : ''}`}
              >
                <div className="flex items-center justify-between px-3 py-2 border-b sticky top-0 bg-white rounded-t-xl">
                  <span className="text-xs font-semibold text-gray-700">{col.label}</span>
                  <span className="text-xs font-bold text-gray-400">{items.length}</span>
                </div>
                <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-320px)]">
                  {items.length === 0 && <p className="text-[11px] text-gray-300 text-center py-4">—</p>}
                  {items.map(o => (
                    <OrderCard
                      key={o.id} order={o} selected={selectedId === o.id} busy={busy === o.id}
                      onSelect={() => setSelectedId(o.id)}
                      onDragStart={() => { dragId.current = o.id; }}
                      onCall={() => o.customerPhone && window.open(`tel:${o.customerPhone}`)}
                      onMaps={() => openMaps(o)}
                      onWa={() => waLink(o.customerPhone, o.orderNumber)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Panel de detalle persistente (desktop) */}
        <div className="hidden lg:flex w-80 shrink-0">
          <DetailPanel
            order={selected} vehicles={vehicles} drivers={drivers} busy={busy === selected?.id}
            onClose={() => setSelectedId(null)}
            onAssign={(vid, did) => selected && assign(selected, vid, did)}
            onNext={() => selected && NEXT[selected.dispatchStatus] && changeStatus(selected, NEXT[selected.dispatchStatus])}
            onCancel={async () => {
              if (selected && confirm(`¿Cancelar el despacho del pedido #${selected.orderNumber}?`)) {
                setBusy(selected.id);
                try { await api.updateDispatchStatus(selected.id, 'pendiente'); await fetchData(); } finally { setBusy(null); }
              }
            }}
            onMaps={() => selected && openMaps(selected)}
            onCall={() => selected?.customerPhone && window.open(`tel:${selected.customerPhone}`)}
            onWa={() => selected && waLink(selected.customerPhone, selected.orderNumber)}
          />
        </div>
      </div>

      {/* ═══ Tira de vehículos (capacidad) ═══ */}
      <div className="border-t bg-white px-3 py-2 flex gap-2 overflow-x-auto">
        {vehicles.length === 0 && <p className="text-xs text-gray-400 py-2">Sin vehículos registrados</p>}
        {vehicles.map(v => {
          const load = vehicleLoad.get(v.id) || { weight: 0, count: 0 };
          const pct = Number(v.maxWeightKg) > 0 ? Math.min(100, Math.round((load.weight / Number(v.maxWeightKg)) * 100)) : 0;
          return (
            <div key={v.id} className="shrink-0 w-48 rounded-xl border p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800 truncate">{VEHICLE_ICON[v.type] || '🚗'} {v.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${v.status === 'disponible' ? 'bg-green-50 text-green-700 border-green-200' : v.status === 'en_ruta' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                  {v.status === 'disponible' ? 'Libre' : v.status === 'en_ruta' ? 'En ruta' : v.status}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">{load.weight.toFixed(0)} / {Number(v.maxWeightKg).toFixed(0)} kg · {load.count} pedidos</p>
              <div className="mt-1.5 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className={`h-full ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
              </div>
              <p className={`text-[10px] mt-0.5 font-medium ${pct > 90 ? 'text-red-600' : 'text-gray-400'}`}>{pct}% ocupado</p>
            </div>
          );
        })}
      </div>

      {/* Panel de detalle móvil (bottom sheet) */}
      {selected && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 max-h-[70vh] overflow-y-auto bg-white border-t rounded-t-2xl shadow-2xl">
          <DetailPanel
            order={selected} vehicles={vehicles} drivers={drivers} busy={busy === selected.id} mobile
            onClose={() => setSelectedId(null)}
            onAssign={(vid, did) => assign(selected, vid, did)}
            onNext={() => NEXT[selected.dispatchStatus] && changeStatus(selected, NEXT[selected.dispatchStatus])}
            onCancel={async () => { if (confirm(`¿Cancelar el despacho de #${selected.orderNumber}?`)) { setBusy(selected.id); try { await api.updateDispatchStatus(selected.id, 'pendiente'); await fetchData(); } finally { setBusy(null); } } }}
            onMaps={() => openMaps(selected)} onCall={() => selected.customerPhone && window.open(`tel:${selected.customerPhone}`)} onWa={() => waLink(selected.customerPhone, selected.orderNumber)}
          />
        </div>
      )}

      {creatingRoute && (
        <CreateRouteInline suggestion={creatingRoute} vehicles={vehicles} drivers={drivers}
          onClose={() => setCreatingRoute(null)} onCreated={() => { setCreatingRoute(null); fetchData(); }} />
      )}
    </div>
  );
}

// ── Tarjeta de KPI ─────────────────────────────────────────────────────────────
function Kpi({ icon, label, value, tone, sub, bar }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone: string; sub?: string; bar?: number }) {
  const tones: Record<string, string> = {
    orange: 'text-orange-600', blue: 'text-blue-600', emerald: 'text-emerald-600',
    gray: 'text-gray-600', red: 'text-red-600', violet: 'text-violet-600',
  };
  return (
    <div className="rounded-xl bg-white border px-3 py-2">
      <div className={`flex items-center gap-1.5 ${tones[tone] || 'text-gray-600'}`}>{icon}<span className="text-[10px] uppercase tracking-wide text-gray-400 font-medium truncate">{label}</span></div>
      <p className="text-xl font-bold text-gray-900 leading-tight mt-0.5">{value}</p>
      {sub && <p className="text-[10px] text-red-500 font-medium">{sub}</p>}
      {bar != null && <div className="mt-1 h-1 rounded-full bg-gray-100 overflow-hidden"><div className={`h-full ${bar > 85 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${bar}%` }} /></div>}
    </div>
  );
}

// ── Tarjeta de pedido (kanban) ─────────────────────────────────────────────────
function OrderCard({ order: o, selected, busy, onSelect, onDragStart, onCall, onMaps, onWa }: {
  order: DispatchOrder; selected: boolean; busy: boolean;
  onSelect: () => void; onDragStart: () => void; onCall: () => void; onMaps: () => void; onWa: () => void;
}) {
  const u = urgency(o);
  const inRoute = !!o.routeId;
  return (
    <div
      draggable={!inRoute}
      onDragStart={onDragStart}
      onClick={onSelect}
      className={`rounded-lg border bg-white p-2.5 cursor-pointer transition-shadow hover:shadow-md ${selected ? 'ring-2 ring-blue-400' : u?.ring || ''} ${inRoute ? 'cursor-default' : 'active:cursor-grabbing'}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-bold text-gray-800">#{o.orderNumber}</span>
        <div className="flex items-center gap-1">
          {inRoute && <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full">🛣️ ruta</span>}
          {u && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${u.cls}`}>{u.label}</span>}
          {busy && <Loader2 size={12} className="animate-spin text-gray-400" />}
        </div>
      </div>
      <p className="text-xs text-gray-700 font-medium truncate mt-1 flex items-center gap-1"><User size={11} className="text-gray-400 shrink-0" />{o.customerName}</p>
      <p className="text-[11px] text-gray-500 truncate flex items-center gap-1"><MapPin size={10} className="text-gray-400 shrink-0" />{o.neighborhood || o.municipality || 'Sin zona'}</p>
      <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500">
        <span className="flex items-center gap-0.5"><Weight size={10} />{kg(o.totalWeightKg)}</span>
        <span className="flex items-center gap-0.5"><DollarSign size={10} />{fmtCOP(o.total)}</span>
        <span className="flex items-center gap-0.5 ml-auto"><Clock size={10} />{agoLabel(o.createdAt)}</span>
      </div>
      {o.vehicleName && <p className="text-[10px] text-blue-600 mt-1 flex items-center gap-1"><Truck size={10} />{o.vehicleName}{o.driverName ? ` · ${o.driverName}` : ''}</p>}
      {/* Acciones rápidas */}
      <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t" onClick={e => e.stopPropagation()}>
        <QuickBtn onClick={onCall} title="Llamar"><Phone size={12} /></QuickBtn>
        <QuickBtn onClick={onMaps} title="Mapa"><Navigation size={12} /></QuickBtn>
        <QuickBtn onClick={onWa} title="WhatsApp"><MessageCircle size={12} /></QuickBtn>
        <span className="ml-auto text-[10px] text-gray-400">{o.items?.length || 0} prod.</span>
      </div>
    </div>
  );
}
function QuickBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return <button onClick={onClick} title={title} className="p-1 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700">{children}</button>;
}

// ── Panel de detalle persistente ──────────────────────────────────────────────
function DetailPanel({ order: o, vehicles, drivers, busy, mobile, onClose, onAssign, onNext, onCancel, onMaps, onCall, onWa }: {
  order: DispatchOrder | null; vehicles: Vehicle[]; drivers: any[]; busy: boolean; mobile?: boolean;
  onClose: () => void; onAssign: (v: string, d?: string) => void; onNext: () => void; onCancel: () => void;
  onMaps: () => void; onCall: () => void; onWa: () => void;
}) {
  const [vSel, setVSel] = useState('');
  const [dSel, setDSel] = useState('');
  const [open, setOpen] = useState<{ prod: boolean; veh: boolean; nota: boolean }>({ prod: true, veh: true, nota: false });
  useEffect(() => { setVSel(o?.vehicleId || ''); setDSel(o?.driverId || ''); }, [o?.id]);

  if (!o) {
    return (
      <div className="w-full rounded-xl border bg-white flex flex-col items-center justify-center text-center p-6 text-gray-400">
        <PackageCheck size={32} className="mb-2 opacity-30" />
        <p className="text-sm">Selecciona un pedido para ver el detalle,<br />asignar vehículo y avanzar su estado.</p>
      </div>
    );
  }
  const st = STATUS[o.dispatchStatus as StatusKey];
  const inRoute = !!o.routeId;

  return (
    <div className={`w-full rounded-xl border bg-white flex flex-col overflow-hidden ${mobile ? '' : ''}`}>
      <div className="flex items-center justify-between px-3 py-2.5 border-b">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full ${st?.dot}`} />
          <span className="text-sm font-bold text-gray-800">#{o.orderNumber}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${st?.chip}`}>{st?.label}</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
        {/* Cliente */}
        <div>
          <p className="font-semibold text-gray-800 flex items-center gap-1.5"><User size={14} className="text-gray-400" />{o.customerName}</p>
          <p className="text-xs text-gray-500 flex items-start gap-1.5 mt-1"><MapPin size={13} className="text-gray-400 shrink-0 mt-0.5" />{o.address || '—'}{o.neighborhood ? `, ${o.neighborhood}` : ''}{o.municipality ? ` (${o.municipality})` : ''}</p>
          <div className="flex gap-1.5 mt-2">
            <ActionChip onClick={onCall} icon={<Phone size={13} />} label="Llamar" />
            <ActionChip onClick={onMaps} icon={<Navigation size={13} />} label="Ruta" />
            <ActionChip onClick={onWa} icon={<MessageCircle size={13} />} label="WhatsApp" />
          </div>
        </div>

        {/* Peso + total */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-gray-50 p-2"><p className="text-[10px] text-gray-400 uppercase">Peso</p><p className="font-semibold text-gray-800">{kg(o.totalWeightKg)}</p></div>
          <div className="rounded-lg bg-gray-50 p-2"><p className="text-[10px] text-gray-400 uppercase">Total</p><p className="font-semibold text-gray-800">{fmtCOP(o.total)}</p></div>
        </div>

        {/* Productos (colapsable) */}
        <Section title={`Productos (${o.items?.length || 0})`} isOpen={open.prod} onToggle={() => setOpen(s => ({ ...s, prod: !s.prod }))}>
          <div className="space-y-1">
            {(o.items || []).map((it, i) => (
              <div key={i} className="flex justify-between text-xs text-gray-600">
                <span className="truncate">{it.quantity}× {it.productName}</span>
                <span className="text-gray-400 shrink-0 ml-2">{fmtCOP(it.totalPrice)}</span>
              </div>
            ))}
            {(!o.items || o.items.length === 0) && <p className="text-xs text-gray-400">Sin ítems</p>}
          </div>
        </Section>

        {/* Vehículo + conductor (colapsable) */}
        <Section title="Vehículo y conductor" isOpen={open.veh} onToggle={() => setOpen(s => ({ ...s, veh: !s.veh }))}>
          {inRoute ? (
            <p className="text-xs text-indigo-600 bg-indigo-50 rounded-lg p-2">🛣️ Este pedido está en una ruta. Gestiona el vehículo desde el Centro de rutas.</p>
          ) : (
            <div className="space-y-2">
              <select value={vSel} onChange={e => setVSel(e.target.value)} className="w-full text-sm border rounded-lg px-2 py-1.5 bg-white">
                <option value="">Sin vehículo</option>
                {vehicles.map(v => <option key={v.id} value={v.id} disabled={v.status === 'mantenimiento' || v.status === 'inactivo'}>{VEHICLE_ICON[v.type] || '🚗'} {v.name} — {v.maxWeightKg}kg{v.status !== 'disponible' && v.status !== 'en_ruta' ? ` [${v.status}]` : ''}</option>)}
              </select>
              <select value={dSel} onChange={e => setDSel(e.target.value)} className="w-full text-sm border rounded-lg px-2 py-1.5 bg-white">
                <option value="">Sin conductor</option>
                {drivers.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {(vSel !== (o.vehicleId || '') || dSel !== (o.driverId || '')) && (
                <button onClick={() => onAssign(vSel, dSel)} disabled={busy} className="w-full text-xs font-semibold bg-blue-600 text-white py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {busy ? <Loader2 size={13} className="animate-spin inline" /> : 'Asignar'}
                </button>
              )}
            </div>
          )}
        </Section>

        {/* Nota (colapsable) */}
        {o.dispatchNotes && (
          <Section title="Nota de despacho" isOpen={open.nota} onToggle={() => setOpen(s => ({ ...s, nota: !s.nota }))}>
            <p className="text-xs text-gray-600 italic bg-yellow-50 border border-yellow-200 rounded p-2">📝 {o.dispatchNotes}</p>
          </Section>
        )}
      </div>

      {/* Acciones principales */}
      <div className="border-t p-3 space-y-2">
        {NEXT[o.dispatchStatus] && !inRoute && (
          <button onClick={onNext} disabled={busy} className={`w-full py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50 ${o.dispatchStatus === 'cargado' ? 'bg-orange-500 hover:bg-orange-600' : o.dispatchStatus === 'despachado' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <>{o.dispatchStatus === 'cargado' ? <Truck size={15} /> : <ChevronDown size={15} className="-rotate-90" />}{NEXT_LABEL[o.dispatchStatus]}</>}
          </button>
        )}
        {o.dispatchStatus !== 'entregado' && o.dispatchStatus !== 'pendiente' && !inRoute && (
          <button onClick={onCancel} disabled={busy} className="w-full py-2 rounded-xl text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50">Devolver a pendiente</button>
        )}
        {o.dispatchStatus === 'entregado' && (
          <div className="flex items-center gap-2 text-emerald-600 text-sm justify-center py-1"><CheckCircle2 size={16} /> Pedido entregado</div>
        )}
      </div>
    </div>
  );
}

function Section({ title, isOpen, onToggle, children }: { title: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border-t pt-2">
      <button onClick={onToggle} className="w-full flex items-center justify-between text-xs font-semibold text-gray-700">
        {title}<ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && <div className="mt-2">{children}</div>}
    </div>
  );
}
function ActionChip({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button onClick={onClick} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border text-gray-600 hover:bg-gray-50">{icon}{label}</button>;
}

// ── Crear ruta inline desde una sugerencia ─────────────────────────────────────
function CreateRouteInline({ suggestion, vehicles, drivers, onClose, onCreated }: {
  suggestion: any; vehicles: Vehicle[]; drivers: any[]; onClose: () => void; onCreated: () => void;
}) {
  const [vehicleId, setVehicleId] = useState(suggestion.suggestedVehicle?.id || '');
  const [driverId, setDriverId] = useState('');
  const [aux, setAux] = useState(suggestion.suggestedAuxiliaries || 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const available = vehicles.filter(v => v.status === 'disponible');

  const create = async () => {
    if (!vehicleId) { setError('Elige un vehículo'); return; }
    setSaving(true); setError('');
    const res = await api.createDispatchRoute({
      orderIds: (suggestion.orders || []).map((o: any) => String(o.id)),
      vehicleId, driverId: driverId || undefined,
      auxiliaries: Array.from({ length: aux }, (_, i) => ({ name: `Auxiliar ${i + 1}` })),
      zoneLabel: suggestion.zone,
    });
    setSaving(false);
    if (res.success) onCreated(); else setError(res.error || 'No se pudo crear la ruta');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-4 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800">Crear ruta · {suggestion.zone}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <p className="text-xs text-gray-500">{suggestion.orderCount} pedidos · {kg(suggestion.totalWeightKg)}</p>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Vehículo</label>
          <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} className="w-full text-sm border rounded-lg px-2 py-2 bg-white">
            <option value="">Seleccionar…</option>
            {available.map(v => <option key={v.id} value={v.id}>{VEHICLE_ICON[v.type] || '🚗'} {v.name} ({v.maxWeightKg} kg)</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Conductor (opcional)</label>
          <select value={driverId} onChange={e => setDriverId(e.target.value)} className="w-full text-sm border rounded-lg px-2 py-2 bg-white">
            <option value="">Asignar después…</option>
            {drivers.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Auxiliares (sugerido: {suggestion.suggestedAuxiliaries})</label>
          <input type="number" min={0} max={4} value={aux} onChange={e => setAux(Number(e.target.value))} className="w-20 text-sm border rounded-lg px-2 py-1.5" />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button onClick={create} disabled={saving} className="w-full py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <><PackageCheck size={15} />Crear ruta ({suggestion.orderCount})</>}
        </button>
      </div>
    </div>
  );
}
