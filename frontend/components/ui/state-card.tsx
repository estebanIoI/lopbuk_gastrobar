'use client'
import { Loader2, PackageOpen, AlertTriangle, type LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function LoadingCard({ className, text = 'Cargando...' }: { className?: string; text?: string }) {
  return (
    <Card variant="glass" className={cn("p-8 flex flex-col items-center justify-center gap-3 min-h-[200px]", className)}>
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </Card>
  )
}

export function EmptyStateCard({ className, icon: Icon = PackageOpen, title = 'Sin datos', description = 'No hay elementos para mostrar' }: { className?: string; icon?: LucideIcon; title?: string; description?: string }) {
  return (
    <Card variant="glass" className={cn("p-8 flex flex-col items-center justify-center gap-3 min-h-[200px]", className)}>
      <Icon className="h-12 w-12 text-muted-foreground/40" />
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="text-xs text-muted-foreground/60">{description}</p>
    </Card>
  )
}

export function ErrorCard({ className, title = 'Error', description = 'Algo salió mal', onRetry }: { className?: string; title?: string; description?: string; onRetry?: () => void }) {
  return (
    <Card variant="glass" className={cn("p-8 flex flex-col items-center justify-center gap-3 min-h-[200px]", className)}>
      <AlertTriangle className="h-10 w-10 text-destructive/60" />
      <p className="text-sm font-medium text-destructive">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 text-xs font-medium text-primary hover:underline">
          Reintentar
        </button>
      )}
    </Card>
  )
}
