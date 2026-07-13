import { v4 as uuidv4 } from 'uuid';
import * as net from 'net';
import { db } from '../../config';
import { AppError } from '../../common/middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

// ─── Interfaces ────────────────────────────────────────────────────────────────

export type ConnectionType = 'lan' | 'usb' | 'bluetooth';
export type PaperWidth = 58 | 80;
export type PrinterModule = 'caja' | 'cocina' | 'bar' | 'factura' | 'cocina_bar';

export interface Printer {
  id: string;
  tenantId: string;
  name: string;
  connectionType: ConnectionType;
  ip: string | null;
  port: number;
  deviceName: string | null;   // USB: nombre de la impresora en Windows
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
  deviceName?: string;
  paperWidth?: PaperWidth;
  assignedModule?: PrinterModule;
}

export interface UpdatePrinterData {
  name?: string;
  connectionType?: ConnectionType;
  ip?: string;
  port?: number;
  deviceName?: string | null;
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

export interface BillTicketData {
  storeName: string;
  tableNumber: string;
  orderNumber: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  total: number;
}

interface PrinterRow extends RowDataPacket {
  id: string;
  tenant_id: string;
  name: string;
  connection_type: ConnectionType;
  ip: string | null;
  port: number;
  device_name: string | null;
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
    deviceName: row.device_name,
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

/** Parte un texto largo en líneas de ancho `width` respetando palabras (para no cortar notas). */
function wrapText(str: string, width: number): string[] {
  const out: string[] = [];
  for (const rawLine of String(str).split('\n')) {
    let cur = '';
    for (const word of rawLine.split(/\s+/).filter(Boolean)) {
      let w = word;
      // Palabra sola más larga que el ancho: se parte en trozos.
      while (w.length > width) {
        if (cur) { out.push(cur); cur = ''; }
        out.push(w.slice(0, width));
        w = w.slice(width);
      }
      if (!cur) cur = w;
      else if ((cur + ' ' + w).length <= width) cur += ' ' + w;
      else { out.push(cur); cur = w; }
    }
    if (cur) out.push(cur);
  }
  return out;
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

  // Ítems en NEGRITA y un poco más grandes (doble alto) para lectura fácil.
  esc.bold(true).doubleH(true);
  for (const item of data.items) {
    const qty = `${item.quantity}x`;
    const price = formatCurrency(item.price * item.quantity);
    const nameMaxLen = cols - qty.length - price.length - 2;
    const name = item.name.length > nameMaxLen ? item.name.substring(0, nameMaxLen) : padRight(item.name, nameMaxLen);
    esc.line(`${qty} ${name} ${padLeft(price, price.length)}`);
  }
  esc.doubleH(false).bold(false);

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
    // Nota en peso normal y con ajuste de línea (no se corta si es larga).
    esc.separator(cols).left().bold(false);
    esc.line('Nota:');
    for (const l of wrapText(data.notes, cols)) esc.line(l);
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

/**
 * Ticket combinado: una sola comanda con las secciones COCINA y BAR juntas, para cuando
 * una misma impresora atiende ambas áreas (assigned_module = 'cocina_bar').
 */
function buildCombinedKitchenTicket(
  data: {
    storeName: string; orderNumber: string; tableNumber: string; waiterName: string;
    cocinaItems: Array<{ name: string; qty: number; notes: string | null }>;
    barItems: Array<{ name: string; qty: number; notes: string | null }>;
  },
  paperWidth: PaperWidth
): Buffer {
  const cols = paperWidth === 80 ? 42 : 32;
  const esc = new EscPos().init();

  esc.center().bold(true).doubleH(true).line(data.storeName.substring(0, cols)).doubleH(false).bold(false);
  esc.separator(cols);
  esc.center().bold(true).line(`Comanda #${data.orderNumber}`).bold(false);
  esc.line(`Mesa: ${data.tableNumber}  |  Mesero: ${data.waiterName}`);

  const section = (title: string, items: Array<{ name: string; qty: number; notes: string | null }>) => {
    if (!items.length) return;
    esc.separator(cols);
    esc.bold(true).line(`>> ${title}`).bold(false);
    for (const item of items) {
      const qtyText = `${item.qty}x`;
      const nameMax = cols - qtyText.length - 1;
      const name = item.name.length > nameMax ? item.name.substring(0, nameMax) : item.name;
      esc.line(`${qtyText} ${name}`);
      if (item.notes) esc.line(`   > ${item.notes.substring(0, cols - 5)}`);
    }
  };
  section('COCINA', data.cocinaItems);
  section('BAR', data.barItems);

  esc.separator(cols);
  const now = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', hour12: false });
  esc.center().line(now);
  esc.separator(cols);
  esc.feed(2).cut();

  return esc.toBuffer();
}

/** Ticket de PRE-CUENTA de mesa (para el cliente): ítems + total, sin ser factura. */
function buildBillTicket(data: BillTicketData, paperWidth: PaperWidth): Buffer {
  const cols = paperWidth === 80 ? 42 : 32;
  const esc = new EscPos().init();

  esc.center().bold(true).doubleH(true).line(data.storeName.substring(0, cols)).doubleH(false).bold(false);
  esc.separator(cols);
  esc.center().bold(true).line('PRE-CUENTA').bold(false);
  esc.center().line(`Mesa: ${data.tableNumber}   ·   #${data.orderNumber}`);
  esc.separator(cols);
  esc.left();

  esc.bold(true).doubleH(true);
  for (const item of data.items) {
    const qty = `${item.quantity}x`;
    const price = formatCurrency(item.price * item.quantity);
    const nameMaxLen = cols - qty.length - price.length - 2;
    const name = item.name.length > nameMaxLen ? item.name.substring(0, nameMaxLen) : padRight(item.name, nameMaxLen);
    esc.line(`${qty} ${name} ${padLeft(price, price.length)}`);
  }
  esc.doubleH(false).bold(false);

  esc.separator(cols);
  const totalLabel = padRight('TOTAL:', cols - 12);
  esc.bold(true).doubleH(true).line(`${totalLabel}${padLeft(formatCurrency(data.total), 12)}`).doubleH(false).bold(false);
  esc.separator(cols);
  esc.center().line('Este documento no es factura').feed(3).cut();

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
      `INSERT INTO printers (id, tenant_id, name, connection_type, ip, port, device_name, paper_width, is_active, assigned_module)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        id,
        tenantId,
        data.name,
        data.connectionType,
        data.ip ?? null,
        data.port ?? 9100,
        data.deviceName ?? null,
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
    if ('deviceName' in data)               { fields.push('device_name = ?');      values.push(data.deviceName ?? null); }
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
    const buffer = buildTestTicket(printer.name, printer.paperWidth);

    // Impresora LAN: el backend en la nube NO alcanza su IP privada → se ENCOLA para que
    // la imprima el Agente de Impresión local (mismo camino que los tickets de cocina/bar).
    // Antes se hacía TCP directo y en producción daba timeout → 500.
    if (printer.connectionType === 'lan') {
      if (!printer.ip) throw new AppError('La impresora LAN no tiene IP configurada', 400);
      await db.execute(
        `INSERT INTO print_jobs (id, tenant_id, module, printer_ip, printer_port, data_base64)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), tenantId, printer.assignedModule || 'caja', printer.ip, printer.port, buffer.toString('base64')]
      );
      const [ag] = await db.execute<RowDataPacket[]>(
        'SELECT 1 FROM print_agents WHERE tenant_id = ? AND last_seen_at > (NOW() - INTERVAL 90 SECOND) LIMIT 1',
        [tenantId]
      );
      return {
        message: ag.length > 0
          ? 'Prueba enviada — debería imprimir en unos segundos.'
          : 'Prueba encolada, pero no hay ningún equipo con el Agente de Impresión conectado. Abre el programa en el PC del local.',
      };
    }

    // USB/Bluetooth: impresión directa (solo si el backend corre en la misma máquina/LAN).
    return this._sendToPrinter(printer, buffer);
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

  /** Resuelve la impresora LAN para un área; prefiere la exacta, si no una 'cocina_bar'. */
  private async resolveAreaPrinter(tenantId: string, area: 'cocina' | 'bar'): Promise<Printer | null> {
    const [rows] = await db.execute<PrinterRow[]>(
      `SELECT * FROM printers
       WHERE tenant_id = ? AND is_active = 1 AND connection_type = 'lan' AND ip IS NOT NULL
         AND assigned_module IN (?, 'cocina_bar')
       ORDER BY (assigned_module = ?) DESC LIMIT 1`,
      [tenantId, area, area]
    );
    return rows.length ? mapRow(rows[0]) : null;
  }

  /** Inserta un trabajo en la cola para que lo recoja el Agente de Impresión local. */
  private async _enqueueJob(tenantId: string, printer: Printer, buffer: Buffer, module: string): Promise<void> {
    const isUsb = printer.connectionType !== 'lan'; // usb | bluetooth → imprime por Windows
    await db.execute(
      `INSERT INTO print_jobs (id, tenant_id, module, connection_type, printer_ip, printer_port, printer_name, data_base64)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(), tenantId, module,
        isUsb ? 'usb' : 'lan',
        isUsb ? null : printer.ip,
        printer.port,
        isUsb ? printer.deviceName : null,
        buffer.toString('base64'),
      ]
    );
  }

  /**
   * Imprime la PRE-CUENTA de una mesa en la impresora asignada al módulo 'caja'.
   * Encola para el Agente local (LAN o USB — USB por el spooler de Windows).
   */
  async printBill(tenantId: string, data: BillTicketData): Promise<{ message: string }> {
    const printer = await this.findByModule('caja', tenantId);
    if (!printer) throw new AppError('No hay impresora asignada a "Caja". Asígnala en el módulo de Impresoras.', 400);
    const isUsb = printer.connectionType !== 'lan';
    if (!isUsb && !printer.ip) throw new AppError('La impresora de Caja (LAN) no tiene IP configurada.', 400);
    if (isUsb && !printer.deviceName) throw new AppError('La impresora de Caja (USB) no tiene el "Nombre en Windows" configurado.', 400);

    await this._enqueueJob(tenantId, printer, buildBillTicket(data, printer.paperWidth), 'cuenta');
    const [ag] = await db.execute<RowDataPacket[]>(
      'SELECT 1 FROM print_agents WHERE tenant_id = ? AND last_seen_at > (NOW() - INTERVAL 90 SECOND) LIMIT 1',
      [tenantId]
    );
    return {
      message: ag.length > 0
        ? 'Cuenta enviada — imprimirá en unos segundos.'
        : 'Cuenta encolada, pero no hay ningún equipo con el Agente de Impresión conectado. Abre el programa en el PC.',
    };
  }

  /**
   * Encola los tickets de cocina/bar de una comanda para el Agente de Impresión local.
   * - Si una MISMA impresora atiende ambas áreas (`assigned_module = 'cocina_bar'`) y hay ítems
   *   de las dos → imprime UN ticket combinado (secciones COCINA + BAR).
   * - Si hay impresoras separadas (o solo un área con ítems) → un ticket por área.
   * Solo aplica a impresoras LAN con IP (las alcanza el agente, no la nube). No rompe el pedido.
   */
  async enqueueOrderTickets(
    tenantId: string,
    base: { storeName: string; orderNumber: string; tableNumber: string; waiterName: string },
    cocinaItems: Array<{ name: string; qty: number; notes: string | null }>,
    barItems: Array<{ name: string; qty: number; notes: string | null }>
  ): Promise<void> {
    const cocinaPrinter = cocinaItems.length ? await this.resolveAreaPrinter(tenantId, 'cocina') : null;
    const barPrinter    = barItems.length    ? await this.resolveAreaPrinter(tenantId, 'bar')    : null;

    if (cocinaPrinter && barPrinter && cocinaPrinter.id === barPrinter.id) {
      const buffer = buildCombinedKitchenTicket({ ...base, cocinaItems, barItems }, cocinaPrinter.paperWidth);
      await this._enqueueJob(tenantId, cocinaPrinter, buffer, 'cocina_bar');
      return;
    }
    if (cocinaPrinter) {
      const buf = buildKitchenTicket({ ...base, area: 'COCINA', items: cocinaItems }, cocinaPrinter.paperWidth);
      await this._enqueueJob(tenantId, cocinaPrinter, buf, 'cocina');
    }
    if (barPrinter) {
      const buf = buildKitchenTicket({ ...base, area: 'BAR', items: barItems }, barPrinter.paperWidth);
      await this._enqueueJob(tenantId, barPrinter, buf, 'bar');
    }
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
