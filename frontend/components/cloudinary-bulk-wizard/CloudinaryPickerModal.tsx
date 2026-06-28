'use client'

/**
 * CloudinaryPickerModal
 *
 * Modal que permite a usuarios normales explorar sus carpetas de Cloudinary,
 * seleccionar múltiples imágenes y lanzar el wizard de creación masiva.
 *
 * Reutiliza: useCloudinaryBrowser (hook existente), misma lógica UI del tab superadmin.
 */

import { useEffect, useState, useMemo } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Cloud, FolderOpen, Search, ArrowLeft, RefreshCw,
  ChevronUp, ChevronDown, ChevronsUpDown, ZoomIn,
  Image as ImageIcon, CheckSquare, Square, Plus, X,
  AlertCircle, Loader2, CheckCircle2, PackageSearch,
} from 'lucide-react'
import { useCloudinaryBrowser, type CloudinaryFolder } from '@/components/superadmin/hooks/useCloudinaryBrowser'
import { api, type CloudinaryImage } from '@/lib/api'
import { CloudinaryBulkWizard } from './CloudinaryBulkWizard'

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

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ImageSkeleton() {
  return <div className="w-10 h-10 rounded bg-muted animate-pulse flex-shrink-0" />
}

// ── Thumbnail lazy ────────────────────────────────────────────────────────────

