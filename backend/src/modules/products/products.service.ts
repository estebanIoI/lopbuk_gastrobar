import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config';
import { Product, Category, ProductType, PaginatedResponse, StockStatus } from '../../common/types';
import { AppError } from '../../common/middleware';
import { getStockStatus } from '../../utils';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

interface ProductRow extends RowDataPacket {
  id: string;
  name: string;
  articulo: string | null;
  category: Category;
  product_type: ProductType;
  brand: string | null;
  model: string | null;
  description: string | null;
  purchase_price: number;
  sale_price: number;
  sku: string;
  barcode: string | null;
  stock: number;
  reorder_point: number;
  supplier: string | null;
  supplier_id: string | null;
  entry_date: Date;
  image_url: string | null;
  image_urls: string | null;
  location_in_store: string | null;
  notes: string | null;
  tags: string | null;
  // Alimentos / Bebidas
  expiry_date: Date | null;
  batch_number: string | null;
  net_weight: number | null;
  weight_unit: string | null;
  sanitary_registration: string | null;
  storage_temperature: string | null;
  ingredients: string | null;
  nutritional_info: string | null;
  alcohol_content: number | null;
  allergens: string | null;
  // Ropa
  size: string | null;
  color: string | null;
  material: string | null;
  gender: string | null;
  season: string | null;
  garment_type: string | null;
  washing_instructions: string | null;
  country_of_origin: string | null;
  // Electronica
  serial_number: string | null;
  warranty_months: number | null;
  technical_specs: string | null;
  voltage: string | null;
  power_watts: number | null;
  compatibility: string | null;
  includes_accessories: string | null;
  product_condition: string | null;
  // Farmacia
  active_ingredient: string | null;
  concentration: string | null;
  requires_prescription: boolean | null;
  administration_route: string | null;
  presentation: string | null;
  units_per_package: number | null;
  laboratory: string | null;
  contraindications: string | null;
  // Ferreteria
  dimensions: string | null;
  weight: number | null;
  caliber: string | null;
  resistance: string | null;
  finish: string | null;
  recommended_use: string | null;
  // Libreria
  author: string | null;
  publisher: string | null;
  isbn: string | null;
  pages: number | null;
  language: string | null;
  publication_year: number | null;
  edition: string | null;
  book_format: string | null;
  // Juguetes
  recommended_age: string | null;
  number_of_players: string | null;
  game_type: string | null;
  requires_batteries: boolean | null;
  package_dimensions: string | null;
  package_contents: string | null;
  safety_warnings: string | null;
  // Sede
  sede_id: string | null;
  // Timestamps
  created_at: Date;
  updated_at: Date;
}

interface CountRow extends RowDataPacket {
  total: number;
}

export interface ProductFilters {
  category?: Category;
  productType?: ProductType;
  stockStatus?: StockStatus;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sedeId?: string;
}

// Mapping from camelCase to snake_case for all product fields
const fieldMap: Record<string, string> = {
  name: 'name',
  articulo: 'articulo',
  category: 'category',
  productType: 'product_type',
  brand: 'brand',
  model: 'model',
  description: 'description',
  purchasePrice: 'purchase_price',
  salePrice: 'sale_price',
  sku: 'sku',
  barcode: 'barcode',
  stock: 'stock',
  reorderPoint: 'reorder_point',
  supplier: 'supplier',
  supplierId: 'supplier_id',
  entryDate: 'entry_date',
  imageUrl: 'image_url',
  images: 'image_urls',
  locationInStore: 'location_in_store',
  notes: 'notes',
  tags: 'tags',
  expiryDate: 'expiry_date',
  batchNumber: 'batch_number',
  netWeight: 'net_weight',
  weightUnit: 'weight_unit',
  sanitaryRegistration: 'sanitary_registration',
  storageTemperature: 'storage_temperature',
  ingredients: 'ingredients',
  nutritionalInfo: 'nutritional_info',
  alcoholContent: 'alcohol_content',
  allergens: 'allergens',
  size: 'size',
  color: 'color',
  material: 'material',
  gender: 'gender',
  season: 'season',
  garmentType: 'garment_type',
  washingInstructions: 'washing_instructions',
  countryOfOrigin: 'country_of_origin',
  serialNumber: 'serial_number',
  warrantyMonths: 'warranty_months',
  technicalSpecs: 'technical_specs',
  voltage: 'voltage',
  powerWatts: 'power_watts',
  compatibility: 'compatibility',
  includesAccessories: 'includes_accessories',
  productCondition: 'product_condition',
  activeIngredient: 'active_ingredient',
  concentration: 'concentration',
  requiresPrescription: 'requires_prescription',
  administrationRoute: 'administration_route',
  presentation: 'presentation',
  unitsPerPackage: 'units_per_package',
  laboratory: 'laboratory',
  contraindications: 'contraindications',
  dimensions: 'dimensions',
  weight: 'weight',
  caliber: 'caliber',
  resistance: 'resistance',
  finish: 'finish',
  recommendedUse: 'recommended_use',
  author: 'author',
  publisher: 'publisher',
  isbn: 'isbn',
  pages: 'pages',
  language: 'language',
  publicationYear: 'publication_year',
  edition: 'edition',
  bookFormat: 'book_format',
  recommendedAge: 'recommended_age',
  numberOfPlayers: 'number_of_players',
  gameType: 'game_type',
  requiresBatteries: 'requires_batteries',
  packageDimensions: 'package_dimensions',
  packageContents: 'package_contents',
  safetyWarnings: 'safety_warnings',
  sedeId: 'sede_id',
};

