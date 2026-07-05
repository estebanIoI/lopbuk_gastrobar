'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import type { CustomerFull } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Users,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  CreditCard,
  FileText,
  IdCard,
  Download,
  ShieldAlert,
  ShieldCheck,
  Clock,
} from 'lucide-react'

interface PrivacyRequest {
  id: string
  requestType: 'access' | 'rectify' | 'erase' | 'revoke_consent'
  status: 'pending' | 'in_progress' | 'completed' | 'denied'
  identifier: string
  requesterName: string
  verificationMethod: string | null
  details: string | null
  requestedAt: string
  dueAt: string | null
  notes: string | null
}

const REQUEST_TYPE_LABEL: Record<PrivacyRequest['requestType'], string> = {
  access: 'Acceso a datos',
  rectify: 'Rectificación',
  erase: 'Supresión (olvido)',
  revoke_consent: 'Revocar autorización',
}

const REQUEST_STATUS_LABEL: Record<PrivacyRequest['status'], string> = {
  pending: 'Pendiente',
  in_progress: 'En proceso',
  completed: 'Completada',
  denied: 'Denegada',
}

/** Días calendario restantes hasta el vencimiento del SLA (10 días hábiles Ley 1581). */
function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (24 * 60 * 60 * 1000))
}

interface CustomerFormData {
  cedula: string
  name: string
  phone: string
  email: string
  address: string
  creditLimit: string
  notes: string
}

const emptyCustomer: CustomerFormData = {
  cedula: '',
  name: '',
  phone: '',
  email: '',
  address: '',
  creditLimit: '',
  notes: '',
}

