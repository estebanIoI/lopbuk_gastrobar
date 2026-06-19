'use client'

import { useRef, useState } from 'react'
import {
  BadgeDollarSign, Building2, Check, ChevronDown, Copy, ExternalLink, Eye, Github,
  Globe, GripVertical, ImageIcon, Instagram, Linkedin, Package, Pencil, Phone,
  Mail, Plus, QrCode, RefreshCw, Save, Trash2, UserRound, Zap,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { CloudinaryUpload } from '@/components/ui/cloudinary-upload'
import { toast } from 'sonner'
import { usePortfolio } from '../hooks/usePortfolio'

const PF_PLANS = [
  { name: 'Micro', tag: 'Tienda única', price: '$80.000', period: '/mes', specs: ['1 sede', '1–3 usuarios', 'POS + Inventario', 'Tienda online básica'], highlighted: false, isEnterprise: false },
  { name: 'Pyme', tag: 'Negocio en crecimiento', price: '$300.000', period: '/mes', specs: ['2–5 sedes', '4–15 usuarios', 'Tienda + RestBar', 'Reportes avanzados'], highlighted: true, isEnterprise: false },
  { name: 'Mediana', tag: 'Empresa establecida', price: '$4.000.000', period: '/mes', specs: ['6–20 sedes', '16–60 usuarios', 'Multi-sede + Finanzas', 'Soporte prioritario'], highlighted: false, isEnterprise: false },
  { name: 'Enterprise', tag: '+20 sedes', price: 'Desde $5.000.000', period: '/mes', specs: ['Sedes ilimitadas', 'Usuarios ilimitados', 'SLA garantizado', 'Soporte 24/7 dedicado'], highlighted: false, isEnterprise: true },
]

const PF_EXTRAS = [
  { label: 'Implementación / Onboarding', value: '$300.000 – $3.000.000' },
  { label: 'Soporte premium / 24×7', value: '+20% a +50%' },
  { label: 'Hardware (impresoras, lector, cajas)', value: 'Se cotiza aparte' },
  { label: 'Personalizaciones a medida', value: '$100.000/hora o bolsa mensual' },
]

export function PortfolioTab() {
  const pfQrRef = useRef<HTMLDivElement>(null)
  const [showQr, setShowQr] = useState(false)

  const pfUrl = typeof window !== 'undefined' ? `${window.location.origin}/portfolio` : '/portfolio'

  const {
    pfHeroTitle, setPfHeroTitle, pfHeroSubtitle, setPfHeroSubtitle,
    pfHeroImage, setPfHeroImage, pfBrandDescription, setPfBrandDescription,
    pfShowPricing, setPfShowPricing, pfShowStores, setPfShowStores,
    pfFeaturedIds, setPfFeaturedIds, pfContactEmail, setPfContactEmail,
    pfContactWhatsapp, setPfContactWhatsapp, pfContactInstagram, setPfContactInstagram,
    pfAccentColor, setPfAccentColor, pfIsPublished, setPfIsPublished,
    pfRobotSpline, setPfRobotSpline,
    pfLanyardOffsetX, setPfLanyardOffsetX, pfLanyardOffsetY, setPfLanyardOffsetY, pfLanyardScale, setPfLanyardScale,
    pfTenants, pfLoading, pfSaving, pfSaved, handleSavePortfolio,
    teamCards, teamLoading, teamDialog, setTeamDialog,
    editingCard, teamForm, setTeamForm, teamSaving, teamDeletingId,
    openNewCard, openEditCard, handleSaveTeamCard, handleDeleteTeamCard,
    featureCards, featureLoading, featureDialog, setFeatureDialog,
    editingFeature, featureForm, setFeatureForm, featureSaving, featureDeletingId,
    openNewFeature, openEditFeature, handleSaveFeature, handleDeleteFeature,
    serviceCategories, serviceLoading, expandedCatId, setExpandedCatId,
    serviceCatDialog, setServiceCatDialog, editingCat, serviceCatForm, setServiceCatForm,
    serviceCatSaving, serviceCatDeletingId, openNewServiceCat, openEditServiceCat,
    handleSaveServiceCat, handleDeleteServiceCat,
    serviceOptDialog, setServiceOptDialog, editingOpt, serviceOptForm, setServiceOptForm,
    serviceOptSaving, serviceOptDeletingId, openNewServiceOpt, openEditServiceOpt,
    handleSaveServiceOpt, handleDeleteServiceOpt,
  } = usePortfolio()

  const handleDownloadQr = () => {
    if (!pfQrRef.current) return
    const svg = pfQrRef.current.querySelector('svg')
    if (!svg) return
    const svgData = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([svgData], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'portafolio-daimuz-qr.svg'; a.click()
    URL.revokeObjectURL(url)
  }

  if (pfLoading) {
    return <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-6">

      {/* Link + QR */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="h-4 w-4 text-indigo-500" />
                Portafolio DAIMUZ
              </CardTitle>
              <CardDescription className="mt-1">Vista pública del portafolio de servicios.</CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${pfIsPublished ? 'bg-green-500/15 text-green-400' : 'bg-muted text-muted-foreground'}`}>
                {pfIsPublished ? '● Publicado' : '○ Oculto'}
              </span>
              <a href="/portfolio" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                <ExternalLink className="h-3 w-3" /> Ver portafolio
              </a>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border">
            <code className="flex-1 text-xs text-muted-foreground truncate">{pfUrl}</code>
            <button onClick={() => { navigator.clipboard.writeText(pfUrl); toast.success('URL copiada') }}
              className="flex items-center gap-1 text-xs text-foreground bg-background border border-border rounded px-2 py-1 hover:bg-muted transition-colors">
              <Copy className="h-3 w-3" /> Copiar
            </button>
            <button onClick={() => setShowQr(v => !v)}
              className="flex items-center gap-1 text-xs text-foreground bg-background border border-border rounded px-2 py-1 hover:bg-muted transition-colors">
              <QrCode className="h-3 w-3" /> QR
            </button>
          </div>
          {showQr && (
            <div className="mt-4 flex items-start gap-4">
              <div ref={pfQrRef} className="p-3 bg-white rounded-xl inline-block">
                <QRCodeSVG value={pfUrl} size={140} />
              </div>
              <div className="space-y-2 pt-1">
                <p className="text-xs text-muted-foreground">Escanea para abrir el portafolio</p>
                <Button size="sm" variant="outline" onClick={handleDownloadQr}>Descargar QR</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hero del portafolio */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Hero del portafolio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Título de marca</Label>
              <Input value={pfHeroTitle} onChange={e => setPfHeroTitle(e.target.value)} placeholder="DAIMUZ" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Subtítulo</Label>
              <Input value={pfHeroSubtitle} onChange={e => setPfHeroSubtitle(e.target.value)} placeholder="Soluciones de gestión para tu negocio" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Descripción de la marca</Label>
            <textarea value={pfBrandDescription} onChange={e => setPfBrandDescription(e.target.value)}
              placeholder="Describe tu propuesta de valor..." rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Imagen / logo del hero</Label>
            <CloudinaryUpload value={pfHeroImage} onChange={(url: string) => setPfHeroImage(url)} label="Subir imagen del hero" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Robot 3D — URL de Spline (escena)</Label>
            <Input value={pfRobotSpline} onChange={e => setPfRobotSpline(e.target.value)} placeholder="https://prod.spline.design/XXXX/scene.splinecode" />
            <p className="text-[11px] text-muted-foreground">URL .splinecode de tu escena de Spline. Vacío = robot DAIMUZ por defecto. El asistente debe estar habilitado en Integraciones.</p>
          </div>

          {/* Posición y tamaño del carnet 3D (Lanyard) */}
          <div className="space-y-2 rounded-lg border border-border p-3">
            <Label className="text-xs font-semibold">Posición y tamaño del carnet (Lanyard)</Label>
            <p className="text-[11px] text-muted-foreground">Mueve el carnet 3D del portafolio con las flechas y ajusta el tamaño de todo el contenedor.</p>
            <div className="flex items-center gap-6 flex-wrap">
              <div className="grid grid-cols-3 gap-1 w-max">
                <span />
                <button type="button" onClick={() => setPfLanyardOffsetY(v => v - 10)} className="h-8 w-8 rounded-md border border-border hover:bg-muted flex items-center justify-center">↑</button>
                <span />
                <button type="button" onClick={() => setPfLanyardOffsetX(v => v - 10)} className="h-8 w-8 rounded-md border border-border hover:bg-muted flex items-center justify-center">←</button>
                <button type="button" onClick={() => { setPfLanyardOffsetX(0); setPfLanyardOffsetY(0) }} title="Centrar" className="h-8 w-8 rounded-md border border-border hover:bg-muted flex items-center justify-center text-xs">⌖</button>
                <button type="button" onClick={() => setPfLanyardOffsetX(v => v + 10)} className="h-8 w-8 rounded-md border border-border hover:bg-muted flex items-center justify-center">→</button>
                <span />
                <button type="button" onClick={() => setPfLanyardOffsetY(v => v + 10)} className="h-8 w-8 rounded-md border border-border hover:bg-muted flex items-center justify-center">↓</button>
                <span />
              </div>
              <div className="text-[11px] text-muted-foreground space-y-1">
                <div>X: <code>{pfLanyardOffsetX}px</code></div>
                <div>Y: <code>{pfLanyardOffsetY}px</code></div>
                <button type="button" onClick={() => { setPfLanyardOffsetX(0); setPfLanyardOffsetY(0); setPfLanyardScale(100) }} className="underline hover:text-foreground">Restablecer</button>
              </div>
              <div className="flex-1 min-w-[180px] space-y-1">
                <div className="flex items-center justify-between"><Label className="text-xs">Tamaño del contenedor</Label><span className="text-[11px] text-muted-foreground">{pfLanyardScale}%</span></div>
                <input type="range" min={40} max={200} step={5} value={pfLanyardScale} onChange={e => setPfLanyardScale(Number(e.target.value))} className="w-full accent-primary cursor-pointer" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Label className="text-xs">Color de acento</Label>
            <input type="color" value={pfAccentColor} onChange={e => setPfAccentColor(e.target.value)}
              className="w-9 h-9 rounded-lg border border-border cursor-pointer" />
            <code className="text-xs text-muted-foreground">{pfAccentColor}</code>
          </div>
        </CardContent>
      </Card>

      {/* Visibilidad */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Eye className="h-4 w-4" /> Visibilidad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: 'Portafolio publicado (visible al público)', value: pfIsPublished, set: setPfIsPublished },
            { label: 'Mostrar sección de precios', value: pfShowPricing, set: setPfShowPricing },
            { label: 'Mostrar comercios integrados', value: pfShowStores, set: setPfShowStores },
          ].map(({ label, value, set }) => (
            <label key={label} className="flex items-center justify-between cursor-pointer group">
              <span className="text-sm">{label}</span>
              <button onClick={() => set(!value)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${value ? 'bg-indigo-500' : 'bg-muted'}`}>
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-1'}`} />
              </button>
            </label>
          ))}
        </CardContent>
      </Card>

      {/* Planes & Precios — Preview */}
      <Card className="border-border bg-card overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BadgeDollarSign className="h-4 w-4 text-indigo-400" /> Planes & Precios
          </CardTitle>
          <CardDescription>Vista previa de la sección de precios del portafolio.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="bg-[#0a0a0f] rounded-b-lg p-6 space-y-6">
            <div className="text-center space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: pfAccentColor }}>Planes & Precios</p>
              <h3 className="text-white text-xl font-bold">Escala tu negocio con el plan perfecto</h3>
              <p className="text-gray-500 text-xs">Precios en COP · IVA no incluido · Contrato mensual</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {PF_PLANS.map(plan => (
                <div key={plan.name} className="relative flex flex-col p-4 rounded-xl border"
                  style={plan.highlighted
                    ? { borderColor: pfAccentColor, background: `${pfAccentColor}12` }
                    : { borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.025)' }}>
                  {plan.highlighted && <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest text-white whitespace-nowrap" style={{ background: pfAccentColor }}>Popular</div>}
                  {plan.isEnterprise && <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-yellow-500 text-black whitespace-nowrap">Enterprise</div>}
                  <div className="mb-3">
                    <p className="text-white font-bold text-sm">{plan.name}</p>
                    <p className="text-gray-500 text-[11px] mt-0.5">{plan.tag}</p>
                  </div>
                  <div className="mb-4">
                    <span className="text-white text-lg font-black">{plan.price}</span>
                    <span className="text-gray-500 text-xs">{plan.period}</span>
                  </div>
                  <ul className="space-y-1.5 flex-1">
                    {plan.specs.map(s => (
                      <li key={s} className="flex items-center gap-1.5 text-xs text-gray-400">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 flex-shrink-0" style={{ color: pfAccentColor }}>
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <p className="text-xs font-semibold text-gray-300 mb-3">Costos adicionales frecuentes</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {PF_EXTRAS.map(e => (
                  <div key={e.label} className="flex items-start justify-between gap-3 text-xs">
                    <span className="text-gray-500">{e.label}</span>
                    <span className="text-gray-300 font-medium text-right whitespace-nowrap">{e.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contacto */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Phone className="h-4 w-4" /> Información de contacto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" /> Email</Label>
              <Input value={pfContactEmail} onChange={e => setPfContactEmail(e.target.value)} placeholder="hola@daimuz.com" type="email" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> WhatsApp</Label>
              <Input value={pfContactWhatsapp} onChange={e => setPfContactWhatsapp(e.target.value)} placeholder="+573001234567" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Instagram className="h-3 w-3" /> Instagram URL</Label>
              <Input value={pfContactInstagram} onChange={e => setPfContactInstagram(e.target.value)} placeholder="https://instagram.com/daimuz" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comercios destacados */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Comercios destacados
            <span className="ml-auto text-xs text-muted-foreground font-normal">{pfFeaturedIds.length} seleccionados</span>
          </CardTitle>
          <CardDescription>Elige qué negocios mostrar en la sección &quot;Clientes que confían en DAIMUZ&quot;.</CardDescription>
        </CardHeader>
        <CardContent>
          {pfTenants.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No hay comercios activos</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {pfTenants.map(t => {
                const isSelected = pfFeaturedIds.includes(t.id)
                return (
                  <label key={t.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${isSelected ? 'border-indigo-400 bg-indigo-500/10' : 'border-input hover:bg-muted'}`}>
                    <input type="checkbox" checked={isSelected}
                      onChange={() => setPfFeaturedIds(prev => isSelected ? prev.filter(x => x !== t.id) : [...prev, t.id])}
                      className="rounded" />
                    {t.logoUrl
                      ? <img src={t.logoUrl} alt={t.name} className="w-7 h-7 rounded-full object-cover border border-border" /> // eslint-disable-line @next/next/no-img-element
                      : <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold">{t.name.charAt(0)}</div>}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{t.plan} · {t.slug}</p>
                    </div>
                  </label>
                )
              })}
            </div>
          )}
          {pfFeaturedIds.length > 0 && (
            <button onClick={() => setPfFeaturedIds([])} className="mt-2 text-xs text-muted-foreground hover:text-destructive transition-colors">
              Limpiar selección
            </button>
          )}
        </CardContent>
      </Card>

      {/* Feature Cards */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4 text-yellow-400" /> Características</CardTitle>
            <Button size="sm" onClick={openNewFeature} className="flex items-center gap-1.5"><Plus className="h-4 w-4" /> Nueva</Button>
          </div>
          <CardDescription>Tarjetas de funcionalidades de la sección Características del portafolio.</CardDescription>
        </CardHeader>
        <CardContent>
          {featureLoading ? (
            <div className="flex justify-center py-6"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : featureCards.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <Zap className="h-8 w-8 mx-auto mb-2 opacity-20" />Sin características — se usarán las predeterminadas
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {featureCards.map(feat => (
                <div key={feat.id} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-muted/30">
                  <span className="text-2xl">{feat.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{feat.title}</p>
                    {feat.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{feat.description}</p>}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${feat.is_active ? 'bg-green-500/15 text-green-400' : 'bg-muted text-muted-foreground'}`}>
                        {feat.is_active ? 'Activa' : 'Oculta'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">Orden: {feat.sort_order}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEditFeature(feat)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => handleDeleteFeature(feat.id)} disabled={featureDeletingId === feat.id} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                      {featureDeletingId === feat.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Service Catalog */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4 text-indigo-400" /> Catálogo de Servicios</CardTitle>
            <Button size="sm" onClick={openNewServiceCat} className="flex items-center gap-1.5"><Plus className="h-4 w-4" /> Nueva categoría</Button>
          </div>
          <CardDescription>Categorías y opciones del constructor interactivo de servicios.</CardDescription>
        </CardHeader>
        <CardContent>
          {serviceLoading ? (
            <div className="flex justify-center py-6"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : serviceCategories.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-20" />Sin categorías — se usará el catálogo predeterminado
            </div>
          ) : (
            <div className="space-y-2">
              {serviceCategories.map(cat => (
                <div key={cat.id} className="rounded-xl border border-border overflow-hidden">
                  <div className="flex items-center gap-3 p-3 bg-muted/30">
                    <span className="text-xl">{cat.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{cat.label}</p>
                      <p className="text-xs text-muted-foreground capitalize">{cat.type} · {cat.options?.length ?? 0} opciones</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openNewServiceOpt(cat.id)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><Plus className="h-3 w-3" /></button>
                      <button onClick={() => openEditServiceCat(cat)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => handleDeleteServiceCat(cat.id)} disabled={serviceCatDeletingId === cat.id} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                        {serviceCatDeletingId === cat.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={() => setExpandedCatId(expandedCatId === cat.id ? null : cat.id)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expandedCatId === cat.id ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  </div>
                  {expandedCatId === cat.id && (
                    <div className="p-3 pt-0 space-y-1.5 border-t border-border">
                      {(cat.options || []).length === 0
                        ? <p className="text-xs text-muted-foreground py-2 text-center">Sin opciones — agrega una con el botón +</p>
                        : (cat.options || []).map(opt => (
                          <div key={opt.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/20">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{opt.title}</p>
                              <p className="text-[10px] text-muted-foreground">${Number(opt.price).toLocaleString('es-CO')}{opt.savings ? ` · ${opt.savings}` : ''}{opt.is_popular ? ' · Popular' : ''}</p>
                            </div>
                            <button onClick={() => openEditServiceOpt(opt)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><Pencil className="h-3 w-3" /></button>
                            <button onClick={() => handleDeleteServiceOpt(opt.id)} disabled={serviceOptDeletingId === opt.id} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                              {serviceOptDeletingId === opt.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                            </button>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Cards */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm flex items-center gap-2"><UserRound className="h-4 w-4 text-cyan-400" /> Tarjetas del equipo</CardTitle>
            <Button size="sm" onClick={openNewCard} className="flex items-center gap-1.5"><Plus className="h-4 w-4" /> Nueva tarjeta</Button>
          </div>
          <CardDescription>Carnets 3D interactivos que aparecen en el carrusel del portafolio público.</CardDescription>
        </CardHeader>
        <CardContent>
          {teamLoading ? (
            <div className="flex justify-center py-6"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : teamCards.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <UserRound className="h-10 w-10 mx-auto mb-2 opacity-20" />Sin tarjetas — crea la primera para mostrarla en el portafolio
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {teamCards.map(card => (
                <div key={card.id} className="relative rounded-2xl border border-border overflow-hidden"
                  style={{ background: `linear-gradient(135deg, #0f0f1a 0%, ${card.accent_color}18 100%)` }}>
                  <div className="p-4 flex gap-3 items-start">
                    <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 border-2" style={{ borderColor: card.accent_color }}>
                      {card.photo_url
                        ? <img src={card.photo_url} alt={card.name} className="w-full h-full object-cover" /> // eslint-disable-line @next/next/no-img-element
                        : <div className="w-full h-full flex items-center justify-center text-xl font-bold" style={{ background: `${card.accent_color}33`, color: card.accent_color }}>{card.name.charAt(0).toUpperCase()}</div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-white truncate">{card.name}</p>
                      <p className="text-xs truncate" style={{ color: card.accent_color }}>{card.role}</p>
                      {card.bio && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{card.bio}</p>}
                      <div className="flex items-center gap-2 mt-1.5">
                        {card.github_url && <Github className="h-3 w-3 text-gray-500" />}
                        {card.linkedin_url && <Linkedin className="h-3 w-3 text-gray-500" />}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${card.is_active ? 'bg-green-500/15 text-green-400' : 'bg-muted text-muted-foreground'}`}>
                          {card.is_active ? 'Activa' : 'Oculta'}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-0.5">
                          <GripVertical className="h-3 w-3" /> {card.sort_order}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex border-t border-border">
                    <button onClick={() => openEditCard(card)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                      <Pencil className="h-3 w-3" /> Editar
                    </button>
                    <button onClick={() => handleDeleteTeamCard(card.id)} disabled={teamDeletingId === card.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors border-l border-border">
                      {teamDeletingId === card.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <><Trash2 className="h-3 w-3" /> Eliminar</>}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Guardar */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSavePortfolio} disabled={pfSaving} className="flex items-center gap-2">
          {pfSaving ? <><RefreshCw className="h-4 w-4 animate-spin" /> Guardando…</>
            : pfSaved ? <><Check className="h-4 w-4" /> Guardado</>
              : <><Save className="h-4 w-4" /> Guardar portafolio</>}
        </Button>
        <a href="/portfolio" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
          <ExternalLink className="h-4 w-4" /> Vista previa
        </a>
      </div>

      {/* ── Dialogs ───────────────────────────────────────────────────────────── */}

      {/* Dialog: Tarjeta de equipo */}
      <Dialog open={teamDialog} onOpenChange={setTeamDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-cyan-400" />
              {editingCard ? 'Editar tarjeta' : 'Nueva tarjeta de equipo'}
            </DialogTitle>
            <DialogDescription>Carnet 3D colgante (Lanyard) del portafolio público: la foto se imprime sobre el carnet y el cordón usa la imagen de la banda.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Imagen de la tarjeta (foto del dev)</Label>
              <CloudinaryUpload value={teamForm.photo_url} onChange={(url: string) => setTeamForm(f => ({ ...f, photo_url: url }))} label="Subir foto" />
              <p className="text-[11px] text-muted-foreground">Se mapea sobre la cara del carnet 3D. Ideal: vertical y con buena luz.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Imagen de la banda / cordón</Label>
              <CloudinaryUpload value={teamForm.band_image_url} onChange={(url: string) => setTeamForm(f => ({ ...f, band_image_url: url }))} label="Subir banda" />
              <p className="text-[11px] text-muted-foreground">Textura del cordón que sostiene el carnet. Se repite a lo largo; si se deja vacío, usa la banda DAIMUZ por defecto.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nombre *</Label>
                <Input value={teamForm.name} onChange={e => setTeamForm(f => ({ ...f, name: e.target.value }))} placeholder="Jhon Esteban" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Rol / Cargo</Label>
                <Input value={teamForm.role} onChange={e => setTeamForm(f => ({ ...f, role: e.target.value }))} placeholder="Desarrollador Full Stack" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Bio corta</Label>
              <textarea value={teamForm.bio} onChange={e => setTeamForm(f => ({ ...f, bio: e.target.value }))}
                placeholder="Especialista en React, Node.js..." rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Color de acento</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={teamForm.accent_color} onChange={e => setTeamForm(f => ({ ...f, accent_color: e.target.value }))} className="w-9 h-9 rounded-lg border border-border cursor-pointer" />
                  <code className="text-xs text-muted-foreground">{teamForm.accent_color}</code>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Orden</Label>
                <Input type="number" min={0} value={teamForm.sort_order} onChange={e => setTeamForm(f => ({ ...f, sort_order: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Github className="h-3 w-3" /> GitHub URL</Label>
                <Input value={teamForm.github_url} onChange={e => setTeamForm(f => ({ ...f, github_url: e.target.value }))} placeholder="https://github.com/user" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Linkedin className="h-3 w-3" /> LinkedIn URL</Label>
                <Input value={teamForm.linkedin_url} onChange={e => setTeamForm(f => ({ ...f, linkedin_url: e.target.value }))} placeholder="https://linkedin.com/in/user" />
              </div>
            </div>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">Tarjeta activa (visible en el portafolio)</span>
              <button type="button" onClick={() => setTeamForm(f => ({ ...f, is_active: !f.is_active }))}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${teamForm.is_active ? 'bg-cyan-500' : 'bg-muted'}`}>
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${teamForm.is_active ? 'translate-x-4' : 'translate-x-1'}`} />
              </button>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTeamDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveTeamCard} disabled={teamSaving} className="flex items-center gap-2">
              {teamSaving ? <><RefreshCw className="h-4 w-4 animate-spin" /> Guardando…</> : <><Save className="h-4 w-4" /> {editingCard ? 'Actualizar' : 'Crear tarjeta'}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Feature card */}
      <Dialog open={featureDialog} onOpenChange={setFeatureDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingFeature ? 'Editar característica' : 'Nueva característica'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-[auto_1fr] gap-3 items-start">
              <div>
                <Label className="text-xs mb-1 block">Icono</Label>
                <input type="text" value={featureForm.icon} onChange={e => setFeatureForm(p => ({ ...p, icon: e.target.value }))}
                  className="w-16 h-9 text-center text-xl border rounded-lg bg-background" maxLength={4} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Título *</Label>
                <Input value={featureForm.title} onChange={e => setFeatureForm(p => ({ ...p, title: e.target.value }))} placeholder="Ej. Punto de Venta" />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Descripción</Label>
              <Textarea value={featureForm.description} onChange={e => setFeatureForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Descripción breve" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Orden</Label>
                <Input type="number" value={featureForm.sort_order} onChange={e => setFeatureForm(p => ({ ...p, sort_order: Number(e.target.value) }))} />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={featureForm.is_active} onCheckedChange={v => setFeatureForm(p => ({ ...p, is_active: v }))} />
                <Label className="text-xs">Visible</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeatureDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveFeature} disabled={featureSaving}>
              {featureSaving ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : null}
              {editingFeature ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Categoría de servicio */}
      <Dialog open={serviceCatDialog} onOpenChange={setServiceCatDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingCat ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-[auto_1fr] gap-3 items-start">
              <div>
                <Label className="text-xs mb-1 block">Icono</Label>
                <input type="text" value={serviceCatForm.icon} onChange={e => setServiceCatForm(p => ({ ...p, icon: e.target.value }))}
                  className="w-16 h-9 text-center text-xl border rounded-lg bg-background" maxLength={4} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Etiqueta *</Label>
                <Input value={serviceCatForm.label} onChange={e => setServiceCatForm(p => ({ ...p, label: e.target.value }))} placeholder="Ej. Landing Pages" />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Tipo</Label>
              <select value={serviceCatForm.type} onChange={e => setServiceCatForm(p => ({ ...p, type: e.target.value as 'package' | 'subscription' | 'addon' }))}
                className="w-full h-9 border rounded-lg px-2 text-sm bg-background">
                <option value="package">Paquete (compra única)</option>
                <option value="subscription">Suscripción mensual</option>
                <option value="addon">Add-on / complemento</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Orden</Label>
                <Input type="number" value={serviceCatForm.sort_order} onChange={e => setServiceCatForm(p => ({ ...p, sort_order: Number(e.target.value) }))} />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={serviceCatForm.is_active} onCheckedChange={v => setServiceCatForm(p => ({ ...p, is_active: v }))} />
                <Label className="text-xs">Activa</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServiceCatDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveServiceCat} disabled={serviceCatSaving}>
              {serviceCatSaving ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : null}
              {editingCat ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Opción de servicio */}
      <Dialog open={serviceOptDialog} onOpenChange={setServiceOptDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingOpt ? 'Editar opción' : 'Nueva opción'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs mb-1 block">Título *</Label>
              <Input value={serviceOptForm.title} onChange={e => setServiceOptForm(p => ({ ...p, title: e.target.value }))} placeholder="Ej. Pack x10 Landings" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Descripción</Label>
              <Input value={serviceOptForm.description} onChange={e => setServiceOptForm(p => ({ ...p, description: e.target.value }))} placeholder="Descripción breve" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Precio (COP)</Label>
                <Input type="number" value={serviceOptForm.price} onChange={e => setServiceOptForm(p => ({ ...p, price: Number(e.target.value) }))} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Ahorro (texto)</Label>
                <Input value={serviceOptForm.savings} onChange={e => setServiceOptForm(p => ({ ...p, savings: e.target.value }))} placeholder="Ej. Ahorro 12%" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Orden</Label>
                <Input type="number" value={serviceOptForm.sort_order} onChange={e => setServiceOptForm(p => ({ ...p, sort_order: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1 pt-1">
                <div className="flex items-center gap-2">
                  <Switch checked={serviceOptForm.is_popular} onCheckedChange={v => setServiceOptForm(p => ({ ...p, is_popular: v }))} />
                  <Label className="text-xs">Popular</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={serviceOptForm.is_active} onCheckedChange={v => setServiceOptForm(p => ({ ...p, is_active: v }))} />
                  <Label className="text-xs">Activa</Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServiceOptDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveServiceOpt} disabled={serviceOptSaving}>
              {serviceOptSaving ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : null}
              {editingOpt ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}

