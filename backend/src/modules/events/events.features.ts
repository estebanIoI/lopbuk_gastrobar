import { db } from '../../config';
import { RowDataPacket } from 'mysql2';

interface TenantFeatures {
  events: {
    enabled: boolean;
    dynamicPricing: boolean;
    coupons: boolean;
    wallet: boolean;
    transfer: boolean;
    marketplace: boolean;
    checkinOffline: boolean;
    waitlist: boolean;
  };
}

const DEFAULTS: TenantFeatures['events'] = {
  enabled: true,
  dynamicPricing: false,
  coupons: false,
  wallet: false,
  transfer: false,
  marketplace: true,
  checkinOffline: false,
  waitlist: false,
};

export async function getTenantEventFeatures(tenantId: string): Promise<TenantFeatures['events']> {
  try {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT setting_value FROM platform_settings WHERE setting_key = ? LIMIT 1`,
      [`tenant_${tenantId}_event_features`]
    );
    if (rows.length && (rows[0] as any).setting_value) {
      return { ...DEFAULTS, ...JSON.parse((rows[0] as any).setting_value) };
    }
  } catch {}
  return { ...DEFAULTS };
}

export async function setTenantEventFeatures(tenantId: string, features: Partial<TenantFeatures['events']>): Promise<void> {
  const current = await getTenantEventFeatures(tenantId);
  const merged = { ...current, ...features };
  await db.query(
    `INSERT INTO platform_settings (setting_key, setting_value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [`tenant_${tenantId}_event_features`, JSON.stringify(merged)]
  );
}

export async function hasFeature(tenantId: string, feature: keyof TenantFeatures['events']): Promise<boolean> {
  const features = await getTenantEventFeatures(tenantId);
  return !!features[feature];
}
