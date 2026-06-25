'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, RefreshCw, UserCog, Check, Ban, KeyRound, X } from 'lucide-react'

interface FoundUser {
  id: string
  email: string
  name: string
  role: string
  authProvider?: string | null
  isActive?: number | boolean
  tenantId?: string | null
  tenantName?: string | null
}

// Roles que tiene sentido asignar desde aquí (los más comunes para corregir cuentas).
const ROLE_OPTIONS = [
  { value: 'cliente', label: 'Cliente (usuario del OS)' },
  { value: 'comerciante', label: 'Comerciante' },
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'repartidor', label: 'Repartidor' },
  { value: 'auxiliar_bodega', label: 'Auxiliar de bodega' },
  { value: 'mesero', label: 'Mesero' },
  { value: 'cajero', label: 'Cajero' },
  { value: 'cocinero', label: 'Cocinero' },
  { value: 'administrador_rb', label: 'Admin restaurante' },
  { value: 'comunidad_admin', label: 'Admin comunidad' },
]
const roleLabel = (r: string) => ROLE_OPTIONS.find(o => o.value === r)?.label || r

export function UsersRolesTab() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<FoundUser[]>([])
  const [pick, setPick] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [pwFor, setPwFor] = useState<string | null>(null)
  const [pwValue, setPwValue] = useState('')

  const search = async () => {
    const q = query.trim()
    if (q.length < 3) { toast.error('Escribe al menos 3 letras del correo'); return }
    setLoading(true); setSearched(true)
    const r = await api.superadminFindUsers(q)
    if (r.success && Array.isArray(r.data)) {
      setUsers(r.data as FoundUser[])
      setPick(Object.fromEntries((r.data as FoundUser[]).map(u => [u.id, u.role])))
    } else {
      toast.error(r.error || 'No se pudo buscar')
      setUsers([])
    }
    setLoading(false)
  }

  const save = async (u: FoundUser) => {
    const role = pick[u.id]
    if (!role || role === u.role) return
    setSavingId(u.id)
    const r = await api.superadminSetUserRole(u.id, role)
    if (r.success) {
      toast.success(`${u.email} → ${roleLabel(role)}`)
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role, tenantName: role === 'cliente' ? null : x.tenantName, tenantId: role === 'cliente' ? null : x.tenantId } : x))
    } else {
      toast.error(r.error || 'No se pudo actualizar el rol')
    }
    setSavingId(null)
  }

  const toggleActive = async (u: FoundUser) => {
    const next = !(u.isActive === 1 || u.isActive === true)
    setBusyId(u.id)
    const r = await api.superadminSetUserActive(u.id, next)
    if (r.success) {
      toast.success(next ? 'Cuenta activada' : 'Cuenta suspendida')
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isActive: next ? 1 : 0 } : x))
    } else {
      toast.error(r.error || 'No se pudo cambiar el estado')
    }
    setBusyId(null)
  }

  const applyPassword = async (u: FoundUser) => {
    if (pwValue.trim().length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return }
    setBusyId(u.id)
    const r = await api.resetUserPassword(u.id, pwValue.trim())
    if (r.success) { toast.success('Contraseña restablecida'); setPwFor(null); setPwValue('') }
    else toast.error(r.error || 'No se pudo restablecer la contraseña')
    setBusyId(null)
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <UserCog className="h-5 w-5 text-muted-foreground" />
          Usuarios y roles
        </CardTitle>
        <CardDescription>
          Busca un usuario por su correo y cámbiale el rol. Útil para corregir cuentas que quedaron
          como vendedor y deberían ser cliente del OS (al pasar a cliente se le quita el comercio asociado).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="correo del usuario (ej: juan@gmail.com)"
              className="pl-9"
            />
          </div>
          <Button onClick={search} disabled={loading} className="gap-2">
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar
          </Button>
        </div>

        {searched && !loading && users.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No se encontraron usuarios con ese correo.</p>
        )}

        <div className="space-y-2">
          {users.map(u => {
            const changed = pick[u.id] && pick[u.id] !== u.role
            const active = u.isActive === 1 || u.isActive === true
            return (
              <div key={u.id} className="rounded-lg border border-border bg-secondary/20 p-3 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate flex items-center gap-2">
                      {u.name || '(sin nombre)'}
                      {!active && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive font-semibold">Suspendido</span>}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{roleLabel(u.role)}</span>
                      {u.authProvider === 'google' && <span className="text-[10px] text-muted-foreground">· Google</span>}
                      {u.tenantName && <span className="text-[10px] text-muted-foreground">· {u.tenantName}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={pick[u.id] ?? u.role}
                      onChange={e => setPick(prev => ({ ...prev, [u.id]: e.target.value }))}
                      className="rounded-md border border-border bg-background px-2 py-2 text-sm"
                    >
                      {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      {!ROLE_OPTIONS.some(o => o.value === u.role) && <option value={u.role}>{u.role}</option>}
                    </select>
                    <Button size="sm" onClick={() => save(u)} disabled={!changed || savingId === u.id} className="gap-1.5">
                      {savingId === u.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Guardar
                    </Button>
                  </div>
                </div>

                {/* Acciones extra: suspender/activar + resetear contraseña */}
                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2.5">
                  <Button size="sm" variant="outline" onClick={() => toggleActive(u)} disabled={busyId === u.id} className="gap-1.5">
                    <Ban className="h-3.5 w-3.5" />
                    {active ? 'Suspender' : 'Activar'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setPwFor(pwFor === u.id ? null : u.id); setPwValue('') }} className="gap-1.5">
                    <KeyRound className="h-3.5 w-3.5" />
                    Resetear contraseña
                  </Button>
                  {pwFor === u.id && (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Input
                        type="text"
                        value={pwValue}
                        onChange={e => setPwValue(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && applyPassword(u)}
                        placeholder="Nueva contraseña (mín. 6)"
                        className="h-9 w-full sm:w-56"
                      />
                      <Button size="sm" onClick={() => applyPassword(u)} disabled={busyId === u.id} className="gap-1.5">
                        {busyId === u.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Aplicar
                      </Button>
                      <button onClick={() => { setPwFor(null); setPwValue('') }} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
