'use client'

import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { applyAdminAccent, type ThemePalette } from '@/lib/theme-vars'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Palette, Sparkles, Loader2, Check, RotateCcw, Upload, Wand2 } from 'lucide-react'

const SWATCHES: { key: keyof ThemePalette['colors']; label: string }[] = [
  { key: 'primary', label: 'Primario (CTA)' },
  { key: 'primary_hover', label: 'Primario hover' },
  { key: 'secondary', label: 'Secundario' },
  { key: 'background_store', label: 'Fondo tienda' },
  { key: 'surface_store', label: 'Superficie' },
  { key: 'text_main', label: 'Texto' },
  { key: 'admin_accent', label: 'Acento panel' },
]

export function LogoThemeGenerator({ logoUrl }: { logoUrl?: string | null }) {
  const [palette, setPalette] = useState<ThemePalette | null>(null)
  const [saved, setSaved] = useState<ThemePalette | null>(null)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [provider, setProvider] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.getStoreThemeColors().then(res => {
      if (res.success && res.data?.colors) { setSaved(res.data); setPalette(res.data) }
    }).catch(() => {})
  }, [])

  const runGenerate = async (payload: { imageBase64?: string; logoUrl?: string }) => {
    setError(null); setGenerating(true)
    try {
      const res = await api.generateStoreTheme(payload)
      if (res.success && res.data?.palette) {
        setPalette(res.data.palette)
        setProvider(res.data.provider)
      } else {
        setError(res.error || 'No se pudo generar el tema')
      }
    } catch (e: any) {
      setError(e?.message || 'Error al generar el tema')
    } finally {
      setGenerating(false)
    }
  }

  const handleGenerateFromLogo = () => {
    if (logoUrl) runGenerate({ logoUrl })
    else fileRef.current?.click()
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = reject; r.readAsDataURL(file)
    })
    runGenerate({ imageBase64: dataUrl })
  }

  const handleSave = async () => {
    if (!palette) return
    setSaving(true)
    const res = await api.saveStoreThemeColors(palette)
    if (res.success) {
      setSaved(palette)
      applyAdminAccent(palette.colors.admin_accent)
      toast.success('Tema aplicado y guardado')
    } else {
      toast.error(res.error || 'No se pudo guardar el tema')
    }
    setSaving(false)
  }

  const handleReset = async () => {
    const res = await api.resetStoreTheme()
    if (res.success) {
      setSaved(null); setPalette(null); setProvider(null)
      applyAdminAccent(null)
      toast.success('Tema restablecido al diseño base')
    } else {
      toast.error(res.error || 'No se pudo restablecer')
    }
  }

  const dirty = palette && JSON.stringify(palette) !== JSON.stringify(saved)

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base lg:text-lg flex items-center gap-2">
          <Palette className="h-5 w-5 text-muted-foreground" />
          Tema automático desde el logo (IA)
        </CardTitle>
        <CardDescription>
          La IA analiza tu logo y genera una paleta accesible: tu tienda se tiñe con esos colores y el panel usa el acento de tu marca.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={handleGenerateFromLogo} disabled={generating}>
            {generating
              ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Analizando logo...</>
              : <><Wand2 className="mr-1.5 h-4 w-4" />Generar tema con IA</>}
          </Button>
          {!logoUrl && (
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={generating}>
              <Upload className="mr-1.5 h-4 w-4" /> Subir logo
            </Button>
          )}
          {saved && (
            <Button size="sm" variant="ghost" onClick={handleReset} className="text-destructive/80 hover:text-destructive">
              <RotateCcw className="mr-1.5 h-4 w-4" /> Restablecer
            </Button>
          )}
          {provider && !generating && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Check className="h-3.5 w-3.5 text-green-500" /> {provider === 'gemini' ? 'Gemini' : provider === 'groq' ? 'Groq' : 'OpenAI'}
            </span>
          )}
        </div>

        {error && <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}

        {palette && (
          <>
            <div className="rounded-lg border border-border overflow-hidden">
              {/* Preview tienda */}
              <div className="p-4" style={{ background: palette.colors.background_store, color: palette.colors.text_main }}>
                <div className="rounded-lg p-3 mb-3" style={{ background: palette.colors.surface_store }}>
                  <p className="text-sm font-semibold" style={{ color: palette.colors.text_main }}>Vista previa de la tienda</p>
                  <p className="text-xs opacity-70" style={{ color: palette.colors.text_main }}>Tarjeta de producto de ejemplo</p>
                </div>
                <button className="text-sm font-semibold px-4 py-2 rounded-lg text-white" style={{ background: palette.colors.primary }}>Comprar ahora</button>
                <span className="ml-2 text-xs px-2 py-1 rounded" style={{ background: palette.colors.secondary, color: '#fff' }}>Etiqueta</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {SWATCHES.map(s => (
                <div key={s.key} className="rounded-lg border border-border overflow-hidden">
                  <div className="h-10" style={{ background: palette.colors[s.key] }} />
                  <div className="p-1.5">
                    <p className="text-[10px] font-medium leading-tight">{s.label}</p>
                    <p className="text-[9px] text-muted-foreground font-mono uppercase">{palette.colors[s.key]}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
                {saving ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Guardando...</> : <><Sparkles className="mr-1.5 h-4 w-4" />Aplicar y guardar</>}
              </Button>
              {!dirty && saved && <span className="text-[11px] text-muted-foreground">Tema aplicado</span>}
              <span className="text-[11px] text-muted-foreground ml-auto">Modo: {palette.theme_type === 'dark' ? 'Oscuro' : 'Claro'}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
