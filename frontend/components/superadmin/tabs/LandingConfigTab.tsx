'use client'

import {
  CalendarDays, Check, ImageIcon, LayoutTemplate, Plus, Pencil, RefreshCw,
  Sparkles, Tag, Trash2, ArrowUp, ArrowDown, Video, GalleryHorizontal, Store,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { CloudinaryUpload } from '@/components/ui/cloudinary-upload'
import { PlatformThemeGenerator } from '@/components/platform-theme-generator'
import { formatCOP } from '@/lib/utils'
import { useLandingConfig } from '../hooks/useLandingConfig'

export function LandingConfigTab() {
  const {
    heroUrl, setHeroUrl, heroTitle, setHeroTitle, heroSubtitle, setHeroSubtitle,
    isSavingHero, handleSaveHero,
    loginImageUrl, setLoginImageUrl, isSavingLogin, handleSaveLoginImage,
    platformLogo, setPlatformLogo, isSavingPlatformLogo, handleSavePlatformLogo,
    panelTheme, isSavingTheme, handleSavePanelTheme,
    homeTheme, isSavingHomeTheme, handleSaveHomeTheme,
    heroSlides, isSavingSlides, addSlide, updateSlide, removeSlide, moveSlide, handleSaveHeroSlides,
    heroSplit, heroRight, isSavingHeroLayout, handleSaveHeroSplit, handleSaveHeroRight,
    welcomeEnabled, setWelcomeEnabled, welcomeTitle, setWelcomeTitle, welcomeSubtitle, setWelcomeSubtitle, isSavingWelcome, handleSaveWelcome,
    promoCards, promoCatalog, isSavingPromos, addPromoCard, removePromoCard, updatePromoLabel, movePromoCard, handleSavePromoCards,
    offers, isLoadingOffers, fetchOffers,
    drops, isLoadingDrops, fetchDrops,
    isDropDialogOpen, setIsDropDialogOpen,
    editingDrop, dropForm, setDropForm,
    isSavingDrop, deletingDropId, setDeletingDropId,
    openCreateDrop, openEditDrop, handleSaveDrop, handleDeleteDrop,
  } = useLandingConfig()

  return (
    <div className="space-y-6">

      {/* Logo / Favicon de la plataforma (DAIMUZ) */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base lg:text-lg flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
            Logo / Favicon de la plataforma
          </CardTitle>
          <CardDescription>
            Logo que se muestra en la página de inicio (navbar) y en la pestaña del navegador (favicon). Por defecto el icono DAIMUZ.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={platformLogo} alt="Logo plataforma" className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3' }} />
            </div>
            <div className="flex-1 min-w-0">
              <Label className="text-xs">Presets DAIMUZ</Label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {([
                  { url: '/daimuz-icon.png', label: 'Icono (recomendado)' },
                  { url: '/daimuz-isotipo.png', label: 'Insignia' },
                  { url: '/daimuz-icon-transparent.png', label: 'Transparente' },
                ] as const).map(p => (
                  <button key={p.url} type="button" disabled={isSavingPlatformLogo} onClick={() => handleSavePlatformLogo(p.url)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${platformLogo === p.url ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-muted'}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="" className="w-5 h-5 object-contain rounded" />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">O sube tu propio logo</Label>
            <CloudinaryUpload
              value={platformLogo.startsWith('/') ? '' : platformLogo}
              onChange={(url) => setPlatformLogo(url || '/daimuz-icon.png')}
              accept="image/*,.png,.svg"
              previewClassName="w-16 h-16 object-contain rounded-lg border border-border"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => handleSavePlatformLogo()} disabled={isSavingPlatformLogo}>
              {isSavingPlatformLogo ? 'Guardando...' : 'Guardar logo'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => handleSavePlatformLogo('/daimuz-icon.png')} disabled={isSavingPlatformLogo}>
              Restablecer al icono DAIMUZ
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Colorimetría de la plataforma (IA, desde el logo) */}
      <PlatformThemeGenerator logoUrl={platformLogo} />

      {/* Hero Principal */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base lg:text-lg flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
            Hero Principal (Landing)
          </CardTitle>
          <CardDescription>Imagen, título y subtítulo del banner principal de la página pública</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>URL de imagen del hero</Label>
            <Input
              value={heroUrl}
              onChange={(e) => setHeroUrl(e.target.value)}
              placeholder="https://ejemplo.com/imagen.jpg o GIF"
              className="font-mono text-sm"
            />
          </div>
          {heroUrl && (
            <div className="relative w-full max-w-md h-40 rounded border border-border overflow-hidden bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heroUrl} alt="Preview hero" className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Título del hero</Label>
              <Input value={heroTitle} onChange={(e) => setHeroTitle(e.target.value)} placeholder="Ej: Bienvenidos a nuestra tienda" />
            </div>
            <div className="space-y-2">
              <Label>Subtítulo del hero</Label>
              <Input value={heroSubtitle} onChange={(e) => setHeroSubtitle(e.target.value)} placeholder="Ej: Las mejores fragancias" />
            </div>
          </div>
          <Button size="sm" onClick={handleSaveHero} disabled={isSavingHero}>
            {isSavingHero ? 'Guardando...' : 'Guardar Hero'}
          </Button>
        </CardContent>
      </Card>

      {/* Tema de la Página de Inicio (Marketplace) */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base lg:text-lg flex items-center gap-2">
            <Store className="h-5 w-5 text-muted-foreground" />
            Tema de la Página de Inicio
          </CardTitle>
          <CardDescription>
            Diseño de la página pública donde se listan todos los comercios. El Tema 2 usa un estilo tipo
            Mercado Libre con carrusel de banners y categorías por rubro. Las tarjetas de los comercios no cambian.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([
              { value: 'theme1', title: 'Tema 1 · Clásico', desc: 'Banner único + pills de rubro centradas. El diseño original de la home.', accent: '#6366f1' },
              { value: 'theme2', title: 'Tema 2 · Marketplace', desc: 'Carrusel de banners/GIF/video + barra y grid de categorías estilo Mercado Libre.', accent: '#FFE600' },
            ] as const).map(opt => {
              const selected = homeTheme === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={isSavingHomeTheme}
                  onClick={() => handleSaveHomeTheme(opt.value)}
                  className={`relative text-left rounded-lg border-2 p-4 transition-all disabled:opacity-60 ${
                    selected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/40 bg-background'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ background: opt.accent }} />
                      <span className="text-sm font-semibold text-foreground">{opt.title}</span>
                    </div>
                    {selected && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{opt.desc}</p>
                  {selected && <span className="mt-2 inline-block text-[11px] font-medium text-primary">Activo</span>}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Carrusel del Hero (Página de Inicio · Tema 2) */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base lg:text-lg flex items-center gap-2">
                <GalleryHorizontal className="h-5 w-5 text-muted-foreground" />
                Carrusel del Hero (Página de Inicio)
              </CardTitle>
              <CardDescription>
                Banners, GIF o videos que rotan en la parte superior de la home (Tema 2). Se reproducen en orden.
              </CardDescription>
            </div>
            <Button size="sm" onClick={handleSaveHeroSlides} disabled={isSavingSlides} className="shrink-0">
              {isSavingSlides ? 'Guardando...' : 'Guardar carrusel'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {heroSlides.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
              <GalleryHorizontal className="h-9 w-9 mb-2 opacity-40" />
              <p className="text-sm">Aún no hay slides. Agrega el primero.</p>
            </div>
          )}

          {heroSlides.map((slide, idx) => (
            <div key={slide.id} className="rounded-lg border border-border bg-background p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Slide {idx + 1}</span>
                  <div className="flex items-center rounded-md border border-border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => updateSlide(slide.id, { type: 'image' })}
                      className={`flex items-center gap-1 px-2 py-1 text-[11px] transition-colors ${slide.type === 'image' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                    >
                      <ImageIcon className="h-3 w-3" /> Imagen/GIF
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSlide(slide.id, { type: 'video' })}
                      className={`flex items-center gap-1 px-2 py-1 text-[11px] transition-colors ${slide.type === 'video' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                    >
                      <Video className="h-3 w-3" /> Video
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === 0} onClick={() => moveSlide(slide.id, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === heroSlides.length - 1} onClick={() => moveSlide(slide.id, 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/70 hover:text-destructive" onClick={() => removeSlide(slide.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {slide.type === 'image' ? (
                <div className="space-y-2">
                  <Label className="text-xs">Imagen o GIF</Label>
                  <CloudinaryUpload
                    value={slide.url}
                    onChange={(url) => updateSlide(slide.id, { url })}
                    accept="image/*,.gif"
                    previewClassName="w-full max-w-md h-32 object-cover rounded-lg border border-border"
                  />
                  <Input
                    value={slide.url}
                    onChange={(e) => updateSlide(slide.id, { url: e.target.value })}
                    placeholder="...o pega una URL de imagen/GIF"
                    className="font-mono text-xs"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-xs">URL del video (.mp4)</Label>
                  <Input
                    value={slide.url}
                    onChange={(e) => updateSlide(slide.id, { url: e.target.value })}
                    placeholder="https://.../banner.mp4"
                    className="font-mono text-xs"
                  />
                  {slide.url && (
                    <video src={slide.url} muted loop autoPlay playsInline className="w-full max-w-md h-32 object-cover rounded-lg border border-border" />
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Título (opcional)</Label>
                  <Input value={slide.title || ''} onChange={(e) => updateSlide(slide.id, { title: e.target.value })} placeholder="Ej: Grandes ofertas" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Subtítulo (opcional)</Label>
                  <Input value={slide.subtitle || ''} onChange={(e) => updateSlide(slide.id, { subtitle: e.target.value })} placeholder="Ej: Hasta 50% de descuento" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Enlace al hacer clic (opcional)</Label>
                <Input value={slide.link || ''} onChange={(e) => updateSlide(slide.id, { link: e.target.value })} placeholder="https://... o /t/mi-tienda" className="font-mono text-xs" />
              </div>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addSlide} className="gap-1">
            <Plus className="h-4 w-4" /> Agregar slide
          </Button>
          <p className="text-xs text-muted-foreground">
            Recuerda pulsar <strong>Guardar carrusel</strong> para aplicar los cambios. Solo se muestran en la home con Tema 2 activo.
          </p>
        </CardContent>
      </Card>

      {/* Barra de bienvenida (Tema 2) */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base lg:text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
            Barra de bienvenida (Tema 2)
          </CardTitle>
          <CardDescription>
            La barra que aparece sobre el carrusel en la página de inicio. Actívala, desactívala y edita su contenido. Solo aplica con el Tema 2 activo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm">Mostrar barra de bienvenida</Label>
              <p className="text-xs text-muted-foreground mt-0.5">{welcomeEnabled ? 'Visible en la home' : 'Oculta en la home'}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={welcomeEnabled}
              onClick={() => setWelcomeEnabled(!welcomeEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${welcomeEnabled ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${welcomeEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Título</Label>
              <Input value={welcomeTitle} onChange={(e) => setWelcomeTitle(e.target.value)} placeholder="Ej: Bienvenido a DAIMUZ" />
            </div>
            <div>
              <Label>Subtítulo</Label>
              <Input value={welcomeSubtitle} onChange={(e) => setWelcomeSubtitle(e.target.value)} placeholder="Ej: descubre los comercios locales y sus productos" />
            </div>
          </div>
          <Button onClick={handleSaveWelcome} disabled={isSavingWelcome}>
            {isSavingWelcome ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
            Guardar barra
          </Button>
          <p className="text-xs text-muted-foreground">Si el título queda vacío, se usa “Bienvenido a {'{marca}'}”.</p>
        </CardContent>
      </Card>

      {/* Disposición del Hero (Tema 2) */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base lg:text-lg flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5 text-muted-foreground" />
            Disposición del Hero (Tema 2)
          </CardTitle>
          <CardDescription>
            Proporción del hero (carrusel a la izquierda) y qué se muestra en el panel derecho. Solo aplica con el Tema 2 activo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Proporción */}
          <div>
            <Label className="text-xs mb-2 block">Proporción (izquierda / derecha)</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: '70-30', label: '70 / 30' },
                { value: '60-40', label: '60 / 40' },
                { value: '50-50', label: '50 / 50' },
              ] as const).map(opt => {
                const selected = heroSplit === opt.value
                return (
                  <button key={opt.value} type="button" disabled={isSavingHeroLayout} onClick={() => handleSaveHeroSplit(opt.value)}
                    className={`rounded-lg border-2 p-3 transition-all disabled:opacity-60 ${selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 bg-background'}`}>
                    <div className="flex gap-1 h-8 mb-1.5">
                      <div className="rounded bg-primary/30" style={{ flex: Number(opt.value.split('-')[0]) }} />
                      <div className="rounded bg-muted-foreground/30" style={{ flex: Number(opt.value.split('-')[1]) }} />
                    </div>
                    <span className="text-xs font-medium">{opt.label}</span>
                    {selected && <Check className="h-3.5 w-3.5 text-primary inline-block ml-1" />}
                  </button>
                )
              })}
            </div>
          </div>
          {/* Panel derecho */}
          <div>
            <Label className="text-xs mb-2 block">Contenido del panel derecho</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {([
                { value: 'producto', title: 'Producto destacado', desc: 'Muestra el producto destacado/oferta principal.' },
                { value: 'comercio', title: 'Comercio destacado', desc: 'Muestra un comercio verificado.' },
                { value: 'cta', title: 'Solo CTA', desc: 'Llamado a la acción "Únete a Lopbuk".' },
              ] as const).map(opt => {
                const selected = heroRight === opt.value
                return (
                  <button key={opt.value} type="button" disabled={isSavingHeroLayout} onClick={() => handleSaveHeroRight(opt.value)}
                    className={`text-left rounded-lg border-2 p-3 transition-all disabled:opacity-60 ${selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 bg-background'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold">{opt.title}</span>
                      {selected && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">{opt.desc}</p>
                  </button>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tarjetas del carrusel "Para ti" (Tema 2) */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base lg:text-lg flex items-center gap-2">
                <GalleryHorizontal className="h-5 w-5 text-muted-foreground" />
                Tarjetas del carrusel "Para ti"
              </CardTitle>
              <CardDescription>
                Elige y ordena qué tarjetas aparecen en el carrusel de la home (Tema 2). Las de producto usan datos reales; las de acceso son botones a secciones.
              </CardDescription>
            </div>
            <Button size="sm" onClick={handleSavePromoCards} disabled={isSavingPromos} className="shrink-0">
              {isSavingPromos ? 'Guardando...' : 'Guardar carrusel'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tarjetas activas (ordenables) */}
          {promoCards.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">No hay tarjetas. Agrega abajo.</p>
          ) : (
            <div className="space-y-2">
              {promoCards.map((card, idx) => {
                const cat = promoCatalog.find(c => c.key === card.key)
                const isProduct = cat?.kind === 'product'
                return (
                  <div key={`${card.key}-${idx}`} className="flex items-center gap-2 rounded-lg border border-border bg-background p-2.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${isProduct ? 'bg-green-500/15 text-green-600' : 'bg-blue-500/15 text-blue-600'}`}>
                      {isProduct ? 'PRODUCTO' : 'ACCESO'}
                    </span>
                    <Input value={card.label} onChange={(e) => updatePromoLabel(idx, e.target.value)} className="h-8 flex-1" placeholder="Etiqueta" />
                    <span className="text-[11px] text-muted-foreground hidden sm:inline">{cat?.desc}</span>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === 0} onClick={() => movePromoCard(idx, -1)}><ArrowUp className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === promoCards.length - 1} onClick={() => movePromoCard(idx, 1)}><ArrowDown className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/70 hover:text-destructive" onClick={() => removePromoCard(idx)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {/* Agregar tarjeta */}
          <div>
            <Label className="text-xs mb-2 block">Agregar tarjeta</Label>
            <div className="flex flex-wrap gap-2">
              {promoCatalog.map(c => (
                <button key={c.key} type="button" onClick={() => addPromoCard(c.key)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs hover:bg-muted transition-colors">
                  <Plus className="h-3.5 w-3.5" />
                  {c.label}
                  <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${c.kind === 'product' ? 'bg-green-500/15 text-green-600' : 'bg-blue-500/15 text-blue-600'}`}>{c.kind === 'product' ? 'P' : 'A'}</span>
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Recuerda pulsar <strong>Guardar carrusel</strong> para aplicar los cambios.</p>
        </CardContent>
      </Card>

      {/* Login Image/GIF */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base lg:text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
            Imagen / GIF del Login
          </CardTitle>
          <CardDescription>Imagen o GIF de fondo que se muestra en la pantalla de inicio de sesión</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CloudinaryUpload
            value={loginImageUrl}
            onChange={setLoginImageUrl}
            accept="image/*,.gif"
            previewClassName="w-full max-w-xs h-48 object-cover rounded-lg border border-border"
          />
          <p className="text-xs text-muted-foreground">
            Acepta imágenes estáticas (.jpg, .png, .webp) o animadas (.gif).
          </p>
          <Button size="sm" onClick={handleSaveLoginImage} disabled={isSavingLogin}>
            {isSavingLogin ? 'Guardando...' : 'Guardar imagen de login'}
          </Button>
        </CardContent>
      </Card>

      {/* Tema del Panel del Comerciante */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base lg:text-lg flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5 text-muted-foreground" />
            Tema del Panel del Comerciante
          </CardTitle>
          <CardDescription>
            Elige el diseño con el que TODOS los comercios ven su panel de administración. El cambio es global e inmediato.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([
              { value: 'classic', title: 'Tema clásico', desc: 'Barra lateral flotante + secciones. El diseño original.', accent: '#6366f1' },
              { value: 'comerciante', title: 'Tema 2 · Comerciante', desc: 'Navbar verde con mega-menús, accesos rápidos y asistente.', accent: '#00833E' },
            ] as const).map(opt => {
              const selected = panelTheme === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={isSavingTheme}
                  onClick={() => handleSavePanelTheme(opt.value)}
                  className={`relative text-left rounded-lg border-2 p-4 transition-all disabled:opacity-60 ${
                    selected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/40 bg-background'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ background: opt.accent }} />
                      <span className="text-sm font-semibold text-foreground">{opt.title}</span>
                    </div>
                    {selected && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{opt.desc}</p>
                  {selected && <span className="mt-2 inline-block text-[11px] font-medium text-primary">Activo</span>}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            El superadmin siempre ve el tema clásico. El Tema 2 aplica a comerciantes, vendedores y bodega.
          </p>
        </CardContent>
      </Card>

      {/* Ofertas Activas */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base lg:text-lg flex items-center gap-2">
                <Tag className="h-5 w-5 text-orange-500" />
                Ofertas Activas en Comercios
              </CardTitle>
              <CardDescription>Productos con oferta activa en todas las tiendas</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchOffers} disabled={isLoadingOffers} className="gap-1">
              <RefreshCw className={`h-4 w-4 ${isLoadingOffers ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingOffers ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : offers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Tag className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">No hay productos en oferta actualmente</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {offers.map((product: any) => (
                <div key={product.id} className="flex gap-3 p-3 border border-border rounded-lg bg-background">
                  <div className="w-14 h-14 shrink-0 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                    ) : <Sparkles className="h-5 w-5 text-muted-foreground/30" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{product.tenantName || product.brand || ''}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-sm font-semibold text-orange-500">{formatCOP(product.offerPrice)}</span>
                      <span className="text-xs text-muted-foreground line-through">{formatCOP(product.salePrice)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drops */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base lg:text-lg flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-purple-500" />
                Drops / Eventos de Descuento
              </CardTitle>
              <CardDescription>Eventos temporales con descuento global para productos seleccionados</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchDrops} disabled={isLoadingDrops}>
                <RefreshCw className={`h-4 w-4 ${isLoadingDrops ? 'animate-spin' : ''}`} />
              </Button>
              <Button size="sm" onClick={openCreateDrop} className="gap-1">
                <Plus className="h-4 w-4" /> Nuevo Drop
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingDrops ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : drops.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <CalendarDays className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">No hay drops creados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {drops.map((drop) => {
                const now = new Date()
                const start = new Date(drop.startsAt)
                const end = new Date(drop.endsAt)
                const isLive = drop.isActive && now >= start && now <= end
                const isPast = now > end
                return (
                  <div key={drop.id} className="flex items-center gap-4 p-4 border border-border rounded-lg bg-background">
                    {drop.bannerUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={drop.bannerUrl} alt={drop.name} className="w-16 h-12 rounded object-cover shrink-0 border border-border" />
                    ) : (
                      <div className="w-16 h-12 rounded bg-secondary flex items-center justify-center shrink-0">
                        <CalendarDays className="h-5 w-5 text-muted-foreground/50" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{drop.name}</p>
                        {isLive && <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-green-500/15 text-green-500 border border-green-500/20">EN VIVO</span>}
                        {isPast && <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-muted text-muted-foreground">FINALIZADO</span>}
                        {!drop.isActive && !isPast && <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-yellow-500/15 text-yellow-500 border border-yellow-500/20">INACTIVO</span>}
                      </div>
                      {drop.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{drop.description}</p>}
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs text-purple-400 font-medium">{drop.globalDiscount}% descuento</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(drop.startsAt).toLocaleDateString('es-CO')} → {new Date(drop.endsAt).toLocaleDateString('es-CO')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDrop(drop)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70 hover:text-destructive" onClick={() => setDeletingDropId(drop.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Crear/Editar Drop */}
      <Dialog open={isDropDialogOpen} onOpenChange={setIsDropDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-purple-500" />
              {editingDrop ? 'Editar Drop' : 'Nuevo Drop'}
            </DialogTitle>
            <DialogDescription>Configura un evento de descuento temporal para la plataforma</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre <span className="text-destructive">*</span></Label>
              <Input placeholder="Ej: Black Friday" value={dropForm.name} onChange={(e) => setDropForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input placeholder="Descripción opcional" value={dropForm.description} onChange={(e) => setDropForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>URL del banner</Label>
              <Input placeholder="https://..." value={dropForm.bannerUrl} onChange={(e) => setDropForm(f => ({ ...f, bannerUrl: e.target.value }))} className="font-mono text-sm" />
            </div>
            <div className="space-y-2">
              <Label>Descuento global (%)</Label>
              <Input type="number" min={0} max={100}
                value={dropForm.globalDiscount}
                onChange={(e) => setDropForm(f => ({ ...f, globalDiscount: Number(e.target.value) }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Fecha inicio <span className="text-destructive">*</span></Label>
                <Input type="datetime-local" value={dropForm.startsAt} onChange={(e) => setDropForm(f => ({ ...f, startsAt: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Fecha fin <span className="text-destructive">*</span></Label>
                <Input type="datetime-local" value={dropForm.endsAt} onChange={(e) => setDropForm(f => ({ ...f, endsAt: e.target.value }))} />
              </div>
            </div>
            <div
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                dropForm.isActive ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'
              }`}
              onClick={() => setDropForm(f => ({ ...f, isActive: !f.isActive }))}
            >
              <div className={`w-5 h-5 rounded flex items-center justify-center border-2 flex-shrink-0 transition-colors ${
                dropForm.isActive ? 'border-primary bg-primary' : 'border-muted-foreground'
              }`}>
                {dropForm.isActive && <span className="text-white text-xs font-bold">✓</span>}
              </div>
              <div>
                <p className="text-sm font-medium">Activo</p>
                <p className="text-xs text-muted-foreground">El drop se mostrará cuando esté en rango de fechas</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDropDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveDrop} disabled={isSavingDrop}>
              {isSavingDrop ? 'Guardando...' : editingDrop ? 'Guardar cambios' : 'Crear Drop'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar eliminación de Drop */}
      <Dialog open={deletingDropId !== null} onOpenChange={(open) => { if (!open) setDeletingDropId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Eliminar Drop
            </DialogTitle>
            <DialogDescription>¿Estás seguro? Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeletingDropId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deletingDropId !== null && handleDeleteDrop(deletingDropId)}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
