'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, GraduationCap, BookMarked, Search, Lock, Sparkles, Store } from 'lucide-react';
import { cartillasAPI, type CartillaCatalogoAPI } from './services/api';

const TIPO_META: Record<string, { label: string; icon: React.ReactNode }> = {
  cartilla: { label: 'Cartilla', icon: <BookMarked className="w-4 h-4" /> },
  libro:    { label: 'Libro',    icon: <BookOpen className="w-4 h-4" /> },
  curso:    { label: 'Curso',    icon: <GraduationCap className="w-4 h-4" /> },
};

const COLOR_BG: Record<string, string> = {
  emerald: 'from-emerald-500 to-green-600',
  green:   'from-green-500 to-emerald-700',
  amber:   'from-amber-400 to-orange-500',
  purple:  'from-purple-500 to-fuchsia-600',
  pink:    'from-pink-500 to-rose-600',
};

const formatPrecio = (precio: number, moneda: string) => {
  try {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: moneda || 'COP', maximumFractionDigits: 0 }).format(precio);
  } catch {
    return `${moneda} ${precio.toLocaleString('es-CO')}`;
  }
};

const CartillaCard: React.FC<{ c: CartillaCatalogoAPI; onOpen: (slug: string) => void }> = ({ c, onOpen }) => {
  const tipo = TIPO_META[c.tipo] || TIPO_META.cartilla;
  const grad = COLOR_BG[c.color] || COLOR_BG.emerald;
  return (
    <button
      onClick={() => onOpen(c.slug)}
      className="group text-left bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all overflow-hidden border border-gray-100 flex flex-col"
    >
      <div className={`relative h-36 bg-gradient-to-br ${grad} flex items-center justify-center`}>
        {c.portadaUrl
          ? <img src={c.portadaUrl} alt={c.titulo} className="w-full h-full object-cover" />
          : <div className="text-white/90 text-5xl">{tipo.icon}</div>}
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-white/90 text-gray-800 text-xs font-semibold px-2 py-1 rounded-full">
          {tipo.icon}{tipo.label}
        </span>
        {c.esGratis ? (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 bg-emerald-600 text-white text-xs font-bold px-2 py-1 rounded-full">
            <Sparkles className="w-3 h-3" />Gratis
          </span>
        ) : (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 bg-gray-900/80 text-white text-xs font-bold px-2 py-1 rounded-full">
            {c.acceso ? 'Adquirida' : <><Lock className="w-3 h-3" />{formatPrecio(c.precio, c.moneda)}</>}
          </span>
        )}
      </div>
      <div className="p-4 flex flex-col gap-1 flex-1">
        <h3 className="font-bold text-gray-900 leading-tight line-clamp-2">{c.titulo}</h3>
        {c.autor && <p className="text-xs text-gray-500">por {c.autor}</p>}
        {c.descripcion && <p className="text-sm text-gray-600 line-clamp-2 mt-1">{c.descripcion}</p>}
        <div className="mt-auto pt-3 flex items-center justify-between text-xs text-gray-500">
          <span className="inline-flex items-center gap-1"><Store className="w-3.5 h-3.5" />{c.comercio || 'Comercio'}</span>
          {c.totalModulos != null && <span>{c.totalModulos} módulos</span>}
        </div>
      </div>
    </button>
  );
};

const TIPOS = ['', 'cartilla', 'libro', 'curso'] as const;

const CatalogoCartillas: React.FC = () => {
  const router = useRouter();
  const [items, setItems] = useState<CartillaCatalogoAPI[]>([]);
  const [tipo, setTipo] = useState<string>('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await cartillasAPI.catalogo({ tipo: tipo || undefined, q: q || undefined });
      setItems(res.data);
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar el catálogo');
    } finally {
      setLoading(false);
    }
  }, [tipo, q]);

  useEffect(() => { cargar(); }, [tipo]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setTimeout(() => cargar(), 350);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const abrir = (slug: string) => router.push(`/cartilla-inga/${slug}`);

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      {/* Hero */}
      <div className="bg-gradient-to-br from-emerald-600 to-green-700 text-white">
        <div className="container mx-auto px-4 py-10">
          <h1 className="text-3xl md:text-4xl font-extrabold">Productos Digitales</h1>
          <p className="mt-2 text-white/90 max-w-2xl">
            Explora cartillas, libros, cursos y archivos digitales publicados por los comercios.
            Abre los gratuitos o compra los de pago e interactúa con todo su contenido: módulos,
            actividades, archivos descargables, comunidad y retos.
          </p>
          <div className="mt-5 max-w-md relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por título, autor o tema…"
              className="w-full pl-9 pr-3 py-2.5 rounded-full text-gray-800 outline-none"
            />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Filtros por tipo */}
        <div className="flex gap-2 flex-wrap mb-6">
          {TIPOS.map(t => (
            <button
              key={t || 'todos'}
              onClick={() => setTipo(t)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                tipo === t ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {t === '' ? 'Todas' : (TIPO_META[t]?.label + 's')}
            </button>
          ))}
        </div>

        {loading && <p className="text-gray-500">Cargando catálogo…</p>}
        {error && <p className="text-red-600">{error}</p>}
        {!loading && !error && items.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
            Aún no hay cartillas publicadas. Vuelve pronto.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {items.map(c => <CartillaCard key={c.id} c={c} onOpen={abrir} />)}
        </div>
      </div>
    </div>
  );
};

export default CatalogoCartillas;
