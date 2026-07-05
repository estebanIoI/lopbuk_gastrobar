/**
 * Redacción de PII para logs y payloads persistidos (Ley 1581 / RGPD).
 * Los logs y webhooks NUNCA deben contener datos personales en claro:
 * un log centralizado con teléfonos/emails es una copia de PII sin retención.
 */

const PII_KEYS = new Set([
  'customer_name', 'customername', 'name', 'full_name', 'fullname',
  'customer_phone', 'customerphone', 'phone', 'phone_number', 'phonenumber', 'telefono',
  'customer_email', 'customeremail', 'email', 'correo',
  'customer_cedula', 'customercedula', 'cedula', 'legal_id', 'legalid', 'document', 'documento',
  'address', 'direccion', 'neighborhood', 'barrio',
  'delivery_latitude', 'delivery_longitude', 'latitude', 'longitude', 'lat', 'lng',
  'user_agent', 'password', 'token', 'authorization',
  // Errores de mysql2: el SQL interpolado contiene los valores del cliente
  'sql', 'sqlmessage',
]);

/** Enmascara un valor dejando una pista mínima para debugging ("31…89"). */
export function maskValue(value: unknown): string {
  const s = String(value ?? '');
  if (s.length <= 4) return '***';
  return `${s.slice(0, 2)}…${s.slice(-2)}`;
}

/**
 * Devuelve una copia del objeto con los campos de PII enmascarados (recursivo).
 * Uso: console.log('Create order error:', redactPII(context))
 */
export function redactPII<T>(input: T, depth = 0): T {
  if (depth > 6 || input == null) return input;
  if (Array.isArray(input)) {
    return input.map((item) => redactPII(item, depth + 1)) as unknown as T;
  }
  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (PII_KEYS.has(key.toLowerCase())) {
        out[key] = maskValue(value);
      } else {
        out[key] = redactPII(value, depth + 1);
      }
    }
    return out as T;
  }
  return input;
}

/**
 * Reduce el payload de un webhook de pasarela (Wompi) a lo mínimo necesario
 * para auditoría de pagos. El evento completo trae email, nombre y datos del
 * método de pago del cliente — duplicar eso en nuestra BD es PII sin control.
 */
export function minimizeGatewayPayload(tx: any): string {
  const minimal = {
    id: tx?.id ?? null,
    status: tx?.status ?? null,
    reference: tx?.reference ?? null,
    amount_in_cents: tx?.amount_in_cents ?? null,
    currency: tx?.currency ?? null,
    payment_method_type: tx?.payment_method_type ?? null,
    finalized_at: tx?.finalized_at ?? null,
    status_message: tx?.status_message ?? null,
  };
  return JSON.stringify(minimal);
}
