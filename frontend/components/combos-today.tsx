'use client'

/**
 * CombosToday — sección "Combos de hoy" del storefront (Tema 1).
 * Muestra los combos que el comerciante activó para el día actual (lun perros x2/x3,
 * mié hamburguesas…) y un modal armador: el cliente elige el tamaño y luego los N ítems
 * que quiere del combo, a precio fijo. Al agregar, emite una línea de combo al carrito
 * que el backend revalida (precio del tamaño + stock de los componentes).
 */
import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import { cldImg } from '@/utils/img'
import type { ProductoCarrito } from '@/types'
import { Flame, X, Check, Plus, Gift, Utensils } from 'lucide-react'

type ComboItem = { id: string; name: string; price: number; imageUrl: string | null }
type Combo = {
  id: string; name: string; sizes: { count: number; price: number }[]
  includes: string | null; imageUrl: string | null; items: ComboItem[]
}

export function CombosToday({
  store, tenantId, storeName, onAdd, isLightBg = false,
}: {
  store: string
  tenantId?: string
  storeName?: string
  onAdd: (line: ProductoCarrito) => void
  /** true si el fondo de la tienda es claro → título en negro; si no, en blanco. */
  isLightBg?: boolean
}) {
  const [combos, setCombos] = useState<Combo[]>([])
  const [active, setActive] = useState<Combo | null>(null)
  const [sizeCount, setSizeCount] = useState<number>(0)
  const [chosen, setChosen] = useState<string[]>([])

  const load = useCallback(async () => {
    if (!store || store === 'all') { setCombos([]); return }
    const res = await api.getPublicCombos(store)
    if (res.success) {
      // Solo mostramos combos completables: cada tamaño exige elegir `count` ítems
      // distintos, así que un tamaño solo es válido si hay al menos `count` ítems
      // elegibles. Se descartan tamaños imposibles y combos sin ningún tamaño válido
      // (evita el modal trabado en "Elige N más" cuando faltan ítems).
      const cleaned = ((res.data || []) as Combo[])
        .map(c => ({ ...c, sizes: c.sizes.filter(s => s.count <= (c.items?.length || 0)) }))
        .filter(c => c.sizes.length > 0 && (c.items?.length || 0) > 0)
      setCombos(cleaned)
    }
  }, [store])
  useEffect(() => { load() }, [load])

  const open = (c: Combo) => {
    setActive(c)
    setSizeCount(c.sizes[0]?.count || 0)
    setChosen([])
  }
  const close = () => { setActive(null); setChosen([]) }

  const size = active?.sizes.find(s => s.count === sizeCount) || null
  const full = chosen.length >= sizeCount

  const toggle = (id: string) => {
    setChosen(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= sizeCount) return prev // tope alcanzado
      return [...prev, id]
    })
  }
  // Al cambiar de tamaño, recorta la selección si excede el nuevo tope
  useEffect(() => { setChosen(prev => prev.slice(0, sizeCount)) }, [sizeCount])

  const add = () => {
    if (!active || !size || chosen.length !== sizeCount) return
    const chosenItems = chosen.map(id => active.items.find(i => i.id === id)).filter(Boolean) as ComboItem[]
    const line: ProductoCarrito = {
      id: 0,
      tempId: `combo-${active.id}-${size.count}-${[...chosen].sort().join('-')}`,
      nombre: `${active.name} (x${size.count}): ${chosenItems.map(i => i.name).join(' + ')}`,
      precio: size.price,
      cantidad: 1,
      imagen: active.imageUrl || chosenItems[0]?.imageUrl || '',
      tenantId,
      storeName,
      availableForDelivery: true,
      deliveryType: 'domicilio',
      comboId: active.id,
      comboSizeCount: size.count,
      comboItemIds: chosen,
    }
    onAdd(line)
    close()
  }

  if (!combos.length) return null

  return (
    <div className="my-6">
      <div className="flex items-center gap-2 px-1 mb-3">
        <Flame className="h-5 w-5 text-orange-500" />
        <h2 className={`text-lg font-bold ${isLightBg ? 'text-black' : 'text-white'}`}>Combos de hoy</h2>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 px-1 snap-x">
        {combos.map(c => {
          const from = c.sizes.length ? Math.min(...c.sizes.map(s => s.price)) : 0
          return (
            <button
              key={c.id}
              onClick={() => open(c)}
              className="group relative shrink-0 snap-start w-56 text-left rounded-2xl overflow-hidden border border-black/5 bg-white shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="relative h-32 w-full bg-gradient-to-br from-orange-400 to-red-500 overflow-hidden">
                {(c.imageUrl || c.items[0]?.imageUrl) && (
                  <img
                    src={cldImg((c.imageUrl || c.items[0]?.imageUrl) as string, 400)}
                    alt={c.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                )}
                <span className="absolute top-2 left-2 flex items-center gap-1 text-[10px] font-bold text-white bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5">
                  <Flame className="h-3 w-3" /> COMBO
                </span>
              </div>
              <div className="p-3 space-y-1">
                <p className="font-semibold text-sm leading-tight line-clamp-2 text-gray-900">{c.name}</p>
                <div className="flex flex-wrap gap-1">
                  {c.sizes.map((s, i) => (
                    <span key={i} className="text-[10px] font-medium text-orange-700 bg-orange-500/10 rounded px-1.5 py-0.5">x{s.count}</span>
                  ))}
                </div>
                <p className="text-xs text-gray-500">Desde <span className="font-bold text-gray-900">{formatCOP(from)}</span></p>
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Modal armador ─────────────────────────────────── */}
      {active && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onClick={close}>
          <div
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="relative h-36 bg-gradient-to-br from-orange-400 to-red-500 shrink-0">
              {(active.imageUrl || active.items[0]?.imageUrl) && (
                <img src={cldImg((active.imageUrl || active.items[0]?.imageUrl) as string, 600)} alt={active.name} className="w-full h-full object-cover" />
              )}
              <button onClick={close} className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center">
                <X className="h-4 w-4" />
              </button>
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                <h3 className="text-white font-bold text-lg leading-tight">{active.name}</h3>
              </div>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto">
              {active.includes && (
                <p className="flex items-start gap-2 text-sm text-gray-600">
                  <Gift className="h-4 w-4 mt-0.5 text-orange-500 shrink-0" /> Incluye: {active.includes}
                </p>
              )}

              {/* Tamaño */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Elige el tamaño</p>
                <div className="flex flex-wrap gap-2">
                  {active.sizes.map(s => (
                    <button
                      key={s.count}
                      onClick={() => setSizeCount(s.count)}
                      className={`flex-1 min-w-[90px] rounded-xl border-2 px-3 py-2 text-center transition-colors ${sizeCount === s.count ? 'border-orange-500 bg-orange-500/5' : 'border-black/10 hover:border-orange-300'}`}
                    >
                      <p className="font-bold text-gray-900">Combo x{s.count}</p>
                      <p className="text-sm text-orange-600 font-semibold">{formatCOP(s.price)}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Ítems */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Elige tus {sizeCount} ítems</p>
                  <span className={`text-xs font-bold ${full ? 'text-emerald-600' : 'text-orange-600'}`}>{chosen.length}/{sizeCount}</span>
                </div>
                <div className="space-y-1.5">
                  {active.items.map(it => {
                    const on = chosen.includes(it.id)
                    const disabled = !on && full
                    return (
                      <button
                        key={it.id}
                        onClick={() => toggle(it.id)}
                        disabled={disabled}
                        className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors ${on ? 'border-orange-500 bg-orange-500/5' : disabled ? 'border-black/5 opacity-40' : 'border-black/10 hover:border-orange-300'}`}
                      >
                        <div className="h-11 w-11 rounded-lg overflow-hidden bg-black/5 shrink-0 flex items-center justify-center">
                          {it.imageUrl
                            ? <img src={cldImg(it.imageUrl, 120)} alt={it.name} loading="lazy" className="w-full h-full object-cover" />
                            : <Utensils className="h-5 w-5 text-gray-400" />}
                        </div>
                        <span className="flex-1 text-sm font-medium text-gray-900">{it.name}</span>
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-orange-500 bg-orange-500 text-white' : 'border-black/20'}`}>
                          {on && <Check className="h-3 w-3" />}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-black/5 shrink-0">
              <button
                onClick={add}
                disabled={!full}
                className="w-full rounded-xl bg-orange-500 py-3 font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-orange-600 transition-colors"
              >
                <Plus className="h-5 w-5" />
                {full ? `Agregar combo · ${formatCOP(size?.price || 0)}` : `Elige ${sizeCount - chosen.length} más`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
