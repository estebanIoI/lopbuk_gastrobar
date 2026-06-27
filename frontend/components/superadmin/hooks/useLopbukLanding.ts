'use client'

// Hook del tab de superadmin para la landing /lopbuk.
// Lee la config singleton (GET público) y la guarda (PUT superadmin).
// Solo emite claves con contenido para no pisar los defaults del frontend.
import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

export type LopLang = 'es' | 'en'
export interface LopMedia { heroImage: string; heroGif: string; offerImage: string; steps: { image: string; video: string }[] }
export interface LopText { heroTitle: string; heroLead: string; band: string; steps: [string, string][] }

const emptyText = (): LopText => ({ heroTitle: '', heroLead: '', band: '', steps: [['', ''], ['', ''], ['', '']] })
const emptyMedia = (): LopMedia => ({ heroImage: '', heroGif: '', offerImage: '', steps: [{ image: '', video: '' }, { image: '', video: '' }, { image: '', video: '' }] })

export function useLopbukLanding() {
  const [defaultLang, setDefaultLang] = useState<LopLang>('es')
  const [media, setMedia] = useState<LopMedia>(emptyMedia())
  const [es, setEs] = useState<LopText>(emptyText())
  const [en, setEn] = useState<LopText>(emptyText())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/lopbuk-landing`)
      const json = await res.json()
      const d = json?.data || {}
      if (d.defaultLang === 'en') setDefaultLang('en')
      const m = d.media || {}
      setMedia({
        heroImage: m.heroImage || '', heroGif: m.heroGif || '', offerImage: m.offerImage || '',
        steps: [0, 1, 2].map(i => ({ image: m.steps?.[i]?.image || '', video: m.steps?.[i]?.video || '' })),
      })
      const fill = (x: any): LopText => ({
        heroTitle: x?.heroTitle || '', heroLead: x?.heroLead || '', band: x?.band || '',
        steps: [0, 1, 2].map(i => [x?.steps?.[i]?.[0] || '', x?.steps?.[i]?.[1] || '']) as [string, string][],
      })
      setEs(fill(d.i18n?.es)); setEn(fill(d.i18n?.en))
    } catch { /* sin backend: queda vacío → la landing usa defaults */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const buildLang = (x: LopText) => {
    const o: any = {}
    if (x.heroTitle.trim()) o.heroTitle = x.heroTitle
    if (x.heroLead.trim()) o.heroLead = x.heroLead
    if (x.band.trim()) o.band = x.band
    // Solo se emiten los 3 pasos si todos tienen título (evita blanquear defaults).
    if (x.steps.every(s => s[0].trim())) o.steps = x.steps.map(s => [s[0], s[1]])
    return o
  }

  const save = useCallback(async () => {
    setSaving(true)
    try {
      const config: any = {
        defaultLang,
        media: {
          heroImage: media.heroImage || null,
          heroGif: media.heroGif || null,
          offerImage: media.offerImage || null,
          steps: media.steps.map(s => ({ image: s.image || null, video: s.video || null })),
        },
        i18n: { es: buildLang(es), en: buildLang(en) },
      }
      const res = await fetch(`${API_URL}/lopbuk-landing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${api.getToken()}` },
        body: JSON.stringify({ config }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Error al guardar')
      toast.success('Landing /lopbuk guardada')
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar')
    }
    setSaving(false)
  }, [defaultLang, media, es, en])

  return { defaultLang, setDefaultLang, media, setMedia, es, setEs, en, setEn, loading, saving, load, save }
}
