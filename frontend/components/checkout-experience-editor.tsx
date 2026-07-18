'use client'

/**
 * Checkout Experience Editor (Fase 4) — el comerciante personaliza el checkout
 * sin tocar su lógica: encabezado, CTA, mensaje inferior, bloques informativos y
 * campos (label/placeholder/visible/obligatorio/orden). Los campos núcleo
 * (nombre, teléfono) aparecen bloqueados: no se pueden ocultar ni volver
 * opcionales (el backend lo fuerza igual).
 */

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  CreditCard, Loader2, RotateCcw, ChevronUp, ChevronDown, Lock, Plus, Trash2,
} from 'lucide-react'
import {
  type CheckoutExperienceConfig, type CheckoutFieldKey, defaultCheckoutConfig,
  withCheckoutDefaults, ALL_FIELDS, CORE_FIELDS, FIELD_LABELS,
} from '@/lib/checkout-experience'
import { ListEditor } from '@/lib/product-blocks/shared'

export function CheckoutExperienceEditor() {
  const [cfg, setCfg] = useState<CheckoutExperienceConfig>(defaultCheckoutConfig())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    const res = await api.getCheckoutExperience()
    if (res.success && res.data) setCfg(withCheckoutDefaults(res.data))
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const patch = (p: Partial<CheckoutExperienceConfig>) => { setCfg(prev => ({ ...prev, ...p })); setSaved(false) }
  const patchField = (k: CheckoutFieldKey, p: Partial<CheckoutExperienceConfig['fields'][string]>) => {
    setCfg(prev => ({ ...prev, fields: { ...prev.fields, [k]: { ...prev.fields[k], ...p } } }))
    setSaved(false)
  }

  const save = async () => {
    setSaving(true)
    const res = await api.saveCheckoutExperience(cfg)
    if (res.success && res.data) setCfg(withCheckoutDefaults(res.data))
    setSaving(false)
    setSaved(true)
  }
  const reset = async () => {
    if (!confirm('¿Restaurar el checkout por defecto? Se perderá la personalización.')) return
    setSaving(true)
    const res = await api.resetCheckoutExperience()
    if (res.success && res.data) setCfg(withCheckoutDefaults(res.data))
    setSaving(false)
  }

  const moveField = (k: CheckoutFieldKey, dir: -1 | 1) => {
    const ordered = [...ALL_FIELDS].sort((a, b) => cfg.fields[a].order - cfg.fields[b].order)
    const i = ordered.indexOf(k)
    const j = i + dir
    if (j < 0 || j >= ordered.length) return
    const a = ordered[i], b = ordered[j]
    const oa = cfg.fields[a].order, ob = cfg.fields[b].order
    setCfg(prev => ({ ...prev, fields: { ...prev.fields, [a]: { ...prev.fields[a], order: ob }, [b]: { ...prev.fields[b], order: oa } } }))
    setSaved(false)
  }

  if (loading) {
    return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Cargando…</CardContent></Card>
  }

  const orderedFields = [...ALL_FIELDS].sort((a, b) => cfg.fields[a].order - cfg.fields[b].order)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" />Experiencia de checkout</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Personaliza textos, campos y mensajes del checkout. No cambia el flujo de pago.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={reset} disabled={saving}><RotateCcw className="h-3.5 w-3.5 mr-1" />Restaurar</Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? 'Guardado ✓' : 'Guardar'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Encabezado */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Encabezado</h3>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={cfg.header.show} onChange={e => patch({ header: { ...cfg.header, show: e.target.checked } })} />Mostrar
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-[70px_1fr]">
            <div>
              <label className="text-xs font-medium mb-1 block">Icono</label>
              <Input value={cfg.header.icon} onChange={e => patch({ header: { ...cfg.header, icon: e.target.value } })} className="h-8 text-xs text-center" maxLength={2} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Título</label>
              <Input value={cfg.header.title} onChange={e => patch({ header: { ...cfg.header, title: e.target.value } })} className="h-8 text-xs" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Subtítulo / mensaje de confianza</label>
            <Input value={cfg.header.subtitle} onChange={e => patch({ header: { ...cfg.header, subtitle: e.target.value } })} className="h-8 text-xs" />
          </div>
        </section>

        {/* CTA */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Botón principal (CTA)</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium mb-1 block">Texto</label>
              <Input value={cfg.cta.text} onChange={e => patch({ cta: { ...cfg.cta, text: e.target.value } })} className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Subtexto</label>
              <Input value={cfg.cta.subtext} onChange={e => patch({ cta: { ...cfg.cta, subtext: e.target.value } })} className="h-8 text-xs" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={cfg.cta.sticky} onChange={e => patch({ cta: { ...cfg.cta, sticky: e.target.checked } })} />
            Botón fijo al hacer scroll (sticky)
          </label>
        </section>

        {/* Campos del formulario */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Campos del formulario</h3>
          <div className="space-y-1.5">
            {orderedFields.map((k, i) => {
              const f = cfg.fields[k]
              const isCore = CORE_FIELDS.includes(k)
              return (
                <div key={k} className={`border rounded-lg p-2.5 ${f.visible ? '' : 'opacity-50'}`}>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col">
                      <button onClick={() => moveField(k, -1)} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronUp className="h-3 w-3" /></button>
                      <button onClick={() => moveField(k, 1)} disabled={i === orderedFields.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown className="h-3 w-3" /></button>
                    </div>
                    <span className="text-xs font-semibold w-24 shrink-0 flex items-center gap-1">
                      {FIELD_LABELS[k]}{isCore && <Lock className="h-3 w-3 text-muted-foreground" />}
                    </span>
                    <Input value={f.label || ''} onChange={e => patchField(k, { label: e.target.value })} placeholder="Etiqueta" className="h-7 text-xs flex-1" />
                    <label className="flex items-center gap-1 text-[11px] shrink-0" title={isCore ? 'Campo obligatorio del sistema' : ''}>
                      <input type="checkbox" checked={f.required} disabled={isCore} onChange={e => patchField(k, { required: e.target.checked })} />Oblig.
                    </label>
                    <label className="flex items-center gap-1 text-[11px] shrink-0" title={isCore ? 'Siempre visible' : ''}>
                      <input type="checkbox" checked={f.visible} disabled={isCore} onChange={e => patchField(k, { visible: e.target.checked })} />Visible
                    </label>
                  </div>
                  <Input value={f.placeholder || ''} onChange={e => patchField(k, { placeholder: e.target.value })} placeholder="Placeholder" className="h-7 text-xs mt-1.5" />
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Lock className="h-3 w-3" />Nombre y teléfono no se pueden ocultar: se necesitan para procesar el pedido.</p>
        </section>

        {/* Mensaje inferior */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mensaje inferior</h3>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={cfg.bottomMessage.show} onChange={e => patch({ bottomMessage: { ...cfg.bottomMessage, show: e.target.checked } })} />Mostrar
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-[70px_1fr]">
            <div>
              <label className="text-xs font-medium mb-1 block">Icono</label>
              <Input value={cfg.bottomMessage.icon} onChange={e => patch({ bottomMessage: { ...cfg.bottomMessage, icon: e.target.value } })} className="h-8 text-xs text-center" maxLength={2} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Título (opcional)</label>
              <Input value={cfg.bottomMessage.title} onChange={e => patch({ bottomMessage: { ...cfg.bottomMessage, title: e.target.value } })} className="h-8 text-xs" />
            </div>
          </div>
          <Textarea rows={2} value={cfg.bottomMessage.text} onChange={e => patch({ bottomMessage: { ...cfg.bottomMessage, text: e.target.value } })} className="text-xs" placeholder="Ej: Al finalizar tu compra te contactaremos por WhatsApp…" />
        </section>

        {/* Bloques informativos */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bloques informativos (pago seguro, entrega, garantías…)</h3>
          <ListEditor
            items={cfg.infoBlocks}
            onChange={v => patch({ infoBlocks: v })}
            addLabel="Agregar bloque"
            fields={[{ key: 'icon', label: 'Emoji' }, { key: 'title', label: 'Título' }, { key: 'text', label: 'Descripción' }]}
          />
        </section>
      </CardContent>
    </Card>
  )
}
