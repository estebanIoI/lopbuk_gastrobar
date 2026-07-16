'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

const LEVEL_COLORS: Record<string, string> = {
  bronze: '#CD7F32', silver: '#C0C0C0', gold: '#FFD700', platinum: '#E5E4E2',
}

const LEVEL_BADGES: Record<string, string> = {
  bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎',
}

export default function WalletActivationPage() {
  const params = useParams()
  const slug = params?.slug as string || ''

  const [step, setStep] = useState<'form' | 'success' | 'existing'>('form')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [saveUrl, setSaveUrl] = useState('')
  const [account, setAccount] = useState<any>(null)
  const [checking, setChecking] = useState(true)
  const [storeName, setStoreName] = useState('')

  // Check if user already has an account via stored phone
  const checkExisting = useCallback(async (phoneToCheck?: string) => {
    const storedPhone = localStorage.getItem(`wallet_phone_${slug}`)
    const p = phoneToCheck || storedPhone
    if (!p) { setChecking(false); return }
    try {
      const res = await fetch(`${API_URL}/engagement/lookup?phone=${encodeURIComponent(p)}&storeSlug=${encodeURIComponent(slug)}`)
      const json = await res.json()
      if (json.success && json.data?.found) {
        setAccount(json.data)
        setStep('existing')
      }
    } catch {} 
    setChecking(false)
  }, [slug])

  useEffect(() => {
    checkExisting()
    // Fetch store name
    fetch(`${API_URL}/storefront/store-config/${slug}`).then(r => r.json()).then(json => {
      if (json.success && json.data?.storeInfo) setStoreName(json.data.storeInfo.name || '')
    }).catch(() => {})
  }, [checkExisting, slug])

  const handleRegister = async () => {
    if (!phone.trim()) { toast.error('Teléfono requerido'); return }
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/engagement/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), name: name.trim(), email: email.trim(), storeSlug: slug }),
      })
      const json = await res.json()
      if (json.success) {
        localStorage.setItem(`wallet_phone_${slug}`, phone.trim())
        setSaveUrl(json.data.saveUrl || '')
        setAccount(json.data)
        setStep('success')
        toast.success('¡Tarjeta creada!')
      } else {
        toast.error(json.error || 'Error al registrar')
      }
    } catch { toast.error('Error de conexión') }
    setLoading(false)
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex flex-col items-center justify-center p-5">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="text-4xl mb-3">⭐</div>
        <h1 className="text-2xl font-black text-gray-900">
          {storeName || slug}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Programa de Fidelización
        </p>
      </div>

      {/* Existing Card */}
      {step === 'existing' && account && (
        <div className="w-full max-w-sm space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 text-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Tu tarjeta</span>
              <span className="text-2xl">{LEVEL_BADGES[account.level] || '🥉'}</span>
            </div>
            <p className="font-bold text-lg mb-1">{account.name || 'Sin nombre'}</p>
            <p className="text-3xl font-black text-amber-400 mb-4">{account.balance} <span className="text-sm font-normal text-gray-400">pts</span></p>
            <div className="flex gap-3 text-xs text-gray-400">
              <span>{account.visits || 0} visitas</span>
              <span>Nivel {account.level || 'bronze'}</span>
            </div>
          </div>
          <p className="text-center text-xs text-gray-400">
            Ya tienes tu tarjeta de fidelización activa. Tus puntos se actualizan automáticamente con cada compra.
          </p>
        </div>
      )}

      {/* Registration Form */}
      {step === 'form' && (
        <div className="w-full max-w-sm space-y-5">
          <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre</label>
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder="¿Cómo te llamas?"
                className="w-full rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Teléfono *</label>
              <input
                value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="Tu número de WhatsApp"
                type="tel"
                className="w-full rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Email <span className="text-gray-400 font-normal">(opcional)</span></label>
              <input
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="tucorreo@email.com"
                type="email"
                className="w-full rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
              />
            </div>
            <button
              onClick={handleRegister}
              disabled={loading}
              className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 transition disabled:opacity-60"
            >
              {loading ? 'Creando tu tarjeta...' : 'Obtener mi tarjeta de fidelización'}
            </button>
            <p className="text-[11px] text-gray-400 text-center">
              Al registrarte aceptas acumular puntos con cada compra
            </p>
          </div>
        </div>
      )}

      {/* Success with Google Wallet */}
      {step === 'success' && (
        <div className="w-full max-w-sm space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 text-white p-6 shadow-xl">
            <div className="text-center mb-4">
              <div className="text-5xl mb-2">🎉</div>
              <p className="font-bold text-lg">¡Tarjeta creada!</p>
              <p className="text-sm text-gray-400 mt-1">Ya haces parte del programa de fidelización</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">Nivel inicial</p>
              <p className="text-xl font-black text-amber-400">🥉 Bronce</p>
              <p className="text-xs text-gray-400 mt-2">Empieza a comprar para subir de nivel</p>
            </div>
          </div>

          {saveUrl && (
            <a
              href={saveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-white border-2 border-gray-800 hover:bg-gray-50 text-gray-900 font-semibold py-3.5 transition shadow-sm"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Agregar a Google Wallet
            </a>
          )}

          <p className="text-center text-xs text-gray-400">
            Tus puntos se acumulan automáticamente con cada compra. Muestra tu teléfono al pagar.
          </p>
        </div>
      )}
    </div>
  )
}
