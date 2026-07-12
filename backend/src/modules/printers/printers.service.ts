import { v4 as uuidv4 } from 'uuid';
import * as net from 'net';
import { db } from '../../config';
import { AppError } from '../../common/middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

// ─── Interfaces ────────────────────────────────────────────────────────────────

export type ConnectionType = 'lan' | 'usb' | 'bluetooth';
export type PaperWidth = 58 | 80;
export type PrinterModule = 'caja' | 'cocina' | 'bar' | 'factura';

export interface Printer {
  id: string;
  tenantId: string;
  name: string;
  connectionType: ConnectionType;
  ip: string | null;
  port: number;
  paperWidth: PaperWidth;
  isActive: boolean;
  assignedModule: PrinterModule | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePrinterData {
  name: string;
  connectionType: ConnectionType;
  ip?: string;
  port?: number;
  paperWidth?: PaperWidth;
  assignedModule?: PrinterModule;
}

export interface UpdatePrinterData {
  name?: string;
  connectionType?: ConnectionType;
  ip?: string;
  port?: number;
  paperWidth?: PaperWidth;
  isActive?: boolean;
  assignedModule?: PrinterModule | null;
}

export interface PrintTicketData {
  storeName: string;
  invoiceNumber: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  amountPaid: number;
  change: number;
  notes?: string;
  footerText?: string;
}

export interface KitchenTicketData {
  storeName: string;
  area: string;
  orderNumber: string;
  tableNumber: string;
  waiterName: string;
  items: Array<{ name: string; qty: number; notes: string | null }>;
}

interface PrinterRow extends RowDataPacket {
  id: string;
  tenant_id: string;
  name: string;
  connection_type: ConnectionType;
  ip: string | null;
  port: number;
  paper_width: number;
  is_active: boolean | number;
  assigned_module: PrinterModule | null;
  created_at: Date;
  updated_at: Date;
}

// ─── ESC/POS command builder ───────────────────────────────────────────────────

class EscPos {
  private buf: number[] = [];

  // Control
  init()          { this.buf.push(0x1b, 0x40); return this; }
  cut()           { this.buf.push(0x1d, 0x56, 0x42, 0x00); return this; }
  feed(lines = 1) { for (let i = 0; i < lines; i++) this.buf.push(0x0a); return this; }

  // Alignment
  left()   { this.buf.push(0x1b, 0x61, 0x00); return this; }
  center() { this.buf.push(0x1b, 0x61, 0x01); return this; }
  right()  { this.buf.push(0x1b, 0x61, 0x02); return this; }

  // Style
  bold(on: boolean)    { this.buf.push(0x1b, 0x45, on ? 0x01 : 0x00); return this; }
  doubleH(on: boolean) { this.buf.push(0x1b, 0x21, on ? 0x10 : 0x00); return this; }

  // Text
  text(str: string) {
    for (let i = 0; i < str.length; i++) {
      this.buf.push(str.charCodeAt(i) & 0xff);
    }
    return this;
  }
  line(str: string) { return this.text(str).feed(); }

  // Separator
  separator(width = 32) { return this.line('-'.repeat(width)); }

