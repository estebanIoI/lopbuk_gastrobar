'use client'

import { useState, useRef, useCallback } from 'react'
import Papa from 'papaparse'
import { useStore } from '@/lib/store'
import { type CategoryItem } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ArrowLeft,
} from 'lucide-react'
import { toast } from 'sonner'

const VALID_PRODUCT_TYPES = [
  'general', 'alimentos', 'bebidas', 'ropa', 'electronica', 'farmacia',
  'ferreteria', 'libreria', 'juguetes', 'cosmetica', 'deportes', 'hogar',
  'mascotas', 'otros',
]

const CSV_TEMPLATE_HEADERS = [
  // Requeridos
  'name', 'articulo', 'category', 'sku', 'purchasePrice', 'salePrice',
  'stock', 'reorderPoint', 'entryDate',
  // Opcionales comunes
  'productType', 'brand', 'model', 'description', 'barcode', 'supplier',
  'locationInStore', 'notes',
  // Alimentos / Bebidas / Farmacia / Cosmetica / Mascotas
  'expiryDate', 'batchNumber', 'netWeight', 'weightUnit',
  'sanitaryRegistration', 'storageTemperature', 'ingredients',
  'nutritionalInfo', 'alcoholContent', 'allergens',
  // Ropa / Deportes
  'size', 'color', 'material', 'gender', 'season',
  'garmentType', 'washingInstructions', 'countryOfOrigin',
  // Electronica
  'serialNumber', 'warrantyMonths', 'technicalSpecs', 'voltage',
  'powerWatts', 'compatibility', 'includesAccessories', 'productCondition',
  // Farmacia
  'activeIngredient', 'concentration', 'requiresPrescription',
  'administrationRoute', 'presentation', 'unitsPerPackage',
  'laboratory', 'contraindications',
  // Ferreteria
  'dimensions', 'weight', 'caliber', 'resistance', 'finish', 'recommendedUse',
  // Libreria
  'author', 'publisher', 'isbn', 'pages', 'language',
  'publicationYear', 'edition', 'bookFormat',
  // Juguetes
  'recommendedAge', 'numberOfPlayers', 'gameType',
  'requiresBatteries', 'packageDimensions', 'packageContents', 'safetyWarnings',
]

interface RowValidation {
  rowIndex: number
  data: Record<string, any>
  isValid: boolean
  errors: string[]
}

function validateRow(
  rawRow: Record<string, string>,
  rowIndex: number,
  categories: CategoryItem[],
  seenSkus: Set<string>
): RowValidation {
  const errors: string[] = []
  const data: Record<string, any> = {}

  // Required: name
  if (!rawRow.name?.trim()) errors.push('Nombre requerido')
  else data.name = rawRow.name.trim()

  // Required: sku
  if (!rawRow.sku?.trim()) {
    errors.push('SKU requerido')
  } else {
    data.sku = rawRow.sku.trim()
    if (seenSkus.has(data.sku)) errors.push(`SKU "${data.sku}" duplicado`)
    else seenSkus.add(data.sku)
  }

  // Required: category (match by name or ID)
  if (!rawRow.category?.trim()) {
    errors.push('Categoría requerida')
  } else {
    const catInput = rawRow.category.trim()
    const matched = categories.find(
      c => c.id === catInput || c.name.toLowerCase() === catInput.toLowerCase()
    )
    if (matched) {
      data.category = matched.id
    } else {
      errors.push(`Categoría "${catInput}" no encontrada`)
    }
  }

  // Required: purchasePrice
  const purchasePrice = parseFloat(rawRow.purchasePrice)
  if (isNaN(purchasePrice) || purchasePrice < 0) errors.push('Precio compra inválido')
  else data.purchasePrice = purchasePrice

  // Required: salePrice
  const salePrice = parseFloat(rawRow.salePrice)
  if (isNaN(salePrice) || salePrice < 0) errors.push('Precio venta inválido')
  else data.salePrice = salePrice

  // Required: stock
  const stock = parseInt(rawRow.stock)
  if (isNaN(stock) || stock < 0) errors.push('Stock inválido')
  else data.stock = stock

  // Required: reorderPoint
  const reorderPoint = parseInt(rawRow.reorderPoint)
  if (isNaN(reorderPoint) || reorderPoint < 0) errors.push('Punto reorden inválido')
  else data.reorderPoint = reorderPoint

  // Required: entryDate
  if (!rawRow.entryDate?.trim()) {
    errors.push('Fecha requerida')
  } else {
    const d = rawRow.entryDate.trim()
    if (!/^\d{4}-\d{2}-\d{2}/.test(d)) errors.push('Fecha inválida (YYYY-MM-DD)')
    else data.entryDate = d.substring(0, 10)
  }

  // Optional: productType
  if (rawRow.productType?.trim()) {
    if (VALID_PRODUCT_TYPES.includes(rawRow.productType.trim())) {
      data.productType = rawRow.productType.trim()
    } else {
      errors.push(`Tipo "${rawRow.productType}" inválido`)
    }
  }

  // Optional: articulo (inventario)
  if (rawRow.articulo?.trim()) {
    data.articulo = rawRow.articulo.trim()
  }

  // Optional string fields
  const optionalFields = ['brand', 'model', 'description', 'barcode', 'supplier', 'locationInStore', 'notes']
  for (const field of optionalFields) {
    if (rawRow[field]?.trim()) {
      data[field] = rawRow[field].trim()
    }
  }

  // Pass through any extra columns (type-specific fields like expiryDate, size, color, etc.)
  const knownFields = new Set([...CSV_TEMPLATE_HEADERS, ...optionalFields])
  for (const [key, value] of Object.entries(rawRow)) {
    if (!knownFields.has(key) && value?.trim()) {
      data[key] = value.trim()
    }
  }

  return { rowIndex, data, isValid: errors.length === 0, errors }
}

