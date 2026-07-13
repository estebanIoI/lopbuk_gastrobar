'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  GripVertical, Plus, X, Settings, Eye, EyeOff, Monitor, Smartphone,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, MoveVertical,
  Layout, Grid3X3, Package, UtensilsCrossed, Star, Tags, Shield, Mail,
  AlignLeft, Filter,
  Save, Loader2
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

import { SectionEditorHero } from './sections/SectionEditorHero'
import { SectionEditorCategoryGrid } from './sections/SectionEditorCategoryGrid'
import { SectionEditorCategoryStrip } from './sections/SectionEditorCategoryStrip'
import { SectionEditorProductGrid } from './sections/SectionEditorProductGrid'
import { SectionEditorRecipeGrid } from './sections/SectionEditorRecipeGrid'
import { SectionEditorBrandChips } from './sections/SectionEditorBrandChips'
import { SectionEditorTrustBadges } from './sections/SectionEditorTrustBadges'
import { SectionEditorNewsletter } from './sections/SectionEditorNewsletter'
import { SectionEditorFooter } from './sections/SectionEditorFooter'
import { SectionEditorPillRow } from './sections/SectionEditorPillRow'

interface HomepageSection {
  id: string
  type: 'hero' | 'categoryGrid' | 'categoryStrip' | 'productGrid' | 'recipeGrid' | 'brandChips' | 'trustBadges' | 'newsletter' | 'footer' | 'pillRow'
  title: string
  icon: string
  enabled: boolean
  sortOrder: number
  config: Record<string, any>
}

const DEFAULT_SECTIONS: HomepageSection[] = [
  { id: 'hero', type: 'hero', title: 'Hero / Banner Principal', icon: 'Layout', enabled: true, sortOrder: 1, config: {} },
  { id: 'categoryStrip', type: 'categoryStrip', title: 'Barra de Categorías', icon: 'AlignLeft', enabled: true, sortOrder: 2, config: {} },
  { id: 'categoryGrid', type: 'categoryGrid', title: 'Categorías (Grid)', icon: 'Grid3X3', enabled: true, sortOrder: 3, config: {} },
  { id: 'productGrid1', type: 'productGrid', title: 'Productos Destacados', icon: 'Package', enabled: true, sortOrder: 4, config: {} },
  { id: 'recipeGrid', type: 'recipeGrid', title: 'Recetas', icon: 'UtensilsCrossed', enabled: true, sortOrder: 5, config: {} },
  { id: 'productGrid2', type: 'productGrid', title: 'Top 100 Productos', icon: 'Star', enabled: true, sortOrder: 6, config: {} },
  { id: 'pillRow', type: 'pillRow', title: 'Pills + Productos', icon: 'Filter', enabled: false, sortOrder: 7, config: {} },
  { id: 'brandChips', type: 'brandChips', title: 'Marcas', icon: 'Tags', enabled: true, sortOrder: 8, config: {} },
  { id: 'trustBadges', type: 'trustBadges', title: 'Confianza / Beneficios', icon: 'Shield', enabled: true, sortOrder: 9, config: {} },
  { id: 'newsletter', type: 'newsletter', title: 'Newsletter', icon: 'Mail', enabled: true, sortOrder: 10, config: {} },
  { id: 'footer', type: 'footer', title: 'Footer', icon: 'Layout', enabled: true, sortOrder: 11, config: {} },
]

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Layout,
  AlignLeft,
  Grid3X3,
  Package,
  UtensilsCrossed,
  Star,
  Filter,
  Tags,
  Shield,
  Mail,
}

const SECTION_EDITORS: Record<string, React.ComponentType<any>> = {
  hero: SectionEditorHero,
  categoryStrip: SectionEditorCategoryStrip,
  categoryGrid: SectionEditorCategoryGrid,
  productGrid: SectionEditorProductGrid,
  recipeGrid: SectionEditorRecipeGrid,
  brandChips: SectionEditorBrandChips,
  trustBadges: SectionEditorTrustBadges,
  newsletter: SectionEditorNewsletter,
  footer: SectionEditorFooter,
  pillRow: SectionEditorPillRow,
}

function getPlaceholderColor(type: HomepageSection['type']): string {
  switch (type) {
    case 'hero': return 'bg-primary/10 border-primary/20 h-32'
    case 'categoryGrid': return 'bg-emerald-500/10 border-emerald-500/20 h-48'
    case 'productGrid': return 'bg-amber-500/10 border-amber-500/20 h-40'
    case 'recipeGrid': return 'bg-orange-500/10 border-orange-500/20 h-36'
    case 'categoryStrip': return 'bg-blue-500/10 border-blue-500/20 h-20'
    case 'brandChips': return 'bg-violet-500/10 border-violet-500/20 h-16'
    case 'trustBadges': return 'bg-teal-500/10 border-teal-500/20 h-24'
    case 'newsletter': return 'bg-rose-500/10 border-rose-500/20 h-28'
    case 'footer': return 'bg-slate-500/10 border-slate-500/20 h-12'
    case 'pillRow': return 'bg-cyan-500/10 border-cyan-500/20 h-12'
    default: return 'bg-muted/50 border-border/50 h-24'
  }
}

