'use client'

import { useState, useRef, useCallback } from 'react'
import Papa from 'papaparse'
import { api } from '@/lib/api'
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
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ArrowLeft,
} from 'lucide-react'
import { toast } from 'sonner'

const CSV_TEMPLATE_HEADERS = ['cedula', 'name', 'phone', 'email', 'address', 'creditLimit', 'deudaTotal', 'abonosTotal', 'notes']

interface RowValidation {
  rowIndex: number
  data: Record<string, any>
  isValid: boolean
  errors: string[]
}

function validateRow(rawRow: Record<string, string>, rowIndex: number, seenCedulas: Set<string>): RowValidation {
  const errors: string[] = []
  const data: Record<string, any> = {}

  // Required: cedula
  const cedula = rawRow.cedula?.trim()
  if (!cedula || cedula.length < 5 || cedula.length > 20) {
    errors.push('Cédula requerida (5-20 caracteres)')
  } else {
    data.cedula = cedula
    if (seenCedulas.has(cedula)) errors.push(`Cédula "${cedula}" duplicada en el archivo`)
    else seenCedulas.add(cedula)
  }

  // Required: name
  if (!rawRow.name?.trim()) errors.push('Nombre requerido')
  else data.name = rawRow.name.trim()

  // Optional: phone
  if (rawRow.phone?.trim()) data.phone = rawRow.phone.trim()

  // Optional: email
  if (rawRow.email?.trim()) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawRow.email.trim())) {
      errors.push('Email inválido')
    } else {
      data.email = rawRow.email.trim()
    }
  }

  // Optional: address
  if (rawRow.address?.trim()) data.address = rawRow.address.trim()

  // Optional: creditLimit
  if (rawRow.creditLimit?.trim()) {
    const cl = parseFloat(rawRow.creditLimit)
    if (isNaN(cl) || cl < 0) errors.push('Límite de crédito inválido')
    else data.creditLimit = cl
  }

  // Optional: deudaTotal
  if (rawRow.deudaTotal?.trim()) {
    const dt = parseFloat(rawRow.deudaTotal)
    if (isNaN(dt) || dt < 0) errors.push('Deuda total inválida')
    else data.deudaTotal = dt
  }

  // Optional: abonosTotal
  if (rawRow.abonosTotal?.trim()) {
    const at = parseFloat(rawRow.abonosTotal)
    if (isNaN(at) || at < 0) errors.push('Abonos total inválido')
    else data.abonosTotal = at
    if (data.abonosTotal > (data.deudaTotal ?? 0)) errors.push('Los abonos no pueden superar la deuda total')
  }

  // Optional: notes
  if (rawRow.notes?.trim()) data.notes = rawRow.notes.trim()

  return { rowIndex, data, isValid: errors.length === 0, errors }
}

function downloadTemplate() {
  const SEP = ';'
  const headerRow = CSV_TEMPLATE_HEADERS.join(SEP)
  const exampleRow = ['123456789', 'María García', '3001234567', 'maria@email.com', 'Calle 10 #5-20', '500000', '150000', '50000', 'Cliente frecuente'].join(SEP)
  const bom = '\uFEFF'
  const csv = `${bom}sep=${SEP}\n${headerRow}\n${exampleRow}\n`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'plantilla_clientes.csv'
  a.click()
  URL.revokeObjectURL(url)
}

type Step = 'upload' | 'preview' | 'results'

