'use client'

import { useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { useStore } from '@/lib/store'
import { Upload, CheckCircle2, XCircle, AlertTriangle, Loader2, Images, FolderOpen } from 'lucide-react'
import { toast } from 'sonner'

const CLOUDINARY_API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

// ── helpers ──────────────────────────────────────────────────────────────────

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9\s]/g, '')     // remove symbols
    .replace(/\s+/g, ' ')
    .trim()
}

async function getCloudinaryConfig(): Promise<{ cloudName: string; uploadPreset: string }> {
  try {
    const res = await fetch(`${CLOUDINARY_API}/chatbot/cloudinary-config`, { credentials: 'include' })
    if (res.ok) {
      const json = await res.json()
      if (json.success && json.data?.cloudinaryCloudName) {
        return { cloudName: json.data.cloudinaryCloudName, uploadPreset: json.data.cloudinaryUploadPreset }
      }
    }
  } catch { /* fallback */ }
  return {
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '',
    uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '',
  }
}

async function uploadToCloudinary(file: File, cloudName: string, uploadPreset: string): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', uploadPreset)
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err?.error?.message || 'Error al subir a Cloudinary')
  }
  const data = await res.json()
  return data.secure_url
}

// ── types ─────────────────────────────────────────────────────────────────────

type MatchStatus = 'matched' | 'unmatched' | 'uploading' | 'done' | 'error'

interface ImageRow {
  file: File
  fileName: string        // original filename without extension
  matchedProductId: string | null
  matchedProductName: string | null
  status: MatchStatus
  url: string | null
  error: string | null
}

// ── component ─────────────────────────────────────────────────────────────────