function Thumbnail({ url, alt, onClick }: { url: string; alt: string; onClick?: () => void }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError]   = useState(false)
  const thumbUrl = url.replace('/upload/', '/upload/w_96,h_96,c_fill,q_auto,f_auto/')

  return (
    <div
      className={`relative w-10 h-10 rounded overflow-hidden flex-shrink-0 cursor-pointer group ${onClick ? 'hover:ring-2 hover:ring-primary' : ''}`}
      onClick={onClick}
    >
      {!loaded && !error && <ImageSkeleton />}
      {error ? (
        <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
          <ImageIcon className="h-3.5 w-3.5 text-muted-foreground/40" />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbUrl}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => { setError(true); setLoaded(true) }}
          className={`w-10 h-10 object-cover rounded transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
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

// ── Sort header ───────────────────────────────────────────────────────────────

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
  const active  = field === currentField
  const nextDir = active && currentDir === 'desc' ? 'asc' : 'desc'
  return (
    <button
      onClick={() => onChange(field, nextDir)}
      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      {label}
      {active
        ? currentDir === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
        : <ChevronsUpDown className="h-3 w-3 opacity-40" />
      }
    </button>
  )
}

// ── Folder selector ───────────────────────────────────────────────────────────

function FolderGrid({
  folders, loading, search, onSearchChange, onExplore, onRefresh,
}: {
  folders: CloudinaryFolder[]
  loading: boolean
  search: string
  onSearchChange: (v: string) => void
  onExplore: (path: string) => void
  onRefresh: () => void
}) {
  const filtered = search
    ? folders.filter(f =>
        f.name.toLowerCase().includes(search.toLowerCase()) ||
        f.path.toLowerCase().includes(search.toLowerCase())
      )
    : folders

  return (
    <div className="flex flex-col gap-4 flex-1 overflow-hidden">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 h-9 text-sm"
            placeholder="Buscar carpeta..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon" className="h-9 w-9" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">{search ? 'Sin resultados' : 'No hay carpetas'}</p>
            {!search && (
              <p className="text-xs mt-1 text-muted-foreground/60">
                Configura Cloudinary Admin API en Superadmin → Integraciones
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {filtered.map(folder => (
              <button
                key={folder.path}
                onClick={() => onExplore(folder.path)}
                className="flex items-center gap-2 p-3 rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/30 transition-all text-left group"
              >
                <FolderOpen className="h-4 w-4 text-muted-foreground group-hover:text-primary flex-shrink-0 transition-colors" />
                <div className="min-w-0">
                  <p className="font-medium text-xs truncate">{folder.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono truncate">{folder.path}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Image table ───────────────────────────────────────────────────────────────

// inventoryMap: secure_url → { id, name } del producto en inventario
type InventoryMap = Map<string, { id: string; name: string }>

// Normaliza la URL para comparar (quita transformaciones de Cloudinary)
function normalizeUrl(url: string): string {
  return url.replace(/\/upload\/[^/]+\//, '/upload/')
}

function ImageTable({
  images, selectedIds, onToggle, sortBy, sortDir, onSort, inventoryMap,
}: {
  images: CloudinaryImage[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  sortBy: SortField
  sortDir: 'asc' | 'desc'
  onSort: (f: SortField, d: 'asc' | 'desc') => void
  inventoryMap: InventoryMap
}) {
  if (images.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground border rounded-lg">
        <ImageIcon className="h-8 w-8 mx-auto mb-3 opacity-20" />
        <p className="text-sm">Sin imágenes en esta carpeta</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border overflow-auto flex-1">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted/60 backdrop-blur">
          <tr className="border-b border-border">
            <th className="px-2 py-2 text-left w-8" />
            <th className="px-2 py-2 text-left w-12" />
            <th className="px-2 py-2 text-left">
              <SortHeader label="Archivo" field="public_id" currentField={sortBy} currentDir={sortDir} onChange={onSort} />
            </th>
            <th className="px-2 py-2 text-center w-28 hidden sm:table-cell text-xs font-medium text-muted-foreground">
              Estado
            </th>
            <th className="px-2 py-2 text-right hidden md:table-cell">
              <SortHeader label="Fecha" field="created_at" currentField={sortBy} currentDir={sortDir} onChange={onSort} />
            </th>
          </tr>
        </thead>
        <tbody>
          {images.map((img, idx) => {
            const selected    = selectedIds.has(img.public_id)
            const normUrl     = normalizeUrl(img.secure_url)
            const invProduct  = inventoryMap.get(normUrl)
            const inInventory = !!invProduct

            return (
              <tr
                key={img.public_id}
                onClick={() => onToggle(img.public_id)}
                className={`border-b border-border/50 cursor-pointer transition-colors hover:bg-accent/20
                  ${selected      ? 'bg-primary/5'    : ''}
                  ${inInventory && !selected ? 'opacity-60'  : ''}
                  ${idx % 2 !== 0 && !selected ? 'bg-muted/10' : ''}
                `}
              >
                <td className="px-2 py-1.5" onClick={e => e.stopPropagation()}>
                  <Checkbox
                    checked={selected}
                    onCheckedChange={() => onToggle(img.public_id)}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Thumbnail url={img.secure_url} alt={img.original_filename} />
                </td>
                <td className="px-2 py-1.5">
                  <p className={`font-medium text-xs truncate max-w-[180px] ${inInventory ? 'text-muted-foreground' : 'text-foreground'}`}>
                    {img.original_filename}
                  </p>
                  {invProduct && (
                    <p className="text-[10px] text-green-600 dark:text-green-400 truncate max-w-[180px]" title={invProduct.name}>
                      ✓ {invProduct.name}
                    </p>
                  )}
                </td>
                <td className="px-2 py-1.5 text-center hidden sm:table-cell">
                  {inInventory ? (
                    <Badge variant="secondary" className="text-[10px] gap-1 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      En inventario
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
                      <PackageSearch className="h-2.5 w-2.5" />
                      Sin importar
                    </Badge>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right text-xs text-muted-foreground whitespace-nowrap hidden md:table-cell">
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

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  onProductsCreated?: (count: number) => void
}

// ── Modal principal ───────────────────────────────────────────────────────────

export function CloudinaryPickerModal({ open, onClose, onProductsCreated }: Props) {
  const browser = useCloudinaryBrowser()
  const [wizardImages, setWizardImages]     = useState<CloudinaryImage[]>([])
  const [wizardOpen, setWizardOpen]         = useState(false)
  // Map de secure_url normalizada → { id, name } para indicar qué imágenes ya están en inventario
  const [inventoryMap, setInventoryMap]     = useState<InventoryMap>(new Map())
  const [inventoryLoading, setInventoryLoading] = useState(false)

  // Cargar carpetas + URLs de inventario al abrir
  useEffect(() => {
    if (!open) return
    if (browser.folders.length === 0 && !browser.foldersLoading) browser.fetchFolders()

    // Cargar URLs del inventario una sola vez por sesión de modal
    if (inventoryMap.size === 0 && !inventoryLoading) {
      setInventoryLoading(true)
      api.getProductImageUrls().then(res => {
        if (res.success && Array.isArray(res.data)) {
          const map: InventoryMap = new Map()
          for (const p of res.data) {
            if (p.imageUrl) map.set(normalizeUrl(p.imageUrl), { id: p.id, name: p.name })
          }
          setInventoryMap(map)
        }
      }).finally(() => setInventoryLoading(false))
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Abrir wizard con las imágenes seleccionadas
  const handleOpenWizard = () => {
    const summary = browser.selectionSummary()
    if (summary.count === 0) return
    setWizardImages(summary.images)
    setWizardOpen(true)
  }

  const handleWizardComplete = (count: number) => {
    setWizardOpen(false)
    browser.clearSelection()
    // Refrescar el mapa de inventario para reflejar los nuevos productos
    api.getProductImageUrls().then(res => {
      if (res.success && Array.isArray(res.data)) {
        const map: InventoryMap = new Map()
        for (const p of res.data) {
          if (p.imageUrl) map.set(normalizeUrl(p.imageUrl), { id: p.id, name: p.name })
        }
        setInventoryMap(map)
      }
    })
    if (onProductsCreated) onProductsCreated(count)
    onClose()
  }

  const summary  = browser.selectionSummary()
  const filtered = browser.filteredImages()

  // Stats de la carpeta actual respecto al inventario
  const folderStats = useMemo(() => {
    const total = filtered.length
    const inInv = filtered.filter(img => inventoryMap.has(normalizeUrl(img.secure_url))).length
    return { total, inInv, missing: total - inInv }
  }, [filtered, inventoryMap])

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent aria-describedby={undefined} className="!w-[min(900px,96vw)] !max-w-none max-h-[92vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 pt-4 pb-3 border-b border-border shrink-0">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
                <Cloud className="h-4 w-4 text-primary" />
                Importar desde Cloudinary
                {browser.activeFolder && (
                  <span className="font-mono text-xs text-muted-foreground ml-1">
                    / {browser.activeFolder}
                  </span>
                )}
              </DialogTitle>

              {/* Resumen inventario — visible cuando hay una carpeta activa */}
              {browser.activeFolder && !browser.imagesLoading && folderStats.total > 0 && (
                <div className="flex items-center gap-2 text-xs shrink-0">
                  {inventoryLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-3 w-3" />
                        {folderStats.inInv} en inventario
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <PackageSearch className="h-3 w-3" />
                        {folderStats.missing} sin importar
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 flex flex-col overflow-hidden px-5 py-4 gap-3 min-h-0">

            {/* Vista: carpetas */}
            {!browser.activeFolder && (
              <FolderGrid
                folders={browser.folders}
                loading={browser.foldersLoading}
                search={browser.folderSearch}
                onSearchChange={browser.setFolderSearch}
                onExplore={browser.exploreFolder}
                onRefresh={browser.fetchFolders}
              />
            )}

            {/* Vista: imágenes de la carpeta */}
            {browser.activeFolder && (
              <>
                {/* Toolbar */}
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <Button variant="ghost" size="sm" onClick={browser.goBack} className="gap-1.5 h-8 text-xs">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Carpetas
                  </Button>

                  <div className="relative flex-1 min-w-[160px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      className="pl-8 h-8 text-xs"
                      placeholder="Filtrar imágenes..."
                      value={browser.imageSearch}
                      onChange={e => browser.setImageSearch(e.target.value)}
                    />
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => summary.count === filtered.length ? browser.clearSelection() : browser.selectAll()}
                  >
                    {summary.count === filtered.length && filtered.length > 0
                      ? <><Square className="h-3.5 w-3.5" /> Deseleccionar</>
                      : <><CheckSquare className="h-3.5 w-3.5" /> Seleccionar todo</>
                    }
                  </Button>

                  {/* Seleccionar solo los que faltan en inventario */}
                  {folderStats.missing > 0 && !inventoryLoading && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5 border-orange-400/40 text-orange-600 dark:text-orange-400 hover:bg-orange-500/5"
                      onClick={() => {
                        browser.clearSelection()
                        filtered
                          .filter(img => !inventoryMap.has(normalizeUrl(img.secure_url)))
                          .forEach(img => browser.toggleSelect(img.public_id))
                      }}
                    >
                      <PackageSearch className="h-3.5 w-3.5" />
                      Sel. faltantes ({folderStats.missing})
                    </Button>
                  )}

                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {filtered.length} de {browser.totalCount}
                  </span>
                </div>

                {/* Loading */}
                {browser.imagesLoading ? (
                  <div className="flex-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando imágenes...
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto flex flex-col gap-2 min-h-0">
                    <ImageTable
                      images={filtered}
                      selectedIds={browser.selectedIds}
                      onToggle={browser.toggleSelect}
                      sortBy={browser.sortBy as SortField}
                      sortDir={browser.sortDir}
                      onSort={(f, d) => browser.changeSort(f as any, d)}
                      inventoryMap={inventoryMap}
                    />

                    {/* Cargar más */}
                    {browser.nextCursor && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-8 text-xs"
                        onClick={browser.loadMore}
                        disabled={browser.loadingMore}
                      >
                        {browser.loadingMore
                          ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando...</>
                          : 'Cargar más imágenes'
                        }
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-border shrink-0 flex items-center justify-between gap-3">
            {/* Resumen selección */}
            {summary.count > 0 ? (
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className="font-semibold text-foreground">{summary.count} seleccionadas</span>
                <span className="text-muted-foreground">· {summary.mb} MB</span>
                {summary.formats.length > 0 && (
                  <span className="text-muted-foreground">
                    · {summary.formats.map(f => f.toUpperCase()).join(', ')}
                  </span>
                )}
                <button
                  onClick={browser.clearSelection}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Limpiar selección"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {browser.activeFolder
                  ? 'Selecciona imágenes para importar'
                  : 'Elige una carpeta para explorar'
                }
              </p>
            )}

            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
                Cancelar
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5"
                disabled={summary.count === 0}
                onClick={handleOpenWizard}
              >
                <Plus className="h-3.5 w-3.5" />
                Crear {summary.count > 0 ? summary.count : ''} producto{summary.count !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Wizard de creación masiva */}
      <CloudinaryBulkWizard
        images={wizardImages}
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onComplete={handleWizardComplete}
      />
    </>
  )
}
