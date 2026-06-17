'use client'

// Panel del rol comunidad_admin. Acceso solo para ese rol.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/auth-store'
import { CommunityAdmin } from '@/components/community/community-admin'
import { BoxLoader } from '@/components/box-loader'

export default function ComunidadAdminPage() {
  const router = useRouter()
  const { isAuthenticated, isCheckingAuth, checkAuth, user } = useAuthStore()
  const [ready, setReady] = useState(false)

  useEffect(() => { checkAuth() }, [checkAuth])

  useEffect(() => {
    if (isCheckingAuth) return
    if (!isAuthenticated) { router.replace('/login?next=/comunidad/admin'); return }
    if (user?.role !== 'comunidad_admin') { router.replace('/comunidad'); return }
    setReady(true)
  }, [isAuthenticated, isCheckingAuth, user, router])

  if (!ready) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50" style={{ ['--dz-bg' as any]: '#f9fafb' }}><BoxLoader /></div>
  }
  return <CommunityAdmin />
}
