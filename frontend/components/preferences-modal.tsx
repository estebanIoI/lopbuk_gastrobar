'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Sun,
  Moon,
  Monitor,
  Bell,
  BellOff,
  Palette,
  LayoutDashboard,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const THEME_OPTIONS = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
]

const DENSITY_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'compact', label: 'Compacto' },
]

const PREFS_KEY = 'lopbuk-preferences'

function loadPrefs() {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')
  } catch { return {} }
}

function savePrefs(prefs: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  const existing = loadPrefs()
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...existing, ...prefs }))
}

interface Props {
  open: boolean
  onClose: () => void
}

export function PreferencesModal({ open, onClose }: Props) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [density, setDensity] = useState('normal')
  const [stockAlerts, setStockAlerts] = useState(true)
  const [orderAlerts, setOrderAlerts] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!open) return
    const prefs = loadPrefs()
    if (prefs.density) setDensity(prefs.density as string)
    if (prefs.stockAlerts !== undefined) setStockAlerts(!!prefs.stockAlerts)
    if (prefs.orderAlerts !== undefined) setOrderAlerts(!!prefs.orderAlerts)
    if (prefs.soundEnabled !== undefined) setSoundEnabled(!!prefs.soundEnabled)
  }, [open])

  const handleSave = () => {
    savePrefs({ density, stockAlerts, orderAlerts, soundEnabled })
    // Apply density class to root
    if (density === 'compact') {
      document.documentElement.classList.add('density-compact')
    } else {
      document.documentElement.classList.remove('density-compact')
    }
    toast.success('Preferencias guardadas')
    onClose()
  }

  if (!mounted) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Preferencias</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">

          {/* Theme */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-semibold">Tema de la aplicación</Label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-lg border p-3 text-sm transition-all',
                    theme === value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Density */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-semibold">Densidad de la interfaz</Label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DENSITY_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setDensity(value)}
                  className={cn(
                    'rounded-lg border p-3 text-sm font-medium transition-all',
                    density === value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-semibold">Notificaciones</Label>
            </div>
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Alertas de stock</p>
                  <p className="text-xs text-muted-foreground">Productos agotados y stock bajo</p>
                </div>
                <Switch checked={stockAlerts} onCheckedChange={setStockAlerts} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Alertas de pedidos</p>
                  <p className="text-xs text-muted-foreground">Nuevos pedidos pendientes</p>
                </div>
                <Switch checked={orderAlerts} onCheckedChange={setOrderAlerts} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {soundEnabled
                    ? <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                    : <BellOff className="h-3.5 w-3.5 text-muted-foreground" />}
                  <div>
                    <p className="text-sm font-medium">Sonidos</p>
                    <p className="text-xs text-muted-foreground">Efectos de sonido al recibir alertas</p>
                  </div>
                </div>
                <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} />
              </div>
            </div>
          </div>

        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Guardar preferencias</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