function downloadTemplate() {
  const SEP = ';'
  const headerRow = CSV_TEMPLATE_HEADERS.join(SEP)
  // Build example row: fill required + common fields, leave type-specific empty
  const exampleValues: Record<string, string> = {
    name: 'Producto Ejemplo',
    category: 'nombre-categoria',
    sku: 'SKU-001',
    purchasePrice: '50000',
    salePrice: '99900',
    stock: '100',
    reorderPoint: '10',
    entryDate: new Date().toISOString().split('T')[0],
    productType: 'general',
    brand: 'Marca',
    model: 'Modelo',
    description: 'Descripcion del producto',
    supplier: 'Proveedor SA',
    locationInStore: 'Estante A1',
  }
  const exampleRow = CSV_TEMPLATE_HEADERS.map(h => exampleValues[h] || '').join(SEP)
  const bom = '\uFEFF'
  const csv = `${bom}sep=${SEP}\n${headerRow}\n${exampleRow}\n`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'plantilla_productos_lopbuk.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function downloadErrorReport(errors: Array<{ row: number; sku: string; error: string }>) {
  const bom = '\uFEFF'
  const header = 'Fila,SKU,Error'
  const rows = errors.map(e => `${e.row},"${e.sku}","${e.error}"`)
  const csv = `${bom}${header}\n${rows.join('\n')}\n`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'errores_importacion.csv'
  a.click()
  URL.revokeObjectURL(url)
}

type Step = 'upload' | 'preview' | 'results'

interface ImportResult {
  totalCreated: number
  totalFailed: number
  errors: Array<{ row: number; sku: string; error: string }>
}

