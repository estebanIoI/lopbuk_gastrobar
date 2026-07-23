'use client'

import { useEffect, useState, useCallback } from 'react'
import { useStore } from '@/lib/store'
import { useAuthStore } from '@/lib/auth-store'
import { api } from '@/lib/api'
import {
  Link2, Copy, Check, ExternalLink, Settings2, Store, UtensilsCrossed,
  CalendarDays, Star, Contact, Loader2, AlertTriangle, Sparkles,
} from 'lucide-react'

/**
 * Hub de "Enlaces y accesos": muestra al comerciante TODOS los enlaces públicos
 * de su comercio (catálogo, menú, contacto, reservas, puntos), con su estado
 * (activo / por configurar), botones para copiar/abrir, y un acceso directo a la
 * sección donde se configura cada uno. Incluye el interruptor del botón
 * "Ver todas las tiendas" de la página pública.
 */

type LinkStatus = 'activo' | 'configurar'

interface LinkDef {
  key: string
  title: string
  description: string
  icon: React.ElementType
  path: string
  status: LinkStatus
  statusNote?: string
  configSection?: string
  configLabel?: string
}

export function StoreLinksHub() {
  const { setActiveSection } = useStore()
  const { user } = useAuthStore()
  const slug = user?.tenantSlug || ''
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [allStoresBtn, setAllStoresBtn] = useState(true)
  const [contactEnabled, setContactEnabled] = useState(false)
  const [reservationsEnabled, setReservationsEnabled] = useState(false)
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false)
  const [storeTheme, setStoreTheme] = useState('theme1')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getStoreCustomization()
      const d = res?.data || {}
      const si = d.storeInfo || {}
      // tinyint puede llegar como número; default = mostrar (true)
      setAllStoresBtn(si.allStoresButtonEnabled !== 0 && si.allStoresButtonEnabled !== false)
      setContactEnabled(!!si.contactPageEnabled)
      setReservationsEnabled(!!d.reservationsEnabled)
      setLoyaltyEnabled(!!d.loyaltyEnabled)
      setStoreTheme(String(d.storeTheme || 'theme1'))
    } catch {
      /* si falla, se quedan los defaults */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const toggleAllStores = async () => {
    const next = !allStoresBtn
    setAllStoresBtn(next)
    setSaving(true)
    try {
      await api.updateStoreExtendedInfo({ allStoresButtonEnabled: next })
    } catch {
      setAllStoresBtn(!next) // revertir si falla
    } finally {
      setSaving(false)
    }
  }

  const copy = async (key: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(key)
      setTimeout(() => setCopied(c => (c === key ? null : c)), 1600)
    } catch { /* clipboard bloqueado */ }
  }

  const catalogPath = storeTheme === 'theme2' ? `/t/${slug}` : `/?store=${slug}`

  const links: LinkDef[] = [
    {
      key: 'catalogo',
      title: 'Página de tu tienda',
      description: 'Tu catálogo público: aquí llegan los clientes a ver productos y comprar.',
      icon: Store,
      path: catalogPath,
      status: 'activo',
      configSection: 'contenido',
      configLabel: 'Editar página principal',
    },
    {
      key: 'menu',
      title: 'Menú / Historias',
      description: 'Vista tipo historias de tus productos publicados. Ideal para compartir en redes.',
      icon: UtensilsCrossed,
      path: `/menu/${slug}`,
      status: 'activo',
      configSection: 'tienda',
      configLabel: 'Publicar productos',
    },
    {
      key: 'contacto',
      title: 'Página de contacto / Links',
      description: 'Tu "link en la bio": redes, botones y accesos en una sola página.',
      icon: Contact,
      path: `/links/${slug}`,
      status: contactEnabled ? 'activo' : 'configurar',
      statusNote: contactEnabled ? undefined : 'Actívala y agrega tus links en "Mi tienda".',
      configSection: 'tienda',
      configLabel: 'Configurar contacto',
    },
    {
      key: 'reservar',
      title: 'Reservas',
      description: 'Para que tus clientes agenden citas, servicios o mesas en línea.',
      icon: CalendarDays,
      path: `/reservar/${slug}`,
      status: reservationsEnabled ? 'activo' : 'configurar',
      statusNote: reservationsEnabled ? undefined : 'Activa Reservas en la sección Servicios.',
      configSection: 'services',
      configLabel: 'Configurar servicios',
    },
    {
      key: 'wallet',
      title: 'Puntos / Fidelización',
      description: 'Tarjeta de puntos digital: tus clientes se unen y acumulan por sus compras.',
      icon: Star,
      path: `/wallet/${slug}`,
      status: loyaltyEnabled ? 'activo' : 'configurar',
      statusNote: loyaltyEnabled ? undefined : 'Activa el programa de puntos en Engagement.',
      configSection: 'engagement',
      configLabel: 'Configurar puntos',
    },
  ]

  if (!slug) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-lg rounded-2xl border border-amber-300/40 bg-amber-50 dark:bg-amber-950/20 p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
          <h2 className="mt-3 text-lg font-bold text-foreground">Tu tienda aún no tiene un enlace público</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuando tu comercio tenga un identificador (slug) asignado, aquí verás todos tus enlaces listos para copiar y compartir.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Link2 className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Enlaces y accesos</h1>
            <p className="text-sm text-muted-foreground">
              Todos los enlaces públicos de {user?.tenantName || 'tu comercio'}: cuáles tienes disponibles y cómo configurarlos.
            </p>
          </div>
        </div>
      </div>

      {/* Toggle: botón "Ver todas las tiendas" */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-foreground/70 shrink-0">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold text-foreground">Botón "Ver todas las tiendas"</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Es el botón que lleva a tus clientes de tu tienda al marketplace (otras tiendas).
                Desactívalo para que se queden dentro de tu tienda.
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={allStoresBtn}
            disabled={saving || loading}
            onClick={toggleAllStores}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
              allStoresBtn ? 'bg-primary' : 'bg-muted-foreground/30'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                allStoresBtn ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Estado actual: <span className={allStoresBtn ? 'text-emerald-600 font-medium' : 'text-foreground font-medium'}>
            {allStoresBtn ? 'Visible para los clientes' : 'Oculto'}
          </span>
          {saving && <span className="ml-2 inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> guardando…</span>}
        </p>
      </div>

      {/* Lista de enlaces */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {links.map(link => {
            const url = `${origin}${link.path}`
            const Icon = link.icon
            const isActive = link.status === 'activo'
            return (
              <div key={link.key} className="flex flex-col rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground/70 shrink-0">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-semibold text-foreground leading-tight">{link.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-snug">{link.description}</p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      isActive
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {isActive ? 'Activo' : 'Por configurar'}
                  </span>
                </div>

                {!isActive && link.statusNote && (
                  <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">{link.statusNote}</p>
                )}

                {/* URL chip */}
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5">
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">{url}</span>
                  <button
                    type="button"
                    onClick={() => copy(link.key, url)}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-foreground/70 hover:bg-background hover:text-foreground transition-colors"
                    title="Copiar enlace"
                  >
                    {copied === link.key ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied === link.key ? 'Copiado' : 'Copiar'}
                  </button>
                </div>

                {/* Acciones */}
                <div className="mt-3 flex items-center gap-2">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir
                  </a>
                  {link.configSection && (
                    <button
                      type="button"
                      onClick={() => setActiveSection(link.configSection!)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      {link.configLabel || 'Configurar'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Comparte estos enlaces en tus redes, WhatsApp o QR. El estado "Por configurar" no impide compartirlos: solo indica que puedes activar más funciones.
      </p>
    </div>
  )
}
