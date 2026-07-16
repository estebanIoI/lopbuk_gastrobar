import { WalletProvider, WalletPassData } from './wallet-provider.interface';

const GOOGLE_WALLET_API = 'https://walletobjects.googleapis.com/walletobjects/v1';

export class GoogleWalletProvider implements WalletProvider {
  readonly name = 'google';

  constructor(
    private issuerId: string,
    private credentials: { client_email: string; private_key: string },
  ) {}

  private async getAccessToken(): Promise<string> {
    const { JWT } = await import('google-auth-library');
    const jwt = new JWT({
      email: this.credentials.client_email,
      key: this.credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
    });
    const token = await jwt.authorize();
    return token.access_token!;
  }

  private async request(method: string, path: string, body?: any): Promise<any> {
    const token = await this.getAccessToken();
    const res = await fetch(`${GOOGLE_WALLET_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google Wallet API error ${res.status}: ${text}`);
    }
    return res.json();
  }

  private classId(tenantId: string): string {
    return `${this.issuerId}.lopbuk-class-${tenantId}`;
  }

  private objectId(accountId: string): string {
    return `${this.issuerId}.lopbuk-${accountId}`;
  }

  private buildLoyaltyClass(data: WalletPassData, tenantId: string) {
    return {
      id: this.classId(tenantId),
      issuerName: 'Lopbuk',
      programName: data.businessName,
      programLogo: { sourceUri: { uri: data.businessLogo } },
      hexBackgroundColor: data.primaryColor.replace('#', ''),
      localizedProgramName: {
        defaultValue: { language: 'es', value: data.businessName },
      },
      localizedShortDescription: {
        defaultValue: { language: 'es', value: data.shortDescription },
      },
      reviewStatus: 'UNDER_REVIEW',
    };
  }

  private buildLoyaltyObject(data: WalletPassData, tenantId: string) {
    const levelLabels: Record<string, string> = {
      bronze: 'Bronce', silver: 'Plata', gold: 'Oro', platinum: 'Platino',
    };
    return {
      id: this.objectId(data.accountId),
      classId: this.classId(tenantId),
      state: 'ACTIVE',
      barcode: { type: 'QR_CODE', value: data.qrPayload },
      accountId: data.phone,
      accountName: data.accountName || data.phone,
      loyaltyPoints: {
        balance: { string: data.pointsBalance.toString() },
        label: 'Puntos',
      },
      secondaryLoyaltyPoints: {
        balance: { string: levelLabels[data.level] || data.level },
        label: 'Nivel',
      },
      textModulesData: [
        { header: 'Visitas', body: data.visits.toString() },
        { header: 'Total gastado', body: `$${data.totalSpent.toLocaleString('es-CO')}` },
        ...(data.lastVisit ? [{ header: 'Última visita', body: data.lastVisit }] : []),
      ],
      linksModuleData: {
        uris: [{ uri: data.storeUrl, description: 'Ver tienda' }],
      },
    };
  }

  async createPass(data: WalletPassData, tenantId: string): Promise<string> {
    await this.request('POST', '/loyaltyClass', this.buildLoyaltyClass(data, tenantId)).catch(() => {});
    const obj = await this.request('POST', '/loyaltyObject', this.buildLoyaltyObject(data, tenantId));
    return `https://pay.google.com/gp/v/save/${obj.id}`;
  }

  async updatePass(walletId: string, data: Partial<WalletPassData>): Promise<void> {
    await this.request('PATCH', `/loyaltyObject/${walletId}`, data);
  }

  async revokePass(walletId: string): Promise<void> {
    await this.request('POST', `/loyaltyObject/${walletId}?method=expire`, {});
  }

  async getSaveUrl(walletId: string): Promise<string> {
    return `https://pay.google.com/gp/v/save/${walletId}`;
  }

  async ensureClass(data: WalletPassData, tenantId: string): Promise<void> {
    try {
      await this.request('GET', `/loyaltyClass/${this.classId(tenantId)}`);
    } catch {
      await this.request('POST', '/loyaltyClass', this.buildLoyaltyClass(data, tenantId));
    }
  }
}

let instance: GoogleWalletProvider | null = null;

export async function getWalletProvider(): Promise<WalletProvider | null> {
  if (instance) return instance;
  try {
    const { default: pool } = await import('../../../config/database');
    const [rows] = (await pool.query(
      "SELECT config_value FROM platform_settings WHERE config_key = 'google_wallet_credentials'"
    )) as any;
    if (!rows?.[0]?.config_value) return null;
    const creds = typeof rows[0].config_value === 'string'
      ? JSON.parse(rows[0].config_value)
      : rows[0].config_value;
    if (!creds?.issuerId || !creds?.client_email) return null;
    instance = new GoogleWalletProvider(creds.issuerId, creds);
  } catch {
    return null;
  }
  return instance;
}
