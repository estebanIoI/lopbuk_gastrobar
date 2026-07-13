import { db } from '../../config';
import { AppError } from '../../common/middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

interface RecipePageRow extends RowDataPacket {
  id: string;
  tenant_id: string;
  product_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  prep_time_minutes: number | null;
  difficulty: string;
  servings: number;
  steps: string;
  tips: string | null;
  tags: string | null;
  total_cost: number | null;
  is_active: number;
  sort_order: number;
}

interface IngredientRow extends RowDataPacket {
  id: string;
  recipe_page_id: string;
  product_id: string;
  quantity: number;
  unit: string;
  notes: string | null;
  sort_order: number;
  product_name?: string;
}

export interface IngredientItem {
  id: string;
  recipePageId: string;
  productId: string;
  productName?: string;
  quantity: number;
  unit: string;
  notes?: string;
  sortOrder: number;
}

export interface RecipePageItem {
  id: string;
  tenantId: string;
  productId: string;
  title: string;
  description?: string;
  imageUrl?: string;
  prepTimeMinutes?: number;
  difficulty: string;
  servings: number;
  steps: { step: number; instruction: string }[];
  tips?: string;
  tags?: string;
  totalCost?: number;
  isActive: boolean;
  sortOrder: number;
  ingredients: IngredientItem[];
}

export class RecipePagesService {
  private mapRecipePage(row: RecipePageRow, ingredients: IngredientRow[] = []): RecipePageItem {
    let steps: { step: number; instruction: string }[] = [];
    if (row.steps) {
      try {
        steps = typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps;
      } catch {
        steps = [];
      }
    }

    return {
      id: row.id,
      tenantId: row.tenant_id,
      productId: row.product_id,
      title: row.title,
      description: row.description || undefined,
      imageUrl: row.image_url || undefined,
      prepTimeMinutes: row.prep_time_minutes ?? undefined,
      difficulty: row.difficulty,
      servings: row.servings,
      steps,
      tips: row.tips || undefined,
      tags: row.tags || undefined,
      totalCost: row.total_cost ?? undefined,
      isActive: row.is_active !== 0,
      sortOrder: row.sort_order ?? 0,
      ingredients: ingredients.map(this.mapIngredient.bind(this)),
    };
  }

  private mapIngredient(row: IngredientRow): IngredientItem {
    return {
      id: row.id,
      recipePageId: row.recipe_page_id,
      productId: row.product_id,
      productName: row.product_name || undefined,
      quantity: row.quantity,
      unit: row.unit,
      notes: row.notes || undefined,
      sortOrder: row.sort_order ?? 0,
    };
  }

  async findAll(tenantId: string): Promise<RecipePageItem[]> {
    const [rows] = await db.execute<RecipePageRow[]>(
      `SELECT * FROM recipe_pages
       WHERE tenant_id = ? AND is_active = 1
       ORDER BY COALESCE(sort_order, 0) ASC, title ASC`,
      [tenantId]
    );

    const pages: RecipePageItem[] = [];
    for (const row of rows) {
      const [ingredients] = await db.execute<IngredientRow[]>(
        `SELECT rpi.*, p.name AS product_name
         FROM recipe_page_ingredients rpi
         LEFT JOIN products p ON p.id = rpi.product_id
         WHERE rpi.recipe_page_id = ?
         ORDER BY rpi.sort_order ASC`,
        [row.id]
      );
      pages.push(this.mapRecipePage(row, ingredients));
    }

    return pages;
  }