interface BulkUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BulkUploadDialog({ open, onOpenChange }: BulkUploadDialogProps) {
  const { categories, bulkImportProducts } = useStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [fileName, setFileName] = useState<string | null>(null)
  const [validatedRows, setValidatedRows] = useState<RowValidation[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const validCount = validatedRows.filter(r => r.isValid).length
  const errorCount = validatedRows.filter(r => !r.isValid).length

  const reset = useCallback(() => {
    setStep('upload')
    setFileName(null)
    setValidatedRows([])
    setIsImporting(false)
    setImportResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const handleClose = useCallback((open: boolean) => {
    if (!open) reset()
    onOpenChange(open)
  }, [onOpenChange, reset])

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Solo se aceptan archivos CSV')
      return
    }

    setFileName(file.name)

    // Read the file as text first to detect delimiter and strip sep= line
    const reader = new FileReader()
    reader.onload = (e) => {
      let text = e.target?.result as string
      if (!text) {
        toast.error('No se pudo leer el archivo')
        return
      }

      // Strip BOM if present
      if (text.charCodeAt(0) === 0xFEFF) {
        text = text.slice(1)
      }

      // Strip Excel's "sep=X" directive and detect delimiter from it
      let delimiter: string | undefined
      const lines = text.split(/\r?\n/)
      const sepMatch = lines[0]?.trim().match(/^sep=(.)$/i)
      if (sepMatch) {
        delimiter = sepMatch[1]
        lines.shift()
        text = lines.join('\n')
      }

      // If no sep= directive, auto-detect: check if header has more ; than ,
      if (!delimiter) {
        const headerLine = lines[0] || ''
        const semicolons = (headerLine.match(/;/g) || []).length
        const commas = (headerLine.match(/,/g) || []).length
        delimiter = semicolons > commas ? ';' : ','
      }

      Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        delimiter,
        transformHeader: (header: string) => {
          const trimmed = header.trim()
          const normalized = trimmed
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')

          if (normalized === 'articulo') return 'articulo'
          return trimmed
        },
        complete: (results) => {
          if (results.data.length === 0) {
            toast.error('El archivo está vacío')
            return
          }

          if (results.data.length > 500) {
            toast.error('Máximo 500 productos por archivo')
            return
          }

          const seenSkus = new Set<string>()
          const validated = results.data.map((row, i) =>
            validateRow(row, i, categories, seenSkus)
          )

          setValidatedRows(validated)
          setStep('preview')
        },
        error: () => {
          toast.error('Error al leer el archivo CSV')
        },
      })
    }
    reader.onerror = () => {
      toast.error('Error al leer el archivo')
    }
    reader.readAsText(file, 'UTF-8')
  }, [categories])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleImport = async () => {
    const validProducts = validatedRows.filter(r => r.isValid).map(r => r.data)
    if (validProducts.length === 0) return

    setIsImporting(true)
    const result = await bulkImportProducts(validProducts)
    setIsImporting(false)

    if (result.success && result.data) {
      setImportResult(result.data)
      setStep('results')
      if (result.data.totalCreated > 0) {
        toast.success(`${result.data.totalCreated} productos importados`)
      }
    } else {
      toast.error(result.error || 'Error en la importación')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importación Masiva de Productos
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Sube un archivo CSV con tus productos para importarlos en lote.'}
            {step === 'preview' && 'Revisa los datos antes de importar.'}
            {step === 'results' && 'Resultado de la importación.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4 py-4">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">
                Arrastra un archivo CSV aquí o haz clic para seleccionar
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Máximo 500 productos por archivo
              </p>
              {fileName && (
                <Badge variant="secondary" className="mt-3">
                  {fileName}
                </Badge>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="text-sm">
                <p className="font-medium">Plantilla CSV</p>
                <p className="text-muted-foreground text-xs">
                  Descarga la plantilla con los campos correctos
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
                <Download className="h-4 w-4" />
                Descargar
              </Button>
            </div>

            <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/30 rounded-lg">
              <p className="font-medium text-foreground">Campos requeridos:</p>
              <p>name, category, sku, purchasePrice, salePrice, stock, reorderPoint, entryDate</p>
              <p className="font-medium text-foreground mt-2">Campos opcionales comunes:</p>
              <p>articulo, productType, brand, model, description, barcode, supplier, locationInStore, notes</p>
              <p className="font-medium text-foreground mt-2">Campos por tipo de producto:</p>
              <p>La plantilla incluye todos los campos posibles. Solo llena los que apliquen al tipo de producto.</p>
              <p className="mt-2">La categoría puede ser el nombre o el ID. Las fechas en formato YYYY-MM-DD. El separador del CSV es punto y coma (;).</p>
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && (
          <div className="flex-1 overflow-hidden flex flex-col gap-3 py-2">
            {/* Summary bar */}
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="outline">{validatedRows.length} filas</Badge>
              <Badge variant="default" className="bg-green-600">{validCount} válidas</Badge>
              {errorCount > 0 && (
                <Badge variant="destructive">{errorCount} con errores</Badge>
              )}
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead className="w-10">Estado</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Artículo</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">P. Compra</TableHead>
                    <TableHead className="text-right">P. Venta</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead>Errores</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validatedRows.map((row) => (
                    <TableRow
                      key={row.rowIndex}
                      className={!row.isValid ? 'bg-destructive/5' : ''}
                    >
                      <TableCell className="text-xs text-muted-foreground">{row.rowIndex + 2}</TableCell>
                      <TableCell>
                        {row.isValid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-sm max-w-[150px] truncate">
                        {row.data.name || '-'}
                      </TableCell>
                      <TableCell className="text-sm">{row.data.category || '-'}</TableCell>
                      <TableCell className="text-sm">{row.data.articulo || '-'}</TableCell>
                      <TableCell className="text-sm font-mono">{row.data.sku || '-'}</TableCell>
                      <TableCell className="text-right text-sm">
                        {row.data.purchasePrice != null ? row.data.purchasePrice.toLocaleString() : '-'}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {row.data.salePrice != null ? row.data.salePrice.toLocaleString() : '-'}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {row.data.stock != null ? row.data.stock : '-'}
                      </TableCell>
                      <TableCell>
                        {!row.isValid && (
                          <span className="text-xs text-destructive">
                            {row.errors.join('; ')}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DialogFooter className="flex-row gap-2 sm:justify-between">
              <Button variant="outline" onClick={() => { setStep('upload'); setValidatedRows([]) }} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Volver
              </Button>
              <Button
                onClick={handleImport}
                disabled={validCount === 0 || isImporting}
                className="gap-2"
              >
                {isImporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {isImporting ? 'Importando...' : `Importar ${validCount} productos`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3: Results */}
        {step === 'results' && importResult && (
          <div className="space-y-4 py-4">
            {/* Success card */}
            {importResult.totalCreated > 0 && (
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">
                    {importResult.totalCreated} productos creados exitosamente
                  </p>
                </div>
              </div>
            )}

            {/* Failures card */}
            {importResult.totalFailed > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
                  <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-red-800 dark:text-red-200">
                      {importResult.totalFailed} productos fallaron
                    </p>
                  </div>
                </div>

                <div className="max-h-48 overflow-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Fila</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResult.errors.map((err, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{err.row}</TableCell>
                          <TableCell className="text-sm font-mono">{err.sku}</TableCell>
                          <TableCell className="text-sm text-destructive">{err.error}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadErrorReport(importResult.errors)}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Descargar reporte de errores
                </Button>
              </div>
            )}

            <DialogFooter>
              <Button onClick={() => handleClose(false)}>
                Cerrar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
