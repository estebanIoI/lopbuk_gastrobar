'use client'

type ApiResponse<T> = { success: boolean; data?: T; error?: string; message?: string; pagination?: any }

export function normalizeListResponse<T>(response: ApiResponse<any> | null | undefined): T[] {
  if (!response) return []

  const data = response.data
  if (Array.isArray(data)) return data as T[]

  if (data && typeof data === 'object') {
    for (const key of ['users', 'items', 'products', 'data', 'records', 'results']) {
      if (Array.isArray(data[key])) return data[key] as T[]
    }
  }

  return []
}

export function normalizePagination(response: ApiResponse<any> | null | undefined): { page: number; limit: number; total: number; totalPages: number } | null {
  if (!response) return null

  if (response.pagination) return response.pagination
  if (response.data && typeof response.data === 'object' && response.data.pagination) {
    return response.data.pagination
  }

  return null
}