  toBuffer(): Buffer {
    return Buffer.from(this.buf);
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function mapRow(row: PrinterRow): Printer {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    connectionType: row.connection_type,
    ip: row.ip,
    port: row.port,
    paperWidth: row.paper_width as PaperWidth,
    isActive: Boolean(row.is_active),
    assignedModule: row.assigned_module,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('es-CO')}`;
}

function padRight(str: string, width: number): string {
  return str.length >= width ? str.substring(0, width) : str + ' '.repeat(width - str.length);
}

function padLeft(str: string, width: number): string {
  return str.length >= width ? str.substring(0, width) : ' '.repeat(width - str.length) + str;
}

// ─── TCP send ──────────────────────────────────────────────────────────────────

function sendToLanPrinter(ip: string, port: number, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    const timeout = 5000;

    client.setTimeout(timeout);
    client.connect(port, ip, () => {
      client.write(data, () => {
        client.end();
        resolve();
      });
    });

    client.on('timeout', () => {
      client.destroy();
      reject(new Error(`Timeout conectando a ${ip}:${port}`));
    });

    client.on('error', (err) => {
      reject(new Error(`Error TCP: ${err.message}`));
    });
  });
}

// ─── Ticket builder ────────────────────────────────────────────────────────────

function buildSaleTicket(data: PrintTicketData, paperWidth: PaperWidth): Buffer {
  const cols = paperWidth === 80 ? 42 : 32;
  const esc = new EscPos().init();

  esc.center().bold(true).doubleH(true).line(data.storeName.substring(0, cols)).doubleH(false).bold(false);
  esc.separator(cols);
  esc.center().line(`Pedido #${data.invoiceNumber}`);
  esc.separator(cols);
  esc.left();

  for (const item of data.items) {
    const qty = `${item.quantity}x`;
    const price = formatCurrency(item.price * item.quantity);
    const nameMaxLen = cols - qty.length - price.length - 2;
    const name = item.name.length > nameMaxLen ? item.name.substring(0, nameMaxLen) : padRight(item.name, nameMaxLen);
    esc.line(`${qty} ${name} ${padLeft(price, price.length)}`);
  }

  esc.separator(cols);

  const subtotalLabel = padRight('Subtotal:', cols - 12);
  const taxLabel      = padRight('IVA:', cols - 12);
  const totalLabel    = padRight('TOTAL:', cols - 12);
  esc.line(`${subtotalLabel}${padLeft(formatCurrency(data.subtotal), 12)}`);
  esc.line(`${taxLabel}${padLeft(formatCurrency(data.tax), 12)}`);
  esc.bold(true).line(`${totalLabel}${padLeft(formatCurrency(data.total), 12)}`).bold(false);

  esc.separator(cols);
  esc.line(`Pago: ${data.paymentMethod}`);
  esc.line(`Efectivo: ${formatCurrency(data.amountPaid)}`);
  esc.line(`Cambio:   ${formatCurrency(data.change)}`);

  if (data.notes) {
    esc.separator(cols).center().line(data.notes);
  }

  esc.separator(cols);
  esc.center().line(data.footerText || 'Gracias por su compra').feed(3).cut();

  return esc.toBuffer();
}

function buildTestTicket(printerName: string, paperWidth: PaperWidth): Buffer {
  const cols = paperWidth === 80 ? 42 : 32;
  const esc = new EscPos().init();

  esc.center().bold(true).doubleH(true).line('PRUEBA DE IMPRESION').doubleH(false).bold(false);
  esc.separator(cols);
  esc.center().line('Sistema POS').line(printerName).separator(cols).line('Configuracion correcta').feed(3).cut();

  return esc.toBuffer();
}

function buildKitchenTicket(data: KitchenTicketData, paperWidth: PaperWidth): Buffer {
  const cols = paperWidth === 80 ? 42 : 32;
  const esc = new EscPos().init();

  esc.center().bold(true).doubleH(true).line(data.storeName.substring(0, cols)).doubleH(false).bold(false);
  esc.separator(cols);
  esc.center().bold(true).line(`${data.area}  -  Comanda #${data.orderNumber}`).bold(false);
  esc.line(`Mesa: ${data.tableNumber}  |  Mesero: ${data.waiterName}`);
  esc.separator(cols);

  for (const item of data.items) {
    const qtyText = `${item.qty}x`;
    const nameMax = cols - qtyText.length - 1;
    const name = item.name.length > nameMax ? item.name.substring(0, nameMax) : item.name;
    esc.line(`${qtyText} ${name}`);
    if (item.notes) {
      esc.line(`   > ${item.notes.substring(0, cols - 5)}`);
    }
  }

  esc.separator(cols);
  const now = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', hour12: false });
  esc.center().line(now);
  esc.separator(cols);
  esc.feed(2).cut();

  return esc.toBuffer();
}

// ─── Service ───────────────────────────────────────────────────────────────────

class PrintersService {

  async findAll(tenantId: string): Promise<Printer[]> {
    const [rows] = await db.execute<PrinterRow[]>(
      'SELECT * FROM printers WHERE tenant_id = ? ORDER BY created_at ASC',
      [tenantId]
    );
    return rows.map(mapRow);
  }

