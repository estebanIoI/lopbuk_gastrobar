'use client'

/**
 * DataTable — tabla genérica ligera para listados del panel superadmin
 * (pedidos, ranking de comercios…). Config por columnas + filas tipadas.
 */
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export interface Column<T> {
  key: string
  header: React.ReactNode
  /** Render de la celda; por defecto muestra row[key]. */
  cell?: (row: T) => React.ReactNode
  className?: string
  align?: 'left' | 'right' | 'center'
}

export function DataTable<T extends Record<string, any>>({
  columns, rows, rowKey, onRowClick, empty = 'Sin datos',
}: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  onRowClick?: (row: T) => void
  empty?: React.ReactNode
}) {
  const alignCls = (a?: string) => a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left'
  return (
    <Table variant="glass">
      <TableHeader>
        <TableRow>
          {columns.map(c => (
            <TableHead key={c.key} className={`${alignCls(c.align)} ${c.className || ''}`}>{c.header}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8">{empty}</TableCell>
          </TableRow>
        ) : rows.map(row => (
          <TableRow
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={onRowClick ? 'cursor-pointer' : undefined}
          >
            {columns.map(c => (
              <TableCell key={c.key} className={`${alignCls(c.align)} ${c.className || ''}`}>
                {c.cell ? c.cell(row) : row[c.key]}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
