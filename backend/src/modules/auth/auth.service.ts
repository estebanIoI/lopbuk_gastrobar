import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { OAuth2Client } from 'google-auth-library';
import { db, config } from '../../config';
import { User, JWTPayload, UserRole } from '../../common/types';
import { AppError } from '../../common/middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { encryptNullable, decryptNullable } from '../../utils/crypto';

const googleClient = new OAuth2Client(config.google.clientId);

interface UserRow extends RowDataPacket {
  id: string;
  tenant_id: string | null;
  email: string;
  password: string | null;
  name: string;
  role: UserRole;
  avatar: string | null;
  is_active: boolean;
  can_login: boolean;
  auth_provider: 'local' | 'google';
  google_id: string | null;
  // Delivery / profile fields
  phone: string | null;
  cedula: string | null;
  department: string | null;
  municipality: string | null;
  address: string | null;
  neighborhood: string | null;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  profile_completed: boolean;
  created_at: Date;
  updated_at: Date;
}

export class AuthService {
  async login(email: string, password: string): Promise<{ user: Omit<User, 'password'>; token: string }> {
    const [rows] = await db.execute<UserRow[]>(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      throw new AppError('Credenciales invalidas', 401);
    }

    const user = rows[0];

    // If user registered only via Google and has no password
    if (!user.password) {
      throw new AppError('Esta cuenta usa inicio de sesion con Google. Usa el boton de Google para ingresar.', 401);
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      throw new AppError('Credenciales invalidas', 401);
    }

    // Check if user is active
    if (!user.is_active) {
      throw new AppError('Tu cuenta ha sido desactivada. Contacta al administrador.', 403);
    }

    // Check if user is allowed to login (can_login = false for non-system employees)
    if (user.can_login === false) {
      throw new AppError('Tu cuenta no tiene acceso al sistema. Contacta al administrador.', 403);
    }

    // Check if tenant is active (for non-superadmin users)
    if (user.tenant_id && user.role !== 'superadmin') {
      const [tenantRows] = await db.execute<RowDataPacket[]>(
        'SELECT status FROM tenants WHERE id = ?',
        [user.tenant_id]
      );
      if (tenantRows.length > 0 && tenantRows[0].status !== 'activo') {
        throw new AppError('Tu comercio ha sido suspendido. Contacta al administrador de la plataforma.', 403);
      }
    }

    const payload: JWTPayload = {
      userId: user.id,
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenant_id,
    };

    const token = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);