  async findById(id: string, tenantId: string): Promise<Printer> {
    const [rows] = await db.execute<PrinterRow[]>(
      'SELECT * FROM printers WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (rows.length === 0) throw new AppError('Impresora no encontrada', 404);
    return mapRow(rows[0]);
  }

  async findByModule(module: PrinterModule, tenantId: string): Promise<Printer | null> {
    const [rows] = await db.execute<PrinterRow[]>(
      'SELECT * FROM printers WHERE assigned_module = ? AND tenant_id = ? AND is_active = 1 LIMIT 1',
      [module, tenantId]
    );
    return rows.length > 0 ? mapRow(rows[0]) : null;
  }

  async create(tenantId: string, data: CreatePrinterData): Promise<Printer> {
    const id = uuidv4();
    await db.execute<ResultSetHeader>(
      `INSERT INTO printers (id, tenant_id, name, connection_type, ip, port, paper_width, is_active, assigned_module)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        id,
        tenantId,
        data.name,
        data.connectionType,
        data.ip ?? null,
        data.port ?? 9100,
        data.paperWidth ?? 80,
        data.assignedModule ?? null,
      ]
    );
    return this.findById(id, tenantId);
  }

  async update(id: string, tenantId: string, data: UpdatePrinterData): Promise<Printer> {
    await this.findById(id, tenantId); // existence check

    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined)            { fields.push('name = ?');             values.push(data.name); }
    if (data.connectionType !== undefined)  { fields.push('connection_type = ?');  values.push(data.connectionType); }
    if (data.ip !== undefined)              { fields.push('ip = ?');               values.push(data.ip); }
    if (data.port !== undefined)            { fields.push('port = ?');             values.push(data.port); }
    if (data.paperWidth !== undefined)      { fields.push('paper_width = ?');      values.push(data.paperWidth); }
    if (data.isActive !== undefined)        { fields.push('is_active = ?');        values.push(data.isActive ? 1 : 0); }
    if ('assignedModule' in data)           { fields.push('assigned_module = ?');  values.push(data.assignedModule ?? null); }

    if (fields.length === 0) throw new AppError('No hay campos para actualizar', 400);

    values.push(id, tenantId);
    await db.execute(
      `UPDATE printers SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`,
      values
    );
    return this.findById(id, tenantId);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.findById(id, tenantId);
    await db.execute('DELETE FROM printers WHERE id = ? AND tenant_id = ?', [id, tenantId]);
  }

  async testPrint(id: string, tenantId: string): Promise<{ message: string }> {
    const printer = await this.findById(id, tenantId);
    if (!printer.isActive) throw new AppError('La impresora está desactivada', 400);
    return this._sendToPrinter(printer, buildTestTicket(printer.name, printer.paperWidth));
  }

  async printTicket(printerId: string, tenantId: string, data: PrintTicketData): Promise<{ message: string }> {
    const printer = await this.findById(printerId, tenantId);
    if (!printer.isActive) throw new AppError('La impresora está desactivada', 400);
    return this._sendToPrinter(printer, buildSaleTicket(data, printer.paperWidth));
  }

  async printTicketByModule(module: PrinterModule, tenantId: string, data: PrintTicketData): Promise<{ message: string }> {
    const printer = await this.findByModule(module, tenantId);
    if (!printer) throw new AppError(`No hay impresora asignada al módulo "${module}"`, 404);
    return this._sendToPrinter(printer, buildSaleTicket(data, printer.paperWidth));
  }

  async printKitchenOrder(module: PrinterModule, tenantId: string, data: KitchenTicketData): Promise<{ message: string }> {
    const printer = await this.findByModule(module, tenantId);
    if (!printer) return { message: `Sin impresora asignada a "${module}"` };
    return this._sendToPrinter(printer, buildKitchenTicket(data, printer.paperWidth));
  }

  /**
   * Encola un ticket de cocina/bar para que lo imprima el Agente de Impresión local
   * (impresoras LAN detrás de una red privada, inalcanzables desde la nube). Arma el ESC/POS
   * con la config de la impresora del módulo y lo inserta en print_jobs. Si no hay impresora
   * LAN con IP para ese módulo, no encola nada (no rompe el flujo del pedido).
   */
  async enqueueKitchenJob(module: PrinterModule, tenantId: string, data: KitchenTicketData): Promise<{ queued: boolean }> {
    const printer = await this.findByModule(module, tenantId);
    if (!printer || printer.connectionType !== 'lan' || !printer.ip) return { queued: false };
    const buffer = buildKitchenTicket(data, printer.paperWidth);
    await db.execute(
      `INSERT INTO print_jobs (id, tenant_id, module, printer_ip, printer_port, data_base64)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), tenantId, module, printer.ip, printer.port, buffer.toString('base64')]
    );
    return { queued: true };
  }

  private async _sendToPrinter(printer: Printer, data: Buffer): Promise<{ message: string }> {
    if (printer.connectionType === 'lan') {
      if (!printer.ip) throw new AppError('La impresora LAN no tiene IP configurada', 400);
      await sendToLanPrinter(printer.ip, printer.port, data);
      return { message: `Ticket enviado a ${printer.name} (${printer.ip}:${printer.port})` };
    }

    // USB / Bluetooth: return ticket as base64 for local print bridge
    return {
      message: `Ticket generado para ${printer.name}. Conexión ${printer.connectionType} requiere servicio local.`,
    };
  }
}

export const printersService = new PrintersService();
