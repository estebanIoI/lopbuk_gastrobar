'use client'

import React from "react"

import { useState, useEffect } from 'react'
import { useStore, getStockStatus } from '@/lib/store'
import { api } from '@/lib/api'
import { type Product, type Category, type ProductType, type Sede } from '@/lib/types'
import { PRODUCT_TYPES, FIELD_DEFINITIONS, getFieldsForProductType } from '@/lib/product-config'
import { formatCOP } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { CloudinaryUpload } from '@/components/ui/cloudinary-upload'
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Package,
  Filter,
  Tags,
  ScanLine,
  Smartphone,
  Upload,
  MapPin,
  ChevronDown,
  Settings2,
  FileDown,
  ImageIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { BarcodeScanner } from '@/components/barcode-scanner'
import { RemoteScanner } from '@/components/remote-scanner'
import { BulkUploadDialog } from '@/components/bulk-upload-dialog'

export function InventoryList() {
  const { products, isLoadingProducts, fetchProducts, addProduct, updateProduct, deleteProduct, categories, fetchCategories, addCategory, inventoryStockFilter, inventorySearchQuery, clearInventoryFilters, sedes, fetchSedes, addSede, updateSede, deleteSede } = useStore()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [stockFilter, setStockFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [activeSede, setActiveSede] = useState<string>('all')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false)
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false)
  const [isSedeDialogOpen, setIsSedeDialogOpen] = useState(false)
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false)
  const [imageDialogData, setImageDialogData] = useState<{ imageUrl: string; images: string[] }>({ imageUrl: '', images: ['', '', '', ''] })
  const [isSavingImages, setIsSavingImages] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const handleExportCsv = async () => {
    setIsExporting(true)
    try {
      const params: Record<string, string> = {}
      if (search) params.search = search
      if (categoryFilter !== 'all') params.category = categoryFilter
      if (stockFilter !== 'all') params.stockStatus = stockFilter
      if (typeFilter !== 'all') params.productType = typeFilter

      const blob = await api.exportProductsCSV(params)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `inventario_${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Inventario exportado correctamente')
    } catch {
      toast.error('Error al exportar el inventario')
    } finally {
      setIsExporting(false)
    }
  }
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' })
  const [sedeForm, setSedeForm] = useState({ name: '', address: '' })
  const [editingSede, setEditingSede] = useState<Sede | null>(null)
  const [highlightedProduct, setHighlightedProduct] = useState<string | null>(null)

  useEffect(() => {
    fetchProducts()
    fetchCategories()
    fetchSedes()
  }, [fetchProducts, fetchCategories, fetchSedes])

  // Apply filters from notification navigation
  useEffect(() => {
    if (inventoryStockFilter) {
      setStockFilter(inventoryStockFilter)
    }
    if (inventorySearchQuery) {
      setSearch(inventorySearchQuery)
      // Find the product to highlight and scroll to it
      const product = products.find(p => p.name === inventorySearchQuery)
      if (product) {
        setHighlightedProduct(product.id)
        // Scroll to the product row after render
        setTimeout(() => {
          const el = document.getElementById(`product-${product.id}`)
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
        // Remove highlight after 3 seconds
        setTimeout(() => setHighlightedProduct(null), 3000)
      }
    }
    if (inventoryStockFilter || inventorySearchQuery) {
      clearInventoryFilters()
    }
  }, [inventoryStockFilter, inventorySearchQuery, clearInventoryFilters, products])

  const getCategoryName = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId)
    return cat ? cat.name : categoryId
  }

  // Derive used types and categories from products
  const usedTypes = new Set(products.map(p => p.productType).filter(Boolean))
  const usedCategories = new Set(products.map(p => p.category).filter(Boolean))

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesSearch =
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      (product.articulo && product.articulo.toLowerCase().includes(search.toLowerCase())) ||
      product.sku.toLowerCase().includes(search.toLowerCase()) ||
      (product.brand && product.brand.toLowerCase().includes(search.toLowerCase())) ||
      (product.barcode && product.barcode.toLowerCase().includes(search.toLowerCase()))

    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter
    const matchesType = typeFilter === 'all' || product.productType === typeFilter
    const matchesSede = activeSede === 'all' || product.sedeId === activeSede || !product.sedeId

    const status = getStockStatus(product)
    const matchesStock = stockFilter === 'all' ||
      (stockFilter === 'suficiente' && status === 'suficiente') ||
      (stockFilter === 'bajo' && status === 'bajo') ||
      (stockFilter === 'agotado' && status === 'agotado')

    return matchesSearch && matchesCategory && matchesStock && matchesType && matchesSede
  })

  const activeSedeObj = sedes.find(s => s.id === activeSede)

  const handleEdit = (product: Product) => {
    setSelectedProduct(product)
    setIsEditDialogOpen(true)
  }

  const handleDelete = (product: Product) => {
    setSelectedProduct(product)
    setIsDeleteDialogOpen(true)
  }

  const handleOpenImageDialog = (product: Product) => {
    const imagesArr = Array.isArray(product.images) ? product.images : []
    setSelectedProduct(product)
    setImageDialogData({
      imageUrl: product.imageUrl || imagesArr[0] || '',
      images: [
        product.imageUrl || imagesArr[0] || '',
        imagesArr[1] || '',
        imagesArr[2] || '',
        imagesArr[3] || '',
      ],
    })
    setIsImageDialogOpen(true)
  }

  const handleSaveImages = async () => {
    if (!selectedProduct) return
    setIsSavingImages(true)
    const trimmed = imageDialogData.images.map(u => u.trim())
    const result = await updateProduct(selectedProduct.id, {
      imageUrl: trimmed[0],
      images: trimmed,
    })
    setIsSavingImages(false)
    if (result.success) {
      setIsImageDialogOpen(false)
      setSelectedProduct(null)
      toast.success('Imágenes actualizadas')
    } else {
      toast.error('Error al guardar imágenes')
    }
  }

  const confirmDelete = async () => {
    if (selectedProduct) {
      const result = await deleteProduct(selectedProduct.id)
      if (result.success) {
        setIsDeleteDialogOpen(false)
        setSelectedProduct(null)
      } else {
        toast.error(result.error || 'Error al eliminar producto')
      }
    }
  }

  const getProductTypeInfo = (type: ProductType) => {
    return PRODUCT_TYPES[type] || PRODUCT_TYPES.general
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Sticky sede badge — only shows when there are 2+ sedes */}
      {sedes.length >= 2 && (
        <div className="sticky top-0 z-20 -mx-4 px-4 py-2 bg-background/95 backdrop-blur border-b border-border flex items-center gap-3 flex-wrap">
          <MapPin className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sede:</span>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setActiveSede('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${activeSede === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
            >
              Todas
            </button>
            {sedes.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSede(s.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${activeSede === s.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
              >
                {s.name}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setEditingSede(null); setSedeForm({ name: '', address: '' }); setIsSedeDialogOpen(true) }}
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings2 className="h-3 w-3" />
            Gestionar sedes
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-foreground">Productos</h2>
          <p className="text-sm lg:text-base text-muted-foreground">
            {filteredProducts.length} de {products.length} productos
            {activeSedeObj && <span className="ml-2 text-primary">— Sede: {activeSedeObj.name}</span>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => { setEditingSede(null); setSedeForm({ name: '', address: '' }); setIsSedeDialogOpen(true) }} className="gap-2 h-10 lg:h-11 text-sm lg:text-base">
            <MapPin className="h-4 w-4 lg:h-5 lg:w-5" />
            Sedes
          </Button>
          <Button variant="outline" onClick={() => setIsCategoryDialogOpen(true)} className="gap-2 h-10 lg:h-11 text-sm lg:text-base">
            <Tags className="h-4 w-4 lg:h-5 lg:w-5" />
            Crear Categoria
          </Button>
          <Button variant="outline" onClick={() => setIsBulkUploadOpen(true)} className="gap-2 h-10 lg:h-11 text-sm lg:text-base">
            <Upload className="h-4 w-4 lg:h-5 lg:w-5" />
            Importar CSV
          </Button>
          <Button variant="outline" onClick={handleExportCsv} disabled={isExporting} className="gap-2 h-10 lg:h-11 text-sm lg:text-base">
            <FileDown className="h-4 w-4 lg:h-5 lg:w-5" />
            {isExporting ? 'Exportando...' : 'Exportar CSV'}
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2 h-10 lg:h-11 text-sm lg:text-base">
            <Plus className="h-4 w-4 lg:h-5 lg:w-5" />
            Agregar Producto
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-border bg-card">
        <CardContent className="p-4 lg:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, SKU, marca o codigo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-secondary border-none h-10 lg:h-11"
              />
            </div>
            <div className="flex gap-2 sm:gap-3 flex-wrap">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[130px] sm:w-[160px] bg-secondary border-none h-10 lg:h-11">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {Object.values(PRODUCT_TYPES).filter(t => usedTypes.has(t.id)).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.icon} {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[130px] sm:w-[160px] bg-secondary border-none h-10 lg:h-11">
                  <Filter className="mr-2 h-4 w-4 hidden sm:block" />
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories.filter(cat => usedCategories.has(cat.id)).map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="w-[110px] sm:w-[140px] bg-secondary border-none h-10 lg:h-11">
                  <SelectValue placeholder="Stock" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo</SelectItem>
                  <SelectItem value="suficiente">Suficiente</SelectItem>
                  <SelectItem value="bajo">Bajo</SelectItem>
                  <SelectItem value="agotado">Agotado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card className="border-border bg-card">
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground text-sm lg:text-base">Producto</TableHead>
                <TableHead className="text-muted-foreground text-sm lg:text-base">SKU</TableHead>
                <TableHead className="text-muted-foreground text-sm lg:text-base">Tipo</TableHead>
                <TableHead className="text-muted-foreground text-sm lg:text-base">Categoria</TableHead>
                {sedes.length >= 2 && <TableHead className="text-muted-foreground text-sm lg:text-base">Sede</TableHead>}
                <TableHead className="text-muted-foreground text-sm lg:text-base text-right">Precio</TableHead>
                <TableHead className="text-muted-foreground text-sm lg:text-base text-center">Stock</TableHead>
                <TableHead className="text-muted-foreground text-sm lg:text-base text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={sedes.length >= 2 ? 8 : 7} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-8 w-8 lg:h-10 lg:w-10 text-muted-foreground" />
                      <p className="text-sm lg:text-base text-muted-foreground">No se encontraron productos</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => {
                  const status = getStockStatus(product)
                  const typeInfo = getProductTypeInfo(product.productType)
                  return (
                    <TableRow
                      key={product.id}
                      id={`product-${product.id}`}
                      className={`border-border transition-colors duration-1000 ${
                        highlightedProduct === product.id ? 'bg-primary/15 ring-1 ring-primary/30' : ''
                      }`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 lg:h-12 lg:w-12 items-center justify-center rounded-lg bg-secondary text-lg">
                            {typeInfo.icon}
                          </div>
                          <div>
                            <p className="font-medium text-sm lg:text-base text-foreground">{product.name}</p>
                            {product.articulo && (
                              <p className="text-xs text-muted-foreground/70 italic">Inv: {product.articulo}</p>
                            )}
                            <p className="text-xs lg:text-sm text-muted-foreground">
                              {product.brand || ''}{product.brand && product.color ? ' | ' : ''}{product.color || ''}
                              {product.size ? ` | ${product.size}` : ''}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs lg:text-sm">
                        {product.sku}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-secondary text-muted-foreground text-xs">
                          {typeInfo.icon} {typeInfo.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-secondary text-muted-foreground text-xs lg:text-sm">
                          {getCategoryName(product.category)}
                        </Badge>
                      </TableCell>
                      {sedes.length >= 2 && (
                        <TableCell>
                          {product.sedeId ? (
                            <Badge variant="outline" className="text-xs border-primary/40 text-primary/80">
                              <MapPin className="h-2.5 w-2.5 mr-1" />
                              {sedes.find(s => s.id === product.sedeId)?.name || '—'}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Todas</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <div>
                          <p className="font-medium text-sm lg:text-base text-foreground">
                            {formatCOP(product.salePrice)}
                          </p>
                          <p className="text-xs lg:text-sm text-muted-foreground">
                            Costo: {formatCOP(product.purchasePrice)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className={`h-2 w-2 lg:h-2.5 lg:w-2.5 rounded-full ${
                            status === 'suficiente' ? 'bg-primary' :
                            status === 'bajo' ? 'bg-warning' : 'bg-destructive'
                          }`} />
                          <span className={`font-medium text-sm lg:text-base ${
                            status === 'suficiente' ? 'text-primary' :
                            status === 'bajo' ? 'text-warning' : 'text-destructive'
                          }`}>
                            {product.stock}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenImageDialog(product)}
                            className="h-8 w-8 lg:h-9 lg:w-9 text-muted-foreground hover:text-foreground"
                            title="Gestionar imágenes"
                          >
                            <ImageIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(product)}
                            className="h-8 w-8 lg:h-9 lg:w-9"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(product)}
                            className="h-8 w-8 lg:h-9 lg:w-9 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Product Dialog */}
      <ProductFormDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSubmit={async (data) => {
          const result = await addProduct(data)
          if (result.success) {
            setIsAddDialogOpen(false)
            toast.success('Producto creado exitosamente')
          } else {
            toast.error(result.error || 'Error al crear producto')
            console.error('Error creando producto:', result.error, 'Datos enviados:', data)
          }
        }}
        title="Agregar Producto"
        description="Complete los datos del nuevo producto"
        sedes={sedes}
        defaultSedeId={activeSede !== 'all' ? activeSede : undefined}
      />

      {/* Edit Product Dialog */}
      {selectedProduct && (
        <ProductFormDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSubmit={async (data) => {
            const result = await updateProduct(selectedProduct.id, data)
            if (result.success) {
              setIsEditDialogOpen(false)
              setSelectedProduct(null)
              toast.success('Producto actualizado exitosamente')
            } else {
              toast.error(result.error || 'Error al actualizar producto')
            }
          }}
          title="Editar Producto"
          description="Modifique los datos del producto"
          initialData={selectedProduct}
          sedes={sedes}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Producto</DialogTitle>
            <DialogDescription>
              Esta seguro que desea eliminar &quot;{selectedProduct?.name}&quot;? Esta accion no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Image Upload Dialog */}
      {selectedProduct && (
        <Dialog open={isImageDialogOpen} onOpenChange={(open) => { setIsImageDialogOpen(open); if (!open) setSelectedProduct(null) }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Imágenes del Producto</DialogTitle>
              <DialogDescription>
                {selectedProduct.name} — Cargue hasta 4 imágenes. La primera es la imagen principal.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 py-2">
              {[0, 1, 2, 3].map((idx) => (
                <div key={idx} className="rounded-lg border border-border p-2 bg-secondary/20">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    {idx === 0 ? 'Imagen principal ★' : `Imagen ${idx + 1}`}
                  </p>
                  <CloudinaryUpload
                    value={imageDialogData.images[idx] || ''}
                    onChange={(url) => {
                      const next = [...imageDialogData.images]
                      next[idx] = url
                      setImageDialogData({ imageUrl: next[0] || '', images: next })
                    }}
                    previewClassName="h-20 w-full object-cover rounded border"
                    accept="image/*,image/gif"
                  />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsImageDialogOpen(false); setSelectedProduct(null) }}>
                Cancelar
              </Button>
              <Button onClick={handleSaveImages} disabled={isSavingImages}>
                {isSavingImages ? 'Guardando...' : 'Guardar Imágenes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crear Categoria</DialogTitle>
            <DialogDescription>
              Agregue una nueva categoria para organizar sus productos
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault()
            const id = categoryForm.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
            const result = await addCategory({ id, name: categoryForm.name, description: categoryForm.description || undefined })
            if (result.success) {
              setCategoryForm({ name: '', description: '' })
              setIsCategoryDialogOpen(false)
            }
          }}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="categoryName">Nombre de la categoria</Label>
                <Input
                  id="categoryName"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="Ej: Ropa Casual"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoryDesc">Descripcion (opcional)</Label>
                <Input
                  id="categoryDesc"
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  placeholder="Breve descripcion de la categoria"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                Crear Categoria
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Sede Management Dialog */}
      <Dialog open={isSedeDialogOpen} onOpenChange={setIsSedeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gestionar Sedes</DialogTitle>
            <DialogDescription>Agrega o edita las sucursales de tu negocio</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Existing sedes list */}
            {sedes.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground tracking-wider">Sedes existentes</Label>
                {sedes.map(s => (
                  <div key={s.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border bg-secondary/30">
                    <div>
                      <p className="font-medium text-sm">{s.name}</p>
                      {s.address && <p className="text-xs text-muted-foreground">{s.address}</p>}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                        setEditingSede(s)
                        setSedeForm({ name: s.name, address: s.address || '' })
                      }}>
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={async () => {
                        await deleteSede(s.id)
                        if (activeSede === s.id) setActiveSede('all')
                        toast.success('Sede eliminada')
                      }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* Add / Edit form */}
            <form onSubmit={async (e) => {
              e.preventDefault()
              if (!sedeForm.name.trim()) return
              if (editingSede) {
                const result = await updateSede(editingSede.id, { name: sedeForm.name.trim(), address: sedeForm.address || undefined })
                if (result.success) { setEditingSede(null); setSedeForm({ name: '', address: '' }); toast.success('Sede actualizada') }
                else toast.error(result.error || 'Error al actualizar')
              } else {
                const result = await addSede({ name: sedeForm.name.trim(), address: sedeForm.address || undefined })
                if (result.success) { setSedeForm({ name: '', address: '' }); toast.success('Sede creada') }
                else toast.error(result.error || 'Error al crear')
              }
            }} className="space-y-3 border-t border-border pt-4">
              <Label className="text-xs uppercase text-muted-foreground tracking-wider">
                {editingSede ? `Editando: ${editingSede.name}` : 'Nueva sede'}
              </Label>
              <Input
                placeholder="Nombre de la sede (ej: Sede Centro)"
                value={sedeForm.name}
                onChange={e => setSedeForm(p => ({ ...p, name: e.target.value }))}
                required
              />
              <Input
                placeholder="Dirección (opcional)"
                value={sedeForm.address}
                onChange={e => setSedeForm(p => ({ ...p, address: e.target.value }))}
              />
              <div className="flex gap-2">
                {editingSede && (
                  <Button type="button" variant="outline" onClick={() => { setEditingSede(null); setSedeForm({ name: '', address: '' }) }} className="flex-1">
                    Cancelar
                  </Button>
                )}
                <Button type="submit" className="flex-1">
                  {editingSede ? 'Guardar cambios' : 'Agregar sede'}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <BulkUploadDialog
        open={isBulkUploadOpen}
        onOpenChange={setIsBulkUploadOpen}
      />
    </div>
  )
}

interface ProductFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: any) => void
  title: string
  description: string
  initialData?: Product
  sedes?: Sede[]
  defaultSedeId?: string
}

function ProductFormDialog({
  open,
  onOpenChange,
  onSubmit,
  title,
  description,
  initialData,
  sedes = [],
  defaultSedeId,
}: ProductFormDialogProps) {
  const { categories } = useStore()
  const [showScanner, setShowScanner] = useState(false)
  const [showRemoteScanner, setShowRemoteScanner] = useState(false)
  const [formData, setFormData] = useState<Record<string, any>>(() => getInitialFormData(initialData, categories, defaultSedeId))

  // Reset form and scanner state when dialog opens/closes or initialData changes
  useEffect(() => {
    if (open) {
      setFormData(getInitialFormData(initialData, categories, defaultSedeId))
      setShowScanner(false)
      setShowRemoteScanner(false)
    }
  }, [open, initialData, categories, defaultSedeId])

  const productType = (formData.productType || 'general') as ProductType
  const typeFields = getFieldsForProductType(productType)

  const updateField = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Clean up empty/whitespace-only strings to not send them
    const cleaned: Record<string, any> = {}
    for (const [key, value] of Object.entries(formData)) {
      if (value === '' || value === undefined || value === null) continue
      if (typeof value === 'string' && value.trim() === '') continue
      cleaned[key] = typeof value === 'string' ? value.trim() : value
    }
    onSubmit(cleaned)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Product Type Selector */}
            <div className="space-y-2">
              <Label>Tipo de Producto</Label>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {Object.values(PRODUCT_TYPES).map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => updateField('productType', type.id)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-colors ${
                      productType === type.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-muted-foreground/50'
                    }`}
                  >
                    <span className="text-lg">{type.icon}</span>
                    <span className="truncate w-full text-center">{type.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Common fields - always visible */}
            <div className="space-y-2">
              <Label htmlFor="name">Nombre en tienda *</Label>
              <Input
                id="name"
                value={formData.name || ''}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Nombre visible para clientes"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="articulo">Artículo (inventario)</Label>
                <Input
                  id="articulo"
                  value={formData.articulo || ''}
                  onChange={(e) => updateField('articulo', e.target.value)}
                  placeholder="Nombre interno de inventario"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoría *</Label>
                <Select
                  value={formData.category || ''}
                  onValueChange={(value) => updateField('category', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU / Codigo *</Label>
                <Input
                  id="sku"
                  value={formData.sku || ''}
                  onChange={(e) => updateField('sku', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="barcode">Codigo de Barras</Label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      id="barcode"
                      value={formData.barcode || ''}
                      onChange={(e) => updateField('barcode', e.target.value)}
                      placeholder="Escanea o ingresa manualmente"
                      className={formData.barcode ? 'border-green-500' : ''}
                    />
                    {formData.barcode && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowScanner(true)}
                      title="Escanear con cámara local (DroidCam)"
                    >
                      <ScanLine className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowRemoteScanner(true)}
                      title="Escanear con cámara remota (QR)"
                    >
                      <Smartphone className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchasePrice">Precio de compra (COP) *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    id="purchasePrice"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="50000"
                    value={formData.purchasePrice || ''}
                    onChange={(e) => updateField('purchasePrice', parseFloat(e.target.value) || 0)}
                    className="pl-7"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="salePrice">Precio de venta (COP) {formData.category !== 'insumos' && '*'}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    id="salePrice"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={formData.category === 'insumos' ? '0' : '249999'}
                    value={formData.salePrice || ''}
                    onChange={(e) => updateField('salePrice', parseFloat(e.target.value) || 0)}
                    className="pl-7"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stock">Stock *</Label>
                <Input
                  id="stock"
                  type="number"
                  min="0"
                  placeholder="10"
                  value={formData.stock ?? ''}
                  onChange={(e) => updateField('stock', parseInt(e.target.value) || 0)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reorderPoint">Punto de reorden *</Label>
                <Input
                  id="reorderPoint"
                  type="number"
                  min="0"
                  placeholder="5"
                  value={formData.reorderPoint ?? ''}
                  onChange={(e) => updateField('reorderPoint', parseInt(e.target.value) || 0)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entryDate">Fecha de ingreso *</Label>
                <Input
                  id="entryDate"
                  type="date"
                  value={formData.entryDate || ''}
                  onChange={(e) => updateField('entryDate', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier">Proveedor</Label>
              <Input
                id="supplier"
                value={formData.supplier || ''}
                onChange={(e) => updateField('supplier', e.target.value)}
                placeholder="Nombre del proveedor"
              />
            </div>

            {/* Sede selector — only visible when there are sedes configured */}
            {sedes.length >= 1 && (
              <div className="space-y-2">
                <Label htmlFor="sedeId">Sede / Sucursal</Label>
                <Select
                  value={formData.sedeId || 'all'}
                  onValueChange={(val) => updateField('sedeId', val === 'all' ? '' : val)}
                >
                  <SelectTrigger>
                    <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Todas las sedes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las sedes</SelectItem>
                    {sedes.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Dejar en &quot;Todas&quot; para que aparezca en todas las sedes</p>
              </div>
            )}

            {/* ── Galería de imágenes (hasta 4) ───────────────── */}
            <div className="space-y-3">
              <Label>Imágenes del Producto (máx. 4)</Label>
              <p className="text-xs text-muted-foreground -mt-1">
                La primera imagen es la principal que se muestra en listas y tienda.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((idx) => {
                  // Slot 0 = imageUrl (principal), slots 1-3 = images[1..3]
                  const imagesArr: string[] = Array.isArray(formData.images) ? formData.images : []
                  const slotValue = idx === 0
                    ? (formData.imageUrl || imagesArr[0] || '')
                    : (imagesArr[idx] || '')

                  const handleSlotChange = (url: string) => {
                    const next = [...Array(4)].map((_, i) => {
                      if (i === 0) return idx === 0 ? url : (formData.imageUrl || imagesArr[0] || '')
                      return i === idx ? url : (imagesArr[i] || '')
                    })
                    // Trim trailing empty slots
                    const trimmed = next.map(u => u.trim())
                    updateField('images', trimmed)
                    if (idx === 0) updateField('imageUrl', url)
                  }

                  return (
                    <div key={idx} className="rounded-lg border border-border p-2 bg-secondary/20">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        {idx === 0 ? 'Imagen principal ★' : `Imagen ${idx + 1}`}
                      </p>
                      <CloudinaryUpload
                        value={slotValue}
                        onChange={handleSlotChange}
                        previewClassName="h-20 w-full object-cover rounded border"
                        accept="image/*,image/gif"
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Dynamic type-specific fields */}
            {typeFields.length > 0 && (
              <>
                <div className="border-t border-border pt-4 mt-2">
                  <p className="text-sm font-medium text-muted-foreground mb-3">
                    {PRODUCT_TYPES[productType]?.icon} Campos de {PRODUCT_TYPES[productType]?.name}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {typeFields.map((field) => (
                    <DynamicField
                      key={field.name}
                      field={field}
                      value={formData[field.name]}
                      onChange={(value) => updateField(field.name, value)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              {initialData ? 'Guardar Cambios' : 'Agregar Producto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {showScanner && (
        <BarcodeScanner
          onScan={(barcode) => setFormData(prev => ({ ...prev, barcode }))}
          onClose={() => setShowScanner(false)}
        />
      )}

      {showRemoteScanner && (
        <RemoteScanner
          onScan={(barcode) => {
            setFormData(prev => ({ ...prev, barcode }))
            setShowRemoteScanner(false)
          }}
          onClose={() => setShowRemoteScanner(false)}
        />
      )}
    </Dialog>
  )
}

function DynamicField({ field, value, onChange }: {
  field: { name: string; label: string; type: string; placeholder?: string; description?: string; min?: number; max?: number; step?: number; options?: Array<{ value: string; label: string }>; defaultValue?: any }
  value: any
  onChange: (value: any) => void
}) {
  const isFullWidth = field.type === 'textarea'

  const wrapper = (children: React.ReactNode) => (
    <div className={`space-y-2 ${isFullWidth ? 'col-span-2' : ''}`}>
      <Label htmlFor={field.name}>{field.label}</Label>
      {children}
      {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
    </div>
  )

  if (field.type === 'select' && field.options) {
    return wrapper(
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Seleccionar" />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (field.type === 'boolean') {
    return wrapper(
      <div className="flex items-center gap-2 pt-1">
        <Checkbox
          id={field.name}
          checked={!!value}
          onCheckedChange={(checked) => onChange(!!checked)}
        />
        <Label htmlFor={field.name} className="text-sm font-normal cursor-pointer">
          {value ? 'Si' : 'No'}
        </Label>
      </div>
    )
  }

  if (field.type === 'textarea') {
    return wrapper(
      <Textarea
        id={field.name}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={2}
      />
    )
  }

  if (field.type === 'number') {
    return wrapper(
      <Input
        id={field.name}
        type="number"
        min={field.min}
        max={field.max}
        step={field.step}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : '')}
        placeholder={field.placeholder}
      />
    )
  }

  if (field.type === 'date') {
    return wrapper(
      <Input
        id={field.name}
        type="date"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }

  // Default: text
  return wrapper(
    <Input
      id={field.name}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
    />
  )
}

function getInitialFormData(initialData: Product | undefined, categories: Array<{ id: string }>, defaultSedeId?: string) {
  if (initialData) {
    // Return all non-undefined properties from initialData
    const data: Record<string, any> = {}
    for (const [key, value] of Object.entries(initialData)) {
      if (key === 'id' || key === 'createdAt' || key === 'updatedAt' || key === 'stockStatus') continue
      if (value !== undefined && value !== null) {
        data[key] = value
      }
    }
    return data
  }

  return {
    name: '',
    category: categories[0]?.id || '',
    productType: 'general' as ProductType,
    purchasePrice: 0,
    salePrice: 0,
    sku: '',
    barcode: '',
    stock: 0,
    reorderPoint: 5,
    supplier: '',
    imageUrl: '',
    images: [] as string[],
    entryDate: new Date().toISOString().split('T')[0],
    sedeId: defaultSedeId || '',
  }
}