interface RecipeRow extends RowDataPacket {
  product_id: string;
  ingredient_id: string;
  quantity: number;
  ingredient_stock: number;
  ingredient_purchase_price: number;
}

export class ProductsService {
  private async enrichWithBOMStock(products: Product[], tenantId: string): Promise<Product[]> {
    let recipes: RecipeRow[];
    try {
      const [rows] = await db.execute<RecipeRow[]>(
        `SELECT pr.product_id, pr.ingredient_id, pr.quantity, p.stock as ingredient_stock, p.purchase_price as ingredient_purchase_price
         FROM product_recipes pr
         JOIN products p ON p.id = pr.ingredient_id
         WHERE pr.tenant_id = ?`,
        [tenantId]
      );
      recipes = rows;
    } catch {
      // Table product_recipes may not exist yet
      return products;
    }

    if (recipes.length === 0) return products;

    const recipeMap = new Map<string, Array<{ ingredientStock: number; quantity: number; ingredientPurchasePrice: number }>>();
    for (const r of recipes) {
      if (!recipeMap.has(r.product_id)) recipeMap.set(r.product_id, []);
      recipeMap.get(r.product_id)!.push({
        ingredientStock: r.ingredient_stock,
        quantity: Number(r.quantity),
        ingredientPurchasePrice: Number(r.ingredient_purchase_price),
      });
    }

    return products.map(p => {
      const recipe = recipeMap.get(p.id);
      if (recipe && recipe.length > 0) {
        const availableStock = Math.floor(
          Math.min(...recipe.map(i => i.ingredientStock / i.quantity))
        );
        const bomCost = recipe.reduce((sum, i) => sum + i.ingredientPurchasePrice * i.quantity, 0);
        return { ...p, stock: availableStock, isComposite: true, bomCost };
      }
      return p;
    });
  }

