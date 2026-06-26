import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket } from 'mysql2/promise';
import { db } from '../../config';
import { AppError } from '../../common/middleware';

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface SizeMeasures {
  ancho?: number;
  largo?: number;
  manga?: number;
}
export type SizeChart = Record<string, SizeMeasures>;

export interface HormaColor {
  id: string;
  tenantId: string;
  hormaId: string;
  color: string;
  hex?: string;
  sortOrder: number;
  isActive: boolean;
  /** Casillero/estante de bodega específico para este color (override sobre el de la horma) */
  shelf?: string[] | null;
}

export type Sexo = 'unisex' | 'hombre' | 'mujer';

export interface Horma {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  baseCost: number;
  basePrice: number;
  weightGrams?: number | null;
  composition?: string | null;
  sizeChart?: SizeChart;
  hasSleeves: boolean;
  sexo: Sexo;
  sortOrder: number;
  isActive: boolean;
  /** Casillero/estante compartido para todos los colores de esta horma */
  shelf?: string[] | null;
  colors?: HormaColor[];
  createdAt?: Date;
  updatedAt?: Date;
}

// ─── Row interfaces ─────────────────────────────────────────────────────────

interface HormaRow extends RowDataPacket {
  id: string; tenant_id: string; name: string; slug: string;
  base_cost: number; base_price: number; weight_grams: number | null; composition: string | null; size_chart: string | object | null;
  has_sleeves: number; sexo: Sexo | null; sort_order: number; is_active: number;
  shelf: string | null; // raw from DB (JSON string or null)
  created_at: Date; updated_at: Date;
}

interface ColorRow extends RowDataPacket {
  id: string; tenant_id: string; horma_id: string;
  color: string; hex: string | null; sort_order: number; is_active: number;
  shelf: string | null; // raw from DB (JSON string or null)
}

// ─── Mappers ────────────────────────────────────────────────────────────────

/** Parsea el campo shelf desde DB (puede ser JSON string, array ya parseado, o null) */
function parseShelf(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
    if (typeof parsed === 'string' && parsed.trim()) return [parsed.trim()];
    return null;
  } catch { return null; }
}

/** Serializa el array de estantes para guardar en DB */
function serializeShelf(shelves: string[] | null | undefined): string | null {
  if (!shelves || shelves.length === 0) return null;
  const clean = shelves.map(s => s.trim()).filter(Boolean);
  return clean.length ? JSON.stringify(clean) : null;
}

function mapColor(row: ColorRow): HormaColor {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    hormaId: row.horma_id,
    color: row.color,
    hex: row.hex ?? undefined,
    sortOrder: row.sort_order,
    isActive: Boolean(row.is_active),
    shelf: parseShelf(row.shelf),
  };
}

