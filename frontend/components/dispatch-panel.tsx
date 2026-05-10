"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { api } from '@/lib/api';
import {
  Truck, Package, MapPin, Phone, Weight, ChevronDown, ChevronUp,
  RefreshCw, LogOut, CheckCircle2, AlertCircle, Clock, Loader2,
  ClipboardList, Navigation, User,
} from 'lucide-react';

const formatCOP = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v);

const formatKg = (kg: number | null) =>
  kg != null ? `${kg.toFixed(2)} kg` : '— kg';

// ─── Colores y etiquetas de dispatch_status ─────────────────────────────────
const DISPATCH_LABEL: Record<string, string> = {
  pendiente:  'Pendiente',
  en_pista:   'En pista',
  cargado:    'Cargado',
  despachado: 'Despachado',
  entregado:  'Entregado',
};
const DISPATCH_CLS: Record<string, string> = {
  pendiente:  'bg-gray-100 text-gray-600',
  en_pista:   'bg-yellow-100 text-yellow-700',
  cargado:    'bg-blue-100 text-blue-700',
  despachado: 'bg-orange-100 text-orange-700',
  entregado:  'bg-green-100 text-green-700',
};
const NEXT_DISPATCH: Record<string, string> = {
  pendiente:  'en_pista',
  en_pista:   'cargado',
  cargado:    'despachado',
  despachado: 'entregado',
};
const NEXT_DISPATCH_LABEL: Record<string, string> = {
  pendiente:  'Poner En Pista',
  en_pista:   'Marcar Cargado',
  cargado:    'Marcar Despachado (Salida)',
  despachado: 'Marcar Entregado',
};

const VEHICLE_TYPE_LABEL: Record<string, string> = {
  planta: 'Planta (pesada)',
  ligera: 'Ligera (media)',
  moto:   'Moto (liviana)',
};
const VEHICLE_TYPE_ICON: Record<string, string> = {
  planta: '🚛', ligera: '🚐', moto: '🏍️',
};

interface DispatchOrder {
  id: string; orderNumber: string; customerName: string; customerPhone: string;
  address: string; municipality: string; neighborhood: string;
  total: number; totalWeightKg: number | null; dispatchStatus: string;
  dispatchNotes: string | null; dispatchedAt: string | null;
  status: string; createdAt: string; paymentMethod: string;
  deliveryLatitude: number | null; deliveryLongitude: number | null;
  vehicleId: string | null; vehicleName: string | null; vehiclePlate: string | null;
  vehicleType: string | null; driverId: string | null; driverName: string | null;
  items: Array<{ productName: string; quantity: number; unitPrice: number; totalPrice: number }>;
}

interface Vehicle {
  id: string; name: string; plate: string | null; type: string;
  maxWeightKg: number; status: string;
}

type Tab = 'activos' | 'despachados' | 'entregados';

const TAB_FILTERS: Record<Tab, string[]> = {
  activos:     ['pendiente', 'en_pista', 'cargado'],
  despachados: ['despachado'],
  entregados:  ['entregado'],
};