  private mapProduct(row: ProductRow): Product {
    return {
      id: row.id,
      name: row.name,
      articulo: row.articulo || undefined,
      category: row.category,
      productType: row.product_type || 'general',
      brand: row.brand || undefined,
      model: row.model || undefined,
      description: row.description || undefined,
      purchasePrice: Number(row.purchase_price),
      salePrice: Number(row.sale_price),
      sku: row.sku,
      barcode: row.barcode || undefined,
      stock: row.stock,
      reorderPoint: row.reorder_point,
      supplier: row.supplier || undefined,
      supplierId: row.supplier_id || undefined,
      entryDate: row.entry_date,
      imageUrl: row.image_url || undefined,
      images: row.image_urls ? (typeof row.image_urls === 'string' ? JSON.parse(row.image_urls) : row.image_urls) : undefined,
      locationInStore: row.location_in_store || undefined,
      notes: row.notes || undefined,
      tags: row.tags ? (typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags) : undefined,
      // Alimentos / Bebidas
      expiryDate: row.expiry_date || undefined,
      batchNumber: row.batch_number || undefined,
      netWeight: row.net_weight != null ? Number(row.net_weight) : undefined,
      weightUnit: row.weight_unit as any || undefined,
      sanitaryRegistration: row.sanitary_registration || undefined,
      storageTemperature: row.storage_temperature || undefined,
      ingredients: row.ingredients || undefined,
      nutritionalInfo: row.nutritional_info || undefined,
      alcoholContent: row.alcohol_content != null ? Number(row.alcohol_content) : undefined,
      allergens: row.allergens || undefined,
      // Ropa
      size: row.size || undefined,
      color: row.color || undefined,
      material: row.material || undefined,
      gender: row.gender as any || undefined,
      season: row.season as any || undefined,
      garmentType: row.garment_type || undefined,
      washingInstructions: row.washing_instructions || undefined,
      countryOfOrigin: row.country_of_origin || undefined,
      // Electronica
      serialNumber: row.serial_number || undefined,
      warrantyMonths: row.warranty_months != null ? Number(row.warranty_months) : undefined,
      technicalSpecs: row.technical_specs || undefined,
      voltage: row.voltage || undefined,
      powerWatts: row.power_watts != null ? Number(row.power_watts) : undefined,
      compatibility: row.compatibility || undefined,
      includesAccessories: row.includes_accessories || undefined,
      productCondition: row.product_condition as any || undefined,
      // Farmacia
      activeIngredient: row.active_ingredient || undefined,
      concentration: row.concentration || undefined,
      requiresPrescription: row.requires_prescription != null ? Boolean(row.requires_prescription) : undefined,
      administrationRoute: row.administration_route || undefined,
      presentation: row.presentation || undefined,
      unitsPerPackage: row.units_per_package != null ? Number(row.units_per_package) : undefined,
      laboratory: row.laboratory || undefined,
      contraindications: row.contraindications || undefined,
      // Ferreteria
      dimensions: row.dimensions || undefined,
      weight: row.weight != null ? Number(row.weight) : undefined,
      caliber: row.caliber || undefined,
      resistance: row.resistance || undefined,
      finish: row.finish || undefined,
      recommendedUse: row.recommended_use || undefined,
      // Libreria
      author: row.author || undefined,
      publisher: row.publisher || undefined,
      isbn: row.isbn || undefined,
      pages: row.pages != null ? Number(row.pages) : undefined,
      language: row.language || undefined,
      publicationYear: row.publication_year != null ? Number(row.publication_year) : undefined,
      edition: row.edition || undefined,
      bookFormat: row.book_format as any || undefined,
      // Juguetes
      recommendedAge: row.recommended_age || undefined,
      numberOfPlayers: row.number_of_players || undefined,
      gameType: row.game_type || undefined,
      requiresBatteries: row.requires_batteries != null ? Boolean(row.requires_batteries) : undefined,
      packageDimensions: row.package_dimensions || undefined,
      packageContents: row.package_contents || undefined,
      safetyWarnings: row.safety_warnings || undefined,
      sedeId: row.sede_id || undefined,
      // Timestamps
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      stockStatus: getStockStatus(row.stock, row.reorder_point),
    };
  }

