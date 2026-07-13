'use client'

import { useState, useCallback } from 'react'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface HormaColor {
  id: string
  color: string
  hex?: string | null
}

export interface Horma {
  id: string
  name: string
  baseCost?: number | null
  basePrice?: number | null
  sizeChart?: Record<string, any>
  colors?: HormaColor[]
}

// hormaMatrix: { [hormaId]: { [color]: { [size]: stockValue } } }
export type HormaMatrix = Record<string, Record<string, Record<string, string>>>
// hormaPrices: { [hormaId]: { purchasePrice: string; salePrice: string } }
export type HormaPrices = Record<string, { purchasePrice: string; salePrice: string }>

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useHormaMatrix() {
  const [selectedHormaIds, setSelectedHormaIds] = useState<string[]>([])
  const [hormaMatrix, setHormaMatrix]           = useState<HormaMatrix>({})
  const [hormaPrices, setHormaPrices]           = useState<HormaPrices>({})

  // ── Toggle selección de horma ─────────────────────────────────────────────
  const toggleHorma = useCallback((hid: string, hormasList: Horma[]) => {
    setSelectedHormaIds(prev => {
      const next = prev.includes(hid) ? prev.filter(x => x !== hid) : [...prev, hid]
      const h = hormasList.find(x => String(x.id) === String(hid))

      // Inicializar matriz para nuevas hormas seleccionadas
      setHormaMatrix(prevM => {
        const m = { ...prevM }
        for (const id of next) {
          if (!m[id]) {
            const horma = hormasList.find(x => String(x.id) === String(id))
            if (horma) {
              const sizes: string[] = horma.sizeChart ? Object.keys(horma.sizeChart) : []
              const colors: HormaColor[] = horma.colors || []
              m[id] = {}
              for (const c of colors) {
                m[id][c.color] = {}
                for (const sz of sizes) m[id][c.color][sz] = ''
              }
            }
          }
        }
        // Remover hormas deseleccionadas
        for (const id of Object.keys(m)) {
          if (!next.includes(id)) delete m[id]
        }
        return m
      })

      // Inicializar precios con baseCost/basePrice de la horma
      setHormaPrices(prevP => {
        const p = { ...prevP }
        if (!p[hid] && h) {
          p[hid] = {
            purchasePrice: h.baseCost  ? String(h.baseCost)  : '',
            salePrice:     h.basePrice ? String(h.basePrice) : '',
          }
        }
        for (const id of Object.keys(p)) {
          if (!next.includes(id)) delete p[id]
        }
        return p
      })

      return next
    })
  }, [])

  // ── Precios por horma ─────────────────────────────────────────────────────
  const setHormaPrice = useCallback((hid: string, field: 'purchasePrice' | 'salePrice', val: string) => {
    setHormaPrices(prev => ({
      ...prev,
      [hid]: { ...(prev[hid] || { purchasePrice: '', salePrice: '' }), [field]: val },
    }))
  }, [])

  // ── Celdas de stock ───────────────────────────────────────────────────────
  const setMatrixCell = useCallback((hormaId: string, color: string, size: string, val: string) => {
    setHormaMatrix(prev => ({
      ...prev,
      [hormaId]: {
        ...(prev[hormaId] || {}),
        [color]: { ...(prev[hormaId]?.[color] || {}), [size]: val },
      },
    }))
  }, [])

  const fillRow = useCallback((hormaId: string, color: string, sizes: string[], val: string) => {
    setHormaMatrix(prev => {
      const m = { ...prev, [hormaId]: { ...(prev[hormaId] || {}) } }
      m[hormaId][color] = {}
      for (const sz of sizes) m[hormaId][color][sz] = val
      return m
    })
  }, [])

  const fillCol = useCallback((hormaId: string, colors: string[], size: string, val: string) => {
    setHormaMatrix(prev => {
      const m = { ...prev, [hormaId]: { ...(prev[hormaId] || {}) } }
      for (const c of colors) m[hormaId][c] = { ...(m[hormaId][c] || {}), [size]: val }
      return m
    })
  }, [])

  const fillAll = useCallback((hormaId: string, colors: string[], sizes: string[], val: string) => {
    setHormaMatrix(prev => {
      const m: HormaMatrix = { ...prev, [hormaId]: {} }
      for (const c of colors) {
        m[hormaId][c] = {}
        for (const sz of sizes) m[hormaId][c][sz] = val
      }
      return m
    })
  }, [])

  // ── Estimación de variantes ───────────────────────────────────────────────
  const computeVariantCount = useCallback((hormasList: Horma[]): number => {
    return selectedHormaIds.reduce((total, hid) => {
      const h = hormasList.find(x => String(x.id) === String(hid))
      if (!h) return total
      const colors = (h.colors || []).length
      const sizes  = h.sizeChart ? Object.keys(h.sizeChart).length : 0
      return total + (colors * sizes)
    }, 0)
  }, [selectedHormaIds])

  // ── Construir payload de variantes con SKUs (igual que handleSubmit en ProductFormDialog) ──
  const buildVariantsPayload = useCallback((hormasList: Horma[], skuBase: string = 'PROD') => {
    const slug = (s: string) =>
      s.trim().toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '')
    const base = skuBase.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16) || 'PROD'

    const variants: any[] = []
    for (const hid of selectedHormaIds) {
      const h = hormasList.find(x => String(x.id) === String(hid))
      if (!h) continue
      const matrix   = hormaMatrix[hid] || {}
      const prices   = hormaPrices[hid] || { purchasePrice: '', salePrice: '' }
      const colors: HormaColor[] = h.colors || []
      const sizes: string[]      = h.sizeChart ? Object.keys(h.sizeChart) : []

      for (const colorObj of colors) {
        for (const size of sizes) {
          const stockVal = matrix[colorObj.color]?.[size] ?? ''
          variants.push({
            // SKU idéntico al que genera ProductFormDialog
            sku:          `${base}-${slug(h.name || hid)}-${slug(colorObj.color)}-${slug(size)}`,
            color:        colorObj.color,
            colorHex:     colorObj.hex || null,
            size,
            hormaId:      hid,
            stock:        Number(stockVal) || 0,
            minStock:     0,
            costPrice:    prices.purchasePrice !== '' ? Number(prices.purchasePrice) : null,
            priceOverride: prices.salePrice !== ''   ? Number(prices.salePrice)     : null,
          })
        }
      }
    }
    return variants
  }, [selectedHormaIds, hormaMatrix, hormaPrices])

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setSelectedHormaIds([])
    setHormaMatrix({})
    setHormaPrices({})
  }, [])

  return {
    selectedHormaIds,
    hormaMatrix,
    hormaPrices,
    toggleHorma,
    setHormaPrice,
    setMatrixCell,
    fillRow,
    fillCol,
    fillAll,
    computeVariantCount,
    buildVariantsPayload,
    reset,
  }
}
