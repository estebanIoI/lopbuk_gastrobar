'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Cloud, FolderOpen, FolderSearch, ArrowLeft, Download, Plus, Search,
  ChevronUp, ChevronDown, ChevronsUpDown, RefreshCw, ZoomIn, X,
  CheckSquare, Square, Loader2, Image as ImageIcon, AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { useCloudinaryBrowser, type CloudinaryFolder } from '../hooks/useCloudinaryBrowser'
import type { CloudinaryImage } from '@/lib/api'
import { CloudinaryBulkWizard } from '@/components/cloudinary-bulk-wizard/CloudinaryBulkWizard'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: '2-digit' })
}

// ── Skeleton de imagen ────────────────────────────────────────────────────────

function ImageSkeleton() {
  return (
    <div className="w-12 h-12 rounded bg-muted animate-pulse flex-shrink-0" />
  )
}

// ── Miniatura lazy ────────────────────────────────────────────────────────────

function Thumbnail({ url, alt, onClick }: { url: string; alt: string; onClick?: () => void }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError]   = useState(false)

  // Transformación Cloudinary: miniatura 96×96
  const thumbUrl = url.replace('/upload/', '/upload/w_96,h_96,c_fill,q_auto,f_auto/')

  return (
    <div
      className={`relative w-12 h-12 rounded overflow-hidden flex-shrink-0 cursor-pointer group ${onClick ? 'hover:ring-2 hover:ring-primary' : ''}`}
      onClick={onClick}
    >
      {!loaded && !error && <ImageSkeleton />}
      {error ? (
        <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
          <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbUrl}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => { setError(true); setLoaded(true) }}
          className={`w-12 h-12 object-cover rounded transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
      {onClick && loaded && !error && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <ZoomIn className="h-3 w-3 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}
    </div>
  )
}

// ── Cabecera de columna ordenable ─────────────────────────────────────────────

type SortField = 'created_at' | 'public_id' | 'bytes'

function SortHeader({
  label, field, currentField, currentDir, onChange,
}: {
  label: string
  field: SortField
  currentField: SortField
  currentDir: 'asc' | 'desc'
  onChange: (f: SortField, d: 'asc' | 'desc') => void
}) {
  const active = field === currentField
  const nextDir = active && currentDir === 'desc' ? 'asc' : 'desc'

  return (
    <button
      onClick={() => onChange(field, nextDir)}
      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      {label}
      {active
        ? currentDir === 'desc'
          ? <ChevronDown className="h-3 w-3" />
          : <ChevronUp className="h-3 w-3" />
        : <ChevronsUpDown className="h-3 w-3 opacity-40" />
      }
    </button>
  )
}

// ── Modal zoom ────────────────────────────────────────────────────────────────

function ZoomModal({ image, onClose }: { image: CloudinaryImage; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-medium truncate">
            <ImageIcon className="h-4 w-4 flex-shrink-0" />
            {image.original_filename}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {/* Imagen grande */}
          <div className="rounded-lg overflow-hidden bg-muted flex items-center justify-center max-h-[60vh]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.secure_url.replace('/upload/', '/upload/w_800,q_auto,f_auto/')}
              alt={image.original_filename}
              className="max-h-[60vh] w-auto object-contain"
            />
          </div>
          {/* Metadatos */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            {[
              { label: 'Public ID',    value: image.public_id },
              { label: 'Formato',      value: image.format?.toUpperCase() },
              { label: 'Resolución',   value: image.width && image.height ? `${image.width}×${image.height}` : '—' },
              { label: 'Tamaño',       value: formatBytes(image.bytes) },
              { label: 'Carpeta',      value: image.folder },
              { label: 'Creado',       value: formatDate(image.created_at) },
            ].map(({ label, value }) => (
              <div key={label} className="space-y-0.5">
                <p className="text-muted-foreground">{label}</p>
                <p className="font-mono truncate">{value || '—'}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={image.secure_url} target="_blank" rel="noopener noreferrer">
                Abrir en Cloudinary
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Vista: selector de carpetas ───────────────────────────────────────────────

function FolderSelector({
  folders, loading, search, onSearchChange,
  onExplore, onRefresh,
}: {
  folders: CloudinaryFolder[]
  loading: boolean
  search: string
  onSearchChange: (v: string) => void
  onExplore: (path: string) => void
  onRefresh: () => void
}) {
  const filtered = search
    ? folders.filter(f => f.name.toLowerCase().includes(search.toLowerCase()) || f.path.toLowerCase().includes(search.toLowerCase()))
    : folders

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar carpeta..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{search ? 'Sin resultados' : 'No hay carpetas disponibles'}</p>
          {!search && (
            <p className="text-xs mt-1">
              Verifica que tengas API Key y API Secret configurados en Integraciones.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(folder => (
            <button
              key={folder.path}
              onClick={() => onExplore(folder.path)}
              className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/30 transition-all text-left group"
            >
              <FolderOpen className="h-5 w-5 text-muted-foreground group-hover:text-primary flex-shrink-0 transition-colors" />
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{folder.name}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">{folder.path}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Vista: tabla de imágenes ──────────────────────────────────────────────────

function ImageTable({
  images, selectedIds, onToggle, onZoom, sortBy, sortDir, onSort,
}: {
  images: CloudinaryImage[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onZoom: (img: CloudinaryImage) => void
  sortBy: SortField
  sortDir: 'asc' | 'desc'
  onSort: (f: SortField, d: 'asc' | 'desc') => void
}) {
  if (images.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground border rounded-lg">
        <ImageIcon className="h-8 w-8 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Sin imágenes en esta carpeta</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-3 py-2.5 text-left w-8" />
            <th className="px-3 py-2.5 text-left">Imagen</th>
            <th className="px-3 py-2.5 text-left">
              <SortHeader label="Archivo" field="public_id" currentField={sortBy} currentDir={sortDir} onChange={onSort} />
            </th>
            <th className="px-3 py-2.5 text-left hidden lg:table-cell">
              <span className="text-xs font-medium text-muted-foreground">Public ID</span>
            </th>
            <th className="px-3 py-2.5 text-left hidden md:table-cell">
              <span className="text-xs font-medium text-muted-foreground">Resolución</span>
            </th>
            <th className="px-3 py-2.5 text-right">
              <SortHeader label="Tamaño" field="bytes" currentField={sortBy} currentDir={sortDir} onChange={onSort} />
            </th>
            <th className="px-3 py-2.5 text-right hidden sm:table-cell">
              <SortHeader label="Fecha" field="created_at" currentField={sortBy} currentDir={sortDir} onChange={onSort} />
            </th>
          </tr>
        </thead>
        <tbody>
          {images.map((img, idx) => {
            const selected = selectedIds.has(img.public_id)
            return (
              <tr
                key={img.public_id}
                className={`border-b border-border/60 hover:bg-accent/30 transition-colors ${selected ? 'bg-primary/5' : idx % 2 === 0 ? '' : 'bg-muted/10'}`}
              >
                <td className="px-3 py-2">
                  <Checkbox
                    checked={selected}
                    onCheckedChange={() => onToggle(img.public_id)}
                  />
                </td>
                <td className="px-3 py-2">
                  <Thumbnail url={img.secure_url} alt={img.original_filename} onClick={() => onZoom(img)} />
                </td>
                <td className="px-3 py-2">
                  <div>
                    <p className="font-medium truncate max-w-[200px]">{img.original_filename}</p>
                    <p className="text-xs text-muted-foreground">{img.format?.toUpperCase()}</p>
                  </div>
                </td>
                <td className="px-3 py-2 hidden lg:table-cell">
                  <p className="font-mono text-xs text-muted-foreground truncate max-w-[180px]">{img.public_id}</p>
                </td>
                <td className="px-3 py-2 hidden md:table-cell">
                  <span className="text-xs text-muted-foreground">
                    {img.width && img.height ? `${img.width}×${img.height}` : '—'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-xs text-muted-foreground whitespace-nowrap">
                  {formatBytes(img.bytes)}
                </td>
                <td className="px-3 py-2 text-right text-xs text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                  {formatDate(img.created_at)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function CloudinaryImportTab() {
  const browser = useCloudinaryBrowser()
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Cargar carpetas al montar
  useEffect(() => {
    browser.fetchFolders()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = browser.filteredImages()
  const summary  = browser.selectionSummary()
  const allFilteredSelected =
    filtered.length > 0 && filtered.every(img => browser.selectedIds.has(img.public_id))

  const toggleSelectAll = useCallback(() => {
    if (allFilteredSelected) {
      browser.clearSelection()
    } else {
      browser.selectAll()
    }
  }, [allFilteredSelected, browser])

  // ── Vista: explorador de imágenes ─────────────────────────────────────────
  if (browser.activeFolder) {
    return (
      <div className="space-y-5">

        {/* Barra superior */}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" onClick={browser.goBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
          <div className="flex items-center gap-2 text-sm">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{browser.activeFolder}</span>
            <Badge variant="secondary">{browser.totalCount} imágenes</Badge>
          </div>
        </div>

        {/* Resumen */}
        {browser.images.length > 0 && (
          <Card className="border-border">
            <CardContent className="py-3 px-4">
              <div className="flex flex-wrap gap-4 text-sm">
                <span><span className="text-muted-foreground">Total:</span> <strong>{browser.totalCount}</strong></span>
                <span><span className="text-muted-foreground">Cargadas:</span> <strong>{browser.images.length}</strong></span>
                <span><span className="text-muted-foreground">Seleccionadas:</span> <strong>{summary.count}</strong></span>
                {summary.count > 0 && (
                  <>
                    <span><span className="text-muted-foreground">Peso sel.:</span> <strong>{summary.mb} MB</strong></span>
                    {summary.formats.length > 0 && (
                      <span><span className="text-muted-foreground">Formatos:</span> <strong>{summary.formats.join(', ')}</strong></span>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Seleccionar todo */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleSelectAll}
            className="gap-2"
            disabled={browser.imagesLoading}
          >
            {allFilteredSelected
              ? <CheckSquare className="h-4 w-4" />
              : <Square className="h-4 w-4" />
            }
            {allFilteredSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
          </Button>

          {/* Búsqueda */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 h-9"
              placeholder="Buscar imagen..."
              value={browser.imageSearch}
              onChange={e => browser.setImageSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Exportar CSV */}
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={browser.imagesLoading || browser.images.length === 0}
              onClick={() => browser.exportCSV(summary.count > 0)}
            >
              <Download className="h-4 w-4" />
              {summary.count > 0 ? `CSV (${summary.count} sel.)` : 'Descargar CSV'}
            </Button>

            {/* Crear productos */}
            <Button
              size="sm"
              className="gap-2"
              disabled={summary.count === 0}
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="h-4 w-4" />
              Crear productos ({summary.count})
            </Button>
          </div>
        </div>

        {/* Tabla */}
        {browser.imagesLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-14 rounded bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <ImageTable
            images={filtered}
            selectedIds={browser.selectedIds}
            onToggle={browser.toggleSelect}
            onZoom={browser.setZoomImage}
            sortBy={browser.sortBy as SortField}
            sortDir={browser.sortDir}
            onSort={browser.changeSort}
          />
        )}

        {/* Cargar más */}
        {browser.nextCursor && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              onClick={browser.loadMore}
              disabled={browser.loadingMore}
              className="gap-2"
            >
              {browser.loadingMore
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <RefreshCw className="h-4 w-4" />
              }
              Cargar más ({browser.images.length} / {browser.totalCount})
            </Button>
          </div>
        )}

        {/* Zoom modal */}
        {browser.zoomImage && (
          <ZoomModal image={browser.zoomImage} onClose={() => browser.setZoomImage(null)} />
        )}

        {/* Wizard crear productos */}
        <CloudinaryBulkWizard
          images={summary.images}
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onComplete={() => { setShowCreateModal(false); browser.clearSelection() }}
        />
      </div>
    )
  }

  // ── Vista: selector de carpetas ────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Cloud className="h-5 w-5 text-muted-foreground" />
          Importar desde Cloudinary
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Explora imágenes ya almacenadas en tu cuenta de Cloudinary para exportarlas o crear productos.
        </p>
      </div>

      {/* Aviso si no hay carpetas y no está cargando */}
      {!browser.foldersLoading && browser.folders.length === 0 && !browser.folderSearch && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-4 px-4 flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-400">Sin credenciales Admin API</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Para explorar Cloudinary necesitas configurar <strong>API Key</strong> y <strong>API Secret</strong> en la pestaña
                de Integraciones. Puedes encontrarlos en tu Dashboard de Cloudinary.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <FolderSelector
        folders={browser.folders}
        loading={browser.foldersLoading}
        search={browser.folderSearch}
        onSearchChange={browser.setFolderSearch}
        onExplore={browser.exploreFolder}
        onRefresh={browser.fetchFolders}
      />
    </div>
  )
}