  async findAll(
    tenantId: string,
    page = 1,
    limit = 10,
    filters?: ProductFilters
  ): Promise<PaginatedResponse<Product>> {
    const offset = (page - 1) * limit;
    const conditions: string[] = ['tenant_id = ?'];
    const values: (string | number)[] = [tenantId];

    if (filters?.category) {
      conditions.push('category = ?');
      values.push(filters.category);
    }

    if (filters?.productType) {
      conditions.push('product_type = ?');
      values.push(filters.productType);
    }

    if (filters?.search) {
      conditions.push('(name LIKE ? OR articulo LIKE ? OR sku LIKE ? OR brand LIKE ? OR barcode LIKE ?)');
      const searchTerm = `%${filters.search}%`;
      values.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (filters?.minPrice !== undefined) {
      conditions.push('sale_price >= ?');
      values.push(filters.minPrice);
    }

    if (filters?.maxPrice !== undefined) {
      conditions.push('sale_price <= ?');
      values.push(filters.maxPrice);
    }

    if (filters?.sedeId) {
      conditions.push('sede_id = ?');
      values.push(filters.sedeId);
    }

    if (filters?.stockStatus) {
      switch (filters.stockStatus) {
        case 'agotado':
          conditions.push('stock = 0');
          break;
        case 'bajo':
          conditions.push('stock > 0 AND stock <= reorder_point');
          break;
        case 'suficiente':
          conditions.push('stock > reorder_point');
          break;
      }
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const [countResult] = await db.execute<CountRow[]>(
      `SELECT COUNT(*) as total FROM products ${whereClause}`,
      values
    );
    const total = countResult[0].total;

    const [rows] = await db.execute<ProductRow[]>(
      `SELECT * FROM products ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...values, String(limit), String(offset)]
    );

    const mappedProducts = rows.map(this.mapProduct);
    const enrichedProducts = await this.enrichWithBOMStock(mappedProducts, tenantId);

    return {
      data: enrichedProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string, tenantId?: string): Promise<Product> {
    const query = tenantId
      ? 'SELECT * FROM products WHERE id = ? AND tenant_id = ?'
      : 'SELECT * FROM products WHERE id = ?';
    const params = tenantId ? [id, tenantId] : [id];
    const [rows] = await db.execute<ProductRow[]>(query, params);

    if (rows.length === 0) {
      throw new AppError('Producto no encontrado', 404);
    }

    const product = this.mapProduct(rows[0]);
    if (tenantId) {
      const [enriched] = await this.enrichWithBOMStock([product], tenantId);
      return enriched;
    }
    return product;
  }

  async findBySku(sku: string, tenantId?: string): Promise<Product> {
    const query = tenantId
      ? 'SELECT * FROM products WHERE sku = ? AND tenant_id = ?'
      : 'SELECT * FROM products WHERE sku = ?';
    const params = tenantId ? [sku, tenantId] : [sku];
    const [rows] = await db.execute<ProductRow[]>(query, params);

    if (rows.length === 0) {
      throw new AppError('Producto no encontrado', 404);
    }

    return this.mapProduct(rows[0]);
  }

  async findByBarcode(barcode: string, tenantId?: string): Promise<Product> {
    const query = tenantId
      ? 'SELECT * FROM products WHERE barcode = ? AND tenant_id = ?'
      : 'SELECT * FROM products WHERE barcode = ?';
    const params = tenantId ? [barcode, tenantId] : [barcode];
    const [rows] = await db.execute<ProductRow[]>(query, params);

    if (rows.length === 0) {
      throw new AppError('Producto no encontrado con este código de barras', 404);
    }

    return this.mapProduct(rows[0]);
  }

  async create(tenantId: string, data: Record<string, any>): Promise<Product> {
    // Verificar SKU unico dentro del tenant
    const [existing] = await db.execute<ProductRow[]>(
      'SELECT id FROM products WHERE sku = ? AND tenant_id = ?',
      [data.sku, tenantId]
    );

    if (existing.length > 0) {
      throw new AppError('El SKU ya existe', 400);
    }

    // Verificar barcode unico si se proporciona
    if (data.barcode) {
      const [existingBarcode] = await db.execute<ProductRow[]>(
        'SELECT id FROM products WHERE barcode = ? AND tenant_id = ?',
        [data.barcode, tenantId]
      );
      if (existingBarcode.length > 0) {
        throw new AppError('El código de barras ya existe', 400);
      }
    }

    const id = uuidv4();

    // Build dynamic column/value lists from provided data
    const columns: string[] = ['id', 'tenant_id'];
    const placeholders: string[] = ['?', '?'];
    const insertValues: any[] = [id, tenantId];

    const formatToDate = (v: any) => {
      if (!v) return null;
      const d = v instanceof Date ? v : new Date(v);
      if (isNaN(d.getTime())) return null;
      return d.toISOString().slice(0, 10); // YYYY-MM-DD
    };

    for (const [camelKey, value] of Object.entries(data)) {
      if (value === undefined || value === null || value === '') continue;
      const dbCol = fieldMap[camelKey];
      if (!dbCol) continue;
      columns.push(dbCol);
      placeholders.push('?');
      if ((camelKey === 'tags' || camelKey === 'images') && Array.isArray(value)) {
        insertValues.push(JSON.stringify(value));
      } else if (camelKey === 'expiryDate' || camelKey === 'entryDate') {
        // Ensure date-only format for DATE columns
        insertValues.push(formatToDate(value));
      } else {
        insertValues.push(value);
      }
    }

    await db.execute<ResultSetHeader>(
      `INSERT INTO products (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`,
      insertValues
    );

    return this.findById(id);
  }

  async update(id: string, data: Record<string, any>, tenantId?: string): Promise<Product> {
    await this.findById(id, tenantId);

    // Si se actualiza SKU, verificar que sea unico dentro del tenant
    if (data.sku) {
      const skuQuery = tenantId
        ? 'SELECT id FROM products WHERE sku = ? AND id != ? AND tenant_id = ?'
        : 'SELECT id FROM products WHERE sku = ? AND id != ?';
      const skuParams = tenantId ? [data.sku, id, tenantId] : [data.sku, id];
      const [existing] = await db.execute<ProductRow[]>(skuQuery, skuParams);

      if (existing.length > 0) {
        throw new AppError('El SKU ya existe', 400);
      }
    }

    // Si se actualiza barcode, verificar que sea unico
    if (data.barcode) {
      const barcodeQuery = tenantId
        ? 'SELECT id FROM products WHERE barcode = ? AND id != ? AND tenant_id = ?'
        : 'SELECT id FROM products WHERE barcode = ? AND id != ?';
      const barcodeParams = tenantId ? [data.barcode, id, tenantId] : [data.barcode, id];
      const [existingBarcode] = await db.execute<ProductRow[]>(barcodeQuery, barcodeParams);

      if (existingBarcode.length > 0) {
        throw new AppError('El código de barras ya existe', 400);
      }
    }

    const updates: string[] = [];
    const values: any[] = [];

    const formatToDate = (v: any) => {
      if (!v) return null;
      const d = v instanceof Date ? v : new Date(v);
      if (isNaN(d.getTime())) return null;
      return d.toISOString().slice(0, 10);
    };

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined || !fieldMap[key]) continue;
      updates.push(`${fieldMap[key]} = ?`);
      if ((key === 'tags' || key === 'images') && Array.isArray(value)) {
        values.push(JSON.stringify(value));
      } else if (key === 'expiryDate' || key === 'entryDate') {
        values.push(formatToDate(value));
      } else {
        values.push(value === '' ? null : value);
      }
    }

    if (updates.length === 0) {
      throw new AppError('No hay datos para actualizar', 400);
    }

    values.push(id);

    await db.execute(
      `UPDATE products SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  async delete(id: string, tenantId?: string): Promise<void> {
    await this.findById(id, tenantId);

    try {
      const [result] = await db.execute<ResultSetHeader>(
        'DELETE FROM products WHERE id = ?',
        [id]
      );

      if (result.affectedRows === 0) {
        throw new AppError('No se pudo eliminar el producto', 500);
      }
    } catch (error: any) {
      if (error.code === 'ER_ROW_IS_REFERENCED_2') {
        throw new AppError('No se puede eliminar el producto porque tiene ventas asociadas', 400);
      }
      throw error;
    }
  }

  async updateStock(id: string, quantity: number): Promise<Product> {
    const product = await this.findById(id);

    const newStock = product.stock + quantity;

    if (newStock < 0) {
      throw new AppError('Stock insuficiente', 400);
    }

    await db.execute(
      'UPDATE products SET stock = ? WHERE id = ?',
      [newStock, id]
    );

    return this.findById(id);
  }

  async bulkCreate(
    tenantId: string,
    products: Array<Record<string, any>>
  ): Promise<{
    totalReceived: number;
    totalCreated: number;
    totalFailed: number;
    errors: Array<{ row: number; sku: string; error: string }>;
  }> {
    const pool = db;
    const connection = await (pool as any).getConnection();
    const result = {
      totalReceived: products.length,
      totalCreated: 0,
      totalFailed: 0,
      errors: [] as Array<{ row: number; sku: string; error: string }>,
    };

    try {
      await connection.beginTransaction();

      // Pre-fetch existing SKUs and barcodes for this tenant
      const [existingRows] = await connection.execute(
        'SELECT sku, barcode FROM products WHERE tenant_id = ?',
        [tenantId]
      ) as [RowDataPacket[], any];
      const skuSet = new Set(existingRows.map((r: any) => r.sku));
      const barcodeSet = new Set(
        existingRows.filter((r: any) => r.barcode).map((r: any) => r.barcode)
      );

      // Track within-batch duplicates
      const batchSkuSet = new Set<string>();
      const batchBarcodeSet = new Set<string>();

      // Pre-fetch categorías del tenant para resolver/crear automáticamente
      const [catRows] = await connection.execute(
        'SELECT id, name FROM categories WHERE tenant_id = ?',
        [tenantId]
      ) as [RowDataPacket[], any];
      const catById = new Set<string>(catRows.map((c: any) => String(c.id)));
      const catByName = new Map<string, string>(
        catRows.map((c: any) => [String(c.name).toLowerCase().trim(), String(c.id)])
      );
      const slugify = (s: string) =>
        String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
          .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || uuidv4().slice(0, 8);

      // Resuelve el valor de categoría (id o nombre) a un id; crea la categoría si no existe.
      const resolveCategory = async (value: string): Promise<string> => {
        const raw = String(value).trim();
        if (catById.has(raw)) return raw;
        const lower = raw.toLowerCase();
        if (catByName.has(lower)) return catByName.get(lower)!;
        // Crear nueva categoría
        let id = slugify(raw);
        if (catById.has(id)) return id; // el slug ya existe → reutilizar
        await connection.execute(
          'INSERT INTO categories (id, tenant_id, name) VALUES (?, ?, ?)',
          [id, tenantId, raw]
        );
        catById.add(id);
        catByName.set(lower, id);
        return id;
      };

      for (let i = 0; i < products.length; i++) {
        const data = products[i];
        const rowNum = i + 2; // row 1 = header
        try {
          if (!data.name || !data.sku || !data.category) {
            throw new Error('Faltan campos requeridos (name, sku, category)');
          }

          // Resuelve la categoría (id o nombre); la crea automáticamente si no existe
          data.category = await resolveCategory(data.category);

          if (skuSet.has(data.sku) || batchSkuSet.has(data.sku)) {
            throw new Error(`SKU "${data.sku}" duplicado`);
          }

          if (data.barcode) {
            if (barcodeSet.has(data.barcode) || batchBarcodeSet.has(data.barcode)) {
              throw new Error(`Código de barras "${data.barcode}" duplicado`);
            }
          }

          const id = uuidv4();
          const columns: string[] = ['id', 'tenant_id'];
          const placeholders: string[] = ['?', '?'];
          const insertValues: any[] = [id, tenantId];

          for (const [camelKey, value] of Object.entries(data)) {
            if (value === undefined || value === null || value === '') continue;
            const dbCol = fieldMap[camelKey];
            if (!dbCol) continue;
            columns.push(dbCol);
            placeholders.push('?');
            if (camelKey === 'tags' && Array.isArray(value)) {
              insertValues.push(JSON.stringify(value));
            } else {
              insertValues.push(value);
            }
          }

          await connection.execute(
            `INSERT INTO products (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`,
            insertValues
          );

          skuSet.add(data.sku);
          batchSkuSet.add(data.sku);
          if (data.barcode) {
            barcodeSet.add(data.barcode);
            batchBarcodeSet.add(data.barcode);
          }

          result.totalCreated++;
        } catch (err: any) {
          result.totalFailed++;
          result.errors.push({
            row: rowNum,
            sku: data.sku || `(fila ${rowNum})`,
            error: err.message || 'Error desconocido',
          });
        }
      }

      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    return result;
  }

  async getLowStock(tenantId: string): Promise<Product[]> {
    const [rows] = await db.execute<ProductRow[]>(
      'SELECT * FROM products WHERE stock <= reorder_point AND tenant_id = ? ORDER BY stock ASC',
      [tenantId]
    );

    return rows.map(this.mapProduct);
  }

  async getOutOfStock(tenantId: string): Promise<Product[]> {
    const [rows] = await db.execute<ProductRow[]>(
      'SELECT * FROM products WHERE stock = 0 AND tenant_id = ?',
      [tenantId]
    );

    return rows.map(this.mapProduct);
  }

  async exportCsv(tenantId: string, filters?: ProductFilters): Promise<string> {
    const conditions: string[] = ['tenant_id = ?'];
    const values: (string | number)[] = [tenantId];

    if (filters?.category) {
      conditions.push('category = ?');
      values.push(filters.category);
    }
    if (filters?.productType) {
      conditions.push('product_type = ?');
      values.push(filters.productType);
    }
    if (filters?.search) {
      conditions.push('(name LIKE ? OR sku LIKE ? OR brand LIKE ? OR barcode LIKE ?)');
      const s = `%${filters.search}%`;
      values.push(s, s, s, s);
    }
    if (filters?.stockStatus) {
      switch (filters.stockStatus) {
        case 'agotado': conditions.push('stock = 0'); break;
        case 'bajo':    conditions.push('stock > 0 AND stock <= reorder_point'); break;
        case 'suficiente': conditions.push('stock > reorder_point'); break;
      }
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const [rows] = await db.execute<ProductRow[]>(
      `SELECT * FROM products ${whereClause} ORDER BY name ASC`,
      values
    );

    const products = rows.map(this.mapProduct);
    const enriched = await this.enrichWithBOMStock(products, tenantId);

    const escape = (v: unknown): string => {
      if (v == null) return '';
      const s = String(v).replace(/"/g, '""');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
    };

    const headers = [
      'ID', 'Nombre (tienda)', 'Artículo (inventario)', 'SKU', 'Código de barras', 'Tipo', 'Categoría', 'Marca', 'Modelo',
      'Descripción', 'Precio compra', 'Precio venta', 'Stock', 'Punto reorden',
      'Estado stock', 'Proveedor', 'Fecha entrada', 'Fecha vencimiento',
      'Ubicación en tienda', 'Talla', 'Color', 'Material', 'Género', 'Temporada',
      'Número serie', 'Garantía (meses)', 'Ingrediente activo', 'Concentración',
      'Requiere receta', 'Laboratorio', 'Dimensiones', 'Peso', 'ISBN',
      'Autor', 'Editorial', 'Páginas', 'Año publicación',
      'Publicado en tienda', 'Disponible domicilio', 'En oferta', 'Precio oferta',
      'Notas', 'Sede ID', 'Creado',
    ];

    const toDate = (v: unknown) => v ? new Date(v as string).toISOString().split('T')[0] : '';

    const csvRows = enriched.map(p => [
      p.id, p.name, p.articulo ?? '', p.sku, p.barcode ?? '',
      p.productType, p.category, p.brand ?? '', p.model ?? '',
      p.description ?? '', p.purchasePrice, p.salePrice,
      p.stock, p.reorderPoint, p.stockStatus ?? '',
      p.supplier ?? '', toDate(p.entryDate), toDate(p.expiryDate),
      p.locationInStore ?? '', p.size ?? '', p.color ?? '',
      p.material ?? '', p.gender ?? '', p.season ?? '',
      p.serialNumber ?? '', p.warrantyMonths ?? '',
      p.activeIngredient ?? '', p.concentration ?? '',
      p.requiresPrescription != null ? (p.requiresPrescription ? 'Sí' : 'No') : '',
      p.laboratory ?? '', p.dimensions ?? '', p.weight ?? '',
      p.isbn ?? '', p.author ?? '', p.publisher ?? '',
      p.pages ?? '', p.publicationYear ?? '',
      (p as any).publishedInStore ? 'Sí' : 'No',
      (p as any).availableForDelivery ? 'Sí' : 'No',
      (p as any).isOnOffer ? 'Sí' : 'No',
      (p as any).offerPrice ?? '',
      p.notes ?? '', p.sedeId ?? '', toDate(p.createdAt),
    ].map(escape).join(','));

    return [headers.join(','), ...csvRows].join('\r\n');
  }

  async updatePreorder(
    productId: string,
    tenantId: string,
    data: {
      isPreorder: boolean;
      preorderWindowEnd: string | null;
      preorderShipStart: string | null;
      preorderShipEnd: string | null;
      preorderBadgeText: string;
      preorderPolicyText: string | null;
    }
  ) {
    const [result] = await db.execute(
      `UPDATE products SET
        is_preorder = ?,
        preorder_window_end = ?,
        preorder_ship_start = ?,
        preorder_ship_end = ?,
        preorder_badge_text = ?,
        preorder_policy_text = ?
      WHERE id = ? AND tenant_id = ?`,
      [
        data.isPreorder ? 1 : 0,
        data.preorderWindowEnd || null,
        data.preorderShipStart || null,
        data.preorderShipEnd || null,
        data.preorderBadgeText || 'Pre-orden',
        data.preorderPolicyText || null,
        productId,
        tenantId,
      ]
    ) as any;

    if ((result as ResultSetHeader).affectedRows === 0) {
      throw new AppError('Producto no encontrado', 404);
    }

    return this.findById(productId, tenantId);
  }
}

export const productsService = new ProductsService();
