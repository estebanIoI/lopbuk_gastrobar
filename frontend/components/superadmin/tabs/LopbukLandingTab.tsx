'use client'

import { useState } from 'react'
import { Rocket, Save, RefreshCw, ImageIcon, Film, LayoutList } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MediaUpload } from '@/components/ui/media-upload'
import { useLopbukLanding, type LopText, type LopLang } from '../hooks/useLopbukLanding'

export function LopbukLandingTab() {
  const { defaultLang, setDefaultLang, media, setMedia, es, setEs, en, setEn, loading, saving, load, save } = useLopbukLanding()
  const [textLang, setTextLang] = useState<LopLang>('es')

  const txt = textLang === 'es' ? es : en
  const setTxt = textLang === 'es' ? setEs : setEn
  const patch = (p: Partial<LopText>) => setTxt({ ...txt, ...p })
  const setStep = (i: number, idx: 0 | 1, v: string) => {
    const steps = txt.steps.map((s, k) => (k === i ? [idx === 0 ? v : s[0], idx === 1 ? v : s[1]] as [string, string] : s))
    patch({ steps })
  }
  const setMediaStep = (i: number, key: 'image' | 'video', v: string) => {
    setMedia({ ...media, steps: media.steps.map((s, k) => (k === i ? { ...s, [key]: v } : s)) })
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Encabezado + guardar */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base lg:text-lg flex items-center gap-2"><Rocket className="h-5 w-5 text-primary" /> Landing Lopbuk (/lopbuk)</CardTitle>
              <CardDescription>Edita medios y textos de la landing pública. Los campos vacíos usan los valores por defecto.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={load} disabled={saving}><RefreshCw className="h-4 w-4 mr-1" /> Recargar</Button>
              <Button size="sm" onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1" /> {saving ? 'Guardando…' : 'Guardar'}</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Label className="text-sm">Idioma por defecto</Label>
          <div className="flex gap-2 mt-2">
            {(['es', 'en'] as LopLang[]).map(l => (
              <Button key={l} type="button" size="sm" variant={defaultLang === l ? 'default' : 'outline'} onClick={() => setDefaultLang(l)}>
                {l === 'es' ? 'Español' : 'English'}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">Se usa cuando el navegador del visitante no coincide con un idioma soportado.</p>
        </CardContent>
      </Card>

      {/* Medios del hero */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><ImageIcon className="h-4 w-4 text-primary" /> Medios del Hero</CardTitle>
          <CardDescription>La imagen de fondo se ve a sangre; el gif/imagen va dentro del recuadro del computador.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-3">
          <MediaUpload label="Imagen de fondo (verde limpia)" kind="image" maxMB={2} value={media.heroImage} onChange={(u) => setMedia({ ...media, heroImage: u })} />
          <MediaUpload label="GIF/imagen dentro del PC" kind="image" maxMB={4} value={media.heroGif} onChange={(u) => setMedia({ ...media, heroGif: u })} />
          <MediaUpload label="Imagen sección '¿Qué ofrece?'" kind="image" maxMB={2} value={media.offerImage} onChange={(u) => setMedia({ ...media, offerImage: u })} />
        </CardContent>
      </Card>

      {/* Medios de los pasos */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Film className="h-4 w-4 text-primary" /> Medios de los pasos</CardTitle>
          <CardDescription>Imagen o video por paso. Si hay video, tiene prioridad sobre la imagen.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {[0, 1, 2].map(i => (
            <div key={i} className="grid gap-4 sm:grid-cols-2 border-b border-border pb-5 last:border-0 last:pb-0">
              <MediaUpload label={`Paso ${i + 1} · imagen`} kind="image" maxMB={2} value={media.steps[i].image} onChange={(u) => setMediaStep(i, 'image', u)} />
              <MediaUpload label={`Paso ${i + 1} · video`} kind="video" maxMB={12} value={media.steps[i].video} onChange={(u) => setMediaStep(i, 'video', u)} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Textos por idioma */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><LayoutList className="h-4 w-4 text-primary" /> Textos</CardTitle>
              <CardDescription>Hero, banda y pasos. Vacío = texto por defecto.</CardDescription>
            </div>
            <div className="flex gap-2">
              {(['es', 'en'] as LopLang[]).map(l => (
                <Button key={l} type="button" size="sm" variant={textLang === l ? 'default' : 'outline'} onClick={() => setTextLang(l)}>{l.toUpperCase()}</Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm mb-1 block">Título del hero</Label>
            <Input value={txt.heroTitle} onChange={(e) => patch({ heroTitle: e.target.value })} placeholder="Lleva tu negocio al siguiente nivel…" />
          </div>
          <div>
            <Label className="text-sm mb-1 block">Texto del hero</Label>
            <textarea
              value={txt.heroLead}
              onChange={(e) => patch({ heroLead: e.target.value })}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Lopbuk centraliza inventario, ventas…"
            />
          </div>
          <div>
            <Label className="text-sm mb-1 block">Banda ("¡Sorpréndete con resultados reales!")</Label>
            <Input value={txt.band} onChange={(e) => patch({ band: e.target.value })} placeholder="¡Sorpréndete con resultados reales!" />
          </div>
          <div className="pt-2">
            <Label className="text-sm mb-2 block">Pasos (completa los 3 títulos para sobrescribir)</Label>
            <div className="space-y-3">
              {[0, 1, 2].map(i => (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr] items-start">
                  <Input value={txt.steps[i][0]} onChange={(e) => setStep(i, 0, e.target.value)} placeholder={`Título paso ${i + 1}`} />
                  <Input value={txt.steps[i][1]} onChange={(e) => setStep(i, 1, e.target.value)} placeholder={`Descripción paso ${i + 1}`} />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
