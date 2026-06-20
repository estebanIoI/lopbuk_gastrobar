'use client'

/**
 * CheckoutWizardML — checkout guiado por pasos estilo Mercado Libre.
 * Se usa en lugar del CheckoutView de una sola página cuando el tema ML está
 * activo. Reusa los mismos callbacks (validación, cupón, pasarelas) que ya viven
 * en el storefront, presentados como pasos:
 *   1) Tus datos  2) Forma de entrega  3) Cuándo llega  4) Cómo pagar → Pedido completado.
 */
import { useState } from 'react'
import {
  ArrowLeft, ChevronRight, MapPin, Navigation, Loader2, Ticket, X, Check,
  Truck, ShieldCheck, Package, Pencil,
} from 'lucide-react'
import { LocationPicker } from '@/components/checkout/LocationPicker'
import { departamentosMunicipios } from '@/constants'
import { OrderCompletedML } from '@/components/theme-ml/order-completed-ml'
import type { ProductoCarrito, PedidoForm, PedidoConfirmado, CuponValidacion } from '@/types'

const COP = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v || 0)

export interface CheckoutWizardMLProps {
  carrito: ProductoCarrito[]
  totalCarrito: number
  formData: PedidoForm
  enviandoEmail: boolean
  mostrarModalExito: boolean
  pedidoConfirmado: PedidoConfirmado | null
  cuponCodigo?: string
  cuponAplicado?: CuponValidacion | null
  totalConDescuento?: number
  onValidarCupon?: (codigo: string, subtotal: number) => Promise<CuponValidacion>
  onAplicarCupon?: (codigo: string, descuento: CuponValidacion) => void
  onRemoverCupon?: () => void
  deliveryLatitude?: number | null
  deliveryLongitude?: number | null
  isDeliveryOrder?: boolean
  onLocationChange?: (lat: number, lng: number) => void
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void
  onConfirmar: () => void
  onCerrarModal: () => void
  onVolver: () => void
  onPagarEnLinea?: () => Promise<void>
  onPagarConAddi?: () => Promise<void>
  onPagarConSistecredito?: () => Promise<void>
  onPagarConWompi?: () => Promise<void>
  allowContraentrega?: boolean
  freeDeliveryMin?: number
  deliveryFee?: number
  accentColor?: string
  storeName?: string
}

type PayMethod = 'contraentrega' | 'mercadopago' | 'addi' | 'sistecredito' | 'wompi'

const fmtDate = (d: Date) => d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' })

