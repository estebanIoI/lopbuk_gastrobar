'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { useStore } from '@/lib/store'
import { useAuthStore } from '@/lib/auth-store'
import { api } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Store,
  User,
  Users,
  Shield,
  Bell,
  Database,
  Save,
  Trash2,
  Download,
  Upload,
  Check,
  AlertTriangle,
  Plus,
  Key,
  Loader2,
  Sun,
  Moon,
  Plug,
  Eye,
  EyeOff,
  ExternalLink,
  Briefcase,
  X,
} from 'lucide-react'

export function Settings() {
  const { storeInfo, updateStoreInfo, products, sales } = useStore()
  const { user, logout, updateProfile } = useAuthStore()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { setMounted(true) }, [])
  const [showResetDialog, setShowResetDialog] = useState(false)

  // ── Cloudinary integration state ──────────────────────────────────────────
  const [cloudinaryForm, setCloudinaryForm] = useState({
    cloudName: '',
    uploadPreset: '',
  })
  const [showPreset, setShowPreset] = useState(false)

  const [cloudinaryMsg, setCloudinaryMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [cloudinaryLoaded, setCloudinaryLoaded] = useState(false)

  // Cargar credenciales guardadas (solo localStorage — son claves del lado cliente)
  useEffect(() => {
    if (cloudinaryLoaded) return
    setCloudinaryLoaded(true)
    setCloudinaryForm({
      cloudName: localStorage.getItem('cloudinary_cloud_name') || '',
      uploadPreset: localStorage.getItem('cloudinary_upload_preset') || '',
    })
  }, [cloudinaryLoaded])

  const handleSaveCloudinary = () => {
    if (!cloudinaryForm.cloudName.trim() || !cloudinaryForm.uploadPreset.trim()) {
      setCloudinaryMsg({ type: 'error', text: 'Completa ambos campos' })
      return
    }
    localStorage.setItem('cloudinary_cloud_name', cloudinaryForm.cloudName.trim())
    localStorage.setItem('cloudinary_upload_preset', cloudinaryForm.uploadPreset.trim())
    setCloudinaryMsg({ type: 'ok', text: 'Credenciales guardadas correctamente' })
    setTimeout(() => setCloudinaryMsg(null), 4000)
  }

  const handleClearCloudinary = () => {
    localStorage.removeItem('cloudinary_cloud_name')
    localStorage.removeItem('cloudinary_upload_preset')
    setCloudinaryForm({ cloudName: '', uploadPreset: '' })
    setCloudinaryMsg({ type: 'ok', text: 'Credenciales eliminadas' })
    setTimeout(() => setCloudinaryMsg(null), 3000)
  }
  // ─────────────────────────────────────────────────────────────────────────

  const [storeForm, setStoreForm] = useState({
    name: storeInfo.name,
    address: storeInfo.address,
    phone: storeInfo.phone,
    email: storeInfo.email,
    taxId: storeInfo.taxId
  })

  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || ''
  })

  // User management state (admin only)
  const isAdmin = user?.role === 'comerciante' || user?.role === 'superadmin'
  const [usersList, setUsersList] = useState<any[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [newUserForm, setNewUserForm] = useState({ name: '', email: '', password: '', role: 'vendedor', cargoId: '' })
  const [creatingUser, setCreatingUser] = useState(false)
  const [userError, setUserError] = useState('')
  const [userSuccess, setUserSuccess] = useState('')
  const [resetPasswordDialog, setResetPasswordDialog] = useState<{ open: boolean; userId: string; userName: string }>({ open: false, userId: '', userName: '' })
  const [newPassword, setNewPassword] = useState('')
  const [deleteUserDialog, setDeleteUserDialog] = useState<{ open: boolean; userId: string; userName: string }>({ open: false, userId: '', userName: '' })

  // Cargos state
  const [cargosList, setCargosList] = useState<any[]>([])
  const [newCargoName, setNewCargoName] = useState('')
  const [newCargoDesc, setNewCargoDesc] = useState('')
  const [creatingCargo, setCreatingCargo] = useState(false)
  const [cargoError, setCargoError] = useState('')

  const fetchCargos = async () => {
    const result = await api.getCargos()
    if (result.success && result.data) {
      setCargosList(Array.isArray(result.data) ? result.data : [])
    }
  }

  useEffect(() => {
    if (isAdmin) fetchCargos()
  }, [isAdmin])

  const handleCreateCargo = async () => {
    setCargoError('')
    if (!newCargoName.trim()) { setCargoError('El nombre del cargo es requerido'); return }
    setCreatingCargo(true)
    const result = await api.createCargo({ name: newCargoName.trim(), description: newCargoDesc.trim() || undefined })
    if (result.success) {
      setNewCargoName('')
      setNewCargoDesc('')
      fetchCargos()
    } else {
      setCargoError(result.error || 'Error al crear cargo')
    }
    setCreatingCargo(false)
  }

  const handleDeleteCargo = async (id: string) => {
    const result = await api.deleteCargo(id)
    if (result.success) {
      fetchCargos()
      if (newUserForm.cargoId === id) setNewUserForm(f => ({ ...f, cargoId: '' }))
    } else {
      setCargoError(result.error || 'Error al eliminar cargo')
    }
  }

  const fetchUsers = async () => {
    setLoadingUsers(true)
    const result = await api.getUsers({ limit: 50 })
    if (result.success && result.data) {
      const users = Array.isArray(result.data) ? result.data : (result.data as any).users || []
      setUsersList(users)
    }
    setLoadingUsers(false)
  }

  useEffect(() => {
    if (isAdmin) fetchUsers()
  }, [isAdmin])

  const handleCreateUser = async () => {
    setUserError('')
    setUserSuccess('')
    if (!newUserForm.name || !newUserForm.email || !newUserForm.password) {
      setUserError('Todos los campos son obligatorios')
      return
    }
    if (newUserForm.password.length < 6) {
      setUserError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setCreatingUser(true)
    const result = await api.createUser({ ...newUserForm, role: newUserForm.role as any, cargoId: newUserForm.cargoId || null })
    if (result.success) {
      setUserSuccess('Usuario creado exitosamente')
      setNewUserForm({ name: '', email: '', password: '', role: 'vendedor', cargoId: '' })
      fetchUsers()
    } else {
      setUserError(result.error || 'Error al crear usuario')
    }
    setCreatingUser(false)
    setTimeout(() => { setUserSuccess(''); setUserError('') }, 3000)
  }

  const handleDeleteUser = async () => {
    const result = await api.deleteUser(deleteUserDialog.userId)
    if (result.success) {
      setUserSuccess('Usuario eliminado')
      fetchUsers()
    } else {
      setUserError(result.error || 'Error al eliminar usuario')
    }
    setDeleteUserDialog({ open: false, userId: '', userName: '' })
    setTimeout(() => { setUserSuccess(''); setUserError('') }, 3000)
  }

  const handleResetPassword = async () => {
    if (newPassword.length < 6) {
      setUserError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    const result = await api.resetUserPassword(resetPasswordDialog.userId, newPassword)
    if (result.success) {
      setUserSuccess('Contraseña restablecida')
    } else {
      setUserError(result.error || 'Error al restablecer contraseña')
    }
    setResetPasswordDialog({ open: false, userId: '', userName: '' })
    setNewPassword('')
    setTimeout(() => { setUserSuccess(''); setUserError('') }, 3000)
  }

  const handleSaveStore = async () => {
    updateStoreInfo(storeForm)
    await api.updateStoreInfo(storeForm)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleSaveProfile = () => {
    if (user) {
      updateProfile({ name: profileForm.name })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  const handleExportData = () => {
    const data = {
      storeInfo,
      products,
      sales,
      exportDate: new Date().toISOString()
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lopbuk-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleResetData = () => {
    localStorage.removeItem('lopbuk-storage')
    localStorage.removeItem('lopbuk-auth')
    window.location.reload()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuración</h1>
        <p className="text-muted-foreground">
          Administra la configuración de tu tienda y cuenta
        </p>
      </div>

      <Tabs defaultValue="store" className="space-y-6">
        <TabsList className="bg-secondary">
          <TabsTrigger value="store" className="gap-2">
            <Store className="h-4 w-4" />
            Tienda
          </TabsTrigger>
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-2">
            <Database className="h-4 w-4" />
            Datos
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Usuarios
            </TabsTrigger>
          )}
        </TabsList>

        {/* Store Settings */}
        <TabsContent value="store">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" />
                Información de la Tienda
              </CardTitle>
              <CardDescription>
                Configura los datos que aparecerán en las facturas y documentos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="storeName">Nombre de la Tienda</Label>
                  <Input
                    id="storeName"
                    value={storeForm.name}
                    onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })}
                    className="bg-secondary border-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storePhone">Teléfono</Label>
                  <Input
                    id="storePhone"
                    value={storeForm.phone}
                    onChange={(e) => setStoreForm({ ...storeForm, phone: e.target.value })}
                    className="bg-secondary border-none"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="storeAddress">Dirección</Label>
                  <Input
                    id="storeAddress"
                    value={storeForm.address}
                    onChange={(e) => setStoreForm({ ...storeForm, address: e.target.value })}
                    className="bg-secondary border-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storeEmail">Correo Electrónico</Label>
                  <Input
                    id="storeEmail"
                    type="email"
                    value={storeForm.email}
                    onChange={(e) => setStoreForm({ ...storeForm, email: e.target.value })}
                    className="bg-secondary border-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storeTaxId">NIT / RUT</Label>
                  <Input
                    id="storeTaxId"
                    value={storeForm.taxId}
                    onChange={(e) => setStoreForm({ ...storeForm, taxId: e.target.value })}
                    className="bg-secondary border-none"
                    placeholder="Ej: 900.123.456-7"
                  />
                </div>
              </div>
              <Button onClick={handleSaveStore} className="gap-2">
                {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {saved ? 'Guardado' : 'Guardar Cambios'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profile Settings */}
        <TabsContent value="profile">
          <div className="space-y-6">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Mi Perfil
                </CardTitle>
                <CardDescription>
                  Administra tu información personal y credenciales
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="userName">Nombre</Label>
                    <Input
                      id="userName"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      className="bg-secondary border-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="userEmail">Correo Electrónico</Label>
                    <Input
                      id="userEmail"
                      type="email"
                      value={profileForm.email}
                      disabled
                      className="bg-secondary border-none opacity-50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rol</Label>
                    <div className="flex items-center gap-2 rounded-lg bg-secondary p-3">
                      <Shield className="h-4 w-4 text-primary" />
                      <span className="text-sm capitalize">{user?.role || 'Usuario'}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Miembro desde</Label>
                    <div className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
                      {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('es-CO') : 'N/A'}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveProfile} className="gap-2">
                    {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                    {saved ? 'Guardado' : 'Guardar Cambios'}
                  </Button>
                  <Button variant="outline" onClick={logout} className="gap-2 bg-transparent">
                    Cerrar Sesión
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Theme Settings */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {mounted && theme === 'dark' ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-primary" />}
                  Tema
                </CardTitle>
                <CardDescription>
                  Selecciona el tema de la interfaz
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <button
                    onClick={() => setTheme('light')}
                    className={`flex flex-1 flex-col items-center gap-3 rounded-lg border-2 p-4 transition-colors ${mounted && theme === 'light' ? 'border-primary bg-primary/10' : 'border-border bg-secondary/50 hover:border-muted-foreground'}`}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-100">
                      <Sun className="h-6 w-6 text-amber-600" />
                    </div>
                    <span className="text-sm font-medium">Claro</span>
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={`flex flex-1 flex-col items-center gap-3 rounded-lg border-2 p-4 transition-colors ${mounted && theme === 'dark' ? 'border-primary bg-primary/10' : 'border-border bg-secondary/50 hover:border-muted-foreground'}`}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-950">
                      <Moon className="h-6 w-6 text-indigo-300" />
                    </div>
                    <span className="text-sm font-medium">Oscuro</span>
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Data Settings */}
        <TabsContent value="data">
          <div className="space-y-6">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5 text-primary" />
                  Respaldo de Datos
                </CardTitle>
                <CardDescription>
                  Exporta todos los datos de tu inventario y ventas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-secondary/50 p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total Productos</p>
                      <p className="text-xl font-bold text-foreground">{products.length}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Ventas</p>
                      <p className="text-xl font-bold text-foreground">{sales.length}</p>
                    </div>
                  </div>
                </div>
                <Button onClick={handleExportData} className="gap-2">
                  <Download className="h-4 w-4" />
                  Exportar Datos (JSON)
                </Button>
              </CardContent>
            </Card>

            <Card className="border-destructive/50 bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Zona de Peligro
                </CardTitle>
                <CardDescription>
                  Acciones irreversibles que afectan todos los datos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="destructive"
                  onClick={() => setShowResetDialog(true)}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Restablecer Todo
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        {/* Users Management (Admin Only) */}
        {isAdmin && (
          <TabsContent value="users">
            <div className="space-y-6">
              {(userError || userSuccess) && (
                <div className={`rounded-lg p-3 text-sm ${userError ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-500'}`}>
                  {userError || userSuccess}
                </div>
              )}

              {/* Cargos Management */}
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-primary" />
                    Cargos
                  </CardTitle>
                  <CardDescription>
                    Crea los cargos de tu empresa para asignarlos a los empleados
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      value={newCargoName}
                      onChange={(e) => setNewCargoName(e.target.value)}
                      placeholder="Nombre del cargo (ej: Cajero, Bodeguero...)"
                      className="bg-secondary border-none"
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateCargo()}
                    />
                    <Input
                      value={newCargoDesc}
                      onChange={(e) => setNewCargoDesc(e.target.value)}
                      placeholder="Descripción (opcional)"
                      className="bg-secondary border-none"
                    />
                    <Button onClick={handleCreateCargo} disabled={creatingCargo} className="gap-2 shrink-0">
                      {creatingCargo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Agregar
                    </Button>
                  </div>
                  {cargoError && <p className="text-xs text-destructive">{cargoError}</p>}
                  {cargosList.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-3">No hay cargos creados. Agrega el primero.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {cargosList.map((c) => (
                        <div key={c.id} className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm">
                          <Briefcase className="h-3.5 w-3.5 text-primary" />
                          <span className="text-foreground font-medium">{c.name}</span>
                          {c.description && <span className="text-muted-foreground">— {c.description}</span>}
                          <button onClick={() => handleDeleteCargo(c.id)} className="ml-1 text-muted-foreground hover:text-destructive transition-colors">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Create User Form */}
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5 text-primary" />
                    Crear Empleado
                  </CardTitle>
                  <CardDescription>
                    Crea un empleado y asígnale un cargo
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                      <Label htmlFor="newUserName">Nombre</Label>
                      <Input
                        id="newUserName"
                        value={newUserForm.name}
                        onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                        placeholder="Nombre completo"
                        className="bg-secondary border-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newUserEmail">Correo Electrónico</Label>
                      <Input
                        id="newUserEmail"
                        type="email"
                        value={newUserForm.email}
                        onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                        placeholder="correo@ejemplo.com"
                        className="bg-secondary border-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newUserPassword">Contraseña</Label>
                      <Input
                        id="newUserPassword"
                        type="password"
                        value={newUserForm.password}
                        onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                        placeholder="Mínimo 6 caracteres"
                        className="bg-secondary border-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Rol del sistema</Label>
                      <Select
                        value={newUserForm.role}
                        onValueChange={(v) => setNewUserForm({ ...newUserForm, role: v })}
                      >
                        <SelectTrigger className="bg-secondary border-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vendedor">Vendedor — POS e inventario</SelectItem>
                          <SelectItem value="mesero">Mesero — mesas y comandas</SelectItem>
                          <SelectItem value="cocinero">Cocinero — pantalla cocina</SelectItem>
                          <SelectItem value="bartender">Bartender — pantalla bar</SelectItem>
                          <SelectItem value="cajero">Cajero — cobro de comandas</SelectItem>
                          <SelectItem value="administrador_rb">Admin RestBar — gestión completa</SelectItem>
                          <SelectItem value="auxiliar_bodega">Aux. Bodega — solo inventario</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Cargo</Label>
                      <Select
                        value={newUserForm.cargoId}
                        onValueChange={(v) => setNewUserForm({ ...newUserForm, cargoId: v })}
                      >
                        <SelectTrigger className="bg-secondary border-none">
                          <SelectValue placeholder="Sin cargo asignado" />
                        </SelectTrigger>
                        <SelectContent>
                          {cargosList.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-muted-foreground">Crea cargos primero</div>
                          ) : (
                            cargosList.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-secondary/50 p-3 text-sm text-muted-foreground">
                    <Shield className="h-4 w-4" />
                    {newUserForm.cargoId
                      ? <>Cargo: <strong className="text-foreground">{cargosList.find(c => c.id === newUserForm.cargoId)?.name}</strong>. Acceso al Punto de Venta, Inventario y Caja.</>
                      : <>Sin cargo asignado — podrás asignarlo después desde el módulo de Empleados.</>
                    }
                  </div>
                  <Button onClick={handleCreateUser} disabled={creatingUser} className="gap-2">
                    {creatingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    {creatingUser ? 'Creando...' : 'Crear Empleado'}
                  </Button>
                </CardContent>
              </Card>

              {/* Users List */}
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Usuarios Registrados
                  </CardTitle>
                  <CardDescription>
                    Lista de todos los usuarios del sistema
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingUsers ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : usersList.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">No hay usuarios registrados</p>
                  ) : (
                    <div className="space-y-2">
                      {usersList.map((u) => (
                        <div key={u.id} className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">{u.name}</p>
                              <p className="text-xs text-muted-foreground">{u.email}</p>
                            </div>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.role === 'comerciante' || u.role === 'superadmin' ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                              {u.role}
                            </span>
                          </div>
                          {u.id !== user?.id && (
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 bg-transparent"
                                onClick={() => setResetPasswordDialog({ open: true, userId: u.id, userName: u.name })}
                              >
                                <Key className="h-3 w-3" />
                                Contraseña
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="gap-1"
                                onClick={() => setDeleteUserDialog({ open: true, userId: u.id, userName: u.name })}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

      </Tabs>

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordDialog.open} onOpenChange={(open) => !open && setResetPasswordDialog({ open: false, userId: '', userName: '' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restablecer Contraseña</DialogTitle>
            <DialogDescription>
              Nueva contraseña para <strong>{resetPasswordDialog.userName}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="resetPassword">Nueva Contraseña</Label>
            <Input
              id="resetPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetPasswordDialog({ open: false, userId: '', userName: '' }); setNewPassword('') }} className="bg-transparent">
              Cancelar
            </Button>
            <Button onClick={handleResetPassword}>
              Restablecer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={deleteUserDialog.open} onOpenChange={(open) => !open && setDeleteUserDialog({ open: false, userId: '', userName: '' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Eliminar Usuario
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar a <strong>{deleteUserDialog.userName}</strong>? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUserDialog({ open: false, userId: '', userName: '' })} className="bg-transparent">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Restablecimiento
            </DialogTitle>
            <DialogDescription>
              Esta acción eliminará TODOS los datos de la aplicación incluyendo productos, ventas, configuraciones y usuarios. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetDialog(false)} className="bg-transparent">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleResetData}>
              Sí, Restablecer Todo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