    return {
      user: await this.getProfile(user.id),
      token,
    };
  }

  async register(
    email: string,
    password: string,
    name: string,
    role: UserRole = 'vendedor',
    tenantId?: string | null
  ): Promise<{ user: Omit<User, 'password'>; token: string }> {
    // Verificar si el email ya existe
    const [existing] = await db.execute<UserRow[]>(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      throw new AppError('El email ya esta registrado', 400);
    }

    const id = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);

    await db.execute<ResultSetHeader>(
      'INSERT INTO users (id, tenant_id, email, password, name, role) VALUES (?, ?, ?, ?, ?, ?)',
      [id, tenantId || null, email, hashedPassword, name, role]
    );

    const payload: JWTPayload = {
      userId: id,
      id,
      email,
      name,
      role,
      tenantId: tenantId || null,
    };

    const token = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);

    return {
      user: await this.getProfile(id),
      token,
    };
  }

  async registerClient(
    email: string,
    password: string,
    name: string,
    phone: string | null,
    storeSlug?: string,
    delivery?: {
      cedula?: string; department?: string; municipality?: string;
      address?: string; neighborhood?: string;
    }
  ): Promise<{ user: Omit<User, 'password'>; token: string }> {
    // If storeSlug provided, find tenant; otherwise register as global client (tenant_id = NULL)
    let tenantId: string | null = null;

    if (storeSlug) {
      const [tenantRows] = await db.execute<RowDataPacket[]>(
        'SELECT id FROM tenants WHERE slug = ? AND status = ?',
        [storeSlug, 'activo']
      );

      if ((tenantRows as any[]).length === 0) {
        throw new AppError('Tienda no encontrada', 404);
      }

      tenantId = (tenantRows as any[])[0].id;
    }

    // Check if email already exists
    const [existing] = await db.execute<UserRow[]>(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      throw new AppError('El email ya esta registrado', 400);
    }

    const id = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);

    const profileCompleted = !!(
      delivery?.department && delivery?.municipality && delivery?.address
    ) ? 1 : 0;

    await db.execute<ResultSetHeader>(
      `INSERT INTO users
         (id, tenant_id, email, password, name, role, phone,
          cedula, department, municipality, address, neighborhood, profile_completed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, tenantId, email, hashedPassword, name, 'cliente', phone || null,
        delivery?.cedula   || null,
        delivery?.department   || null,
        delivery?.municipality || null,
        delivery?.address      || null,
        delivery?.neighborhood || null,
        profileCompleted,
      ]
    );

    const payload: JWTPayload = {
      userId: id,
      id,
      email,
      name,
      role: 'cliente' as UserRole,
      tenantId,
    };

    const token = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);

    return {
      user: await this.getProfile(id),
      token,
    };
  }

  async googleLogin(
    credential: string,
    storeSlug?: string
  ): Promise<{ user: Omit<User, 'password'>; token: string }> {
    // Verify Google token
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: config.google.clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new AppError('Token de Google invalido', 401);
    }

    if (!payload || !payload.email) {
      throw new AppError('No se pudo obtener informacion de Google', 401);
    }

    const { email, name, picture, sub: googleId } = payload;

    // Find tenant if storeSlug provided
    let tenantId: string | null = null;
    if (storeSlug) {
      const [tenantRows] = await db.execute<RowDataPacket[]>(
        'SELECT id FROM tenants WHERE slug = ? AND status = ?',
        [storeSlug, 'activo']
      );
      if ((tenantRows as any[]).length > 0) {
        tenantId = (tenantRows as any[])[0].id;
      }
    }

    // Check if user already exists by email
    const [existing] = await db.execute<UserRow[]>(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    let user: UserRow;

    if (existing.length > 0) {
      user = existing[0];

      // If existing user was local, link Google account
      if (!user.google_id) {
        await db.execute(
          'UPDATE users SET google_id = ?, auth_provider = ?, avatar = COALESCE(avatar, ?) WHERE id = ?',
          [googleId, 'google', picture || null, user.id]
        );
      }

      if (!user.is_active) {
        throw new AppError('Tu cuenta ha sido desactivada. Contacta al administrador.', 403);
      }

      // Check tenant status
      if (user.tenant_id && user.role !== 'superadmin') {
        const [tenantRows] = await db.execute<RowDataPacket[]>(
          'SELECT status FROM tenants WHERE id = ?',
          [user.tenant_id]
        );
        if (tenantRows.length > 0 && tenantRows[0].status !== 'activo') {
          throw new AppError('Tu comercio ha sido suspendido.', 403);
        }
      }
    } else {
      // Create new user as 'cliente'
      const id = uuidv4();
      await db.execute<ResultSetHeader>(
        'INSERT INTO users (id, tenant_id, email, password, name, role, avatar, auth_provider, google_id) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?)',
        [id, tenantId, email, name || email.split('@')[0], 'cliente', picture || null, 'google', googleId]
      );

      const [newRows] = await db.execute<UserRow[]>(
        'SELECT * FROM users WHERE id = ?',
        [id]
      );
      user = newRows[0];
    }

    const jwtPayload: JWTPayload = {
      userId: user.id,
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenant_id,
    };

    const token = jwt.sign(jwtPayload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);

    const fullUser = await this.getProfile(user.id);
    // Preserve Google picture as avatar if not already set
    if (!fullUser.avatar && picture) {
      (fullUser as any).avatar = picture;
    }
    return {
      user: fullUser,
      token,
    };
  }

  async getProfile(userId: string): Promise<Omit<User, 'password'>> {
    const [rows] = await db.execute<UserRow[]>(
            `SELECT u.id, u.tenant_id, u.email, u.name, u.role, u.avatar, u.is_active,
              u.phone, u.cedula, u.department, u.municipality, u.address, u.neighborhood,
              u.delivery_latitude, u.delivery_longitude, u.profile_completed,
              u.created_at, u.updated_at,
              t.plan AS tenant_plan, t.name AS tenant_name, t.slug AS tenant_slug, t.max_users, t.max_products,
              t.trial_ends_at AS tenant_trial_ends_at
       FROM users u
       LEFT JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = ?`,
      [userId]
    );

    if (rows.length === 0) {
      throw new AppError('Usuario no encontrado', 404);
    }

    const user = rows[0] as any;
    return {
      id: user.id,
      tenantId: user.tenant_id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar: user.avatar || undefined,
      isActive: user.is_active,
      phone: user.phone || undefined,
      cedula: user.cedula || undefined,
      department: user.department || undefined,
      municipality: user.municipality || undefined,
      address: user.address || undefined,
      neighborhood: user.neighborhood || undefined,
      deliveryLatitude: user.delivery_latitude ?? undefined,
      deliveryLongitude: user.delivery_longitude ?? undefined,
      profileCompleted: !!user.profile_completed,
      tenantPlan: user.tenant_plan || undefined,
      tenantName: user.tenant_name || undefined,
      tenantSlug: user.tenant_slug || undefined,
      tenantMaxUsers: user.max_users ?? undefined,
      tenantMaxProducts: user.max_products ?? undefined,
      tenantTrialEndsAt: user.tenant_trial_ends_at ?? undefined,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    } as any;
  }

  async updateProfile(
    userId: string,
    data: {
      name?: string;
      avatar?: string;
      phone?: string;
      cedula?: string;
      department?: string;
      municipality?: string;
      address?: string;
      neighborhood?: string;
      deliveryLatitude?: number;
      deliveryLongitude?: number;
    }
  ): Promise<Omit<User, 'password'>> {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.name) { updates.push('name = ?'); values.push(data.name); }
    if (data.avatar) { updates.push('avatar = ?'); values.push(data.avatar); }
    if (data.phone !== undefined) { updates.push('phone = ?'); values.push(encryptNullable(data.phone)); }
    if (data.cedula !== undefined) { updates.push('cedula = ?'); values.push(encryptNullable(data.cedula)); }
    if (data.department !== undefined) { updates.push('department = ?'); values.push(encryptNullable(data.department)); }
    if (data.municipality !== undefined) { updates.push('municipality = ?'); values.push(encryptNullable(data.municipality)); }
    if (data.address !== undefined) { updates.push('address = ?'); values.push(encryptNullable(data.address)); }
    if (data.neighborhood !== undefined) { updates.push('neighborhood = ?'); values.push(encryptNullable(data.neighborhood)); }
    if (data.deliveryLatitude !== undefined) { updates.push('delivery_latitude = ?'); values.push(data.deliveryLatitude); }
    if (data.deliveryLongitude !== undefined) { updates.push('delivery_longitude = ?'); values.push(data.deliveryLongitude); }

    // Mark profile as completed if delivery address fields are provided
    const hasDeliveryData = data.department && data.municipality && data.address;
    if (hasDeliveryData) {
      updates.push('profile_completed = 1');
    }

    if (updates.length === 0) {
      throw new AppError('No hay datos para actualizar', 400);
    }

    values.push(userId);

    await db.execute(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return this.getProfile(userId);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const [rows] = await db.execute<UserRow[]>(
      'SELECT password FROM users WHERE id = ?',
      [userId]
    );

    if (rows.length === 0) {
      throw new AppError('Usuario no encontrado', 404);
    }

    const isValidPassword = await bcrypt.compare(currentPassword, rows[0].password);

    if (!isValidPassword) {
      throw new AppError('Contrasena actual incorrecta', 401);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.execute(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, userId]
    );
  }
}

export const authService = new AuthService();

// ── Login Rate Limiter ──────────────────────────────────────────────────────
const MAX_ATTEMPTS = 6;
const WARN_AFTER = 3;
const LOCK_DURATION_MS = 15 * 60 * 1000;

interface AttemptRecord { count: number; lockedUntil: number | null }
const loginAttempts = new Map<string, AttemptRecord>();

export const loginRateLimiter = {
  checkLocked(email: string): { lockedUntil: number } | null {
    const key = email.toLowerCase();
    const r = loginAttempts.get(key);
    if (!r?.lockedUntil) return null;
    if (Date.now() < r.lockedUntil) return { lockedUntil: r.lockedUntil };
    loginAttempts.delete(key);
    return null;
  },

  recordFailure(email: string): { attemptsLeft: number | null; lockedUntil: number | null } {
    const key = email.toLowerCase();
    const r = loginAttempts.get(key) ?? { count: 0, lockedUntil: null };
    r.count++;
    if (r.count >= MAX_ATTEMPTS) {
      r.lockedUntil = Date.now() + LOCK_DURATION_MS;
      loginAttempts.set(key, r);
      return { attemptsLeft: 0, lockedUntil: r.lockedUntil };
    }
    loginAttempts.set(key, r);
    if (r.count >= WARN_AFTER) {
      return { attemptsLeft: MAX_ATTEMPTS - r.count, lockedUntil: null };
    }
    return { attemptsLeft: null, lockedUntil: null };
  },

  reset(email: string): void {
    loginAttempts.delete(email.toLowerCase());
  },
};
