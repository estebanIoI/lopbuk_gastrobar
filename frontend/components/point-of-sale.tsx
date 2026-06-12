'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore, calculateCartTotals } from '@/lib/store'
import { api } from '@/lib/api'
import { TAX_RATE, type PaymentMethod, type Customer, type CustomerFull } from '@/lib/types'
import { formatCOP } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FiadoCheckout } from '@/components/fiado-checkout'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Package,
  CreditCard,
  Banknote,
  Building,
  Check,
  X,
  Printer,
  FileText,
  UserPlus,
  User,
  ScanLine,
  Camera,
  Smartphone,
  Calculator,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Coins,
  Receipt,
  Zap,
  Split,
  ImageIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Sale } from '@/lib/types'
import { BarcodeScanner } from '@/components/barcode-scanner'
import { RemoteScanner } from '@/components/remote-scanner'
import { SyncStatusBar } from '@/components/sync-status-bar'

export function PointOfSale() {
  const { products, fetchProducts, cart, addToCart, removeFromCart, updateCartQuantity, applyItemDiscount, setCustomAmount, clearCart, addSale, storeInfo, selectedCustomer, setSelectedCustomer, categories, fetchCategories, sedes, fetchSedes } = useStore()
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedSede, setSelectedSede] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [showRemoteScanner, setShowRemoteScanner] = useState(false)
  const [showScanOptions, setShowScanOptions] = useState(false)
  // Variantes
  const [variantPickProduct, setVariantPickProduct] = useState<any | null>(null)
  const [variantPickVariants, setVariantPickVariants] = useState<any[]>([])
  const [variantPickLoading, setVariantPickLoading] = useState(false)
  const [variantPickQty, setVariantPickQty] = useState(1)

  useEffect(() => {
    fetchProducts()
    fetchCategories()
    fetchSedes()
  }, [fetchProducts, fetchCategories, fetchSedes])

  const getCategoryName = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId)
    return cat ? cat.name : categoryId
  }
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [isFiadoOpen, setIsFiadoOpen] = useState(false)
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo')
  const [amountPaid, setAmountPaid] = useState('')
  const [globalDiscount, setGlobalDiscount] = useState(0)
  // Mixed payment
  const [mixedSecondMethod, setMixedSecondMethod] = useState<PaymentMethod>('tarjeta')
  const [mixedCashAmount, setMixedCashAmount] = useState('')
  // Animation on add
  const [flashProductId, setFlashProductId] = useState<string | null>(null)
  // Refs
  const searchRef = useRef<HTMLInputElement>(null)
  const barcodeBuffer = useRef('')
  const barcodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [applyIva, setApplyIva] = useState(false)
  const [customer, setCustomer] = useState<Customer>({ name: '', phone: '', email: '' })
  const [completedSale, setCompletedSale] = useState<Sale | null>(null)
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false)

  // Estado para búsqueda de cliente (fiado)
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false)
  const [customerSearchQuery, setCustomerSearchQuery] = useState('')
  const [customerSearchResults, setCustomerSearchResults] = useState<CustomerFull[]>([])
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false)
  const [isNewCustomerFormOpen, setIsNewCustomerFormOpen] = useState(false)
  const [newCustomer, setNewCustomer] = useState({ cedula: '', name: '', phone: '', email: '', address: '' })

  // Calculadora de denominaciones de efectivo
  const DENOMINATIONS = [
    { value: 100000, label: '$100.000', type: 'billete' },
    { value: 50000, label: '$50.000', type: 'billete' },
    { value: 20000, label: '$20.000', type: 'billete' },
    { value: 10000, label: '$10.000', type: 'billete' },
    { value: 5000, label: '$5.000', type: 'billete' },
    { value: 2000, label: '$2.000', type: 'billete' },
    { value: 1000, label: '$1.000', type: 'moneda' },
    { value: 500, label: '$500', type: 'moneda' },
    { value: 200, label: '$200', type: 'moneda' },
    { value: 100, label: '$100', type: 'moneda' },
    { value: 50, label: '$50', type: 'moneda' },
  ] as const
  const [showDenomCalc, setShowDenomCalc] = useState(false)
  const [denomCounts, setDenomCounts] = useState<Record<number, number>>({})

  const denomTotal = Object.entries(denomCounts).reduce(
    (sum, [denom, count]) => sum + Number(denom) * count, 0
  )

  const handleDenomChange = (denom: number, delta: number) => {
    setDenomCounts(prev => {
      const current = prev[denom] || 0
      const next = Math.max(0, current + delta)
      const updated = { ...prev }
      if (next === 0) {
        delete updated[denom]
      } else {
        updated[denom] = next
      }
      return updated
    })
  }

  const handleDenomSet = (denom: number, count: number) => {
    setDenomCounts(prev => {
      const updated = { ...prev }
      if (count <= 0) {
        delete updated[denom]
      } else {
        updated[denom] = count
      }
      return updated
    })
  }

  const resetDenomCalc = () => {
    setDenomCounts({})
  }

  // Sync denomination total to amountPaid when using calculator
  useEffect(() => {
    if (showDenomCalc && denomTotal > 0) {
      setAmountPaid(denomTotal.toString())
    }
  }, [denomTotal, showDenomCalc])

  const cartTotals = calculateCartTotals(cart, applyIva)
  const subtotal = cartTotals.subtotal
  const tax = applyIva ? cartTotals.tax : 0
  const total = applyIva ? cartTotals.total : cartTotals.subtotal
  const finalTotal = total - globalDiscount
  const mixedCash = parseFloat(mixedCashAmount || '0')
  const mixedSecondAmount = Math.max(0, finalTotal - mixedCash)
  const change =
    paymentMethod === 'efectivo'
      ? Math.max(0, parseFloat(amountPaid || '0') - finalTotal)
      : paymentMethod === 'mixto'
      ? Math.max(0, mixedCash - finalTotal)
      : 0
  
  // Filter products available for sale (exclude raw materials/insumos)
  const availableProducts = products.filter(p => {
    if (p.category === 'insumos') return false
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.articulo && p.articulo.toLowerCase().includes(search.toLowerCase())) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase()))
    const matchesCategory = !selectedCategory || p.category === selectedCategory
    const matchesSede = !selectedSede || p.sedeId === selectedSede
    // Composite products (BOM/formulas) always show even with stock=0 so the seller can see them
    if (p.isComposite) return matchesSearch && matchesCategory && matchesSede
    return matchesSearch && matchesCategory && matchesSede && p.stock > 0
  })
  
  const handleAddToCart = async (productId: string) => {
    const product = products.find(p => p.id === productId)
    if (!product) return

    if (product.isComposite && product.stock <= 0) {
      toast.error('Sin insumos disponibles para fabricar este producto')
      return
    }

    // Verificar si tiene variantes
    try {
      setVariantPickLoading(true)
      const variants = await api.getVariantsByProduct(productId)
      const activeVariants = Array.isArray(variants)
        ? variants.filter((v: any) => v.isActive && v.stock > 0)
        : []

      if (activeVariants.length > 0) {
        setVariantPickProduct(product)
        setVariantPickVariants(activeVariants)
        setVariantPickQty(1)
        setVariantPickLoading(false)
        return
      }
    } catch { /* sin variantes — flujo normal */ }
    finally { setVariantPickLoading(false) }

    const cartItem = cart.find(item => item.product.id === productId)
    if (cartItem && cartItem.quantity >= product.stock) return
    addToCart(product)
    setFlashProductId(productId)
    setTimeout(() => setFlashProductId(null), 500)
  }

  const handleAddVariantToCart = async (variant: any) => {
    if (!variantPickProduct) return
    // Resolver precio del tier según cantidad
    let price = variant.priceOverride ?? variantPickProduct.salePrice
    try {
      const resolved = await api.resolveVariantPrice(variant.id, variantPickQty)
      price = (resolved?.data as any)?.price ?? price
    } catch { /* usa precio base */ }

    // Agregar al carrito como producto con metadata de variante
    const syntheticProduct = {
      ...variantPickProduct,
      id: variantPickProduct.id,
      variantId: variant.id,
      salePrice: price,
      stock: variant.stock,
      sku: variant.sku,
      name: `${variantPickProduct.name} — ${variant.label || variant.sku}`,
      color: variant.color,
      size: variant.size,
    }
    addToCart(syntheticProduct)
    setFlashProductId(variantPickProduct.id)
    setTimeout(() => setFlashProductId(null), 500)
    setVariantPickProduct(null)
    setVariantPickVariants([])
  }
  
  const handleBarcodeScan = async (barcode: string) => {
    try {
      const result = await api.findProductByBarcode(barcode)
      if (result.success && result.data) {
        const product = result.data
        const cartItem = cart.find(item => item.product.id === product.id)
        if (cartItem && cartItem.quantity >= product.stock) {
          toast.error(`⚠️ Stock máximo alcanzado para ${product.name}`, {
            duration: 2000,
            className: 'bg-orange-500 text-white border-2 border-orange-600'
          })
          return
        }
        addToCart(product)
        toast.success(`✓ AGREGADO AL CARRITO\n${product.name}\n${formatCOP(product.salePrice)}`, {
          duration: 2000,
          className: 'bg-green-500 text-white border-2 border-green-600',
          style: {
            fontSize: '14px',
            fontWeight: 'bold',
            padding: '14px',
            lineHeight: '1.5'
          }
        })
      } else {
        toast.error(`❌ PRODUCTO NO ENCONTRADO\nBarcode: ${barcode}`, {
          duration: 2000,
          className: 'bg-red-500 text-white border-2 border-red-600',
          style: {
            fontSize: '14px',
            fontWeight: 'bold',
            padding: '14px',
            lineHeight: '1.5'
          }
        })
      }
    } catch (error) {
      toast.error('❌ Error al escanear', {
        duration: 2000,
        className: 'bg-red-500 text-white border-2 border-red-600'
      })
    }
  }

  const handleQuantityChange = (productId: string, delta: number) => {
    const cartItem = cart.find(item => item.product.id === productId)
    if (!cartItem) return
    
    const newQuantity = cartItem.quantity + delta
    const product = products.find(p => p.id === productId)
    
    if (newQuantity <= 0) {
      removeFromCart(productId)
    } else if (product && newQuantity <= product.stock) {
      updateCartQuantity(productId, newQuantity)
    }
  }
  
  const handleCheckout = () => {
    if (cart.length === 0) return
    setIsCheckoutOpen(true)
    setAmountPaid(finalTotal.toFixed(2))
  }
  
  const paymentLabels: Record<string, string> = {
    efectivo: 'Efectivo',
    tarjeta: 'Tarjeta',
    transferencia: 'Transferencia',
    fiado: 'Fiado',
    addi: 'Addi',
    sistecredito: 'Sistecredito',
    mixto: 'Pago Mixto',
  }

  // Búsqueda de clientes para fiado
  const handleSearchCustomers = async (query: string) => {
    setCustomerSearchQuery(query)
    if (query.length < 2) {
      setCustomerSearchResults([])
      return
    }
    setIsSearchingCustomers(true)
    const result = await api.searchCustomers(query)
    if (result.success && result.data) {
      setCustomerSearchResults(result.data)
    }
    setIsSearchingCustomers(false)
  }

  const handleSelectCustomer = (cust: CustomerFull) => {
    setSelectedCustomer(cust)
    setCustomer({ name: cust.name, phone: cust.phone || '', email: cust.email || '' })
    setIsCustomerSearchOpen(false)
    setCustomerSearchQuery('')
    setCustomerSearchResults([])
  }

  const handleCreateCustomer = async () => {
    if (!newCustomer.name) return
    const result = await api.createCustomer(newCustomer)
    if (result.success && result.data) {
      const createdCustomer: CustomerFull = {
        ...result.data,
        totalCredit: 0,
        totalPaid: 0,
        balance: 0,
      }
      setSelectedCustomer(createdCustomer)
      setCustomer({ name: createdCustomer.name, phone: createdCustomer.phone || '', email: createdCustomer.email || '' })
      setIsNewCustomerFormOpen(false)
      setIsCustomerSearchOpen(false)
      setNewCustomer({ cedula: '', name: '', phone: '', email: '', address: '' })
    }
  }

  const handlePaymentMethodChange = (method: PaymentMethod) => {
    setPaymentMethod(method)
    setShowDenomCalc(false)
    resetDenomCalc()
    setMixedCashAmount('')
    if (method === 'fiado') {
      setIsCustomerSearchOpen(true)
      setAmountPaid('0')
    } else if (method === 'mixto') {
      setAmountPaid(finalTotal.toFixed(2))
      setMixedCashAmount('')
    } else if (method !== 'efectivo') {
      setAmountPaid(finalTotal.toFixed(2))
    }
  }

  const handlePrintInvoice = () => {
    if (!completedSale) return
    const sale = completedSale
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const copies = storeInfo.invoiceCopies ?? 1

    const invoiceHtml = `
          <div class="invoice">
            <div class="header">
              ${storeInfo.invoiceLogo ? `<img src="${storeInfo.invoiceLogo}" alt="Logo" style="max-height:70px;max-width:200px;object-fit:contain;margin-bottom:8px;" />` : ''}
              <h1>${storeInfo.name}</h1>
              <p class="nit">NIT: ${storeInfo.taxId}</p>
              <p>${storeInfo.address}</p>
              <p>Tel: ${storeInfo.phone} | ${storeInfo.email}</p>
            </div>
            <div class="invoice-info">
              <div>
                <h3>Factura de Venta</h3>
                <p><strong>No: ${sale.invoiceNumber}</strong></p>
                <p>Fecha: ${new Date(sale.createdAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p>Hora: ${new Date(sale.createdAt).toLocaleTimeString('es-CO')}</p>
              </div>
              <div>
                <h3>Cliente</h3>
                ${sale.customerName ? `<p>${sale.customerName}</p>` : '<p>Consumidor Final</p>'}
                ${sale.customerPhone ? `<p>Tel: ${sale.customerPhone}</p>` : ''}
                ${sale.sellerName ? `<p style="margin-top:10px"><strong>Vendedor:</strong> ${sale.sellerName}</p>` : ''}
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>SKU</th>
                  <th>Cant.</th>
                  <th class="text-right">P. Unit.</th>
                  <th class="text-right">Desc.</th>
                  <th class="text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${sale.items.map(item => `
                  <tr>
                    <td>${item.productName}</td>
                    <td>${item.sku || item.productSku || '-'}</td>
                    <td>${item.quantity}</td>
                    <td class="text-right">$${item.unitPrice.toLocaleString('es-CO')}</td>
                    <td class="text-right">${item.discount > 0 ? `$${item.discount.toLocaleString('es-CO')}` : '-'}</td>
                    <td class="text-right">$${(item.subtotal || item.total || 0).toLocaleString('es-CO')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <table class="totals">
              <tr><td>Subtotal:</td><td class="text-right">$${sale.subtotal.toLocaleString('es-CO')}</td></tr>
              ${sale.discount > 0 ? `<tr><td>Descuento:</td><td class="text-right">-$${sale.discount.toLocaleString('es-CO')}</td></tr>` : ''}
              ${sale.tax > 0
                ? `<tr><td style="color:#b45309;font-weight:600">IVA (19%) — Fact. Electrónica:</td><td class="text-right" style="color:#b45309;font-weight:600">$${sale.tax.toLocaleString('es-CO')}</td></tr>`
                : `<tr><td style="color:#16a34a">Sin IVA (venta directa):</td><td class="text-right" style="color:#16a34a">$0</td></tr>`
              }
              <tr class="total-row"><td>TOTAL:</td><td class="text-right">$${sale.total.toLocaleString('es-CO')}</td></tr>
            </table>
            <div class="payment-info">
              <h3>Información de Pago</h3>
              <p><strong>Método:</strong> ${paymentLabels[sale.paymentMethod] || sale.paymentMethod}</p>
              ${sale.paymentMethod === 'mixto' && mixedCash > 0 ? `
              <p style="margin-left:10px; font-size:12px;"><strong>Efectivo:</strong> $${mixedCash.toLocaleString('es-CO')}</p>
              <p style="margin-left:10px; font-size:12px;"><strong>${paymentLabels[mixedSecondMethod] || mixedSecondMethod}:</strong> $${mixedSecondAmount.toLocaleString('es-CO')}</p>` : ''}
              <p><strong>Monto Recibido:</strong> $${sale.amountPaid.toLocaleString('es-CO')}</p>
              ${sale.change > 0 ? `<p><strong>Cambio:</strong> $${sale.change.toLocaleString('es-CO')}</p>` : ''}
            </div>
            <div class="footer">
              <p><strong>${storeInfo.invoiceGreeting || '¡Gracias por su compra!'}</strong></p>
              ${(storeInfo.invoicePolicy || '').split('\n').map(line => `<p>${line}</p>`).join('')}
              <p>${storeInfo.name} - ${storeInfo.phone}</p>
            </div>
          </div>`

    printWindow.document.write(`
      <html>
        <head>
          <title>Factura ${sale.invoiceNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; max-width: 800px; margin: 0 auto; color: #333; font-size: 14px; }
            .invoice { margin-bottom: 0; }
            .page-break { border: none; border-top: 2px dashed #aaa; margin: 30px 0; page-break-after: always; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
            .header h1 { margin: 0 0 5px 0; font-size: 22px; }
            .header p { margin: 3px 0; color: #555; font-size: 13px; }
            .header .nit { font-weight: bold; font-size: 14px; }
            .invoice-info { display: flex; justify-content: space-between; margin-bottom: 20px; }
            .invoice-info h3 { margin: 0 0 8px 0; font-size: 13px; color: #666; text-transform: uppercase; }
            .invoice-info p { margin: 3px 0; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { background: #f0f0f0; padding: 10px 8px; text-align: left; border-bottom: 2px solid #ccc; font-size: 12px; text-transform: uppercase; }
            td { padding: 8px; border-bottom: 1px solid #eee; font-size: 13px; }
            .text-right { text-align: right; }
            .totals { width: 300px; margin-left: auto; }
            .totals tr td { padding: 5px 8px; }
            .totals .total-row td { font-size: 16px; font-weight: bold; border-top: 2px solid #333; padding-top: 10px; }
            .payment-info { background: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
            .payment-info h3 { margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; color: #666; }
            .payment-info p { margin: 3px 0; font-size: 13px; }
            .footer { text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px dashed #ccc; font-size: 12px; color: #777; }
            .footer p { margin: 4px 0; }
            @media print { body { padding: 15px; } .page-break { page-break-after: always; } }
          </style>
        </head>
        <body>
          ${invoiceHtml}
          ${copies === 2 ? `<hr class="page-break" />${invoiceHtml}` : ''}
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const handleCloseInvoice = () => {
    setIsInvoiceOpen(false)
    setCompletedSale(null)
  }

  const handleCompleteSale = async () => {
    setIsProcessing(true)
    const saleItems = cart.map(item => ({
      productId: item.product.id,
      quantity: item.quantity,
      discount: item.discount,
      ...(item.customAmount ? { customAmount: item.customAmount } : {}),
    }))

    const result = await addSale({
      items: saleItems,
      paymentMethod,
      amountPaid:
        paymentMethod === 'fiado' ? 0
        : paymentMethod === 'mixto' ? mixedCash + mixedSecondAmount
        : (parseFloat(amountPaid) || finalTotal),
      globalDiscount: globalDiscount > 0 ? globalDiscount : undefined,
      customerId: selectedCustomer?.id,
      customerName: customer.name || selectedCustomer?.name || undefined,
      customerPhone: customer.phone || selectedCustomer?.phone || undefined,
      applyTax: applyIva,
    })

    setIsProcessing(false)

    if (result.success) {
      setIsCheckoutOpen(false)
      setPaymentMethod('efectivo')
      setAmountPaid('')
      setGlobalDiscount(0)
      setApplyIva(false)
      setCustomer({ name: '', phone: '', email: '' })
      setSelectedCustomer(null)
      setShowDenomCalc(false)
      resetDenomCalc()
      setMixedCashAmount('')

      if (result.data) {
        setCompletedSale(result.data)
        setIsInvoiceOpen(true)
      }
    }
  }

  // Keyboard shortcuts — placed after all state/function declarations
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      if (e.key === 'F2') {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
      if (e.key === 'F4') {
        e.preventDefault()
        if (cart.length > 0 && !isCheckoutOpen && !isFiadoOpen) handleCheckout()
      }
      if (e.key === 'Escape' && isCheckoutOpen) {
        setIsCheckoutOpen(false)
      }
      if (e.key === 'Enter' && isCheckoutOpen && !isInput) {
        e.preventDefault()
        const canPay =
          !isProcessing &&
          !(paymentMethod === 'efectivo' && parseFloat(amountPaid) < Math.round(finalTotal * 100) / 100) &&
          !(paymentMethod === 'fiado' && !selectedCustomer)
        if (canPay) handleCompleteSale()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cart.length, isCheckoutOpen, isFiadoOpen, isProcessing, paymentMethod, amountPaid, finalTotal, selectedCustomer])

  // Auto barcode scanner detection (hardware scanner = fast keyboard input + Enter)
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (isCheckoutOpen || isFiadoOpen || showScanner || showRemoteScanner) return
      if (e.key === 'Enter') {
        const code = barcodeBuffer.current.trim()
        if (code.length >= 4) handleBarcodeScan(code)
        barcodeBuffer.current = ''
        return
      }
      if (e.key.length === 1) {
        barcodeBuffer.current += e.key
        if (barcodeTimer.current) clearTimeout(barcodeTimer.current)
        barcodeTimer.current = setTimeout(() => { barcodeBuffer.current = '' }, 80)
      }
    }
    window.addEventListener('keydown', handleGlobalKey)
    return () => window.removeEventListener('keydown', handleGlobalKey)
  }, [isCheckoutOpen, isFiadoOpen, showScanner, showRemoteScanner])

  const selectedSedeName = selectedSede ? sedes.find(s => s.id === selectedSede)?.name : null
  const currentCustomerName = selectedCustomer?.name || customer.name || 'Consumidor Final'

  return (
    <div className="space-y-4 lg:flex lg:h-[calc(100dvh-10rem)] lg:min-h-[540px] lg:flex-col lg:overflow-hidden">
    <div className="shrink-0">
      <SyncStatusBar />
    </div>
    <div className="grid gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_clamp(380px,28vw,420px)] lg:gap-5 xl:gap-6">
      {/* Product Selection */}
      <div className="min-w-0 space-y-4 lg:flex lg:min-h-0 lg:flex-col lg:space-y-4">{/* Search */}
        <div className="flex shrink-0 gap-2" data-tour="pos-search">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              placeholder="Buscar por nombre, SKU o código de barras... (F2)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (availableProducts.length === 1) {
                    handleAddToCart(availableProducts[0].id)
                    setSearch('')
                  } else if (availableProducts.length === 0 && search.length >= 4) {
                    handleBarcodeScan(search)
                    setSearch('')
                  }
                }
              }}
              className="pl-9 bg-card border-border h-11 lg:h-12"
            />
          </div>
          <Button
            onClick={() => setShowScanOptions(true)}
            variant="outline"
            size="lg"
            className="h-11 lg:h-12 gap-2 border-border"
            title="Escanear código de barras"
          >
            <ScanLine className="h-5 w-5" />
            <span className="hidden sm:inline">Escanear</span>
          </Button>
        </div>

        {/* Sede Filter */}
        {sedes.length > 0 && (
          <Card className="shrink-0 border-border bg-card">
            <CardContent className="p-3 sm:p-4 lg:p-3">
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <Building className="h-4 w-4" />
                  Sede:
                </span>
                <Button
                  variant={selectedSede === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedSede(null)}
                  className="h-8 shrink-0 rounded-full"
                >
                  Todas
                </Button>
                {sedes.map((sede) => {
                  const count = products.filter(p => p.sedeId === sede.id && p.category !== 'insumos' && p.stock > 0).length
                  return (
                    <Button
                      key={sede.id}
                      variant={selectedSede === sede.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedSede(sede.id)}
                      className="h-8 shrink-0 rounded-full"
                    >
                      {sede.name}
                      <Badge variant="secondary" className="ml-1.5 h-5 px-1 flex items-center justify-center text-xs">
                        {count}
                      </Badge>
                    </Button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Categories Filter */}
        <Card className="shrink-0 border-border bg-card">
            <CardContent className="p-3 sm:p-4 lg:p-3">
            <div className="flex gap-1.5 overflow-x-auto pb-1 sm:gap-2 lg:gap-3">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(null)}
                className="h-9 shrink-0 rounded-full lg:h-10"
              >
                <Package className="h-3 w-3 lg:h-4 lg:w-4 mr-1.5" />
                Todas
              </Button>
              {categories.filter(cat => cat.id !== 'insumos').map((cat) => {
                const count = products.filter(p => p.category === cat.id && p.category !== 'insumos' && p.stock > 0).length
                if (count === 0) return null
                return (
                  <Button
                    key={cat.id}
                    variant={selectedCategory === cat.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(cat.id)}
                    className="h-9 shrink-0 rounded-full lg:h-10"
                  >
                    {cat.name}
                    <Badge variant="secondary" className="ml-1.5 h-5 w-5 flex items-center justify-center p-0 text-xs">
                      {count}
                    </Badge>
                  </Button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Products Grid */}
        {availableProducts.length > 0 && (
          <Card className="min-h-0 border-border bg-card lg:flex lg:flex-1 lg:flex-col lg:overflow-hidden">
            <CardHeader className="shrink-0 pb-3">
              <CardTitle className="text-base lg:text-lg flex items-center justify-between">
                <span>
                  {selectedCategory ? getCategoryName(selectedCategory) : 'Todos los Productos'}
                </span>
                <Badge variant="secondary" className="text-sm">
                  {availableProducts.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 p-3 sm:p-6 lg:flex-1 lg:overflow-y-auto lg:p-4 xl:p-5">
              <div className="grid gap-2 sm:gap-3 lg:gap-3 xl:gap-4 grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{availableProducts.map((product) => {
                  const inCart = cart.find(item => item.product.id === product.id)
                  const stockPercentage = (product.stock / (product.stock + 10)) * 100
                  const noInsumos = product.isComposite && product.stock <= 0
                  const isFlashing = flashProductId === product.id
                  return (
                    <div
                      key={product.id}
                      onClick={() => handleAddToCart(product.id)}
                      className={`group cursor-pointer rounded-xl border-2 transition-all overflow-hidden ${
                        noInsumos
                          ? 'border-border bg-muted/30 opacity-60 cursor-not-allowed'
                          : isFlashing
                          ? 'border-green-500 bg-green-500/10 scale-[0.97] shadow-lg shadow-green-500/20'
                          : inCart
                          ? 'border-primary bg-primary/5 shadow-md'
                          : 'border-border bg-secondary/50 hover:border-primary/50 hover:bg-secondary/80'
                      }`}
                    >
                      {/* Product image */}
                      {product.imageUrl ? (
                        <div className="w-full aspect-[4/3] overflow-hidden bg-muted">
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      ) : (
                        <div className="w-full aspect-[4/3] bg-secondary/70 flex items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                      )}

                      <div className="p-2 sm:p-3">
                        {/* Top section with product name and quantity badge */}
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <p className="font-semibold text-foreground truncate text-xs sm:text-sm">
                                {product.name}
                              </p>
                              {product.isComposite && (
                                noInsumos
                                  ? <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-destructive text-destructive flex-shrink-0">Sin insumos</Badge>
                                  : <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-blue-400 text-blue-600 flex-shrink-0">Ref</Badge>
                              )}
                            </div>
                            {product.brand && (
                              <p className="text-[10px] text-muted-foreground truncate">{product.brand}</p>
                            )}
                            {product.articulo && (
                              <p className="text-[10px] text-muted-foreground/70 truncate italic">{product.articulo}</p>
                            )}
                          </div>
                          {inCart && (
                            <Badge className="bg-primary text-primary-foreground flex-shrink-0 h-6 text-sm">
                              {inCart.quantity}
                            </Badge>
                          )}
                        </div>

                        {/* Price — prominent */}
                        <div className="flex items-end justify-between mt-2 pt-2 border-t border-border">
                          <div>
                            <p className="text-base sm:text-lg lg:text-xl font-bold text-primary leading-tight">
                              {formatCOP(product.isComposite && product.bomCost ? product.bomCost : product.salePrice)}
                            </p>
                            <p className={`text-[10px] font-medium ${
                              product.stock <= 3 ? 'text-destructive' : product.stock <= 10 ? 'text-amber-600' : 'text-muted-foreground'
                            }`}>
                              {product.isComposite ? 'Ref' : `Stock: ${product.stock}`}
                            </p>
                          </div>
                          <Button
                            size="icon"
                            className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleAddToCart(product.id)
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Empty state */}
        {availableProducts.length === 0 && (
          <Card className="border-border bg-card">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
              <p className="text-muted-foreground font-medium">No se encontraron productos</p>
              <p className="text-xs text-muted-foreground mt-1">
                {search ? 'Intenta con otra búsqueda' : 'Selecciona una categoría diferente'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Cart - Hidden on mobile, shown on desktop */}
      <div className="hidden lg:block lg:col-span-1 min-w-0">
        <Card className="flex h-full flex-col overflow-hidden border-border bg-card shadow-xl shadow-black/10 ring-1 ring-border/60">
          <CardHeader className="shrink-0 border-b border-border bg-card px-4 py-2.5">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base lg:text-lg">
              <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" />
              <span className="min-w-0 truncate">Venta Actual</span>
              {cart.length > 0 && (
                <Badge variant="secondary" className="ml-auto text-xs lg:text-sm">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-0 p-0">
            {/* Cart Items */}
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2.5">
              {cart.length === 0 ? (
                <div className="py-6 sm:py-8 text-center">
                  <ShoppingCart className="h-10 w-10 sm:h-12 sm:w-12 lg:h-14 lg:w-14 mx-auto text-muted-foreground mb-2 sm:mb-3" />
                  <p className="text-xs sm:text-sm lg:text-base text-muted-foreground">
                    El carrito está vacío
                  </p>
                  <p className="text-[10px] sm:text-xs lg:text-sm text-muted-foreground mt-1">
                    Haz clic en un producto
                  </p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="rounded-md border border-border bg-background p-1.5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-1 sm:gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-tight text-foreground truncate">
                          {item.product.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.quantity} x {formatCOP(item.customAmount || item.product.salePrice)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeFromCart(item.product.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {item.product.isComposite && (() => {
                      // Precio base mínimo: el mayor entre salePrice, purchasePrice y bomCost
                      // customAmount ES SIEMPRE el precio BASE (sin IVA incluido).
                      // El IVA se suma encima al calcular el total — NO se incluye en el mínimo.
                      const basePrice = Math.max(item.product.salePrice, item.product.purchasePrice, item.product.bomCost || 0)
                      // Redondear al próximo múltiplo de 1000 para que las flechas ↑↓ caigan en números exactos
                      const stepMin = Math.ceil(Math.round(basePrice) / 1000) * 1000
                      const currentAmount = item.customAmount ? Math.round(item.customAmount) : stepMin
                      return (
                        <div className="flex flex-col gap-0.5 mt-2 rounded bg-blue-50 dark:bg-blue-950/30 px-2 py-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] sm:text-xs text-blue-600 dark:text-blue-400 font-medium whitespace-nowrap">Monto $</span>
                            <Input
                              type="number"
                              step="1000"
                              min={stepMin}
                              value={currentAmount}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value)
                                if (!isNaN(val) && val >= stepMin) {
                                  setCustomAmount(item.product.id, val)
                                } else if (e.target.value === '') {
                                  setCustomAmount(item.product.id, stepMin)
                                }
                              }}
                              onBlur={(e) => {
                                const val = parseFloat(e.target.value)
                                if (isNaN(val) || val < stepMin) {
                                  setCustomAmount(item.product.id, stepMin)
                                }
                              }}
                              onWheel={(e) => e.currentTarget.blur()}
                              className="h-7 flex-1 text-xs"
                            />
                          </div>
                          <p className="text-[10px] text-blue-500 font-medium text-right pr-1">
                            {formatCOP(currentAmount)}
                          </p>
                        </div>
                      )
                    })()}
                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 bg-transparent"
                          onClick={() => handleQuantityChange(item.product.id, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center text-sm font-semibold">
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 bg-transparent"
                          onClick={() => handleQuantityChange(item.product.id, 1)}
                          disabled={item.quantity >= item.product.stock}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <span className="min-w-0 text-right text-sm font-bold text-foreground">
                        {item.customAmount
                          ? formatCOP(item.customAmount * item.quantity)
                          : formatCOP((item.product.salePrice * item.quantity) - item.discount)
                        }
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="shrink-0 space-y-2 border-t border-border bg-card p-3 shadow-[0_-10px_20px_rgba(0,0,0,0.06)]">
                {/* Discount */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Descuento Global</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={globalDiscount || ''}
                    onChange={(e) => setGlobalDiscount(parseFloat(e.target.value) || 0)}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="h-9 border-none bg-secondary"
                  />
                </div>

                {/* IVA Toggle */}
                <div className={`flex items-center justify-between rounded-md border p-2 transition-colors ${applyIva ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/20' : 'border-border bg-secondary/30'}`}>
                  <div className="flex items-center gap-2">
                    <Receipt className={`h-4 w-4 ${applyIva ? 'text-amber-600' : 'text-muted-foreground'}`} />
                    <div>
                      <p className="text-xs font-medium">Factura Electrónica</p>
                      <p className="text-[10px] text-muted-foreground">Aplica IVA 19%</p>
                    </div>
                  </div>
                  <Button
                    variant={applyIva ? 'default' : 'outline'}
                    size="sm"
                    className={`h-7 gap-1 text-xs ${applyIva ? 'bg-amber-500 hover:bg-amber-600 border-amber-500' : ''}`}
                    onClick={() => setApplyIva(!applyIva)}
                  >
                    {applyIva ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    {applyIva ? 'Con IVA' : 'Sin IVA'}
                  </Button>
                </div>

                {/* Totals */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="pl-2 text-right text-foreground">{formatCOP(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    {applyIva ? (
                      <span className="text-amber-600 font-medium">IVA (19%)</span>
                    ) : (
                      <span className="text-muted-foreground">IVA</span>
                    )}
                    {applyIva ? (
                      <span className="pl-2 text-right text-amber-600 font-medium">{formatCOP(tax)}</span>
                    ) : (
                      <span className="text-green-600 text-xs">Sin IVA</span>
                    )}
                  </div>
                  {globalDiscount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Descuento</span>
                      <span className="pl-2 text-right text-destructive">-{formatCOP(globalDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-border pt-1.5 text-lg font-bold">
                    <span className="text-foreground">Total</span>
                    <span className="pl-2 text-right text-primary">{formatCOP(finalTotal)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-1 rounded-md border border-border bg-secondary/30 p-2 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Cliente</span>
                    <span className="truncate text-right font-medium text-foreground">{currentCustomerName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Modo</span>
                    <span className="font-medium text-foreground">Mostrador</span>
                  </div>
                  {selectedSedeName && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Sede</span>
                      <span className="truncate text-right font-medium text-foreground">{selectedSedeName}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-2" data-tour="pos-charge">
                  <Button
                    className="h-12 w-full gap-2 bg-green-600 text-base font-bold text-white shadow-lg transition-all hover:bg-green-700 hover:shadow-green-600/30"
                    onClick={handleCheckout}
                  >
                    <Zap className="h-5 w-5" />
                    COBRAR {formatCOP(finalTotal)}
                    <span className="ml-1 text-xs font-normal opacity-75">[F4]</span>
                  </Button>
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 flex-1 bg-transparent text-xs"
                      onClick={clearCart}
                    >
                      Limpiar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 flex-1 bg-transparent text-xs"
                      onClick={() => {
                        if (cart.length === 0) return
                        setIsFiadoOpen(true)
                      }}
                    >
                      Fiado
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Floating Cart Button - Mobile Only */}
      <button
        onClick={() => setIsMobileCartOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 z-50 h-16 w-16 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:scale-105 flex items-center justify-center"
      >
        <ShoppingCart className="h-7 w-7" />
        {cart.length > 0 && (
          <span className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center">
            {cart.reduce((sum, item) => sum + item.quantity, 0)}
          </span>
        )}
      </button>

      {/* Mobile Cart Dialog */}
      <Dialog open={isMobileCartOpen} onOpenChange={setIsMobileCartOpen}>
        <DialogContent className="max-w-md h-[min(90dvh,720px)] max-h-[90dvh] overflow-hidden flex flex-col gap-0 p-0">
          <DialogHeader className="shrink-0 p-4 pb-2 pr-12 border-b">
            <DialogTitle className="flex items-center gap-2 min-w-0">
              <ShoppingCart className="h-5 w-5" />
              <span className="min-w-0 truncate">Venta Actual</span>
              {cart.length > 0 && (
                <Badge variant="secondary" className="ml-auto shrink-0">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)} items
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="py-12 text-center">
                <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">El carrito está vacío</p>
                <p className="text-xs text-muted-foreground mt-1">Agrega productos tocándolos</p>
              </div>
            ) : (
              cart.map((item) => (
                <div 
                  key={item.product.id}
                  className="rounded-md border border-border bg-background p-2 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {item.product.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {item.quantity} x {formatCOP(item.customAmount || item.product.salePrice)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => removeFromCart(item.product.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1.5">
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 bg-transparent"
                        onClick={() => handleQuantityChange(item.product.id, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-sm font-semibold">
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 bg-transparent"
                        onClick={() => handleQuantityChange(item.product.id, 1)}
                        disabled={item.quantity >= item.product.stock}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <span className="min-w-0 text-right text-sm font-bold text-foreground">
                      {item.customAmount
                        ? formatCOP(item.customAmount * item.quantity)
                        : formatCOP((item.product.salePrice * item.quantity) - item.discount)
                      }
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {cart.length > 0 && (
            <div className="shrink-0 border-t p-4 space-y-3 bg-card">
              {/* IVA Toggle Mobile */}
              <div className={`flex items-center justify-between rounded-lg border p-2.5 transition-colors ${applyIva ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/20' : 'border-border bg-secondary/30'}`}>
                <div className="flex items-center gap-2">
                  <Receipt className={`h-4 w-4 ${applyIva ? 'text-amber-600' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="text-xs font-medium">Factura Electrónica</p>
                    <p className="text-[10px] text-muted-foreground">Aplica IVA 19%</p>
                  </div>
                </div>
                <Button
                  variant={applyIva ? 'default' : 'outline'}
                  size="sm"
                  className={`h-7 gap-1 text-xs ${applyIva ? 'bg-amber-500 hover:bg-amber-600 border-amber-500' : ''}`}
                  onClick={() => setApplyIva(!applyIva)}
                >
                  {applyIva ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  {applyIva ? 'Con IVA' : 'Sin IVA'}
                </Button>
              </div>

              {/* Totals */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="pl-2 text-right text-foreground">{formatCOP(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  {applyIva ? (
                    <span className="text-amber-600 font-medium">IVA (19%)</span>
                  ) : (
                    <span className="text-muted-foreground">IVA</span>
                  )}
                  {applyIva ? (
                    <span className="pl-2 text-right text-amber-600 font-medium">{formatCOP(tax)}</span>
                  ) : (
                    <span className="text-green-600 text-xs">Sin IVA</span>
                  )}
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span className="text-foreground">Total</span>
                  <span className="pl-2 text-right text-primary">{formatCOP(finalTotal)}</span>
                </div>
              </div>

              <div className="grid gap-1 rounded-md border border-border bg-secondary/30 p-2 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Cliente</span>
                  <span className="truncate text-right font-medium text-foreground">{currentCustomerName}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Modo</span>
                  <span className="font-medium text-foreground">Mostrador</span>
                </div>
                {selectedSedeName && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Sede</span>
                    <span className="truncate text-right font-medium text-foreground">{selectedSedeName}</span>
                  </div>
                )}
              </div>
              
              {/* Actions */}
              <div className="space-y-2">
                <Button
                  className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700 text-white shadow-lg gap-2"
                  onClick={() => {
                    setIsMobileCartOpen(false)
                    handleCheckout()
                  }}
                >
                  <Zap className="h-5 w-5" />
                  COBRAR {formatCOP(finalTotal)}
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      clearCart()
                      setIsMobileCartOpen(false)
                    }}
                  >
                    Limpiar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsMobileCartOpen(false)
                      setIsFiadoOpen(true)
                    }}
                  >
                    Fiado
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Checkout Dialog */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Finalizar Venta</DialogTitle>
            <DialogDescription>
              Total a cobrar: {formatCOP(finalTotal)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Payment Method */}
            <div className="space-y-2">
              <Label>Método de Pago</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={paymentMethod === 'efectivo' ? 'default' : 'outline'}
                  className="flex flex-col gap-1 h-auto py-3"
                  onClick={() => handlePaymentMethodChange('efectivo')}
                >
                  <Banknote className="h-5 w-5" />
                  <span className="text-xs">Efectivo</span>
                </Button>
                <Button
                  variant={paymentMethod === 'tarjeta' ? 'default' : 'outline'}
                  className="flex flex-col gap-1 h-auto py-3"
                  onClick={() => handlePaymentMethodChange('tarjeta')}
                >
                  <CreditCard className="h-5 w-5" />
                  <span className="text-xs">Tarjeta</span>
                </Button>
                <Button
                  variant={paymentMethod === 'transferencia' ? 'default' : 'outline'}
                  className="flex flex-col gap-1 h-auto py-3"
                  onClick={() => handlePaymentMethodChange('transferencia')}
                >
                  <Building className="h-5 w-5" />
                  <span className="text-xs">Transfer.</span>
                </Button>
                <Button
                  variant={paymentMethod === 'addi' ? 'default' : 'outline'}
                  className="flex flex-col gap-1 h-auto py-3"
                  onClick={() => handlePaymentMethodChange('addi')}
                >
                  <CreditCard className="h-5 w-5" />
                  <span className="text-xs">Addi</span>
                </Button>
                <Button
                  variant={paymentMethod === 'sistecredito' ? 'default' : 'outline'}
                  className="flex flex-col gap-1 h-auto py-3"
                  onClick={() => handlePaymentMethodChange('sistecredito')}
                >
                  <CreditCard className="h-5 w-5" />
                  <span className="text-xs">Sistecredito</span>
                </Button>
                <Button
                  variant={paymentMethod === 'mixto' ? 'default' : 'outline'}
                  className="flex flex-col gap-1 h-auto py-3"
                  onClick={() => handlePaymentMethodChange('mixto')}
                >
                  <Split className="h-5 w-5" />
                  <span className="text-xs">Mixto</span>
                </Button>
              </div>
            </div>

            {/* Mixed Payment Split UI */}
            {paymentMethod === 'mixto' && (
              <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Split className="h-4 w-4" />
                  División del pago
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Efectivo</Label>
                    <Input
                      type="number"
                      min="0"
                      step="1000"
                      placeholder="0"
                      value={mixedCashAmount}
                      onChange={(e) => setMixedCashAmount(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="text-base font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Segundo método</Label>
                    <Select value={mixedSecondMethod} onValueChange={(v) => setMixedSecondMethod(v as PaymentMethod)}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tarjeta">Tarjeta</SelectItem>
                        <SelectItem value="transferencia">Transferencia</SelectItem>
                        <SelectItem value="addi">Addi</SelectItem>
                        <SelectItem value="sistecredito">Sistecredito</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded bg-card p-2 text-center">
                    <p className="text-xs text-muted-foreground">Efectivo</p>
                    <p className="font-bold text-foreground">{formatCOP(mixedCash)}</p>
                  </div>
                  <div className="rounded bg-card p-2 text-center">
                    <p className="text-xs text-muted-foreground">{paymentLabels[mixedSecondMethod]}</p>
                    <p className="font-bold text-foreground">{formatCOP(mixedSecondAmount)}</p>
                  </div>
                </div>
                {change > 0 && (
                  <div className="rounded-lg bg-primary/10 p-2 text-center">
                    <p className="text-xs text-muted-foreground">Cambio a devolver</p>
                    <p className="text-xl font-bold text-primary">{formatCOP(change)}</p>
                  </div>
                )}
                {mixedCashAmount && mixedCash + mixedSecondAmount < finalTotal && (
                  <p className="text-xs text-destructive text-center">
                    Falta {formatCOP(finalTotal - mixedCash - mixedSecondAmount)} por cubrir
                  </p>
                )}
              </div>
            )}

            {/* Amount Paid (for cash) */}
            {paymentMethod === 'efectivo' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Monto Recibido</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setShowDenomCalc(!showDenomCalc)
                      if (!showDenomCalc) resetDenomCalc()
                    }}
                  >
                    <Calculator className="h-3.5 w-3.5" />
                    {showDenomCalc ? 'Ocultar calculadora' : 'Calculadora de billetes'}
                    {showDenomCalc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                </div>

                {/* Denomination Calculator */}
                {showDenomCalc && (
                  <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Coins className="h-3.5 w-3.5" />
                        Contar billetes y monedas
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-muted-foreground"
                        onClick={resetDenomCalc}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Limpiar
                      </Button>
                    </div>

                    {/* Billetes */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Billetes</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {DENOMINATIONS.filter(d => d.type === 'billete').map(d => {
                          const count = denomCounts[d.value] || 0
                          return (
                            <div
                              key={d.value}
                              className={`flex flex-col items-center rounded-md border p-1.5 transition-colors ${
                                count > 0 ? 'border-primary bg-primary/5' : 'border-border bg-card'
                              }`}
                            >
                              <span className="text-[10px] font-medium text-muted-foreground">{d.label}</span>
                              <div className="flex items-center gap-1 mt-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 rounded-full"
                                  onClick={() => handleDenomChange(d.value, -1)}
                                  disabled={count === 0}
                                >
                                  <Minus className="h-2.5 w-2.5" />
                                </Button>
                                <input
                                  type="number"
                                  min="0"
                                  value={count || ''}
                                  placeholder="0"
                                  onChange={(e) => handleDenomSet(d.value, parseInt(e.target.value) || 0)}
                                  className="w-8 text-center text-sm font-semibold bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 rounded-full"
                                  onClick={() => handleDenomChange(d.value, 1)}
                                >
                                  <Plus className="h-2.5 w-2.5" />
                                </Button>
                              </div>
                              {count > 0 && (
                                <span className="text-[10px] text-primary font-medium">
                                  {formatCOP(d.value * count)}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Monedas */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Monedas</p>
                      <div className="grid grid-cols-5 gap-1.5">
                        {DENOMINATIONS.filter(d => d.type === 'moneda').map(d => {
                          const count = denomCounts[d.value] || 0
                          return (
                            <div
                              key={d.value}
                              className={`flex flex-col items-center rounded-md border p-1.5 transition-colors ${
                                count > 0 ? 'border-primary bg-primary/5' : 'border-border bg-card'
                              }`}
                            >
                              <span className="text-[10px] font-medium text-muted-foreground">{d.label}</span>
                              <div className="flex items-center gap-0.5 mt-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 rounded-full"
                                  onClick={() => handleDenomChange(d.value, -1)}
                                  disabled={count === 0}
                                >
                                  <Minus className="h-2.5 w-2.5" />
                                </Button>
                                <input
                                  type="number"
                                  min="0"
                                  value={count || ''}
                                  placeholder="0"
                                  onChange={(e) => handleDenomSet(d.value, parseInt(e.target.value) || 0)}
                                  className="w-6 text-center text-xs font-semibold bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 rounded-full"
                                  onClick={() => handleDenomChange(d.value, 1)}
                                >
                                  <Plus className="h-2.5 w-2.5" />
                                </Button>
                              </div>
                              {count > 0 && (
                                <span className="text-[10px] text-primary font-medium">
                                  {formatCOP(d.value * count)}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Denomination Total */}
                    <div className="flex items-center justify-between rounded-md bg-primary/10 px-3 py-2">
                      <span className="text-sm font-medium text-foreground">Total contado:</span>
                      <span className="text-lg font-bold text-primary">{formatCOP(denomTotal)}</span>
                    </div>
                  </div>
                )}

                {/* Manual amount input */}
                <div className="space-y-1">
                  <Input
                    type="number"
                    min={finalTotal}
                    step="1000"
                    value={amountPaid}
                    onChange={(e) => {
                      setAmountPaid(e.target.value)
                      if (showDenomCalc && denomTotal > 0 && e.target.value !== denomTotal.toString()) {
                        // Allow manual override
                      }
                    }}
                    className="text-lg font-semibold"
                    placeholder="Ingrese monto recibido"
                  />
                  {amountPaid && parseFloat(amountPaid) > 0 && (
                    <p className="text-xs text-muted-foreground text-right">
                      {formatCOP(parseFloat(amountPaid))}
                    </p>
                  )}
                </div>

                {/* Quick amount buttons */}
                {!showDenomCalc && (
                  <div className="flex flex-wrap gap-1.5">
                    {[finalTotal, Math.ceil(finalTotal / 1000) * 1000, Math.ceil(finalTotal / 5000) * 5000, Math.ceil(finalTotal / 10000) * 10000, Math.ceil(finalTotal / 50000) * 50000].filter((v, i, a) => v > 0 && a.indexOf(v) === i).slice(0, 4).map((quickAmount) => (
                      <Button
                        key={quickAmount}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => setAmountPaid(quickAmount.toString())}
                      >
                        {formatCOP(quickAmount)}
                      </Button>
                    ))}
                  </div>
                )}

                {/* Change display */}
                {change > 0 && (
                  <div className="rounded-lg bg-primary/10 p-3 text-center">
                    <p className="text-sm text-muted-foreground">Cambio a devolver</p>
                    <p className="text-2xl font-bold text-primary">
                      {formatCOP(change)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Customer Info (optional, not shown for fiado) */}
            {paymentMethod !== 'fiado' && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Datos del Cliente (opcional)</Label>
                <Input
                  placeholder="Nombre"
                  value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Teléfono"
                    value={customer.phone}
                    onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                  />
                  <Input
                    placeholder="Email"
                    type="email"
                    value={customer.email}
                    onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCheckoutOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCompleteSale}
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={
                isProcessing ||
                (paymentMethod === 'efectivo' && parseFloat(amountPaid) < Math.round(finalTotal * 100) / 100) ||
                (paymentMethod === 'fiado' && !selectedCustomer) ||
                (paymentMethod === 'mixto' && (mixedCash + mixedSecondAmount) < finalTotal - 0.01)
              }
            >
              {isProcessing ? 'Procesando...' : 'Completar Venta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fiado Dialog */}
      <Dialog open={isFiadoOpen} onOpenChange={setIsFiadoOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg md:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Venta a Fiado</DialogTitle>
            <DialogDescription>
              Selecciona el cliente y confirma el fiado.
            </DialogDescription>
          </DialogHeader>
          <FiadoCheckout
            showHeader={false}
            onComplete={() => setIsFiadoOpen(false)}
            onClose={() => setIsFiadoOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Invoice Preview Dialog */}
      <Dialog open={isInvoiceOpen} onOpenChange={(open) => { if (!open) handleCloseInvoice() }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Factura de Venta
            </DialogTitle>
            <DialogDescription>
              La venta se registró correctamente. Puede imprimir la factura o cerrar esta ventana.
            </DialogDescription>
          </DialogHeader>

          {completedSale && (
            <div className="space-y-4 py-2">
              {/* Store Header */}
              <div className="text-center border-b border-border pb-4">
                {storeInfo.invoiceLogo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={storeInfo.invoiceLogo} alt="Logo" className="h-14 max-w-[160px] object-contain mx-auto mb-2" />
                )}
                <h2 className="text-xl font-bold text-foreground">{storeInfo.name}</h2>
                <p className="text-sm text-muted-foreground font-medium">NIT: {storeInfo.taxId}</p>
                <p className="text-sm text-muted-foreground">{storeInfo.address}</p>
                <p className="text-sm text-muted-foreground">Tel: {storeInfo.phone} | {storeInfo.email}</p>
              </div>

              {/* Invoice & Customer Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Factura de Venta</h3>
                  <p className="text-sm font-bold text-foreground">{completedSale.invoiceNumber}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(completedSale.createdAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(completedSale.createdAt).toLocaleTimeString('es-CO')}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Cliente</h3>
                  <p className="text-sm text-foreground">{completedSale.customerName || 'Consumidor Final'}</p>
                  {completedSale.customerPhone && (
                    <p className="text-sm text-muted-foreground">Tel: {completedSale.customerPhone}</p>
                  )}
                  {completedSale.sellerName && (
                    <p className="text-sm text-muted-foreground mt-2">
                      <span className="font-medium">Vendedor:</span> {completedSale.sellerName}
                    </p>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-secondary">
                      <th className="text-left p-2 font-medium text-muted-foreground">Producto</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">SKU</th>
                      <th className="text-center p-2 font-medium text-muted-foreground">Cant.</th>
                      <th className="text-right p-2 font-medium text-muted-foreground">P. Unit.</th>
                      <th className="text-right p-2 font-medium text-muted-foreground">Desc.</th>
                      <th className="text-right p-2 font-medium text-muted-foreground">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedSale.items.map((item, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="p-2 text-foreground">
                          <span>{item.productName}</span>
                          {item.productId && (
                            <span className="block text-[10px] text-muted-foreground">ID: {item.productId}</span>
                          )}
                        </td>
                        <td className="p-2 text-muted-foreground">{item.sku || item.productSku || '-'}</td>
                        <td className="p-2 text-center text-foreground">{item.quantity}</td>
                        <td className="p-2 text-right text-foreground">{formatCOP(item.unitPrice)}</td>
                        <td className="p-2 text-right text-muted-foreground">
                          {item.discount > 0 ? formatCOP(item.discount) : '-'}
                        </td>
                        <td className="p-2 text-right font-medium text-foreground">
                          {formatCOP(item.subtotal || item.total || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-64 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="text-foreground">{formatCOP(completedSale.subtotal)}</span>
                  </div>
                  {completedSale.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Descuento</span>
                      <span className="text-destructive">-{formatCOP(completedSale.discount)}</span>
                    </div>
                  )}
                  {completedSale.tax > 0 ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-amber-600 font-medium">IVA (19%) — Factura Electrónica</span>
                      <span className="text-amber-600 font-medium">{formatCOP(completedSale.tax)}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">IVA</span>
                      <span className="text-green-600 text-xs">Sin IVA (venta directa)</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold border-t border-border pt-2">
                    <span className="text-foreground">TOTAL</span>
                    <span className="text-primary">{formatCOP(completedSale.total)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Info */}
              <div className="rounded-lg bg-secondary/50 p-3 space-y-1">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase">Información de Pago</h3>
                <p className="text-sm text-foreground">
                  <span className="font-medium">Método:</span> {paymentLabels[completedSale.paymentMethod] || completedSale.paymentMethod}
                </p>
                {completedSale.paymentMethod === 'mixto' && mixedCash > 0 && (
                  <div className="text-sm text-foreground pl-2 border-l-2 border-primary/30 space-y-0.5">
                    <p><span className="font-medium">Efectivo:</span> {formatCOP(mixedCash)}</p>
                    <p><span className="font-medium">{paymentLabels[mixedSecondMethod]}:</span> {formatCOP(mixedSecondAmount)}</p>
                  </div>
                )}
                <p className="text-sm text-foreground">
                  <span className="font-medium">Monto Recibido:</span> {formatCOP(completedSale.amountPaid)}
                </p>
                {completedSale.change > 0 && (
                  <p className="text-sm text-foreground">
                    <span className="font-medium">Cambio:</span> {formatCOP(completedSale.change)}
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="text-center border-t border-dashed border-border pt-3 space-y-1">
                <p className="text-sm font-medium text-foreground">{storeInfo.invoiceGreeting || '¡Gracias por su compra!'}</p>
                {(storeInfo.invoicePolicy || '').split('\n').map((line, i) => (
                  <p key={i} className="text-xs text-muted-foreground">{line}</p>
                ))}
                <p className="text-xs text-muted-foreground">{storeInfo.name} - {storeInfo.phone}</p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCloseInvoice}>
              <X className="h-4 w-4 mr-2" />
              Cerrar
            </Button>
            <Button onClick={handlePrintInvoice}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir Factura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer Search Dialog for Fiado */}
      <Dialog open={isCustomerSearchOpen} onOpenChange={setIsCustomerSearchOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Seleccionar Cliente
            </DialogTitle>
            <DialogDescription>
              Busque un cliente existente o cree uno nuevo para la venta fiado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o teléfono..."
                value={customerSearchQuery}
                onChange={(e) => handleSearchCustomers(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Search Results */}
            {isSearchingCustomers ? (
              <div className="text-center py-4 text-muted-foreground">
                Buscando...
              </div>
            ) : customerSearchResults.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {customerSearchResults.map((cust) => (
                  <div
                    key={cust.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer"
                    onClick={() => handleSelectCustomer(cust)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{cust.name}</p>
                        {cust.phone && (
                          <p className="text-xs text-muted-foreground">{cust.phone}</p>
                        )}
                      </div>
                    </div>
                    {cust.balance > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        Debe: {formatCOP(cust.balance)}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : customerSearchQuery.length >= 2 ? (
              <div className="text-center py-4 text-muted-foreground">
                No se encontraron clientes
              </div>
            ) : null}

            {/* Create New Customer Button */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setIsNewCustomerFormOpen(true)}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Crear Nuevo Cliente
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Customer Form Dialog */}
      <Dialog open={isNewCustomerFormOpen} onOpenChange={setIsNewCustomerFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Nuevo Cliente
            </DialogTitle>
            <DialogDescription>
              Complete los datos del nuevo cliente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Cédula <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Número de cédula"
                value={newCustomer.cedula}
                onChange={(e) => setNewCustomer({ ...newCustomer, cedula: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Nombre <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Nombre completo"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                placeholder="Número de teléfono"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="correo@ejemplo.com"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Dirección</Label>
              <Input
                placeholder="Dirección (opcional)"
                value={newCustomer.address}
                onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewCustomerFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateCustomer} disabled={!newCustomer.cedula || !newCustomer.name}>
              Crear Cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

            {/* Scan Mode Selection Dialog */}
      <Dialog open={showScanOptions} onOpenChange={setShowScanOptions}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="w-5 h-5" />
              Seleccionar modo de escáner
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <Button
              variant="outline"
              className="h-16 flex-col gap-1 text-base"
              onClick={() => { setShowScanOptions(false); setShowScanner(true) }}
            >
              <Camera className="w-6 h-6" />
              Cámara del dispositivo
            </Button>
            <Button
              variant="outline"
              className="h-16 flex-col gap-1 text-base"
              onClick={() => { setShowScanOptions(false); setShowRemoteScanner(true) }}
            >
              <Smartphone className="w-6 h-6" />
              Escáner remoto (otro celular)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Variant Picker Dialog */}
      <Dialog open={!!variantPickProduct} onOpenChange={v => { if (!v) { setVariantPickProduct(null); setVariantPickVariants([]) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Seleccionar variante — {variantPickProduct?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {variantPickLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Cargando variantes…</p>
            ) : variantPickVariants.map((v: any) => {
              const label = [v.color, v.size].filter(Boolean).join(' / ') || v.sku
              const tiers = v.priceTiers || []
              const applicableTier = [...tiers]
                .sort((a: any, b: any) => b.minQty - a.minQty)
                .find((t: any) => t.minQty <= variantPickQty)
              const price = applicableTier?.price ?? v.priceOverride ?? variantPickProduct?.salePrice ?? 0
              return (
                <button
                  key={v.id}
                  className="w-full flex items-center justify-between p-3 border rounded-lg hover:bg-muted/60 transition-colors text-left"
                  onClick={() => handleAddVariantToCart(v)}
                >
                  <div>
                    <p className="font-medium text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground">SKU: {v.sku} · Stock: {v.stock}</p>
                    {tiers.length > 1 && (
                      <p className="text-xs text-primary mt-0.5">
                        {tiers.length} tiers de precio disponibles
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">{formatCOP(price)}</p>
                    {applicableTier && <p className="text-xs text-muted-foreground">Tier: {applicableTier.minQty}+ uds.</p>}
                  </div>
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-3 pt-2 border-t">
            <label className="text-sm font-medium">Cantidad:</label>
            <input
              type="number"
              min={1}
              value={variantPickQty}
              onChange={e => setVariantPickQty(Math.max(1, Number(e.target.value)))}
              className="w-20 border rounded px-2 py-1 text-sm"
            />
            <p className="text-xs text-muted-foreground">Afecta el tier de precio aplicado.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setVariantPickProduct(null); setVariantPickVariants([]) }}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  </div>
  )
}