function mapHorma(row: HormaRow): Horma {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    slug: row.slug,
    baseCost: Number(row.base_cost),
    basePrice: Number(row.base_price),
    weightGrams: row.weight_grams != null ? Number(row.weight_grams) : null,
    composition: row.composition ?? null,
    sizeChart: row.size_chart
      ? (typeof row.size_chart === 'string' ? JSON.parse(row.size_chart) : (row.size_chart as SizeChart))
      : undefined,
    hasSleeves: Boolean(row.has_sleeves),
    sexo: (row.sexo as Sexo) ?? 'unisex',
    sortOrder: row.sort_order,
    isActive: Boolean(row.is_active),
    shelf: parseShelf(row.shelf),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Utils ──────────────────────────────────────────────────────────────────

const VALID_SEXOS: Sexo[] = ['unisex', 'hombre', 'mujer'];
function assertValidSexo(sexo: unknown): void {
  if (sexo !== undefined && !VALID_SEXOS.includes(sexo as Sexo)) {
    throw new AppError('Sexo inválido (usa unisex, hombre o mujer)', 400);
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ─── Service ────────────────────────────────────────────────────────────────

export class HormasService {

  // Auto-migración idempotente: crea las tablas de horma si no existen.
  // Evita depender de correr migrations/v40_hormas.sql a mano.
  // Público porque variants.service.ts también referencia `hormas` (LEFT JOIN
  // por horma_id en cada variante) y necesita poder asegurarla primero.
  private tablesEnsured = false;
  async ensureTables(): Promise<void> {
    if (this.tablesEnsured) return;
    await db.query(`CREATE TABLE IF NOT EXISTS hormas (
      id          VARCHAR(36)   NOT NULL PRIMARY KEY,
      tenant_id   VARCHAR(36)   NOT NULL,
      name        VARCHAR(150)  NOT NULL,
      slug        VARCHAR(150)  NOT NULL,
      base_cost   DECIMAL(12,2) NOT NULL DEFAULT 0,
      base_price  DECIMAL(12,2) NOT NULL DEFAULT 0,
      size_chart  JSON,
      has_sleeves TINYINT(1)    NOT NULL DEFAULT 1,
      sexo        ENUM('unisex','hombre','mujer') NOT NULL DEFAULT 'unisex',
      composition VARCHAR(150)  NULL,
      sort_order  INT           NOT NULL DEFAULT 0,
      is_active   TINYINT(1)    NOT NULL DEFAULT 1,
      created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_horma_slug_tenant (tenant_id, slug),
      INDEX idx_hormas_tenant (tenant_id, is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await db.query(`CREATE TABLE IF NOT EXISTS horma_colors (
      id         VARCHAR(36)  NOT NULL PRIMARY KEY,
      tenant_id  VARCHAR(36)  NOT NULL,
      horma_id   VARCHAR(36)  NOT NULL,
      color      VARCHAR(100) NOT NULL,
      hex        VARCHAR(9),
      sort_order INT          NOT NULL DEFAULT 0,
      is_active  TINYINT(1)   NOT NULL DEFAULT 1,
      created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_horma_color (horma_id, color),
      INDEX idx_hc_tenant (tenant_id),
      INDEX idx_hc_horma (horma_id, tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    try { await db.query('ALTER TABLE products ADD COLUMN horma_id VARCHAR(36) NULL'); }
    catch (e: any) { if (e?.errno !== 1060) { /* 1060 = ya existe */ } }
    try { await db.query('ALTER TABLE hormas ADD COLUMN weight_grams INT NULL'); }
    catch (e: any) { if (e?.errno !== 1060) { /* 1060 = ya existe */ } }
    try { await db.query("ALTER TABLE hormas ADD COLUMN sexo ENUM('unisex','hombre','mujer') NOT NULL DEFAULT 'unisex'"); }
    catch (e: any) { if (e?.errno !== 1060) { /* 1060 = ya existe */ } }
    try { await db.query('ALTER TABLE hormas ADD COLUMN composition VARCHAR(150) NULL'); }
    catch (e: any) { if (e?.errno !== 1060) { /* 1060 = ya existe */ } }
    // Casilleros de bodega — JSON array (múltiples por horma o por color)
    try { await db.query('ALTER TABLE hormas ADD COLUMN shelf JSON NULL'); }
    catch (e: any) { if (e?.errno !== 1060) { /* ya existe */ } }
    try { await db.query('ALTER TABLE horma_colors ADD COLUMN shelf JSON NULL'); }
    catch (e: any) { if (e?.errno !== 1060) { /* ya existe */ } }
    // Si ya existía como VARCHAR, convertir a JSON (ignora error si ya es JSON)
    try { await db.query("ALTER TABLE hormas MODIFY COLUMN shelf JSON NULL"); }
    catch (_) {}
    try { await db.query("ALTER TABLE horma_colors MODIFY COLUMN shelf JSON NULL"); }
    catch (_) {}
    this.tablesEnsured = true;
  }


  // ── Hormas CRUD ────────────────────────────────────────────────────────────

  async findAll(tenantId: string): Promise<Horma[]> {
    await this.ensureTables()
    const [rows] = await db.execute<HormaRow[]>(
      `SELECT * FROM hormas
       WHERE tenant_id = ? AND is_active = 1
       ORDER BY sort_order ASC, created_at ASC`,
      [tenantId]
    );
    const hormas = rows.map(mapHorma);
    for (const h of hormas) {
      h.colors = await this.findColors(h.id, tenantId);
    }
    return hormas;
  }

  async findById(id: string, tenantId: string): Promise<Horma> {
    await this.ensureTables()
    const [rows] = await db.execute<HormaRow[]>(
      `SELECT * FROM hormas WHERE id = ? AND tenant_id = ? AND is_active = 1`,
      [id, tenantId]
    );
    if (rows.length === 0) throw new AppError('Horma no encontrada', 404);
    const horma = mapHorma(rows[0]);
    horma.colors = await this.findColors(id, tenantId);
    return horma;
  }

  async create(tenantId: string, data: {
    name: string; slug?: string; baseCost?: number; basePrice?: number; weightGrams?: number | null;
    composition?: string | null; shelf?: string[] | null;
    sizeChart?: SizeChart; hasSleeves?: boolean; sexo?: Sexo; sortOrder?: number;
    colors?: { color: string; hex?: string; shelf?: string[] | null }[];
  }): Promise<Horma> {
    await this.ensureTables()
    if (!data.name?.trim()) throw new AppError('El nombre de la horma es requerido', 400);
    assertValidSexo(data.sexo);

    const slug = data.slug?.trim() || slugify(data.name);

    const [dup] = await db.execute<RowDataPacket[]>(
      'SELECT id FROM hormas WHERE slug = ? AND tenant_id = ?',
      [slug, tenantId]
    );
    if (dup.length > 0) throw new AppError('Ya existe una horma con ese slug', 400);

    const id = uuidv4();
    await db.execute(
      `INSERT INTO hormas
         (id, tenant_id, name, slug, base_cost, base_price, weight_grams, composition, shelf, size_chart, has_sleeves, sexo, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, tenantId, data.name.trim(), slug,
        data.baseCost ?? 0, data.basePrice ?? 0,
        data.weightGrams ?? null,
        data.composition?.trim() || null,
        serializeShelf(data.shelf),
        data.sizeChart ? JSON.stringify(data.sizeChart) : null,
        data.hasSleeves === false ? 0 : 1,
        data.sexo ?? 'unisex',
        data.sortOrder ?? 0,
      ]
    );

    if (data.colors?.length) {
      for (let i = 0; i < data.colors.length; i++) {
        await this.addColor(id, tenantId, { ...data.colors[i], sortOrder: i + 1 });
      }
    }

    return this.findById(id, tenantId);
  }

  async update(id: string, tenantId: string, data: Partial<{
    name: string; slug: string; baseCost: number; basePrice: number; weightGrams: number | null;
    composition: string | null; shelf: string[] | null;
    sizeChart: SizeChart; hasSleeves: boolean; sexo: Sexo; sortOrder: number; isActive: boolean;
  }>): Promise<Horma> {
    await this.findById(id, tenantId);
    assertValidSexo(data.sexo);

    if (data.slug) {
      const [dup] = await db.execute<RowDataPacket[]>(
        'SELECT id FROM hormas WHERE slug = ? AND tenant_id = ? AND id != ?',
        [data.slug, tenantId, id]
      );
      if (dup.length > 0) throw new AppError('Ya existe una horma con ese slug', 400);
    }

    const fieldMap: Record<string, string> = {
      name: 'name', slug: 'slug', baseCost: 'base_cost', basePrice: 'base_price', weightGrams: 'weight_grams',
      composition: 'composition', shelf: 'shelf',
      hasSleeves: 'has_sleeves', sexo: 'sexo', sortOrder: 'sort_order', isActive: 'is_active',
    };

    const sets: string[] = [];
    const vals: any[] = [];
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      if (k === 'sizeChart') { sets.push('size_chart = ?'); vals.push(JSON.stringify(v)); continue; }
      if (k === 'shelf') { sets.push('shelf = ?'); vals.push(serializeShelf(v as string[] | null)); continue; }
      const col = fieldMap[k];
      if (!col) continue;
      sets.push(`${col} = ?`);
      vals.push(typeof v === 'boolean' ? (v ? 1 : 0) : v);
    }
    if (sets.length === 0) throw new AppError('No hay datos para actualizar', 400);
    vals.push(id, tenantId);

    await db.execute(`UPDATE hormas SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, vals);
    return this.findById(id, tenantId);
  }

  async softDelete(id: string, tenantId: string): Promise<void> {
    await this.findById(id, tenantId);
    await db.execute(
      'UPDATE hormas SET is_active = 0 WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
  }

  // ── Colores (paleta) ─────────────────────────────────────────────────────────

  async findColors(hormaId: string, tenantId: string): Promise<HormaColor[]> {
    await this.ensureTables()
    const [rows] = await db.execute<ColorRow[]>(
      `SELECT * FROM horma_colors
       WHERE horma_id = ? AND tenant_id = ? AND is_active = 1
       ORDER BY sort_order ASC, color ASC`,
      [hormaId, tenantId]
    );
    return rows.map(mapColor);
  }

  async addColor(hormaId: string, tenantId: string, data: {
    color: string; hex?: string; sortOrder?: number; shelf?: string[] | null;
  }): Promise<HormaColor> {
    await this.findById(hormaId, tenantId);
    if (!data.color?.trim()) throw new AppError('El color es requerido', 400);

    const [dup] = await db.execute<RowDataPacket[]>(
      'SELECT id FROM horma_colors WHERE horma_id = ? AND color = ? AND tenant_id = ?',
      [hormaId, data.color.trim(), tenantId]
    );
    if (dup.length > 0) throw new AppError('Ese color ya existe en la paleta de la horma', 400);

    const id = uuidv4();
    await db.execute(
      `INSERT INTO horma_colors (id, tenant_id, horma_id, color, hex, sort_order, shelf)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, hormaId, data.color.trim(), data.hex ?? null, data.sortOrder ?? 0, serializeShelf(data.shelf)]
    );

    const [rows] = await db.execute<ColorRow[]>(
      'SELECT * FROM horma_colors WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    return mapColor(rows[0]);
  }

  async updateColor(colorId: string, tenantId: string, data: { shelf?: string[] | null; hex?: string | null }): Promise<void> {
    await this.ensureTables()
    const sets: string[] = []
    const vals: any[] = []
    if ('shelf' in data) { sets.push('shelf = ?'); vals.push(serializeShelf(data.shelf)) }
    if ('hex' in data)   { sets.push('hex = ?');   vals.push(data.hex || null) }
    if (sets.length === 0) return
    vals.push(colorId, tenantId)
    await db.execute(
      `UPDATE horma_colors SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`,
      vals
    )
  }

  async removeColor(colorId: string, tenantId: string): Promise<void> {
    await this.ensureTables()
    const [rows] = await db.execute<ColorRow[]>(
      'SELECT id FROM horma_colors WHERE id = ? AND tenant_id = ?',
      [colorId, tenantId]
    );
    if (rows.length === 0) throw new AppError('Color no encontrado', 404);
    await db.execute(
      'UPDATE horma_colors SET is_active = 0 WHERE id = ? AND tenant_id = ?',
      [colorId, tenantId]
    );
  }

  /**
   * Valida que un color pertenezca a la paleta de la horma.
   * Usado al crear/editar variantes de un producto que tiene horma_id.
   */
  async isColorAllowed(hormaId: string, color: string, tenantId: string): Promise<boolean> {
    await this.ensureTables()
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT 1 FROM horma_colors
       WHERE horma_id = ? AND color = ? AND tenant_id = ? AND is_active = 1
       LIMIT 1`,
      [hormaId, color, tenantId]
    );
    return rows.length > 0;
  }
}

export const hormasService = new HormasService();
