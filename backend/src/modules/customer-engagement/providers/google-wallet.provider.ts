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

  /**
   * Geofence de Google Wallet. Con estas coordenadas, el pase aparece solo en la
   * pantalla de bloqueo del cliente cuando está cerca del local. Sin `locations`
   * el pase existe pero nunca se muestra por proximidad.
   *
   * Ojo: el RADIO lo decide Google (~unos cientos de metros) y no es
   * configurable desde el pase. El `geo_radius_meters` del panel aplica al
   * chequeo propio del servidor (checkGeoPush), no a este geofence.
   */
  private buildLocations(data: WalletPassData) {
    const locs = (data.locations || []).filter(
      l => Number.isFinite(l?.latitude) && Number.isFinite(l?.longitude)
        && !(l.latitude === 0 && l.longitude === 0), // 0,0 = coordenada no configurada
    );
    if (locs.length === 0) return undefined; // sin coords → no enviar el campo
    return locs.slice(0, 10).map(l => ({   // Google admite hasta 10 ubicaciones
      kind: 'walletobjects#latLongPoint',
      latitude: Number(l.latitude),
      longitude: Number(l.longitude),
    }));
  }

  private buildLoyaltyClass(data: WalletPassData, tenantId: string) {
    const locations = this.buildLocations(data);
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
      ...(locations ? { locations } : {}),
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
      // También en el objeto: si el negocio mueve su ubicación, el pase del
      // cliente se actualiza sin recrear la clase.
      ...(this.buildLocations(data) ? { locations: this.buildLocations(data) } : {}),
    };
  }

  async createPass(data: WalletPassData, tenantId: string): Promise<string> {
    // ensureClass en vez de un POST que se traga el error: si la clase ya existe
    // hay que ACTUALIZARLA, si no los cambios (incluido el geofence `locations`)
    // nunca llegarían a los comercios que ya tenían pase creado.
    await this.ensureClass(data, tenantId).catch(() => {});
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
    const body = this.buildLoyaltyClass(data, tenantId);
    try {
      await this.request('GET', `/loyaltyClass/${this.classId(tenantId)}`);
      // Ya existe → actualizarla para que tome ubicaciones/colores/nombre nuevos
      await this.request('PATCH', `/loyaltyClass/${this.classId(tenantId)}`, body);
    } catch {
      await this.request('POST', '/loyaltyClass', body);
    }
  }
}

let instance: GoogleWalletProvider | null = null;

export async function getWalletProvider(): Promise<WalletProvider | null> {
  if (instance) return instance;
  try {
    const { default: pool } = await import('../../../config/database');
    // La tabla usa setting_key/setting_value (antes se consultaba config_key/
    // config_value, columnas inexistentes → la query lanzaba, el catch lo tragaba
    // y la wallet quedaba desactivada aunque hubiera credenciales cargadas).
    const [rows] = (await pool.query(
      "SELECT setting_value FROM platform_settings WHERE setting_key = 'google_wallet_credentials' LIMIT 1"
    )) as any;
    if (!rows?.[0]?.setting_value) return null;
    let raw = rows[0].setting_value;
    // Se guarda CIFRADO desde el panel de integraciones. Si viene en texto plano
    // (cargado a mano en BD), decrypt falla y se usa tal cual.
    if (typeof raw === 'string') {
      try {
        const { decrypt } = await import('../../../utils/crypto');
        const dec = decrypt(raw);
        if (dec) raw = dec;
      } catch { /* no estaba cifrado */ }
    }
    const creds = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!creds?.issuerId || !creds?.client_email || !creds?.private_key) return null;
    // Las claves privadas suelen pegarse con "\n" escapados: normalizarlos o el
    // JWT falla con "invalid PEM".
    if (typeof creds.private_key === 'string') {
      creds.private_key = creds.private_key.replace(/\\n/g, '\n');
    }
    instance = new GoogleWalletProvider(creds.issuerId, creds);
  } catch (e) {
    console.error('[wallet] No se pudo cargar el proveedor de Google Wallet:', (e as Error)?.message);
    return null;
  }
  return instance;
}
