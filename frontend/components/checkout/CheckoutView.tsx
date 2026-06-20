"use client";

import { useState } from 'react';

const formatCOP = (value: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
import { Minus, Plus, Trash2, Ticket, X, Check, Loader2, AlertCircle, Zap, ShoppingCart, Package, Sparkles, Navigation, MapPin, ChevronRight } from 'lucide-react';
import { NewTransactionButton } from '@/components/ui/new-transaction-button';
import { OrderCompletedML } from '@/components/theme-ml/order-completed-ml';

interface FieldError {
  field: string;
  message: string;
}

const REQUIRED_FIELDS: { field: keyof import('@/types').PedidoForm; label: string }[] = [
  { field: 'nombre', label: 'Nombre completo' },
  { field: 'telefono', label: 'Teléfono / WhatsApp' },
  { field: 'email', label: 'Correo electrónico' },
  { field: 'cedula', label: 'Cédula / Documento' },
  { field: 'direccion', label: 'Dirección de entrega' },
];
import { ModalExito } from './ModalExito';
import { LocationPicker } from './LocationPicker';
import { departamentosMunicipios } from '@/constants';
import type { ProductoCarrito, PedidoForm, PedidoConfirmado, CuponValidacion } from '@/types';

interface OrderBumpProduct {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  description: string | null;
  salePrice: number;
  imageUrl: string | null;
  stock: number;
  isOnOffer?: boolean | number;
  offerPrice?: number | null;
  offerLabel?: string | null;
}

interface CheckoutViewProps {
  carrito: ProductoCarrito[];
  totalCarrito: number;
  formData: PedidoForm;
  enviandoEmail: boolean;
  mostrarModalExito: boolean;
  pedidoConfirmado: PedidoConfirmado | null;
  // Cupones
  cuponCodigo?: string;
  cuponAplicado?: CuponValidacion | null;
  totalConDescuento?: number;
  onValidarCupon?: (codigo: string, subtotal: number) => Promise<CuponValidacion>;
  onAplicarCupon?: (codigo: string, descuento: CuponValidacion) => void;
  onRemoverCupon?: () => void;
  // Geolocalización
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
  isDeliveryOrder?: boolean;
  onLocationChange?: (lat: number, lng: number) => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onActualizarCantidad: (id: number, cambio: number, tempId?: string) => void;
  onRemoverProducto: (producto: ProductoCarrito) => void;
  onConfirmar: () => void;
  onCerrarModal: () => void;
  onVolver: () => void;
  // Order Bump / Cross-sell
  orderBumpProducts?: OrderBumpProduct[];
  orderBumpTitle?: string;
  onAddBumpProduct?: (product: OrderBumpProduct) => void;
  // MercadoPago Checkout Pro
  onPagarEnLinea?: () => Promise<void>;
  // ADDI crédito
  onPagarConAddi?: () => Promise<void>;
  // Sistecredito
  onPagarConSistecredito?: () => Promise<void>;
  // Wompi (tarjeta / PSE / Nequi)
  onPagarConWompi?: () => Promise<void>;
  // Contraentrega toggle
  allowContraentrega?: boolean;
  // Mínimo para domicilio gratis
  freeDeliveryMin?: number;
  // Tarifa cobrada cuando no alcanza el mínimo
  deliveryFee?: number;
  // Tema ML (detalle/checkout cargado estilo Mercado Libre)
  mlStyle?: boolean;
  accentColor?: string;
  storeName?: string;
}

export function CheckoutView({
  carrito,
  totalCarrito,
  formData,
  enviandoEmail,
  mostrarModalExito,
  pedidoConfirmado,
  cuponCodigo = '',
  cuponAplicado,
  totalConDescuento,
  onValidarCupon,
  onAplicarCupon,
  onRemoverCupon,
  deliveryLatitude,
  deliveryLongitude,
  isDeliveryOrder = false,
  onLocationChange,
  onInputChange,
  onActualizarCantidad,
  onRemoverProducto,
  onConfirmar,
  onCerrarModal,
  onVolver,
  orderBumpProducts = [],
  orderBumpTitle = '¿También te puede interesar?',
  onAddBumpProduct,
  onPagarEnLinea,
  onPagarConAddi,
  onPagarConSistecredito,
  onPagarConWompi,
  allowContraentrega = true,
  freeDeliveryMin = 0,
  deliveryFee = 0,
  mlStyle = false,
  accentColor = '#3483fa',
  storeName = 'la tienda',
}: CheckoutViewProps) {
  const [inputCupon, setInputCupon] = useState(cuponCodigo);
  const [validandoCupon, setValidandoCupon] = useState(false);
  const [errorCupon, setErrorCupon] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [addedBumpIds, setAddedBumpIds] = useState<Set<string>>(new Set());
  const [loadingMP, setLoadingMP] = useState(false);
  const [errorMP, setErrorMP] = useState('');
  const [loadingAddi, setLoadingAddi] = useState(false);
  const [errorAddi, setErrorAddi] = useState('');
  const [loadingSiste, setLoadingSiste] = useState(false);
  const [errorSiste, setErrorSiste] = useState('');
  const [loadingWompi, setLoadingWompi] = useState(false);
  const [errorWompi, setErrorWompi] = useState('');
  const defaultPayment = allowContraentrega ? 'contraentrega' : onPagarEnLinea ? 'mercadopago' : onPagarConAddi ? 'addi' : onPagarConSistecredito ? 'sistecredito' : onPagarConWompi ? 'wompi' : 'contraentrega';
  const [paymentMethod, setPaymentMethod] = useState<'contraentrega' | 'mercadopago' | 'addi' | 'sistecredito' | 'wompi'>(defaultPayment);
  const [isLocatingAddress, setIsLocatingAddress] = useState(false);
  const [detectedAddress, setDetectedAddress] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const validateForm = (): boolean => {
    const errors: FieldError[] = [];
    const fields = [...REQUIRED_FIELDS];
    if (!isDeliveryOrder) {
      fields.push(
        { field: 'departamento', label: 'Departamento' },
        { field: 'municipio', label: 'Municipio' },
      );
    }
    for (const { field, label } of fields) {
      if (!formData[field] || !formData[field].trim()) {
        errors.push({ field, message: `${label} es obligatorio` });
      }
    }
    // Validate email format
    if (formData.email && formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      const existing = errors.find(e => e.field === 'email');
      if (!existing) errors.push({ field: 'email', message: 'Correo electrónico no válido' });
    }
    // Validate phone (at least 7 digits)
    if (formData.telefono && formData.telefono.trim() && !/^\d{7,}$/.test(formData.telefono.trim().replace(/[\s\-\+]/g, ''))) {
      const existing = errors.find(e => e.field === 'telefono');
      if (!existing) errors.push({ field: 'telefono', message: 'Teléfono no válido (mínimo 7 dígitos)' });
    }
    setFieldErrors(errors);
    if (errors.length > 0) {
      // Scroll to the first error field
      const firstErrorField = document.querySelector(`[name="${errors[0].field}"]`);
      firstErrorField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return errors.length === 0;
  };

  const handleConfirmar = () => {
    if (validateForm()) {
      onConfirmar();
    }
  };

  const handlePagarEnLinea = async () => {
    if (!onPagarEnLinea) return;
    if (!validateForm()) return;
    setLoadingMP(true);
    setErrorMP('');
    try {
      await onPagarEnLinea();
    } catch {
      setErrorMP('Error al iniciar el pago en línea. Intenta de nuevo.');
    } finally {
      setLoadingMP(false);
    }
  };

  const handlePagarConAddi = async () => {
    if (!onPagarConAddi) return;
    if (!validateForm()) return;
    setLoadingAddi(true);
    setErrorAddi('');
    try {
      await onPagarConAddi();
    } catch {
      setErrorAddi('Error al iniciar el pago con ADDI. Intenta de nuevo.');
    } finally {
      setLoadingAddi(false);
    }
  };

  const handlePagarConSistecredito = async () => {
    if (!onPagarConSistecredito) return;
    if (!validateForm()) return;
    setLoadingSiste(true);
    setErrorSiste('');
    try {
      await onPagarConSistecredito();
    } catch {
      setErrorSiste('Error al iniciar el pago con Sistecredito. Intenta de nuevo.');
    } finally {
      setLoadingSiste(false);
    }
  };

  const handlePagarConWompi = async () => {
    if (!onPagarConWompi) return;
    if (!validateForm()) return;
    setLoadingWompi(true);
    setErrorWompi('');
    try {
      await onPagarConWompi();
    } catch {
      setErrorWompi('Error al iniciar el pago con Wompi. Intenta de nuevo.');
    } finally {
      setLoadingWompi(false);
    }
  };

  const handleFinalizar = async () => {
    if (paymentMethod === 'mercadopago') return handlePagarEnLinea();
    if (paymentMethod === 'addi') return handlePagarConAddi();
    if (paymentMethod === 'sistecredito') return handlePagarConSistecredito();
    if (paymentMethod === 'wompi') return handlePagarConWompi();
    handleConfirmar();
  };

  const isProcessing = loadingMP || loadingAddi || loadingSiste || loadingWompi || enviandoEmail;
  const currentPaymentError =
    paymentMethod === 'wompi' ? errorWompi :
    paymentMethod === 'mercadopago' ? errorMP :
    paymentMethod === 'addi' ? errorAddi :
    paymentMethod === 'sistecredito' ? errorSiste : '';

  const getFieldError = (field: string) => fieldErrors.find(e => e.field === field);
  const hasFieldError = (field: string) => fieldErrors.some(e => e.field === field);

  // Clear field error when user types
  const handleInputChangeWithClear = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name } = e.target;
    if (hasFieldError(name)) {
      setFieldErrors(prev => prev.filter(err => err.field !== name));
    }
    onInputChange(e);
  };

  const handleValidarCupon = async () => {
    if (!inputCupon.trim() || !onValidarCupon) return;

    setValidandoCupon(true);
    setErrorCupon('');

    try {
      const resultado = await onValidarCupon(inputCupon.trim().toUpperCase(), totalCarrito);
      if (resultado.valido && onAplicarCupon) {
        onAplicarCupon(inputCupon.trim().toUpperCase(), resultado);
        setErrorCupon('');
      } else {
        setErrorCupon(resultado.mensaje || 'Cupón no válido');
      }
    } catch (error) {
      setErrorCupon('Error al validar cupón');
    } finally {
      setValidandoCupon(false);
    }
  };

  const handleRemoverCupon = () => {
    setInputCupon('');
    setErrorCupon('');
    if (onRemoverCupon) onRemoverCupon();
  };

  const fireChange = (name: string, value: string) => {
    onInputChange({ target: { name, value } } as React.ChangeEvent<HTMLSelectElement>);
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Tu navegador no soporta geolocalización');
      return;
    }
    setIsLocatingAddress(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        if (onLocationChange) onLocationChange(lat, lng);
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=es`
          );
          const data = await res.json();
          const addr = data.address || {};
          const departamento = addr.state || addr.region || '';
          const municipio = addr.city || addr.town || addr.municipality || addr.county || addr.village || '';
          if (departamento) fireChange('departamento', departamento);
          if (municipio) fireChange('municipio', municipio);
          const label = [municipio, departamento].filter(Boolean).join(', ');
          setDetectedAddress(label || 'Ubicación detectada');
        } catch {
          setDetectedAddress('Ubicación detectada');
        }
        setIsLocatingAddress(false);
      },
      (err) => {
        setIsLocatingAddress(false);
        if (err.code === 1) {
          setLocationError('Permiso denegado. Activa la ubicación en tu navegador.');
        } else {
          setLocationError('No se pudo obtener tu ubicación. Intenta de nuevo.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const totalFinal = (totalConDescuento ?? totalCarrito) + deliveryFee;
  const descuentoAplicado = cuponAplicado?.valido ? cuponAplicado.descuento || 0 : 0;

  return (
    <div className={`min-h-screen ${mlStyle ? 'ml-checkout' : 'bg-gray-50'}`}>
      {mlStyle && (
        <style>{`
          .ml-checkout{background:#ededed}
          .ml-checkout input,.ml-checkout select,.ml-checkout textarea{border-radius:8px!important}
          .ml-checkout input:focus,.ml-checkout select:focus,.ml-checkout textarea:focus{border-color:${accentColor}!important;box-shadow:0 0 0 1px ${accentColor}!important}
          .ml-checkout .bg-white.border-gray-200{border-radius:12px}
          .ml-checkout .border-gray-200,.ml-checkout .border-gray-300,.ml-checkout .border-gray-100{border-color:#e6e6e6!important}
          .ml-checkout .border-gray-900{border-color:${accentColor}!important}
          .ml-checkout .bg-gray-900{background-color:${accentColor}!important}
          .ml-checkout .hover\\:bg-gray-700:hover{background-color:${accentColor}!important;filter:brightness(.92)}
        `}</style>
      )}

      {/* ── Stepper bar ── */}
      <div className="bg-gray-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-center gap-4 sm:gap-8">
          <div className="flex items-center gap-2 opacity-40">
            <ShoppingCart className="w-3.5 h-3.5" />
            <span className="text-[10px] tracking-widest uppercase hidden sm:inline">Carrito</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 opacity-20" />
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-white text-gray-900 flex items-center justify-center text-[10px] font-bold leading-none flex-shrink-0">2</div>
            <span className="text-[10px] tracking-widest uppercase font-semibold">Finalizar Compra</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 opacity-20" />
          <div className="flex items-center gap-2 opacity-40">
            <Check className="w-3.5 h-3.5" />
            <span className="text-[10px] tracking-widest uppercase hidden sm:inline">Pedido Completado</span>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* Error summary */}
        {fieldErrors.length > 0 && (
          <div className="mb-6 p-4 border border-red-300 bg-red-50 rounded">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <span className="text-sm font-medium text-red-700">Por favor completa los siguientes campos:</span>
            </div>
            <ul className="list-disc list-inside space-y-1">
              {fieldErrors.map(err => (
                <li key={err.field} className="text-sm text-red-600">{err.message}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid lg:grid-cols-[1fr_400px] gap-6 items-start">
          {/* Columna izquierda - Datos */}
          <div className="bg-white border border-gray-200 p-6 sm:p-8 space-y-8">
            {/* Datos del Comprador */}
            <div>
              <h2 className="text-xs font-bold tracking-widest text-gray-900 uppercase mb-6 pb-3 border-b border-gray-100">
                {isDeliveryOrder ? 'Datos del Domicilio' : 'Detalles de Facturación'}
              </h2>
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2 tracking-wide">
                      NOMBRE COMPLETO *
                    </label>
                    <input
                      type="text"
                      name="nombre"
                      value={formData.nombre}
                      onChange={handleInputChangeWithClear}
                      className={`w-full px-4 py-3 border bg-white text-gray-900 focus:ring-1 font-light rounded-none placeholder-gray-400 ${hasFieldError('nombre') ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-gray-900 focus:ring-gray-900'}`}
                      placeholder="Ingresa tu nombre completo"
                      required
                    />
                    {getFieldError('nombre') && <p className="text-xs text-red-500 mt-1">{getFieldError('nombre')!.message}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2 tracking-wide">
                      TELÉFONO / WHATSAPP *
                    </label>
                    <input
                      type="tel"
                      name="telefono"
                      value={formData.telefono}
                      onChange={handleInputChangeWithClear}
                      className={`w-full px-4 py-3 border bg-white text-gray-900 focus:ring-1 font-light rounded-none placeholder-gray-400 ${hasFieldError('telefono') ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-gray-900 focus:ring-gray-900'}`}
                      placeholder="Ej: 3001234567"
                      required
                    />
                    {getFieldError('telefono') && <p className="text-xs text-red-500 mt-1">{getFieldError('telefono')!.message}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2 tracking-wide">
                      CORREO ELECTRÓNICO *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChangeWithClear}
                      className={`w-full px-4 py-3 border bg-white text-gray-900 focus:ring-1 font-light rounded-none placeholder-gray-400 ${hasFieldError('email') ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-gray-900 focus:ring-gray-900'}`}
                      placeholder="ejemplo@correo.com"
                      required
                    />
                    {getFieldError('email') && <p className="text-xs text-red-500 mt-1">{getFieldError('email')!.message}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2 tracking-wide">
                      CÉDULA / DOCUMENTO *
                    </label>
                    <input
                      type="text"
                      name="cedula"
                      value={formData.cedula}
                      onChange={handleInputChangeWithClear}
                      className={`w-full px-4 py-3 border bg-white text-gray-900 focus:ring-1 font-light rounded-none placeholder-gray-400 ${hasFieldError('cedula') ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-gray-900 focus:ring-gray-900'}`}
                      placeholder="Número de documento"
                      required
                    />
                    {getFieldError('cedula') && <p className="text-xs text-red-500 mt-1">{getFieldError('cedula')!.message}</p>}
                  </div>
                </div>
              </div>

              {/* Datos de Envío */}
              <div>
                <h2 className="text-xs font-bold tracking-widest text-gray-900 uppercase mb-6 pb-3 border-b border-gray-100">
                  Información de Entrega
                </h2>
                <div className="space-y-5">
                  {isDeliveryOrder ? (
                    /* ── Domicilio: usar GPS ── */
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2 tracking-wide">
                        UBICACIÓN DE ENTREGA
                      </label>
                      {detectedAddress ? (
                        <div className="flex items-center justify-between px-4 py-3 border border-green-300 bg-green-50">
                          <div className="flex items-center gap-2 min-w-0">
                            <MapPin className="h-4 w-4 text-green-600 flex-shrink-0" />
                            <span className="text-sm text-green-800 font-light truncate">{detectedAddress}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => { setDetectedAddress(null); fireChange('departamento', ''); fireChange('municipio', ''); }}
                            className="ml-3 text-xs text-green-600 hover:text-red-500 transition-colors flex-shrink-0"
                          >
                            Cambiar
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleUseMyLocation}
                          disabled={isLocatingAddress}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-60 transition-colors"
                        >
                          {isLocatingAddress ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <Navigation className="h-5 w-5" />
                          )}
                          <span className="font-medium text-sm">
                            {isLocatingAddress ? 'Detectando ubicación...' : 'Usar mi ubicación'}
                          </span>
                        </button>
                      )}
                      {locationError && <p className="text-xs text-red-500 mt-1">{locationError}</p>}
                    </div>
                  ) : (
                    /* ── Envío normal: seleccionar depto/municipio ── */
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-2 tracking-wide">
                          DEPARTAMENTO *
                        </label>
                        <select
                          name="departamento"
                          value={formData.departamento}
                          onChange={handleInputChangeWithClear}
                          className={`w-full px-4 py-3 border bg-white text-gray-900 focus:ring-1 font-light rounded-none ${hasFieldError('departamento') ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-gray-900 focus:ring-gray-900'}`}
                          required
                        >
                          <option value="">Selecciona departamento</option>
                          {Object.keys(departamentosMunicipios).map(dep => (
                            <option key={dep} value={dep}>{dep}</option>
                          ))}
                        </select>
                        {getFieldError('departamento') && <p className="text-xs text-red-500 mt-1">{getFieldError('departamento')!.message}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-2 tracking-wide">
                          MUNICIPIO *
                        </label>
                        <select
                          name="municipio"
                          value={formData.municipio}
                          onChange={handleInputChangeWithClear}
                          className={`w-full px-4 py-3 border bg-white text-gray-900 focus:ring-1 font-light rounded-none disabled:bg-gray-100 disabled:text-gray-500 ${hasFieldError('municipio') ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-gray-900 focus:ring-gray-900'}`}
                          required
                          disabled={!formData.departamento}
                        >
                          <option value="">{formData.departamento ? 'Selecciona municipio' : 'Primero selecciona departamento'}</option>
                          {formData.departamento && departamentosMunicipios[formData.departamento]?.map(mun => (
                            <option key={mun} value={mun}>{mun}</option>
                          ))}
                        </select>
                        {getFieldError('municipio') && <p className="text-xs text-red-500 mt-1">{getFieldError('municipio')!.message}</p>}
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2 tracking-wide">
                      DIRECCIÓN DE ENTREGA *
                    </label>
                    <input
                      type="text"
                      name="direccion"
                      value={formData.direccion}
                      onChange={handleInputChangeWithClear}
                      className={`w-full px-4 py-3 border bg-white text-gray-900 focus:ring-1 font-light rounded-none placeholder-gray-400 ${hasFieldError('direccion') ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-gray-900 focus:ring-gray-900'}`}
                      placeholder="Calle, carrera, número..."
                      required
                    />
                    {getFieldError('direccion') && <p className="text-xs text-red-500 mt-1">{getFieldError('direccion')!.message}</p>}
                  </div>

                  {/* Mapa de ubicación — solo para domicilios y tras detectar ubicación */}
                  {isDeliveryOrder && onLocationChange && detectedAddress && (
                    <div className="mt-2">
                      <LocationPicker
                        latitude={deliveryLatitude ?? null}
                        longitude={deliveryLongitude ?? null}
                        onChange={onLocationChange}
                        hideButton={true}
                        readOnly={true}
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2 tracking-wide">
                      BARRIO
                    </label>
                    <input
                      type="text"
                      name="barrio"
                      value={formData.barrio}
                      onChange={handleInputChangeWithClear}
                      className="w-full px-4 py-3 border border-gray-300 bg-white text-gray-900 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 font-light rounded-none placeholder-gray-400"
                      placeholder="Nombre del barrio"
                    />
                  </div>
                </div>
              </div>
            </div>

          {/* Columna derecha - Resumen */}
          <div className="bg-white border border-gray-200 p-6 sticky top-4">
            <h2 className="text-xs font-bold tracking-widest text-gray-900 uppercase mb-6 pb-3 border-b border-gray-100">
              Tu Pedido
            </h2>
            <div className="space-y-6">
                {carrito.map((item, index) => (
                  <div key={`${item.id}-${item.tallaSeleccionada || ''}-${item.colorSeleccionado || ''}-${index}`} className="pb-6 border-b border-gray-100 last:border-0">
                    <div className="flex gap-3 mb-2">
                      {/* Imagen del producto */}
                      <div className="w-16 h-16 flex-shrink-0 border border-gray-100 overflow-hidden bg-gray-50">
                        {item.imagen ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.imagen} alt={item.nombre} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package size={20} className="text-gray-300" />
                          </div>
                        )}
                      </div>
                      {/* Nombre + variantes + eliminar */}
                      <div className="flex-1 min-w-0 flex justify-between items-start">
                        <div className="min-w-0">
                          <div className="font-light text-gray-900 text-sm leading-snug">{item.nombre}</div>
                          {item.isPreorder && (
                            <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold mt-0.5">
                              {item.preorderBadgeText || 'Pre-orden'}
                            </span>
                          )}
                          {(item.tallaSeleccionada || item.colorSeleccionado) && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              {item.tallaSeleccionada && <span>Talla: {item.tallaSeleccionada}</span>}
                              {item.tallaSeleccionada && item.colorSeleccionado && <span> / </span>}
                              {item.colorSeleccionado && <span>Color: {item.colorSeleccionado}</span>}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => onRemoverProducto(item)}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 ml-2"
                          title="Eliminar producto"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center pl-19">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => onActualizarCantidad(item.id, -1, item.tempId)}
                          className="w-8 h-8 border border-gray-300 bg-white text-gray-700 flex items-center justify-center hover:bg-gray-100 hover:border-gray-900 transition-colors"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="font-medium text-sm w-8 text-center text-gray-900">{item.cantidad}</span>
                        <button
                          onClick={() => onActualizarCantidad(item.id, 1, item.tempId)}
                          className="w-8 h-8 border border-gray-300 bg-white text-gray-700 flex items-center justify-center hover:bg-gray-100 hover:border-gray-900 transition-colors"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500 font-light mb-1 flex items-center justify-end gap-1">
                          <span>{formatCOP(item.precio)} c/u</span>
                          {item.precioOriginal && item.precioOriginal > item.precio && (
                            <span className="line-through text-gray-300">{formatCOP(item.precioOriginal)}</span>
                          )}
                        </div>
                        {item.descuentoPorcentaje && item.descuentoPorcentaje > 0 && (
                          <div className="text-[10px] text-green-600 mb-0.5">-{item.descuentoPorcentaje}% dto.</div>
                        )}
                        <div className="font-light text-gray-900">
                          {formatCOP(item.precio * item.cantidad)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* ====== ORDER BUMP / CROSS-SELL ====== */}
                {orderBumpProducts.length > 0 && onAddBumpProduct && (
                  <div className="pt-4 border-t border-amber-200">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                        {orderBumpTitle}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {orderBumpProducts.map(bp => {
                        const isAdded = addedBumpIds.has(bp.id);
                        const displayPrice = (bp.isOnOffer && bp.offerPrice) ? bp.offerPrice : bp.salePrice;
                        const hasDiscount = !!(bp.isOnOffer && bp.offerPrice && bp.offerPrice < bp.salePrice);
                        return (
                          <div
                            key={bp.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                              isAdded
                                ? 'border-green-300 bg-green-50'
                                : 'border-amber-200 bg-amber-50/60 hover:bg-amber-50'
                            }`}
                          >
                            {bp.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={bp.imageUrl}
                                alt={bp.name}
                                className="h-12 w-12 object-cover rounded flex-shrink-0"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded bg-amber-100 flex items-center justify-center flex-shrink-0">
                                <Package className="h-6 w-6 text-amber-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 line-clamp-1">{bp.name}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-sm font-semibold text-amber-700">
                                  {formatCOP(displayPrice)}
                                </span>
                                {hasDiscount && (
                                  <span className="text-xs text-gray-400 line-through">{formatCOP(bp.salePrice)}</span>
                                )}
                              </div>
                              {bp.offerLabel && (
                                <span className="text-xs text-orange-600 font-medium">{bp.offerLabel}</span>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                if (!isAdded) {
                                  setAddedBumpIds(prev => new Set(prev).add(bp.id));
                                  onAddBumpProduct(bp);
                                }
                              }}
                              disabled={isAdded}
                              className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                                isAdded
                                  ? 'bg-green-500 text-white cursor-default'
                                  : 'bg-amber-500 hover:bg-amber-600 text-white'
                              }`}
                            >
                              {isAdded ? (
                                <><Check className="w-3.5 h-3.5" /> Añadido</>
                              ) : (
                                <><ShoppingCart className="w-3.5 h-3.5" /> Añadir</>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Cupón de descuento */}
                {onValidarCupon && (
                  <div className="pt-6 border-t border-gray-200">
                    <label className="block text-xs font-medium text-gray-700 mb-2 tracking-wide">
                      CUPÓN DE DESCUENTO
                    </label>
                    {cuponAplicado?.valido ? (
                      <div className="flex items-center justify-between bg-green-50 border border-green-200 p-3 rounded">
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-600" />
                          <span className="text-sm text-green-700 font-medium">{cuponCodigo}</span>
                          <span className="text-xs text-green-600">-{formatCOP(descuentoAplicado)}</span>
                        </div>
                        <button
                          onClick={handleRemoverCupon}
                          className="p-1 text-green-600 hover:text-red-500 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Ticket className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={inputCupon}
                            onChange={(e) => {
                              setInputCupon(e.target.value.toUpperCase());
                              setErrorCupon('');
                            }}
                            placeholder="Código de cupón"
                            className="w-full pl-9 pr-4 py-2 border border-gray-300 bg-white text-gray-900 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 font-light text-sm rounded-none"
                          />
                        </div>
                        <button
                          onClick={handleValidarCupon}
                          disabled={validandoCupon || !inputCupon.trim()}
                          className="px-4 py-2 bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                        >
                          {validandoCupon ? <Loader2 className="w-4 h-4 animate-spin" /> : 'APLICAR'}
                        </button>
                      </div>
                    )}
                    {errorCupon && (
                      <p className="text-xs text-red-500 mt-1">{errorCupon}</p>
                    )}
                  </div>
                )}

                <div className="pt-6 border-t border-gray-300">
                  {(descuentoAplicado > 0 || deliveryFee > 0) && (
                    <>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-light text-gray-600">Subtotal</span>
                        <span className="text-sm font-light text-gray-600">{formatCOP(totalCarrito)}</span>
                      </div>
                      {descuentoAplicado > 0 && (
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-light text-green-600">Descuento</span>
                          <span className="text-sm font-light text-green-600">-{formatCOP(descuentoAplicado)}</span>
                        </div>
                      )}
                      {deliveryFee > 0 && (
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-light text-gray-600 flex items-center gap-1">
                            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h7M13 16l2 2h5l2-2V9a1 1 0 00-1-1h-5a1 1 0 00-1 1v7z" />
                            </svg>
                            Costo de domicilio
                          </span>
                          <span className="text-sm font-light text-gray-900">+{formatCOP(deliveryFee)}</span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-light tracking-wide text-gray-600">TOTAL</span>
                    <span className="text-xl font-light text-gray-900">{formatCOP(totalFinal)}</span>
                  </div>
                </div>

                {/* ── Banner domicilio gratis ── */}
                {isDeliveryOrder && freeDeliveryMin > 0 && (() => {
                  const unlocked = totalCarrito >= freeDeliveryMin
                  const progress = Math.min(100, (totalCarrito / freeDeliveryMin) * 100)
                  const remaining = Math.max(0, freeDeliveryMin - totalCarrito)
                  return (
                    <div className={`mt-4 rounded-lg p-3 border ${unlocked ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <svg className={`w-3.5 h-3.5 flex-shrink-0 ${unlocked ? 'text-emerald-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h7M13 16l2 2h5l2-2V9a1 1 0 00-1-1h-5a1 1 0 00-1 1v7z" />
                          </svg>
                          {unlocked ? (
                            <span className="text-xs font-semibold text-emerald-600">¡Domicilio gratis desbloqueado!</span>
                          ) : (
                            <span className="text-xs text-gray-500">
                              Agrega <strong className="text-gray-800">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(remaining)}</strong> más para domicilio gratis
                            </span>
                          )}
                        </div>
                        <span className={`text-[10px] font-bold ml-2 shrink-0 ${unlocked ? 'text-emerald-600' : 'text-gray-400'}`}>
                          {Math.round(progress)}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden bg-gray-200">
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${progress}%`, backgroundColor: unlocked ? '#10b981' : '#111827' }}
                        />
                      </div>
                    </div>
                  )
                })()}

                <div className="mt-8">
                  <label className="block text-xs font-medium text-gray-700 mb-2 tracking-wide">
                    NOTAS ADICIONALES
                  </label>
                  <textarea
                    name="notas"
                    value={formData.notas}
                    onChange={handleInputChangeWithClear}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 bg-white text-gray-900 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 font-light text-sm resize-none rounded-none placeholder-gray-400"
                    placeholder="Instrucciones especiales, preferencias de entrega..."
                  />
                </div>

                {/* ── Selector de método de pago ── */}
                {!isDeliveryOrder && (
                  <div className="mt-8">
                    <h3 className="text-xs font-medium text-gray-700 mb-3 tracking-wide">
                      MÉTODO DE PAGO
                    </h3>
                    <div className="space-y-2">

                      {/* Contra entrega */}
                      {allowContraentrega && (
                      <label className={`flex items-center gap-3 p-3 border cursor-pointer transition-colors ${paymentMethod === 'contraentrega' ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-400'}`}>
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="contraentrega"
                          checked={paymentMethod === 'contraentrega'}
                          onChange={() => setPaymentMethod('contraentrega')}
                          className="accent-gray-900 shrink-0"
                        />
                        {/* Cash icon */}
                        <svg viewBox="0 0 48 48" className="w-10 h-10 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect width="48" height="48" rx="6" fill="#F3F4F6"/>
                          <rect x="8" y="15" width="32" height="18" rx="3" fill="#6B7280"/>
                          <circle cx="24" cy="24" r="5" fill="#E5E7EB"/>
                          <rect x="8" y="15" width="5" height="5" rx="1" fill="#9CA3AF"/>
                          <rect x="35" y="28" width="5" height="5" rx="1" fill="#9CA3AF"/>
                        </svg>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-gray-900">Contra entrega</span>
                          <p className="text-xs text-gray-500 font-light mt-0.5">Paga en efectivo cuando recibas tu pedido</p>
                        </div>
                      </label>
                      )}

                      {/* MercadoPago */}
                      {onPagarEnLinea && (
                        <label className={`flex items-center gap-3 p-3 border cursor-pointer transition-colors ${paymentMethod === 'mercadopago' ? 'border-[#009ee3] bg-sky-50' : 'border-gray-200 hover:border-gray-400'}`}>
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="mercadopago"
                            checked={paymentMethod === 'mercadopago'}
                            onChange={() => setPaymentMethod('mercadopago')}
                            className="shrink-0"
                            style={{ accentColor: '#009ee3' }}
                          />
                          {/* MercadoPago logo SVG */}
                          <svg viewBox="0 0 48 48" className="w-10 h-10 shrink-0" xmlns="http://www.w3.org/2000/svg">
                            <rect width="48" height="48" rx="6" fill="#009ee3"/>
                            <path d="M8 24c0-8.837 7.163-16 16-16s16 7.163 16 16-7.163 16-16 16S8 32.837 8 24z" fill="#009ee3"/>
                            <path d="M24 11c-7.18 0-13 5.82-13 13 0 3.906 1.726 7.408 4.463 9.823L24 24.5l8.537 9.323C35.274 31.408 37 27.906 37 24c0-7.18-5.82-13-13-13z" fill="#fff" fillOpacity=".25"/>
                            <text x="24" y="28" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="13" fill="#fff" letterSpacing="-0.5">mp</text>
                          </svg>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-gray-900">Mercado Pago</span>
                              <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 font-bold rounded shrink-0">10% DCTO</span>
                            </div>
                            <p className="text-xs text-gray-500 font-light mt-0.5">Tarjeta de crédito, débito o PSE</p>
                          </div>
                          {/* Card network mini-icons */}
                          <div className="flex gap-1 shrink-0">
                            <svg viewBox="0 0 32 20" className="w-8 h-5" xmlns="http://www.w3.org/2000/svg">
                              <rect width="32" height="20" rx="3" fill="#1A1F71"/>
                              <text x="16" y="14" textAnchor="middle" fontFamily="Arial" fontWeight="900" fontSize="8" fill="#fff" letterSpacing="0.5">VISA</text>
                            </svg>
                            <svg viewBox="0 0 32 20" className="w-8 h-5" xmlns="http://www.w3.org/2000/svg">
                              <rect width="32" height="20" rx="3" fill="#fff" stroke="#e5e7eb" strokeWidth="1"/>
                              <circle cx="12" cy="10" r="6" fill="#EB001B"/>
                              <circle cx="20" cy="10" r="6" fill="#F79E1B"/>
                              <path d="M16 5.27A6 6 0 0118.73 10 6 6 0 0116 14.73 6 6 0 0113.27 10 6 6 0 0116 5.27z" fill="#FF5F00"/>
                            </svg>
                          </div>
                        </label>
                      )}

                      {/* ADDI */}
                      {onPagarConAddi && (
                        <label className={`flex items-center gap-3 p-3 border cursor-pointer transition-colors ${paymentMethod === 'addi' ? 'border-[#FF5E00] bg-orange-50' : 'border-gray-200 hover:border-gray-400'}`}>
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="addi"
                            checked={paymentMethod === 'addi'}
                            onChange={() => setPaymentMethod('addi')}
                            className="shrink-0"
                            style={{ accentColor: '#FF5E00' }}
                          />
                          {/* ADDI logo SVG */}
                          <svg viewBox="0 0 48 48" className="w-10 h-10 shrink-0" xmlns="http://www.w3.org/2000/svg">
                            <rect width="48" height="48" rx="6" fill="#FF5E00"/>
                            <text x="24" y="29" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="16" fill="#fff" letterSpacing="1">addi</text>
                          </svg>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-gray-900">ADDI</span>
                              <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 font-bold rounded shrink-0">CUOTAS SIN INTERÉS</span>
                            </div>
                            <p className="text-xs text-gray-500 font-light mt-0.5">Crédito inmediato · Aprobación al instante</p>
                          </div>
                        </label>
                      )}

                      {/* Sistecredito */}
                      {onPagarConSistecredito && (
                        <label className={`flex items-center gap-3 p-3 border cursor-pointer transition-colors ${paymentMethod === 'sistecredito' ? 'border-[#1A3FA0] bg-blue-50' : 'border-gray-200 hover:border-gray-400'}`}>
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="sistecredito"
                            checked={paymentMethod === 'sistecredito'}
                            onChange={() => setPaymentMethod('sistecredito')}
                            className="shrink-0"
                            style={{ accentColor: '#1A3FA0' }}
                          />
                          {/* Sistecredito logo SVG */}
                          <svg viewBox="0 0 48 48" className="w-10 h-10 shrink-0" xmlns="http://www.w3.org/2000/svg">
                            <rect width="48" height="48" rx="6" fill="#1A3FA0"/>
                            <rect x="7" y="14" width="34" height="10" rx="2" fill="#fff" fillOpacity=".15"/>
                            <text x="24" y="23" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="7" fill="#fff" letterSpacing="0.3">siste</text>
                            <text x="24" y="34" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="9" fill="#FFD700" letterSpacing="0.2">crédito</text>
                          </svg>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-gray-900">Sistecrédito</span>
                              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 font-bold rounded shrink-0">SIN TARJETA</span>
                            </div>
                            <p className="text-xs text-gray-500 font-light mt-0.5">Compra a cuotas · Solo con tu cédula</p>
                          </div>
                        </label>
                      )}

                      {/* Wompi */}
                      {onPagarConWompi && (
                        <label className={`flex items-center gap-3 p-3 border cursor-pointer transition-colors ${paymentMethod === 'wompi' ? 'border-[#3483fa] bg-blue-50' : 'border-gray-200 hover:border-gray-400'}`}>
                          <input type="radio" name="paymentMethod" value="wompi" checked={paymentMethod === 'wompi'} onChange={() => setPaymentMethod('wompi')} className="shrink-0" style={{ accentColor: '#3483fa' }} />
                          <svg viewBox="0 0 48 48" className="w-10 h-10 shrink-0" xmlns="http://www.w3.org/2000/svg">
                            <rect width="48" height="48" rx="6" fill="#3483fa"/>
                            <text x="24" y="31" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="20" fill="#fff">W</text>
                          </svg>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-semibold text-gray-900">Wompi</span>
                            <p className="text-xs text-gray-500 font-light mt-0.5">Tarjeta, PSE, Nequi y más</p>
                          </div>
                        </label>
                      )}
                    </div>
                  </div>
                )}

                {/* Error del método de pago seleccionado */}
                {currentPaymentError && (
                  <p className="text-xs text-red-500 mt-3 text-center">{currentPaymentError}</p>
                )}

                {/* Aviso Pre-orden */}
                {(() => {
                  const preorderItems = carrito.filter(i => i.isPreorder)
                  if (preorderItems.length === 0) return null
                  const hasRegular = carrito.some(i => !i.isPreorder)
                  return (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                      <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Aviso de pre-orden</p>
                      {hasRegular && (
                        <p className="text-xs text-amber-700">
                          Tu carrito tiene productos de envío normal y pre-órdenes. Llegarán en fechas distintas.
                        </p>
                      )}
                      <ul className="space-y-1">
                        {preorderItems.map((item, i) => {
                          const range = item.preorderShipStart
                            ? (() => {
                                const fmt = (d: string) => new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
                                return item.preorderShipEnd ? `${fmt(item.preorderShipStart)} – ${fmt(item.preorderShipEnd)}` : fmt(item.preorderShipStart)
                              })()
                            : null
                          return (
                            <li key={i} className="text-xs text-amber-700">
                              <span className="font-semibold">{item.nombre}</span>
                              {range && <span className="text-amber-600"> — envío est. {range}</span>}
                            </li>
                          )
                        })}
                      </ul>
                      <p className="text-[11px] text-amber-600 leading-relaxed">
                        Al confirmar, aceptas que el envío de los ítems en pre-orden se realizará dentro del rango estimado.
                      </p>
                    </div>
                  )
                })()}

                {/* Acceso visual de pago — solo cuando hay una pasarela en línea configurada
                    (MercadoPago / Addi / Sistecrédito). No reemplaza el botón funcional. */}
                {(onPagarEnLinea || onPagarConAddi || onPagarConSistecredito) && (
                  <div className="mt-6 flex justify-center">
                    <NewTransactionButton
                      label={isDeliveryOrder ? 'Pedir domicilio' : 'Pagar en línea'}
                      onClick={() => { if (!isProcessing) (isDeliveryOrder ? handleConfirmar : handleFinalizar)() }}
                      className="nt-compact"
                      aria-label="Continuar con el pago"
                    />
                  </div>
                )}

                {/* Botón único */}
                <button
                  onClick={isDeliveryOrder ? handleConfirmar : handleFinalizar}
                  disabled={isProcessing}
                  className={`w-full font-medium py-4 transition-colors tracking-widest text-sm mt-6 disabled:bg-gray-400 disabled:cursor-not-allowed text-white flex items-center justify-center gap-2 ${
                    isDeliveryOrder ? 'bg-blue-600 hover:bg-blue-700' :
                    paymentMethod === 'mercadopago' ? 'animate-mp-shimmer animate-mp-shake' :
                    paymentMethod === 'addi' ? 'bg-[#FF5E00] hover:bg-[#e05500]' :
                    paymentMethod === 'sistecredito' ? 'bg-[#1A3FA0] hover:bg-[#142e80]' :
                    paymentMethod === 'wompi' ? 'bg-[#3483fa] hover:bg-[#2968c8]' :
                    'bg-gray-900 hover:bg-gray-700'
                  }`}
                >
                  {isProcessing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      {/* Brand mini-logo inside button */}
                      {paymentMethod === 'mercadopago' && (
                        <svg viewBox="0 0 20 20" className="w-5 h-5 shrink-0" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="10" cy="10" r="10" fill="#fff" fillOpacity=".25"/>
                          <text x="10" y="14" textAnchor="middle" fontFamily="Arial" fontWeight="800" fontSize="8" fill="#fff">mp</text>
                        </svg>
                      )}
                      {paymentMethod === 'addi' && (
                        <svg viewBox="0 0 32 20" className="w-8 h-5 shrink-0" xmlns="http://www.w3.org/2000/svg">
                          <rect width="32" height="20" rx="4" fill="#fff" fillOpacity=".25"/>
                          <text x="16" y="14" textAnchor="middle" fontFamily="Arial" fontWeight="900" fontSize="9" fill="#fff" letterSpacing="0.5">addi</text>
                        </svg>
                      )}
                      {paymentMethod === 'sistecredito' && (
                        <svg viewBox="0 0 32 20" className="w-8 h-5 shrink-0" xmlns="http://www.w3.org/2000/svg">
                          <rect width="32" height="20" rx="4" fill="#fff" fillOpacity=".2"/>
                          <text x="16" y="9" textAnchor="middle" fontFamily="Arial" fontWeight="700" fontSize="5" fill="#fff">siste</text>
                          <text x="16" y="16" textAnchor="middle" fontFamily="Arial" fontWeight="900" fontSize="6" fill="#FFD700">crédito</text>
                        </svg>
                      )}
                      <span>
                        {isDeliveryOrder ? 'PEDIR DOMICILIO' :
                          paymentMethod === 'mercadopago' ? 'PAGAR CON MERCADO PAGO' :
                          paymentMethod === 'addi' ? 'PAGAR CON ADDI' :
                          paymentMethod === 'sistecredito' ? 'PAGAR CON SISTECRÉDITO' :
                          paymentMethod === 'wompi' ? 'PAGAR CON WOMPI' :
                          'CONFIRMAR PEDIDO'}
                      </span>
                      {paymentMethod === 'mercadopago' && <Sparkles className="w-4 h-4 flex-shrink-0 opacity-80" />}
                    </>
                  )}
                </button>

                <p className="text-center text-[10px] text-gray-400 mt-2 flex items-center justify-center gap-1">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
                  Pago seguro con encriptación SSL
                </p>
              </div>
            </div>
          </div>
        </div>

      {/* Modal de Pedido Exitoso */}
      {mostrarModalExito && pedidoConfirmado && (
        mlStyle
          ? <OrderCompletedML pedido={pedidoConfirmado} onCerrar={onCerrarModal} storeName={storeName} accentColor={accentColor} />
          : <ModalExito pedido={pedidoConfirmado} onCerrar={onCerrarModal} />
      )}
    </div>
  );
}