export function CheckoutWizardML(props: CheckoutWizardMLProps) {
  const {
    carrito, totalCarrito, formData,
    enviandoEmail, mostrarModalExito, pedidoConfirmado,
    cuponCodigo = '', cuponAplicado, totalConDescuento,
    onValidarCupon, onAplicarCupon, onRemoverCupon,
    deliveryLatitude, deliveryLongitude, isDeliveryOrder = false, onLocationChange,
    onInputChange, onConfirmar, onCerrarModal, onVolver,
    onPagarEnLinea, onPagarConAddi, onPagarConSistecredito, onPagarConWompi,
    allowContraentrega = true, freeDeliveryMin = 0, deliveryFee = 0,
    accentColor = '#3483fa', storeName = 'la tienda',
  } = props

  const accent = accentColor

  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [editAddr, setEditAddr] = useState(false)

  // Cupón
  const [inputCupon, setInputCupon] = useState(cuponCodigo)
  const [validandoCupon, setValidandoCupon] = useState(false)
  const [errorCupon, setErrorCupon] = useState('')

  // GPS (domicilio)
  const [isLocating, setIsLocating] = useState(false)
  const [detectedAddress, setDetectedAddress] = useState<string | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)

  // Pago
  const defaultPayment: PayMethod = allowContraentrega ? 'contraentrega' : onPagarEnLinea ? 'mercadopago' : onPagarConAddi ? 'addi' : onPagarConSistecredito ? 'sistecredito' : 'contraentrega'
  const [payMethod, setPayMethod] = useState<PayMethod>(defaultPayment)
  const [loadingPay, setLoadingPay] = useState(false)
  const [payError, setPayError] = useState('')

  // ── Totales ──
  const totalFinal = (totalConDescuento ?? totalCarrito) + deliveryFee
  const couponDisc = cuponAplicado?.valido ? (cuponAplicado.descuento || 0) : 0
  const itemSavings = carrito.reduce((s, i) => s + Math.max(0, (i.precioOriginal ?? i.precio) - i.precio) * i.cantidad, 0)
  const ahorro = itemSavings + couponDisc

  // ── Ventana de entrega estimada ──
  const now = new Date()
  const dStart = new Date(now); dStart.setDate(now.getDate() + 2)
  const dEnd = new Date(now); dEnd.setDate(now.getDate() + 5)

  const set = (name: string, value: string) =>
    onInputChange({ target: { name, value } } as React.ChangeEvent<HTMLInputElement>)

  // ── Validación por paso ──
  const validateStep = (s: number): boolean => {
    const e: Record<string, string> = {}
    if (s === 0) {
      if (!formData.nombre?.trim()) e.nombre = 'Ingresa tu nombre'
      if (!formData.telefono?.trim() || !/^\d{7,}$/.test(formData.telefono.replace(/[\s\-+]/g, ''))) e.telefono = 'Teléfono no válido'
      if (!formData.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) e.email = 'Correo no válido'
      if (!formData.cedula?.trim()) e.cedula = 'Ingresa tu documento'
    }
    if (s === 1) {
      if (!formData.direccion?.trim()) e.direccion = 'Ingresa la dirección'
      if (!isDeliveryOrder) {
        if (!formData.departamento?.trim()) e.departamento = 'Selecciona departamento'
        if (!formData.municipio?.trim()) e.municipio = 'Selecciona municipio'
      }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const next = () => { if (validateStep(step)) setStep(s => Math.min(3, s + 1)) }
  const back = () => { if (step === 0) onVolver(); else setStep(s => s - 1) }

  // ── GPS ──
  const useMyLocation = () => {
    if (!navigator.geolocation) { setLocationError('Tu navegador no soporta geolocalización'); return }
    setIsLocating(true); setLocationError(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        onLocationChange?.(lat, lng)
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=es`)
          const data = await res.json()
          const a = data.address || {}
          const dep = a.state || a.region || ''
          const mun = a.city || a.town || a.municipality || a.county || a.village || ''
          if (dep) set('departamento', dep)
          if (mun) set('municipio', mun)
          setDetectedAddress([mun, dep].filter(Boolean).join(', ') || 'Ubicación detectada')
        } catch { setDetectedAddress('Ubicación detectada') }
        setIsLocating(false)
      },
      (err) => {
        setIsLocating(false)
        setLocationError(err.code === 1 ? 'Permiso denegado. Activa la ubicación.' : 'No se pudo obtener tu ubicación.')
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  // ── Cupón ──
  const validarCupon = async () => {
    if (!inputCupon.trim() || !onValidarCupon) return
    setValidandoCupon(true); setErrorCupon('')
    try {
      const r = await onValidarCupon(inputCupon.trim().toUpperCase(), totalCarrito)
      if (r.valido && onAplicarCupon) { onAplicarCupon(inputCupon.trim().toUpperCase(), r); setErrorCupon('') }
      else setErrorCupon(r.mensaje || 'Cupón no válido')
    } catch { setErrorCupon('Error al validar cupón') }
    finally { setValidandoCupon(false) }
  }

  // ── Pago ──
  const pagar = async () => {
    setPayError('')
    // Pasarela en línea según el método (Wompi funciona también para domicilio).
    const online =
      payMethod === 'mercadopago' ? onPagarEnLinea :
      payMethod === 'addi' ? onPagarConAddi :
      payMethod === 'wompi' ? onPagarConWompi :
      payMethod === 'sistecredito' ? onPagarConSistecredito : undefined
    if (!online) { onConfirmar(); return } // contra entrega / sin pasarela
    setLoadingPay(true)
    try { await online() }
    catch { setPayError('No se pudo iniciar el pago. Intenta de nuevo.') }
    finally { setLoadingPay(false) }
  }

  const isProcessing = loadingPay || enviandoEmail

  // ── Pedido completado ──
  if (mostrarModalExito && pedidoConfirmado) {
    return <OrderCompletedML pedido={pedidoConfirmado} onCerrar={onCerrarModal} storeName={storeName} accentColor={accent} />
  }

  const STEPS = ['Tus datos', 'Forma de entrega', 'Cuándo llega', 'Cómo pagar']
  const TITLES = ['Tus datos de contacto', 'Revisa la forma de entrega', 'Revisa cuándo llega tu compra', 'Elige cómo pagar']

  const inputCls = (field: string) =>
    `w-full px-3 py-2.5 text-sm rounded-lg border bg-white focus:outline-none ${errors[field] ? 'border-red-400' : 'border-[#e6e6e6] focus:border-[var(--mlw)]'}`

  // Nota: función (no componente <Field/>) para no remontar el input y perder el foco al teclear.
  const field = ({ label, name, type = 'text', placeholder }: { label: string; name: keyof PedidoForm; type?: string; placeholder?: string }) => (
    <div key={name}>
      <label className="block text-xs font-medium text-[#666] mb-1">{label}</label>
      <input
        type={type}
        name={name}
        value={formData[name] || ''}
        onChange={(e) => { onInputChange(e); if (errors[name]) setErrors(p => { const n = { ...p }; delete n[name]; return n }) }}
        placeholder={placeholder}
        className={inputCls(name)}
      />
      {errors[name] && <p className="text-xs text-red-500 mt-1">{errors[name]}</p>}
    </div>
  )

  return (
    <div className="fixed inset-0 z-[150] bg-[#ededed] overflow-y-auto" style={{ ['--mlw' as string]: accent } as React.CSSProperties}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#e6e6e6]">
        <div className="mx-auto max-w-xl px-4 py-3 flex items-center gap-3">
          <button onClick={back} aria-label="Atrás" className="text-[#333] hover:opacity-70"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex-1 flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span key={i} className="h-1 flex-1 rounded-full" style={{ backgroundColor: i <= step ? accent : '#e0e0e0' }} />
            ))}
          </div>
          <span className="text-xs text-[#999] tabular-nums">{step + 1}/4</span>
        </div>
      </div>

      <div className="mx-auto max-w-xl px-4 py-5 pb-40">
        <h1 className="text-xl font-light text-[#333] mb-4">{TITLES[step]}</h1>

        {/* ───────── Paso 0: Datos ───────── */}
        {step === 0 && (
          <div className="bg-white rounded-xl border border-[#e6e6e6] p-4 space-y-3">
            {field({ label: 'Nombre completo *', name: 'nombre', placeholder: 'Tu nombre' })}
            {/* Teléfono con indicativo +57 fijo: el cliente solo escribe el número */}
            <div>
              <label className="block text-xs font-medium text-[#666] mb-1">Teléfono / WhatsApp *</label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-[#e6e6e6] bg-[#f5f5f5] text-sm text-[#666] shrink-0">+57</span>
                <input
                  type="tel"
                  name="telefono"
                  inputMode="numeric"
                  value={formData.telefono || ''}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 10)
                    onInputChange({ target: { name: 'telefono', value: v } } as React.ChangeEvent<HTMLInputElement>)
                    if (errors.telefono) setErrors(p => { const n = { ...p }; delete n.telefono; return n })
                  }}
                  placeholder="300 123 4567"
                  className={`flex-1 min-w-0 px-3 py-2.5 text-sm rounded-r-lg border bg-white focus:outline-none ${errors.telefono ? 'border-red-400' : 'border-[#e6e6e6] focus:border-[var(--mlw)]'}`}
                />
              </div>
              {errors.telefono && <p className="text-xs text-red-500 mt-1">{errors.telefono}</p>}
            </div>
            {field({ label: 'Correo electrónico *', name: 'email', type: 'email', placeholder: 'ejemplo@correo.com' })}
            {field({ label: 'Cédula / Documento *', name: 'cedula', placeholder: 'Número de documento' })}
          </div>
        )}

        {/* ───────── Paso 1: Forma de entrega ───────── */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="bg-white rounded-xl border border-[#e6e6e6] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0">
                  <Truck className="w-5 h-5 shrink-0 mt-0.5" style={{ color: accent }} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#333]">{isDeliveryOrder ? 'Enviar a domicilio' : 'Envío a tu dirección'}</p>
                    <p className="text-xs text-[#666] mt-0.5 break-words">
                      {[formData.direccion, formData.barrio, formData.municipio, formData.departamento].filter(Boolean).join(', ') || 'Aún sin dirección'}
                    </p>
                  </div>
                </div>
                <span className="text-sm text-[#333] shrink-0">{deliveryFee > 0 ? COP(deliveryFee) : 'Gratis'}</span>
              </div>
              <button onClick={() => setEditAddr(v => !v)} className="mt-2 text-xs font-medium inline-flex items-center gap-1" style={{ color: accent }}>
                <Pencil className="w-3 h-3" /> Modificar domicilio o elegir otro
              </button>
            </div>

            {(editAddr || !formData.direccion) && (
              <div className="bg-white rounded-xl border border-[#e6e6e6] p-4 space-y-3">
                {isDeliveryOrder ? (
                  <div>
                    <label className="block text-xs font-medium text-[#666] mb-1">Ubicación</label>
                    {detectedAddress ? (
                      <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-green-300 bg-green-50">
                        <span className="text-sm text-green-800 truncate flex items-center gap-1.5"><MapPin className="w-4 h-4" />{detectedAddress}</span>
                        <button onClick={() => { setDetectedAddress(null); set('departamento', ''); set('municipio', '') }} className="text-xs text-green-700">Cambiar</button>
                      </div>
                    ) : (
                      <button onClick={useMyLocation} disabled={isLocating} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 border-dashed text-sm" style={{ borderColor: accent, color: accent }}>
                        {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                        {isLocating ? 'Detectando…' : 'Usar mi ubicación'}
                      </button>
                    )}
                    {locationError && <p className="text-xs text-red-500 mt-1">{locationError}</p>}
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-[#666] mb-1">Departamento *</label>
                      <select name="departamento" value={formData.departamento} onChange={(e) => { onInputChange(e); set('municipio', '') }} className={inputCls('departamento')}>
                        <option value="">Selecciona departamento</option>
                        {Object.keys(departamentosMunicipios).map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      {errors.departamento && <p className="text-xs text-red-500 mt-1">{errors.departamento}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#666] mb-1">Municipio *</label>
                      <select name="municipio" value={formData.municipio} onChange={onInputChange} disabled={!formData.departamento} className={inputCls('municipio')}>
                        <option value="">{formData.departamento ? 'Selecciona municipio' : 'Primero el departamento'}</option>
                        {formData.departamento && departamentosMunicipios[formData.departamento]?.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      {errors.municipio && <p className="text-xs text-red-500 mt-1">{errors.municipio}</p>}
                    </div>
                  </>
                )}
                {field({ label: 'Dirección de entrega *', name: 'direccion', placeholder: 'Calle, carrera, número…' })}
                {field({ label: 'Barrio', name: 'barrio', placeholder: 'Nombre del barrio' })}
                {isDeliveryOrder && onLocationChange && detectedAddress && (
                  <LocationPicker latitude={deliveryLatitude ?? null} longitude={deliveryLongitude ?? null} onChange={onLocationChange} hideButton readOnly />
                )}
              </div>
            )}
          </div>
        )}

        {/* ───────── Paso 2: Cuándo llega ───────── */}
        {step === 2 && (
          <div className="space-y-3">
            <p className="text-xs text-[#666] flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Envío a {[formData.municipio, formData.departamento].filter(Boolean).join(', ') || 'tu dirección'}</p>
            <div className="bg-white rounded-xl border border-[#e6e6e6] p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-[#333] mb-2">
                <Package className="w-4 h-4" style={{ color: '#00a650' }} /> Envío 1 <span className="text-[#00a650] font-semibold">FULL</span>
              </div>
              <label className="flex items-center justify-between gap-3 rounded-lg border p-3" style={{ borderColor: accent }}>
                <span className="flex items-center gap-2 text-sm text-[#333]">
                  <span className="w-4 h-4 rounded-full border-2 flex items-center justify-center" style={{ borderColor: accent }}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accent }} />
                  </span>
                  Entre el {fmtDate(dStart)} y el {fmtDate(dEnd)}
                </span>
                <span className="text-sm font-medium text-[#333]">{deliveryFee > 0 ? COP(deliveryFee) : 'Gratis'}</span>
              </label>
              {freeDeliveryMin > 0 && totalCarrito < freeDeliveryMin && (
                <p className="text-xs text-[#666] mt-2">Agrega {COP(freeDeliveryMin - totalCarrito)} más para envío gratis.</p>
              )}
            </div>
          </div>
        )}

        {/* ───────── Paso 3: Cómo pagar ───────── */}
        {step === 3 && (
          <div className="space-y-3">
            <div className="bg-white rounded-xl border border-[#e6e6e6] divide-y divide-[#f0f0f0] overflow-hidden">
              {([
                allowContraentrega && { id: 'contraentrega' as PayMethod, name: 'Pago contra entrega', desc: 'Paga en efectivo al recibir', color: '#6B7280' },
                onPagarEnLinea && { id: 'mercadopago' as PayMethod, name: 'Tarjeta / PSE (Mercado Pago)', desc: '10% de descuento', color: '#009ee3' },
                onPagarConAddi && { id: 'addi' as PayMethod, name: 'ADDI · Cuotas sin interés', desc: 'Aprobación inmediata', color: '#FF5E00' },
                onPagarConSistecredito && { id: 'sistecredito' as PayMethod, name: 'Sistecrédito · Solo con cédula', desc: 'Compra a cuotas sin tarjeta', color: '#1A3FA0' },
                onPagarConWompi && { id: 'wompi' as PayMethod, name: 'Pagar con Wompi', desc: 'Tarjeta, PSE, Nequi y más', color: '#3483fa' },
              ].filter(Boolean) as { id: PayMethod; name: string; desc: string; color: string }[]).map(m => (
                <button key={m.id} onClick={() => setPayMethod(m.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#fafafa]">
                  <span className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: m.color }}>
                    {m.id === 'mercadopago' ? 'PSE' : m.id === 'contraentrega' ? '$' : m.id.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-[#333]">{m.name}</span>
                    <span className="block text-xs text-[#999]">{m.desc}</span>
                  </span>
                  <span className="w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center" style={{ borderColor: payMethod === m.id ? accent : '#ccc' }}>
                    {payMethod === m.id && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accent }} />}
                  </span>
                </button>
              ))}
            </div>
            {payError && <p className="text-xs text-red-500">{payError}</p>}

            {/* Cupón */}
            {onValidarCupon && (
              <div className="bg-white rounded-xl border border-[#e6e6e6] p-4">
                {cuponAplicado?.valido ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-green-700 flex items-center gap-1.5"><Check className="w-4 h-4" />{cuponCodigo} · -{COP(couponDisc)}</span>
                    <button onClick={() => { setInputCupon(''); setErrorCupon(''); onRemoverCupon?.() }} className="text-[#999] hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Ticket className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ccc]" />
                        <input value={inputCupon} onChange={(e) => { setInputCupon(e.target.value.toUpperCase()); setErrorCupon('') }} placeholder="Ingresar código de cupón" className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-[#e6e6e6] focus:outline-none focus:border-[var(--mlw)]" />
                      </div>
                      <button onClick={validarCupon} disabled={validandoCupon || !inputCupon.trim()} className="px-4 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: accent }}>
                        {validandoCupon ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aplicar'}
                      </button>
                    </div>
                    {errorCupon && <p className="text-xs text-red-500 mt-1">{errorCupon}</p>}
                  </>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-[#999] justify-center">
              <ShieldCheck className="w-4 h-4" /> Pago protegido con encriptación SSL
            </div>
          </div>
        )}
      </div>

      {/* ── Barra inferior fija ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e6e6e6]">
        <div className="mx-auto max-w-xl px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[#666]">{step === 3 ? 'Pagas' : 'Total'}</span>
            <div className="text-right">
              {ahorro > 0 && <span className="text-xs text-[#999] line-through mr-2">{COP(totalFinal + ahorro)}</span>}
              <span className="text-lg font-semibold text-[#333]">{COP(totalFinal)}</span>
              {ahorro > 0 && <div className="text-xs text-[#00a650]">Ahorraste {COP(ahorro)}</div>}
            </div>
          </div>
          {step < 3 ? (
            <button onClick={next} className="w-full rounded-lg py-3 text-sm font-medium text-white" style={{ backgroundColor: accent }}>
              Continuar
            </button>
          ) : (
            <button onClick={pagar} disabled={isProcessing} className="w-full rounded-lg py-3 text-sm font-semibold text-white inline-flex items-center justify-center gap-2 disabled:opacity-60" style={{ backgroundColor: accent }}>
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Pagar {COP(totalFinal)}<ChevronRight className="w-4 h-4" /></>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default CheckoutWizardML
