'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, XCircle, Package } from 'lucide-react'
import { api, type CloudinaryImage } from '@/lib/api'
import { toast } from 'sonner'

// ── Helpers ───────────────────────────────────────────────────────────────────

function suggestName(img: CloudinaryImage): string {
  // Toma el filename, reemplaza guiones/guiones bajos por espacios y capitaliza
  return (img.original_filename || img.public_id?.split('/').pop() || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim()
}

type RowStatus = 'pending' | 'creating' | 'done' | 'error'

interface ProductRow {
  image: CloudinaryImage
  name: string
  category: string
  price: string
  status: RowStatus
  error: string | null
}

// ── Componente ────────────────────────────────────────────────────────────────

export function CreateProductsModal({
  images,
  onClose,
}: {
  images: CloudinaryImage[]
  onClose: () => void
}) {
  const [rows, setRows]               = useState<ProductRow[]>(
    images.map(img => ({
      image: img,
      name: suggestName(img),
      category: '',
      price: '0',
      status: 'pending',
      error: null,
    }))
  )
  const [categories, setCategories]   = useState<any[]>([])
  const [creating, setCreating]       = useState(false)

  // ── Edición masiva ─────────────────────────────────────────────────────────
  const [bulkCategory, setBulkCategory] = useState('')
  const [bulkPrice, setBulkPrice]       = useState('')

  useEffect(() => {
    api.getCategories().then(r => {
      if (r.success && Array.isArray(r.data)) setCategories(r.data)
    })
  }, [])

  const applyBulk = () => {
    setRows(prev => prev.map(r => ({
      ...r,
      category: bulkCategory || r.category,
      price: bulkPrice || r.price,
    })))
  }

  const updateRow = (idx: number, field: keyof ProductRow, value: string) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  // ── Crear todos ────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    const pending = rows.filter(r => r.status === 'pending')
    if (pending.length === 0) return

    // Validación básica
    const invalid = pending.find(r => !r.name.trim())
    if (invalid) {
      toast.error('Todos los productos deben tener un nombre')
      return
    }

    setCreating(true)

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (row.status !== 'pending') continue

      setRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'creating' } : r))

      try {
        const payload: any = {
          name: row.name.trim(),
          price: Number(row.price) || 0,
          imageUrl: row.image.secure_url,
          stock: 0,
          is_active: 1,
        }
        if (row.category) payload.category = row.category

        const res = await api.createProduct(payload)
        if (res.success) {
          setRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'done' } : r))
        } else {
          throw new Error((res as any).error || 'Error al crear producto')
        }
      } catch (err: any) {
        setRows(prev => prev.map((r, idx) =>
          idx === i ? { ...r, status: 'error', error: err.message || 'Error' } : r
        ))
      }
    }

    setCreating(false)
    const done  = rows.filter(r => r.status === 'done').length
    const errors = rows.filter(r => r.status === 'error').length
    if (done > 0) toast.success(`${done} productos creados`)
    if (errors > 0) toast.error(`${errors} productos fallaron`)
  }

  const pendingCount = rows.filter(r => r.status === 'pending').length
  const doneCount    = rows.filter(r => r.status === 'done').length

  return (
    <Dialog open onOpenChange={creating ? undefined : onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Crear productos desde Cloudinary ({images.length} imágenes)
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {/* Edición masiva */}
          <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg bg-secondary/40 border border-border">
            <div className="text-xs font-medium text-muted-foreground self-center">Edición masiva:</div>
            <div className="flex-1 min-w-[140px]">
              <Select value={bulkCategory} onValueChange={setBulkCategory}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Categoría..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-28">
              <Input
                type="number"
                min={0}
                placeholder="Precio..."
                value={bulkPrice}
                onChange={e => setBulkPrice(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <Button size="sm" variant="outline" onClick={applyBulk} className="h-8 text-xs">
              Aplicar a todos
            </Button>
          </div>

          {/* Tabla de filas */}
          <div className="rounded-lg border border-border overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Imagen</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Nombre</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground w-40">Categoría</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground w-24">Precio</th>
                  <th className="px-3 py-2.5 text-center text-xs font-medium text-muted-foreground w-16">Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.image.public_id} className="border-b border-border/60 hover:bg-accent/20">
                    <td className="px-3 py-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={row.image.secure_url.replace('/upload/', '/upload/w_48,h_48,c_fill,q_auto,f_auto/')}
                        alt={row.image.original_filename}
                        className="w-10 h-10 object-cover rounded"
                        loading="lazy"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={row.name}
                        onChange={e => updateRow(idx, 'name', e.target.value)}
                        disabled={row.status !== 'pending'}
                        className="h-8 text-xs"
                        placeholder="Nombre del producto"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Select
                        value={row.category}
                        onValueChange={v => updateRow(idx, 'category', v)}
                        disabled={row.status !== 'pending'}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Sin categoría" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Sin categoría</SelectItem>
                          {categories.map(c => (
                            <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min={0}
                        value={row.price}
                        onChange={e => updateRow(idx, 'price', e.target.value)}
                        disabled={row.status !== 'pending'}
                        className="h-8 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.status === 'pending'  && <Badge variant="secondary" className="text-xs">Pendiente</Badge>}
                      {row.status === 'creating' && <Loader2 className="h-4 w-4 animate-spin mx-auto text-primary" />}
                      {row.status === 'done'     && <CheckCircle2 className="h-4 w-4 mx-auto text-green-500" />}
                      {row.status === 'error'    && (
                        <div title={row.error || ''}>
                          <XCircle className="h-4 w-4 mx-auto text-destructive" />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={creating}>
            {doneCount > 0 ? 'Cerrar' : 'Cancelar'}
          </Button>
          <Button onClick={handleCreate} disabled={creating || pendingCount === 0} className="gap-2">
            {creating
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando...</>
              : <>Crear {pendingCount} productos</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
