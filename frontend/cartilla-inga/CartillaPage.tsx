'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Loader2, ArrowLeft, FileText, Download, Paperclip, ShieldCheck, User, Mail, Phone } from 'lucide-react';
import CartillaIngaDigital from './CartillaIngaDigital';
import { cartillasAPI, estaLogueado, ApiError, type CartillaCatalogoAPI } from './services/api';
import { BoxLoader } from '@/components/box-loader';

const formatPrecio = (precio: number, moneda: string) => {
  try {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: moneda || 'COP', maximumFractionDigits: 0 }).format(precio);
  } catch { return `${moneda} ${precio.toLocaleString('es-CO')}`; }
};

/** Lista de archivos descargables. Si `url` → descarga; si no → bloqueado (al comprar). */
const ArchivosPanel: React.FC<{ archivos?: CartillaCatalogoAPI['archivos']; titulo?: string }> = ({ archivos, titulo }) => {
  if (!archivos || archivos.length === 0) return null;
  return (
    <div className="text-left">
      {titulo && <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{titulo}</p>}
      <div className="space-y-2">
        {archivos.map(f => (
          <div key={f.id} className="flex items-center gap-3 bg-gray-50 border rounded-lg px-3 py-2.5">
            <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{f.nombre}</p>
              <p className="text-[11px] text-gray-400 uppercase">{f.tipo || 'archivo'}{f.sizeBytes ? ` · ${(f.sizeBytes / 1024 / 1024).toFixed(2)} MB` : ''}</p>
            </div>
            {f.url
              ? <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-emerald-700 inline-flex items-center gap-1 text-xs font-semibold shrink-0"><Download className="w-4 h-4" /> Descargar</a>
              : <span className="text-gray-400 inline-flex items-center gap-1 text-xs shrink-0"><Lock className="w-3.5 h-3.5" /> Al comprar</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

/** Widget flotante de descargas, visible sobre la experiencia cuando el usuario tiene acceso. */
const FloatingDescargables: React.FC<{ archivos?: CartillaCatalogoAPI['archivos'] }> = ({ archivos }) => {
  const [open, setOpen] = useState(false);
  const conUrl = (archivos || []).filter(f => f.url);
  if (conUrl.length === 0) return null;
  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="mb-3 w-72 max-h-[60vh] overflow-auto bg-white rounded-2xl shadow-2xl border p-3">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Archivos descargables</p>
          <ArchivosPanel archivos={conUrl} />
        </div>
      )}
      <button onClick={() => setOpen(o => !o)} className="inline-flex items-center gap-2 bg-emerald-600 text-white rounded-full px-4 py-3 shadow-lg font-semibold hover:bg-emerald-700">
        <Paperclip className="w-4 h-4" /> Descargables ({conUrl.length})
      </button>
    </div>
  );
};

/** Formulario profesional de invitado: valida datos mínimos para Wompi y compra sin cuenta. */
const FormularioInvitado: React.FC<{ cartilla: CartillaCatalogoAPI }> = ({ cartilla }) => {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  const puede = nombre.trim().length >= 2 && emailOk && !procesando;

  const comprar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!puede) return;
    setProcesando(true); setError(null);
    try {
      const res = await cartillasAPI.comprarInvitado(cartilla.slug, { nombre: nombre.trim(), email: email.trim(), telefono: telefono.trim() || undefined });
      if (res.checkoutUrl) { window.location.href = res.checkoutUrl; return; }
      // Gratis → directo a la pantalla de éxito con el token.
      window.location.href = `/productos-digitales/exito?c=${res.token}`;
    } catch (err: any) {
      setError(err?.message || 'No se pudo iniciar la compra. Intenta de nuevo.');
      setProcesando(false);
    }
  };

  const inputCls = 'w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-sm text-gray-800';

  return (
    <form onSubmit={comprar} className="space-y-3 text-left">
      <p className="text-xs text-gray-500 text-center">Completa tus datos para pagar de forma segura. No necesitas crear una cuenta.</p>
      <div className="relative">
        <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre completo" className={inputCls} autoComplete="name" />
      </div>
      <div className="relative">
        <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Correo electrónico" type="email" className={inputCls} autoComplete="email" />
      </div>
      <div className="relative">
        <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Teléfono (opcional)" type="tel" className={inputCls} autoComplete="tel" />
      </div>

      {error && <p className="text-sm text-red-600 text-center">{error}</p>}

      <button
        type="submit"
        disabled={!puede}
        className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 transition"
      >
        {procesando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
        Comprar · {formatPrecio(cartilla.precio, cartilla.moneda)}
      </button>
      <p className="text-[11px] text-gray-400 text-center inline-flex items-center gap-1 w-full justify-center">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Pago protegido con Wompi
      </p>
    </form>
  );
};

/** Muro de pago para productos digitales de pago sin acceso. */
const Paywall: React.FC<{ cartilla: CartillaCatalogoAPI; onAcceso: () => void; onVolver: () => void }> = ({ cartilla, onAcceso, onVolver }) => {
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const logueado = estaLogueado();

  const adquirir = async (metodo: string) => {
    setProcesando(true); setMensaje(null);
    try {
      const res = await cartillasAPI.comprar(cartilla.slug, metodo);
      if (res.acceso) { onAcceso(); return; }
      if (res.checkoutUrl) { window.location.href = res.checkoutUrl; return; }
      setMensaje('Tu solicitud quedó registrada. El comercio confirmará el pago y se habilitará tu acceso.');
    } catch (e: any) {
      setMensaje(e instanceof ApiError && e.isUnauthorized
        ? 'Inicia sesión para adquirir esta cartilla.'
        : (e?.message || 'No se pudo procesar la compra.'));
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center px-4 py-10">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-[0_20px_60px_-20px_rgba(16,185,129,0.4)] border border-gray-100 overflow-hidden">
        {/* Cabecera premium */}
        <div className="bg-gradient-to-br from-emerald-600 to-green-700 px-8 pt-7 pb-8 text-center text-white relative">
          <button onClick={onVolver} className="absolute left-4 top-4 text-white/80 hover:text-white inline-flex items-center gap-1 text-sm">
            <ArrowLeft className="w-4 h-4" /> Catálogo
          </button>
          <div className="w-14 h-14 mx-auto rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center mb-3">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-extrabold leading-tight">{cartilla.titulo}</h2>
          {cartilla.autor && <p className="text-sm text-white/80 mt-0.5">por {cartilla.autor}</p>}
          <div className="mt-4"><span className="text-3xl font-extrabold">{formatPrecio(cartilla.precio, cartilla.moneda)}</span></div>
        </div>

        <div className="p-8 text-center">
          {cartilla.descripcion && <p className="text-gray-600 text-sm mb-5">{cartilla.descripcion}</p>}

          {logueado ? (
            <div className="space-y-2">
              <button
                disabled={procesando}
                onClick={() => adquirir('wompi')}
                className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {procesando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Comprar y pagar con Wompi
              </button>
              <button
                disabled={procesando}
                onClick={() => adquirir('manual')}
                className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 disabled:opacity-60"
              >
                Solicitar acceso al comercio
              </button>
              {mensaje && <p className="mt-4 text-sm text-gray-600">{mensaje}</p>}
            </div>
          ) : (
            // Invitado: solo compra (sin "solicitar acceso"), con formulario para Wompi.
            <FormularioInvitado cartilla={cartilla} />
          )}

          {cartilla.archivos && cartilla.archivos.length > 0 && (
            <div className="mt-6 pt-5 border-t">
              <ArchivosPanel
                archivos={cartilla.archivos}
                titulo={`Incluye ${cartilla.archivos.length} archivo${cartilla.archivos.length > 1 ? 's' : ''} descargable${cartilla.archivos.length > 1 ? 's' : ''}`}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const CartillaPage: React.FC<{ slug: string }> = ({ slug }) => {
  const router = useRouter();
  const [cartilla, setCartilla] = useState<CartillaCatalogoAPI | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setCartilla(await cartillasAPI.obtener(slug));
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar la cartilla');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { cargar(); }, [cargar]);

  const volver = () => router.push('/productos-digitales');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]" style={{ ['--dz-bg' as any]: '#f5f5f5' }}>
        <BoxLoader />
      </div>
    );
  }
  if (error || !cartilla) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F5F5] gap-3 px-4 text-center">
        <p className="text-gray-700">{error || 'Cartilla no encontrada'}</p>
        <button onClick={volver} className="text-emerald-700 font-medium">← Volver al catálogo</button>
      </div>
    );
  }

  // Gratis o ya con acceso → experiencia completa. De pago sin acceso → muro.
  if (!cartilla.esGratis && !cartilla.acceso) {
    return <Paywall cartilla={cartilla} onAcceso={cargar} onVolver={volver} />;
  }

  return (
    <>
      <FloatingDescargables archivos={cartilla.archivos} />
      <CartillaIngaDigital cartillaSlug={cartilla.slug} onVolverCatalogo={volver} />
    </>
  );
};

export default CartillaPage;
