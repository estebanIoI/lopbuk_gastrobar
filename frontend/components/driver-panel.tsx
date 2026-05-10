"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { api } from '@/lib/api';
import {
  Package, MapPin, Phone, Navigation, Clock, CheckCircle2,
  Truck, ChevronRight, RefreshCw, User, LogOut, List, History,
  Map as MapIcon, Store, X,
} from 'lucide-react';

const formatCOP = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v);

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface OrderItem { productName: string; quantity: number; unitPrice: number; }

interface DeliveryOrder {
  id: string; orderNumber: string; customerName: string; customerPhone: string;
  department: string; municipality: string; address: string; neighborhood: string;
  deliveryLatitude: number | null; deliveryLongitude: number | null;
  deliveryStatus: string; total: number; status: string; notes: string;
  createdAt: string; items: OrderItem[]; storeName?: string;
  // Campos de despacho (ferretería)
  dispatchStatus?: string; vehicleName?: string | null; vehiclePlate?: string | null;
  totalWeightKg?: number | null;
}

const STATUS_LABEL: Record<string, string> = {
  sin_asignar: 'Sin asignar', asignado: 'Asignado', recogido: 'Recogido',
  en_camino: 'En camino', entregado: 'Entregado',
};
const STATUS_CLS: Record<string, string> = {
  sin_asignar: 'bg-gray-100 text-gray-600', asignado: 'bg-blue-100 text-blue-700',
  recogido: 'bg-yellow-100 text-yellow-700', en_camino: 'bg-orange-100 text-orange-700',
  entregado: 'bg-green-100 text-green-700',
};
const NEXT_STATUS: Record<string, string> = { asignado: 'recogido', recogido: 'en_camino', en_camino: 'entregado' };
const NEXT_LABEL: Record<string, string> = { asignado: 'Marcar Recogido', recogido: 'En Camino', en_camino: 'Marcar Entregado' };

const markerHtml = (color: string, emoji: string, size = 30, border = 'white') =>
  `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2.5px solid ${border};box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:13px;cursor:pointer">${emoji}</div>`;

