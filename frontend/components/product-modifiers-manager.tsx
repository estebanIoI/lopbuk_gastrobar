'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { X, Plus, Trash2, GripVertical, RefreshCw, Save } from 'lucide-react'
import { CloudinaryUpload } from '@/components/ui/cloudinary-upload'

interface EditOption { name: string; priceDelta: number; imageUrl: string; isActive: boolean }
interface EditGroup {
  name: string
  selectionType: 'single' | 'multiple'
  isRequired: boolean
  minSelect: number
  maxSelect: number | null
  options: EditOption[]
}

const newOption = (): EditOption => ({ name: '', priceDelta: 0, imageUrl: '', isActive: true })
const newGroup = (): EditGroup => ({ name: '', selectionType: 'multiple', isRequired: false, minSelect: 0, maxSelect: null, options: [newOption()] })

/**
 * Gestor de modificadores de un producto (grupos + opciones).
 * Ej: "La prefieres de" (single), "Adiciones" (+precio), "Sin X" (sin costo).
 */
export function ProductModifiersManager({ productId, productName, onClose }: { productId: string; productName: string; onClose: () => void }) {
  const [groups, setGroups] = useState<EditGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getProductModifiers(productId)
        if (res.success && Array.isArray(res.data)) {
          setGroups(res.data.map((g: any) => ({
            name: g.name || '',
            selectionType: g.selectionType === 'single' ? 'single' : 'multiple',
            isRequired: !!g.isRequired,
            minSelect: Number(g.minSelect) || 0,
            maxSelect: g.maxSelect == null ? null : Number(g.maxSelect),
            options: (g.options || []).map((o: any) => ({
              name: o.name || '', priceDelta: Number(o.priceDelta) || 0,
              imageUrl: o.imageUrl || '', isActive: o.isActive !== false,
            })),
          })))
        }
      } catch { /* noop */ }
      setLoading(false)
    })()
  }, [productId])

  const patchGroup = (gi: number, patch: Partial<EditGroup>) =>
    setGroups(prev => prev.map((g, i) => i === gi ? { ...g, ...patch } : g))
  const patchOption = (gi: number, oi: number, patch: Partial<EditOption>) =>
    setGroups(prev => prev.map((g, i) => i === gi ? { ...g, options: g.options.map((o, j) => j === oi ? { ...o, ...patch } : o) } : g))

  const save = async () => {
    // Limpia grupos/opciones sin nombre
    const clean = groups
      .map(g => ({ ...g, options: g.options.filter(o => o.name.trim()) }))
      .filter(g => g.name.trim() && g.options.length > 0)
    setSaving(true)
    try {
      const res = await api.saveProductModifiers(productId, clean)
      if (res.success) { toast.success('Modificadores guardados'); onClose() }
      else toast.error(res.error || 'No se pudo guardar')
    } catch { toast.error('Error al guardar') }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] rounded-2xl bg-card border border-border flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div>
            <h3 className="text-lg font-bold">Modificadores</h3>
            <p className="text-xs text-muted-foreground truncate max-w-[60vw]">{productName}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {groups.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Sin modificadores. Agrega un grupo (ej: Adiciones, Sin ingredientes, Combo).</p>
            )}
            {groups.map((g, gi) => (
              <div key={gi} className="rounded-xl border border-border bg-background overflow-hidden">
                <div className="p-3 space-y-3 bg-secondary/20">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    <input
                      value={g.name} onChange={e => patchGroup(gi, { name: e.target.value })}
                      placeholder="Nombre del grupo (ej: Adiciones)"
                      className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                    <button onClick={() => setGroups(prev => prev.filter((_, i) => i !== gi))} className="text-destructive hover:bg-destructive/10 rounded-md p-2"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs pl-6">
                    <select value={g.selectionType} onChange={e => patchGroup(gi, { selectionType: e.target.value as any })} className="rounded-md border border-border bg-background px-2 py-1.5">
                      <option value="multiple">Selección múltiple</option>
                      <option value="single">Una sola opción</option>
                    </select>
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={g.isRequired} onChange={e => patchGroup(gi, { isRequired: e.target.checked })} className="accent-primary" />
                      Obligatorio
                    </label>
                    {g.selectionType === 'multiple' && (
                      <label className="flex items-center gap-1.5">
                        Máx
                        <input type="number" min={1} value={g.maxSelect ?? ''} onChange={e => patchGroup(gi, { maxSelect: e.target.value ? Number(e.target.value) : null })} placeholder="∞" className="w-16 rounded-md border border-border bg-background px-2 py-1" />
                      </label>
                    )}
                  </div>
                </div>

                {/* Opciones */}
                <div className="p-3 space-y-2">
                  {g.options.map((o, oi) => (
                    <div key={oi} className="rounded-lg border border-border bg-secondary/10 p-2.5 space-y-2">
                      <div className="flex items-center gap-2">
                        {/* Miniatura de la opción (si tiene imagen) */}
                        {o.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={o.imageUrl} alt={o.name} className="w-9 h-9 rounded-md object-cover border border-border shrink-0" />
                        )}
                        <input
                          value={o.name} onChange={e => patchOption(gi, oi, { name: e.target.value })}
                          placeholder="Opción (ej: Sin cebolla, Queso extra)"
                          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                        />
                        <div className="flex items-center gap-1 text-sm">
                          <span className="text-muted-foreground">+$</span>
                          <input type="number" min={0} value={o.priceDelta} onChange={e => patchOption(gi, oi, { priceDelta: Number(e.target.value) || 0 })} className="w-24 rounded-md border border-border bg-background px-2 py-2" />
                        </div>
                        <button onClick={() => patchGroup(gi, { options: g.options.filter((_, j) => j !== oi) })} className="text-muted-foreground hover:text-destructive p-2"><Trash2 className="h-4 w-4" /></button>
                      </div>
                      {/* Imagen por opción (opcional) — se muestra al elegir en la tienda */}
                      <div className="pl-1">
                        <CloudinaryUpload
                          value={o.imageUrl}
                          onChange={url => patchOption(gi, oi, { imageUrl: url })}
                          previewClassName="h-12 w-12 object-cover rounded-md border"
                        />
                      </div>
                    </div>
                  ))}
                  <button onClick={() => patchGroup(gi, { options: [...g.options, newOption()] })} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    <Plus className="h-3.5 w-3.5" /> Añadir opción
                  </button>
                </div>
              </div>
            ))}

            <button onClick={() => setGroups(prev => [...prev, newGroup()])} className="w-full rounded-xl border border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:bg-muted flex items-center justify-center gap-2">
              <Plus className="h-4 w-4" /> Añadir grupo de modificadores
            </button>
          </div>
        )}

        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted">Cancelar</button>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground disabled:opacity-50">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
