import type { DailyReportData } from './types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

class ApiService {
  // Token kept only in memory (not localStorage). The httpOnly cookie is the
  // authoritative auth credential sent automatically by the browser.
  private token: string | null = null

  setToken(token: string | null) {
    this.token = token
  }

  getToken() {
    return this.token
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ success: boolean; data?: T; error?: string; message?: string; pagination?: any }> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    }

    // Send Authorization header as fallback for clients that can't use cookies
    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`
    }

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
        credentials: 'include', // always send httpOnly cookie
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMsg = data.message || data.error || 'Error en la solicitud'
        const details = data.details

        // Force logout if account/tenant is suspended, deactivated, or login blocked
        if (response.status === 403 && (
          errorMsg.includes('suspendido') || errorMsg.includes('desactivada') || errorMsg.includes('permiso para iniciar')
        )) {
          await this.logout()
          if (typeof window !== 'undefined') {
            window.location.reload()
          }
        }

        if (details && Array.isArray(details)) {
          console.error('Validation errors:', details)
        }
        return {
          success: false,
          error: details?.length
            ? `${errorMsg}: ${details.map((d: any) => `${d.field} - ${d.message}`).join(', ')}`
            : errorMsg,
        }
      }

      return data
    } catch (error) {
      console.error('API Error:', error)
      return {
        success: false,
        error: 'Error de conexión con el servidor',
      }
    }
  }

  // Auth endpoints
  async login(email: string, password: string): Promise<{
    success: boolean; data?: { token: string; user: any };
    error?: string; attemptsLeft?: number; lockedUntil?: number;
  }> {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json()
      if (response.ok && data.success && data.data?.token) {
        this.setToken(data.data.token)
        return { success: true, data: data.data }
      }
      return {
        success: false,
        error: data.message || data.error || 'Correo o contraseña incorrectos',
        attemptsLeft: data.attemptsLeft,
        lockedUntil: data.lockedUntil,
      }
    } catch {
      return { success: false, error: 'Error de conexión con el servidor' }
    }
  }

  async googleLogin(credential: string, storeSlug?: string) {
    const result = await this.request<{ token: string; user: any }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential, storeSlug }),
    })

    if (result.success && result.data?.token) {
      this.setToken(result.data.token)
    }

    return result
  }

  async register(email: string, password: string, name: string, role: 'comerciante' | 'vendedor' = 'vendedor') {
    const result = await this.request<{ token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, role }),
    })

    if (result.success && result.data?.token) {
      this.setToken(result.data.token)
    }

    return result
  }

  async getProfile() {
    return this.request<any>('/auth/profile')
  }

  async updateProfile(updates: {
    name?: string;
    avatar?: string;
    phone?: string;
    cedula?: string;
    department?: string;
    municipality?: string;
    address?: string;
    neighborhood?: string;
    deliveryLatitude?: number;
    deliveryLongitude?: number;
  }) {
    return this.request<any>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request<any>('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    })
  }

  async getUserAddresses() {
    return this.request<any[]>('/auth/addresses')
  }

  async addUserAddress(data: {
    label: string; department: string; municipality: string; address: string;
    neighborhood?: string; deliveryLatitude?: number; deliveryLongitude?: number; isDefault?: boolean;
  }) {
    return this.request<any[]>('/auth/addresses', { method: 'POST', body: JSON.stringify(data) })
  }

  async updateUserAddress(id: string, data: {
    label?: string; department?: string; municipality?: string; address?: string;
    neighborhood?: string; deliveryLatitude?: number; deliveryLongitude?: number; isDefault?: boolean;
  }) {
    return this.request<any[]>(`/auth/addresses/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  }

  async deleteUserAddress(id: string) {
    return this.request<any[]>(`/auth/addresses/${id}`, { method: 'DELETE' })
  }

  async setDefaultUserAddress(id: string) {
    return this.request<any[]>(`/auth/addresses/${id}/default`, { method: 'PATCH' })
  }

  async logout() {
    this.setToken(null)
    // Ask backend to clear the httpOnly cookie
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      // ignore network errors on logout
    }
  }

  // Users endpoints (admin only)
  async getUsers(params?: { page?: number; limit?: number }) {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    const query = searchParams.toString()
    return this.request<{ users: any[]; pagination: any }>(`/users${query ? `?${query}` : ''}`)
  }

  async createUser(data: { email: string; password: string; name: string; role: 'comerciante' | 'vendedor' | 'repartidor' | 'cliente'; phone?: string; tenantId?: string | null; cargoId?: string | null }) {
    return this.request<any>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async deleteUser(id: string) {
    return this.request<any>(`/users/${id}`, {
      method: 'DELETE',
    })
  }

  async resetUserPassword(id: string, newPassword: string) {
    return this.request<any>(`/users/${id}/reset-password`, {
      method: 'PUT',
      body: JSON.stringify({ newPassword }),
    })
  }

  // Cargos endpoints (employee positions, merchant-managed)
  async getCargos() {
    return this.request<any[]>('/cargos')
  }

  async createCargo(data: { name: string; description?: string }) {
    return this.request<any>('/cargos', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async deleteCargo(id: string) {
    return this.request<any>(`/cargos/${id}`, {
      method: 'DELETE',
    })
  }

  // Novedades endpoints (permisos, incapacidades, vacaciones)
  async getNovedades(params?: { userId?: string; type?: string; status?: string; from?: string; to?: string }) {
    const sp = new URLSearchParams()
    if (params?.userId) sp.set('userId', params.userId)
    if (params?.type)   sp.set('type',   params.type)
    if (params?.status) sp.set('status', params.status)
    if (params?.from)   sp.set('from',   params.from)
    if (params?.to)     sp.set('to',     params.to)
    const q = sp.toString()
    return this.request<any[]>(`/novedades${q ? `?${q}` : ''}`)
  }

  async createNovedad(data: {
    userId: string;
    type: string;
    startDate: string;
    endDate: string;
    description?: string;
    attachmentUrl?: string;
  }) {
    return this.request<any>('/novedades', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateNovedadStatus(id: string, status: 'aprobado' | 'rechazado' | 'pendiente', rejectionReason?: string) {
    return this.request<any>(`/novedades/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, rejectionReason }),
    })
  }

  async deleteNovedad(id: string) {
    return this.request<any>(`/novedades/${id}`, { method: 'DELETE' })
  }

  async getVacationBalances(year?: number) {
    const q = year ? `?year=${year}` : ''
    return this.request<any[]>(`/novedades/vacaciones${q}`)
  }

  async updateVacationBalance(data: { userId: string; year: number; daysGranted: number }) {
    return this.request<any>('/novedades/vacaciones/balance', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  // Products endpoints
  async getProducts(params?: {
    page?: number
    limit?: number
    category?: string
    stockStatus?: string
    search?: string
    sedeId?: string
  }) {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.category) searchParams.set('category', params.category)
    if (params?.stockStatus) searchParams.set('stockStatus', params.stockStatus)
    if (params?.search) searchParams.set('search', params.search)
    if (params?.sedeId) searchParams.set('sedeId', params.sedeId)

    const query = searchParams.toString()
    return this.request<{ products: any[]; pagination: any }>(`/products${query ? `?${query}` : ''}`)
  }

  async exportProductsCSV(params?: {
    category?: string
    stockStatus?: string
    search?: string
    productType?: string
  }) {
    const searchParams = new URLSearchParams()
    if (params?.category) searchParams.set('category', params.category)
    if (params?.stockStatus) searchParams.set('stockStatus', params.stockStatus)
    if (params?.search) searchParams.set('search', params.search)
    if (params?.productType) searchParams.set('productType', params.productType)

    const query = searchParams.toString()
    const url = `${API_URL}/products/export/csv${query ? `?${query}` : ''}`

    const headers: Record<string, string> = {}
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`

    const response = await fetch(url, { headers })
    if (!response.ok) throw new Error('Error al exportar el inventario')
    return response.blob()
  }

  // Sedes endpoints
  async getSedes() {
    return this.request<any[]>('/sedes')
  }

  async createSede(data: { name: string; address?: string }) {
    return this.request<any>('/sedes', { method: 'POST', body: JSON.stringify(data) })
  }

  async updateSede(id: string, data: { name?: string; address?: string }) {
    return this.request<any>(`/sedes/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  }

  async deleteSede(id: string) {
    return this.request<any>(`/sedes/${id}`, { method: 'DELETE' })
  }

  async getProduct(id: string) {
    return this.request<any>(`/products/${id}`)
  }

  async createProduct(product: any) {
    return this.request<any>('/products', {
      method: 'POST',
      body: JSON.stringify(product),
    })
  }

  async updateProduct(id: string, updates: any) {
    return this.request<any>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  // ── Pasarela de pago (Wompi) — config de plataforma (superadmin) ──
  async getPaymentGateway() {
    return this.request<any>('/payments/superadmin/gateway')
  }
  async updatePaymentGateway(data: {
    environment?: 'sandbox' | 'production'
    publicKey?: string
    privateKey?: string
    integritySecret?: string
    eventsSecret?: string
    isActive?: boolean
  }) {
    return this.request<any>('/payments/superadmin/gateway', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }
  async createPaymentCheckout(data: { context: 'subscription' | 'package' | 'order'; contextId?: string; amountInCents?: number; currency?: string; redirectUrl?: string; customerEmail?: string }) {
    return this.request<any>('/payments/checkout', { method: 'POST', body: JSON.stringify(data) })
  }
  async getPaymentTransaction(reference: string) {
    return this.request<any>(`/payments/transaction/${reference}`)
  }
  async getPaymentAvailability() {
    return this.request<any>('/payments/public/availability')
  }

  async deleteProduct(id: string) {
    return this.request<any>(`/products/${id}`, {
      method: 'DELETE',
    })
  }

  async bulkDeleteProducts(ids: string[]) {
    return this.request<{ deleted: number; skipped: number }>('/products/bulk', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    })
  }

  async findProductByBarcode(barcode: string) {
    return this.request<any>(`/products/barcode/${encodeURIComponent(barcode)}`)
  }

  async getLowStockProducts() {
    return this.request<any[]>('/products/low-stock')
  }

  async getOutOfStockProducts() {
    return this.request<any[]>('/products/out-of-stock')
  }

  async bulkCreateProducts(products: Record<string, any>[]) {
    return this.request<{
      totalReceived: number
      totalCreated: number
      totalFailed: number
      errors: Array<{ row: number; sku: string; error: string }>
    }>('/products/bulk', {
      method: 'POST',
      body: JSON.stringify({ products }),
    })
  }

  // Sales endpoints
  async getSales(params?: {
    page?: number
    limit?: number
    status?: string
    paymentMethod?: string
    search?: string
  }) {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.status) searchParams.set('status', params.status)
    if (params?.paymentMethod) searchParams.set('paymentMethod', params.paymentMethod)
    if (params?.search) searchParams.set('search', params.search)

    const query = searchParams.toString()
    return this.request<{ sales: any[]; pagination: any }>(`/sales${query ? `?${query}` : ''}`)
  }

  async getSale(id: string) {
    return this.request<any>(`/sales/${id}`)
  }

  async getRecentSales() {
    return this.request<any[]>('/sales/recent')
  }

  async createSale(sale: {
    items: Array<{ productId: string; quantity: number; discount?: number; customAmount?: number }>
    paymentMethod: string
    amountPaid: number
    globalDiscount?: number
    customerId?: string
    customerName?: string
    customerPhone?: string
    customerEmail?: string
    creditDays?: number
    applyTax?: boolean
    sedeId?: string
    vehicleId?: string
    totalWeightKg?: number
  }) {
    return this.request<any>('/sales', {
      method: 'POST',
      body: JSON.stringify(sale),
    })
  }

  async cancelSale(id: string, reason: string) {
    return this.request<any>(`/sales/${id}/cancel`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    })
  }

  // ── Vendedores module ──────────────────────────────────────────────────────

  // Legacy endpoint (kept for compatibility)
  async getVendedoresPerformance(params?: { from?: string; to?: string; sellerId?: string }) {
    const q = new URLSearchParams()
    if (params?.from) q.set('from', params.from)
    if (params?.to) q.set('to', params.to)
    if (params?.sellerId) q.set('sellerId', params.sellerId)
    const query = q.toString()
    return this.request<any[]>(`/vendedores/performance${query ? `?${query}` : ''}`)
  }

  async getVendedorSales(sellerId: string, params?: { from?: string; to?: string; page?: number; limit?: number }) {
    const q = new URLSearchParams()
    if (params?.from) q.set('from', params.from)
    if (params?.to) q.set('to', params.to)
    if (params?.page) q.set('page', String(params.page))
    if (params?.limit) q.set('limit', String(params.limit))
    const query = q.toString()
    return this.request<{ data: any[]; pagination: any }>(`/sales/vendedor/${sellerId}${query ? `?${query}` : ''}`)
  }

  async getVendedoresList() {
    return this.request<any[]>('/vendedores')
  }

  async updateSellerCommission(sellerId: string, data: {
    commissionType: string; commissionValue: number;
    salaryBase: number; monthlyGoal: number; goalBonus: number;
  }) {
    return this.request<any>(`/vendedores/${sellerId}/commission`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async getPayrollAdjustments(params: { from: string; to: string; sellerId?: string }) {
    const q = new URLSearchParams({ from: params.from, to: params.to })
    if (params.sellerId) q.set('sellerId', params.sellerId)
    return this.request<any[]>(`/vendedores/adjustments?${q.toString()}`)
  }

  async addPayrollAdjustment(data: {
    sellerId: string; sellerName: string; periodFrom: string; periodTo: string;
    type: 'bono' | 'descuento'; concept: string; amount: number;
  }) {
    return this.request<any>('/vendedores/adjustments', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async deletePayrollAdjustment(id: string) {
    return this.request<any>(`/vendedores/adjustments/${id}`, { method: 'DELETE' })
  }

  async generatePayroll(data: { periodFrom: string; periodTo: string; periodLabel: string }) {
    return this.request<any[]>('/vendedores/payroll/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getPayrollHistory(params?: { page?: number; limit?: number }) {
    const q = new URLSearchParams()
    if (params?.page) q.set('page', String(params.page))
    if (params?.limit) q.set('limit', String(params.limit))
    const query = q.toString()
    return this.request<{ data: any[]; pagination: any }>(`/vendedores/payroll${query ? `?${query}` : ''}`)
  }

  async markPayrollPaid(ids: string[]) {
    return this.request<any>('/vendedores/payroll/mark-paid', {
      method: 'PUT',
      body: JSON.stringify({ ids }),
    })
  }

  async deletePayrollRecord(id: string) {
    return this.request<any>(`/vendedores/payroll/${id}`, { method: 'DELETE' })
  }

  // Inventory endpoints
  async getInventoryMovements(params?: { page?: number; limit?: number; productId?: string }) {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.productId) searchParams.set('productId', params.productId)

    const query = searchParams.toString()
    return this.request<{ movements: any[]; pagination: any }>(`/inventory/movements${query ? `?${query}` : ''}`)
  }

  async adjustStock(productId: string, quantity: number, type: 'entrada' | 'salida' | 'ajuste', reason: string) {
    return this.request<any>('/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity, type, reason }),
    })
  }

  // Dashboard endpoints
  async getDashboardMetrics() {
    return this.request<any>('/dashboard/metrics')
  }

  async getStoreInfo() {
    return this.request<{
      name: string; address: string; phone: string; taxId: string; email: string;
      invoiceLogo: string; invoiceGreeting: string; invoicePolicy: string; invoiceCopies: 1 | 2;
    }>('/dashboard/store-info')
  }

  async updateStoreInfo(data: {
    name?: string; address?: string; phone?: string; taxId?: string; email?: string;
    invoiceLogo?: string; invoiceGreeting?: string; invoicePolicy?: string; invoiceCopies?: 1 | 2;
  }) {
    return this.request<{ message: string }>('/dashboard/store-info', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async getSalesTrend(days?: number) {
    const query = days !== undefined ? `?days=${days}` : ''
    return this.request<Array<{ date: string; total: number; count: number }>>(`/dashboard/sales-trend${query}`)
  }

  async getMonthlyRevenueCosts(months = 6) {
    return this.request<Array<{ month: string; revenue: number; costs: number }>>(`/dashboard/monthly-revenue-costs?months=${months}`)
  }

  // Customers endpoints
  async getCustomers(params?: { page?: number; limit?: number; search?: string }) {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.search) searchParams.set('search', params.search)
    const query = searchParams.toString()
    return this.request<any>(`/customers${query ? `?${query}` : ''}`)
  }

  async searchCustomers(query: string) {
    return this.request<any[]>(`/customers/search?q=${encodeURIComponent(query)}`)
  }

  async getCustomer(id: string) {
    return this.request<any>(`/customers/${id}`)
  }

  async createCustomer(data: { cedula: string; name: string; phone?: string; email?: string; address?: string; creditLimit?: number; notes?: string }) {
    return this.request<any>('/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async bulkCreateCustomers(customers: Array<{ cedula: string; name: string; phone?: string; email?: string; address?: string; creditLimit?: number; notes?: string }>) {
    return this.request<{ totalCreated: number; totalSkipped?: number; errors?: any[] }>('/customers/bulk', {
      method: 'POST',
      body: JSON.stringify({ customers }),
    })
  }

  async getDailyReport(date: string) {
    return this.request<DailyReportData>(`/sales/daily-report?date=${encodeURIComponent(date)}`)
  }

  async updateCustomer(id: string, data: { cedula?: string; name?: string; phone?: string; email?: string; address?: string; creditLimit?: number; notes?: string }) {
    return this.request<any>(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteCustomer(id: string) {
    return this.request<any>(`/customers/${id}`, {
      method: 'DELETE',
    })
  }

  async getCustomerBalance(id: string) {
    return this.request<any>(`/customers/${id}/balance`)
  }

  // Credits endpoints
  async getPendingCredits(params?: { page?: number; limit?: number; customerId?: string; status?: string }) {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.customerId) searchParams.set('customerId', params.customerId)
    if (params?.status) searchParams.set('status', params.status)
    const query = searchParams.toString()
    return this.request<any>(`/credits${query ? `?${query}` : ''}`)
  }

  async getCreditDetail(saleId: string) {
    return this.request<any>(`/credits/${saleId}`)
  }

  async getCreditPayments(saleId: string) {
    return this.request<any[]>(`/credits/${saleId}/payments`)
  }

  async registerPayment(saleId: string, data: { amount: number; paymentMethod: string; notes?: string }) {
    return this.request<any>(`/credits/${saleId}/payments`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getCreditsSummary() {
    return this.request<{ totalPending: number; totalCredits: number; customersWithDebt: number }>('/credits/summary')
  }

  // Categories endpoints
  async getCategories(includeHidden = false) {
    const q = includeHidden ? '?includeHidden=true' : ''
    return this.request<any[]>(`/categories${q}`)
  }

  async createCategory(data: { id: string; name: string; description?: string; color?: string }) {
    return this.request<any>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateCategory(id: string, data: { name?: string; description?: string; color?: string; sortOrder?: number }) {
    return this.request<any>(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async toggleCategoryVisibility(id: string) {
    return this.request<any>(`/categories/${id}/visibility`, { method: 'PATCH' })
  }

  async deleteCategory(id: string) {
    return this.request<any>(`/categories/${id}`, { method: 'DELETE' })
  }

  // ── Restbar Finanzas ────────────────────────────────────────────────────────
  async getRbGastos(params: { from?: string; to?: string; quincena?: number; month?: string } = {}) {
    const q = new URLSearchParams()
    if (params.from)      q.set('from', params.from)
    if (params.to)        q.set('to', params.to)
    if (params.quincena)  q.set('quincena', String(params.quincena))
    if (params.month)     q.set('month', params.month)
    return this.request<any>(`/restbar/finanzas/gastos?${q}`)
  }

  async createRbGasto(data: { concepto: string; categoria?: string; cantidad?: number; valor_unitario: number; notas?: string }) {
    return this.request<any>('/restbar/finanzas/gastos', { method: 'POST', body: JSON.stringify(data) })
  }

  async updateRbGasto(id: string, data: any) {
    return this.request<any>(`/restbar/finanzas/gastos/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  }

  async deleteRbGasto(id: string) {
    return this.request<any>(`/restbar/finanzas/gastos/${id}`, { method: 'DELETE' })
  }

  async getRbIngresos(month?: string) {
    const q = month ? `?month=${month}` : ''
    return this.request<any[]>(`/restbar/finanzas/ingresos${q}`)
  }

  async createRbIngreso(data: { fecha: string; num_pedidos?: number; valor_ventas?: number; ganancia?: number; notas?: string }) {
    return this.request<any>('/restbar/finanzas/ingresos', { method: 'POST', body: JSON.stringify(data) })
  }

  async deleteRbIngreso(id: string) {
    return this.request<any>(`/restbar/finanzas/ingresos/${id}`, { method: 'DELETE' })
  }

  async getRbGastosFijos() {
    return this.request<any[]>('/restbar/finanzas/gastos-fijos')
  }

  async createRbGastoFijo(data: { nombre: string; valor: number; periodo?: string }) {
    return this.request<any>('/restbar/finanzas/gastos-fijos', { method: 'POST', body: JSON.stringify(data) })
  }

  async updateRbGastoFijo(id: string, data: any) {
    return this.request<any>(`/restbar/finanzas/gastos-fijos/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  }

  async deleteRbGastoFijo(id: string) {
    return this.request<any>(`/restbar/finanzas/gastos-fijos/${id}`, { method: 'DELETE' })
  }

  async getRbTimeline(month?: string) {
    const q = month ? `?month=${month}` : ''
    return this.request<any[]>(`/restbar/finanzas/timeline${q}`)
  }

  async getRbResumen(month?: string) {
    const q = month ? `?month=${month}` : ''
    return this.request<any>(`/restbar/finanzas/resumen${q}`)
  }

  // Cash Sessions endpoints
  async getActiveCashSession() {
    return this.request<any>('/cash-sessions/active')
  }

  async getCashSessions(params?: { page?: number; limit?: number; status?: string }) {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.status) searchParams.set('status', params.status)
    const query = searchParams.toString()
    return this.request<any>(`/cash-sessions${query ? `?${query}` : ''}`)
  }

  async getCashSession(id: string) {
    return this.request<any>(`/cash-sessions/${id}`)
  }

  async openCashSession(
    openingAmount: number,
    userName: string,
    opts?: { shiftType?: 'mañana' | 'tarde' | 'unico'; shiftLabel?: string | null; employees?: { userId?: string | null; name: string; role?: string | null }[] }
  ) {
    return this.request<any>('/cash-sessions/open', {
      method: 'POST',
      body: JSON.stringify({ openingAmount, userName, ...(opts || {}) }),
    })
  }

  // ── Empleados del turno ──
  async getShiftEmployees(sessionId: string) {
    return this.request<any>(`/cash-sessions/${sessionId}/employees`)
  }
  async addShiftEmployee(sessionId: string, data: { userId?: string | null; name: string; role?: string | null }) {
    return this.request<any>(`/cash-sessions/${sessionId}/employees`, { method: 'POST', body: JSON.stringify(data) })
  }
  async updateShiftEmployee(sessionId: string, empId: string, data: { role?: string | null; status?: 'activo' | 'baja'; bajaReason?: string | null }) {
    return this.request<any>(`/cash-sessions/${sessionId}/employees/${empId}`, { method: 'PUT', body: JSON.stringify(data) })
  }
  async getCashDailySummary(date?: string) {
    return this.request<any>(`/cash-sessions/daily-summary${date ? `?date=${encodeURIComponent(date)}` : ''}`)
  }

  async addCashMovement(sessionId: string, data: { type: 'entrada' | 'salida'; amount: number; reason: string; notes?: string; userName?: string }) {
    return this.request<any>(`/cash-sessions/${sessionId}/movements`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getCashMovements(sessionId: string) {
    return this.request<any>(`/cash-sessions/${sessionId}/movements`)
  }

  async getCashSessionTotals(sessionId: string) {
    return this.request<any>(`/cash-sessions/${sessionId}/totals`)
  }

  async closeCashSession(sessionId: string, data: { actualCash: number; observations?: string; userName?: string; bonuses?: { shiftEmpId: string; type: 'bono' | 'descuento'; amount: number; concept?: string | null }[] }) {
    return this.request<any>(`/cash-sessions/${sessionId}/close`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Tenants endpoints (superadmin only)
  async getTenants(params?: { page?: number; limit?: number; search?: string }) {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.search) searchParams.set('search', params.search)
    const query = searchParams.toString()
    return this.request<any>(`/tenants${query ? `?${query}` : ''}`)
  }

  async getTenant(id: string) {
    return this.request<any>(`/tenants/${id}`)
  }

  async createTenant(data: {
    name: string
    slug: string
    businessType?: string
    plan?: string
    maxUsers?: number
    maxProducts?: number
    ownerName: string
    ownerEmail: string
    ownerPassword: string
  }) {
    return this.request<any>('/tenants', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateTenant(id: string, data: { name?: string; slug?: string; businessType?: string; plan?: string; status?: string; maxUsers?: number; maxProducts?: number; bgColor?: string }) {
    return this.request<any>(`/tenants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async toggleTenantStatus(id: string) {
    return this.request<any>(`/tenants/${id}/toggle-status`, {
      method: 'PATCH',
    })
  }

  async getTenantStats() {
    return this.request<any>('/tenants/stats')
  }

  async getPlatformSettings() {
    return this.request<Record<string, string>>('/tenants/platform-settings')
  }

  async updatePlatformSetting(key: string, value: string) {
    return this.request<any>('/tenants/platform-settings', {
      method: 'PUT',
      body: JSON.stringify({ key, value }),
    })
  }

  async activateTenantTrial(id: string, days: number = 7) {
    return this.request<any>(`/tenants/${id}/activate-trial`, {
      method: 'POST',
      body: JSON.stringify({ days }),
    })
  }

  async deactivateTenantTrial(id: string, revertPlan: string = 'basico') {
    return this.request<any>(`/tenants/${id}/deactivate-trial`, {
      method: 'POST',
      body: JSON.stringify({ revertPlan }),
    })
  }

  // Borrado DEFINITIVO (irreversible) del comercio y todos sus datos
  async hardDeleteTenant(id: string) {
    return this.request<{ id: string; name: string; deletedRows: number }>(`/tenants/${id}`, {
      method: 'DELETE',
    })
  }

  async getBusinessTypes() {
    return this.request<string[]>('/tenants/business-types')
  }

  async createBusinessType(name: string) {
    return this.request<string[]>('/tenants/business-types', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
  }

  async deleteBusinessType(name: string) {
    return this.request<string[]>(`/tenants/business-types/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    })
  }

  // ── Modificadores de producto (merchant) ──
  async getProductModifiers(productId: string) {
    return this.request<any[]>(`/modifiers/product/${productId}`)
  }

  async saveProductModifiers(productId: string, groups: any[]) {
    return this.request<any[]>(`/modifiers/product/${productId}`, {
      method: 'PUT',
      body: JSON.stringify({ groups }),
    })
  }

  // ── Tarjetas del marketplace (página principal, superadmin) ──
  async getMarketplaceCards() {
    return this.request<any[]>('/tenants/marketplace-cards')
  }

  async updateMarketplaceCard(id: string, data: {
    coverUrl?: string | null
    cardDescription?: string | null
    isVerified?: boolean
    openState?: 'open' | 'closed'
    marketplaceVisible?: boolean
    marketplaceOrder?: number
  }) {
    return this.request<any>(`/tenants/${id}/marketplace-card`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  // Tarjetas externas (comercios fuera del aplicativo)
  async getExternalCards() {
    return this.request<any[]>('/tenants/external-cards')
  }
  async createExternalCard(data: {
    name: string; externalUrl: string; slug?: string | null; logoUrl?: string | null
    coverUrl?: string | null; cardDescription?: string | null; city?: string | null
    isVerified?: boolean; marketplaceVisible?: boolean; marketplaceOrder?: number
  }) {
    return this.request<{ id: string }>('/tenants/external-cards', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }
  async updateExternalCard(id: string, data: Record<string, any>) {
    return this.request<any>(`/tenants/external-cards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }
  async deleteExternalCard(id: string) {
    return this.request<any>(`/tenants/external-cards/${id}`, { method: 'DELETE' })
  }

  // =============================================
  // Storefront management endpoints (authenticated)
  // =============================================

  // ── Tema automático desde el logo (IA) ──
  async generateStoreTheme(payload: { imageBase64?: string; mimeType?: string; logoUrl?: string }) {
    return this.request<{ palette: any; provider: string }>('/storefront/theme/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }
  async getStoreThemeColors() {
    return this.request<any>('/storefront/theme/colors')
  }
  async saveStoreThemeColors(palette: any) {
    return this.request<any>('/storefront/theme/colors', { method: 'PUT', body: JSON.stringify({ palette }) })
  }
  async resetStoreTheme() {
    return this.request<any>('/storefront/theme/colors', { method: 'DELETE' })
  }

  // ── Tarjeta de presentación del comercio propio (portada, descripción, horario) ──
  async getCardConfig() {
    return this.request<{
      coverUrl: string | null
      cardDescription: string | null
      businessHours: Record<string, { open: string; close: string }[]> | null
      theme: 'theme1' | 'theme2'
    }>('/storefront/card-config')
  }

  async updateCardConfig(data: {
    coverUrl?: string | null
    cardDescription?: string | null
    businessHours?: Record<string, { open: string; close: string }[]> | null
    theme?: 'theme1' | 'theme2' | 'theme3' | 'theme4'
  }) {
    return this.request<{ message: string }>('/storefront/card-config', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  // QR de mesa: el mesero genera/rota la sesión del cliente.
  async createTableQrSession(tableId: string) {
    return this.request<{ token: string; tableNumber: string; path: string }>(`/restbar-qr/tables/${tableId}/session`, { method: 'POST' })
  }

  // QR de mesa: consultar la sesión activa (invitados + consumo de cada uno).
  async getTableQrSession(tableId: string) {
    return this.request<any>(`/restbar-qr/tables/${tableId}/session`)
  }

  // QR de mesa: cerrar/eliminar el QR activo (invalida el token).
  async closeTableQrSession(tableId: string) {
    return this.request<{ closed: number }>(`/restbar-qr/tables/${tableId}/session/close`, { method: 'POST' })
  }

  async getMyPublishedProducts() {
    return this.request<any[]>('/storefront/my-published')
  }

  async publishProduct(productId: string, published: boolean) {
    return this.request<any>(`/storefront/publish/${productId}`, {
      method: 'PUT',
      body: JSON.stringify({ published }),
    })
  }

  async bulkPublishProducts(productIds: string[], published: boolean) {
    return this.request<any>('/storefront/publish-bulk', {
      method: 'PUT',
      body: JSON.stringify({ productIds, published }),
    })
  }

  async toggleProductOffer(productId: string, data: {
    isOnOffer: boolean
    offerPrice?: number
    offerLabel?: string
    offerEnd?: string
  }) {
    return this.request<any>(`/storefront/offer/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async toggleDeliveryProduct(productId: string, deliveryType: 'domicilio' | 'envio' | 'ambos' | null) {
    return this.request<any>(`/storefront/delivery/${productId}`, {
      method: 'PUT',
      body: JSON.stringify({ deliveryType }),
    })
  }

  async toggleNewLaunch(productId: string, isNewLaunch: boolean, launchDate?: string) {
    return this.request<any>(`/storefront/new-launch/${productId}`, {
      method: 'PUT',
      body: JSON.stringify({ isNewLaunch, launchDate }),
    })
  }

  async updateProductPreorder(productId: string, data: {
    isPreorder: boolean
    preorderWindowEnd: string | null
    preorderShipStart: string | null
    preorderShipEnd: string | null
    preorderBadgeText: string
  }) {
    return this.request<any>(`/products/${productId}/preorder`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async getPublicNewLaunches(store?: string) {
    const q = store ? `?store=${encodeURIComponent(store)}` : ''
    return this.request<any[]>(`/storefront/new-launches${q}`)
  }

  // =============================================
  // Cart Settings
  // =============================================

  async updateCartSettings(data: { cartMinPurchase: number; cartDeliveryFee?: number }) {
    return this.request<any>('/storefront/cart-settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  // =============================================
  // Order Bump / Cross-sell endpoints
  // =============================================

  async getOrderBumpConfig() {
    return this.request<any>('/storefront/order-bump-config')
  }

  async updateOrderBumpConfig(data: {
    isEnabled: boolean
    mode: 'auto' | 'manual'
    title: string
    maxItems: number
    productIds: string[]
  }) {
    return this.request<any>('/storefront/order-bump-config', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async getPublicOrderBump(store: string, categories: string[], excludeIds: string[]) {
    const params = new URLSearchParams()
    params.set('store', store)
    if (categories.length > 0) params.set('categories', categories.join(','))
    if (excludeIds.length > 0) params.set('exclude', excludeIds.join(','))
    return this.request<any>(`/storefront/order-bump?${params.toString()}`)
  }

  // Store Customization endpoints
  async getStoreCustomization() {
    return this.request<any>('/storefront/customization')
  }

  async updateBanner(data: { id?: number; position: string; imageUrl: string; title?: string; subtitle?: string; linkUrl?: string }) {
    return this.request<any>('/storefront/banners', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteBanner(id: number) {
    return this.request<any>(`/storefront/banners/${id}`, {
      method: 'DELETE',
    })
  }

  async updateCategoryImage(categoryId: string, imageUrl: string) {
    return this.request<any>(`/storefront/categories/${categoryId}/image`, {
      method: 'PUT',
      body: JSON.stringify({ imageUrl }),
    })
  }

  async toggleStorefrontCategoryVisibility(categoryId: string, hidden: boolean) {
    return this.request<any>(`/storefront/categories/${categoryId}/visibility`, {
      method: 'PUT',
      body: JSON.stringify({ hidden }),
    })
  }

  async addFeaturedProduct(productId: string) {
    return this.request<any>('/storefront/featured-products', {
      method: 'POST',
      body: JSON.stringify({ productId }),
    })
  }

  async removeFeaturedProduct(productId: string) {
    return this.request<any>(`/storefront/featured-products/${productId}`, {
      method: 'DELETE',
    })
  }

  async updateStoreExtendedInfo(data: {
    logoUrl?: string; schedule?: string; locationMapUrl?: string;
    termsContent?: string; privacyContent?: string; shippingTerms?: string;
    paymentMethods?: string; socialInstagram?: string; socialFacebook?: string;
    socialTiktok?: string; socialWhatsapp?: string;
    department?: string; municipality?: string; productCardStyle?: string; productDetailStyle?: string;
    allowContraentrega?: boolean; showInfoModule?: boolean; infoModuleDescription?: string;
    metaPixelId?: string;
    contactPageEnabled?: boolean; contactPageTitle?: string; contactPageDescription?: string;
    contactPageImage?: string; contactPageProducts?: string[]; contactPageLinks?: { label: string; url: string }[];
  }) {
    return this.request<any>('/storefront/store-extended-info', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async updateContactPage(data: {
    contactPageEnabled: boolean; contactPageTitle?: string; contactPageDescription?: string;
    contactPageImage?: string; contactPageProducts?: string[]; contactPageLinks?: { label: string; url: string; image?: string }[];
    contactPageLinkTheme?: string;
    socialInstagram?: string; socialFacebook?: string; socialTiktok?: string; socialWhatsapp?: string;
    socialX?: string; socialSnapchat?: string;
  }) {
    return this.request<any>('/storefront/contact-page', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async updateAgeGate(data: { ageGateEnabled: boolean; ageGateDescription?: string }) {
    return this.request<any>('/storefront/age-gate', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  // =============================================
  // Announcement Bar endpoints
  // =============================================

  async updateAnnouncementBar(data: { text: string; linkUrl?: string; bgColor?: string; textColor?: string; isActive: boolean; scrollSpeed?: number }) {
    return this.request<any>('/storefront/announcement-bar', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  // =============================================
  // Drops endpoints
  // =============================================

  async createDrop(data: { name: string; description?: string; bannerUrl?: string; globalDiscount: number; startsAt: string; endsAt: string; isActive?: boolean }) {
    return this.request<any>('/storefront/drops', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateDrop(id: number, data: { name: string; description?: string; bannerUrl?: string; globalDiscount: number; startsAt: string; endsAt: string; isActive?: boolean }) {
    return this.request<any>(`/storefront/drops/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteDrop(id: number) {
    return this.request<any>(`/storefront/drops/${id}`, {
      method: 'DELETE',
    })
  }

  async addDropProduct(dropId: number, productId: string, customDiscount?: number | null) {
    return this.request<any>(`/storefront/drops/${dropId}/products`, {
      method: 'POST',
      body: JSON.stringify({ productId, customDiscount }),
    })
  }

  async removeDropProduct(dropId: number, productId: string) {
    return this.request<any>(`/storefront/drops/${dropId}/products/${productId}`, {
      method: 'DELETE',
    })
  }

  // =============================================
  // Custom HTML Sections endpoints
  // =============================================

  async listCustomSections() {
    return this.request<any>('/storefront/custom-sections', { method: 'GET' })
  }

  async createCustomSection(data: { name: string; htmlContent: string; isActive: boolean }) {
    return this.request<any>('/storefront/custom-sections', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateCustomSection(id: number, data: { name: string; htmlContent: string; isActive: boolean }) {
    return this.request<any>(`/storefront/custom-sections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async toggleCustomSection(id: number, isActive: boolean) {
    return this.request<any>(`/storefront/custom-sections/${id}/toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    })
  }

  async deleteCustomSection(id: number) {
    return this.request<any>(`/storefront/custom-sections/${id}`, {
      method: 'DELETE',
    })
  }

  // =============================================
  // Orders endpoints
  // =============================================

  async createPublicOrder(data: {
    customerName: string
    customerPhone: string
    customerEmail?: string
    customerCedula?: string
    department?: string
    municipality?: string
    address?: string
    neighborhood?: string
    notes?: string
    items: Array<{ productId: string; productName: string; quantity: number; unitPrice: number; productImage?: string; size?: string; color?: string }>
    tenantId?: string
    paymentMethod?: string
    shippingCost?: number
    discount?: number
  }) {
    return this.request<any>('/orders/public', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getOrders(params?: { page?: number; limit?: number; status?: string; search?: string }) {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.status) searchParams.set('status', params.status)
    if (params?.search) searchParams.set('search', params.search)
    const query = searchParams.toString()
    return this.request<any>(`/orders${query ? `?${query}` : ''}`)
  }

  async getOrder(id: string) {
    return this.request<any>(`/orders/${id}`)
  }

  async getOrderStats() {
    return this.request<any>('/orders/stats')
  }

  async updateOrderStatus(id: string, status: string) {
    return this.request<any>(`/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
  }

  // =============================================
  // Coupons endpoints
  // =============================================

  async getCoupons(params?: { page?: number; limit?: number; search?: string }) {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.search) searchParams.set('search', params.search)
    const query = searchParams.toString()
    return this.request<any>(`/coupons${query ? `?${query}` : ''}`)
  }

  async createCoupon(data: {
    code: string
    description?: string
    discountType: 'porcentaje' | 'fijo'
    discountValue: number
    minPurchase?: number
    maxUses?: number
    expiresAt?: string
  }) {
    return this.request<any>('/coupons', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateCoupon(id: string, data: {
    description?: string
    discountType?: 'porcentaje' | 'fijo'
    discountValue?: number
    minPurchase?: number | null
    maxUses?: number | null
    expiresAt?: string | null
    isActive?: boolean
  }) {
    return this.request<any>(`/coupons/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteCoupon(id: string) {
    return this.request<any>(`/coupons/${id}`, {
      method: 'DELETE',
    })
  }

  async seedDefaultCoupons() {
    return this.request<any>('/coupons/seed-defaults', {
      method: 'POST',
    })
  }

  async validateCouponPublic(code: string, subtotal: number) {
    return this.request<any>('/coupons/validate', {
      method: 'POST',
      body: JSON.stringify({ code, subtotal }),
    })
  }

  async useCouponPublic(code: string) {
    return this.request<any>('/coupons/use', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
  }

  // Recipes endpoints
  async getRecipes() {
    return this.request<any[]>('/recipes')
  }

  async getRecipe(productId: string) {
    return this.request<any>(`/recipes/${productId}`)
  }

  async saveRecipe(productId: string, ingredients: Array<{ ingredientId: string; quantity: number; includeInCost?: boolean }>) {
    return this.request<any>('/recipes', {
      method: 'POST',
      body: JSON.stringify({ productId, ingredients }),
    })
  }

  async deleteRecipe(productId: string) {
    return this.request<any>(`/recipes/${productId}`, {
      method: 'DELETE',
    })
  }

  // =============================================
  // Client Auth endpoints
  // =============================================

  async registerClient(data: { email: string; password: string; name: string; phone?: string; cedula?: string; storeSlug: string }) {
    return this.request<{ user: any; token: string }>('/auth/register-client', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // =============================================
  // Client Orders endpoints
  // =============================================

  async getClientOrders() {
    return this.request<any[]>('/client/orders')
  }

  async getClientOrderDetail(id: string) {
    return this.request<any>(`/client/orders/${id}`)
  }

  // =============================================
  // Delivery / Driver endpoints
  // =============================================

  async getDriverOrders() {
    return this.request<any[]>('/delivery/my-orders')
  }

  async getDriverHistory() {
    return this.request<any[]>('/delivery/my-history')
  }

  async getAvailableOrders() {
    return this.request<any[]>('/delivery/available')
  }

  async acceptOrder(orderId: string) {
    return this.request<any>(`/delivery/accept/${orderId}`, {
      method: 'PUT',
    })
  }

  async updateDeliveryStatus(orderId: string, deliveryStatus: string) {
    return this.request<any>(`/delivery/status/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify({ deliveryStatus }),
    })
  }

  async getDriversList() {
    return this.request<any[]>('/delivery/drivers')
  }

  async assignDriver(orderId: string, driverId: string) {
    return this.request<any>(`/delivery/assign/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify({ driverId }),
    })
  }

  // =============================================
  // Purchase Invoices endpoints (Facturas de Compra)
  // =============================================

  async getPurchaseInvoices(params?: { page?: number; limit?: number }) {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    const query = searchParams.toString()
    return this.request<any>(`/purchases${query ? `?${query}` : ''}`)
  }

  async getPurchaseInvoice(id: string) {
    return this.request<any>(`/purchases/${id}`)
  }

  async createPurchaseInvoice(data: {
    invoiceNumber: string
    supplierId?: string
    supplierName: string
    purchaseDate: string
    documentType?: string
    items: Array<{ productId: string; quantity: number; unitCost: number }>
    paymentMethod?: string
    paymentStatus?: string
    dueDate?: string
    fileUrl?: string
    discount?: number
    notes?: string
  }) {
    return this.request<any>('/purchases', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getPurchaseSuppliers() {
    return this.request<any[]>('/purchases/suppliers')
  }

  async createPurchaseSupplier(data: {
    name: string
    contactName?: string
    phone?: string
    email?: string
    city?: string
    address?: string
    taxId?: string
    paymentTerms?: string
    notes?: string
  }) {
    return this.request<any>('/purchases/suppliers', { method: 'POST', body: JSON.stringify(data) })
  }

  async getNextPurchaseInvoiceNumber() {
    return this.request<string>('/purchases/next-invoice-number')
  }

  async getPurchaseSupplierStats(supplierId: string) {
    return this.request<any>(`/purchases/suppliers/${supplierId}/stats`)
  }

  // OCR: lee una factura desde una foto usando la IA configurada
  async ocrPurchaseInvoice(payload: { imageBase64: string; mimeType?: string }) {
    return this.request<{
      header: {
        invoiceNumber: string | null
        purchaseDate: string | null
        paymentMethod: string | null
        subtotal: number | null
        discount: number | null
        total: number | null
      }
      supplier: { matchedId: string | null; name: string | null; taxId: string | null }
      items: Array<{
        description: string
        quantity: number
        unitCost: number
        total: number | null
        productId: string | null
        productName: string | null
        productSku: string | null
        lastPurchasePrice: number | null
        matched: boolean
      }>
      provider: 'gemini' | 'openai' | 'groq'
    }>('/purchases/ocr', { method: 'POST', body: JSON.stringify(payload) })
  }

  // =============================================
  // Services endpoints
  // =============================================

  // Merchant - service catalog
  async getServices() {
    return this.request<any[]>('/services')
  }
  async getService(id: string) {
    return this.request<any>(`/services/${id}`)
  }
  async createService(data: {
    name: string; serviceType: 'cita' | 'asesoria' | 'contacto'
    description?: string; category?: string; price?: number
    priceType?: string; durationMinutes?: number; imageUrl?: string
    requiresPayment?: boolean; maxAdvanceDays?: number
    cancellationHours?: number; sortOrder?: number
  }) {
    return this.request<any>('/services', { method: 'POST', body: JSON.stringify(data) })
  }
  async updateService(id: string, data: Record<string, unknown>) {
    return this.request<any>(`/services/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  }
  async deleteService(id: string) {
    return this.request<any>(`/services/${id}`, { method: 'DELETE' })
  }

  // Merchant - availability
  async getServiceAvailability(id: string) {
    return this.request<any[]>(`/services/${id}/availability`)
  }
  async setServiceAvailability(id: string, slots: Array<{
    dayOfWeek: number; startTime: string; endTime: string
    slotDurationMinutes: number; maxSimultaneous: number
  }>) {
    return this.request<any>(`/services/${id}/availability`, {
      method: 'POST', body: JSON.stringify({ slots }),
    })
  }

  // Merchant - blocked periods
  async getBlockedPeriods(serviceId?: string) {
    const q = serviceId ? `?serviceId=${serviceId}` : ''
    return this.request<any[]>(`/services/blocked${q}`)
  }
  async addBlockedPeriod(data: {
    serviceId?: string; blockedDate: string
    startTime?: string; endTime?: string; reason?: string
  }) {
    return this.request<any>('/services/blocked', { method: 'POST', body: JSON.stringify(data) })
  }
  async removeBlockedPeriod(id: string) {
    return this.request<any>(`/services/blocked/${id}`, { method: 'DELETE' })
  }

  // Merchant - bookings
  async getServiceBookings(params?: {
    serviceId?: string; status?: string; dateFrom?: string; dateTo?: string
    page?: number; limit?: number
  }) {
    const sp = new URLSearchParams()
    if (params?.serviceId) sp.set('serviceId', params.serviceId)
    if (params?.status) sp.set('status', params.status)
    if (params?.dateFrom) sp.set('dateFrom', params.dateFrom)
    if (params?.dateTo) sp.set('dateTo', params.dateTo)
    if (params?.page) sp.set('page', String(params.page))
    if (params?.limit) sp.set('limit', String(params.limit))
    const q = sp.toString()
    return this.request<any>(`/services/bookings/list${q ? `?${q}` : ''}`)
  }
  async updateBookingStatus(id: string, data: { status?: string; merchantNotes?: string }) {
    return this.request<any>(`/services/bookings/${id}`, {
      method: 'PUT', body: JSON.stringify(data),
    })
  }

  // Superadmin - sales timeline
  async getSalesTimeline(days = 30) {
    return this.request<any>(`/storefront/superadmin/sales-timeline?days=${days}`)
  }

  // Platform featured products
  async getPlatformFeatured() {
    return this.request<any[]>('/storefront/platform-featured')
  }

  async updatePlatformFeatured(productIds: number[]) {
    return this.request<any>('/storefront/platform-featured', {
      method: 'PUT',
      body: JSON.stringify({ productIds }),
    })
  }

  // Public - services & booking
  async getPublicServices(store: string) {
    return this.request<any[]>(`/services/public?store=${encodeURIComponent(store)}`)
  }
  async getPublicSlots(serviceId: string, store: string, date: string) {
    return this.request<string[]>(
      `/services/${serviceId}/slots?store=${encodeURIComponent(store)}&date=${date}`
    )
  }
  async createPublicBooking(store: string, data: {
    serviceId: string; clientName: string; clientPhone: string
    clientEmail?: string; clientNotes?: string
    bookingDate?: string; startTime?: string
    preferredDateRange?: string; projectDescription?: string; budgetRange?: string
  }) {
    return this.request<any>(`/services/bookings?store=${encodeURIComponent(store)}`, {
      method: 'POST', body: JSON.stringify(data),
    })
  }

  // =============================================
  // Chatbot & Integrations
  // =============================================

  async getChatbotStatus(slug: string) {
    return this.request<any>(`/chatbot/status/${slug}`)
  }

  async sendChatMessage(data: { slug: string; sessionToken?: string; message: string; customerName?: string }) {
    return this.request<any>('/chatbot/message', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getChatbotConfig() {
    return this.request<any>('/chatbot/config')
  }

  async updateChatbotConfig(data: {
    botName?: string; botAvatarUrl?: string; systemPrompt?: string;
    businessInfo?: string; faqs?: string; tone?: string;
    notifyEmail?: boolean; notifyWhatsapp?: boolean; accentColor?: string;
  }) {
    return this.request<any>('/chatbot/config', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async getNotifications() {
    return this.request<any>('/chatbot/notifications')
  }

  async markNotificationsRead() {
    return this.request<any>('/chatbot/notifications/read', { method: 'PUT' })
  }

  async getSuperadminIntegrations() {
    return this.request<any>('/chatbot/superadmin/integrations')
  }

  async revealIntegrationKey(provider: 'gemini' | 'openai' | 'groq') {
    return this.request<{ key: string }>(`/chatbot/superadmin/integrations/reveal/${provider}`)
  }

  async updateSuperadminIntegrations(data: {
    cloudinaryCloudName?: string;
    cloudinaryUploadPreset?: string;
    geminiApiKey?: string;
    openaiApiKey?: string;
    groqApiKey?: string;
    defaultAiProvider?: string;
    openaiBaseUrl?: string;
    openaiModel?: string;
  }) {
    return this.request<any>('/chatbot/superadmin/integrations', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async getSuperadminChatbotTenants() {
    return this.request<any[]>('/chatbot/superadmin/tenants')
  }

  async toggleChatbotForTenant(tenantId: string, enabled: boolean) {
    return this.request<any>(`/chatbot/superadmin/tenant/${tenantId}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    })
  }

  // ─── WhatsApp ─────────────────────────────────────────────────────────────────

  async getWhatsAppStatus() {
    return this.request<any>('/whatsapp/status')
  }

  async connectWhatsApp(data: { whatsappNumber?: string }) {
    return this.request<any>('/whatsapp/connect', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async disconnectWhatsApp() {
    return this.request<any>('/whatsapp/disconnect', { method: 'DELETE' })
  }

  async getWhatsAppQR() {
    return this.request<any>('/whatsapp/qr')
  }

  // ─── Printers ─────────────────────────────────────────────────────────────────

  async getPrinters() {
    return this.request<any[]>('/printers')
  }

  async getPrinter(id: string) {
    return this.request<any>(`/printers/${id}`)
  }

  async createPrinter(data: {
    name: string
    connectionType: 'lan' | 'usb' | 'bluetooth'
    ip?: string
    port?: number
    paperWidth?: 58 | 80
    assignedModule?: 'caja' | 'cocina' | 'bar' | 'factura' | null
  }) {
    return this.request<any>('/printers', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updatePrinter(id: string, data: {
    name?: string
    connectionType?: 'lan' | 'usb' | 'bluetooth'
    ip?: string
    port?: number
    paperWidth?: 58 | 80
    isActive?: boolean
    assignedModule?: 'caja' | 'cocina' | 'bar' | 'factura' | null
  }) {
    return this.request<any>(`/printers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deletePrinter(id: string) {
    return this.request<any>(`/printers/${id}`, { method: 'DELETE' })
  }

  async testPrinter(id: string) {
    return this.request<any>(`/printers/${id}/test`, { method: 'POST' })
  }

  async printTicket(printerId: string, ticket: {
    storeName: string
    invoiceNumber: string
    items: Array<{ name: string; quantity: number; price: number }>
    subtotal: number
    tax: number
    total: number
    paymentMethod: string
    amountPaid: number
    change: number
    notes?: string
    footerText?: string
  }) {
    return this.request<any>(`/printers/${printerId}/print-ticket`, {
      method: 'POST',
      body: JSON.stringify({ ticket }),
    })
  }

  async printTicketByModule(module: 'caja' | 'cocina' | 'bar' | 'factura', ticket: {
    storeName: string
    invoiceNumber: string
    items: Array<{ name: string; quantity: number; price: number }>
    subtotal: number
    tax: number
    total: number
    paymentMethod: string
    amountPaid: number
    change: number
    notes?: string
    footerText?: string
  }) {
    return this.request<any>(`/printers/module/${module}/print-ticket`, {
      method: 'POST',
      body: JSON.stringify({ ticket }),
    })
  }
  // Reviews endpoints
  async toggleEmployeeLogin(userId: string, canLogin: boolean) {
    return this.request<any>(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ canLogin }),
    })
  }

  async getReviews(params?: { productId?: string; status?: string }) {
    const q = new URLSearchParams()
    if (params?.productId) q.set('productId', params.productId)
    if (params?.status) q.set('status', params.status)
    const qs = q.toString()
    return this.request<any[]>(`/reviews${qs ? `?${qs}` : ''}`)
  }

  async getPublicReviews(tenantId: string, productId: string) {
    return this.request<any[]>(`/reviews/public/${tenantId}/${productId}`)
  }

  async createReview(data: {
    tenantId: string
    productId: string
    reviewerName: string
    reviewerEmail?: string
    rating: number
    title?: string
    body?: string
    imageUrl1?: string
    imageUrl2?: string
  }) {
    return this.request<any>('/reviews', { method: 'POST', body: JSON.stringify(data) })
  }

  async updateReview(id: string, data: {
    reviewerName?: string
    reviewerEmail?: string
    rating?: number
    title?: string
    body?: string
    imageUrl1?: string | null
    imageUrl2?: string | null
  }) {
    return this.request<any>(`/reviews/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  }

  async updateReviewStatus(id: string, status: 'pendiente' | 'aprobado' | 'rechazado', reply?: string) {
    return this.request<any>(`/reviews/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, reply }),
    })
  }

  async deleteReview(id: string) {
    return this.request<any>(`/reviews/${id}`, { method: 'DELETE' })
  }

  // ─── MercadoPago Suscripciones ────────────────────────────────────────────────

  async getSubscriptionConfig() {
    return this.request<{ configured: boolean; planIds: Record<string, string | null>; prices: Record<string, string | null> }>('/subscriptions/config')
  }

  async createMPSubscription(plan: 'basico' | 'profesional' | 'empresarial') {
    return this.request<{ url: string }>('/subscriptions/subscribe', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    })
  }

  async syncMPPlans() {
    return this.request<Record<string, string>>('/subscriptions/sync-plans', { method: 'POST' })
  }

  async savePlanPrices(prices: { basico?: string; profesional?: string; empresarial?: string }) {
    const tasks: Promise<any>[] = []
    if (prices.basico !== undefined)      tasks.push(this.updatePlatformSetting('plan_price_basico', prices.basico))
    if (prices.profesional !== undefined) tasks.push(this.updatePlatformSetting('plan_price_profesional', prices.profesional))
    if (prices.empresarial !== undefined) tasks.push(this.updatePlatformSetting('plan_price_empresarial', prices.empresarial))
    await Promise.all(tasks)
    return { success: true }
  }

  // ── restBar module ──────────────────────────────────────────────────────────

  async getRestbarTables() {
    return this.request<any[]>('/restbar/tables')
  }
  async createRestbarTable(data: { number: string; capacity?: number; area?: string; notes?: string }) {
    return this.request<any>('/restbar/tables', { method: 'POST', body: JSON.stringify(data) })
  }
  async updateRestbarTable(id: string, data: { number?: string; capacity?: number; area?: string; notes?: string; isActive?: boolean }) {
    return this.request<any>(`/restbar/tables/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  }
  async updateRestbarTableStatus(id: string, status: string) {
    return this.request<any>(`/restbar/tables/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
  }
  async deleteRestbarTable(id: string) {
    return this.request<any>(`/restbar/tables/${id}`, { method: 'DELETE' })
  }
  async getRestbarMenu() {
    return this.request<any[]>('/restbar/menu')
  }
  async getMenuCatalog() {
    return this.request<any[]>('/restbar/menu/catalog')
  }
  async updateMenuItemSettings(id: string, data: { isMenuItem: boolean; preparationArea?: string | null; prepTimeMinutes?: number | null }) {
    return this.request<any>(`/restbar/menu/${id}/settings`, { method: 'PATCH', body: JSON.stringify(data) })
  }
  async toggleMenuItemAvailability(id: string) {
    return this.request<any>(`/restbar/menu/${id}/availability`, { method: 'PATCH' })
  }
  async getMenuItemYield(id: string) {
    return this.request<any>(`/restbar/menu/${id}/yield`)
  }
  async getRestbarOrders(status?: string) {
    const q = status ? `?status=${status}` : ''
    return this.request<any[]>(`/restbar/orders${q}`)
  }
  async getRestbarOrder(id: string) {
    return this.request<any>(`/restbar/orders/${id}`)
  }
  async createRestbarOrder(data: { tableId: string; guestsCount?: number; notes?: string }) {
    return this.request<any>('/restbar/orders', { method: 'POST', body: JSON.stringify(data) })
  }
  async addRestbarOrderItem(orderId: string, data: { menuItemId: string; quantity: number; itemNotes?: string; guestNumber?: number }) {
    return this.request<any>(`/restbar/orders/${orderId}/items`, { method: 'POST', body: JSON.stringify(data) })
  }
  async updateRestbarOrderItem(orderId: string, itemId: string, data: { quantity?: number; itemNotes?: string; guestNumber?: number | null }) {
    return this.request<any>(`/restbar/orders/${orderId}/items/${itemId}`, { method: 'PUT', body: JSON.stringify(data) })
  }
  async removeRestbarOrderItem(orderId: string, itemId: string) {
    return this.request<any>(`/restbar/orders/${orderId}/items/${itemId}`, { method: 'DELETE' })
  }
  async sendRestbarOrderToKitchen(orderId: string) {
    return this.request<any>(`/restbar/orders/${orderId}/send`, { method: 'POST' })
  }
  async getKitchenDisplay() {
    return this.request<any[]>('/restbar/kitchen')
  }
  async getBarDisplay() {
    return this.request<any[]>('/restbar/bar')
  }
  async updateRestbarItemStatus(itemId: string, status: string) {
    return this.request<any>(`/restbar/items/${itemId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
  }
  async setRestbarOrderPriority(orderId: string, priority: 'normal' | 'urgente') {
    return this.request<any>(`/restbar/orders/${orderId}/priority`, { method: 'PATCH', body: JSON.stringify({ priority }) })
  }
  async getJukeboxQueue() {
    return this.request<{ queue: any[] }>(`/restbar-qr/jukebox`)
  }
  async updateJukeboxStatus(id: string, status: 'queued' | 'playing' | 'played' | 'skipped') {
    return this.request<any>(`/restbar-qr/jukebox/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
  }
  // ── Fidelización (Fase 3) ───────────────────────────────────────────────
  async getLoyaltyConfig() {
    return this.request<{ enabled: boolean; pointsPerThousand: number }>(`/loyalty/config`)
  }
  async updateLoyaltyConfig(data: { enabled: boolean; pointsPerThousand: number }) {
    return this.request<any>(`/loyalty/config`, { method: 'PUT', body: JSON.stringify(data) })
  }
  async getLoyaltyRewards() {
    return this.request<{ rewards: any[] }>(`/loyalty/rewards`)
  }
  async createLoyaltyReward(data: { name: string; description?: string; pointsCost: number }) {
    return this.request<any>(`/loyalty/rewards`, { method: 'POST', body: JSON.stringify(data) })
  }
  async updateLoyaltyReward(id: string, data: any) {
    return this.request<any>(`/loyalty/rewards/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
  }
  async deleteLoyaltyReward(id: string) {
    return this.request<any>(`/loyalty/rewards/${id}`, { method: 'DELETE' })
  }
  async getLoyaltyAccounts(search = '') {
    return this.request<{ accounts: any[] }>(`/loyalty/accounts?search=${encodeURIComponent(search)}`)
  }
  async loyaltyEarn(data: { phone: string; name?: string; amount: number }) {
    return this.request<any>(`/loyalty/earn`, { method: 'POST', body: JSON.stringify(data) })
  }
  async loyaltyAdjust(accountId: string, points: number, reason?: string) {
    return this.request<any>(`/loyalty/accounts/${accountId}/adjust`, { method: 'POST', body: JSON.stringify({ points, reason }) })
  }

  // ── Reportes de restaurante (Fase 4) ────────────────────────────────────
  async getRestbarReports(from: string, to: string) {
    return this.request<any>(`/restbar/reports/summary?from=${from}&to=${to}`)
  }

  // ── Modo Chat Daimuz (slice Restbar) ────────────────────────────────────
  async daimuzChatRestbar(message: string, history: { role: string; content: string }[]) {
    return this.request<{ reply: string; pendingAction: { tool: string; args: any; label: string } | null }>(
      `/daimuz-chat/restbar`, { method: 'POST', body: JSON.stringify({ message, history }) })
  }
  async daimuzChatExecute(tool: string, args: any) {
    return this.request<{ message: string; refresh?: string }>(
      `/daimuz-chat/restbar/execute`, { method: 'POST', body: JSON.stringify({ tool, args }) })
  }
  async getDaimuzOverview() {
    return this.request<any>(`/daimuz-chat/overview`)
  }
  // ── Respaldo / restauración (Fase 4 · approval-gated) ───────────────────
  async exportRestbarBackup() {
    return this.request<any>(`/restbar/backup/export`)
  }
  async previewRestbarRestore(backup: any) {
    return this.request<any>(`/restbar/backup/restore/preview`, { method: 'POST', body: JSON.stringify({ backup }) })
  }
  async restoreRestbarBackup(backup: any, confirm: string) {
    return this.request<any>(`/restbar/backup/restore`, { method: 'POST', body: JSON.stringify({ backup, confirm }) })
  }
  async updateRestbarOrderNotes(orderId: string, notes: string | null) {
    return this.request<any>(`/restbar/orders/${orderId}/notes`, { method: 'PATCH', body: JSON.stringify({ notes }) })
  }
  async cancelRestbarOrder(orderId: string) {
    return this.request<any>(`/restbar/orders/${orderId}`, { method: 'DELETE' })
  }
  async getRestbarGuestBreakdown(orderId: string) {
    return this.request<any>(`/restbar/orders/${orderId}/guests`)
  }
  async processRestbarPayment(orderId: string, data: { paymentMethod: string; amountPaid: number; guestNumber?: number | null; cashSessionId?: string; notes?: string }) {
    return this.request<any>(`/restbar/orders/${orderId}/pay`, { method: 'POST', body: JSON.stringify(data) })
  }
  async getRestbarEmployeePerformance(params?: { from?: string; to?: string }) {
    const q = new URLSearchParams()
    if (params?.from) q.set('from', params.from)
    if (params?.to)   q.set('to',   params.to)
    const query = q.toString()
    return this.request<any[]>(`/vendedores/restbar-performance${query ? `?${query}` : ''}`)
  }
  async getRestbarDailySummary(date?: string) {
    const q = date ? `?date=${date}` : ''
    return this.request<any>(`/restbar/reports/summary${q}`)
  }

  async getRestbarAnalytics(from?: string, to?: string) {
    const p = new URLSearchParams()
    if (from) p.set('from', from)
    if (to)   p.set('to', to)
    const q = p.toString()
    return this.request<any>(`/restbar/reports/analytics${q ? `?${q}` : ''}`)
  }

  async getRestbarPayments(date?: string) {
    const q = date ? `?date=${date}` : ''
    return this.request<any[]>(`/restbar/reports/payments${q}`)
  }

  async getPublicMenuSettings() {
    return this.request<{ enabled: boolean; slug: string }>('/restbar/settings/public-menu')
  }

  async setPublicMenuEnabled(enabled: boolean) {
    return this.request<{ enabled: boolean; slug: string }>('/restbar/settings/public-menu', {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    })
  }

  async getRestbarPendingReservationsCount() {
    return this.request<number>('/restbar/reservations/pending-count')
  }

  async getRestbarReservations(params?: { date?: string; status?: string; page?: number }) {
    const q = new URLSearchParams()
    if (params?.date) q.set('date', params.date)
    if (params?.status) q.set('status', params.status)
    if (params?.page) q.set('page', String(params.page))
    const qs = q.toString()
    return this.request<any>(`/restbar/reservations${qs ? `?${qs}` : ''}`)
  }

  async getRestbarReservationSettings() {
    return this.request<any>('/restbar/reservations/settings')
  }

  async updateRestbarReservationSettings(data: Record<string, any>) {
    return this.request<any>('/restbar/reservations/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async confirmRestbarReservation(id: string, tableId?: string) {
    return this.request<any>(`/restbar/reservations/${id}/confirm`, {
      method: 'PATCH',
      body: JSON.stringify({ tableId }),
    })
  }

  async cancelRestbarReservation(id: string, reason: string) {
    return this.request<any>(`/restbar/reservations/${id}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    })
  }

  async completeRestbarReservation(id: string) {
    return this.request<any>(`/restbar/reservations/${id}/complete`, { method: 'PATCH' })
  }

  async noShowRestbarReservation(id: string) {
    return this.request<any>(`/restbar/reservations/${id}/noshow`, { method: 'PATCH' })
  }

  async markRestbarReservationWhatsappNotified(id: string) {
    return this.request<any>(`/restbar/reservations/${id}/whatsapp-notified`, { method: 'PATCH' })
  }

  // ── Finances module ─────────────────────────────────────────────────────────

  async getFinanceCategories(type?: 'ingreso' | 'egreso') {
    const q = type ? `?type=${type}` : ''
    return this.request<any[]>(`/finances/categories${q}`)
  }
  async seedFinanceCategories() {
    return this.request<any>('/finances/categories/seed', { method: 'POST' })
  }
  async createFinanceCategory(data: { type: 'ingreso' | 'egreso'; name: string; icon?: string; color?: string }) {
    return this.request<any>('/finances/categories', { method: 'POST', body: JSON.stringify(data) })
  }
  async updateFinanceCategory(id: string, data: { name?: string; icon?: string; color?: string }) {
    return this.request<any>(`/finances/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  }
  async deleteFinanceCategory(id: string) {
    return this.request<any>(`/finances/categories/${id}`, { method: 'DELETE' })
  }
  async getFinanceTransactions(params?: { type?: string; categoryId?: string; from?: string; to?: string; page?: number; limit?: number }) {
    const q = new URLSearchParams()
    if (params?.type)       q.set('type', params.type)
    if (params?.categoryId) q.set('categoryId', params.categoryId)
    if (params?.from)       q.set('from', params.from)
    if (params?.to)         q.set('to', params.to)
    if (params?.page)       q.set('page', String(params.page))
    if (params?.limit)      q.set('limit', String(params.limit))
    const query = q.toString()
    return this.request<any>(`/finances/transactions${query ? `?${query}` : ''}`)
  }
  async createFinanceTransaction(data: { type: string; categoryId: string; description: string; amount: number; transactionDate: string; paymentMethod?: string; receiptNumber?: string; isRecurring?: boolean; notes?: string }) {
    return this.request<any>('/finances/transactions', { method: 'POST', body: JSON.stringify(data) })
  }
  async updateFinanceTransaction(id: string, data: any) {
    return this.request<any>(`/finances/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  }
  async deleteFinanceTransaction(id: string) {
    return this.request<any>(`/finances/transactions/${id}`, { method: 'DELETE' })
  }
  async getFinanceSummary(year?: number, month?: number) {
    const q = new URLSearchParams()
    if (year)  q.set('year',  String(year))
    if (month) q.set('month', String(month))
    const query = q.toString()
    return this.request<any>(`/finances/summary${query ? `?${query}` : ''}`)
  }
  async getFinanceCashflow(from?: string, to?: string) {
    const q = new URLSearchParams()
    if (from) q.set('from', from)
    if (to)   q.set('to', to)
    const query = q.toString()
    return this.request<any[]>(`/finances/reports/cashflow${query ? `?${query}` : ''}`)
  }
  async getFinanceBudgets(year?: number, month?: number) {
    const q = new URLSearchParams()
    if (year)  q.set('year',  String(year))
    if (month) q.set('month', String(month))
    const query = q.toString()
    return this.request<any[]>(`/finances/budgets${query ? `?${query}` : ''}`)
  }
  async upsertFinanceBudget(data: { categoryId: string; year: number; month: number; budgetedAmount: number; notes?: string }) {
    return this.request<any>('/finances/budgets', { method: 'POST', body: JSON.stringify(data) })
  }
  async deleteFinanceBudget(id: string) {
    return this.request<any>(`/finances/budgets/${id}`, { method: 'DELETE' })
  }

  // ── Portfolio DAIMUZ ──────────────────────────────────────────────────────
  async getPortfolioPublic() {
    return this.request<any>('/portfolio/public')
  }

  async getPortfolioConfig() {
    return this.request<any>('/portfolio/config')
  }

  async updatePortfolioConfig(data: {
    heroTitle?: string
    heroSubtitle?: string
    heroImageUrl?: string
    brandDescription?: string
    showPricing?: boolean
    showFeaturedStores?: boolean
    featuredTenantIds?: string[]
    contactEmail?: string
    contactWhatsapp?: string
    contactInstagram?: string
    accentColor?: string
    isPublished?: boolean
    robotSplineUrl?: string
    lanyardOffsetX?: number
    lanyardOffsetY?: number
    lanyardScale?: number
  }) {
    return this.request<any>('/portfolio/config', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  // ── Portfolio Team Cards ──
  async getPortfolioTeamAll() {
    return this.request<any[]>('/portfolio/team/all')
  }
  async createPortfolioTeamCard(data: {
    name: string; role?: string; bio?: string; photoUrl?: string
    accentColor?: string; sortOrder?: number; isActive?: boolean
    githubUrl?: string; linkedinUrl?: string
  }) {
    return this.request<any>('/portfolio/team', { method: 'POST', body: JSON.stringify(data) })
  }
  async updatePortfolioTeamCard(id: number, data: {
    name: string; role?: string; bio?: string; photoUrl?: string
    accentColor?: string; sortOrder?: number; isActive?: boolean
    githubUrl?: string; linkedinUrl?: string
  }) {
    return this.request<any>(`/portfolio/team/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  }
  async deletePortfolioTeamCard(id: number) {
    return this.request<any>(`/portfolio/team/${id}`, { method: 'DELETE' })
  }

  // ── Portfolio Feature Cards ──
  async getPortfolioFeaturesAll() {
    return this.request<any[]>('/portfolio/features/all')
  }
  async createPortfolioFeature(data: { icon: string; title: string; description?: string; sortOrder?: number; isActive?: boolean }) {
    return this.request<any>('/portfolio/features', { method: 'POST', body: JSON.stringify(data) })
  }
  async updatePortfolioFeature(id: number, data: { icon: string; title: string; description?: string; sortOrder?: number; isActive?: boolean }) {
    return this.request<any>(`/portfolio/features/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  }
  async deletePortfolioFeature(id: number) {
    return this.request<any>(`/portfolio/features/${id}`, { method: 'DELETE' })
  }

  // ── Portfolio Service Catalog ──
  async getPortfolioServicesAll() {
    return this.request<any[]>('/portfolio/services/all')
  }
  async createPortfolioServiceCategory(data: { icon: string; label: string; type: string; sortOrder?: number; isActive?: boolean }) {
    return this.request<any>('/portfolio/services/categories', { method: 'POST', body: JSON.stringify(data) })
  }
  async updatePortfolioServiceCategory(id: number, data: { icon: string; label: string; type: string; sortOrder?: number; isActive?: boolean }) {
    return this.request<any>(`/portfolio/services/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  }
  async deletePortfolioServiceCategory(id: number) {
    return this.request<any>(`/portfolio/services/categories/${id}`, { method: 'DELETE' })
  }
  async createPortfolioServiceOption(data: { categoryId: number; title: string; description?: string; savings?: string; price: number; isPopular?: boolean; sortOrder?: number; isActive?: boolean }) {
    return this.request<any>('/portfolio/services/options', { method: 'POST', body: JSON.stringify(data) })
  }
  async updatePortfolioServiceOption(id: number, data: { title: string; description?: string; savings?: string; price: number; isPopular?: boolean; sortOrder?: number; isActive?: boolean }) {
    return this.request<any>(`/portfolio/services/options/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  }
  async deletePortfolioServiceOption(id: number) {
    return this.request<any>(`/portfolio/services/options/${id}`, { method: 'DELETE' })
  }

  async createPortfolioCheckout(items: { title: string; quantity?: number; unit_price: number }[], backUrl?: string) {
    return this.request<{ init_point: string; sandbox_init_point?: string }>('/portfolio/checkout', {
      method: 'POST',
      body: JSON.stringify({ items, backUrl }),
    })
  }

  // ── Dev Requests (Solicitudes de desarrollo) ──────────────────────────────

  async getMyDevRequests(params?: { status?: string; type?: string }) {
    const q = new URLSearchParams()
    if (params?.status) q.set('status', params.status)
    if (params?.type)   q.set('type', params.type)
    const query = q.toString()
    return this.request<any[]>(`/dev-requests${query ? `?${query}` : ''}`)
  }

  async getDevContactInfo() {
    return this.request<{ whatsapp: string }>('/dev-requests/contact-info')
  }

  async createDevRequest(data: { title: string; description: string; type: string; priority: string }) {
    return this.request<any>('/dev-requests', { method: 'POST', body: JSON.stringify(data) })
  }

  async deleteDevRequest(id: string) {
    return this.request<any>(`/dev-requests/${id}`, { method: 'DELETE' })
  }

  async confirmDevRequestQuote(id: string) {
    return this.request<any>(`/dev-requests/${id}/confirm`, { method: 'PATCH' })
  }

  async getAllDevRequests(params?: { status?: string; type?: string; tenantId?: string }) {
    const q = new URLSearchParams()
    if (params?.status)   q.set('status', params.status)
    if (params?.type)     q.set('type', params.type)
    if (params?.tenantId) q.set('tenantId', params.tenantId)
    const query = q.toString()
    return this.request<any[]>(`/dev-requests/admin/all${query ? `?${query}` : ''}`)
  }

  async quoteDevRequest(id: string, data: { estimatedHours: number; pricePerHour: number; adminNotes?: string }) {
    return this.request<any>(`/dev-requests/admin/${id}/quote`, { method: 'PATCH', body: JSON.stringify(data) })
  }

  async updateDevRequestStatus(id: string, data: { status: string; adminNotes?: string; rejectionReason?: string }) {
    return this.request<any>(`/dev-requests/admin/${id}/status`, { method: 'PATCH', body: JSON.stringify(data) })
  }

  async getDevSettings() {
    return this.request<{ hourlyRate: number; whatsapp: string }>('/dev-requests/admin/settings')
  }

  async updateDevSettings(data: { hourlyRate?: number; whatsapp?: string }) {
    return this.request<any>('/dev-requests/admin/settings', { method: 'PUT', body: JSON.stringify(data) })
  }

  async createDevRequestCheckout(id: string) {
    const backUrl = typeof window !== 'undefined' ? window.location.href : ''
    return this.request<{ initPoint: string; sandboxInitPoint?: string }>(`/dev-requests/${id}/checkout`, {
      method: 'POST',
      body: JSON.stringify({ backUrl }),
    })
  }
  // =============================================
  // Fleet endpoints (Módulo Flota / Ferretería)
  // =============================================

  async getFleetVehicles(status?: string) {
    const q = status ? `?status=${status}` : '';
    return this.request<any[]>(`/fleet/vehicles${q}`);
  }

  async getFleetVehicle(id: string) {
    return this.request<any>(`/fleet/vehicles/${id}`);
  }

  async createFleetVehicle(data: {
    name: string; type: 'planta' | 'ligera' | 'moto'; maxWeightKg: number;
    plate?: string; year?: number; brand?: string; model?: string; notes?: string;
  }) {
    return this.request<any>('/fleet/vehicles', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateFleetVehicle(id: string, data: Partial<{
    name: string; type: string; maxWeightKg: number; plate: string;
    status: string; year: number; brand: string; model: string; notes: string;
  }>) {
    return this.request<any>(`/fleet/vehicles/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteFleetVehicle(id: string) {
    return this.request<any>(`/fleet/vehicles/${id}`, { method: 'DELETE' });
  }

  async getFleetMaintenance(params?: { vehicleId?: string; status?: string }) {
    const q = new URLSearchParams(params as any).toString();
    return this.request<any[]>(`/fleet/maintenance${q ? `?${q}` : ''}`);
  }

  async createFleetMaintenance(data: {
    vehicleId: string; type: string; description: string;
    scheduledDate?: string; cost?: number; notes?: string;
  }) {
    return this.request<any>('/fleet/maintenance', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateFleetMaintenance(id: string, data: Partial<{
    status: string; completedDate: string; cost: number; notes: string;
    description: string; scheduledDate: string; type: string;
  }>) {
    return this.request<any>(`/fleet/maintenance/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async getFleetMetrics() {
    return this.request<any>('/fleet/metrics');
  }

  async getPendingDispatch(dispatchStatus?: string) {
    const q = dispatchStatus ? `?dispatchStatus=${dispatchStatus}` : '';
    return this.request<any[]>(`/fleet/pending-dispatch${q}`);
  }

  async assignVehicle(orderId: string, vehicleId?: string, driverId?: string) {
    return this.request<any>('/fleet/assign-vehicle', {
      method: 'POST',
      body: JSON.stringify({ orderId, vehicleId, driverId }),
    });
  }

  async updateDispatchStatus(orderId: string, dispatchStatus: string, dispatchNotes?: string) {
    return this.request<any>(`/fleet/dispatch-status/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify({ dispatchStatus, dispatchNotes }),
    });
  }

  async getActiveRoutes() {
    return this.request<any[]>('/fleet/active-routes');
  }

  async calculateOrderWeight(items: Array<{ productId: string; quantity: number }>) {
    return this.request<{ totalWeightKg: number; recommendedVehicleType: string }>(
      '/fleet/calculate-weight',
      { method: 'POST', body: JSON.stringify({ items }) }
    );
  }

  // ── Menu likes ──────────────────────────────────────────────────────────────
  async likeMenuProduct(productId: number, tenantSlug: string, deviceId: string) {
    return this.request<{ likes: number }>('/restbar/public-menu-like', {
      method: 'POST',
      body: JSON.stringify({ productId, tenantSlug, deviceId }),
    })
  }

  async getMenuLikesStats() {
    return this.request<Array<{ id: number; name: string; category: string; imageUrl: string | null; likes: number }>>(
      '/restbar/likes-stats'
    )
  }

  // ── Real Estate ─────────────────────────────────────────────────────────────

  async getREStats() {
    return this.request<any>('/realestate/stats')
  }

  // Properties
  async getREProperties(filters?: Record<string, any>) {
    const q = filters ? '?' + new URLSearchParams(filters as any).toString() : ''
    return this.request<any[]>(`/realestate/properties${q}`)
  }
  async getREPropertyById(id: string) {
    return this.request<any>(`/realestate/properties/${id}`)
  }
  async createREProperty(data: any) {
    return this.request<any>('/realestate/properties', { method: 'POST', body: JSON.stringify(data) })
  }
  async updateREProperty(id: string, data: any) {
    return this.request<any>(`/realestate/properties/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  }
  async deleteREProperty(id: string) {
    return this.request<any>(`/realestate/properties/${id}`, { method: 'DELETE' })
  }
  async addREMedia(propertyId: string, data: { media_type: string; url: string; caption?: string; is_cover?: boolean }) {
    return this.request<any>(`/realestate/properties/${propertyId}/media`, { method: 'POST', body: JSON.stringify(data) })
  }
  async deleteREMedia(propertyId: string, mediaId: number) {
    return this.request<any>(`/realestate/properties/${propertyId}/media/${mediaId}`, { method: 'DELETE' })
  }

  // Owners
  async getREOwners() {
    return this.request<any[]>('/realestate/owners')
  }
  async createREOwner(data: any) {
    return this.request<any>('/realestate/owners', { method: 'POST', body: JSON.stringify(data) })
  }
  async updateREOwner(id: string, data: any) {
    return this.request<any>(`/realestate/owners/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  }
  async deleteREOwner(id: string) {
    return this.request<any>(`/realestate/owners/${id}`, { method: 'DELETE' })
  }

  // Clients
  async getREClients(filters?: Record<string, any>) {
    const q = filters ? '?' + new URLSearchParams(filters as any).toString() : ''
    return this.request<any[]>(`/realestate/clients${q}`)
  }
  async createREClient(data: any) {
    return this.request<any>('/realestate/clients', { method: 'POST', body: JSON.stringify(data) })
  }
  async updateREClient(id: string, data: any) {
    return this.request<any>(`/realestate/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  }
  async deleteREClient(id: string) {
    return this.request<any>(`/realestate/clients/${id}`, { method: 'DELETE' })
  }

  // Leads
  async getRELeads(filters?: Record<string, any>) {
    const q = filters ? '?' + new URLSearchParams(filters as any).toString() : ''
    return this.request<any[]>(`/realestate/leads${q}`)
  }
  async getRELeadById(id: string) {
    return this.request<any>(`/realestate/leads/${id}`)
  }
  async createRELead(data: any) {
    return this.request<any>('/realestate/leads', { method: 'POST', body: JSON.stringify(data) })
  }
  async updateRELead(id: string, data: any) {
    return this.request<any>(`/realestate/leads/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  }
  async deleteRELead(id: string) {
    return this.request<any>(`/realestate/leads/${id}`, { method: 'DELETE' })
  }
  async addRELeadActivity(leadId: string, data: { activity_type: string; description: string }) {
    return this.request<any>(`/realestate/leads/${leadId}/activities`, { method: 'POST', body: JSON.stringify(data) })
  }

  // Visits
  async getREVisits(filters?: Record<string, any>) {
    const q = filters ? '?' + new URLSearchParams(filters as any).toString() : ''
    return this.request<any[]>(`/realestate/visits${q}`)
  }
  async createREVisit(data: any) {
    return this.request<any>('/realestate/visits', { method: 'POST', body: JSON.stringify(data) })
  }
  async updateREVisitStatus(id: string, status: string, extra?: any) {
    return this.request<any>(`/realestate/visits/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, ...extra }) })
  }

  // Contracts
  async getREContracts(filters?: Record<string, any>) {
    const q = filters ? '?' + new URLSearchParams(filters as any).toString() : ''
    return this.request<any[]>(`/realestate/contracts${q}`)
  }
  async createREContract(data: any) {
    return this.request<any>('/realestate/contracts', { method: 'POST', body: JSON.stringify(data) })
  }
  async updateREContractStatus(id: string, status: string) {
    return this.request<any>(`/realestate/contracts/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
  }

  // Rent payments
  async getREContractPayments(contractId: string) {
    return this.request<any[]>(`/realestate/contracts/${contractId}/payments`)
  }
  async createRERentPayment(contractId: string, data: any) {
    return this.request<any>(`/realestate/contracts/${contractId}/payments`, { method: 'POST', body: JSON.stringify(data) })
  }
  async markRERentPaymentPaid(paymentId: number, data: { paid_amount: number; payment_method: string; receipt_url?: string }) {
    return this.request<any>(`/realestate/rent-payments/${paymentId}/paid`, { method: 'PATCH', body: JSON.stringify(data) })
  }

  // Maintenances
  async getREMaintenances(filters?: Record<string, any>) {
    const q = filters ? '?' + new URLSearchParams(filters as any).toString() : ''
    return this.request<any[]>(`/realestate/maintenances${q}`)
  }
  async createREMaintenance(data: any) {
    return this.request<any>('/realestate/maintenances', { method: 'POST', body: JSON.stringify(data) })
  }
  async updateREMaintenanceStatus(id: string, status: string, extra?: any) {
    return this.request<any>(`/realestate/maintenances/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, ...extra }) })
  }

  // Public portal
  async getPublicREProperties(slug: string, filters?: Record<string, any>) {
    const q = filters ? '?' + new URLSearchParams(filters as any).toString() : ''
    return this.request<any>(`/realestate/public/${slug}/properties${q}`)
  }
  async getPublicREPropertyDetail(slug: string, id: string) {
    return this.request<any>(`/realestate/public/${slug}/properties/${id}`)
  }
  async registerRELead(slug: string, data: { full_name: string; phone: string; email?: string; property_id?: string; interested_in?: string; source?: string }) {
    return this.request<any>(`/realestate/public/${slug}/leads`, { method: 'POST', body: JSON.stringify(data) })
  }

  // ── Work Orders (Tapicería) ───────────────────────────────────────────────
  async getWOStats() {
    return this.request<any>('/workorders/stats')
  }
  async getWorkOrders(filters?: Record<string, string>) {
    const q = filters ? '?' + new URLSearchParams(filters).toString() : ''
    return this.request<any[]>(`/workorders${q}`)
  }
  async getWorkOrderById(id: string) {
    return this.request<any>(`/workorders/${id}`)
  }
  async createWorkOrder(data: any) {
    return this.request<any>('/workorders', { method: 'POST', body: JSON.stringify(data) })
  }
  async updateWorkOrder(id: string, data: any) {
    return this.request<any>(`/workorders/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  }
  async updateWOStatus(id: string, status: string) {
    return this.request<any>(`/workorders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
  }
  async deleteWorkOrder(id: string) {
    return this.request<any>(`/workorders/${id}`, { method: 'DELETE' })
  }
  async addWOMaterial(id: string, data: any) {
    return this.request<any>(`/workorders/${id}/materials`, { method: 'POST', body: JSON.stringify(data) })
  }
  async removeWOMaterial(id: string, materialId: number) {
    return this.request<any>(`/workorders/${id}/materials/${materialId}`, { method: 'DELETE' })
  }
  async addWOPayment(id: string, data: { amount: number; payment_method?: string; notes?: string }) {
    return this.request<any>(`/workorders/${id}/payments`, { method: 'POST', body: JSON.stringify(data) })
  }

  // ── Tenant Modules (Superadmin) ─────────────────────────────────────────
  async getTenantModules(tenantId: string) {
    return this.request<{ enabledModules: string[]; businessType: string | null }>(`/tenants/${tenantId}/modules`)
  }
  async updateTenantModules(tenantId: string, modules: string[]) {
    return this.request<{ enabledModules: string[] }>(`/tenants/${tenantId}/modules`, {
      method: 'PUT',
      body: JSON.stringify({ modules }),
    })
  }

  // ── Merma (Waste Tracking) ───────────────────────────────────────────────
  async getMermaDashboard(dateFrom?: string, dateTo?: string) {
    const q = new URLSearchParams()
    if (dateFrom) q.set('dateFrom', dateFrom)
    if (dateTo) q.set('dateTo', dateTo)
    return this.request<any>(`/merma/dashboard?${q}`)
  }
  async listWasteRecords(filters?: Record<string, string>) {
    const q = filters ? '?' + new URLSearchParams(filters).toString() : ''
    return this.request<any>(`/merma${q}`)
  }
  async createWasteRecord(data: any) {
    return this.request<any>('/merma', { method: 'POST', body: JSON.stringify(data) })
  }
  async deleteWasteRecord(id: string) {
    return this.request<any>(`/merma/${id}`, { method: 'DELETE' })
  }
  async listParLevels() {
    return this.request<any>('/merma/par/levels')
  }
  async upsertParLevel(data: any) {
    return this.request<any>('/merma/par/levels', { method: 'POST', body: JSON.stringify(data) })
  }
  async deleteParLevel(id: string) {
    return this.request<any>(`/merma/par/levels/${id}`, { method: 'DELETE' })
  }

  // ── Gastrobar Ops (Modo Dueño) ───────────────────────────────────────────
  async getModoDueno(date?: string) {
    const q = date ? `?date=${date}` : ''
    return this.request<any>(`/gastrobar-ops/modo-dueno${q}`)
  }
  async getFoodCost() {
    return this.request<any>('/gastrobar-ops/food-cost')
  }
  async getPurchaseSuggestions() {
    return this.request<any>('/gastrobar-ops/purchase-suggestions')
  }
  async getWeeklyTrend() {
    return this.request<any>('/gastrobar-ops/weekly-trend')
  }

  // ── Módulo CONSUMIDOR (rutina / estilo de vida) ──
  async getRutinaResumen() { return this.request<any>('/rutina/resumen') }

  async getRutinaPerfil() { return this.request<any>('/rutina/perfil') }
  async saveRutinaPerfil(data: any) { return this.request<any>('/rutina/perfil', { method: 'PUT', body: JSON.stringify(data) }) }

  async getDespensa() { return this.request<any[]>('/rutina/despensa') }
  async addDespensa(data: any) { return this.request<any>('/rutina/despensa', { method: 'POST', body: JSON.stringify(data) }) }
  async updateDespensa(id: string, data: any) { return this.request<any>(`/rutina/despensa/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
  async deleteDespensa(id: string) { return this.request<any>(`/rutina/despensa/${id}`, { method: 'DELETE' }) }

  async getRutinaRecetas() { return this.request<any[]>('/rutina/recetas') }
  async getRecetasQuePuedoHacer() { return this.request<any[]>('/rutina/recetas/puedo-hacer') }
  async getRutinaReceta(id: string) { return this.request<any>(`/rutina/recetas/${id}`) }
  async createRutinaReceta(data: any) { return this.request<any>('/rutina/recetas', { method: 'POST', body: JSON.stringify(data) }) }
  async deleteRutinaReceta(id: string) { return this.request<any>(`/rutina/recetas/${id}`, { method: 'DELETE' }) }
  async recetaALista(id: string) { return this.request<any>(`/rutina/recetas/${id}/a-lista-compras`, { method: 'POST' }) }

  async getRutinas() { return this.request<any[]>('/rutina/rutinas') }
  async createRutina(data: any) { return this.request<any>('/rutina/rutinas', { method: 'POST', body: JSON.stringify(data) }) }
  async deleteRutina(id: string) { return this.request<any>(`/rutina/rutinas/${id}`, { method: 'DELETE' }) }
  async addActividad(rutinaId: string, data: any) { return this.request<any>(`/rutina/rutinas/${rutinaId}/actividades`, { method: 'POST', body: JSON.stringify(data) }) }
  async deleteActividad(id: string) { return this.request<any>(`/rutina/actividades/${id}`, { method: 'DELETE' }) }

  async getPlanComidas(from?: string, to?: string) {
    const q = new URLSearchParams()
    if (from) q.set('from', from); if (to) q.set('to', to)
    const s = q.toString()
    return this.request<any[]>(`/rutina/plan-comidas${s ? `?${s}` : ''}`)
  }
  async addPlanComida(data: any) { return this.request<any>('/rutina/plan-comidas', { method: 'POST', body: JSON.stringify(data) }) }
  async togglePlanComida(id: string) { return this.request<any>(`/rutina/plan-comidas/${id}/toggle`, { method: 'PATCH' }) }
  async deletePlanComida(id: string) { return this.request<any>(`/rutina/plan-comidas/${id}`, { method: 'DELETE' }) }

  async getListaCompras() { return this.request<any[]>('/rutina/lista-compras') }
  async addListaCompra(data: any) { return this.request<any>('/rutina/lista-compras', { method: 'POST', body: JSON.stringify(data) }) }
  async toggleListaCompra(id: string) { return this.request<any>(`/rutina/lista-compras/${id}/toggle`, { method: 'PATCH' }) }
  async deleteListaCompra(id: string) { return this.request<any>(`/rutina/lista-compras/${id}`, { method: 'DELETE' }) }

  // ── Módulo GIMNASIO — miembro (cliente) ──
  async getMisMembresias() { return this.request<any[]>('/gym/me/membresias') }
  async getMiPlanGym() { return this.request<any[]>('/gym/me/plan') }
  async getMiProgresoGym() { return this.request<any[]>('/gym/me/progreso') }
  async getMiAsistenciaGym() { return this.request<any>('/gym/me/asistencia') }
  async miGymCheckIn(tenantId: string) { return this.request<any>('/gym/me/checkin', { method: 'POST', body: JSON.stringify({ tenantId }) }) }
  async miGymCheckOut() { return this.request<any>('/gym/me/checkout', { method: 'POST' }) }
  async getMiAccesoGym() { return this.request<any>('/gym/me/acceso') }
  async gymScan(code: string) { return this.request<any>('/gym/scan', { method: 'POST', body: JSON.stringify({ code }) }) }
  // Cumplimiento de rutina semanal (consumidor)
  async getActividadesLog(from: string, to: string) { return this.request<any[]>(`/rutina/actividades-log?from=${from}&to=${to}`) }
  async toggleActividadLog(id: string, date: string) { return this.request<any>(`/rutina/actividades/${id}/toggle-log`, { method: 'POST', body: JSON.stringify({ date }) }) }
  // Asistente IA del usuario
  async getPlatformAssistant() { return this.request<any>('/chatbot/platform-assistant') }
  async assistantSend(message: string, history: any[]) { return this.request<any>('/rutina/assistant', { method: 'POST', body: JSON.stringify({ message, history }) }) }
  // Superadmin: activar/desactivar asistente de plataforma
  async setPlatformAssistant(enabled: boolean) { return this.request<any>('/chatbot/superadmin/platform-assistant', { method: 'PUT', body: JSON.stringify({ enabled }) }) }
  // Asistente personal de plataforma (comerciante / superadmin)
  async platformAssistantSend(message: string, history: any[]) { return this.request<any>('/assistant', { method: 'POST', body: JSON.stringify({ message, history }) }) }

  // ── Tema 2 del Panel del Comerciante ──
  // Configuración global pública (incluye panel_theme). La lee cualquier rol.
  async getPublicPlatformSettings() { return this.request<Record<string, string>>('/storefront/platform-settings') }

  // Asistente del panel (guía + IA). Reutiliza el asistente de plataforma (/assistant)
  // para el texto; la guía se dispara desde las reglas locales del PanelAssistant.
  async sendAssistantMessage(messages: { role: string; content: string }[]): Promise<{ success: boolean; data?: { reply: string; action: { tourKey: string; stepId: string; section: string } | null } }> {
    const last = messages[messages.length - 1]?.content || ''
    const history = messages.slice(0, -1)
    try {
      const r = await this.platformAssistantSend(last, history)
      const d: any = r?.data
      const reply: string = d?.reply ?? d?.message ?? (typeof d === 'string' ? d : '')
      if (r?.success && reply) return { success: true, data: { reply, action: null } }
    } catch { /* cae a reglas locales */ }
    return { success: false }
  }

  // ── Módulo GIMNASIO — staff ──
  async getGymStats() { return this.request<any>('/gym/stats') }
  async getGymMembers(status?: string) { return this.request<any[]>(`/gym/members${status ? `?status=${status}` : ''}`) }
  async addGymMember(data: any) { return this.request<any>('/gym/members', { method: 'POST', body: JSON.stringify(data) }) }
  async getGymMember(userId: string) { return this.request<any>(`/gym/members/${userId}`) }
  async updateGymMembership(userId: string, data: any) { return this.request<any>(`/gym/members/${userId}/membership`, { method: 'PUT', body: JSON.stringify(data) }) }
  async gymRegistrarPago(userId: string) { return this.request<any>(`/gym/members/${userId}/pago`, { method: 'POST' }) }
  async removeGymMember(userId: string) { return this.request<any>(`/gym/members/${userId}`, { method: 'DELETE' }) }
  async getGymMemberPlans(userId: string) { return this.request<any[]>(`/gym/members/${userId}/plans`) }
  async createGymPlan(userId: string, data: any) { return this.request<any>(`/gym/members/${userId}/plans`, { method: 'POST', body: JSON.stringify(data) }) }
  async getGymPlan(planId: string) { return this.request<any>(`/gym/plans/${planId}`) }
  async deleteGymPlan(planId: string) { return this.request<any>(`/gym/plans/${planId}`, { method: 'DELETE' }) }
  async getGymMemberProgress(userId: string) { return this.request<any[]>(`/gym/members/${userId}/progress`) }
  async getGymMemberAttendance(userId: string) { return this.request<any[]>(`/gym/members/${userId}/asistencia`) }
  async addGymProgress(userId: string, data: any) { return this.request<any>(`/gym/members/${userId}/progress`, { method: 'POST', body: JSON.stringify(data) }) }
  async getGymTodayAttendance() { return this.request<any[]>('/gym/asistencia/hoy') }
  async gymCheckIn(userId: string) { return this.request<any>(`/gym/members/${userId}/checkin`, { method: 'POST' }) }
  async gymCheckOut(asistenciaId: string) { return this.request<any>(`/gym/asistencia/${asistenciaId}/checkout`, { method: 'PATCH' }) }

  // ── Variantes ──────────────────────────────────────────────────────────────
  async getVariantsByProduct(productId: string) { return this.request<any[]>(`/products/${productId}/variants`) }
  async getVariant(id: string) { return this.request<any>(`/variants/${id}`) }
  async createVariant(productId: string, data: any) { return this.request<any>(`/products/${productId}/variants`, { method: 'POST', body: JSON.stringify(data) }) }
  async updateVariant(id: string, data: any) { return this.request<any>(`/variants/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
  async deleteVariant(id: string) { return this.request<any>(`/variants/${id}`, { method: 'DELETE' }) }
  async adjustVariantStock(id: string, data: { quantity: number; type: string; reason: string }) {
    return this.request<any>(`/variants/${id}/stock`, { method: 'PATCH', body: JSON.stringify(data) })
  }
  async getVariantMovements(id: string) { return this.request<any[]>(`/variants/${id}/movements`) }
  async getVariantTiers(variantId: string) { return this.request<any[]>(`/variants/${variantId}/price-tiers`) }
  async createVariantTier(variantId: string, data: { minQty: number; price: number; tenantMarginPct?: number }) {
    return this.request<any>(`/variants/${variantId}/price-tiers`, { method: 'POST', body: JSON.stringify(data) })
  }
  async updateVariantTier(tierId: string, data: any) { return this.request<any>(`/price-tiers/${tierId}`, { method: 'PUT', body: JSON.stringify(data) }) }
  async deleteVariantTier(tierId: string) { return this.request<any>(`/price-tiers/${tierId}`, { method: 'DELETE' }) }
  async resolveVariantPrice(variantId: string, qty: number) {
    return this.request<any>(`/variants/${variantId}/resolve-price`, { method: 'POST', body: JSON.stringify({ qty }) })
  }
  async importVariantsCsv(csvText: string) {
    return this.request<any>('/variants/import', { method: 'POST', body: JSON.stringify({ csv: csvText }) })
  }
  getVariantImportTemplateUrl() { return `${API_URL}/variants/import/template` }

  // ── Proveedores ────────────────────────────────────────────────────────────
  async getSuppliers() { return this.request<any[]>('/suppliers') }
  async getSupplier(id: string) { return this.request<any>(`/suppliers/${id}`) }
  async createSupplier(data: any) { return this.request<any>('/suppliers', { method: 'POST', body: JSON.stringify(data) }) }
  async updateSupplier(id: string, data: any) { return this.request<any>(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
  async deleteSupplier(id: string) { return this.request<any>(`/suppliers/${id}`, { method: 'DELETE' }) }

  // ─── Superadmin — Gestión de tenants ──────────────────────────────────────

  async getAllTenants(params?: { search?: string; page?: number; limit?: number }) {
    const q = new URLSearchParams()
    if (params?.search) q.set('search', params.search)
    q.set('page',  String(params?.page  ?? 1))
    q.set('limit', String(params?.limit ?? 200))
    return this.request<any>(`/tenants?${q.toString()}`)
  }

  async softDeleteTenant(id: string) {
    return this.request<any>(`/tenants/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'cancelado' }),
    })
  }

  async restoreTenant(id: string) {
    return this.request<any>(`/tenants/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'activo' }),
    })
  }

  // ─── Superadmin — Centro de Pedidos ───────────────────────────────────────

  async getSuperadminOrders(params?: {
    tenant_id?: string
    status?: string
    assigned?: 'me' | 'unassigned'
    search?: string
    date_from?: string
    date_to?: string
    page?: number
    limit?: number
  }) {
    const q = new URLSearchParams()
    if (params?.tenant_id)  q.set('tenant_id',  params.tenant_id)
    if (params?.status)     q.set('status',     params.status)
    if (params?.assigned)   q.set('assigned',   params.assigned)
    if (params?.search)     q.set('search',     params.search)
    if (params?.date_from)  q.set('date_from',  params.date_from)
    if (params?.date_to)    q.set('date_to',    params.date_to)
    if (params?.page)       q.set('page',       String(params.page))
    if (params?.limit)      q.set('limit',      String(params.limit))
    const qs = q.toString()
    return this.request<any>(`/superadmin/orders${qs ? `?${qs}` : ''}`)
  }

  async getSuperadminOrdersSummary() {
    return this.request<any>('/superadmin/orders/summary')
  }

  async getSuperadminOrderItems(orderId: string) {
    return this.request<any>(`/superadmin/orders/${orderId}/items`)
  }

  async patchSuperadminOrderStatus(orderId: string, status: string, note?: string) {
    return this.request<any>(`/superadmin/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note }),
    })
  }

  async patchSuperadminOrderAssign(orderId: string, unassign = false) {
    return this.request<any>(`/superadmin/orders/${orderId}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ unassign }),
    })
  }

  async patchSuperadminOrderAssignTo(orderId: string, assigneeId: string) {
    return this.request<any>(`/superadmin/orders/${orderId}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ assigneeId }),
    })
  }

  async getSuperadminOrderDrivers(orderId: string) {
    return this.request<{ id: string; name: string; email: string; phone: string }[]>(
      `/superadmin/orders/${orderId}/drivers`
    )
  }

  async getSuperadminTenantsList() {
    return this.request<{ id: string; name: string }[]>('/superadmin/orders/tenants')
  }

  async getPlatformAnalytics(days = 30) {
    return this.request<any>(`/superadmin/analytics?days=${days}`)
  }

  async getOrdersHeatmap(days = 30) {
    return this.request<any>(`/superadmin/analytics/heatmap?days=${days}`)
  }

  /** Returns the base URL for constructing SSE endpoints */
  getSseUrl(path: string): string {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
    return `${base}${path}`
  }
}

export const api = new ApiService()
