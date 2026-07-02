'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, FileText, Download, Lock, ArrowLeft, Clock, XCircle } from 'lucide-react';
import { cartillasAPI, type CompraTokenAPI } from './services/api';

const formatPrecio = (precio: number, moneda: string) => {
  try { return new Intl.NumberFormat('es-CO', { style: 'currency', currency: moneda || 'COP', maximumFractionDigits: 0 }).format(precio); }
  catch { return `${moneda} ${precio.toLocaleString('es-CO')}`; }
};

/** Pantalla de éxito para la compra como INVITADO: recupera el estado por token,
 *  hace polling mientras Wompi confirma, y muestra las descargas al aprobarse. */
const CompraExito: React.FC = () => {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('c') || '';
  const [data, setData] = useState<CompraTokenAPI | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const tries = useRef(0);

  const cargar = useCallback(async () => {
    if (!token) { setError('Falta el identificador de la compra.'); setLoading(false); return; }
    try {
      const res = await cartillasAPI.compraPorToken(token);
      setData(res);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar la compra.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { cargar(); }, [cargar]);

  // Polling mientras el pago no esté confirmado (Wompi puede tardar unos segundos).
  useEffect(() => {
    if (!data || data.pagada) return;
    if (tries.current >= 40) return; // ~2 min
    const t = setTimeout(() => { tries.current += 1; cargar(); }, 3000);
    return () => clearTimeout(t);
  }, [data, cargar]);

  const conUrl = (data?.archivos || []).filter(f => f.url);

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center px-4 py-10">
      <div className="max-w-lg w-full bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(16,185,129,0.35)] overflow-hidden border border-gray-100">
        {/* Cabecera con degradado premium */}
        <div className="bg-gradient-to-br from-emerald-600 to-green-700 px-8 pt-8 pb-10 text-center text-white relative">
          <button onClick={() => router.push('/productos-digitales')} className="absolute left-4 top-4 text-white/80 hover:text-white inline-flex items-center gap-1 text-sm">
            <ArrowLeft className="w-4 h-4" /> Catálogo
          </button>
          <div className="w-16 h-16 mx-auto rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center mb-3">
            {loading ? <Loader2 className="w-8 h-8 animate-spin" />
              : data?.pagada ? <CheckCircle2 className="w-9 h-9" />
              : error ? <XCircle className="w-8 h-8" />
              : <Clock className="w-8 h-8" />}
          </div>
          <h1 className="text-xl font-extrabold">
            {loading ? 'Verificando tu compra…'
              : data?.pagada ? '¡Compra confirmada!'
              : error ? 'No pudimos encontrar tu compra'
              : 'Estamos confirmando tu pago…'}
          </h1>
          {data && <p className="mt-1 text-white/85 text-sm">{data.titulo}{data.autor ? ` · por ${data.autor}` : ''}</p>}
        </div>

        <div className="p-8">
          {error && <p className="text-center text-red-600">{error}</p>}

          {data && !data.pagada && !error && (
            <div className="text-center text-gray-600">
              <p className="text-sm">Tu pago por <b>{formatPrecio(data.precio, data.moneda)}</b> se está procesando en Wompi.
                Esta pantalla se actualizará automáticamente al confirmarse.</p>
              <div className="mt-4 inline-flex items-center gap-2 text-emerald-700 text-sm font-medium">
                <Loader2 className="w-4 h-4 animate-spin" /> Esperando confirmación…
              </div>
            </div>
          )}

          {data && data.pagada && (
            <div>
              {data.comprador?.nombre && (
                <p className="text-sm text-gray-600 mb-4">Gracias, <b>{data.comprador.nombre}</b>. Ya puedes descargar tu contenido
                  {data.comprador.email ? <> — también te lo asociamos a <b>{data.comprador.email}</b></> : null}.</p>
              )}
              {conUrl.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Archivos descargables</p>
                  {conUrl.map(f => (
                    <a key={f.id} href={f.url!} target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-3 bg-gray-50 hover:bg-emerald-50 border border-gray-100 rounded-xl px-4 py-3 transition group">
                      <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{f.nombre}</p>
                        <p className="text-[11px] text-gray-400 uppercase">{f.tipo || 'archivo'}{f.sizeBytes ? ` · ${(f.sizeBytes / 1024 / 1024).toFixed(2)} MB` : ''}</p>
                      </div>
                      <span className="text-emerald-700 inline-flex items-center gap-1 text-xs font-semibold shrink-0 group-hover:translate-x-0.5 transition">
                        <Download className="w-4 h-4" /> Descargar
                      </span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-600 text-sm">Tu acceso quedó habilitado. Este producto no tiene archivos descargables.</p>
              )}

              <button onClick={() => router.push(`/productos-digitales/${data.slug}`)}
                className="mt-6 w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700">
                Abrir el producto
              </button>
              <p className="mt-3 text-center text-[11px] text-gray-400 inline-flex items-center gap-1 w-full justify-center">
                <Lock className="w-3 h-3" /> Guarda este enlace: es tu comprobante de acceso.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompraExito;
