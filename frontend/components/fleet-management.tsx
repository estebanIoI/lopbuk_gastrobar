"use client";

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  Truck, Plus, Edit2, Trash2, Wrench, BarChart2, AlertTriangle,
  CheckCircle2, Clock, X, Loader2, RefreshCw, MapPin, Package,
  Weight, Calendar, ChevronDown, ChevronUp,
} from 'lucide-react';

const formatCOP = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v);

const VEHICLE_ICON: Record<string, string> = { planta: '🚛', ligera: '🚐', moto: '🏍️' };
const VEHICLE_TYPE_LABEL: Record<string, string> = {
  planta: 'Camión Planta (pesada)', ligera: 'Camión Ligero (media)', moto: 'Moto / Domicilio',
};
const STATUS_CLS: Record<string, string> = {
  disponible:   'bg-green-100 text-green-700 border-green-200',
  en_ruta:      'bg-orange-100 text-orange-700 border-orange-200',
  mantenimiento:'bg-red-100 text-red-700 border-red-200',
  inactivo:     'bg-gray-100 text-gray-500 border-gray-200',
};
const MAINT_STATUS_CLS: Record<string, string> = {
  pendiente:   'bg-yellow-100 text-yellow-700',
  en_proceso:  'bg-blue-100 text-blue-700',
  completado:  'bg-green-100 text-green-700',
  cancelado:   'bg-gray-100 text-gray-500',
};

type Tab = 'vehiculos' | 'mantenimientos' | 'metricas';

interface Vehicle {
  id: string; name: string; plate: string | null; type: string;
  maxWeightKg: number; status: string; year: number | null;
  brand: string | null; model: string | null; notes: string | null;
}

interface Maintenance {
  id: string; vehicleId: string; vehicleName: string; type: string;
  description: string; scheduledDate: string | null; completedDate: string | null;
  cost: number; status: string; notes: string | null; createdAt: string;
}

const emptyVehicleForm = { name: '', type: 'ligera', maxWeightKg: 500, plate: '', year: '', brand: '', model: '', notes: '' };
const emptyMaintForm = { vehicleId: '', type: 'preventivo', description: '', scheduledDate: '', cost: '', notes: '' };