interface ImportResult {
  totalCreated: number
  totalFailed: number
  errors: Array<{ row: number; cedula: string; error: string }>
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

export function BulkUploadCustomersDialog({ open, onOpenChange, onImported }: Props) {
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
    const reader = new FileReader()
    reader.onload = (e) => {
      let text = e.target?.result as string
      if (!text) { toast.error('No se pudo leer el archivo'); return }
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)

      let delimiter: string | undefined
      const lines = text.split(/\r?\n/)
      const sepMatch = lines[0]?.trim().match(/^sep=(.)$/i)
      if (sepMatch) { delimiter = sepMatch[1]; lines.shift(); text = lines.join('\n') }
      if (!delimiter) {
        const headerLine = lines[0] || ''
        delimiter = (headerLine.match(/;/g) || []).length > (headerLine.match(/,/g) || []).length ? ';' : ','
      }

      Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        delimiter,
        transformHeader: (h: string) => h.trim(),
        complete: (results) => {
          if (results.data.length === 0) { toast.error('El archivo está vacío'); return }
          if (results.data.length > 500) { toast.error('Máximo 500 clientes por archivo'); return }
          const seenCedulas = new Set<string>()
          setValidatedRows(results.data.map((row, i) => validateRow(row, i, seenCedulas)))
          setStep('preview')
        },
        error: () => toast.error('Error al leer el archivo CSV'),
      })
    }
    reader.onerror = () => toast.error('Error al leer el archivo')
    reader.readAsText(file, 'UTF-8')
  }, [])

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
    const validCustomers = validatedRows.filter(r => r.isValid).map(r => r.data)
    if (validCustomers.length === 0) return
    setIsImporting(true)
    const result = await api.bulkCreateCustomers(validCustomers)
    setIsImporting(false)
    if (result.success && result.data) {
      setImportResult(result.data)
      setStep('results')
      if (result.data.totalCreated > 0) {
        toast.success(`${result.data.totalCreated} clientes importados`)
        onImported()
      }
    } else {
      toast.error(result.error || 'Error en la importación')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Importación Masiva de Clientes
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Sube un archivo CSV con tus clientes para importarlos en lote.'}
            {step === 'preview' && 'Revisa los datos antes de importar.'}
            {step === 'results' && 'Resultado de la importación.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4 py-4">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">Arrastra un archivo CSV aquí o haz clic para seleccionar</p>
              <p className="text-xs text-muted-foreground mt-1">Máximo 500 clientes por archivo</p>
              {fileName && <Badge variant="secondary" className="mt-3">{fileName}</Badge>}
              <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="text-sm">
                <p className="font-medium">Plantilla CSV</p>
                <p className="text-muted-foreground text-xs">Descarga la plantilla con los campos correctos</p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
                <Download className="h-4 w-4" />
                Descargar
              </Button>
            </div>

            <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/30 rounded-lg">
              <p className="font-medium text-foreground">Campos requeridos:</p>
              <p>cedula, name</p>
              <p className="font-medium text-foreground mt-2">Campos opcionales:</p>
              <p>phone, email, address, creditLimit, notes</p>
              <p className="font-medium text-foreground mt-2">Para migrar saldos del sistema anterior:</p>
              <p><strong>deudaTotal</strong> — total que debe el cliente. <strong>abonosTotal</strong> — lo que ya ha pagado de esa deuda.</p>
              <p className="mt-2">El separador del CSV es punto y coma (;). La cédula debe ser única por cliente.</p>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="flex-1 overflow-hidden flex flex-col gap-3 py-2">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="outline">{validatedRows.length} filas</Badge>
              <Badge variant="default" className="bg-green-600">{validCount} válidas</Badge>
              {errorCount > 0 && <Badge variant="destructive">{errorCount} con errores</Badge>}
            </div>

            <div className="flex-1 overflow-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead className="w-10">Estado</TableHead>
                    <TableHead>Cédula</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead className="text-right">Deuda total</TableHead>
                    <TableHead className="text-right">Abonado</TableHead>
                    <TableHead>Errores</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validatedRows.map((row) => (
                    <TableRow key={row.rowIndex} className={!row.isValid ? 'bg-destructive/5' : ''}>
                      <TableCell className="text-xs text-muted-foreground">{row.rowIndex + 2}</TableCell>
                      <TableCell>
                        {row.isValid ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-destructive" />}
                      </TableCell>
                      <TableCell className="text-sm font-mono">{row.data.cedula || '-'}</TableCell>
                      <TableCell className="font-medium text-sm max-w-[140px] truncate">{row.data.name || '-'}</TableCell>
                      <TableCell className="text-sm">{row.data.phone || '-'}</TableCell>
                      <TableCell className="text-right text-sm">{row.data.deudaTotal != null ? row.data.deudaTotal.toLocaleString() : '-'}</TableCell>
                      <TableCell className="text-right text-sm">{row.data.abonosTotal != null ? row.data.abonosTotal.toLocaleString() : '-'}</TableCell>
                      <TableCell>
                        {!row.isValid && <span className="text-xs text-destructive">{row.errors.join('; ')}</span>}
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
              <Button onClick={handleImport} disabled={validCount === 0 || isImporting} className="gap-2">
                {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {isImporting ? 'Importando...' : `Importar ${validCount} clientes`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'results' && importResult && (
          <div className="space-y-4 py-4">
            {importResult.totalCreated > 0 && (
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
                <p className="font-medium text-green-800 dark:text-green-200">
                  {importResult.totalCreated} clientes creados exitosamente
                </p>
              </div>
            )}

            {importResult.totalFailed > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
                  <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
                  <p className="font-medium text-red-800 dark:text-red-200">{importResult.totalFailed} clientes fallaron</p>
                </div>
                <div className="max-h-48 overflow-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Fila</TableHead>
                        <TableHead>Cédula</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResult.errors.map((err, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{err.row}</TableCell>
                          <TableCell className="text-sm font-mono">{err.cedula}</TableCell>
                          <TableCell className="text-sm text-destructive">{err.error}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button onClick={() => handleClose(false)}>Cerrar</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
