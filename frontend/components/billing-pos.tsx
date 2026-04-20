'use client'

import { useState, useEffect, useRef } from 'react'
import { useStore } from '@/lib/store'
import { api } from '@/lib/api'
import { TAX_RATE, type PaymentMethod, type CustomerFull, type Sale, type Product } from '@/lib/types'
import { formatCOP } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Search, Plus, X, Printer, FileText, Trash2, Pencil,
  Building, ScanLine, Check, Ban, ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { BarcodeScanner } from '@/components/barcode-scanner'

interface BillingPOSProps {
  onToggleMode: () => void
}

interface BillingLine {
  lineId: string
  product: Product
  quantity: number
}

const PM_LABELS: Record<string, string> = {
  efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia',
  fiado: 'Crédito', addi: 'Addi', sistecredito: 'Sistecredito', mixto: 'Mixto',
}

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'efectivo', label: 'EFECTIVO' },
  { value: 'tarjeta', label: 'TARJETA' },
  { value: 'transferencia', label: 'TRANSFERENCIA' },
  { value: 'addi', label: 'ADDI' },
  { value: 'sistecredito', label: 'SISTECREDITO' },
  { value: 'mixto', label: 'MIXTO' },
]

const MIXTO_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'addi', label: 'Addi' },
  { value: 'sistecredito', label: 'Sistecredito' },
]

