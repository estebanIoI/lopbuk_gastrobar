/**
 * ============================================================================
 *  ENTITLEMENTS — Catálogo (data-driven, sin enums rígidos)
 * ============================================================================
 * Un usuario (Platform User, tabla `users`) posee múltiples derechos (entitlements).
 * Los derechos se almacenan como STRINGS en `user_entitlements.entitlement`, de modo
 * que agregar uno nuevo NO requiere cambiar el tipo de columna ni romper compatibilidad:
 * basta con añadir la clave aquí (y, si otorga acceso a un espacio, mapearla en WORKSPACE_RULES).
 *
 * Toda autorización de la plataforma se resuelve con estos derechos, NUNCA con `role`.
 */

/** Claves de entitlement conocidas. Extensible: agregar una clave nueva no rompe nada. */
export const ENTITLEMENTS = {
  OS_LEGEND_FREE: 'os_legend_free',
  OS_LEGEND_PRO: 'os_legend_pro',
  MERCHANT_BASIC: 'merchant_basic',
  MERCHANT_PRO: 'merchant_pro',
  MERCHANT_ENTERPRISE: 'merchant_enterprise',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
} as const;

export type EntitlementKey = typeof ENTITLEMENTS[keyof typeof ENTITLEMENTS];

/** Origen de un otorgamiento (auditoría / lógica de revocación). */
export const ENTITLEMENT_SOURCE = {
  DEFAULT: 'default', // otorgado automáticamente al registrarse (OS_LEGEND_FREE)
  PLAN: 'plan',       // derivado del plan comercial del tenant
  MANUAL: 'manual',   // otorgado por un admin
  SYSTEM: 'system',   // migración / backfill
} as const;
export type EntitlementSource = typeof ENTITLEMENT_SOURCE[keyof typeof ENTITLEMENT_SOURCE];

/** Espacios (workspaces) que un usuario puede abrir. */
export const WORKSPACES = {
  CONSUMER_OS: 'consumer_os',
  MERCHANT_DASHBOARD: 'merchant_dashboard',
  ADMIN: 'admin',
  ADMIN_CONSOLE: 'admin_console',
  SUPPORT: 'support',
} as const;
export type WorkspaceKey = typeof WORKSPACES[keyof typeof WORKSPACES];

export interface WorkspaceDef {
  key: WorkspaceKey;
  label: string;
  /** El workspace está disponible si el usuario tiene CUALQUIERA de estos entitlements. */
  requiresAnyOf: EntitlementKey[];
  /** Orden de aparición en el selector. */
  order: number;
}

/**
 * Reglas de derivación espacio ← entitlements (data-driven).
 * El Workspace Selector se construye SOLO desde aquí, nunca desde `role`.
 */
export const WORKSPACE_RULES: WorkspaceDef[] = [
  {
    key: WORKSPACES.CONSUMER_OS,
    label: 'OS Legend',
    requiresAnyOf: [ENTITLEMENTS.OS_LEGEND_FREE, ENTITLEMENTS.OS_LEGEND_PRO],
    order: 1,
  },
  {
    key: WORKSPACES.MERCHANT_DASHBOARD,
    label: 'Mi negocio',
    requiresAnyOf: [ENTITLEMENTS.MERCHANT_BASIC, ENTITLEMENTS.MERCHANT_PRO, ENTITLEMENTS.MERCHANT_ENTERPRISE],
    order: 2,
  },
  {
    key: WORKSPACES.ADMIN,
    label: 'Admin',
    requiresAnyOf: [ENTITLEMENTS.ADMIN, ENTITLEMENTS.SUPER_ADMIN],
    order: 3,
  },
  {
    key: WORKSPACES.ADMIN_CONSOLE,
    label: 'Admin Console',
    requiresAnyOf: [ENTITLEMENTS.SUPER_ADMIN],
    order: 4,
  },
];

/**
 * Planes de entitlements y el BUNDLE exacto que otorga cada uno (regla de negocio obligatoria).
 * - Merchant Enterprise incluye OS Legend Pro (no configurable).
 * - Los demás merchants incluyen OS Legend Free.
 */
export const PLAN_ENTITLEMENTS: Record<string, EntitlementKey[]> = {
  free: [ENTITLEMENTS.OS_LEGEND_FREE],
  merchant_basic: [ENTITLEMENTS.MERCHANT_BASIC, ENTITLEMENTS.OS_LEGEND_FREE],
  merchant_pro: [ENTITLEMENTS.MERCHANT_PRO, ENTITLEMENTS.OS_LEGEND_FREE],
  merchant_enterprise: [ENTITLEMENTS.MERCHANT_ENTERPRISE, ENTITLEMENTS.OS_LEGEND_PRO],
};

/** Mapa del plan legacy del tenant (`tenants.plan`) → plan de entitlements. */
export const TENANT_PLAN_TO_PLAN_KEY: Record<string, keyof typeof PLAN_ENTITLEMENTS> = {
  basico: 'merchant_basic',
  profesional: 'merchant_pro',
  empresarial: 'merchant_enterprise',
};

/** Entitlement de merchant que corresponde a cada plan (para saber si un tenant es merchant). */
export const MERCHANT_ENTITLEMENTS: EntitlementKey[] = [
  ENTITLEMENTS.MERCHANT_BASIC,
  ENTITLEMENTS.MERCHANT_PRO,
  ENTITLEMENTS.MERCHANT_ENTERPRISE,
];
