export interface WalletPassData {
  accountId: string;
  accountName: string;
  phone: string;
  pointsBalance: number;
  level: string;
  levelColor: string;
  visits: number;
  totalSpent: number;
  lastVisit: string | null;
  businessName: string;
  businessLogo: string;
  primaryColor: string;
  shortDescription: string;
  qrPayload: string;
  storeUrl: string;
  /**
   * Ubicaciones del negocio (lat/lng). Google Wallet las usa como geofence: al
   * acercarse el cliente, el pase aparece solo en la pantalla de bloqueo. Sin
   * esto el pase existe pero NUNCA se muestra por proximidad.
   * El radio lo decide Google (no es configurable desde el pase).
   */
  locations?: Array<{ latitude: number; longitude: number }>;
}

export interface WalletProvider {
  readonly name: string;
  createPass(data: WalletPassData, tenantId: string): Promise<string>;
  updatePass(walletId: string, data: Partial<WalletPassData>): Promise<void>;
  revokePass(walletId: string): Promise<void>;
  getSaveUrl(walletId: string): Promise<string>;
}