export function BulkImageUploadDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { products, fetchProducts, categories } = useStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ImageRow[]>([])
  const [processing, setProcessing] = useState(false)
  const [cloudConfig, setCloudConfig] = useState<{ cloudName: string; uploadPreset: string } | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Products filtered by selected category
  const scopedProducts = selectedCategory === 'all'
    ? products
    : products.filter(p => p.category === selectedCategory)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const config = cloudConfig ?? await getCloudinaryConfig()
    if (!cloudConfig) setCloudConfig(config)

    const newRows: ImageRow[] = Array.from(files).map(file => {
      const fileName = file.name.replace(/\.[^/.]+$/, '') // remove extension
      const normFile = normalize(fileName)

      // Search only within scoped products (filtered by category)
      let matched = scopedProducts.find(p => normalize(p.name) === normFile) ?? null
      if (!matched) matched = scopedProducts.find(p => normalize(p.name).includes(normFile) || normFile.includes(normalize(p.name))) ?? null

      return {
        file,
        fileName,
        matchedProductId: matched?.id ?? null,
        matchedProductName: matched?.name ?? null,
        status: matched ? 'matched' : 'unmatched',
        url: null,
        error: null,
      }
    })

    setRows(prev => [...prev, ...newRows])
  }

  const handleProcess = async () => {
    const toProcess = rows.filter(r => r.status === 'matched')
    if (toProcess.length === 0) return

    const config = cloudConfig ?? await getCloudinaryConfig()
    if (!config.cloudName || !config.uploadPreset) {
      toast.error('Cloudinary no configurado — configura las credenciales en Integraciones')
      return
    }

    setProcessing(true)

    for (const row of toProcess) {
      setRows(prev => prev.map(r => r.file === row.file ? { ...r, status: 'uploading' } : r))
      try {
        const url = await uploadToCloudinary(row.file, config.cloudName, config.uploadPreset)

        // Find the current product to check if it already has a main image
        const product = scopedProducts.find(p => p.id === row.matchedProductId)
        let updatePayload: Record<string, unknown>

        if (product?.imageUrl) {
          // Already has main image → add to gallery (images array)
          const currentGallery: string[] = Array.isArray(product.images) ? product.images : []
          updatePayload = { images: [...currentGallery, url] }
        } else {
          // No main image → set as main
          updatePayload = { imageUrl: url }
        }

        await api.updateProduct(row.matchedProductId!, updatePayload)
        setRows(prev => prev.map(r => r.file === row.file ? { ...r, status: 'done', url } : r))
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error desconocido'
        setRows(prev => prev.map(r => r.file === row.file ? { ...r, status: 'error', error: msg } : r))
      }
    }

    await fetchProducts()
    setProcessing(false)
    const done = rows.filter(r => r.status === 'done').length + toProcess.length
    toast.success(`${toProcess.length} imágenes procesadas`)
  }

  const handleClose = () => {
    if (processing) return
    setRows([])
    onOpenChange(false)
  }

  const matched = rows.filter(r => r.status === 'matched').length
  const unmatched = rows.filter(r => r.status === 'unmatched').length
  const done = rows.filter(r => r.status === 'done').length
  const errors = rows.filter(r => r.status === 'error').length
  const uploading = rows.filter(r => r.status === 'uploading').length

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Images className="h-5 w-5" />
            Carga masiva de imágenes
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground -mt-1">
          Selecciona las imágenes de tus carpetas. Cada archivo debe tener el mismo nombre que el producto en inventario (sin importar mayúsculas ni tildes).
        </p>

        {/* Category filter */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-medium shrink-0">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            Carpeta / Categoría:
          </div>
          <Select
            value={selectedCategory}
            onValueChange={v => { setSelectedCategory(v); setRows([]) }}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Todas las categorías" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.name}>
                  {cat.name} ({products.filter(p => p.category === cat.name).length} productos)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedCategory !== 'all' && (
            <span className="text-xs text-muted-foreground">
              Buscando en <strong>{scopedProducts.length}</strong> productos
            </span>
          )}
        </div>

        {/* Drop / select zone */}
        <div
          className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
        >
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">Arrastra imágenes aquí o haz click para seleccionar</p>
          <p className="text-xs text-muted-foreground mt-1">Puedes seleccionar múltiples archivos de una sola vez</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
        </div>

        {/* Summary */}
        {rows.length > 0 && (
          <div className="flex gap-4 text-xs flex-wrap">
            <span className="flex items-center gap-1 text-muted-foreground"><span className="font-semibold text-foreground">{rows.length}</span> total</span>
            {matched > 0 && <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3.5 w-3.5" />{matched} coinciden</span>}
            {unmatched > 0 && <span className="flex items-center gap-1 text-amber-500"><AlertTriangle className="h-3.5 w-3.5" />{unmatched} sin coincidencia</span>}
            {done > 0 && <span className="flex items-center gap-1 text-blue-500"><CheckCircle2 className="h-3.5 w-3.5" />{done} completados</span>}
            {errors > 0 && <span className="flex items-center gap-1 text-destructive"><XCircle className="h-3.5 w-3.5" />{errors} errores</span>}
          </div>
        )}

        {/* Table */}
        {rows.length > 0 && (
          <div className="flex-1 overflow-y-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Archivo</th>
                  <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Producto encontrado</th>
                  <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground w-28">Destino</th>
                  <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground w-24">Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs truncate max-w-[200px]" title={row.fileName}>
                      {row.fileName}
                    </td>
                    <td className="px-3 py-2">
                      {row.matchedProductName ? (
                        <span className="text-sm">{row.matchedProductName}</span>
                      ) : (
                        <span className="text-xs text-amber-500 italic">Sin coincidencia</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.matchedProductId ? (() => {
                        const p = scopedProducts.find(x => x.id === row.matchedProductId)
                        return p?.imageUrl
                          ? <span className="text-xs text-blue-500">+ Galería</span>
                          : <span className="text-xs text-green-600">★ Principal</span>
                      })() : null}
                    </td>
                    <td className="px-3 py-2">
                      {row.status === 'matched' && (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Listo
                        </span>
                      )}
                      {row.status === 'unmatched' && (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-500">
                          <AlertTriangle className="h-3.5 w-3.5" /> No encontrado
                        </span>
                      )}
                      {row.status === 'uploading' && (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-500">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Subiendo...
                        </span>
                      )}
                      {row.status === 'done' && (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Completado
                        </span>
                      )}
                      {row.status === 'error' && (
                        <span className="inline-flex items-center gap-1 text-xs text-destructive" title={row.error ?? ''}>
                          <XCircle className="h-3.5 w-3.5" /> Error
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={() => setRows([])} disabled={processing || rows.length === 0}>
            Limpiar lista
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} disabled={processing}>
              Cancelar
            </Button>
            <Button
              onClick={handleProcess}
              disabled={processing || matched === 0}
            >
              {processing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Procesando...</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" />Subir {matched} imagen{matched !== 1 ? 'es' : ''}</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
