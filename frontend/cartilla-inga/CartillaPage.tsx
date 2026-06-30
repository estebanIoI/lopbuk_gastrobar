'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Loader2, ArrowLeft, FileText, Download, Paperclip } from 'lucide-react';
import CartillaIngaDigital from './CartillaIngaDigital';
import { cartillasAPI, ApiError, type CartillaCatalogoAPI } from './services/api';
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

/** Muro de pago para cartillas de pago sin acceso. */
const Paywall: React.FC<{ cartilla: CartillaCatalogoAPI; onAcceso: () => void; onVolver: () => void }> = ({ cartilla, onAcceso, onVolver }) => {
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

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
    <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        <button onClick={onVolver} className="text-sm text-emerald-700 inline-flex items-center gap-1 mb-4">
          <ArrowLeft className="w-4 h-4" /> Catálogo
        </button>
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-4">
          <Lock className="w-7 h-7 text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">{cartilla.titulo}</h2>
        {cartilla.autor && <p className="text-sm text-gray-500 mt-0.5">por {cartilla.autor}</p>}
        {cartilla.descripcion && <p className="text-gray-600 mt-3 text-sm">{cartilla.descripcion}</p>}

        <div className="my-6">
          <span className="text-3xl font-extrabold text-emerald-700">{formatPrecio(cartilla.precio, cartilla.moneda)}</span>
        </div>

        <div className="space-y-2">
          <button
            disabled={procesando}
            onClick={() => adquirir('wompi')}
            className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {procesando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Comprar y pagar con Wompi
          </button>
          <button
            disabled={procesando}
            onClick={() => adquirir('manual')}
            className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 disabled:opacity-60"
          >
            Solicitar acceso al comercio
          </button>
        </div>

        {mensaje && <p className="mt-4 text-sm text-gray-600">{mensaje}</p>}

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

  const volver = () => router.push('/cartilla-inga');

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
