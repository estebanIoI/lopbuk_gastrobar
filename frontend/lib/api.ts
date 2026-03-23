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

  async deleteProduct(id: string) {
    return this.request<any>(`/products/${id}`, {
      method: 'DELETE',
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
  async getCategories() {
    return this.request<any[]>('/categories')
  }

  async createCategory(data: { id: string; name: string; description?: string }) {
    return this.request<any>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async deleteCategory(id: string) {
    return this.request<any>(`/categories/${id}`, {
      method: 'DELETE',
    })
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

  async openCashSession(openingAmount: number, userName: string) {
    return this.request<any>('/cash-sessions/open', {
      method: 'POST',
      body: JSON.stringify({ openingAmount, userName }),
    })
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

  async closeCashSession(sessionId: string, data: { actualCash: number; observations?: string; userName?: string }) {
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

  async updateTenant(id: string, data: { name?: string; businessType?: string; plan?: string; status?: string; maxUsers?: number; maxProducts?: number; bgColor?: string }) {
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

  // =============================================
  // Storefront management endpoints (authenticated)
  // =============================================

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

  async getPublicNewLaunches(store?: string) {
    const q = store ? `?store=${encodeURIComponent(store)}` : ''
    return this.request<any[]>(`/storefront/new-launches${q}`)
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

  async toggleCategoryVisibility(categoryId: string, hidden: boolean) {
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
    department?: string; municipality?: string; productCardStyle?: string;
    allowContraentrega?: boolean; showInfoModule?: boolean; infoModuleDescription?: string;
  }) {
    return this.request<any>('/storefront/store-extended-info', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  // =============================================
  // Announcement Bar endpoints
  // =============================================

  async updateAnnouncementBar(data: { text: string; linkUrl?: string; bgColor?: string; textColor?: string; isActive: boolean }) {
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

  async updateSuperadminIntegrations(data: {
    cloudinaryCloudName?: string; cloudinaryUploadPreset?: string; openaiApiKey?: string;
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
    return this.request<{ configured: boolean; planIds: Record<string, string | null> }>('/subscriptions/config')
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
  async updateRestbarOrderNotes(orderId: string, notes: string | null) {
    return this.request<any>(`/restbar/orders/${orderId}/notes`, { method: 'PATCH', body: JSON.stringify({ notes }) })
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
}

export const api = new ApiService()
