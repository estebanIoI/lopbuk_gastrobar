'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product, Sale, CartItem, StockMovement, StoreInfo, CustomerFull, CategoryItem, Sede } from './types'
import { api } from './api'

interface AppState {
  // Products
  products: Product[]
  isLoadingProducts: boolean
  fetchProducts: () => Promise<void>
  addProduct: (product: Record<string, any>) => Promise<{ success: boolean; error?: string }>
  updateProduct: (id: string, product: Partial<Product>) => Promise<{ success: boolean; error?: string }>
  deleteProduct: (id: string) => Promise<{ success: boolean; error?: string }>
  bulkImportProducts: (products: Record<string, any>[]) => Promise<{
    success: boolean
    data?: { totalCreated: number; totalFailed: number; errors: Array<{ row: number; sku: string; error: string }> }
    error?: string
  }>

  // Cart (local state)
  cart: CartItem[]
  addToCart: (product: Product, quantity?: number) => void
  removeFromCart: (productId: string) => void
  updateCartQuantity: (productId: string, quantity: number) => void
  applyItemDiscount: (productId: string, discount: number) => void
  setCustomAmount: (productId: string, amount: number) => void
  clearCart: () => void

  // Sales
  sales: Sale[]
  isLoadingSales: boolean
  fetchSales: () => Promise<void>
  addSale: (sale: {
    items: Array<{ productId: string; quantity: number; discount?: number; customAmount?: number }>
    paymentMethod: string
    amountPaid: number
    globalDiscount?: number
    customerId?: string
    customerName?: string
    customerPhone?: string
    creditDays?: number
    applyTax?: boolean
  }) => Promise<{ success: boolean; error?: string; data?: Sale }>
  cancelSale: (id: string, reason: string) => Promise<{ success: boolean; error?: string }>

  // Stock Movements
  stockMovements: StockMovement[]
  fetchStockMovements: () => Promise<void>
  addStockMovement: (movement: { productId: string; quantity: number; type: 'entrada' | 'salida' | 'ajuste'; reason: string }) => Promise<{ success: boolean; error?: string }>

  // Store Info (local state)
  storeInfo: StoreInfo
  updateStoreInfo: (info: Partial<StoreInfo>) => void

  // UI State
  activeSection: string
  setActiveSection: (section: string) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebarCollapsed: () => void

  // Customer Selection for POS
  selectedCustomer: CustomerFull | null
  setSelectedCustomer: (customer: CustomerFull | null) => void

  // Categories
  categories: CategoryItem[]
  isLoadingCategories: boolean
  fetchCategories: () => Promise<void>
  addCategory: (data: { id: string; name: string; description?: string }) => Promise<{ success: boolean; error?: string }>
  deleteCategory: (id: string) => Promise<{ success: boolean; error?: string }>

  // Camera preference
  preferredCameraDeviceId: string | null
  setPreferredCameraDeviceId: (deviceId: string | null) => void

  // Inventory navigation from notifications
  inventoryStockFilter: string | null
  inventorySearchQuery: string | null
  navigateToInventory: (stockFilter?: string, searchQuery?: string) => void
  clearInventoryFilters: () => void

  // Invoices navigation from chart
  invoicesDateFilter: string | null
  navigateToInvoices: (date: string) => void
  clearInvoicesFilter: () => void

  // Pending orders notification
  pendingOrdersCount: number
  fetchPendingOrdersCount: () => Promise<void>
  navigateToPedidos: () => void

  // Sedes (sucursales)
  sedes: Sede[]
  fetchSedes: () => Promise<void>
  addSede: (data: { name: string; address?: string }) => Promise<{ success: boolean; error?: string }>
  updateSede: (id: string, data: { name?: string; address?: string }) => Promise<{ success: boolean; error?: string }>
  deleteSede: (id: string) => Promise<{ success: boolean; error?: string }>
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial State - sin datos mock
      products: [],
      isLoadingProducts: false,
      cart: [],
      sales: [],
      isLoadingSales: false,
      stockMovements: [],
      storeInfo: {
        name: 'Lopbuk Gestion de Inventario',
        address: 'Cra 7 #45-23, Bogotá, Colombia',
        phone: '(601) 234-5678',
        taxId: '900.123.456-7',
        email: 'ventas@lopbuk.com.co',
        invoiceLogo: '',
        invoiceGreeting: '¡Gracias por su compra!',
        invoicePolicy: 'Cambios y devoluciones dentro de los 30 días con factura original.\nProducto en buen estado, sin uso y con etiquetas.',
        invoiceCopies: 1,
      },
      activeSection: 'dashboard',
      sidebarOpen: false,
      sidebarCollapsed: false,
      selectedCustomer: null,
      categories: [],
      isLoadingCategories: false,
      sedes: [],
      preferredCameraDeviceId: null,
      setPreferredCameraDeviceId: (deviceId) => set({ preferredCameraDeviceId: deviceId }),

