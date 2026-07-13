'use client'

import { useState, useCallback, useRef } from 'react'
import { api, type CloudinaryImage } from '@/lib/api'
import { toast } from 'sonner'

export interface CloudinaryFolder {
  path: string
  name: string
  total_count?: number
}

type SortField = 'created_at' | 'public_id' | 'bytes'
type SortDir   = 'asc' | 'desc'

export function useCloudinaryBrowser() {
  // ── Carpetas ──────────────────────────────────────────────────────────────
  const [folders, setFolders]               = useState<CloudinaryFolder[]>([])
  const [foldersLoading, setFoldersLoading] = useState(false)
  const [folderSearch, setFolderSearch]     = useState('')

  // ── Carpeta activa ────────────────────────────────────────────────────────
  const [activeFolder, setActiveFolder]     = useState<string | null>(null)

  // ── Imágenes ──────────────────────────────────────────────────────────────
  const [images, setImages]                 = useState<CloudinaryImage[]>([])
  const [imagesLoading, setImagesLoading]   = useState(false)
  const [loadingMore, setLoadingMore]       = useState(false)
  const [nextCursor, setNextCursor]         = useState<string | null>(null)
  const [totalCount, setTotalCount]         = useState(0)

  // ── Selección ─────────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set())

  // ── Búsqueda / filtros / orden ────────────────────────────────────────────
  const [imageSearch, setImageSearch]       = useState('')
  const [sortBy, setSortBy]                 = useState<SortField>('created_at')
  const [sortDir, setSortDir]               = useState<SortDir>('desc')

  // ── Zoom modal ────────────────────────────────────────────────────────────
  const [zoomImage, setZoomImage]           = useState<CloudinaryImage | null>(null)

  // ── Rate limit: evitar doble fetch ───────────────────────────────────────
  const fetchingRef = useRef(false)

  // ─────────────────────────────────────────────────────────────────────────
  // Cargar carpetas
  // ─────────────────────────────────────────────────────────────────────────
  const fetchFolders = useCallback(async () => {
    if (foldersLoading) return
    setFoldersLoading(true)
    try {
      const res = await api.getCloudinaryFolders()
      if (res.success && res.data) {
        setFolders((res.data as any).folders ?? res.data ?? [])
      } else {
        toast.error((res as any).error || 'Error al cargar carpetas')
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al cargar carpetas')
    } finally {
      setFoldersLoading(false)
    }
  }, [foldersLoading])

  // ─────────────────────────────────────────────────────────────────────────
  // Explorar carpeta (carga inicial)
  // ─────────────────────────────────────────────────────────────────────────
  const exploreFolder = useCallback(async (folder: string) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setActiveFolder(folder)
    setImages([])
    setSelectedIds(new Set())
    setNextCursor(null)
    setTotalCount(0)
    setImageSearch('')
    setImagesLoading(true)

    try {
      const res = await api.getCloudinaryImages({
        folder,
        max_results: 50,
        sort_by: sortBy,
        direction: sortDir,
      })
      if (res.success && res.data) {
        setImages(res.data.images)
        setNextCursor(res.data.next_cursor)
        setTotalCount(res.data.total_count)
      } else {
        toast.error((res as any).error || 'Error al cargar imágenes')
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al cargar imágenes')
    } finally {
      setImagesLoading(false)
      fetchingRef.current = false
    }
  }, [sortBy, sortDir])

  // ─────────────────────────────────────────────────────────────────────────
  // Cargar más (paginación cursor)
  // ─────────────────────────────────────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (!activeFolder || !nextCursor || loadingMore || fetchingRef.current) return
    fetchingRef.current = true
    setLoadingMore(true)

    try {
      const res = await api.getCloudinaryImages({
        folder: activeFolder,
        next_cursor: nextCursor,
        max_results: 50,
        sort_by: sortBy,
        direction: sortDir,
      })
      if (res.success && res.data) {
        setImages(prev => [...prev, ...res.data!.images])
        setNextCursor(res.data.next_cursor)
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al cargar más imágenes')
    } finally {
      setLoadingMore(false)
      fetchingRef.current = false
    }
  }, [activeFolder, nextCursor, loadingMore, sortBy, sortDir])

  // ─────────────────────────────────────────────────────────────────────────
  // Selección
  // ─────────────────────────────────────────────────────────────────────────
  const toggleSelect = useCallback((publicId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(publicId)) next.delete(publicId)
      else next.add(publicId)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredImages().map(i => i.public_id)))
  }, [images, imageSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  // ─────────────────────────────────────────────────────────────────────────
  // Filtrado client-side (por nombre de archivo)
  // ─────────────────────────────────────────────────────────────────────────
  function filteredImages(): CloudinaryImage[] {
    if (!imageSearch.trim()) return images
    const q = imageSearch.toLowerCase()
    return images.filter(
      img =>
        img.original_filename.toLowerCase().includes(q) ||
        img.public_id.toLowerCase().includes(q) ||
        img.display_name.toLowerCase().includes(q)
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Resumen de selección
  // ─────────────────────────────────────────────────────────────────────────
  function selectionSummary() {
    const selected = images.filter(i => selectedIds.has(i.public_id))
    const totalBytes = selected.reduce((acc, i) => acc + (i.bytes || 0), 0)
    const formats = [...new Set(selected.map(i => i.format).filter(Boolean))]
    return {
      count: selected.length,
      bytes: totalBytes,
      mb: (totalBytes / (1024 * 1024)).toFixed(1),
      formats,
      images: selected,
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Cambiar orden (re-fetch desde el principio)
  // ─────────────────────────────────────────────────────────────────────────
  const changeSort = useCallback((field: SortField, dir: SortDir) => {
    setSortBy(field)
    setSortDir(dir)
    if (activeFolder) {
      // Re-fetch con nuevo orden
      setImages([])
      setNextCursor(null)
      setImagesLoading(true)
      api.getCloudinaryImages({
        folder: activeFolder,
        max_results: 50,
        sort_by: field,
        direction: dir,
      }).then(res => {
        if (res.success && res.data) {
          setImages(res.data.images)
          setNextCursor(res.data.next_cursor)
          setTotalCount(res.data.total_count)
        }
      }).catch(err => toast.error(err.message || 'Error al reordenar'))
        .finally(() => setImagesLoading(false))
    }
  }, [activeFolder])

  // ─────────────────────────────────────────────────────────────────────────
  // Volver al selector de carpetas
  // ─────────────────────────────────────────────────────────────────────────
  const goBack = useCallback(() => {
    setActiveFolder(null)
    setImages([])
    setSelectedIds(new Set())
    setNextCursor(null)
    setTotalCount(0)
    setImageSearch('')
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  // CSV export (client-side)
  // ─────────────────────────────────────────────────────────────────────────
  function exportCSV(onlySelected = false) {
    const rows = onlySelected
      ? images.filter(i => selectedIds.has(i.public_id))
      : filteredImages()

    const header = ['nombre_archivo', 'public_id', 'url', 'folder', 'format', 'width', 'height', 'size_bytes', 'created_at']
    const lines = rows.map(img => [
      img.original_filename,
      img.public_id,
      img.secure_url,
      img.folder,
      img.format,
      img.width,
      img.height,
      img.bytes,
      img.created_at,
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))

    const csv = [header.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cloudinary_${activeFolder || 'images'}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`CSV exportado (${rows.length} imágenes)`)
  }

  return {
    // Carpetas
    folders, foldersLoading, folderSearch, setFolderSearch, fetchFolders,
    // Navegación
    activeFolder, exploreFolder, goBack,
    // Imágenes
    images, imagesLoading, loadingMore, nextCursor, totalCount, loadMore,
    filteredImages,
    // Selección
    selectedIds, toggleSelect, selectAll, clearSelection, selectionSummary,
    // Búsqueda / orden
    imageSearch, setImageSearch,
    sortBy, sortDir, changeSort,
    // Zoom
    zoomImage, setZoomImage,
    // Acciones
    exportCSV,
  }
}