export function PageBuilder() {
  const [sections, setSections] = useState<HomepageSection[]>(DEFAULT_SECTIONS)
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState<'mobile' | 'desktop'>('desktop')
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    api.getHomepageConfig().then(res => {
      if (res.success && res.data?.sections?.length > 0) {
        const mapped = res.data.sections.map((s: any) => ({
          ...s,
          type: s.sectionType || s.type,
        }))
        setSections(mapped)
      }
    }).catch(() => {}).finally(() => setLoaded(true))
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const toSave = sections.map(s => ({
        id: s.id,
        sectionType: s.type,
        title: s.title,
        enabled: s.enabled,
        config: s.config,
        sortOrder: s.sortOrder,
      }))
      const res = await api.saveHomepageConfig(toSave)
      if (res.success) alert('Página guardada correctamente')
    } catch { alert('Error al guardar') }
    finally { setSaving(false) }
  }, [sections])

  const selectedSection = sections.find(s => s.id === selectedSectionId)

  const handleMoveUp = useCallback((id: string) => {
    setSections(prev => {
      const index = prev.findIndex(s => s.id === id)
      if (index <= 0) return prev
      const next = [...prev]
      ;[next[index], next[index - 1]] = [next[index - 1], next[index]]
      return next.map((s, i) => ({ ...s, sortOrder: i + 1 }))
    })
  }, [])

  const handleMoveDown = useCallback((id: string) => {
    setSections(prev => {
      const index = prev.findIndex(s => s.id === id)
      if (index < 0 || index >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      return next.map((s, i) => ({ ...s, sortOrder: i + 1 }))
    })
  }, [])

  const handleToggleEnabled = useCallback((id: string) => {
    setSections(prev =>
      prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s)
    )
  }, [])

  const handleSelectSection = useCallback((id: string) => {
    setSelectedSectionId(prev => prev === id ? null : id)
  }, [])

  const handleUpdateSectionConfig = useCallback((id: string, config: Record<string, any>) => {
    setSections(prev =>
      prev.map(s => s.id === id ? { ...s, config } : s)
    )
  }, [])

  const EditorComponent = selectedSection
    ? SECTION_EDITORS[selectedSection.type] ?? null
    : null

  const sortedSections = [...sections].sort((a, b) => a.sortOrder - b.sortOrder)
  const visibleSections = sortedSections.filter(s => s.enabled)

  return (
    <div className="flex gap-4 h-[calc(100vh-12rem)]">
      {/* LEFT — Section list */}
      <div className="w-[280px] shrink-0 glass rounded-xl p-4 overflow-y-auto glass-scroll flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-sm text-muted-foreground">Secciones</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="h-7 text-xs gap-1"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            {saving ? 'Guardando' : 'Guardar'}
          </Button>
        </div>
        <div className="space-y-1 flex-1">
          {sortedSections.map((section) => {
            const IconComponent = ICON_MAP[section.icon]
            return (
              <div
                key={section.id}
                className={cn(
                  'flex items-center gap-2 px-2 py-2 rounded-lg text-sm group transition-colors',
                  selectedSectionId === section.id
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-accent/50 text-foreground',
                  !section.enabled && 'opacity-50'
                )}
              >
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground opacity-40 group-hover:opacity-100 cursor-grab shrink-0" />
                {IconComponent && <IconComponent className="h-3.5 w-3.5 shrink-0" />}
                <span className="flex-1 truncate">{section.title}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleMoveUp(section.id)}
                    className="p-0.5 rounded hover:bg-accent"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleMoveDown(section.id)}
                    className="p-0.5 rounded hover:bg-accent"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleToggleEnabled(section.id)}
                    className="p-0.5 rounded hover:bg-accent"
                  >
                    {section.enabled ? (
                      <Eye className="h-3 w-3" />
                    ) : (
                      <EyeOff className="h-3 w-3 text-muted-foreground" />
                    )}
                  </button>
                  <button
                    onClick={() => handleSelectSection(section.id)}
                    className={cn(
                      'p-0.5 rounded hover:bg-accent',
                      selectedSectionId === section.id && 'text-primary'
                    )}
                  >
                    <Settings className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        <Button variant="outline" size="sm" className="w-full mt-3">
          <Plus className="h-3.5 w-3.5" />
          Agregar sección
        </Button>
      </div>

      {/* CENTER — Preview */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-sm text-muted-foreground">Vista previa</h3>
          <div className="flex gap-1 glass rounded-lg p-0.5">
            <button
              onClick={() => setPreviewMode('mobile')}
              className={cn('p-1.5 rounded-md', previewMode === 'mobile' && 'bg-background shadow-sm')}
            >
              <Smartphone className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPreviewMode('desktop')}
              className={cn('p-1.5 rounded-md', previewMode === 'desktop' && 'bg-background shadow-sm')}
            >
              <Monitor className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div
          className={cn(
            'glass rounded-xl p-4 flex-1 overflow-y-auto mx-auto transition-all duration-300',
            previewMode === 'mobile' ? 'w-[375px]' : 'w-full'
          )}
        >
          <div className="space-y-3">
            {visibleSections.map((section) => (
              <div
                key={section.id}
                className={cn(
                  'rounded-lg p-4 border text-center text-sm text-muted-foreground',
                  getPlaceholderColor(section.type)
                )}
              >
                {section.title}
              </div>
            ))}
            {visibleSections.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-12">
                No hay secciones visibles
              </p>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT — Settings panel */}
      {selectedSection && (
        <div className="w-[360px] shrink-0 glass-strong rounded-xl overflow-y-auto transition-transform duration-300">
          <div className="flex items-center justify-between p-4 border-b border-border/50">
            <h3 className="font-medium text-sm">{selectedSection.title}</h3>
            <Button variant="ghost" size="icon-xs" onClick={() => setSelectedSectionId(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-4">
            {EditorComponent ? (
              <EditorComponent
                section={selectedSection}
                onChange={(config: Record<string, any>) =>
                  handleUpdateSectionConfig(selectedSection.id, config)
                }
                saving={saving}
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Configuración no disponible para este tipo de sección.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