export function DispatchPanel() {
  const { user, logout } = useAuthStore();

  const [tab, setTab] = useState<Tab>('activos');
  const [orders, setOrders] = useState<DispatchOrder[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Estado del modal de asignación de vehículo
  const [assignModal, setAssignModal] = useState<{ orderId: string; currentVehicleId: string | null } | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [dispatchNotes, setDispatchNotes] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, vehiclesRes] = await Promise.all([
        api.getPendingDispatch(),
        api.getFleetVehicles(),
      ]);
      if (ordersRes.success) setOrders(ordersRes.data ?? []);
      if (vehiclesRes.success) setVehicles(vehiclesRes.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredOrders = orders.filter(o => TAB_FILTERS[tab].includes(o.dispatchStatus));

  const handleStatusChange = async (order: DispatchOrder, nextStatus: string) => {
    setActionLoading(order.id);
    try {
      const res = await api.updateDispatchStatus(order.id, nextStatus, dispatchNotes || undefined);
      if (res.success) {
        setDispatchNotes('');
        await fetchData();
      } else {
        alert(res.error || 'Error al actualizar estado');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleAssignVehicle = async () => {
    if (!assignModal || !selectedVehicle) return;
    setActionLoading(assignModal.orderId);
    try {
      const res = await api.assignVehicle(assignModal.orderId, selectedVehicle);
      if (res.success) {
        setAssignModal(null);
        setSelectedVehicle('');
        await fetchData();
      } else {
        alert(res.error || 'Error al asignar vehículo');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const openInMaps = (lat: number | null, lng: number | null, address: string) => {
    if (lat && lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    } else if (address) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Truck className="text-orange-500" size={22} />
          <div>
            <p className="font-semibold text-gray-800 text-sm leading-tight">Panel de Despacho</p>
            <p className="text-xs text-gray-500">{user?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={logout} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Resumen de vehículos disponibles */}
      <div className="px-4 py-3 bg-white border-b overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {vehicles.map(v => (
            <div
              key={v.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
                v.status === 'disponible' ? 'border-green-300 bg-green-50 text-green-700' :
                v.status === 'en_ruta'    ? 'border-orange-300 bg-orange-50 text-orange-700' :
                                            'border-gray-300 bg-gray-100 text-gray-500'
              }`}
            >
              <span>{VEHICLE_TYPE_ICON[v.type] || '🚗'}</span>
              <span>{v.name}</span>
              {v.plate && <span className="opacity-70">({v.plate})</span>}
              <span className="ml-1 opacity-60">{v.maxWeightKg}kg</span>
            </div>
          ))}
          {vehicles.length === 0 && (
            <p className="text-xs text-gray-400">Sin vehículos registrados</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b bg-white">
        {(['activos', 'despachados', 'entregados'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
            <span className="ml-1 text-xs opacity-70">
              ({orders.filter(o => TAB_FILTERS[t].includes(o.dispatchStatus)).length})
            </span>
          </button>
        ))}
      </div>

      {/* Lista de pedidos */}
      <div className="p-4 space-y-3">
        {loading && orders.length === 0 && (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-orange-500" size={28} />
          </div>
        )}

        {!loading && filteredOrders.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <ClipboardList size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay pedidos en esta categoría</p>
          </div>
        )}

        {filteredOrders.map(order => {
          const isExpanded = expandedId === order.id;
          const isActioning = actionLoading === order.id;
          const nextStatus = NEXT_DISPATCH[order.dispatchStatus];

          return (
            <div key={order.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
              {/* Cabecera del pedido */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : order.id)}
                className="w-full px-4 py-3 flex items-start gap-3 text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-800 text-sm">{order.orderNumber}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${DISPATCH_CLS[order.dispatchStatus]}`}>
                      {DISPATCH_LABEL[order.dispatchStatus]}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-0.5">{order.customerName}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <MapPin size={11} /> {order.municipality}
                    </span>
                    {order.totalWeightKg != null && (
                      <span className="flex items-center gap-1">
                        <Weight size={11} /> {formatKg(order.totalWeightKg)}
                      </span>
                    )}
                    <span>{formatCOP(order.total)}</span>
                  </div>
                  {/* Vehículo asignado */}
                  {order.vehicleName ? (
                    <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                      <span>{VEHICLE_TYPE_ICON[order.vehicleType || ''] || '🚗'}</span>
                      {order.vehicleName} {order.vehiclePlate && `(${order.vehiclePlate})`}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-600 mt-1">⚠️ Sin vehículo asignado</p>
                  )}
                </div>
                {isExpanded ? <ChevronUp size={16} className="text-gray-400 mt-1" /> : <ChevronDown size={16} className="text-gray-400 mt-1" />}
              </button>

              {/* Detalle expandido */}
              {isExpanded && (
                <div className="border-t px-4 pb-4 space-y-3">
                  {/* Dirección y acciones de navegación */}
                  <div className="pt-3">
                    <p className="text-xs text-gray-500 mb-1">Dirección de entrega</p>
                    <p className="text-sm text-gray-800">{order.address}</p>
                    {order.neighborhood && <p className="text-xs text-gray-500">{order.neighborhood}, {order.municipality}</p>}
                    <div className="flex gap-2 mt-2">
                      <a href={`tel:${order.customerPhone}`}
                        className="flex items-center gap-1 text-xs text-blue-600 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50">
                        <Phone size={12} /> {order.customerPhone}
                      </a>
                      <button
                        onClick={() => openInMaps(order.deliveryLatitude, order.deliveryLongitude, `${order.address} ${order.municipality}`)}
                        className="flex items-center gap-1 text-xs text-green-600 px-3 py-1.5 rounded-lg border border-green-200 hover:bg-green-50">
                        <Navigation size={12} /> Ver ruta
                      </button>
                    </div>
                  </div>

                  {/* Ítems */}
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Productos ({order.items.length})</p>
                    <div className="space-y-1">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-xs text-gray-700 bg-gray-50 px-2 py-1 rounded">
                          <span>{item.quantity}× {item.productName}</span>
                          <span>{formatCOP(item.totalPrice)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Asignar / cambiar vehículo */}
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Vehículo</p>
                    <div className="flex items-center gap-2">
                      <select
                        className="flex-1 text-sm border rounded-lg px-2 py-1.5 bg-white"
                        value={assignModal?.orderId === order.id ? selectedVehicle : (order.vehicleId || '')}
                        onChange={e => {
                          setAssignModal({ orderId: order.id, currentVehicleId: order.vehicleId });
                          setSelectedVehicle(e.target.value);
                        }}
                      >
                        <option value="">Sin vehículo</option>
                        {vehicles.map(v => (
                          <option key={v.id} value={v.id} disabled={v.status === 'mantenimiento' || v.status === 'inactivo'}>
                            {VEHICLE_TYPE_ICON[v.type]} {v.name} {v.plate ? `(${v.plate})` : ''} — {v.maxWeightKg}kg
                            {v.status !== 'disponible' && v.status !== 'en_ruta' ? ` [${v.status}]` : ''}
                          </option>
                        ))}
                      </select>
                      {assignModal?.orderId === order.id && selectedVehicle !== (order.vehicleId || '') && (
                        <button
                          disabled={isActioning}
                          onClick={handleAssignVehicle}
                          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          {isActioning ? <Loader2 size={13} className="animate-spin" /> : 'Asignar'}
                        </button>
                      )}
                    </div>
                    {order.driverName && (
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <User size={11} /> Conductor: {order.driverName}
                      </p>
                    )}
                  </div>

                  {/* Notas de despacho */}
                  {tab === 'activos' && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Nota para el despacho (opcional)</p>
                      <input
                        type="text"
                        placeholder="Ej: Frágil, entregar antes del mediodía..."
                        className="w-full text-sm border rounded-lg px-3 py-1.5"
                        value={expandedId === order.id ? dispatchNotes : ''}
                        onChange={e => setDispatchNotes(e.target.value)}
                      />
                    </div>
                  )}

                  {order.dispatchNotes && (
                    <p className="text-xs text-gray-600 italic bg-yellow-50 border border-yellow-200 px-2 py-1.5 rounded">
                      📝 {order.dispatchNotes}
                    </p>
                  )}

                  {/* Botón siguiente estado */}
                  {nextStatus && tab !== 'entregados' && (
                    <button
                      disabled={isActioning}
                      onClick={() => handleStatusChange(order, nextStatus)}
                      className={`w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                        nextStatus === 'despachado'
                          ? 'bg-orange-500 hover:bg-orange-600 text-white'
                          : nextStatus === 'entregado'
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      } disabled:opacity-50`}
                    >
                      {isActioning ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : nextStatus === 'despachado' ? (
                        <><Truck size={15} /> {NEXT_DISPATCH_LABEL[order.dispatchStatus]}</>
                      ) : nextStatus === 'entregado' ? (
                        <><CheckCircle2 size={15} /> {NEXT_DISPATCH_LABEL[order.dispatchStatus]}</>
                      ) : (
                        <><Clock size={15} /> {NEXT_DISPATCH_LABEL[order.dispatchStatus]}</>
                      )}
                    </button>
                  )}

                  {order.dispatchStatus === 'entregado' && (
                    <div className="flex items-center gap-2 text-green-600 text-sm justify-center">
                      <CheckCircle2 size={16} /> Pedido entregado
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
