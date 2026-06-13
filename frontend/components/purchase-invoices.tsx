'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import type { Product, PurchaseInvoice, PurchaseInvoiceItem, Supplier } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CloudinaryUpload } from '@/components/ui/cloudinary-upload'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ShoppingBag,
  Plus,
  Trash2,
  Eye,
  Search,
  Package,
  X,
  TrendingDown,
  Smartphone,
  Loader2,
  Users,
  UserPlus,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  CheckCircle,
  ChevronRight,
  CalendarClock,
  Paperclip,
  Hash,
  RefreshCw,
  Info,
  AlertCircle,
  Camera,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { toast } from 'sonner'
import { RemoteScanner } from '@/components/remote-scanner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface NewInvoiceItem {
  productId: string
  productName: string
  productSku: string
  quantity: number
  unitCost: number
  lastPurchasePrice?: number
}

// Ítem detectado por OCR que aún no coincide con un producto del inventario
interface PendingItem {
  tempId: string
  description: string
  quantity: number
  unitCost: number
}

interface NewInvoiceForm {
  invoiceNumber: string
  supplierName: string
  supplierId: string
  purchaseDate: string
  documentType: 'factura' | 'remision' | 'orden_compra' | 'nota_credito'
  paymentMethod: string
  paymentStatus: 'pagado' | 'pendiente' | 'parcial'
  dueDate: string
  fileUrl: string
  discount: string
  notes: string
  items: NewInvoiceItem[]
}

interface NewSupplierForm {
  name: string
  contactName: string
  phone: string
  email: string
  city: string
  address: string
  taxId: string
  paymentTerms: string
  notes: string
}

interface SupplierStats {
  totalFacturas: number
  totalComprado: number
  ultimaCompra: string | null
  facturasPendientes: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CREDIT_METHODS = ['credito_proveedor']

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  credito_proveedor: 'Crédito proveedor',
  mixto: 'Mixto',
  credito: 'Crédito',
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  factura: 'Factura',
  remision: 'Remisión',
  orden_compra: 'Orden de compra',
  nota_credito: 'Nota crédito proveedor',
}

const emptyForm = (): NewInvoiceForm => ({
  invoiceNumber: '',
  supplierName: '',
  supplierId: '',
  purchaseDate: new Date().toISOString().split('T')[0],
  documentType: 'factura',
  paymentMethod: 'efectivo',
  paymentStatus: 'pagado',
  dueDate: '',
  fileUrl: '',
  discount: '0',
  notes: '',
  items: [],
})

const emptySupplierForm = (): NewSupplierForm => ({
  name: '',
  contactName: '',
  phone: '',
  email: '',
  city: '',
  address: '',
  taxId: '',
  paymentTerms: '',
  notes: '',
})