export function Customers() {
  const [customers, setCustomers] = useState<CustomerFull[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<CustomerFull | null>(null)
  const [customerToDelete, setCustomerToDelete] = useState<CustomerFull | null>(null)
  const [formData, setFormData] = useState<CustomerFormData>(emptyCustomer)
  const [isSaving, setIsSaving] = useState(false)
  // Habeas data (Ley 1581): borrado definitivo por anonimización + solicitudes de titulares
  const [customerToErase, setCustomerToErase] = useState<CustomerFull | null>(null)
  const [isErasing, setIsErasing] = useState(false)
  const [privacyRequests, setPrivacyRequests] = useState<PrivacyRequest[]>([])
  const [showRequests, setShowRequests] = useState(false)

  useEffect(() => {
    fetchCustomers()
    fetchPrivacyRequests()
  }, [])

  const fetchPrivacyRequests = async () => {
    const result = await api.getPrivacyRequests()
    if (result.success && Array.isArray(result.data)) {
      setPrivacyRequests(result.data)
    }
  }

  const handleExport = async (customer: CustomerFull) => {
    const result = await api.exportCustomerData(customer.id)
    if (result.success && result.data) {
      // Descarga como JSON (derecho de acceso, Ley 1581 art. 8)
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `datos-cliente-${customer.cedula || customer.id}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const handleErase = async () => {
    if (!customerToErase) return
    setIsErasing(true)
    const result = await api.eraseCustomerData(customerToErase.id)
    setIsErasing(false)
    if (result.success) {
      await fetchCustomers()
      setCustomerToErase(null)
    } else {
      alert(result.error || 'No se pudo anonimizar el cliente')
    }
  }

  const handleRequestAction = async (id: string, status: 'in_progress' | 'completed' | 'denied') => {
    const result = await api.updatePrivacyRequest(id, { status })
    if (result.success) await fetchPrivacyRequests()
  }

  const openRequestsCount = privacyRequests.filter(r => r.status === 'pending' || r.status === 'in_progress').length

  const fetchCustomers = async () => {
    setIsLoading(true)
    const result = await api.getCustomers({ limit: 100 })
    if (result.success && result.data) {
      setCustomers(result.data.customers || result.data || [])
    }
    setIsLoading(false)
  }

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone && c.phone.includes(search)) ||
    (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
    (c.cedula && c.cedula.includes(search))
  )

  const handleOpenNew = () => {
    setEditingCustomer(null)
    setFormData(emptyCustomer)
    setIsFormOpen(true)
  }

  const handleOpenEdit = (customer: CustomerFull) => {
    setEditingCustomer(customer)
    setFormData({
      cedula: customer.cedula || '',
      name: customer.name,
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      creditLimit: customer.creditLimit ? String(customer.creditLimit) : '',
      notes: customer.notes || '',
    })
    setIsFormOpen(true)
  }

  const handleOpenDelete = (customer: CustomerFull) => {
    setCustomerToDelete(customer)
    setIsDeleteOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name || !formData.cedula) return
    setIsSaving(true)

    const payload = {
      ...formData,
      creditLimit: formData.creditLimit ? parseFloat(formData.creditLimit) : 0,
    }

    if (editingCustomer) {
      const result = await api.updateCustomer(editingCustomer.id, payload)
      if (result.success) {
        await fetchCustomers()
        setIsFormOpen(false)
      }
    } else {
      const result = await api.createCustomer(payload)
      if (result.success) {
        await fetchCustomers()
        setIsFormOpen(false)
      }
    }
    setIsSaving(false)
  }

  const handleDelete = async () => {
    if (!customerToDelete) return
    const result = await api.deleteCustomer(customerToDelete.id)
    if (result.success) {
      await fetchCustomers()
      setIsDeleteOpen(false)
      setCustomerToDelete(null)
    }
  }

  const totalDebt = customers.reduce((sum, c) => sum + (c.balance || 0), 0)
  const customersWithDebt = customers.filter(c => (c.balance || 0) > 0).length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-muted-foreground">Gestión de clientes y saldos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowRequests(v => !v)}>
            <ShieldCheck className="h-4 w-4 mr-2" />
            Solicitudes de datos
            {openRequestsCount > 0 && (
              <Badge variant="destructive" className="ml-2">{openRequestsCount}</Badge>
            )}
          </Button>
          <Button data-tour="cli-new" onClick={handleOpenNew}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Cliente
          </Button>
        </div>
      </div>

      {/* Solicitudes de titulares (Ley 1581 — SLA 10 días hábiles) */}
      {showRequests && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Solicitudes de protección de datos
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Por Ley 1581 de 2012 debes responder cada solicitud en máximo 10 días hábiles.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {privacyRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No hay solicitudes registradas</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Solicitante</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="hidden md:table-cell">Contacto</TableHead>
                      <TableHead>Vence</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {privacyRequests.map((r) => {
                      const days = daysUntil(r.dueAt)
                      const overdue = days !== null && days < 0 && (r.status === 'pending' || r.status === 'in_progress')
                      return (
                        <TableRow key={r.id}>
                          <TableCell>
                            <p className="font-medium">{r.requesterName}</p>
                            <p className="text-xs text-muted-foreground">
                              {r.verificationMethod === 'phone_name_match' ? '✓ Identidad verificada' : '⚠ Sin verificar'}
                            </p>
                          </TableCell>
                          <TableCell>{REQUEST_TYPE_LABEL[r.requestType]}</TableCell>
                          <TableCell className="hidden md:table-cell">{r.identifier}</TableCell>
                          <TableCell>
                            {r.status === 'completed' || r.status === 'denied' ? (
                              '—'
                            ) : (
                              <span className={`flex items-center gap-1 text-xs ${overdue ? 'text-destructive font-semibold' : ''}`}>
                                <Clock className="h-3 w-3" />
                                {days === null ? '—' : overdue ? `Vencida hace ${Math.abs(days)} d` : `${days} días`}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={r.status === 'completed' ? 'outline' : r.status === 'denied' ? 'secondary' : overdue ? 'destructive' : 'default'}>
                              {REQUEST_STATUS_LABEL[r.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {(r.status === 'pending' || r.status === 'in_progress') && (
                              <div className="flex items-center justify-end gap-1">
                                {r.status === 'pending' && (
                                  <Button variant="ghost" size="sm" onClick={() => handleRequestAction(r.id, 'in_progress')}>
                                    Atender
                                  </Button>
                                )}
                                <Button variant="ghost" size="sm" className="text-green-600" onClick={() => handleRequestAction(r.id, 'completed')}>
                                  Completar
                                </Button>
                                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleRequestAction(r.id, 'denied')}>
                                  Denegar
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3" data-tour="cli-stats">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes con Saldo</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customersWithDebt}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total por Cobrar</CardTitle>
            <DollarSign className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatCOP(totalDebt)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative" data-tour="cli-search">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cédula, nombre, teléfono o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Cargando clientes...</p>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No se encontraron clientes</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="hidden sm:table-cell">Cédula</TableHead>
                    <TableHead className="hidden md:table-cell">Teléfono</TableHead>
                    <TableHead className="hidden lg:table-cell">Límite Crédito</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{customer.name}</p>
                            <p className="text-xs text-muted-foreground sm:hidden">
                              CC: {customer.cedula}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          <IdCard className="h-3 w-3 text-muted-foreground" />
                          {customer.cedula}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {customer.phone || '-'}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {customer.creditLimit > 0 ? formatCOP(customer.creditLimit) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {customer.balance > 0 ? (
                          <Badge variant="destructive">
                            {formatCOP(customer.balance)}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-600">
                            Sin saldo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Exportar datos (derecho de acceso)"
                            onClick={() => handleExport(customer)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(customer)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Desactivar cliente"
                            onClick={() => handleOpenDelete(customer)}
                            disabled={customer.balance > 0}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Borrado definitivo (habeas data)"
                            className="text-destructive"
                            onClick={() => setCustomerToErase(customer)}
                            disabled={customer.balance > 0}
                          >
                            <ShieldAlert className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}
            </DialogTitle>
            <DialogDescription>
              {editingCustomer
                ? 'Modifique los datos del cliente.'
                : 'Complete los datos del nuevo cliente.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Cédula <span className="text-destructive">*</span></Label>
              <div className="relative">
                <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Número de cédula"
                  value={formData.cedula}
                  onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nombre <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Nombre completo"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Número de teléfono"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Dirección</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Dirección (opcional)"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Límite de Crédito</Label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="0"
                  min="0"
                  value={formData.creditLimit}
                  onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Textarea
                  placeholder="Observaciones sobre el cliente (opcional)"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="pl-10 min-h-[80px]"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!formData.name || !formData.cedula || isSaving}>
              {isSaving ? 'Guardando...' : editingCustomer ? 'Guardar Cambios' : 'Crear Cliente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation (soft delete: desactiva sin borrar datos) */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              El cliente <strong>{customerToDelete?.name}</strong> dejará de aparecer en el sistema,
              pero sus datos y su historial de ventas se conservan. Si el cliente pidió que borres
              sus datos personales, usa el <strong>borrado definitivo (habeas data)</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Borrado definitivo — anonimización irreversible (Ley 1581, derecho al olvido) */}
      <AlertDialog open={!!customerToErase} onOpenChange={(open) => { if (!open) setCustomerToErase(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Borrado definitivo de datos personales
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Vas a ejercer el <strong>derecho al olvido</strong> (Ley 1581 de 2012) sobre{' '}
                  <strong>{customerToErase?.name}</strong>. Esta acción es <strong>irreversible</strong>:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Se eliminan de forma permanente: nombre, cédula, teléfono, email, dirección, ubicación GPS, notas y conversaciones de chat.</li>
                  <li>Se conservan los montos de ventas y pedidos (obligación contable/fiscal), ya anonimizados.</li>
                  <li>Queda registro del borrado en el log de auditoría como prueba de cumplimiento.</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isErasing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleErase() }}
              disabled={isErasing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isErasing ? 'Anonimizando…' : 'Borrar definitivamente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