      inventoryStockFilter: null,
      inventorySearchQuery: null,
      navigateToInventory: (stockFilter, searchQuery) => set({
        activeSection: 'inventory',
        sidebarOpen: false,
        inventoryStockFilter: stockFilter || null,
        inventorySearchQuery: searchQuery || null,
      }),
      clearInventoryFilters: () => set({ inventoryStockFilter: null, inventorySearchQuery: null }),

      invoicesDateFilter: null,
      navigateToInvoices: (date) => set({ activeSection: 'invoices', sidebarOpen: false, invoicesDateFilter: date }),
      clearInvoicesFilter: () => set({ invoicesDateFilter: null }),

      pendingOrdersCount: 0,
      fetchPendingOrdersCount: async () => {
        const result = await api.getOrderStats()
        if (result.success && result.data) {
          set({ pendingOrdersCount: Number(result.data.pending) || 0 })
        }
      },
      navigateToPedidos: () => set({ activeSection: 'pedidos', sidebarOpen: false }),

      // Products Actions
      fetchProducts: async () => {
        set({ isLoadingProducts: true })
        const result = await api.getProducts({ limit: 5000 })
        if (result.success && result.data) {
          const products = Array.isArray(result.data) ? result.data : []
          set({ products, isLoadingProducts: false })
        } else {
          set({ isLoadingProducts: false })
        }
      },

      addProduct: async (product) => {
        const result = await api.createProduct(product)
        if (result.success && result.data) {
          set(state => ({
            products: [...state.products, result.data]
          }))
          return { success: true }
        }
        return { success: false, error: result.error || 'Error al crear producto' }
      },

      bulkImportProducts: async (products) => {
        const result = await api.bulkCreateProducts(products)
        if (result.success && result.data) {
          await get().fetchProducts()
          return { success: true, data: result.data }
        }
        return { success: false, error: result.error || 'Error en la importación masiva' }
      },

      updateProduct: async (id, updates) => {
        const result = await api.updateProduct(id, updates)
        if (result.success && result.data) {
          set(state => ({
            products: state.products.map(p =>
              p.id === id ? { ...p, ...result.data } : p
            )
          }))
          return { success: true }
        }
        return { success: false, error: result.error || 'Error al actualizar producto' }
      },

      deleteProduct: async (id) => {
        const result = await api.deleteProduct(id)
        if (result.success) {
          set(state => ({
            products: state.products.filter(p => p.id !== id)
          }))
          return { success: true }
        }
        return { success: false, error: result.error || 'Error al eliminar producto' }
      },

      // Cart Actions (se mantienen locales)
      addToCart: (product, quantity = 1) => set((state) => {
        const existingItem = state.cart.find(item => item.product.id === product.id)
        if (existingItem) {
          return {
            cart: state.cart.map(item =>
              item.product.id === product.id
                ? { ...item, quantity: item.quantity + quantity }
                : item
            )
          }
        }
        // Para productos compuestos (BOM), inicializar customAmount con el precio mínimo
        // redondeado al próximo múltiplo de 1000 (precio referencia, sin IVA)
        const customAmount = product.isComposite
          ? Math.ceil(Math.max(product.salePrice, product.purchasePrice) / 1000) * 1000
          : undefined
        return { cart: [...state.cart, { product, quantity, discount: 0, customAmount }] }
      }),

      removeFromCart: (productId) => set((state) => ({
        cart: state.cart.filter(item => item.product.id !== productId)
      })),

      updateCartQuantity: (productId, quantity) => set((state) => ({
        cart: state.cart.map(item =>
          item.product.id === productId ? { ...item, quantity } : item
        )
      })),

      applyItemDiscount: (productId, discount) => set((state) => ({
        cart: state.cart.map(item =>
          item.product.id === productId ? { ...item, discount } : item
        )
      })),

      setCustomAmount: (productId, amount) => set((state) => ({
        cart: state.cart.map(item =>
          item.product.id === productId ? { ...item, customAmount: amount } : item
        )
      })),

      clearCart: () => set({ cart: [] }),

      // Sales Actions
      fetchSales: async () => {
        set({ isLoadingSales: true })
        const result = await api.getSales({ limit: 100 })
        if (result.success && result.data) {
          const sales = Array.isArray(result.data) ? result.data : []
          set({ sales, isLoadingSales: false })
        } else {
          set({ isLoadingSales: false })
        }
      },

      addSale: async (saleData) => {
        const result = await api.createSale(saleData)
        if (result.success && result.data) {
          // Actualizar ventas y productos localmente
          set(state => ({
            sales: [result.data, ...state.sales],
            cart: [],
            // Actualizar stock de productos
            products: state.products.map(product => {
              const saleItem = saleData.items.find(item => item.productId === product.id)
              if (saleItem) {
                return { ...product, stock: product.stock - saleItem.quantity }
              }
              return product
            })
          }))
          return { success: true, data: result.data }
        }
        return { success: false, error: result.error || 'Error al crear venta' }
      },