export function FleetManagement() {
  const [tab, setTab] = useState<Tab>('vehiculos');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [expandedVehicle, setExpandedVehicle] = useState<string | null>(null);

  // Modals
  const [vehicleModal, setVehicleModal] = useState<{ open: boolean; editing: Vehicle | null }>({ open: false, editing: null });
  const [vehicleForm, setVehicleForm] = useState(emptyVehicleForm);
  const [maintModal, setMaintModal] = useState<{ open: boolean; editing: Maintenance | null }>({ open: false, editing: null });
  const [maintForm, setMaintForm] = useState(emptyMaintForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, mRes, metricsRes] = await Promise.all([
        api.getFleetVehicles(),
        api.getFleetMaintenance(),
        api.getFleetMetrics(),
      ]);
      if (vRes.success) setVehicles(vRes.data ?? []);
      if (mRes.success) setMaintenance(mRes.data ?? []);
      if (metricsRes.success) setMetrics(metricsRes.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── Vehículos ───────────────────────────────────────────────────────────────
  const openVehicleModal = (vehicle?: Vehicle) => {
    setVehicleForm(vehicle
      ? { name: vehicle.name, type: vehicle.type, maxWeightKg: vehicle.maxWeightKg,
          plate: vehicle.plate || '', year: vehicle.year?.toString() || '',
          brand: vehicle.brand || '', model: vehicle.model || '', notes: vehicle.notes || '' }
      : emptyVehicleForm
    );
    setVehicleModal({ open: true, editing: vehicle || null });
  };

  const saveVehicle = async () => {
    if (!vehicleForm.name || !vehicleForm.maxWeightKg) return;
    setSaving(true);
    try {
      const payload = {
        name: vehicleForm.name,
        type: vehicleForm.type as any,
        maxWeightKg: Number(vehicleForm.maxWeightKg),
        plate: vehicleForm.plate || undefined,
        year: vehicleForm.year ? Number(vehicleForm.year) : undefined,
        brand: vehicleForm.brand || undefined,
        model: vehicleForm.model || undefined,
        notes: vehicleForm.notes || undefined,
      };
      const res = vehicleModal.editing
        ? await api.updateFleetVehicle(vehicleModal.editing.id, payload)
        : await api.createFleetVehicle(payload);
      if (res.success) { setVehicleModal({ open: false, editing: null }); await fetchAll(); }
      else alert(res.error || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const deleteVehicle = async (id: string) => {
    setSaving(true);
    try {
      const res = await api.deleteFleetVehicle(id);
      if (res.success) { setDeleteConfirm(null); await fetchAll(); }
      else alert(res.error || 'Error al eliminar');
    } finally { setSaving(false); }
  };

  const changeVehicleStatus = async (id: string, status: string) => {
    const res = await api.updateFleetVehicle(id, { status });
    if (res.success) await fetchAll();
  };

  // ─── Mantenimientos ──────────────────────────────────────────────────────────
  const openMaintModal = (m?: Maintenance) => {
    setMaintForm(m
      ? { vehicleId: m.vehicleId, type: m.type, description: m.description,
          scheduledDate: m.scheduledDate || '', cost: m.cost?.toString() || '', notes: m.notes || '' }
      : emptyMaintForm
    );
    setMaintModal({ open: true, editing: m || null });
  };

  const saveMaint = async () => {
    if (!maintForm.vehicleId || !maintForm.description) return;
    setSaving(true);
    try {
      const payload = {
        vehicleId: maintForm.vehicleId,
        type: maintForm.type,
        description: maintForm.description,
        scheduledDate: maintForm.scheduledDate || undefined,
        cost: maintForm.cost ? Number(maintForm.cost) : undefined,
        notes: maintForm.notes || undefined,
      };
      const res = maintModal.editing
        ? await api.updateFleetMaintenance(maintModal.editing.id, { ...payload, status: undefined } as any)
        : await api.createFleetMaintenance(payload);
      if (res.success) { setMaintModal({ open: false, editing: null }); await fetchAll(); }
      else alert(res.error || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const completeMaint = async (id: string) => {
    const res = await api.updateFleetMaintenance(id, {
      status: 'completado', completedDate: new Date().toISOString().split('T')[0]
    });
    if (res.success) await fetchAll();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Truck className="text-orange-500" size={20} />
          <h2 className="text-lg font-bold text-gray-800">Gestión de Flota</h2>
        </div>
        <button onClick={fetchAll} disabled={loading} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-4">
        {([['vehiculos', 'Vehículos'], ['mantenimientos', 'Mantenimientos'], ['metricas', 'Métricas']] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ─── VEHÍCULOS ──────────────────────────────────────────────────────── */}
      {tab === 'vehiculos' && (
        <div className="flex-1 overflow-y-auto space-y-3">
          <button
            onClick={() => openVehicleModal()}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600"
          >
            <Plus size={16} /> Agregar Vehículo
          </button>

          {vehicles.length === 0 && !loading && (
            <div className="text-center py-12 text-gray-400">
              <Truck size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sin vehículos registrados</p>
            </div>
          )}

          {vehicles.map(v => {
            const isExpanded = expandedVehicle === v.id;
            const vmMetrics = metrics?.vehicles?.find((m: any) => m.id === v.id);
            return (
              <div key={v.id} className="bg-white border rounded-xl overflow-hidden shadow-sm">
                <button
                  onClick={() => setExpandedVehicle(isExpanded ? null : v.id)}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left"
                >
                  <span className="text-2xl">{VEHICLE_ICON[v.type] || '🚗'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800 text-sm">{v.name}</span>
                      {v.plate && <span className="text-xs text-gray-400">({v.plate})</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_CLS[v.status] || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                        {v.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {VEHICLE_TYPE_LABEL[v.type]} · {v.maxWeightKg} kg máx
                      {vmMetrics && ` · ${vmMetrics.ordersToday} pedidos hoy`}
                    </p>
                  </div>
                  {isExpanded ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
                </button>

                {isExpanded && (
                  <div className="border-t px-4 pb-4 space-y-3 pt-3">
                    {/* Info extra */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                      {v.brand && <p><span className="font-medium">Marca:</span> {v.brand}</p>}
                      {v.model && <p><span className="font-medium">Modelo:</span> {v.model}</p>}
                      {v.year && <p><span className="font-medium">Año:</span> {v.year}</p>}
                      <p><span className="font-medium">Capacidad:</span> {v.maxWeightKg} kg</p>
                    </div>

                    {/* Métricas */}
                    {vmMetrics && (
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: 'Hoy', value: vmMetrics.ordersToday },
                          { label: 'Total', value: vmMetrics.totalOrders },
                          { label: 'Kg hoy', value: `${(Number(vmMetrics.weightToday) || 0).toFixed(1)}` },
                        ].map(({ label, value }) => (
                          <div key={label} className="bg-gray-50 rounded-lg p-2 text-center">
                            <p className="text-lg font-bold text-gray-800">{value}</p>
                            <p className="text-xs text-gray-500">{label}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {v.notes && <p className="text-xs text-gray-500 italic">{v.notes}</p>}

                    {/* Cambiar estado */}
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Estado</p>
                      <div className="flex gap-2 flex-wrap">
                        {['disponible', 'en_ruta', 'mantenimiento', 'inactivo'].map(s => (
                          <button
                            key={s}
                            onClick={() => changeVehicleStatus(v.id, s)}
                            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                              v.status === s ? STATUS_CLS[s] : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => openVehicleModal(v)}
                        className="flex-1 flex items-center justify-center gap-1 text-xs py-2 border rounded-lg hover:bg-gray-50"
                      >
                        <Edit2 size={13} /> Editar
                      </button>
                      <button
                        onClick={() => openMaintModal({ vehicleId: v.id } as any)}
                        className="flex-1 flex items-center justify-center gap-1 text-xs py-2 border border-orange-200 text-orange-600 rounded-lg hover:bg-orange-50"
                      >
                        <Wrench size={13} /> Mantenimiento
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(v.id)}
                        className="flex items-center justify-center gap-1 text-xs py-2 px-3 border border-red-200 text-red-500 rounded-lg hover:bg-red-50"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── MANTENIMIENTOS ─────────────────────────────────────────────────── */}
      {tab === 'mantenimientos' && (
        <div className="flex-1 overflow-y-auto space-y-3">
          <button
            onClick={() => openMaintModal()}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600"
          >
            <Plus size={16} /> Registrar Mantenimiento
          </button>

          {/* Alertas de próximos mantenimientos */}
          {metrics?.upcomingMaintenance?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-700 flex items-center gap-1 mb-2">
                <AlertTriangle size={13} /> Próximos en 30 días
              </p>
              {metrics.upcomingMaintenance.map((m: any) => (
                <div key={m.id} className="flex items-center gap-2 text-xs text-amber-700 py-1">
                  <Calendar size={11} />
                  <span className="font-medium">{m.vehicleName}</span>
                  <span>·</span>
                  <span>{m.description.substring(0, 40)}</span>
                  <span className="ml-auto">{m.scheduledDate}</span>
                </div>
              ))}
            </div>
          )}

          {maintenance.length === 0 && !loading && (
            <div className="text-center py-12 text-gray-400">
              <Wrench size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sin registros de mantenimiento</p>
            </div>
          )}

          {maintenance.map(m => (
            <div key={m.id} className="bg-white border rounded-xl px-4 py-3 shadow-sm">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">{m.vehicleName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${MAINT_STATUS_CLS[m.status]}`}>{m.status}</span>
                    <span className="text-xs text-gray-400">{m.type}</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-0.5">{m.description}</p>
                  <div className="flex gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                    {m.scheduledDate && <span className="flex items-center gap-1"><Calendar size={11} /> {m.scheduledDate}</span>}
                    {m.cost > 0 && <span>{formatCOP(m.cost)}</span>}
                    {m.completedDate && <span className="text-green-600">Completado: {m.completedDate}</span>}
                  </div>
                  {m.notes && <p className="text-xs text-gray-400 italic mt-1">{m.notes}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  {m.status !== 'completado' && m.status !== 'cancelado' && (
                    <button
                      onClick={() => completeMaint(m.id)}
                      className="p-1.5 rounded-lg text-green-600 hover:bg-green-50"
                      title="Marcar completado"
                    >
                      <CheckCircle2 size={15} />
                    </button>
                  )}
                  <button
                    onClick={() => openMaintModal(m)}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50"
                  >
                    <Edit2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── MÉTRICAS ───────────────────────────────────────────────────────── */}
      {tab === 'metricas' && (
        <div className="flex-1 overflow-y-auto space-y-4">
          {!metrics && loading && (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-orange-500" size={28} /></div>
          )}

          {metrics && (
            <>
              {/* Resumen del día */}
              <div className="bg-white rounded-xl border p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <BarChart2 size={16} className="text-orange-500" /> Hoy
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Pedidos totales', value: metrics.dayStats?.totalOrdersToday || 0, color: 'text-gray-800' },
                    { label: 'Entregados', value: metrics.dayStats?.deliveredToday || 0, color: 'text-green-600' },
                    { label: 'En ruta', value: metrics.dayStats?.inRouteToday || 0, color: 'text-orange-600' },
                    { label: 'Sin asignar', value: metrics.dayStats?.unassigned || 0, color: 'text-red-500' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-gray-50 rounded-xl p-3">
                      <p className={`text-2xl font-bold ${color}`}>{value}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rendimiento por vehículo */}
              <div className="bg-white rounded-xl border p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Rendimiento por vehículo</p>
                <div className="space-y-3">
                  {metrics.vehicles?.map((v: any) => (
                    <div key={v.id} className="flex items-center gap-3">
                      <span className="text-xl">{VEHICLE_ICON[v.type] || '🚗'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-800 truncate">{v.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CLS[v.status]?.replace('border-', '') || 'bg-gray-100 text-gray-500'}`}>
                            {v.status}
                          </span>
                        </div>
                        <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                          <span>{v.ordersToday || 0} hoy</span>
                          <span>{v.totalOrders || 0} total</span>
                          <span><Weight size={10} className="inline" /> {(Number(v.weightToday) || 0).toFixed(1)} kg hoy</span>
                        </div>
                        {/* Barra de capacidad usada hoy */}
                        <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-400 rounded-full"
                            style={{ width: `${Math.min(100, ((Number(v.weightToday) || 0) / (Number(v.maxWeightKg) || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Próximos mantenimientos */}
              {metrics.upcomingMaintenance?.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-amber-700 mb-3 flex items-center gap-2">
                    <AlertTriangle size={15} /> Mantenimientos próximos
                  </p>
                  <div className="space-y-2">
                    {metrics.upcomingMaintenance.map((m: any) => (
                      <div key={m.id} className="flex items-center gap-2 text-sm">
                        <Clock size={13} className="text-amber-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-amber-800 font-medium text-xs">{m.vehicleName}</p>
                          <p className="text-amber-700 text-xs truncate">{m.description}</p>
                        </div>
                        <span className="text-xs text-amber-600 shrink-0">{m.scheduledDate}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── MODAL VEHÍCULO ─────────────────────────────────────────────────── */}
      {vehicleModal.open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-800">
                {vehicleModal.editing ? 'Editar vehículo' : 'Nuevo vehículo'}
              </h3>
              <button onClick={() => setVehicleModal({ open: false, editing: null })}>
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Nombre *</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Ej: Camión 1"
                  value={vehicleForm.name} onChange={e => setVehicleForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Tipo *</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={vehicleForm.type} onChange={e => setVehicleForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="moto">🏍️ Moto</option>
                    <option value="ligera">🚐 Ligera</option>
                    <option value="planta">🚛 Planta</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Cap. máx (kg) *</label>
                  <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="500"
                    value={vehicleForm.maxWeightKg} onChange={e => setVehicleForm(f => ({ ...f, maxWeightKg: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Placa</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="ABC-123"
                    value={vehicleForm.plate} onChange={e => setVehicleForm(f => ({ ...f, plate: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Año</label>
                  <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="2020"
                    value={vehicleForm.year} onChange={e => setVehicleForm(f => ({ ...f, year: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Marca</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Chevrolet"
                    value={vehicleForm.brand} onChange={e => setVehicleForm(f => ({ ...f, brand: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Modelo</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="NPR"
                    value={vehicleForm.model} onChange={e => setVehicleForm(f => ({ ...f, model: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Notas</label>
                <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} placeholder="Observaciones..."
                  value={vehicleForm.notes} onChange={e => setVehicleForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <button
                onClick={saveVehicle}
                disabled={saving || !vehicleForm.name}
                className="w-full py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                {vehicleModal.editing ? 'Guardar cambios' : 'Crear vehículo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL MANTENIMIENTO ────────────────────────────────────────────── */}
      {maintModal.open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-800">
                {maintModal.editing?.vehicleId ? 'Editar mantenimiento' : 'Registrar mantenimiento'}
              </h3>
              <button onClick={() => setMaintModal({ open: false, editing: null })}>
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Vehículo *</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={maintForm.vehicleId} onChange={e => setMaintForm(f => ({ ...f, vehicleId: e.target.value }))}>
                  <option value="">Seleccionar vehículo</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{VEHICLE_ICON[v.type]} {v.name} {v.plate ? `(${v.plate})` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Tipo</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={maintForm.type} onChange={e => setMaintForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="preventivo">Preventivo</option>
                    <option value="correctivo">Correctivo</option>
                    <option value="revision">Revisión</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Fecha programada</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={maintForm.scheduledDate} onChange={e => setMaintForm(f => ({ ...f, scheduledDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Descripción *</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Cambio de aceite, frenos..."
                  value={maintForm.description} onChange={e => setMaintForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Costo estimado</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="0"
                  value={maintForm.cost} onChange={e => setMaintForm(f => ({ ...f, cost: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Notas</label>
                <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows={2}
                  value={maintForm.notes} onChange={e => setMaintForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <button
                onClick={saveMaint}
                disabled={saving || !maintForm.vehicleId || !maintForm.description}
                className="w-full py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                {maintModal.editing ? 'Guardar cambios' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL CONFIRMAR ELIMINAR ────────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-gray-800 mb-2">¿Eliminar vehículo?</h3>
            <p className="text-sm text-gray-600 mb-4">Esta acción no se puede deshacer. El vehículo no puede eliminarse si tiene pedidos activos.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 border rounded-xl text-sm">Cancelar</button>
              <button
                onClick={() => deleteVehicle(deleteConfirm)}
                disabled={saving}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
