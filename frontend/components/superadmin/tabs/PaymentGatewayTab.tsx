'use client'

/**
 * PaymentGatewayTab — Configuración de la pasarela Wompi de PLATAFORMA (superadmin).
 * Las llaves se guardan cifradas en el backend; aquí solo se setean/actualizan.
 * Con estas llaves la plataforma cobra a los comercios (suscripciones, paquetes…).
 */
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CreditCard, ShieldCheck, Loader2, Check, Copy } from 'lucide-react'
import { api } from '@/lib/api'
import { WompiSubscribeButton } from '@/components/payments/wompi-subscribe-button'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

interface GatewayConfig {
  environment: 'sandbox' | 'production'
  isActive: boolean
  publicKey: string
  hasPrivateKey: boolean
  hasIntegritySecret: boolean
  hasEventsSecret: boolean
}

export function PaymentGatewayTab() {
  const [cfg, setCfg] = useState<GatewayConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  // Campos editables (los secretos van vacíos: solo se envían si se escriben).
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox')
  const [isActive, setIsActive] = useState(false)
  const [publicKey, setPublicKey] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [integritySecret, setIntegritySecret] = useState('')
  const [eventsSecret, setEventsSecret] = useState('')

  const webhookUrl = `${API_URL}/payments/wompi/webhook`

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await api.getPaymentGateway()
        if (alive && res?.success && res.data) {
          const d = res.data as GatewayConfig
          setCfg(d)
          setEnvironment(d.environment || 'sandbox')
          setIsActive(!!d.isActive)
          setPublicKey(d.publicKey || '')
        }
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  const save = async () => {
    setSaving(true); setSaved(false)
    try {
      const payload: any = { environment, isActive, publicKey }
      if (privateKey.trim()) payload.privateKey = privateKey.trim()
      if (integritySecret.trim()) payload.integritySecret = integritySecret.trim()
      if (eventsSecret.trim()) payload.eventsSecret = eventsSecret.trim()
      const res = await api.updatePaymentGateway(payload)
      if (res?.success && res.data) {
        setCfg(res.data)
        setPrivateKey(''); setIntegritySecret(''); setEventsSecret('')
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      }
    } finally {
      setSaving(false)
    }
  }

  const copyWebhook = () => {
    navigator.clipboard?.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }

  const secretPlaceholder = (has: boolean) => (has ? '•••••••••• (guardado — escribe para reemplazar)' : 'Pega tu secreto')

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Pasarela de pago — Wompi (plataforma)
          </CardTitle>
          <CardDescription>
            Con estas llaves la plataforma cobra a los comercios sus suscripciones y paquetes. Las llaves se guardan cifradas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Entorno */}
          <div className="space-y-1.5">
            <Label className="text-xs">Entorno</Label>
            <div className="flex gap-2">
              {(['sandbox', 'production'] as const).map(env => (
                <button
                  key={env}
                  type="button"
                  onClick={() => setEnvironment(env)}
                  className={`px-3 py-1.5 rounded-md text-sm border ${environment === env ? 'border-primary bg-primary/10 text-foreground' : 'border-input text-muted-foreground hover:border-muted-foreground/40'}`}
                >
                  {env === 'sandbox' ? 'Sandbox (pruebas)' : 'Producción'}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Las llaves de sandbox empiezan por <code>pub_test_</code> y las de producción por <code>pub_prod_</code>.</p>
          </div>

          {/* Llave pública */}
          <div className="space-y-1.5">
            <Label htmlFor="pubkey" className="text-xs">Llave pública</Label>
            <Input id="pubkey" value={publicKey} onChange={e => setPublicKey(e.target.value)} placeholder="pub_test_… / pub_prod_…" />
          </div>

          {/* Llave privada */}
          <div className="space-y-1.5">
            <Label htmlFor="privkey" className="text-xs">Llave privada</Label>
            <Input id="privkey" type="password" value={privateKey} onChange={e => setPrivateKey(e.target.value)} placeholder={secretPlaceholder(!!cfg?.hasPrivateKey)} />
          </div>

          {/* Secreto de integridad */}
          <div className="space-y-1.5">
            <Label htmlFor="integ" className="text-xs">Secreto de integridad</Label>
            <Input id="integ" type="password" value={integritySecret} onChange={e => setIntegritySecret(e.target.value)} placeholder={secretPlaceholder(!!cfg?.hasIntegritySecret)} />
            <p className="text-xs text-muted-foreground">En Wompi: Desarrolladores → Secretos para integración técnica.</p>
          </div>

          {/* Secreto de eventos */}
          <div className="space-y-1.5">
            <Label htmlFor="events" className="text-xs">Secreto de eventos (webhook)</Label>
            <Input id="events" type="password" value={eventsSecret} onChange={e => setEventsSecret(e.target.value)} placeholder={secretPlaceholder(!!cfg?.hasEventsSecret)} />
          </div>

          {/* Activo */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="h-4 w-4 accent-primary" />
            <span className="text-sm">Pasarela activa (habilitar cobros)</span>
          </label>

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={save} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Guardando…</> : saved ? <><Check className="h-4 w-4 mr-1.5" /> Guardado</> : 'Guardar configuración'}
            </Button>
            {cfg?.isActive && <span className="text-xs text-emerald-600 flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Activa</span>}
          </div>
        </CardContent>
      </Card>

      {/* Webhook */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">URL de eventos (webhook)</CardTitle>
          <CardDescription>Regístrala en el dashboard de Wompi (Desarrolladores → URL de eventos) para recibir la confirmación de los pagos.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-muted rounded px-3 py-2 break-all">{webhookUrl}</code>
            <Button variant="outline" size="sm" onClick={copyWebhook}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Probar cobro (valida config → checkout → webhook → activación) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Probar cobro de un plan</CardTitle>
          <CardDescription>
            Genera un checkout real con las llaves configuradas (usa <strong>sandbox</strong> para no mover dinero real). Toma el precio del plan desde Suscripciones.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!cfg?.isActive ? (
            <p className="text-sm text-muted-foreground">Activa y guarda la pasarela arriba para poder probar.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <WompiSubscribeButton plan="basico" label="Pagar Plan Básico" />
              <WompiSubscribeButton plan="profesional" label="Pagar Plan Profesional" />
              <WompiSubscribeButton plan="empresarial" label="Pagar Plan Empresarial" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
