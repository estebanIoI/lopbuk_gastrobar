/**
 * Alegra (facturación electrónica) — stub de integración.
 *
 * El módulo todavía no está implementado. Este stub existe para que el import
 * dinámico en orders.routes.ts resuelva y compile. `createInvoice` es no-op
 * (la factura electrónica se marca como "no crítica" en el flujo de pedidos).
 *
 * TODO: implementar el cliente real de la API de Alegra cuando se habilite la
 * facturación electrónica para el tenant.
 */

export interface AlegraInvoiceItem {
  name: string;
  quantity: number;
  price: number;
  applyTax?: boolean;
}

export interface AlegraInvoicePayload {
  tenantId: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerCedula?: string;
  date: string;
  items: AlegraInvoiceItem[];
  observations?: string;
}

export const alegraService = {
  /**
   * Crea una factura electrónica en Alegra.
   * Stub: registra la intención y retorna sin efecto hasta que se implemente.
   */
  async createInvoice(payload: AlegraInvoicePayload): Promise<{ skipped: true }> {
    console.warn(
      `[alegra] createInvoice stub — integración no implementada (tenant=${payload.tenantId}, factura=${payload.invoiceNumber})`
    );
    return { skipped: true };
  },
};
