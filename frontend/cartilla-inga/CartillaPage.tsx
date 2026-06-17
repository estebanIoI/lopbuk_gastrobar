'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Loader2, ArrowLeft } from 'lucide-react';
import CartillaIngaDigital from './CartillaIngaDigital';
import { cartillasAPI, ApiError, type CartillaCatalogoAPI } from './services/api';
import { BoxLoader } from '@/components/box-loader';

const formatPrecio = (precio: number, moneda: string) => {
  try {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: moneda || 'COP', maximumFractionDigits: 0 }).format(precio);
  } catch { return `${moneda} ${precio.toLocaleString('es-CO')}`; }
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
            onClick={() => adquirir('stripe')}
            className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {procesando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Adquirir cartilla
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

  return <CartillaIngaDigital cartillaSlug={cartilla.slug} onVolverCatalogo={volver} />;
};

export default CartillaPage;