export function BillingPOS({ onToggleMode }: BillingPOSProps) {
  const {
    products, fetchProducts,
    addSale, cancelSale, storeInfo,
    selectedCustomer, setSelectedCustomer,
    categories, sedes, fetchSedes,
  } = useStore()

  // Local billing lines — allows same product on multiple rows
  const [billingLines, setBillingLines] = useState<BillingLine[]>([])

  const hiddenCategoryIds = new Set(categories.filter(c => c.isHidden).map(c => c.id))

  // ── Invoice form state ──────────────────────────────────────────────────────
  const [docType, setDocType] = useState<'factura_venta' | 'remision' | 'nota_debito'>('factura_venta')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo')
  const [formaPago, setFormaPago] = useState<'contado' | 'credito'>('contado')
  const [creditDays, setCreditDays] = useState(30)
  const [applyIva, setApplyIva] = useState(false)
  const [amountPaid, setAmountPaid] = useState('')
  const [globalDiscountPct, setGlobalDiscountPct] = useState<number | ''>('')
  const [sedeId, setSedeId] = useState<string | null>(null)

  // Mixto payment
  const [mixtoMethod1, setMixtoMethod1] = useState<PaymentMethod>('efectivo')
  const [mixtoAmount1, setMixtoAmount1] = useState('')
  const [mixtoMethod2, setMixtoMethod2] = useState<PaymentMethod>('tarjeta')
  const [mixtoAmount2, setMixtoAmount2] = useState('')

  // ── Customer state ──────────────────────────────────────────────────────────
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<CustomerFull[]>([])
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false)
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)

  // ── Product search state ────────────────────────────────────────────────────
  const [productSearch, setProductSearch] = useState('')
  const [productQty, setProductQty] = useState(1)
  const [productPrice, setProductPrice] = useState<number | ''>('')
  const [showProductDropdown, setShowProductDropdown] = useState(false)
  const [highlightedProductIndex, setHighlightedProductIndex] = useState(0)
  const [pendingProductId, setPendingProductId] = useState<string | null>(null)
  const [showScanner, setShowScanner] = useState(false)

  // ── Per-item overrides ──────────────────────────────────────────────────────
  const [itemPrices, setItemPrices] = useState<Record<string, number>>({})
  const [itemDiscounts, setItemDiscounts] = useState<Record<string, number>>({})
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({})
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)

  // ── Sale state ──────────────────────────────────────────────────────────────
  const [isProcessing, setIsProcessing] = useState(false)
  const [completedSale, setCompletedSale] = useState<Sale | null>(null)
  const [showAnularConfirm, setShowAnularConfirm] = useState(false)

  // ── Refs ────────────────────────────────────────────────────────────────────
  const productSearchRef = useRef<HTMLInputElement>(null)
  const productQtyRef = useRef<HTMLInputElement>(null)
  const productPriceRef = useRef<HTMLInputElement>(null)
  const cashInputRef = useRef<HTMLInputElement>(null)
  const customerDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => { fetchProducts() }, [fetchProducts])
  useEffect(() => { fetchSedes() }, [fetchSedes])

  // ── Totals ──────────────────────────────────────────────────────────────────
  // itemDiscounts almacena un VALOR FIJO en pesos por línea (ej: 100 = $100 de descuento)
  const itemSubtotals = billingLines.map(item => {
    const price = itemPrices[item.lineId] ?? item.product.salePrice
    const discAmt = itemDiscounts[item.lineId] ?? 0
    return Math.max(0, price * item.quantity - discAmt)
  })
  const subtotalBeforeGlobal = itemSubtotals.reduce((s, v) => s + v, 0)
  const globalDiscAmt = subtotalBeforeGlobal * ((Number(globalDiscountPct) || 0) / 100)
  const subtotal = subtotalBeforeGlobal - globalDiscAmt
  const tax = applyIva ? subtotal * TAX_RATE : 0
  const total = subtotal + tax

  const paidAmount = (() => {
    if (formaPago === 'credito') return 0
    if (paymentMethod === 'mixto') return (parseFloat(mixtoAmount1) || 0) + (parseFloat(mixtoAmount2) || 0)
    return parseFloat(amountPaid) || 0
  })()
  const change = Math.max(0, paidAmount - total)

  const todayStr = new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric' })

  // ── Filtered products ───────────────────────────────────────────────────────
  const normalizedProductSearch = productSearch.trim().toLowerCase()
  const getSearchRank = (p: Product, q: string) => {
    if (!q) return 0
    const articulo = p.articulo?.toLowerCase() || ''
    const name = p.name.toLowerCase()
    const sku = p.sku.toLowerCase()
    const barcode = p.barcode?.toLowerCase() || ''

    if (articulo.includes(q)) return 0
    if (name.includes(q)) return 1
    if (sku.includes(q)) return 2
    if (barcode.includes(q)) return 3
    return 4
  }

  const filteredProducts = products.filter(p => {
    if (hiddenCategoryIds.has(p.category)) return false
    if (!normalizedProductSearch) return false
    const q = normalizedProductSearch
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.articulo && p.articulo.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode.toLowerCase().includes(q))
    )
  }).sort((a, b) => {
    const rankDiff = getSearchRank(a, normalizedProductSearch) - getSearchRank(b, normalizedProductSearch)
    if (rankDiff !== 0) return rankDiff
    return a.name.localeCompare(b.name)
  }).slice(0, 14)

  useEffect(() => {
    if (!normalizedProductSearch || filteredProducts.length === 0) {
      setHighlightedProductIndex(0)
      return
    }
    setHighlightedProductIndex(0)
  }, [normalizedProductSearch, filteredProducts.length])

  useEffect(() => {
    if (!showProductDropdown || filteredProducts.length === 0) return
    const active = filteredProducts[highlightedProductIndex]
    if (!active) return
    const el = document.querySelector(`[data-product-option="${active.id}"]`)
    if (el instanceof HTMLElement) el.scrollIntoView({ block: 'nearest' })
  }, [filteredProducts, highlightedProductIndex, showProductDropdown])

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F4') { e.preventDefault(); productSearchRef.current?.focus(); productSearchRef.current?.select() }
      if (e.key === 'F2') { e.preventDefault(); productQtyRef.current?.focus(); productQtyRef.current?.select() }
      if (e.key === 'F6') { e.preventDefault(); productPriceRef.current?.focus(); productPriceRef.current?.select() }
      if (e.key === 'F7') { e.preventDefault(); setShowScanner(true) }
      if (e.key === 'F11') { e.preventDefault(); cashInputRef.current?.focus(); cashInputRef.current?.select() }
      if (e.key === 'F12') { e.preventDefault(); completedSale ? handlePrint(completedSale) : (billingLines.length > 0 && handleCompleteSale()) }
      if (e.key === 'F3') { e.preventDefault(); handleNewInvoice() }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        completedSale ? handlePrint(completedSale) : (billingLines.length > 0 && handleCompleteSale())
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [completedSale, billingLines.length])

  // Close customer dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Customer handlers ───────────────────────────────────────────────────────
  const handleCustomerSearch = async (query: string) => {
    setCustomerSearch(query)
    if (query.length < 2) { setCustomerResults([]); setShowCustomerDropdown(false); return }
    setIsSearchingCustomers(true)
    const result = await api.searchCustomers(query)
    if (result.success && result.data) { setCustomerResults(result.data); setShowCustomerDropdown(true) }
    setIsSearchingCustomers(false)
  }

  const handleSelectCustomer = (cust: CustomerFull) => {
    setSelectedCustomer(cust)
    setCustomerSearch(cust.name)
    setShowCustomerDropdown(false)
    setCustomerResults([])
  }

  const handleClearCustomer = () => { setSelectedCustomer(null); setCustomerSearch('') }

  // ── Product handlers ────────────────────────────────────────────────────────
  const handleAddProductFromSearch = (productId: string) => {
    const product = products.find(p => p.id === productId)
    if (!product) return

    const qty = Math.max(1, productQty)
    const existingQty = billingLines.filter(l => l.product.id === productId).reduce((s, l) => s + l.quantity, 0)

    // Stock warning
    if (!product.isComposite && product.stock > 0 && existingQty + qty > product.stock) {
      toast.warning(`Stock insuficiente — disponible: ${product.stock} u.`, { duration: 3000 })
    }

    // Each add creates a new line (allows same product multiple times)
    const lineId = `${productId}-${Date.now()}`
    setBillingLines(prev => [...prev, { lineId, product, quantity: qty }])

    // Apply price override if set and different from default
    if (productPrice !== '' && Number(productPrice) !== product.salePrice) {
      setItemPrices(prev => ({ ...prev, [lineId]: Number(productPrice) }))
    }

    setProductSearch('')
    setShowProductDropdown(false)
    setHighlightedProductIndex(0)
    setProductQty(1)
    setProductPrice('')
    setPendingProductId(null)
    productSearchRef.current?.focus()
  }

  const handleBarcodeScan = (barcode: string) => {
    const product = products.find(p => p.barcode === barcode || p.sku === barcode)
    if (product) {
      const lineId = `${product.id}-${Date.now()}`
      setBillingLines(prev => [...prev, { lineId, product, quantity: 1 }])
      toast.success(`${product.name} agregado`)
    } else {
      toast.error(`Producto no encontrado: ${barcode}`)
    }
    setShowScanner(false)
    setTimeout(() => productSearchRef.current?.focus(), 100)
  }

  const handleProductSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' && filteredProducts.length > 0) {
      e.preventDefault()
      setShowProductDropdown(true)
      setHighlightedProductIndex((prev) => Math.min(prev + 1, filteredProducts.length - 1))
      return
    }
    if (e.key === 'ArrowUp' && filteredProducts.length > 0) {
      e.preventDefault()
      setShowProductDropdown(true)
      setHighlightedProductIndex((prev) => Math.max(prev - 1, 0))
      return
    }
    if ((e.key === 'Enter' || e.key === 'Tab' || e.key === 'ArrowRight') && filteredProducts.length > 0) {
      e.preventDefault()
      const selected = filteredProducts[highlightedProductIndex] || filteredProducts[0]
      setPendingProductId(selected.id)
      setProductSearch(selected.articulo || selected.name)
      setShowProductDropdown(false)
      setTimeout(() => { productQtyRef.current?.focus(); productQtyRef.current?.select() }, 0)
      return
    }
    if (e.key === 'Escape') {
      setShowProductDropdown(false)
      setProductSearch('')
      setPendingProductId(null)
      setHighlightedProductIndex(0)
    }
  }

  const removeItem = (lineId: string) => {
    setBillingLines(prev => prev.filter(l => l.lineId !== lineId))
    setItemPrices(prev => { const n = { ...prev }; delete n[lineId]; return n })
    setItemDiscounts(prev => { const n = { ...prev }; delete n[lineId]; return n })
    setItemNotes(prev => { const n = { ...prev }; delete n[lineId]; return n })
    if (editingNoteId === lineId) setEditingNoteId(null)
  }

  // ── Sale handlers ───────────────────────────────────────────────────────────
  const handleCompleteSale = async () => {
    if (billingLines.length === 0) { toast.error('Agrega al menos un producto'); return }

    if (formaPago !== 'credito' && paymentMethod !== 'mixto' && paidAmount < total) {
      toast.error(`Ingresa el monto recibido (mínimo $${Math.round(total).toLocaleString('es-CO')})`)
      cashInputRef.current?.focus()
      return
    }

    if (paymentMethod === 'mixto') {
      const m1 = parseFloat(mixtoAmount1) || 0
      const m2 = parseFloat(mixtoAmount2) || 0
      if (m1 + m2 < total - 1) {
        toast.error(`Monto mixto insuficiente. Faltan $${Math.round(total - m1 - m2).toLocaleString('es-CO')}`)
        return
      }
    }

    setIsProcessing(true)

    const saleItems = billingLines.map((item) => {
      const effectivePrice = itemPrices[item.lineId] ?? item.product.salePrice
      const discAmt = itemDiscounts[item.lineId] ?? 0
      const lineTotal = effectivePrice * item.quantity
      // Descuento fijo → porcentaje para el backend (sobre el precio efectivo)
      // Sin Math.round para preservar precisión: 300/15300*100 = 1.9607... → backend calcula $300 exactos
      const finalDiscountPct = lineTotal > 0 ? Math.min(100, (discAmt / lineTotal) * 100) : 0
      return {
        productId: item.product.id,
        quantity: item.quantity,
        unitPrice: effectivePrice,   // precio real que ve el cliente (override o precio por defecto)
        discount: finalDiscountPct,
      }
    })

    const effectivePaymentMethod: PaymentMethod = formaPago === 'credito' ? 'fiado' : paymentMethod

    const result = await addSale({
      items: saleItems,
      paymentMethod: effectivePaymentMethod,
      amountPaid: paidAmount,
      globalDiscount: Number(globalDiscountPct) || 0,
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer?.name,
      customerPhone: selectedCustomer?.phone,
      applyTax: applyIva,
      sedeId: sedeId || undefined,
      creditDays: formaPago === 'credito' ? creditDays : undefined,
    })

    setIsProcessing(false)

    if (result.success && result.data) {
      toast.success(`✓ Factura ${result.data.invoiceNumber} guardada`)
      handlePrint(result.data)
      setTimeout(() => handleNewInvoice(), 800)
    } else {
      toast.error(result.error || 'Error al guardar la factura')
    }
  }

  const handleNewInvoice = () => {
    setBillingLines([])
    setSelectedCustomer(null)
    setCustomerSearch('')
    setAmountPaid('')
    setMixtoAmount1('')
    setMixtoAmount2('')
    setCompletedSale(null)
    setShowAnularConfirm(false)
    setFormaPago('contado')
    setDocType('factura_venta')
    setPaymentMethod('efectivo')
    setProductSearch('')
    setProductQty(1)
    setProductPrice('')
    setItemPrices({})
    setItemDiscounts({})
    setItemNotes({})
    setEditingNoteId(null)
    setGlobalDiscountPct('')
    setTimeout(() => productSearchRef.current?.focus(), 50)
  }

  const handleAnular = async () => {
    if (!completedSale) return
    const result = await cancelSale(completedSale.id, 'Anulación desde facturación')
    if (result.success) { toast.success('Factura anulada'); handleNewInvoice() }
    else toast.error(result.error || 'Error al anular')
  }

  // ── Print ───────────────────────────────────────────────────────────────────
  const handlePrint = (sale: Sale) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    const copies = storeInfo.invoiceCopies ?? 1
    const sedeName = sedeId ? sedes.find(s => s.id === sedeId)?.name : null

    // Layout optimizado para impresora térmica 80mm (ancho útil ~72mm)
    const fmtCOP = (v: number) => `$${Math.round(v).toLocaleString('es-CO')}`
    const invoiceHtml = `
      <div class="ticket">
        <div class="header">
          ${storeInfo.invoiceLogo ? `<img src="${storeInfo.invoiceLogo}" alt="Logo" style="max-height:60px;max-width:180px;object-fit:contain;display:block;margin:0 auto 6px;" />` : ''}
          <div class="store-name">${storeInfo.name}</div>
          <div>NIT: ${storeInfo.taxId}</div>
          <div>${storeInfo.address}</div>
          <div>Tel: ${storeInfo.phone}</div>
          ${storeInfo.email ? `<div>${storeInfo.email}</div>` : ''}
          ${sedeName ? `<div><b>Sede: ${sedeName}</b></div>` : ''}
        </div>
        <div class="divider"></div>
        <div class="meta">
          <div class="meta-row"><span>${docType === 'remision' ? 'REMISIÓN' : docType === 'nota_debito' ? 'NOTA DÉBITO' : 'FACTURA'}</span><span><b>${sale.invoiceNumber}</b></span></div>
          <div class="meta-row"><span>Fecha:</span><span>${new Date(sale.createdAt).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}</span></div>
          <div class="meta-row"><span>Hora:</span><span>${new Date(sale.createdAt).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota' })}</span></div>
          <div class="meta-row"><span>Pago:</span><span>${formaPago === 'credito' ? `Crédito ${creditDays}d` : 'Contado'}</span></div>
          <div class="meta-row"><span>Método:</span><span>${PM_LABELS[sale.paymentMethod] || sale.paymentMethod}</span></div>
        </div>
        <div class="divider"></div>
        <div class="meta">
          <div><b>Cliente:</b> ${sale.customerName || 'Consumidor Final'}</div>
          ${selectedCustomer?.cedula ? `<div>CC/NIT: ${selectedCustomer.cedula}</div>` : ''}
          ${sale.customerPhone ? `<div>Tel: ${sale.customerPhone}</div>` : ''}
          ${sale.sellerName ? `<div>Vendedor: <b>${sale.sellerName}</b></div>` : ''}
        </div>
        <div class="divider"></div>
        <table class="items">
          <thead><tr><th>Cant x Precio</th><th class="tr">Total</th></tr></thead>
          <tbody>
            ${sale.items.map(item => {
              const unitPrice = item.unitPrice
              const discAmt = Math.round((item.discount / 100) * unitPrice * item.quantity)
              const itemSub = Math.max(0, unitPrice * item.quantity - discAmt)
              const itemIva = applyIva ? itemSub * TAX_RATE : 0
              const itemTotal = itemSub + itemIva
              const noteText = Object.entries(itemNotes).find(([k]) => k.startsWith(item.productId))?.[1]
              return `
                <tr class="item-name-row">
                  <td colspan="2"><b>${item.productName}</b>${item.sku || item.productSku ? ` <span class="sku">[${item.sku || item.productSku}]</span>` : ''}${noteText ? `<br><span class="note">${noteText}</span>` : ''}</td>
                </tr>
                <tr>
                  <td>${item.quantity} x ${fmtCOP(unitPrice)}${discAmt > 0 ? ` <span class="disc">-${fmtCOP(discAmt)}</span>` : ''}${applyIva ? ` +IVA` : ''}</td>
                  <td class="tr">${fmtCOP(itemTotal)}</td>
                </tr>`
            }).join('')}
          </tbody>
        </table>
        <div class="divider"></div>
        <table class="totals">
          <tr><td>Subtotal:</td><td class="tr">${fmtCOP(subtotalBeforeGlobal)}</td></tr>
          ${globalDiscAmt > 0 ? `<tr><td>Descuento (${globalDiscountPct}%):</td><td class="tr disc">-${fmtCOP(globalDiscAmt)}</td></tr>` : ''}
          ${sale.discount > 0 ? `<tr><td>Dto. items:</td><td class="tr disc">-${fmtCOP(sale.discount)}</td></tr>` : ''}
          ${applyIva ? `<tr><td>IVA (19%):</td><td class="tr">${fmtCOP(sale.tax)}</td></tr>` : `<tr><td>IVA:</td><td class="tr">$0</td></tr>`}
          <tr class="total-row"><td><b>TOTAL:</b></td><td class="tr"><b>${fmtCOP(sale.total)}</b></td></tr>
        </table>
        <div class="divider"></div>
        <table class="totals">
          ${paymentMethod === 'mixto'
            ? `<tr><td>${PM_LABELS[mixtoMethod1]}:</td><td class="tr">${fmtCOP(parseFloat(mixtoAmount1) || 0)}</td></tr>
               <tr><td>${PM_LABELS[mixtoMethod2]}:</td><td class="tr">${fmtCOP(parseFloat(mixtoAmount2) || 0)}</td></tr>`
            : ''}
          ${sale.amountPaid > 0 ? `<tr><td>Recibido:</td><td class="tr">${fmtCOP(sale.amountPaid)}</td></tr>` : ''}
          ${sale.change > 0 ? `<tr><td>Cambio:</td><td class="tr">${fmtCOP(sale.change)}</td></tr>` : ''}
          ${formaPago === 'credito' ? `<tr><td colspan="2" style="color:#000;font-weight:bold;text-align:center">*** CRÉDITO — Vence en ${creditDays} días ***</td></tr>` : ''}
        </table>
        <div class="divider"></div>
        <div class="footer">
          <div><b>${storeInfo.invoiceGreeting || '¡Gracias por su compra!'}</b></div>
          ${(storeInfo.invoicePolicy || '').split('\n').filter(Boolean).map(line => `<div>${line}</div>`).join('')}
          <div>${storeInfo.name} — ${storeInfo.phone}</div>
        </div>
      </div>`

    printWindow.document.write(`<html><head>
      <title>Factura ${sale.invoiceNumber}</title>
      <script>window.onload = function() { window.focus(); window.print(); }</script>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Courier New', Courier, monospace; font-size: 11px; width: 72mm; margin: 0; padding: 2mm; color: #000; }
        .ticket { width: 100%; }
        .header { text-align: center; padding-bottom: 4px; }
        .store-name { font-size: 13px; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; }
        .header div { font-size: 10px; line-height: 1.4; }
        .divider { border-top: 1px dashed #000; margin: 4px 0; }
        .meta { font-size: 10px; line-height: 1.5; padding: 2px 0; }
        .meta-row { display: flex; justify-content: space-between; }
        table { width: 100%; border-collapse: collapse; }
        .items thead th { font-size: 10px; border-bottom: 1px solid #000; padding: 2px 0; text-align: left; }
        .items thead th.tr { text-align: right; }
        .item-name-row td { font-size: 10px; padding-top: 3px; padding-bottom: 0; }
        .items td { font-size: 10px; padding: 1px 0; vertical-align: top; }
        .tr { text-align: right; }
        .sku { font-size: 9px; color: #444; }
        .note { font-size: 9px; color: #444; font-style: italic; }
        .disc { color: #000; }
        .totals td { font-size: 11px; padding: 1px 0; }
        .totals .tr { text-align: right; }
        .total-row td { font-size: 13px; border-top: 1px solid #000; padding-top: 3px; }
        .footer { text-align: center; font-size: 10px; padding-top: 4px; line-height: 1.5; }
        @page { size: 80mm auto; margin: 2mm; }
        @media print {
          body { width: 72mm; padding: 0; }
          .page-break { page-break-after: always; border-top: 1px dashed #000; margin: 6px 0; }
        }
      </style></head><body>
      ${invoiceHtml}
      ${copies === 2 ? `<div class="page-break"></div>${invoiceHtml}` : ''}
    </body></html>`)
    printWindow.document.close()
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex gap-3 h-full min-h-[600px]">
      {showScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* ── LEFT PANEL: Invoice Data ─────────────────────────────────────────── */}
      <div className="w-[270px] flex-shrink-0 flex flex-col rounded-lg border border-border overflow-hidden shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#2d9e8c]">
          <div className="flex flex-col">
            <span className="text-white font-semibold text-sm leading-none">Factura de Venta</span>
            {completedSale && (
              <span className="text-white/80 text-[10px] mt-0.5">#{completedSale.invoiceNumber}</span>
            )}
          </div>
          <button
            onClick={onToggleMode}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-2.5 py-1 rounded-full transition-colors"
            title="Volver al modo rápido"
          >
            <span className="w-3.5 h-3.5 bg-white rounded-full flex items-center justify-center">
              <span className="w-2 h-2 bg-[#2d9e8c] rounded-full" />
            </span>
            Turno
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 bg-card p-3 space-y-2 overflow-y-auto text-xs">

          {/* Tipo de documento */}
          <div>
            <label className="text-muted-foreground mb-1 block">Tipo Documento</label>
            <Select value={docType} onValueChange={(v) => setDocType(v as typeof docType)}>
              <SelectTrigger className="h-8 text-xs bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="factura_venta">Factura de Venta</SelectItem>
                <SelectItem value="remision">Remisión</SelectItem>
                <SelectItem value="nota_debito">Nota Débito</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fecha + No. Factura */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-muted-foreground mb-1 block">Fecha</label>
              <Input value={todayStr} readOnly className="h-8 text-xs bg-muted/40 border-border" />
            </div>
            <div>
              <label className="text-muted-foreground mb-1 block">No. Factura</label>
              <Input
                value={completedSale?.invoiceNumber ?? ''}
                readOnly
                placeholder="Auto"
                className="h-8 text-xs bg-muted/40 border-border font-mono"
              />
            </div>
          </div>

          {/* Sede */}
          {sedes.length > 0 && (
            <div>
              <label className="text-muted-foreground mb-1 flex items-center gap-1 block">
                <Building className="h-3 w-3" /> Sede
              </label>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => { setSedeId(null); setTimeout(() => productSearchRef.current?.focus(), 0) }}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${!sedeId ? 'bg-[#2d9e8c] text-white border-[#2d9e8c]' : 'border-border text-muted-foreground hover:border-[#2d9e8c]'}`}
                >
                  Todas
                </button>
                {sedes.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setSedeId(s.id); setTimeout(() => productSearchRef.current?.focus(), 0) }}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${sedeId === s.id ? 'bg-[#2d9e8c] text-white border-[#2d9e8c]' : 'border-border text-muted-foreground hover:border-[#2d9e8c]'}`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cliente search */}
          <div>
            <label className="text-muted-foreground mb-1 block">Cliente</label>
            <div className="relative" ref={customerDropdownRef}>
              <div className="flex gap-1">
                <div className="relative flex-1">
                  <Input
                    value={customerSearch}
                    onChange={(e) => handleCustomerSearch(e.target.value)}
                    placeholder="Consumidor Final"
                    className="h-8 text-xs bg-background border-border pr-7"
                  />
                  {selectedCustomer && (
                    <button
                      onClick={handleClearCustomer}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => { setCustomerSearch(' '); handleCustomerSearch(' ') }}
                  className="h-8 w-8 flex-shrink-0 border border-border rounded-md flex items-center justify-center bg-background hover:bg-accent transition-colors"
                >
                  <Search className="h-3.5 w-3.5" />
                </button>
              </div>
              {showCustomerDropdown && customerResults.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 bg-popover border border-border rounded-md shadow-lg mt-0.5 max-h-40 overflow-y-auto">
                  {customerResults.map(cust => (
                    <button
                      key={cust.id}
                      onClick={() => handleSelectCustomer(cust)}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors border-b border-border/40 last:border-b-0"
                    >
                      <span className="font-medium">{cust.name}</span>
                      {cust.cedula && <span className="text-muted-foreground ml-1">— {cust.cedula}</span>}
                      {cust.phone && <div className="text-muted-foreground">{cust.phone}</div>}
                    </button>
                  ))}
                </div>
              )}
              {isSearchingCustomers && (
                <div className="absolute z-50 top-full left-0 right-0 bg-popover border border-border rounded-md p-2 text-muted-foreground mt-0.5">
                  Buscando...
                </div>
              )}
            </div>
          </div>

          {/* Cliente info read-only fields */}
          {selectedCustomer && (
            <div className="space-y-1.5 bg-muted/30 rounded-md p-2">
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="text-muted-foreground block mb-0.5">CC / NIT</label>
                  <Input value={selectedCustomer.cedula ?? ''} readOnly className="h-7 text-xs bg-background border-border" />
                </div>
                <div>
                  <label className="text-muted-foreground block mb-0.5">Teléfono</label>
                  <Input value={selectedCustomer.phone ?? ''} readOnly className="h-7 text-xs bg-background border-border" />
                </div>
              </div>
              {selectedCustomer.email && (
                <div>
                  <label className="text-muted-foreground block mb-0.5">Email</label>
                  <Input value={selectedCustomer.email} readOnly className="h-7 text-xs bg-background border-border" />
                </div>
              )}
              {selectedCustomer.balance > 0 && (
                <div className="flex items-center justify-between rounded bg-amber-50 dark:bg-amber-950/30 px-2 py-1 border border-amber-200 dark:border-amber-800">
                  <span className="text-amber-700 dark:text-amber-400">Saldo pendiente</span>
                  <span className="font-semibold text-amber-700 dark:text-amber-400">{formatCOP(selectedCustomer.balance)}</span>
                </div>
              )}
            </div>
          )}

          {/* Método de pago */}
          <div>
            <label className="text-muted-foreground mb-1 block">Método de Pago</label>
            <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
              <SelectTrigger className="h-8 text-xs bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Forma de pago */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-muted-foreground mb-1 block">Forma de Pago</label>
              <Select value={formaPago} onValueChange={(v) => setFormaPago(v as 'contado' | 'credito')}>
                <SelectTrigger className="h-8 text-xs bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contado" className="text-xs">Contado</SelectItem>
                  <SelectItem value="credito" className="text-xs">Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formaPago === 'credito' ? (
              <div>
                <label className="text-muted-foreground mb-1 block">Días crédito</label>
                <Input
                  type="number"
                  min={1}
                  value={creditDays}
                  onChange={(e) => setCreditDays(Math.max(1, parseInt(e.target.value) || 30))}
                  className="h-8 text-xs bg-background border-border text-center"
                />
              </div>
            ) : (
              <div>
                <label className="text-muted-foreground mb-1 block">IVA (19%)</label>
                <button
                  onClick={() => setApplyIva(!applyIva)}
                  className={`w-full h-8 text-xs font-medium rounded-md border transition-colors ${
                    applyIva ? 'bg-[#2d9e8c] text-white border-[#2d9e8c]' : 'bg-muted text-muted-foreground border-border hover:border-[#2d9e8c]'
                  }`}
                >
                  {applyIva ? '✓ Incluido' : 'Sin IVA'}
                </button>
              </div>
            )}
          </div>

          {/* IVA toggle when credit */}
          {formaPago === 'credito' && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Aplicar IVA (19%)</span>
              <button
                onClick={() => setApplyIva(!applyIva)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${applyIva ? 'bg-[#2d9e8c]' : 'bg-muted-foreground/30'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${applyIva ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>
          )}

          {/* Descuento global */}
          <div>
            <label className="text-muted-foreground mb-1 block">Descuento Global (%)</label>
            <Input
              type="number"
              min={0}
              max={100}
              value={globalDiscountPct}
              onChange={(e) => setGlobalDiscountPct(e.target.value === '' ? '' : Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
              placeholder="0"
              className="h-8 text-xs bg-background border-border text-center"
            />
          </div>

          {/* Anular — only after sale */}
          {completedSale && (
            <div className="pt-1 border-t border-border/50">
              {!showAnularConfirm ? (
                <button
                  onClick={() => setShowAnularConfirm(true)}
                  className="w-full flex items-center justify-center gap-1.5 h-8 rounded-md border border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors font-medium"
                >
                  <Ban className="h-3.5 w-3.5" />
                  Anular Factura
                </button>
              ) : (
                <div className="space-y-1">
                  <p className="text-center text-muted-foreground">¿Confirmar anulación?</p>
                  <div className="flex gap-1">
                    <button
                      onClick={handleAnular}
                      className="flex-1 flex items-center justify-center gap-1 h-7 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors font-medium"
                    >
                      <Check className="h-3 w-3" /> Sí, anular
                    </button>
                    <button
                      onClick={() => setShowAnularConfirm(false)}
                      className="flex-1 flex items-center justify-center gap-1 h-7 rounded-md border border-border text-muted-foreground hover:bg-accent transition-colors"
                    >
                      <X className="h-3 w-3" /> Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL: Products + Totals ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">

        {/* Product search row */}
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0">
            <label className="text-xs text-muted-foreground mb-1 block">Producto / Artículo <kbd className="ml-1 px-1 py-0.5 bg-muted rounded text-[10px]">F4</kbd></label>
            <div className="relative">
              <Input
                ref={productSearchRef}
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value)
                  setShowProductDropdown(e.target.value.length > 0)
                }}
                onKeyDown={handleProductSearchKey}
                onFocus={() => productSearch.length > 0 && setShowProductDropdown(true)}
                placeholder="Buscar por nombre, código, SKU..."
                className="h-9 text-sm bg-background border-border pr-9"
              />
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              {showProductDropdown && filteredProducts.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 bg-popover border border-border rounded-md shadow-lg mt-0.5 max-h-56 overflow-y-auto">
                  {filteredProducts.map((p, index) => {
                    const lowStock = !p.isComposite && p.stock > 0 && p.stock <= p.reorderPoint
                    const outStock = !p.isComposite && p.stock === 0
                    const isActive = index === highlightedProductIndex
                    return (
                      <button
                        key={p.id}
                        data-product-option={p.id}
                        onClick={() => handleAddProductFromSearch(p.id)}
                        onMouseEnter={() => setHighlightedProductIndex(index)}
                        className={`w-full text-left px-3 py-1.5 text-xs transition-colors border-b border-border/40 last:border-b-0 flex items-center justify-between gap-2 ${isActive ? 'bg-accent' : 'hover:bg-accent'}`}
                      >
                        <div className="min-w-0">
                          <span className="font-medium truncate block">{p.name}</span>
                          <span className="text-muted-foreground">{p.sku}{p.articulo ? ` · ${p.articulo}` : ''}</span>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <div className="font-semibold text-[#2d9e8c]">{formatCOP(p.salePrice)}</div>
                          <div className={`text-[10px] ${outStock ? 'text-red-500' : lowStock ? 'text-amber-500' : 'text-muted-foreground'}`}>
                            Stock: {p.stock}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="w-20 flex-shrink-0">
            <label className="text-xs text-muted-foreground mb-1 block">Cant.</label>
            <Input
              type="number"
              min={1}
              ref={productQtyRef}
              value={productQty}
              onChange={(e) => {
                setProductQty(Math.max(1, parseInt(e.target.value) || 1))
              }}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'ArrowRight') {
                  e.preventDefault()
                  productPriceRef.current?.focus()
                  productPriceRef.current?.select()
                } else if (e.key === 'Escape') {
                  setPendingProductId(null)
                  setProductSearch('')
                  setProductQty(1)
                  productSearchRef.current?.focus()
                }
              }}
              className="h-9 text-sm bg-background border-border text-center"
            />
          </div>
          <div className="w-28 flex-shrink-0">
            <label className="text-xs text-muted-foreground mb-1 block">Precio unit.</label>
            <Input
              type="number"
              min={0}
              ref={productPriceRef}
              value={productPrice}
              onChange={(e) => setProductPrice(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'ArrowRight') {
                  e.preventDefault()
                  const id = pendingProductId ?? (filteredProducts.length > 0 ? filteredProducts[0].id : null)
                  if (id) handleAddProductFromSearch(id)
                } else if (e.key === 'Escape') {
                  setPendingProductId(null)
                  setProductSearch('')
                  setProductQty(1)
                  setProductPrice('')
                  productSearchRef.current?.focus()
                }
              }}
              placeholder="Precio"
              className="h-9 text-sm bg-background border-border"
            />
          </div>
          <button
            onClick={() => setShowScanner(true)}
            className="h-9 w-9 flex-shrink-0 border border-border rounded-md flex items-center justify-center bg-background hover:bg-accent transition-colors"
            title="Escanear código de barras"
          >
            <ScanLine className="h-4 w-4" />
          </button>
          <Button
            className="h-9 w-9 p-0 bg-[#2d9e8c] hover:bg-[#268a7a] text-white flex-shrink-0"
            onClick={() => { if (filteredProducts.length > 0) handleAddProductFromSearch(filteredProducts[0].id) }}
            title="Agregar producto (Enter)"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        {/* Products table */}
        <div className="flex-1 border border-border rounded-lg overflow-hidden bg-card min-h-0">
          <div className="overflow-auto h-full">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-muted/60 border-b border-border">
                  <th className="w-8 px-1.5 py-2" />
                  <th className="w-7 px-1 py-2 text-center font-semibold text-foreground/60">#</th>
                  <th className="w-16 px-2 py-2 text-left font-semibold text-foreground/60">Código</th>
                  <th className="px-2 py-2 text-left font-semibold text-foreground/60">Descripción</th>
                  <th className="w-20 px-1 py-2 text-center font-semibold text-foreground/60">Cant.</th>
                  <th className="w-20 px-1 py-2 text-center font-semibold text-foreground/60">Dto $</th>
                  <th className="w-24 px-1 py-2 text-center font-semibold text-foreground/60">V. Unitario</th>
                  {applyIva && <th className="w-16 px-2 py-2 text-right font-semibold text-foreground/60">IVA</th>}
                  <th className="w-20 px-2 py-2 text-right font-semibold text-foreground/60">Subtotal</th>
                  <th className="w-20 px-2 py-2 text-right font-semibold text-foreground/60">Total</th>
                  <th className="w-7 px-1 py-2 text-center font-semibold text-foreground/60">Ref</th>
                </tr>
              </thead>
              <tbody>
                {billingLines.map((item, idx) => {
                  const effectivePrice = itemPrices[item.lineId] ?? item.product.salePrice
                  const discAmt = itemDiscounts[item.lineId] ?? 0
                  const itemSub = Math.max(0, effectivePrice * item.quantity - discAmt)
                  const itemIva = applyIva ? itemSub * TAX_RATE : 0
                  const itemTotal = itemSub + itemIva
                  const isEditingNote = editingNoteId === item.lineId
                  return (
                    <>
                      <tr key={item.lineId} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                        {/* Delete */}
                        <td className="px-1.5 py-1">
                          <button
                            onClick={() => removeItem(item.lineId)}
                            className="flex items-center justify-center w-6 h-6 rounded bg-red-500 hover:bg-red-600 text-white transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                        {/* # */}
                        <td className="px-1 py-1 text-center text-muted-foreground">{idx + 1}</td>
                        {/* Código */}
                        <td className="px-2 py-1 text-muted-foreground font-mono">
                          {item.product.articulo || item.product.sku}
                        </td>
                        {/* Descripción */}
                        <td className="px-2 py-1 max-w-[140px]">
                          <div className="truncate font-medium">{item.product.name}</div>
                          {itemNotes[item.lineId] && !isEditingNote && (
                            <div className="text-[10px] text-muted-foreground truncate italic">{itemNotes[item.lineId]}</div>
                          )}
                        </td>
                        {/* Cantidad */}
                        <td className="px-1 py-1">
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => setBillingLines(prev => prev.map(l => l.lineId === item.lineId ? { ...l, quantity: Math.max(1, parseInt(e.target.value) || 1) } : l))}
                            onFocus={(e) => e.target.select()}
                            className="w-full h-7 px-1 text-center text-xs border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-[#2d9e8c]"
                          />
                        </td>
                        {/* Descuento fijo $ */}
                        <td className="px-1 py-1">
                          <input
                            type="number"
                            min={0}
                            value={discAmt || ''}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value) || 0
                              const maxDisc = effectivePrice * item.quantity
                              setItemDiscounts(prev => ({ ...prev, [item.lineId]: Math.min(maxDisc, Math.max(0, v)) }))
                            }}
                            onFocus={(e) => e.target.select()}
                            placeholder="$0"
                            className="w-full h-7 px-1 text-right text-xs border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-[#2d9e8c]"
                          />
                        </td>
                        {/* Valor Unitario */}
                        <td className="px-1 py-1">
                          <input
                            type="number"
                            min={0}
                            value={effectivePrice || ''}
                            onChange={(e) => setItemPrices(prev => ({ ...prev, [item.lineId]: parseFloat(e.target.value) || 0 }))}
                            onFocus={(e) => e.target.select()}
                            className="w-full h-7 px-1 text-right text-xs border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-[#2d9e8c]"
                          />
                        </td>
                        {/* IVA */}
                        {applyIva && (
                          <td className="px-2 py-1 text-right text-muted-foreground">
                            {Math.round(itemIva).toLocaleString('es-CO')}
                          </td>
                        )}
                        {/* Subtotal */}
                        <td className="px-2 py-1 text-right">{Math.round(itemSub).toLocaleString('es-CO')}</td>
                        {/* Total */}
                        <td className="px-2 py-1 text-right font-semibold">{Math.round(itemTotal).toLocaleString('es-CO')}</td>
                        {/* Ref/Nota */}
                        <td className="px-1 py-1 text-center">
                          <button
                            onClick={() => setEditingNoteId(isEditingNote ? null : item.lineId)}
                            title="Agregar nota/referencia"
                          >
                            <Pencil className={`h-3.5 w-3.5 mx-auto transition-colors ${isEditingNote ? 'text-[#2d9e8c]' : 'text-blue-400 hover:text-blue-600'}`} />
                          </button>
                        </td>
                      </tr>
                      {/* Note row */}
                      {isEditingNote && (
                        <tr key={`${item.lineId}-note`} className="bg-blue-50/50 dark:bg-blue-950/20">
                          <td colSpan={applyIva ? 11 : 10} className="px-3 py-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground shrink-0">Ref / Nota:</span>
                              <input
                                autoFocus
                                type="text"
                                value={itemNotes[item.lineId] ?? ''}
                                onChange={(e) => setItemNotes(prev => ({ ...prev, [item.lineId]: e.target.value }))}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditingNoteId(null) }}
                                placeholder="Número de referencia, descripción adicional..."
                                className="flex-1 h-6 px-2 text-xs border border-blue-300 dark:border-blue-700 rounded bg-background focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                              <button
                                onClick={() => setEditingNoteId(null)}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <Check className="h-3.5 w-3.5 text-green-500" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
                {billingLines.length === 0 && (
                  <tr>
                    <td colSpan={applyIva ? 11 : 10} className="px-4 py-10 text-center text-muted-foreground text-xs">
                      Busque o escanee un producto para comenzar la factura
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/40">
                  <td />
                  <td colSpan={3} className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    {billingLines.length} ítem{billingLines.length !== 1 ? 's' : ''}
                  </td>
                  <td className="px-1 py-1.5 text-center text-xs font-bold">
                    {billingLines.reduce((s, i) => s + i.quantity, 0)}
                  </td>
                  <td />
                  <td className="px-1 py-1.5 text-right text-xs font-semibold text-muted-foreground">Totales →</td>
                  {applyIva && (
                    <td className="px-2 py-1.5 text-right text-xs font-bold">
                      ${Math.round(billingLines.reduce((s, item) => {
                        const p = itemPrices[item.lineId] ?? item.product.salePrice
                        const da = itemDiscounts[item.lineId] ?? 0
                        return s + Math.max(0, p * item.quantity - da) * TAX_RATE
                      }, 0)).toLocaleString('es-CO')}
                    </td>
                  )}
                  <td className="px-2 py-1.5 text-right text-xs font-bold">
                    ${Math.round(subtotalBeforeGlobal).toLocaleString('es-CO')}
                  </td>
                  <td className="px-2 py-1.5 text-right text-xs font-bold text-[#2d9e8c]">
                    ${Math.round(total).toLocaleString('es-CO')}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Totals + payment + actions */}
        <div className="border border-border rounded-lg bg-card p-3">
          <div className="flex gap-6 items-start">

            {/* Totals */}
            <div className="flex-1 space-y-0.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Subtotal bruto:</span>
                <span>${Math.round(subtotalBeforeGlobal).toLocaleString('es-CO')}</span>
              </div>
              {globalDiscAmt > 0 && (
                <div className="flex justify-between text-xs text-red-500">
                  <span>Descuento ({globalDiscountPct}%):</span>
                  <span>-${Math.round(globalDiscAmt).toLocaleString('es-CO')}</span>
                </div>
              )}
              {applyIva && (
                <div className="flex justify-between text-xs text-amber-600">
                  <span>IVA (19%):</span>
                  <span>${Math.round(tax).toLocaleString('es-CO')}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold border-t border-border pt-1 mt-1">
                <span>TOTAL:</span>
                <span className="text-[#2d9e8c]">${Math.round(total).toLocaleString('es-CO')}</span>
              </div>
            </div>

            {/* Payment inputs */}
            <div className="flex-1 space-y-1.5">
              {formaPago === 'credito' ? (
                <div className="flex items-center justify-between h-9 px-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Venta a crédito — {creditDays} días</span>
                </div>
              ) : paymentMethod === 'mixto' ? (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    <Select value={mixtoMethod1} onValueChange={(v) => setMixtoMethod1(v as PaymentMethod)}>
                      <SelectTrigger className="h-8 text-xs flex-1 bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MIXTO_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <input
                      type="number"
                      value={mixtoAmount1}
                      onChange={(e) => setMixtoAmount1(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      placeholder="$0"
                      className="w-28 h-8 px-2 text-right text-xs border border-border rounded-md bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 focus:outline-none focus:ring-1 focus:ring-[#2d9e8c]"
                    />
                  </div>
                  <div className="flex gap-1">
                    <Select value={mixtoMethod2} onValueChange={(v) => setMixtoMethod2(v as PaymentMethod)}>
                      <SelectTrigger className="h-8 text-xs flex-1 bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MIXTO_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <input
                      type="number"
                      value={mixtoAmount2}
                      onChange={(e) => setMixtoAmount2(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      placeholder="$0"
                      className="w-28 h-8 px-2 text-right text-xs border border-border rounded-md bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 focus:outline-none focus:ring-1 focus:ring-[#2d9e8c]"
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground px-1">
                    <span>Total recibido:</span>
                    <span className={paidAmount >= total ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
                      ${Math.round(paidAmount).toLocaleString('es-CO')}
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground w-28 text-right shrink-0">
                      Efectivo <kbd className="ml-0.5 px-1 bg-muted rounded text-[9px]">F11</kbd>:
                    </span>
                    <input
                      ref={cashInputRef}
                      type="number"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      placeholder="$0"
                      className="flex-1 h-9 px-3 text-right text-sm border border-green-200 dark:border-green-800 rounded-md bg-green-50 dark:bg-green-950/30 focus:outline-none focus:ring-1 focus:ring-[#2d9e8c]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground w-28 text-right shrink-0">Cambio:</span>
                    <span className={`flex-1 text-right text-xl font-bold ${change > 0 ? 'text-[#2d9e8c]' : 'text-foreground'}`}>
                      ${Math.round(change).toLocaleString('es-CO')}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                onClick={handleNewInvoice}
                className="h-9 text-xs gap-1.5 bg-slate-600 hover:bg-slate-700 text-white px-4 whitespace-nowrap"
              >
                <FileText className="h-3.5 w-3.5" />
                Nueva <kbd className="ml-0.5 opacity-70 text-[10px]">F3</kbd>
              </Button>
              <Button
                size="sm"
                onClick={() => completedSale ? handlePrint(completedSale) : handleCompleteSale()}
                disabled={isProcessing || billingLines.length === 0}
                className="h-9 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 whitespace-nowrap"
              >
                <Printer className="h-3.5 w-3.5" />
                {isProcessing ? 'Guardando...' : completedSale ? 'Reimprimir' : 'Guardar e Imprimir'}
                {!isProcessing && <kbd className="ml-0.5 opacity-70 text-[10px]">F12</kbd>}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