const genTempId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `pi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

// Reduce la imagen a máx. 1600px y la convierte a JPEG (data URL) para no exceder
// el límite del backend y acelerar el OCR.
async function fileToDownscaledDataUrl(file: File, maxSize = 1600, quality = 0.72): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
  return new Promise<string>((resolve) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(dataUrl); return }
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

// ─── Supplier Info Card (shown inline in form when supplier selected) ──────────

function SupplierInfoCard({ supplier, stats }: { supplier: Supplier; stats: SupplierStats | null }) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
        <span className="font-semibold text-sm text-blue-900 dark:text-blue-200">{supplier.name}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-blue-800 dark:text-blue-300">
        {supplier.taxId && <span className="flex items-center gap-1"><Hash className="h-3 w-3" /> NIT: {supplier.taxId}</span>}
        {supplier.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {supplier.city}</span>}
        {supplier.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {supplier.phone}</span>}
        {supplier.paymentTerms && <span className="flex items-center gap-1 col-span-2"><Info className="h-3 w-3" /> {supplier.paymentTerms}</span>}
      </div>
      {stats && (
        <div className="flex gap-4 pt-1 border-t border-blue-200 dark:border-blue-700 flex-wrap">
          <div className="text-xs">
            <span className="text-blue-600 dark:text-blue-400">Compras totales:</span>
            <span className="font-semibold ml-1 text-blue-900 dark:text-blue-200">{formatCOP(stats.totalComprado)}</span>
          </div>
          {stats.ultimaCompra && (
            <div className="text-xs">
              <span className="text-blue-600 dark:text-blue-400">Última compra:</span>
              <span className="font-semibold ml-1 text-blue-900 dark:text-blue-200">
                {new Date(stats.ultimaCompra).toLocaleDateString('es-CO')}
              </span>
            </div>
          )}
          {stats.facturasPendientes > 0 && (
            <div className="text-xs flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-yellow-500" />
              <span className="text-yellow-700 dark:text-yellow-400 font-semibold">{stats.facturasPendientes} factura(s) pendiente(s)</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PurchaseInvoices() {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showDetail, setShowDetail] = useState<PurchaseInvoice | null>(null)
  const [form, setForm] = useState<NewInvoiceForm>(emptyForm())
  const [productSearch, setProductSearch] = useState('')
  const [productSearchResults, setProductSearchResults] = useState<Product[]>([])
  const [showProductDropdown, setShowProductDropdown] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [showRemoteScanner, setShowRemoteScanner] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 })
  const [loadingInvoiceNumber, setLoadingInvoiceNumber] = useState(false)

  // Supplier panel state
  const [showSupplierPanel, setShowSupplierPanel] = useState(false)
  const [selectedSupplierDetail, setSelectedSupplierDetail] = useState<Supplier | null>(null)
  const [showNewSupplierForm, setShowNewSupplierForm] = useState(false)
  const [supplierForm, setSupplierForm] = useState<NewSupplierForm>(emptySupplierForm())
  const [supplierFormError, setSupplierFormError] = useState<string | null>(null)
  const [savingSupplier, setSavingSupplier] = useState(false)
  const [supplierSaved, setSupplierSaved] = useState(false)

  // Inline supplier stats in form
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [supplierStats, setSupplierStats] = useState<SupplierStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  // Show quick-create supplier inside form
  const [showQuickSupplier, setShowQuickSupplier] = useState(false)
  const [quickSupplierForm, setQuickSupplierForm] = useState<NewSupplierForm>(emptySupplierForm())
  const [quickSupplierError, setQuickSupplierError] = useState<string | null>(null)
  const [savingQuickSupplier, setSavingQuickSupplier] = useState(false)

  const searchContainerRef = useRef<HTMLDivElement>(null)

  // ── OCR con IA ──
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const [ocrProvider, setOcrProvider] = useState<string | null>(null)
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([])
  // Asignación de un pending item a un producto existente (búsqueda inline)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [assignSearch, setAssignSearch] = useState('')
  const [assignResults, setAssignResults] = useState<Product[]>([])
  const [assignLoading, setAssignLoading] = useState(false)
  // Crear producto desde un pending item
  const [creatingId, setCreatingId] = useState<string | null>(null)
  const [creatingCategory, setCreatingCategory] = useState('')
  const [creatingSalePrice, setCreatingSalePrice] = useState('')
  const [savingProduct, setSavingProduct] = useState(false)
  const ocrFileInputRef = useRef<HTMLInputElement>(null)

  const loadData = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const [invRes, suppRes, catRes] = await Promise.all([
        api.getPurchaseInvoices({ page, limit: 20 }),
        api.getPurchaseSuppliers(),
        api.getCategories(),
      ])
      if (invRes.success) {
        setInvoices(invRes.data || [])
        if (invRes.pagination) setPagination(invRes.pagination)
      }
      if (suppRes.success && suppRes.data) {
        setSuppliers(suppRes.data as Supplier[])
      }
      if (catRes.success && Array.isArray(catRes.data)) {
        setCategories((catRes.data as any[]).map(c => ({ id: c.id, name: c.name })))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Click-outside for product search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowProductDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Product search with debounce
  useEffect(() => {
    if (!productSearch.trim()) {
      setProductSearchResults([])
      setSearchLoading(false)
      return
    }
    setSearchLoading(true)
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await api.getProducts({ search: productSearch.trim(), limit: 10 })
        if (!controller.signal.aborted) {
          const products = Array.isArray((res as any).data)
            ? (res as any).data
            : ((res as any).products ?? (res as any).data?.products ?? [])
          setProductSearchResults(res.success ? products.slice(0, 8) : [])
          setSearchLoading(false)
        }
      } catch {
        if (!controller.signal.aborted) { setProductSearchResults([]); setSearchLoading(false) }
      }
    }, 300)
    return () => { clearTimeout(timer); controller.abort() }
  }, [productSearch])

  // Auto payment status based on payment method
  const handlePaymentMethodChange = (method: string) => {
    const autoStatus = CREDIT_METHODS.includes(method) ? 'pendiente' : 'pagado'
    setForm(p => ({ ...p, paymentMethod: method, paymentStatus: autoStatus }))
  }

  // Auto-generate invoice number
  const generateInvoiceNumber = async () => {
    setLoadingInvoiceNumber(true)
    const res = await api.getNextPurchaseInvoiceNumber()
    if (res.success && res.data) {
      setForm(p => ({ ...p, invoiceNumber: res.data as string }))
    }
    setLoadingInvoiceNumber(false)
  }

  // Open form with auto invoice number
  const openForm = async () => {
    const newForm = emptyForm()
    setForm(newForm)
    setError(null)
    setSelectedSupplier(null)
    setSupplierStats(null)
    setShowQuickSupplier(false)
    setPendingItems([])
    setOcrError(null)
    setOcrProvider(null)
    setCreatingId(null)
    setAssigningId(null)
    setShowForm(true)
    // Load auto number in background
    setLoadingInvoiceNumber(true)
    const res = await api.getNextPurchaseInvoiceNumber()
    if (res.success && res.data) {
      setForm(p => ({ ...p, invoiceNumber: res.data as string }))
    }
    setLoadingInvoiceNumber(false)
  }

  // Handle supplier selection in form — autocomplete fields + load stats
  const handleSupplierSelect = async (supplierId: string) => {
    if (supplierId === '__manual__') {
      setForm(p => ({ ...p, supplierId: '', supplierName: '' }))
      setSelectedSupplier(null)
      setSupplierStats(null)
      return
    }
    if (supplierId === '__new__') {
      setShowQuickSupplier(true)
      return
    }
    const sup = suppliers.find(s => s.id === supplierId)
    if (sup) {
      setForm(p => ({ ...p, supplierId: sup.id, supplierName: sup.name }))
      setSelectedSupplier(sup)
      // Load stats
      setLoadingStats(true)
      const res = await api.getPurchaseSupplierStats(sup.id)
      if (res.success && res.data) setSupplierStats(res.data)
      setLoadingStats(false)
    }
  }

  const handleScannedBarcode = (barcode: string) => {
    setProductSearch(barcode)
    setShowProductDropdown(true)
    setShowRemoteScanner(false)
  }

  // ── OCR: capturar/subir foto de la factura ──
  const triggerOcrPicker = () => {
    setOcrError(null)
    ocrFileInputRef.current?.click()
  }

  const applyOcrResult = (data: NonNullable<Awaited<ReturnType<typeof api.ocrPurchaseInvoice>>['data']>) => {
    const { header, supplier, items } = data
    setOcrProvider(data.provider)

    // Cabecera
    setForm(prev => {
      const next = { ...prev }
      if (header.invoiceNumber) next.invoiceNumber = header.invoiceNumber
      if (header.purchaseDate && /^\d{4}-\d{2}-\d{2}$/.test(header.purchaseDate)) next.purchaseDate = header.purchaseDate
      if (header.discount && header.discount > 0) next.discount = String(header.discount)
      if (header.paymentMethod) {
        next.paymentMethod = header.paymentMethod
        next.paymentStatus = CREDIT_METHODS.includes(header.paymentMethod) ? 'pendiente' : 'pagado'
      }
      // Ítems coincidentes → a la factura (sin duplicar)
      const matched = items.filter(i => i.matched && i.productId)
      const existingIds = new Set(prev.items.map(i => i.productId))
      const newItems: NewInvoiceItem[] = matched
        .filter(i => !existingIds.has(i.productId!))
        .map(i => ({
          productId: i.productId!,
          productName: i.productName || i.description,
          productSku: i.productSku || '',
          quantity: i.quantity || 1,
          unitCost: i.unitCost || i.lastPurchasePrice || 0,
          lastPurchasePrice: i.lastPurchasePrice || undefined,
        }))
      next.items = [...prev.items, ...newItems]
      return next
    })

    // Proveedor
    if (supplier.matchedId) {
      handleSupplierSelect(supplier.matchedId)
    } else if (supplier.name) {
      setForm(p => ({ ...p, supplierId: '', supplierName: supplier.name || '' }))
      setSelectedSupplier(null)
      setSupplierStats(null)
      setShowQuickSupplier(true)
      setQuickSupplierForm(p => ({ ...p, name: supplier.name || '', taxId: supplier.taxId || '' }))
    }

    // Ítems no encontrados → panel de revisión
    const unmatched = items.filter(i => !i.matched || !i.productId)
    setPendingItems(unmatched.map(i => ({
      tempId: genTempId(),
      description: i.description,
      quantity: i.quantity || 1,
      unitCost: i.unitCost || 0,
    })))

    const matchedCount = items.length - unmatched.length
    toast.success(
      `Factura leída: ${items.length} ítem(s) detectado(s), ${matchedCount} reconocido(s)` +
      (unmatched.length ? `, ${unmatched.length} por asignar.` : '.')
    )
  }

  const handleOcrFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permite re-seleccionar el mismo archivo
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setOcrError('Selecciona una imagen (foto) de la factura.')
      return
    }
    setOcrError(null)
    setOcrLoading(true)
    try {
      const dataUrl = await fileToDownscaledDataUrl(file)
      const res = await api.ocrPurchaseInvoice({ imageBase64: dataUrl, mimeType: 'image/jpeg' })
      if (res.success && res.data) {
        applyOcrResult(res.data)
      } else {
        setOcrError(res.error || 'No se pudo leer la factura.')
      }
    } catch (err: any) {
      setOcrError(err?.message || 'Error al procesar la imagen.')
    } finally {
      setOcrLoading(false)
    }
  }

  // ── Pending items (revisión de no encontrados) ──
  const updatePending = (tempId: string, field: 'description' | 'quantity' | 'unitCost', value: string | number) =>
    setPendingItems(prev => prev.map(p => p.tempId === tempId ? { ...p, [field]: value } : p))

  const removePending = (tempId: string) => {
    setPendingItems(prev => prev.filter(p => p.tempId !== tempId))
    if (assigningId === tempId) { setAssigningId(null); setAssignSearch('') }
    if (creatingId === tempId) setCreatingId(null)
  }

  const promotePendingToItem = (item: PendingItem, product: { id: string; name: string; sku: string; purchasePrice?: number }) => {
    setForm(prev => {
      if (prev.items.some(i => i.productId === product.id)) return prev
      return {
        ...prev,
        items: [...prev.items, {
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          quantity: item.quantity || 1,
          unitCost: item.unitCost || product.purchasePrice || 0,
          lastPurchasePrice: product.purchasePrice || undefined,
        }],
      }
    })
    removePending(item.tempId)
  }

  // Búsqueda inline para asignar un pending item a un producto existente
  useEffect(() => {
    if (!assigningId || !assignSearch.trim()) { setAssignResults([]); return }
    setAssignLoading(true)
    const controller = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await api.getProducts({ search: assignSearch.trim(), limit: 8 })
        if (!controller.signal.aborted) {
          const products = Array.isArray((res as any).data) ? (res as any).data : ((res as any).products ?? (res as any).data?.products ?? [])
          setAssignResults(res.success ? products.slice(0, 8) : [])
          setAssignLoading(false)
        }
      } catch {
        if (!controller.signal.aborted) { setAssignResults([]); setAssignLoading(false) }
      }
    }, 300)
    return () => { clearTimeout(t); controller.abort() }
  }, [assigningId, assignSearch])

  const openCreateProduct = (item: PendingItem) => {
    setCreatingId(item.tempId)
    setCreatingCategory(categories[0]?.name || '')
    setCreatingSalePrice(String(item.unitCost || ''))
    setAssigningId(null)
  }

  const handleCreateProductForPending = async (item: PendingItem) => {
    if (!creatingCategory) { toast.error('Selecciona una categoría'); return }
    const salePrice = parseFloat(creatingSalePrice) || item.unitCost || 0
    setSavingProduct(true)
    try {
      const sku = `OCR-${Date.now().toString().slice(-6)}`
      const res = await api.createProduct({
        name: item.description.slice(0, 120),
        category: creatingCategory,
        productType: 'general',
        sku,
        purchasePrice: item.unitCost || 0,
        salePrice,
        stock: 0,
        reorderPoint: 0,
        entryDate: new Date().toISOString().split('T')[0],
      })
      if (res.success && res.data) {
        const p = res.data as any
        promotePendingToItem(item, { id: p.id, name: p.name, sku: p.sku, purchasePrice: p.purchasePrice ?? item.unitCost })
        setCreatingId(null)
        toast.success('Producto creado y agregado a la factura')
      } else {
        toast.error(res.error || 'No se pudo crear el producto')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error al crear el producto')
    } finally {
      setSavingProduct(false)
    }
  }

  const addProductToInvoice = (product: Product) => {
    const already = form.items.find(i => i.productId === product.id)
    if (!already) {
      setForm(prev => ({
        ...prev,
        items: [
          ...prev.items,
          {
            productId: product.id,
            productName: product.name,
            productSku: product.sku,
            quantity: 1,
            unitCost: product.purchasePrice || 0,
            lastPurchasePrice: product.purchasePrice || 0,
          },
        ],
      }))
    }
    setProductSearch('')
    setProductSearchResults([])
    setShowProductDropdown(false)
  }

  const removeItem = (productId: string) => {
    setForm(prev => ({ ...prev, items: prev.items.filter(i => i.productId !== productId) }))
  }

  const updateItem = (productId: string, field: 'quantity' | 'unitCost', value: number) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map(i => i.productId === productId ? { ...i, [field]: value } : i),
    }))
  }

  // Totals
  const subtotal = form.items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0)
  const discount = parseFloat(form.discount) || 0
  const total = subtotal - discount

  // Quick supplier create inside form
  const handleSaveQuickSupplier = async () => {
    setQuickSupplierError(null)
    if (!quickSupplierForm.name.trim()) { setQuickSupplierError('Nombre requerido'); return }
    setSavingQuickSupplier(true)
    const res = await api.createPurchaseSupplier({
      name: quickSupplierForm.name.trim(),
      contactName: quickSupplierForm.contactName || undefined,
      phone: quickSupplierForm.phone || undefined,
      email: quickSupplierForm.email || undefined,
      city: quickSupplierForm.city || undefined,
      address: quickSupplierForm.address || undefined,
      taxId: quickSupplierForm.taxId || undefined,
      paymentTerms: quickSupplierForm.paymentTerms || undefined,
    })
    setSavingQuickSupplier(false)
    if (res.success && res.data) {
      const newSup = res.data as Supplier
      setSuppliers(prev => [...prev, newSup])
      setForm(p => ({ ...p, supplierId: newSup.id, supplierName: newSup.name }))
      setSelectedSupplier(newSup)
      setSupplierStats(null)
      setShowQuickSupplier(false)
      setQuickSupplierForm(emptySupplierForm())
    } else {
      setQuickSupplierError(res.error || 'Error al crear proveedor')
    }
  }

  const handleSubmit = async () => {
    setError(null)
    if (!form.invoiceNumber.trim()) { setError('Ingresa el número de factura'); return }
    if (!form.supplierName.trim()) { setError('Ingresa el nombre del proveedor'); return }
    if (form.items.length === 0) { setError('Agrega al menos un producto a la factura'); return }
    for (const item of form.items) {
      if (item.quantity <= 0) { setError(`Cantidad inválida para: ${item.productName}`); return }
    }
    if (CREDIT_METHODS.includes(form.paymentMethod) && !form.dueDate) {
      setError('Selecciona la fecha de vencimiento para crédito proveedor'); return
    }

    setSubmitting(true)
    try {
      const res = await api.createPurchaseInvoice({
        invoiceNumber: form.invoiceNumber.trim(),
        supplierName: form.supplierName.trim(),
        supplierId: form.supplierId || undefined,
        purchaseDate: form.purchaseDate,
        documentType: form.documentType,
        items: form.items.map(i => ({ productId: i.productId, quantity: i.quantity, unitCost: i.unitCost })),
        paymentMethod: form.paymentMethod,
        paymentStatus: form.paymentStatus,
        dueDate: form.dueDate || undefined,
        fileUrl: form.fileUrl || undefined,
        discount: discount > 0 ? discount : undefined,
        notes: form.notes.trim() || undefined,
      })
      if (res.success) {
        setShowForm(false)
        setShowPreview(false)
        setForm(emptyForm())
        setSelectedSupplier(null)
        setSupplierStats(null)
        await loadData()
      } else {
        setError(res.error || 'Error al registrar la factura')
        setShowPreview(false)
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── Supplier panel handlers ──
  const handleCreateSupplier = async () => {
    setSupplierFormError(null)
    if (!supplierForm.name.trim()) { setSupplierFormError('El nombre del proveedor es obligatorio'); return }
    if (supplierForm.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supplierForm.email.trim())) {
      setSupplierFormError('Correo electrónico no válido'); return
    }
    setSavingSupplier(true)
    try {
      const res = await api.createPurchaseSupplier({
        name: supplierForm.name.trim(),
        contactName: supplierForm.contactName.trim() || undefined,
        phone: supplierForm.phone.trim() || undefined,
        email: supplierForm.email.trim() || undefined,
        city: supplierForm.city.trim() || undefined,
        address: supplierForm.address.trim() || undefined,
        taxId: supplierForm.taxId.trim() || undefined,
        paymentTerms: supplierForm.paymentTerms.trim() || undefined,
        notes: supplierForm.notes.trim() || undefined,
      })
      if (res.success) {
        setSuppliers(prev => [...prev, res.data])
        setSupplierForm(emptySupplierForm())
        setShowNewSupplierForm(false)
        setSupplierSaved(true)
        setTimeout(() => setSupplierSaved(false), 3000)
      } else {
        setSupplierFormError(res.error || 'Error al crear el proveedor')
      }
    } finally {
      setSavingSupplier(false)
    }
  }

  const invoicesBySupplier = (supplierId: string) =>
    invoices.filter(inv => inv.supplierId === supplierId)

  const supplierTotal = (supplierId: string) =>
    invoicesBySupplier(supplierId).reduce((s, inv) => s + inv.total, 0)

  const paymentStatusBadge = (status: string) => {
    switch (status) {
      case 'pagado': return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Pagado</Badge>
      case 'pendiente': return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Pendiente</Badge>
      case 'parcial': return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Parcial</Badge>
      default: return <Badge variant="secondary">{status}</Badge>
    }
  }

  // Stats cards
  const pendingInvoices = invoices.filter(i => i.paymentStatus === 'pendiente').length
  const monthTotal = invoices
    .filter(i => new Date(i.createdAt).getMonth() === new Date().getMonth())
    .reduce((s, i) => s + i.total, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Facturas de Compra</h1>
          <p className="text-muted-foreground text-sm">
            Registra compras a proveedores y actualiza el inventario automáticamente
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowSupplierPanel(true)}>
            <Users className="mr-2 h-4 w-4" />
            Proveedores
            {suppliers.length > 0 && (
              <Badge variant="secondary" className="ml-2">{suppliers.length}</Badge>
            )}
          </Button>
          <Button onClick={openForm}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Factura
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2"><ShoppingBag className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Total facturas</p>
                <p className="text-xl font-bold">{pagination.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30"><Users className="h-5 w-5 text-blue-600 dark:text-blue-400" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Proveedores</p>
                <p className="text-xl font-bold">{suppliers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/30"><TrendingDown className="h-5 w-5 text-green-600 dark:text-green-400" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Compras del mes</p>
                <p className="text-xl font-bold">{formatCOP(monthTotal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-yellow-100 p-2 dark:bg-yellow-900/30"><CalendarClock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Facturas pendientes</p>
                <p className="text-xl font-bold">{pendingInvoices}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardHeader><CardTitle>Historial de Compras</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShoppingBag className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="font-medium text-muted-foreground">No hay facturas de compra</p>
              <p className="text-sm text-muted-foreground">Registra tu primera compra con el botón de arriba</p>
            </div>
          ) : (
            <>
              {/* ── Tabla (escritorio) ── */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Factura #</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Productos</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Pago</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono font-semibold">{inv.invoiceNumber}</TableCell>
                        <TableCell className="text-xs">{DOCUMENT_TYPE_LABELS[inv.documentType] || inv.documentType}</TableCell>
                        <TableCell>{inv.supplierName}</TableCell>
                        <TableCell>{new Date(inv.purchaseDate).toLocaleDateString('es-CO')}</TableCell>
                        <TableCell>{inv.items.length} ítem(s)</TableCell>
                        <TableCell className="text-right font-semibold">{formatCOP(inv.total)}</TableCell>
                        <TableCell className="text-xs">{PAYMENT_METHOD_LABELS[inv.paymentMethod] || inv.paymentMethod}</TableCell>
                        <TableCell>{paymentStatusBadge(inv.paymentStatus)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => setShowDetail(inv)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* ── Tarjetas (móvil) ── */}
              <div className="md:hidden space-y-2.5">
                {invoices.map((inv) => (
                  <button
                    key={inv.id}
                    onClick={() => setShowDetail(inv)}
                    className="w-full text-left rounded-lg border border-border bg-background p-3 active:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono font-semibold text-sm truncate">{inv.invoiceNumber}</p>
                        <p className="text-sm font-medium truncate">{inv.supplierName}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-sm">{formatCOP(inv.total)}</p>
                        <div className="mt-0.5">{paymentStatusBadge(inv.paymentStatus)}</div>
                      </div>
                    </div>
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-2 text-[11px] text-muted-foreground">
                      <span>{new Date(inv.purchaseDate).toLocaleDateString('es-CO')}</span>
                      <span>· {inv.items.length} ítem(s)</span>
                      <span>· {DOCUMENT_TYPE_LABELS[inv.documentType] || inv.documentType}</span>
                      <span>· {PAYMENT_METHOD_LABELS[inv.paymentMethod] || inv.paymentMethod}</span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">Página {pagination.page} de {pagination.totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => loadData(pagination.page - 1)}>Anterior</Button>
                <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => loadData(pagination.page + 1)}>Siguiente</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== New Invoice Dialog ===== */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!submitting) { setShowForm(open); if (!open) { setSelectedSupplier(null); setSupplierStats(null); setShowQuickSupplier(false) } } }}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Factura de Compra</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">

            {/* ===== Escanear factura con IA ===== */}
            <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-4">
              <input
                ref={ocrFileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleOcrFile}
              />
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    Escanear factura con IA
                    <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">OCR</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Toma una foto o sube la factura del proveedor y la IA completará los datos y productos automáticamente.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button type="button" size="sm" onClick={triggerOcrPicker} disabled={ocrLoading}>
                      {ocrLoading
                        ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Leyendo factura...</>
                        : <><Camera className="mr-1.5 h-4 w-4" />Tomar / subir foto</>
                      }
                    </Button>
                    {ocrProvider && !ocrLoading && (
                      <span className="text-[11px] text-muted-foreground self-center flex items-center gap-1">
                        <CheckCircle className="h-3.5 w-3.5 text-green-500" /> Procesado con {ocrProvider === 'gemini' ? 'Gemini' : ocrProvider === 'groq' ? 'Groq (Llama 4 Scout)' : 'OpenAI'}
                      </span>
                    )}
                  </div>
                  {ocrError && (
                    <p className="text-xs text-destructive bg-destructive/10 rounded-md px-2.5 py-1.5 mt-2 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {ocrError}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Row 1: Invoice #, Date, Document type */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>N° Factura <span className="text-destructive">*</span></Label>
                <div className="flex gap-1.5">
                  <Input
                    placeholder="FC-2026-0001"
                    value={loadingInvoiceNumber ? '' : form.invoiceNumber}
                    disabled={loadingInvoiceNumber}
                    onChange={(e) => setForm(p => ({ ...p, invoiceNumber: e.target.value }))}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="icon" title="Generar automático" onClick={generateInvoiceNumber} disabled={loadingInvoiceNumber}>
                    {loadingInvoiceNumber ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Fecha <span className="text-destructive">*</span></Label>
                <Input type="date" value={form.purchaseDate} onChange={(e) => setForm(p => ({ ...p, purchaseDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de documento</Label>
                <Select value={form.documentType} onValueChange={(v) => setForm(p => ({ ...p, documentType: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="factura">Factura</SelectItem>
                    <SelectItem value="remision">Remisión</SelectItem>
                    <SelectItem value="orden_compra">Orden de compra</SelectItem>
                    <SelectItem value="nota_credito">Nota crédito proveedor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Supplier selector */}
            <div className="space-y-2">
              <Label>Proveedor <span className="text-destructive">*</span></Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select value={form.supplierId || '__manual__'} onValueChange={handleSupplierSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__manual__">-- Ingresar manualmente --</SelectItem>
                    <SelectItem value="__new__" className="text-primary font-medium">
                      + Crear proveedor nuevo
                    </SelectItem>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}{s.city ? ` (${s.city})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Nombre del proveedor"
                  value={form.supplierName}
                  onChange={(e) => setForm(p => ({ ...p, supplierName: e.target.value, supplierId: '' }))}
                  disabled={!!form.supplierId}
                />
              </div>

              {/* Supplier info card */}
              {selectedSupplier && !showQuickSupplier && (
                loadingStats
                  ? <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Cargando historial...</div>
                  : <SupplierInfoCard supplier={selectedSupplier} stats={supplierStats} />
              )}

              {/* Quick-create supplier form inside dialog */}
              {showQuickSupplier && (
                <div className="rounded-lg border border-dashed p-4 space-y-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Crear proveedor rápido</p>
                    <button onClick={() => { setShowQuickSupplier(false); setQuickSupplierForm(emptySupplierForm()); setQuickSupplierError(null) }} className="text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-xs">Nombre <span className="text-destructive">*</span></Label>
                      <Input placeholder="Ej: Distribuidora XYZ" value={quickSupplierForm.name} onChange={e => setQuickSupplierForm(p => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Teléfono</Label>
                      <Input placeholder="3001234567" value={quickSupplierForm.phone} onChange={e => setQuickSupplierForm(p => ({ ...p, phone: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Ciudad</Label>
                      <Input placeholder="Bogotá..." value={quickSupplierForm.city} onChange={e => setQuickSupplierForm(p => ({ ...p, city: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">NIT</Label>
                      <Input placeholder="NIT / RUT" value={quickSupplierForm.taxId} onChange={e => setQuickSupplierForm(p => ({ ...p, taxId: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Condiciones de pago</Label>
                      <Input placeholder="30 días, contado..." value={quickSupplierForm.paymentTerms} onChange={e => setQuickSupplierForm(p => ({ ...p, paymentTerms: e.target.value }))} />
                    </div>
                  </div>
                  {quickSupplierError && <p className="text-xs text-destructive">{quickSupplierError}</p>}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveQuickSupplier} disabled={savingQuickSupplier}>
                      {savingQuickSupplier ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Guardando...</> : <><UserPlus className="h-3.5 w-3.5 mr-1.5" />Guardar proveedor</>}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setShowQuickSupplier(false); setQuickSupplierForm(emptySupplierForm()) }}>Cancelar</Button>
                  </div>
                </div>
              )}
            </div>

            {/* Row 3: Payment */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Método de pago</Label>
                <Select value={form.paymentMethod} onValueChange={handlePaymentMethodChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                    <SelectItem value="nequi">Nequi</SelectItem>
                    <SelectItem value="daviplata">Daviplata</SelectItem>
                    <SelectItem value="credito_proveedor">Crédito proveedor</SelectItem>
                    <SelectItem value="mixto">Mixto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Estado de pago</Label>
                <Select value={form.paymentStatus} onValueChange={(v) => setForm(p => ({ ...p, paymentStatus: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pagado">Pagado</SelectItem>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="parcial">Parcial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {CREDIT_METHODS.includes(form.paymentMethod) && (
                <div className="space-y-1.5">
                  <Label>Fecha de vencimiento <span className="text-destructive">*</span></Label>
                  <Input type="date" value={form.dueDate} onChange={(e) => setForm(p => ({ ...p, dueDate: e.target.value }))} />
                </div>
              )}
            </div>

            {/* Products section */}
            <div className="space-y-3">
              <Label>Productos comprados <span className="text-destructive">*</span></Label>

              <div className="flex gap-2">
                <div ref={searchContainerRef} className="flex-1 space-y-1">
                  <div className="relative">
                    {searchLoading
                      ? <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
                      : <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    }
                    <Input
                      className="pl-9"
                      placeholder="Buscar por nombre, SKU o código de barras..."
                      value={productSearch}
                      onChange={(e) => { setProductSearch(e.target.value); setShowProductDropdown(true) }}
                      onFocus={() => { if (productSearch.trim()) setShowProductDropdown(true) }}
                    />
                    {productSearch.trim() && (
                      <button
                        onClick={() => { setProductSearch(''); setProductSearchResults([]); setShowProductDropdown(false) }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {showProductDropdown && productSearch.trim() && (
                    <div className="rounded-md border bg-popover shadow-sm max-h-52 overflow-y-auto">
                      {searchLoading ? (
                        <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
                        </div>
                      ) : productSearchResults.length === 0 ? (
                        <div className="px-3 py-3 text-sm text-muted-foreground">Sin resultados para &quot;{productSearch}&quot;</div>
                      ) : (
                        productSearchResults.map((p) => {
                          const alreadyAdded = form.items.some(i => i.productId === p.id)
                          return (
                            <button
                              key={p.id}
                              className={`flex w-full items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors ${alreadyAdded ? 'opacity-50 cursor-default bg-muted/30' : 'hover:bg-accent'}`}
                              onClick={() => { if (!alreadyAdded) addProductToInvoice(p) }}
                              disabled={alreadyAdded}
                            >
                              <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{p.name}</p>
                                <p className="text-xs text-muted-foreground">{p.sku}</p>
                              </div>
                              <div className="text-right shrink-0 space-y-0.5">
                                <p className="text-xs text-muted-foreground">Stock: {p.stock}</p>
                                {p.purchasePrice ? <p className="text-xs text-blue-600">Últ. costo: {formatCOP(p.purchasePrice)}</p> : null}
                                {alreadyAdded && <p className="text-xs text-green-600">Agregado</p>}
                              </div>
                            </button>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>

                <Button type="button" variant="outline" size="icon" title="Escanear con DroidCam" onClick={() => setShowRemoteScanner(true)} className="self-start">
                  <Smartphone className="h-4 w-4" />
                </Button>
              </div>

              {/* Items table */}
              {form.items.length > 0 && (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="w-28">Cantidad</TableHead>
                        <TableHead className="w-36">Costo unit.</TableHead>
                        <TableHead className="text-right w-32">Subtotal</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {form.items.map((item) => (
                        <TableRow key={item.productId}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{item.productName}</p>
                              <p className="text-xs text-muted-foreground">{item.productSku}</p>
                              {item.lastPurchasePrice ? (
                                <p className="text-xs text-blue-500">Últ. precio: {formatCOP(item.lastPurchasePrice)}</p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number" min="0.001" step="0.001"
                              value={item.quantity}
                              onChange={(e) => updateItem(item.productId, 'quantity', parseFloat(e.target.value) || 0)}
                              className="h-8 w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number" min="0" step="0.01"
                              value={item.unitCost}
                              onChange={(e) => updateItem(item.productId, 'unitCost', parseFloat(e.target.value) || 0)}
                              className="h-8 w-32"
                            />
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCOP(item.quantity * item.unitCost)}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(item.productId)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Totals section */}
                  <div className="border-t bg-muted/20 px-4 py-3 space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatCOP(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-muted-foreground">Descuento</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">$</span>
                        <Input
                          type="number" min="0" step="0.01"
                          value={form.discount}
                          onChange={e => setForm(p => ({ ...p, discount: e.target.value }))}
                          className="h-7 w-28 text-right"
                        />
                      </div>
                    </div>
                    <div className="flex justify-between font-bold text-base border-t pt-1.5 mt-1">
                      <span>TOTAL</span>
                      <span className="text-primary">{formatCOP(total)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ===== Productos por asignar (OCR) ===== */}
            {pendingItems.length > 0 && (
              <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/20 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                    Productos por asignar ({pendingItems.length})
                  </p>
                </div>
                <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                  La IA detectó estos productos pero no los encontró en tu inventario. Asígnalos a un producto existente o créalos.
                </p>

                {pendingItems.map((item) => (
                  <div key={item.tempId} className="rounded-md border border-amber-200 dark:border-amber-800 bg-background p-3 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Descripción</Label>
                        <Input value={item.description} onChange={(e) => updatePending(item.tempId, 'description', e.target.value)} className="h-8" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Cant.</Label>
                        <Input type="number" min="0.001" step="0.001" value={item.quantity} onChange={(e) => updatePending(item.tempId, 'quantity', parseFloat(e.target.value) || 0)} className="h-8 w-20" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Costo unit.</Label>
                        <Input type="number" min="0" step="0.01" value={item.unitCost} onChange={(e) => updatePending(item.tempId, 'unitCost', parseFloat(e.target.value) || 0)} className="h-8 w-28" />
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive/70 hover:text-destructive" onClick={() => removePending(item.tempId)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => { setAssigningId(assigningId === item.tempId ? null : item.tempId); setAssignSearch(''); setAssignResults([]); setCreatingId(null) }}>
                        <Search className="h-3.5 w-3.5 mr-1" /> Asignar a existente
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => openCreateProduct(item)}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Crear producto
                      </Button>
                    </div>

                    {/* Inline search to assign */}
                    {assigningId === item.tempId && (
                      <div className="space-y-1.5">
                        <div className="relative">
                          {assignLoading
                            ? <Loader2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                            : <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />}
                          <Input className="h-8 pl-8" placeholder="Buscar producto por nombre o SKU..." value={assignSearch} onChange={(e) => setAssignSearch(e.target.value)} autoFocus />
                        </div>
                        {assignSearch.trim() && (
                          <div className="rounded-md border bg-popover max-h-44 overflow-y-auto">
                            {assignLoading ? (
                              <div className="px-3 py-2 text-xs text-muted-foreground">Buscando...</div>
                            ) : assignResults.length === 0 ? (
                              <div className="px-3 py-2 text-xs text-muted-foreground">Sin resultados</div>
                            ) : assignResults.map((p) => (
                              <button key={p.id} type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                                onClick={() => promotePendingToItem(item, { id: p.id, name: p.name, sku: p.sku, purchasePrice: p.purchasePrice })}>
                                <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="flex-1 min-w-0 truncate">{p.name}</span>
                                <span className="text-[10px] text-muted-foreground">{p.sku}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Inline create product */}
                    {creatingId === item.tempId && (
                      <div className="rounded-md border border-dashed p-3 space-y-2 bg-muted/30">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[11px]">Categoría <span className="text-destructive">*</span></Label>
                            <Select value={creatingCategory} onValueChange={setCreatingCategory}>
                              <SelectTrigger className="h-8"><SelectValue placeholder="Selecciona categoría" /></SelectTrigger>
                              <SelectContent>
                                {categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">Precio de venta</Label>
                            <Input type="number" min="0" step="0.01" value={creatingSalePrice} onChange={(e) => setCreatingSalePrice(e.target.value)} className="h-8" placeholder="0" />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" size="sm" className="h-7 text-xs" disabled={savingProduct} onClick={() => handleCreateProductForPending(item)}>
                            {savingProduct ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Creando...</> : <><CheckCircle className="h-3.5 w-3.5 mr-1" />Crear y agregar</>}
                          </Button>
                          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setCreatingId(null)}>Cancelar</Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* File attachment */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Paperclip className="h-4 w-4" /> Adjuntar factura (PDF / Imagen)</Label>
              <CloudinaryUpload
                value={form.fileUrl}
                onChange={(url) => setForm(p => ({ ...p, fileUrl: url || '' }))}
                label="Subir factura del proveedor"
              />
              {form.fileUrl && (
                <a href={form.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  <Paperclip className="h-3 w-3" /> Ver archivo adjunto
                </a>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notas (opcional)</Label>
              <Textarea
                placeholder="Observaciones adicionales..."
                rows={2}
                value={form.notes}
                onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={submitting}>Cancelar</Button>
            <Button variant="outline" onClick={() => { setError(null); if (!form.invoiceNumber.trim()) { setError('Ingresa el número de factura'); return } if (!form.supplierName.trim()) { setError('Ingresa el nombre del proveedor'); return } if (form.items.length === 0) { setError('Agrega al menos un producto'); return } setShowPreview(true) }} disabled={submitting}>
              <Eye className="mr-2 h-4 w-4" /> Vista previa
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting
                ? <><div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />Guardando...</>
                : <><ShoppingBag className="mr-2 h-4 w-4" />Registrar Factura</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Preview Dialog ===== */}
      {showPreview && (
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Resumen de compra</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><p className="text-muted-foreground text-xs">Factura #</p><p className="font-semibold">{form.invoiceNumber}</p></div>
                <div><p className="text-muted-foreground text-xs">Fecha</p><p className="font-semibold">{form.purchaseDate}</p></div>
                <div><p className="text-muted-foreground text-xs">Proveedor</p><p className="font-semibold">{form.supplierName}</p></div>
                <div><p className="text-muted-foreground text-xs">Tipo</p><p className="font-semibold">{DOCUMENT_TYPE_LABELS[form.documentType]}</p></div>
                <div><p className="text-muted-foreground text-xs">Pago</p><p className="font-semibold">{PAYMENT_METHOD_LABELS[form.paymentMethod]}</p></div>
                <div><p className="text-muted-foreground text-xs">Estado</p><p className="font-semibold capitalize">{form.paymentStatus}</p></div>
              </div>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead className="text-right">Costo</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.items.map(item => (
                      <TableRow key={item.productId}>
                        <TableCell className="text-sm">{item.productName}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCOP(item.unitCost)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCOP(item.quantity * item.unitCost)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="border-t bg-muted/20 px-3 py-2 space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Subtotal</span><span>{formatCOP(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Descuento</span><span>-{formatCOP(discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold border-t pt-1">
                    <span>TOTAL</span><span className="text-primary">{formatCOP(total)}</span>
                  </div>
                </div>
              </div>
              {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPreview(false)}>Volver a editar</Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting
                  ? <><div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />Guardando...</>
                  : <><CheckCircle className="mr-2 h-4 w-4" />Confirmar registro</>
                }
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ===== Remote Scanner ===== */}
      {showRemoteScanner && (
        <RemoteScanner onScan={handleScannedBarcode} onClose={() => setShowRemoteScanner(false)} />
      )}

      {/* ===== Detail Dialog ===== */}
      {showDetail && (
        <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Factura de Compra #{showDetail.invoiceNumber}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-muted-foreground">Proveedor</p><p className="font-semibold">{showDetail.supplierName}</p></div>
                <div><p className="text-muted-foreground">Fecha</p><p className="font-semibold">{new Date(showDetail.purchaseDate).toLocaleDateString('es-CO')}</p></div>
                <div><p className="text-muted-foreground">Tipo de documento</p><p className="font-semibold">{DOCUMENT_TYPE_LABELS[showDetail.documentType] || showDetail.documentType}</p></div>
                <div><p className="text-muted-foreground">Método de Pago</p><p className="font-semibold">{PAYMENT_METHOD_LABELS[showDetail.paymentMethod] || showDetail.paymentMethod}</p></div>
                <div><p className="text-muted-foreground">Estado de Pago</p>{paymentStatusBadge(showDetail.paymentStatus)}</div>
                {showDetail.dueDate && (
                  <div><p className="text-muted-foreground">Vencimiento</p><p className="font-semibold">{new Date(showDetail.dueDate).toLocaleDateString('es-CO')}</p></div>
                )}
                {showDetail.notes && (
                  <div className="col-span-2"><p className="text-muted-foreground">Notas</p><p>{showDetail.notes}</p></div>
                )}
                {showDetail.fileUrl && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground mb-1">Archivo adjunto</p>
                    <a href={showDetail.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                      <Paperclip className="h-3.5 w-3.5" /> Ver factura del proveedor
                    </a>
                  </div>
                )}
              </div>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead className="text-right">Costo Unit.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {showDetail.items.map((item: PurchaseInvoiceItem) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <p className="font-medium text-sm">{item.productName}</p>
                          <p className="text-xs text-muted-foreground">{item.productSku}</p>
                        </TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCOP(item.unitCost)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCOP(item.subtotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="border-t bg-muted/20 px-4 py-2 space-y-1">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Subtotal</span><span>{formatCOP(showDetail.subtotal)}</span>
                  </div>
                  {showDetail.discount > 0 && (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Descuento</span><span>-{formatCOP(showDetail.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold border-t pt-1">
                    <span>Total</span><span>{formatCOP(showDetail.total)}</span>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetail(null)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ===== Supplier Management Panel ===== */}
      <Dialog
        open={showSupplierPanel}
        onOpenChange={(open) => {
          setShowSupplierPanel(open)
          if (!open) {
            setShowNewSupplierForm(false)
            setSelectedSupplierDetail(null)
            setSupplierForm(emptySupplierForm())
            setSupplierFormError(null)
          }
        }}
      >
        <DialogContent className="max-w-4xl w-full max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Building2 className="h-5 w-5 text-primary" />
                Gestión de Proveedores
              </DialogTitle>
              <div className="flex items-center gap-2">
                {supplierSaved && (
                  <span className="flex items-center gap-1.5 text-xs text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-2.5 py-1 rounded-full font-medium">
                    <CheckCircle className="h-3.5 w-3.5" /> Guardado
                  </span>
                )}
                {!showNewSupplierForm && (
                  <Button size="sm" onClick={() => { setShowNewSupplierForm(true); setSelectedSupplierDetail(null) }}>
                    <UserPlus className="h-4 w-4 mr-1.5" />
                    Nuevo Proveedor
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* NEW SUPPLIER FORM */}
          {showNewSupplierForm && (
            <div className="mt-4 space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b">
                <button onClick={() => { setShowNewSupplierForm(false); setSupplierForm(emptySupplierForm()); setSupplierFormError(null) }} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded">
                  ← Volver
                </button>
                <h3 className="font-semibold">Registrar Nuevo Proveedor</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Nombre del proveedor <span className="text-destructive">*</span></Label>
                  <Input placeholder="Ej: Distribuidora XYZ S.A.S" value={supplierForm.name} onChange={(e) => setSupplierForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Nombre del contacto</Label>
                  <Input placeholder="Persona de contacto" value={supplierForm.contactName} onChange={(e) => setSupplierForm(p => ({ ...p, contactName: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Teléfono</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" placeholder="3001234567" value={supplierForm.phone} onChange={(e) => setSupplierForm(p => ({ ...p, phone: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Correo electrónico</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" type="email" placeholder="correo@proveedor.com" value={supplierForm.email} onChange={(e) => setSupplierForm(p => ({ ...p, email: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Ciudad</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" placeholder="Bogotá, Medellín..." value={supplierForm.city} onChange={(e) => setSupplierForm(p => ({ ...p, city: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Dirección</Label>
                  <Input placeholder="Dirección completa del proveedor" value={supplierForm.address} onChange={(e) => setSupplierForm(p => ({ ...p, address: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>NIT / RUT</Label>
                  <Input placeholder="Número de identificación tributaria" value={supplierForm.taxId} onChange={(e) => setSupplierForm(p => ({ ...p, taxId: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Condiciones de pago</Label>
                  <Input placeholder="Ej: 30 días, Contado..." value={supplierForm.paymentTerms} onChange={(e) => setSupplierForm(p => ({ ...p, paymentTerms: e.target.value }))} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Notas</Label>
                  <Textarea placeholder="Información adicional del proveedor..." rows={2} value={supplierForm.notes} onChange={(e) => setSupplierForm(p => ({ ...p, notes: e.target.value }))} />
                </div>
              </div>
              {supplierFormError && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{supplierFormError}</p>
              )}
              <div className="flex gap-3 pt-1 border-t">
                <Button variant="outline" onClick={() => { setShowNewSupplierForm(false); setSupplierForm(emptySupplierForm()); setSupplierFormError(null) }}>Cancelar</Button>
                <Button onClick={handleCreateSupplier} disabled={savingSupplier}>
                  {savingSupplier
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
                    : <><UserPlus className="mr-2 h-4 w-4" />Guardar Proveedor</>
                  }
                </Button>
              </div>
            </div>
          )}

          {/* SUPPLIER DETAIL VIEW */}
          {!showNewSupplierForm && selectedSupplierDetail && (
            <div className="mt-4 space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b">
                <button onClick={() => setSelectedSupplierDetail(null)} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded">← Volver</button>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="rounded-full bg-primary/10 p-1.5 flex-shrink-0">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-semibold truncate">{selectedSupplierDetail.name}</h3>
                  {selectedSupplierDetail.city && (
                    <span className="text-sm text-muted-foreground hidden sm:inline">· {selectedSupplierDetail.city}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                {selectedSupplierDetail.taxId && (
                  <div className="flex items-center gap-1.5 text-sm bg-muted rounded-lg px-3 py-2">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>NIT: {selectedSupplierDetail.taxId}</span>
                  </div>
                )}
                {selectedSupplierDetail.contactName && (
                  <div className="flex items-center gap-1.5 text-sm bg-muted rounded-lg px-3 py-2">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{selectedSupplierDetail.contactName}</span>
                  </div>
                )}
                {selectedSupplierDetail.phone && (
                  <div className="flex items-center gap-1.5 text-sm bg-muted rounded-lg px-3 py-2">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{selectedSupplierDetail.phone}</span>
                  </div>
                )}
                {selectedSupplierDetail.email && (
                  <div className="flex items-center gap-1.5 text-sm bg-muted rounded-lg px-3 py-2">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{selectedSupplierDetail.email}</span>
                  </div>
                )}
                {selectedSupplierDetail.paymentTerms && (
                  <div className="flex items-center gap-1.5 text-sm bg-muted rounded-lg px-3 py-2">
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{selectedSupplierDetail.paymentTerms}</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-4 bg-card">
                  <p className="text-xs text-muted-foreground mb-1">Facturas registradas</p>
                  <p className="text-3xl font-bold">{invoicesBySupplier(selectedSupplierDetail.id).length}</p>
                </div>
                <div className="rounded-lg border p-4 bg-card">
                  <p className="text-xs text-muted-foreground mb-1">Total comprado</p>
                  <p className="text-2xl font-bold text-primary">{formatCOP(supplierTotal(selectedSupplierDetail.id))}</p>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Historial de facturas
                </h4>
                {invoicesBySupplier(selectedSupplierDetail.id).length > 0 ? (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Factura #</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="w-8" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoicesBySupplier(selectedSupplierDetail.id).map((inv) => (
                          <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setShowDetail(inv); setShowSupplierPanel(false) }}>
                            <TableCell className="font-mono text-sm font-semibold">{inv.invoiceNumber}</TableCell>
                            <TableCell className="text-sm">{new Date(inv.purchaseDate).toLocaleDateString('es-CO')}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCOP(inv.total)}</TableCell>
                            <TableCell>{paymentStatusBadge(inv.paymentStatus)}</TableCell>
                            <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed p-8 text-center">
                    <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Sin facturas para este proveedor</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUPPLIER LIST */}
          {!showNewSupplierForm && !selectedSupplierDetail && (
            <div className="mt-4">
              {suppliers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Building2 className="h-14 w-14 text-muted-foreground/20 mb-4" />
                  <p className="font-medium text-muted-foreground">Sin proveedores registrados</p>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">Crea tu primer proveedor para organizar tus compras</p>
                  <Button onClick={() => setShowNewSupplierForm(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />Crear primer proveedor
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {suppliers.map((sup) => {
                    const supInvoices = invoicesBySupplier(sup.id)
                    const supTotal = supplierTotal(sup.id)
                    return (
                      <button
                        key={sup.id}
                        onClick={() => setSelectedSupplierDetail(sup)}
                        className="text-left rounded-lg border p-4 hover:bg-muted/50 hover:border-primary/40 transition-all group"
                      >
                        <div className="flex items-start gap-3">
                          <div className="rounded-full bg-primary/10 p-2 flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                            <Building2 className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{sup.name}</p>
                            {sup.taxId && <p className="text-xs text-muted-foreground mt-0.5">NIT: {sup.taxId}</p>}
                            {sup.city && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <MapPin className="h-3 w-3" />{sup.city}
                              </p>
                            )}
                            {sup.phone && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Phone className="h-3 w-3" />{sup.phone}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <Badge variant="secondary" className="text-xs">
                                {supInvoices.length} {supInvoices.length === 1 ? 'factura' : 'facturas'}
                              </Badge>
                              {supTotal > 0 && (
                                <span className="text-xs font-medium text-primary">{formatCOP(supTotal)}</span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