  async findById(tenantId: string, id: string): Promise<RecipePageItem> {
    const [rows] = await db.execute<RecipePageRow[]>(
      'SELECT * FROM recipe_pages WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (rows.length === 0) throw new AppError('Página de receta no encontrada', 404);

    const [ingredients] = await db.execute<IngredientRow[]>(
      `SELECT rpi.*, p.name AS product_name
       FROM recipe_page_ingredients rpi
       LEFT JOIN products p ON p.id = rpi.product_id
       WHERE rpi.recipe_page_id = ?
       ORDER BY rpi.sort_order ASC`,
      [id]
    );

    return this.mapRecipePage(rows[0], ingredients);
  }

  async create(
    tenantId: string,
    data: {
      id: string;
      productId: string;
      title: string;
      description?: string;
      imageUrl?: string;
      prepTimeMinutes?: number;
      difficulty?: string;
      servings?: number;
      steps: { step: number; instruction: string }[];
      tips?: string;
      tags?: string;
      totalCost?: number;
      sortOrder?: number;
      ingredients?: Omit<IngredientItem, 'id' | 'recipePageId' | 'productName'>[];
    }
  ): Promise<RecipePageItem> {
    const [existing] = await db.execute<RowDataPacket[]>(
      'SELECT id FROM recipe_pages WHERE id = ? AND tenant_id = ?',
      [data.id, tenantId]
    );
    if (existing.length > 0) {
      throw new AppError('Ya existe una página de receta con ese identificador', 400);
    }

    await db.execute<ResultSetHeader>(
      `INSERT INTO recipe_pages
       (id, tenant_id, product_id, title, description, image_url,
        prep_time_minutes, difficulty, servings, steps, tips, tags,
        total_cost, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        data.id,
        tenantId,
        data.productId,
        data.title,
        data.description || null,
        data.imageUrl || null,
        data.prepTimeMinutes ?? null,
        data.difficulty || 'fácil',
        data.servings ?? 4,
        JSON.stringify(data.steps),
        data.tips || null,
        data.tags || null,
        data.totalCost ?? null,
        data.sortOrder ?? 0,
      ]
    );

    if (data.ingredients && data.ingredients.length > 0) {
      await this._insertIngredients(data.id, data.ingredients);
    }

    return this.findById(tenantId, data.id);
  }

  async update(
    tenantId: string,
    id: string,
    data: {
      productId?: string;
      title?: string;
      description?: string;
      imageUrl?: string;
      prepTimeMinutes?: number;
      difficulty?: string;
      servings?: number;
      steps?: { step: number; instruction: string }[];
      tips?: string;
      tags?: string;
      totalCost?: number;
      sortOrder?: number;
      ingredients?: Omit<IngredientItem, 'id' | 'recipePageId' | 'productName'>[];
    }
  ): Promise<RecipePageItem> {
    const [rows] = await db.execute<RecipePageRow[]>(
      'SELECT * FROM recipe_pages WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (rows.length === 0) throw new AppError('Página de receta no encontrada', 404);

    const current = rows[0];
    const productId = data.productId ?? current.product_id;
    const title = data.title ?? current.title;
    const description = data.description !== undefined ? data.description : current.description;
    const imageUrl = data.imageUrl !== undefined ? data.imageUrl : current.image_url;
    const prepTimeMinutes = data.prepTimeMinutes !== undefined ? data.prepTimeMinutes : current.prep_time_minutes;
    const difficulty = data.difficulty ?? current.difficulty;
    const servings = data.servings ?? current.servings;
    const steps = data.steps ?? (typeof current.steps === 'string' ? JSON.parse(current.steps) : current.steps);
    const tips = data.tips !== undefined ? data.tips : current.tips;
    const tags = data.tags !== undefined ? data.tags : current.tags;
    const totalCost = data.totalCost !== undefined ? data.totalCost : current.total_cost;
    const sortOrder = data.sortOrder !== undefined ? data.sortOrder : current.sort_order;

    await db.execute<ResultSetHeader>(
      `UPDATE recipe_pages
       SET product_id=?, title=?, description=?, image_url=?,
           prep_time_minutes=?, difficulty=?, servings=?, steps=?,
           tips=?, tags=?, total_cost=?, sort_order=?
       WHERE id=? AND tenant_id=?`,
      [
        productId,
        title,
        description || null,
        imageUrl || null,
        prepTimeMinutes ?? null,
        difficulty,
        servings,
        JSON.stringify(steps),
        tips || null,
        tags || null,
        totalCost ?? null,
        sortOrder,
        id,
        tenantId,
      ]
    );

    if (data.ingredients !== undefined) {
      await db.execute('DELETE FROM recipe_page_ingredients WHERE recipe_page_id = ?', [id]);
      if (data.ingredients.length > 0) {
        await this._insertIngredients(id, data.ingredients);
      }
    }

    return this.findById(tenantId, id);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const [result] = await db.execute<ResultSetHeader>(
      'UPDATE recipe_pages SET is_active = 0 WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (result.affectedRows === 0) {
      throw new AppError('Página de receta no encontrada', 404);
    }
  }

  async findPublic(tenantSlug: string): Promise<{ tenantId: string; recipes: RecipePageItem[] }> {
    const [tenants] = await db.execute<RowDataPacket[]>(
      "SELECT id FROM tenants WHERE slug = ? AND status = 'activo' LIMIT 1",
      [tenantSlug]
    );
    if (!tenants.length) throw new AppError('Tienda no encontrada', 404);

    const tenantId = tenants[0].id;
    const [rows] = await db.execute<RecipePageRow[]>(
      `SELECT * FROM recipe_pages
       WHERE tenant_id = ? AND is_active = 1
       ORDER BY COALESCE(sort_order, 0) ASC, title ASC`,
      [tenantId]
    );

    const recipes: RecipePageItem[] = [];
    for (const row of rows) {
      const [ingredients] = await db.execute<IngredientRow[]>(
        `SELECT rpi.*, p.name AS product_name
         FROM recipe_page_ingredients rpi
         LEFT JOIN products p ON p.id = rpi.product_id
         WHERE rpi.recipe_page_id = ?
         ORDER BY rpi.sort_order ASC`,
        [row.id]
      );
      recipes.push(this.mapRecipePage(row, ingredients));
    }

    return { tenantId, recipes };
  }

  private async _insertIngredients(
    recipePageId: string,
    ingredients: Omit<IngredientItem, 'id' | 'recipePageId' | 'productName'>[]
  ): Promise<void> {
    for (const ing of ingredients) {
      await db.execute<ResultSetHeader>(
        `INSERT INTO recipe_page_ingredients
         (id, recipe_page_id, product_id, quantity, unit, notes, sort_order)
         VALUES (UUID(), ?, ?, ?, ?, ?, ?)`,
        [
          recipePageId,
          ing.productId,
          ing.quantity,
          ing.unit,
          ing.notes || null,
          ing.sortOrder ?? 0,
        ]
      );
    }
  }
}

export const recipePagesService = new RecipePagesService();
