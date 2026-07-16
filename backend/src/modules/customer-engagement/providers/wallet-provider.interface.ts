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
}

export interface WalletProvider {
  readonly name: string;
  createPass(data: WalletPassData, tenantId: string): Promise<string>;
  updatePass(walletId: string, data: Partial<WalletPassData>): Promise<void>;
  revokePass(walletId: string): Promise<void>;
  getSaveUrl(walletId: string): Promise<string>;
}