      cancelSale: async (id, reason) => {
        const result = await api.cancelSale(id, reason)
        if (result.success) {
          const sale = get().sales.find(s => s.id === id)
          if (sale) {
            set(state => ({
              sales: state.sales.map(s =>
                s.id === id ? { ...s, status: 'anulada' as const, notes: reason } : s
              ),
              // Restaurar stock
              products: state.products.map(product => {
                const saleItem = sale.items.find(item => item.productId === product.id)
                if (saleItem) {
                  return { ...product, stock: product.stock + saleItem.quantity }
                }
                return product
              })
            }))
          }
          return { success: true }
        }
        return { success: false, error: result.error || 'Error al anular venta' }
      },

      // Stock Movements Actions
      fetchStockMovements: async () => {
        const result = await api.getInventoryMovements({ limit: 100 })
        if (result.success && result.data) {
          const movements = Array.isArray(result.data) ? result.data : []
          set({ stockMovements: movements })
        }
      },

      addStockMovement: async (movement) => {
        const result = await api.adjustStock(
          movement.productId,
          movement.quantity,
          movement.type,
          movement.reason
        )
        if (result.success) {
          // Recargar productos y movimientos
          await get().fetchProducts()
          await get().fetchStockMovements()
          return { success: true }
        }
        return { success: false, error: result.error || 'Error al ajustar stock' }
      },

      // Store Info Actions (local)
      updateStoreInfo: (info) => set((state) => ({
        storeInfo: { ...state.storeInfo, ...info }
      })),

      // UI Actions
      setActiveSection: (section) => set({ activeSection: section, sidebarOpen: false }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebarCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      // Customer Selection
      setSelectedCustomer: (customer) => set({ selectedCustomer: customer }),

      // Categories Actions
      fetchCategories: async () => {
        set({ isLoadingCategories: true })
        const result = await api.getCategories()
        if (result.success && result.data) {
          const categories = Array.isArray(result.data) ? result.data : []
          set({ categories, isLoadingCategories: false })
        } else {
          set({ isLoadingCategories: false })
        }
      },

      addCategory: async (data) => {
        const result = await api.createCategory(data)
        if (result.success && result.data) {
          set(state => ({
            categories: [...state.categories, result.data]
          }))
          return { success: true }
        }
        return { success: false, error: result.error || 'Error al crear categoría' }
      },

      deleteCategory: async (id) => {
        const result = await api.deleteCategory(id)
        if (result.success) {
          set(state => ({
            categories: state.categories.filter(c => c.id !== id)
          }))
          return { success: true }
        }
        return { success: false, error: result.error || 'Error al eliminar categoría' }
      },

      // Sedes Actions
      fetchSedes: async () => {
        const result = await api.getSedes()
        if (result.success && result.data) {
          set({ sedes: Array.isArray(result.data) ? result.data : [] })
        }
      },

      addSede: async (data) => {
        const result = await api.createSede(data)
        if (result.success && result.data) {
          set(state => ({ sedes: [...state.sedes, result.data] }))
          return { success: true }
        }
        return { success: false, error: result.error || 'Error al crear sede' }
      },

      updateSede: async (id, data) => {
        const result = await api.updateSede(id, data)
        if (result.success) {
          set(state => ({
            sedes: state.sedes.map(s => s.id === id ? { ...s, ...data } : s)
          }))
          return { success: true }
        }
        return { success: false, error: result.error || 'Error al actualizar sede' }
      },

      deleteSede: async (id) => {
        const result = await api.deleteSede(id)
        if (result.success) {
          set(state => ({ sedes: state.sedes.filter(s => s.id !== id) }))
          return { success: true }
        }
        return { success: false, error: result.error || 'Error al eliminar sede' }
      }
    }),
    {
      name: 'lopbuk-storage',
      partialize: (state) => ({
        cart: state.cart,
        storeInfo: state.storeInfo,
        activeSection: state.activeSection,
        preferredCameraDeviceId: state.preferredCameraDeviceId,
        sidebarCollapsed: state.sidebarCollapsed,
      })
    }
  )
)

// Selector helpers
export const getStockStatus = (product: Product): 'suficiente' | 'bajo' | 'agotado' => {
  if (product.stock === 0) return 'agotado'
  if (product.stock <= product.reorderPoint) return 'bajo'
  return 'suficiente'
}

export const calculateCartTotals = (cart: CartItem[], applyIva = true) => {
  const subtotal = cart.reduce((sum, item) => {
    if (item.customAmount) {
      // customAmount es siempre el precio BASE (sin IVA).
      // El IVA se calcula sobre el subtotal al final, igual que cualquier producto.
      return sum + item.customAmount * item.quantity
    }
    const itemTotal = (item.product.salePrice * item.quantity) - item.discount
    return sum + itemTotal
  }, 0)
  const tax = subtotal * 0.19 // 19% IVA Colombia
  const total = subtotal + tax
  return { subtotal, tax, total }
}
