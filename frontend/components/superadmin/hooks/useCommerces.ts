'use client'

import { useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'

export function useCommerces() {
  const [marketplaceCards, setMarketplaceCards] = useState<any[]>([])
  const [isLoadingCards, setIsLoadingCards] = useState(false)
  const [cardSearch, setCardSearch] = useState('')
  const [savingCardId, setSavingCardId] = useState<string | null>(null)

  const fetchMarketplaceCards = useCallback(async () => {
    setIsLoadingCards(true)
    try {
      const res = await api.getMarketplaceCards()
      if (res.success && res.data) setMarketplaceCards(res.data as any[])
    } catch { /* noop */ }
    setIsLoadingCards(false)
  }, [])

  const patchCardLocal = (id: string, patch: Record<string, any>) => {
    setMarketplaceCards(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)))
  }

  const saveMarketplaceCard = async (card: any) => {
    setSavingCardId(card.id)
    try {
      const res = await api.updateMarketplaceCard(card.id, {
        coverUrl: card.coverUrl ?? null,
        cardDescription: card.cardDescription ?? null,
        isVerified: Boolean(card.isVerified),
        marketplaceVisible: Boolean(card.marketplaceVisible),
        marketplaceOrder: Number(card.marketplaceOrder) || 0,
      })
      if (res.success) toast.success('Tarjeta actualizada')
      else toast.error(res.error || 'No se pudo guardar')
    } catch { toast.error('Error al guardar la tarjeta') }
    setSavingCardId(null)
  }

  // ── Tarjetas externas (comercios fuera del aplicativo) ──────────────────────
  const [externalCards, setExternalCards] = useState<any[]>([])
  const [savingExternalId, setSavingExternalId] = useState<string | null>(null)
  const emptyExternal = () => ({ name: '', externalUrl: '', logoUrl: '', coverUrl: '', cardDescription: '', city: '', isVerified: false, marketplaceVisible: true, marketplaceOrder: 0 })
  const [newExternal, setNewExternal] = useState<Record<string, any>>(emptyExternal())
  const [creatingExternal, setCreatingExternal] = useState(false)

  const fetchExternalCards = useCallback(async () => {
    try {
      const res = await api.getExternalCards()
      if (res.success && res.data) setExternalCards(res.data as any[])
    } catch { /* noop */ }
  }, [])

  const patchExternalLocal = (id: string, patch: Record<string, any>) => {
    setExternalCards(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)))
  }

  const createExternalCard = async () => {
    if (!newExternal.name?.trim()) { toast.error('Escribe el nombre'); return }
    if (!newExternal.externalUrl?.trim()) { toast.error('Escribe el link externo'); return }
    setCreatingExternal(true)
    try {
      const res = await api.createExternalCard(newExternal as any)
      if (res.success) { toast.success('Tarjeta externa creada'); setNewExternal(emptyExternal()); await fetchExternalCards() }
      else toast.error(res.error || 'No se pudo crear')
    } catch { toast.error('Error al crear la tarjeta') }
    setCreatingExternal(false)
  }

  const saveExternalCard = async (card: any) => {
    setSavingExternalId(card.id)
    try {
      const res = await api.updateExternalCard(card.id, {
        name: card.name, externalUrl: card.externalUrl, logoUrl: card.logoUrl ?? null,
        coverUrl: card.coverUrl ?? null, cardDescription: card.cardDescription ?? null, city: card.city ?? null,
        isVerified: Boolean(card.isVerified), marketplaceVisible: Boolean(card.marketplaceVisible),
        marketplaceOrder: Number(card.marketplaceOrder) || 0,
      })
      if (res.success) toast.success('Tarjeta externa actualizada')
      else toast.error(res.error || 'No se pudo guardar')
    } catch { toast.error('Error al guardar') }
    setSavingExternalId(null)
  }

  const deleteExternalCard = async (id: string) => {
    try {
      const res = await api.deleteExternalCard(id)
      if (res.success) { toast.success('Tarjeta externa eliminada'); setExternalCards(prev => prev.filter(c => c.id !== id)) }
      else toast.error(res.error || 'No se pudo eliminar')
    } catch { toast.error('Error al eliminar') }
  }

  return {
    marketplaceCards, isLoadingCards, cardSearch, setCardSearch, savingCardId,
    fetchMarketplaceCards, patchCardLocal, saveMarketplaceCard,
    externalCards, fetchExternalCards, patchExternalLocal, savingExternalId,
    newExternal, setNewExternal, creatingExternal, createExternalCard, saveExternalCard, deleteExternalCard,
  }
}