export function DriverPanel() {
  const { user, logout } = useAuthStore();

  type SideTab = 'assigned' | 'available' | 'history';
  const [sideTab, setSideTab] = useState<SideTab>('available');
  const [showMapMobile, setShowMapMobile] = useState(false);

  const [myOrders, setMyOrders] = useState<DeliveryOrder[]>([]);
  const [availableOrders, setAvailableOrders] = useState<DeliveryOrder[]>([]);
  const [historyOrders, setHistoryOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const driverMarkerRef = useRef<any>(null);
  const Lref = useRef<any>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // GPS
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setDriverPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {}
    );
  }, []);

  // Load orders
  const loadOrders = useCallback(async (tab: SideTab = sideTab) => {
    setLoading(true);
    try {
      if (tab !== 'history') {
        const [myRes, availRes] = await Promise.all([
          api.getDriverOrders(),
          api.getAvailableOrders(),
        ]);
        if (myRes.success && myRes.data) setMyOrders(Array.isArray(myRes.data) ? myRes.data : []);
        if (availRes.success && availRes.data) setAvailableOrders(Array.isArray(availRes.data) ? availRes.data : []);
      } else {
        const histRes = await api.getDriverHistory();
        if (histRes.success && histRes.data) setHistoryOrders(Array.isArray(histRes.data) ? histRes.data : []);
      }
    } catch {}
    setLoading(false);
  }, [sideTab]);

  useEffect(() => { loadOrders(sideTab); }, [sideTab]); // eslint-disable-line

  // Sort available by distance
  const sortedAvailable = useMemo(() => {
    if (!driverPos) return availableOrders;
    return [...availableOrders].sort((a, b) => {
      const dA = a.deliveryLatitude && a.deliveryLongitude
        ? haversineKm(driverPos.lat, driverPos.lng, Number(a.deliveryLatitude), Number(a.deliveryLongitude))
        : Infinity;
      const dB = b.deliveryLatitude && b.deliveryLongitude
        ? haversineKm(driverPos.lat, driverPos.lng, Number(b.deliveryLatitude), Number(b.deliveryLongitude))
        : Infinity;
      return dA - dB;
    });
  }, [availableOrders, driverPos]);

  // Init map
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === 'undefined' || !mapContainerRef.current) return;
      try {
        await new Promise<void>((resolve) => {
          if (document.querySelector('link[href*="leaflet"]')) { resolve(); return; }
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          link.onload = () => resolve();
          link.onerror = () => resolve();
          document.head.appendChild(link);
        });
        if (cancelled) return;
        const L = (await import('leaflet')).default;
        if (cancelled || !mapContainerRef.current) return;
        // Guard: container already has a Leaflet instance attached
        if ((mapContainerRef.current as any)._leaflet_id) return;
        Lref.current = L;
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        const center: [number, number] = driverPos ? [driverPos.lat, driverPos.lng] : [4.711, -74.0721];
        const map = L.map(mapContainerRef.current, { center, zoom: driverPos ? 12 : 6 });
        if (cancelled) { map.remove(); return; }
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap', maxZoom: 19,
        }).addTo(map);
        mapRef.current = map;
        setTimeout(() => map.invalidateSize(), 300);
      } catch (e) { console.error('Map init', e); }
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; markersRef.current.clear(); }
    };
  }, []); // eslint-disable-line

  // Update order markers
  useEffect(() => {
    const L = Lref.current; const map = mapRef.current;
    if (!L || !map) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current.clear();

    const all = [
      ...myOrders.map(o => ({ ...o, _kind: 'mine' as const })),
      ...availableOrders.map(o => ({ ...o, _kind: 'avail' as const })),
    ];
    const bounds: [number, number][] = [];

    for (const order of all) {
      const lat = order.deliveryLatitude ? Number(order.deliveryLatitude) : null;
      const lng = order.deliveryLongitude ? Number(order.deliveryLongitude) : null;
      if (!lat || !lng) continue;

      const isSelected = selectedId === order.id;
      const color = order._kind === 'mine' ? '#4F46E5' : '#16A34A';
      const border = isSelected ? '#FCD34D' : 'white';
      const size = isSelected ? 36 : 30;
      const emoji = order._kind === 'mine' ? '📦' : '🟢';

      const icon = L.divIcon({
        className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
        html: markerHtml(color, emoji, size, border),
      });
      const marker = L.marker([lat, lng], { icon }).addTo(map);
      marker.on('click', () => {
        setSelectedId(order.id);
        setExpandedId(order.id);
        setSideTab(order._kind === 'mine' ? 'assigned' : 'available');
        setShowMapMobile(false);
        setTimeout(() => {
          cardRefs.current.get(order.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 200);
      });
      markersRef.current.set(order.id, marker);
      bounds.push([lat, lng]);
    }

    if (bounds.length > 1) {
      try { map.fitBounds(bounds, { padding: [50, 50] }); } catch {}
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 14);
    }
  }, [myOrders, availableOrders, selectedId]); // eslint-disable-line

  // Driver position marker
  useEffect(() => {
    const L = Lref.current; const map = mapRef.current;
    if (!L || !map || !driverPos) return;
    if (driverMarkerRef.current) driverMarkerRef.current.remove();
    const icon = L.divIcon({
      className: '', iconSize: [32, 32], iconAnchor: [16, 16],
      html: markerHtml('#EF4444', '🏍️', 32),
    });
    driverMarkerRef.current = L.marker([driverPos.lat, driverPos.lng], { icon }).addTo(map);
  }, [driverPos]); // eslint-disable-line

  // Actions
  const handleAccept = async (orderId: string) => {
    setActionLoading(orderId);
    const res = await api.acceptOrder(orderId);
    if (res.success) {
      setAvailableOrders(p => p.filter(o => o.id !== orderId));
      setSideTab('assigned');
      setTimeout(() => loadOrders('assigned'), 300);
    }
    setActionLoading(null);
  };

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    setActionLoading(orderId);
    const res = await api.updateDeliveryStatus(orderId, newStatus);
    if (res.success) {
      if (newStatus === 'entregado') {
        setMyOrders(p => p.filter(o => o.id !== orderId));
      } else {
        setMyOrders(p => p.map(o => o.id === orderId ? { ...o, deliveryStatus: newStatus } : o));
      }
    }
    setActionLoading(null);
  };

  // Order card
  const renderCard = (order: DeliveryOrder, isAvailable = false) => {
    const expanded = expandedId === order.id;
    const isSelected = selectedId === order.id;
    const lat = order.deliveryLatitude ? Number(order.deliveryLatitude) : null;
    const lng = order.deliveryLongitude ? Number(order.deliveryLongitude) : null;
    const dist = driverPos && lat && lng
      ? haversineKm(driverPos.lat, driverPos.lng, lat, lng)
      : null;

    return (
      <div
        key={order.id}
        ref={el => { if (el) cardRefs.current.set(order.id, el); }}
        className={`rounded-xl border overflow-hidden transition-all bg-white ${isSelected ? 'border-indigo-400 shadow-md' : 'border-gray-200 shadow-sm'}`}
      >
        <button
          onClick={() => { setExpandedId(expanded ? null : order.id); setSelectedId(order.id); }}
          className="w-full p-4 flex items-center gap-3 text-left"
        >
          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isAvailable ? 'bg-green-500' : 'bg-indigo-500'}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="font-semibold text-sm text-gray-900">{order.orderNumber}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isAvailable ? 'bg-green-100 text-green-700' : STATUS_CLS[order.deliveryStatus] || 'bg-gray-100 text-gray-600'}`}>
                {isAvailable ? 'Disponible' : STATUS_LABEL[order.deliveryStatus] || order.deliveryStatus}
              </span>
            </div>
            <p className="text-sm text-gray-600 truncate">{order.customerName}</p>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className="text-xs text-gray-400">{formatCOP(order.total)}</span>
              {order.storeName && (
                <span className="text-xs text-indigo-400 flex items-center gap-0.5">
                  <Store className="w-3 h-3" />{order.storeName}
                </span>
              )}
              {dist !== null && (
                <span className="text-xs text-emerald-600 font-medium">{dist < 1 ? `${(dist * 1000).toFixed(0)}m` : `${dist.toFixed(1)}km`}</span>
              )}
            </div>
          </div>
          <ChevronRight className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>

        {expanded && (
          <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
            <div className="pt-3 space-y-2">
              {order.customerPhone && (
                <a href={`tel:${order.customerPhone}`} className="flex items-center gap-2 text-blue-600">
                  <Phone className="h-4 w-4 shrink-0" /><span className="text-sm">{order.customerPhone}</span>
                </a>
              )}
              {(order.address || order.municipality) && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                  <span className="text-sm text-gray-700">
                    {[order.address, order.neighborhood, order.municipality, order.department].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
              {order.notes && <p className="text-xs text-gray-500 bg-gray-50 rounded p-2">📝 {order.notes}</p>}
            {/* Despacho: vehículo y estado */}
            {order.vehicleName && (
              <div className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-2 text-sm">
                <Truck className="h-4 w-4 text-blue-500 shrink-0" />
                <div>
                  <p className="text-blue-700 font-medium text-xs">{order.vehicleName}{order.vehiclePlate ? ` (${order.vehiclePlate})` : ''}</p>
                  {order.totalWeightKg != null && (
                    <p className="text-blue-500 text-xs">Peso: {order.totalWeightKg.toFixed(2)} kg</p>
                  )}
                </div>
                {order.dispatchStatus === 'despachado' && (
                  <span className="ml-auto text-[10px] bg-orange-500 text-white px-2 py-0.5 rounded-full font-semibold">✅ Salida dada</span>
                )}
                {order.dispatchStatus && order.dispatchStatus !== 'despachado' && order.dispatchStatus !== 'entregado' && (
                  <span className="ml-auto text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">En pista</span>
                )}
              </div>
            )}
            </div>

            {order.items?.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-500 mb-2">Productos</p>
                {order.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm py-0.5">
                    <span className="text-gray-700">{item.quantity}× {item.productName}</span>
                    <span className="text-gray-500">{formatCOP(item.unitPrice * item.quantity)}</span>
                  </div>
                ))}
                <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between font-medium text-sm">
                  <span>Total</span><span>{formatCOP(order.total)}</span>
                </div>
              </div>
            )}

            {lat && lng && (
              <div className="flex gap-2">
                <button
                  onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Navigation className="h-3.5 w-3.5" />Maps
                </button>
                <button
                  onClick={() => window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, '_blank')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-sky-500 text-white text-xs rounded-lg hover:bg-sky-600 transition-colors"
                >
                  <Navigation className="h-3.5 w-3.5" />Waze
                </button>
                <button
                  onClick={() => { if (mapRef.current) { mapRef.current.setView([lat, lng], 16); setShowMapMobile(true); } }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-indigo-100 text-indigo-700 text-xs rounded-lg hover:bg-indigo-200 transition-colors"
                >
                  <MapIcon className="h-3.5 w-3.5" />Mapa
                </button>
              </div>
            )}

            {isAvailable ? (
              <button
                onClick={() => handleAccept(order.id)}
                disabled={actionLoading === order.id}
                className="w-full py-2.5 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {actionLoading === order.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Tomar Pedido
              </button>
            ) : NEXT_STATUS[order.deliveryStatus] ? (
              <button
                onClick={() => handleUpdateStatus(order.id, NEXT_STATUS[order.deliveryStatus])}
                disabled={actionLoading === order.id}
                className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {actionLoading === order.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                {NEXT_LABEL[order.deliveryStatus]}
              </button>
            ) : null}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 shrink-0 z-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center">
            <Truck className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">Panel Repartidor</h1>
            <p className="text-xs text-gray-500 leading-tight">{user?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => loadOrders(sideTab)} disabled={loading} className="p-2 text-gray-400 hover:text-indigo-600 transition-colors" title="Actualizar">
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={logout} className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Cerrar sesión">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Body: map (left) + sidebar (right) */}
      <div className="flex-1 flex overflow-hidden" style={{ minHeight: 0 }}>

        {/* ── MAP ── desktop: always visible │ mobile: only when showMapMobile */}
        <div
          className={`relative flex-1 min-w-0 ${showMapMobile ? 'block' : 'hidden'} md:block`}
        >
          {/* Leaflet container fills the relative parent */}
          <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0 }} />

          {/* Legend */}
          <div className="absolute bottom-4 left-4 z-[400] bg-white/95 backdrop-blur rounded-xl shadow-lg px-3 py-2 space-y-1.5 text-xs border border-gray-200">
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" />Disponibles ({availableOrders.length})</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" />Mis pedidos ({myOrders.length})</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" />Mi posición</div>
          </div>

          {driverPos && (
            <button
              onClick={() => mapRef.current?.setView([driverPos.lat, driverPos.lng], 14)}
              className="absolute top-4 right-4 z-[400] bg-white rounded-xl shadow-lg p-2.5 hover:bg-indigo-50 border border-gray-200 transition-colors"
              title="Centrar en mi posición"
            >
              <Navigation className="h-4 w-4 text-indigo-600" />
            </button>
          )}

          {/* Mobile: back to list button */}
          <button
            onClick={() => setShowMapMobile(false)}
            className="md:hidden absolute top-4 left-4 z-[400] bg-white rounded-xl shadow-lg px-3 py-2 flex items-center gap-1.5 text-sm text-gray-700 border border-gray-200"
          >
            <X className="h-4 w-4" /> Lista
          </button>
        </div>

        {/* ── SIDEBAR ── desktop: fixed 380px │ mobile: full width, hidden when map shown */}
        <div
          className={`flex-col bg-white border-l border-gray-200 overflow-hidden shrink-0
            w-full md:w-[380px]
            ${showMapMobile ? 'hidden' : 'flex'} md:flex`}
        >

            {/* Tabs */}
            <div className="flex border-b border-gray-100 shrink-0">
              {([
                { key: 'assigned',  label: 'Mis Pedidos', Icon: Package,  count: myOrders.length },
                { key: 'available', label: 'Disponibles', Icon: List,     count: sortedAvailable.length },
                { key: 'history',   label: 'Historial',   Icon: History,  count: 0 },
              ] as const).map(({ key, label, Icon, count }) => (
                <button
                  key={key}
                  onClick={() => setSideTab(key)}
                  className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-xs font-medium border-b-2 transition-colors ${
                    sideTab === key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-700'
                  }`}
                >
                  <div className="relative">
                    <Icon className="h-4 w-4" />
                    {count > 0 && (
                      <span className="absolute -top-1.5 -right-2.5 bg-indigo-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                        {count > 9 ? '9+' : count}
                      </span>
                    )}
                  </div>
                  {label}
                </button>
              ))}
            </div>

            {/* Mobile: show map button */}
            <button
              onClick={() => setShowMapMobile(true)}
              className="md:hidden mx-3 mt-3 flex items-center justify-center gap-2 py-2 bg-indigo-50 text-indigo-600 text-sm rounded-xl border border-indigo-200 hover:bg-indigo-100 transition-colors shrink-0"
            >
              <MapIcon className="h-4 w-4" /> Ver mapa con pedidos
            </button>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">

              {sideTab === 'assigned' && (
                myOrders.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No tienes pedidos asignados</p>
                    <p className="text-xs mt-1 text-gray-300">Toma uno de Disponibles</p>
                  </div>
                ) : myOrders.map(o => renderCard(o, false))
              )}

              {sideTab === 'available' && (
                sortedAvailable.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No hay pedidos disponibles</p>
                  </div>
                ) : (
                  <>
                    {driverPos && (
                      <p className="text-xs text-emerald-600 font-medium px-1 flex items-center gap-1">
                        <Navigation className="h-3 w-3" /> Ordenados por distancia
                      </p>
                    )}
                    {sortedAvailable.map(o => renderCard(o, true))}
                  </>
                )
              )}

              {sideTab === 'history' && (
                historyOrders.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Aún no has completado entregas</p>
                  </div>
                ) : historyOrders.map(order => (
                  <div key={order.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-900">{order.orderNumber}</p>
                      <p className="text-xs text-gray-500 truncate">{order.customerName}</p>
                      {order.storeName && (
                        <p className="text-xs text-indigo-400 flex items-center gap-0.5 mt-0.5">
                          <Store className="w-3 h-3" />{order.storeName}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium text-gray-900">{formatCOP(order.total)}</p>
                      <span className="text-xs text-green-600 font-medium">Entregado</span>
                      {order.deliveredAt && (
                        <p className="text-xs text-gray-400">{new Date(order.deliveredAt).toLocaleDateString('es-CO')}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
        </div>
      </div>
    </div>
  );
}
