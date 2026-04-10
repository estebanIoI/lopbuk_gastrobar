import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config';
import { User, UserRole, PaginatedResponse } from '../../common/types';
import { AppError } from '../../common/middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { encryptNullable } from '../../utils/crypto';

interface UserRow extends RowDataPacket {
  id: string;
  tenant_id: string | null;
  email: string;
  password: string;
  name: string;
  role: UserRole;
  avatar: string | null;
  is_active: boolean;
  can_login: boolean;
  cargo_id: string | null;
  cargo_name: string | null;
  created_at: Date;
  updated_at: Date;
}

interface CountRow extends RowDataPacket {
  total: number;
}

export class UsersService {
  private mapUser(row: UserRow): Omit<User, 'password'> & { cargoId?: string; cargoName?: string; canLogin: boolean } {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      email: row.email,
      name: row.name,
      role: row.role,
      avatar: row.avatar || undefined,
      isActive: row.is_active,
      canLogin: row.can_login !== false, // default true if column missing
      cargoId: row.cargo_id || undefined,
      cargoName: row.cargo_name || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findAll(tenantId: string | null, page = 1, limit = 10): Promise<PaginatedResponse<Omit<User, 'password'>>> {
    const offset = (page - 1) * limit;

    if (tenantId) {
      const [countResult] = await db.execute<CountRow[]>(
        'SELECT COUNT(*) as total FROM users WHERE tenant_id = ?',
        [tenantId]
      );
      const total = countResult[0].total;

      const [rows] = await db.execute<UserRow[]>(
        `SELECT u.id, u.tenant_id, u.email, u.name, u.role, u.avatar, u.is_active, u.can_login, u.cargo_id, ec.name AS cargo_name, u.created_at, u.updated_at
         FROM users u LEFT JOIN employee_cargos ec ON u.cargo_id = ec.id
         WHERE u.tenant_id = ? ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
        [tenantId, String(limit), String(offset)]
      );

      return {
        data: rows.map(this.mapUser),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } else {
      // Superadmin: ver todos
      const [countResult] = await db.execute<CountRow[]>(
        'SELECT COUNT(*) as total FROM users'
      );
      const total = countResult[0].total;

      const [rows] = await db.execute<UserRow[]>(
        `SELECT u.id, u.tenant_id, u.email, u.name, u.role, u.avatar, u.is_active, u.can_login, u.cargo_id, ec.name AS cargo_name, u.created_at, u.updated_at
         FROM users u LEFT JOIN employee_cargos ec ON u.cargo_id = ec.id
         ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
        [String(limit), String(offset)]
      );

      return {
        data: rows.map(this.mapUser),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    }
  }

  async findById(id: string): Promise<Omit<User, 'password'> & { cargoId?: string; cargoName?: string; canLogin: boolean }> {
    const [rows] = await db.execute<UserRow[]>(
      `SELECT u.id, u.tenant_id, u.email, u.name, u.role, u.avatar, u.is_active, u.can_login, u.cargo_id, ec.name AS cargo_name, u.created_at, u.updated_at
       FROM users u LEFT JOIN employee_cargos ec ON u.cargo_id = ec.id WHERE u.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      throw new AppError('Usuario no encontrado', 404);
    }

    return this.mapUser(rows[0]);
  }

  async create(data: {
    email: string;
    password: string;
    name: string;
    role?: UserRole;
    tenantId?: string | null;
    phone?: string | null;
    cargoId?: string | null;
    canLogin?: boolean;
  }): Promise<Omit<User, 'password'> & { cargoId?: string; cargoName?: string; canLogin: boolean }> {
    const [existing] = await db.execute<UserRow[]>(
      'SELECT id FROM users WHERE email = ?',
      [data.email]
    );

    if (existing.length > 0) {
      throw new AppError('El email ya esta registrado', 400);
    }

    const id = uuidv4();
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const canLogin = data.canLogin !== false ? 1 : 0;

    await db.execute<ResultSetHeader>(
      'INSERT INTO users (id, tenant_id, email, password, name, role, phone, cargo_id, can_login) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, data.tenantId || null, data.email, hashedPassword, data.name, data.role || 'vendedor', encryptNullable(data.phone || null), data.cargoId || null, canLogin]
    );

    return this.findById(id);
  }

  async update(
    id: string,
    data: { name?: string; role?: UserRole; avatar?: string; canLogin?: boolean }
  ): Promise<Omit<User, 'password'>> {
    await this.findById(id);

    const updates: string[] = [];
    const values: (string | number | undefined)[] = [];

    if (data.name) {
      updates.push('name = ?');
      values.push(data.name);
    }

    if (data.role) {
      updates.push('role = ?');
      values.push(data.role);
    }

    if (data.avatar) {
      updates.push('avatar = ?');
      values.push(data.avatar);
    }

    if (data.canLogin !== undefined) {
      updates.push('can_login = ?');
      values.push(data.canLogin ? 1 : 0);
    }

    if (updates.length === 0) {
      throw new AppError('No hay datos para actualizar', 400);
    }

    values.push(id);

    await db.execute(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);

    const [result] = await db.execute<ResultSetHeader>(
      'DELETE FROM users WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      throw new AppError('No se pudo eliminar el usuario', 500);
    }
  }

  async resetPassword(id: string, newPassword: string): Promise<void> {
    await this.findById(id);

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.execute(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, id]
    );
  }
}

export const usersService = new UsersService();
