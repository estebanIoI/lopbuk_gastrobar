/**
 * rutina.service.ts
 * Módulo CONSUMIDOR (estilo de vida / rutina). Datos cross-comercio que
 * pertenecen a la PERSONA (users.id), no a un tenant.
 *
 * Reglas del proyecto:
 *  - Toda la lógica vive aquí (no en routes/controllers).
 *  - Se filtra SIEMPRE por user_id (dueño de los datos), tomado del JWT.
 *  - Errores con AppError('mensaje', httpCode).
 */
import { db } from '../../config';
import { AppError } from '../../common/middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────
interface Row extends RowDataPacket {}

// ─────────────────────────────────────────────────────────────
// PERFIL
// ─────────────────────────────────────────────────────────────
export async function getPerfil(userId: string) {
  const [rows] = await db.execute<Row[]>(
    'SELECT * FROM rutina_perfil WHERE user_id = ? LIMIT 1',
    [userId]
  );
  return rows[0] || null;
}

export async function upsertPerfil(userId: string, data: any) {
  await db.execute<ResultSetHeader>(
    `INSERT INTO rutina_perfil
       (user_id, birth_date, sex, height_cm, weight_kg, goal, activity_level,
        daily_calorie_target, target_weight_kg, bmr, tdee, bmi, water_target_ml,
        dietary_prefs, allergies, city)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       birth_date=VALUES(birth_date), sex=VALUES(sex), height_cm=VALUES(height_cm),
       weight_kg=VALUES(weight_kg), goal=VALUES(goal), activity_level=VALUES(activity_level),
       daily_calorie_target=VALUES(daily_calorie_target), target_weight_kg=VALUES(target_weight_kg),
       bmr=VALUES(bmr), tdee=VALUES(tdee), bmi=VALUES(bmi), water_target_ml=VALUES(water_target_ml),
       dietary_prefs=VALUES(dietary_prefs), allergies=VALUES(allergies), city=VALUES(city), updated_at=NOW()`,
    [
      userId,
      data.birthDate || null,
      data.sex || null,
      data.heightCm ?? null,
      data.weightKg ?? null,
      data.goal || null,
      data.activityLevel || null,
      data.dailyCalorieTarget ?? null,
      data.targetWeightKg ?? null,
      data.bmr ?? null,
      data.tdee ?? null,
      data.bmi ?? null,
      data.waterTargetMl ?? null,
      data.dietaryPrefs ? JSON.stringify(data.dietaryPrefs) : null,
      data.allergies || null,
      data.city || null,
    ]
  );
  return getPerfil(userId);
}

// ─────────────────────────────────────────────────────────────
// DESPENSA
// ─────────────────────────────────────────────────────────────
export async function listDespensa(userId: string) {
  const [rows] = await db.execute<Row[]>(
    `SELECT id, name, quantity, unit, category, product_id AS productId,
            expires_at AS expiresAt, updated_at AS updatedAt
     FROM rutina_despensa WHERE user_id = ?
     ORDER BY (expires_at IS NULL) ASC, expires_at ASC, name ASC`,
    [userId]
  );
  return rows;
}

export async function addDespensa(userId: string, data: any) {
  if (!data.name?.trim()) throw new AppError('El nombre es requerido', 400);
  const id = uuidv4();
  await db.execute<ResultSetHeader>(
    `INSERT INTO rutina_despensa (id, user_id, name, quantity, unit, category, product_id, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, data.name.trim(), data.quantity ?? 0, data.unit || null,
     data.category || null, data.productId || null, data.expiresAt || null]
  );
  return { id };
}

export async function updateDespensa(userId: string, id: string, data: any) {
  const [rows] = await db.execute<Row[]>(
    'SELECT * FROM rutina_despensa WHERE id = ? AND user_id = ?', [id, userId]
  );
  if (!rows.length) throw new AppError('Ítem no encontrado', 404);
  const c = rows[0];
  await db.execute<ResultSetHeader>(
    `UPDATE rutina_despensa SET name=?, quantity=?, unit=?, category=?, expires_at=?
     WHERE id=? AND user_id=?`,
    [
      data.name ?? c.name,
      data.quantity ?? c.quantity,
      data.unit !== undefined ? data.unit : c.unit,
      data.category !== undefined ? data.category : c.category,
      data.expiresAt !== undefined ? data.expiresAt : c.expires_at,
      id, userId,
    ]
  );
  return { id };
}

export async function deleteDespensa(userId: string, id: string) {
  const [r] = await db.execute<ResultSetHeader>(
    'DELETE FROM rutina_despensa WHERE id = ? AND user_id = ?', [id, userId]
  );
  if (r.affectedRows === 0) throw new AppError('Ítem no encontrado', 404);
}

// ─────────────────────────────────────────────────────────────
// RECETAS + INGREDIENTES
// ─────────────────────────────────────────────────────────────
export async function listRecetas(userId: string) {
  const [rows] = await db.execute<Row[]>(
    `SELECT id, name, description, servings, prep_minutes AS prepMinutes,
            calories, image_url AS imageUrl, is_public AS isPublic
     FROM rutina_recetas WHERE user_id = ? AND is_active = 1
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

export async function getReceta(userId: string, id: string) {
  const [rows] = await db.execute<Row[]>(
    `SELECT id, name, description, instructions, servings, prep_minutes AS prepMinutes,
            calories, image_url AS imageUrl, is_public AS isPublic
     FROM rutina_recetas WHERE id = ? AND user_id = ? AND is_active = 1`,
    [id, userId]
  );
  if (!rows.length) throw new AppError('Receta no encontrada', 404);
  const [ings] = await db.execute<Row[]>(
    `SELECT id, name, quantity, unit, product_id AS productId, is_optional AS isOptional
     FROM rutina_receta_ingredientes WHERE receta_id = ? AND user_id = ?`,
    [id, userId]
  );
  return { ...rows[0], ingredients: ings };
}

export async function createReceta(userId: string, data: any) {
  if (!data.name?.trim()) throw new AppError('El nombre es requerido', 400);
  const id = uuidv4();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `INSERT INTO rutina_recetas
         (id, user_id, name, description, instructions, servings, prep_minutes, cook_minutes,
          total_minutes, difficulty, meal_type, calories, protein_g, carbs_g, fat_g, image_url, is_public)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, data.name.trim(), data.description || null, data.instructions || null,
       data.servings ?? 1, data.prepMinutes ?? null, data.cookMinutes ?? null,
       data.totalMinutes ?? null, data.difficulty || null, data.mealType || 'cualquiera',
       data.calories ?? null, data.proteinG ?? null, data.carbsG ?? null, data.fatG ?? null,
       data.imageUrl || null, data.isPublic ? 1 : 0]
    );
    for (const ing of (data.ingredients || [])) {
      if (!ing.name?.trim()) continue;
      await conn.execute(
        `INSERT INTO rutina_receta_ingredientes
           (id, receta_id, user_id, name, quantity, unit, product_id, is_optional)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), id, userId, ing.name.trim(), ing.quantity ?? 0, ing.unit || null,
         ing.productId || null, ing.isOptional ? 1 : 0]
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  return getReceta(userId, id);
}

export async function deleteReceta(userId: string, id: string) {
  // Soft delete (regla del proyecto: is_active = 0)
  const [r] = await db.execute<ResultSetHeader>(
    'UPDATE rutina_recetas SET is_active = 0 WHERE id = ? AND user_id = ?', [id, userId]
  );
  if (r.affectedRows === 0) throw new AppError('Receta no encontrada', 404);
}

/**
 * "¿Qué puedo cocinar?": cruza ingredientes de cada receta contra la despensa.
 * Devuelve recetas ordenadas por % de ingredientes disponibles (match por nombre).
 */
export async function recetasQuePuedoHacer(userId: string) {
  const [recetas] = await db.execute<Row[]>(
    `SELECT id, name, image_url AS imageUrl, prep_minutes AS prepMinutes, calories
     FROM rutina_recetas WHERE user_id = ? AND is_active = 1`,
    [userId]
  );
  const [ings] = await db.execute<Row[]>(
    'SELECT receta_id, name, is_optional FROM rutina_receta_ingredientes WHERE user_id = ?',
    [userId]
  );
  const [despensa] = await db.execute<Row[]>(
    'SELECT name FROM rutina_despensa WHERE user_id = ? AND quantity > 0', [userId]
  );

  const pantry = (despensa as any[]).map(d => String(d.name).toLowerCase().trim());
  const have = (n: string) => {
    const x = n.toLowerCase().trim();
    return pantry.some(p => p.includes(x) || x.includes(p));
  };

  const byReceta: Record<string, any[]> = {};
  for (const i of ings as any[]) {
    (byReceta[i.receta_id] ||= []).push(i);
  }

  return (recetas as any[]).map(r => {
    const list = byReceta[r.id] || [];
    const required = list.filter(i => !i.is_optional);
    const total = required.length || 1;
    const owned = required.filter(i => have(i.name));
    const missing = required.filter(i => !have(i.name)).map(i => i.name);
    return {
      ...r,
      totalIngredients: required.length,
      ownedCount: owned.length,
      matchPct: Math.round((owned.length / total) * 100),
      missing,
      canCook: missing.length === 0,
    };
  }).sort((a, b) => b.matchPct - a.matchPct);
}

// ─────────────────────────────────────────────────────────────
// RUTINAS + ACTIVIDADES
// ─────────────────────────────────────────────────────────────
export async function listRutinas(userId: string) {
  const [rutinas] = await db.execute<Row[]>(
    `SELECT id, name, type, color, is_active AS isActive
     FROM rutina_rutinas WHERE user_id = ? AND is_active = 1 ORDER BY created_at ASC`,
    [userId]
  );
  const [acts] = await db.execute<Row[]>(
    `SELECT id, rutina_id AS rutinaId, day_of_week AS dayOfWeek, start_time AS startTime,
            title, type, ref_type AS refType, ref_id AS refId, notes, sort_order AS sortOrder
     FROM rutina_actividades WHERE user_id = ? AND is_active = 1
     ORDER BY sort_order ASC, start_time ASC`,
    [userId]
  );
  const byRutina: Record<string, any[]> = {};
  for (const a of acts as any[]) (byRutina[a.rutinaId] ||= []).push(a);
  return (rutinas as any[]).map(r => ({ ...r, activities: byRutina[r.id] || [] }));
}

export async function createRutina(userId: string, data: any) {
  if (!data.name?.trim()) throw new AppError('El nombre es requerido', 400);
  const id = uuidv4();
  await db.execute<ResultSetHeader>(
    'INSERT INTO rutina_rutinas (id, user_id, name, type, color) VALUES (?, ?, ?, ?, ?)',
    [id, userId, data.name.trim(), data.type || 'general', data.color || null]
  );
  return { id };
}

export async function deleteRutina(userId: string, id: string) {
  const [r] = await db.execute<ResultSetHeader>(
    'UPDATE rutina_rutinas SET is_active = 0 WHERE id = ? AND user_id = ?', [id, userId]
  );
  if (r.affectedRows === 0) throw new AppError('Rutina no encontrada', 404);
}

export async function addActividad(userId: string, rutinaId: string, data: any) {
  const [owner] = await db.execute<Row[]>(
    'SELECT id FROM rutina_rutinas WHERE id = ? AND user_id = ?', [rutinaId, userId]
  );
  if (!owner.length) throw new AppError('Rutina no encontrada', 404);
  if (!data.title?.trim()) throw new AppError('El título es requerido', 400);
  const id = uuidv4();
  await db.execute<ResultSetHeader>(
    `INSERT INTO rutina_actividades
       (id, rutina_id, user_id, day_of_week, start_time, title, type, ref_type, ref_id, notes, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, rutinaId, userId, data.dayOfWeek ?? null, data.startTime || null,
     data.title.trim(), data.type || 'otro', data.refType || 'ninguno',
     data.refId || null, data.notes || null, data.sortOrder ?? 0]
  );
  return { id };
}

export async function deleteActividad(userId: string, id: string) {
  const [r] = await db.execute<ResultSetHeader>(
    'UPDATE rutina_actividades SET is_active = 0 WHERE id = ? AND user_id = ?', [id, userId]
  );
  if (r.affectedRows === 0) throw new AppError('Actividad no encontrada', 404);
}

/** Marca/desmarca una actividad como cumplida en una fecha (rutina_actividades_log). */
export async function toggleActividadLog(userId: string, actividadId: string, date: string) {
  const [owner] = await db.execute<Row[]>(
    'SELECT id FROM rutina_actividades WHERE id = ? AND user_id = ?', [actividadId, userId]
  );
  if (!owner.length) throw new AppError('Actividad no encontrada', 404);
  const logDate = date || new Date().toISOString().slice(0, 10);

  const [existing] = await db.execute<Row[]>(
    'SELECT id, completed FROM rutina_actividades_log WHERE actividad_id = ? AND log_date = ?',
    [actividadId, logDate]
  );
  if (existing.length) {
    const next = existing[0].completed ? 0 : 1;
    await db.execute<ResultSetHeader>(
      'UPDATE rutina_actividades_log SET completed = ? WHERE id = ?', [next, existing[0].id]
    );
    return { completed: next === 1 };
  }
  await db.execute<ResultSetHeader>(
    'INSERT INTO rutina_actividades_log (id, actividad_id, user_id, log_date, completed) VALUES (?, ?, ?, ?, 1)',
    [uuidv4(), actividadId, userId, logDate]
  );
  return { completed: true };
}

/** Logs de cumplimiento del usuario en un rango (para la vista semanal). */
export async function getActividadesLog(userId: string, from: string, to: string) {
  const [rows] = await db.execute<Row[]>(
    `SELECT actividad_id AS actividadId, log_date AS logDate, completed
     FROM rutina_actividades_log
     WHERE user_id = ? AND log_date >= ? AND log_date <= ? AND completed = 1`,
    [userId, from, to]
  );
  return rows;
}

// ─────────────────────────────────────────────────────────────
// PLAN DE COMIDAS
// ─────────────────────────────────────────────────────────────
export async function listPlanComidas(userId: string, from?: string, to?: string) {
  const params: any[] = [userId];
  let where = 'pc.user_id = ?';
  if (from) { where += ' AND pc.plan_date >= ?'; params.push(from); }
  if (to)   { where += ' AND pc.plan_date <= ?'; params.push(to); }
  const [rows] = await db.execute<Row[]>(
    `SELECT pc.id, pc.plan_date AS planDate, pc.meal_type AS mealType,
            pc.receta_id AS recetaId, COALESCE(pc.title, r.name) AS title,
            pc.calories, pc.protein_g AS proteinG, pc.carbs_g AS carbsG, pc.fat_g AS fatG,
            pc.is_done AS isDone, pc.notes
     FROM rutina_plan_comidas pc
     LEFT JOIN rutina_recetas r ON r.id = pc.receta_id
     WHERE ${where}
     ORDER BY pc.plan_date ASC, FIELD(pc.meal_type,'desayuno','media_manana','almuerzo','onces','cena','snack')`,
    params
  );
  return rows;
}

export async function addPlanComida(userId: string, data: any) {
  if (!data.planDate) throw new AppError('La fecha es requerida', 400);
  if (!data.mealType) throw new AppError('El tipo de comida es requerido', 400);
  const id = uuidv4();
  await db.execute<ResultSetHeader>(
    `INSERT INTO rutina_plan_comidas
       (id, user_id, plan_date, meal_type, receta_id, title, calories, protein_g, carbs_g, fat_g, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, data.planDate, data.mealType, data.recetaId || null,
     data.title || null, data.calories ?? null, data.proteinG ?? null,
     data.carbsG ?? null, data.fatG ?? null, data.notes || null]
  );
  return { id };
}

export async function togglePlanComida(userId: string, id: string) {
  const [rows] = await db.execute<Row[]>(
    'SELECT is_done FROM rutina_plan_comidas WHERE id = ? AND user_id = ?', [id, userId]
  );
  if (!rows.length) throw new AppError('Comida no encontrada', 404);
  const next = rows[0].is_done ? 0 : 1;
  await db.execute<ResultSetHeader>(
    'UPDATE rutina_plan_comidas SET is_done = ? WHERE id = ? AND user_id = ?', [next, id, userId]
  );
  return { isDone: next === 1 };
}

export async function deletePlanComida(userId: string, id: string) {
  const [r] = await db.execute<ResultSetHeader>(
    'DELETE FROM rutina_plan_comidas WHERE id = ? AND user_id = ?', [id, userId]
  );
  if (r.affectedRows === 0) throw new AppError('Comida no encontrada', 404);
}

// ─────────────────────────────────────────────────────────────
// LISTA DE COMPRAS
// ─────────────────────────────────────────────────────────────
export async function listCompras(userId: string) {
  const [rows] = await db.execute<Row[]>(
    `SELECT lc.id, lc.name, lc.quantity, lc.unit, lc.product_id AS productId,
            lc.tenant_id AS tenantId, t.name AS tenantName, t.slug AS tenantSlug,
            lc.source, lc.receta_id AS recetaId, lc.is_purchased AS isPurchased
     FROM rutina_lista_compras lc
     LEFT JOIN tenants t ON t.id = lc.tenant_id
     WHERE lc.user_id = ?
     ORDER BY lc.is_purchased ASC, lc.created_at DESC`,
    [userId]
  );
  return rows;
}

export async function addCompra(userId: string, data: any) {
  if (!data.name?.trim()) throw new AppError('El nombre es requerido', 400);
  const id = uuidv4();
  await db.execute<ResultSetHeader>(
    `INSERT INTO rutina_lista_compras
       (id, user_id, name, quantity, unit, product_id, tenant_id, source, receta_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, data.name.trim(), data.quantity ?? 1, data.unit || null,
     data.productId || null, data.tenantId || null, data.source || 'manual', data.recetaId || null]
  );
  return { id };
}

export async function toggleCompra(userId: string, id: string) {
  const [rows] = await db.execute<Row[]>(
    'SELECT is_purchased FROM rutina_lista_compras WHERE id = ? AND user_id = ?', [id, userId]
  );
  if (!rows.length) throw new AppError('Ítem no encontrado', 404);
  const next = rows[0].is_purchased ? 0 : 1;
  await db.execute<ResultSetHeader>(
    'UPDATE rutina_lista_compras SET is_purchased = ?, purchased_at = ? WHERE id = ? AND user_id = ?',
    [next, next ? new Date() : null, id, userId]
  );
  return { isPurchased: next === 1 };
}

export async function deleteCompra(userId: string, id: string) {
  const [r] = await db.execute<ResultSetHeader>(
    'DELETE FROM rutina_lista_compras WHERE id = ? AND user_id = ?', [id, userId]
  );
  if (r.affectedRows === 0) throw new AppError('Ítem no encontrado', 404);
}

/**
 * Genera ítems de lista de compras a partir de los ingredientes de una receta
 * que NO están en la despensa. Devuelve cuántos agregó.
 */
export async function generarComprasDesdeReceta(userId: string, recetaId: string) {
  const [recetas] = await db.execute<Row[]>(
    'SELECT id FROM rutina_recetas WHERE id = ? AND user_id = ? AND is_active = 1', [recetaId, userId]
  );
  if (!recetas.length) throw new AppError('Receta no encontrada', 404);

  const [ings] = await db.execute<Row[]>(
    'SELECT name, quantity, unit, product_id FROM rutina_receta_ingredientes WHERE receta_id = ? AND user_id = ?',
    [recetaId, userId]
  );
  const [despensa] = await db.execute<Row[]>(
    'SELECT name FROM rutina_despensa WHERE user_id = ? AND quantity > 0', [userId]
  );
  const pantry = (despensa as any[]).map(d => String(d.name).toLowerCase().trim());
  const have = (n: string) => {
    const x = n.toLowerCase().trim();
    return pantry.some(p => p.includes(x) || x.includes(p));
  };

  let added = 0;
  for (const ing of ings as any[]) {
    if (have(ing.name)) continue;
    await db.execute<ResultSetHeader>(
      `INSERT INTO rutina_lista_compras (id, user_id, name, quantity, unit, product_id, source, receta_id)
       VALUES (?, ?, ?, ?, ?, ?, 'receta', ?)`,
      [uuidv4(), userId, ing.name, ing.quantity ?? 1, ing.unit || null, ing.product_id || null, recetaId]
    );
    added++;
  }
  return { added };
}

// ─────────────────────────────────────────────────────────────
// RESUMEN (para la home del consumidor)
// ─────────────────────────────────────────────────────────────
export async function getResumen(userId: string) {
  const [[perfil]] = await db.execute<Row[]>(
    `SELECT goal, daily_calorie_target AS dailyCalorieTarget, target_weight_kg AS targetWeightKg,
            weight_kg AS weightKg, water_target_ml AS waterTargetMl
     FROM rutina_perfil WHERE user_id = ?`, [userId]
  ) as any;
  const [[despensa]] = await db.execute<Row[]>(
    'SELECT COUNT(*) AS n FROM rutina_despensa WHERE user_id = ?', [userId]
  ) as any;
  const [[porVencer]] = await db.execute<Row[]>(
    'SELECT COUNT(*) AS n FROM rutina_despensa WHERE user_id = ? AND expires_at IS NOT NULL AND expires_at <= DATE_ADD(CURDATE(), INTERVAL 3 DAY)',
    [userId]
  ) as any;
  const [[compras]] = await db.execute<Row[]>(
    'SELECT COUNT(*) AS n FROM rutina_lista_compras WHERE user_id = ? AND is_purchased = 0', [userId]
  ) as any;
  const [[comidasHoy]] = await db.execute<Row[]>(
    'SELECT COUNT(*) AS n FROM rutina_plan_comidas WHERE user_id = ? AND plan_date = CURDATE()', [userId]
  ) as any;
  // Totales nutricionales del día (consumido = comidas marcadas; planeado = todas)
  const [[macros]] = await db.execute<Row[]>(
    `SELECT
       COALESCE(SUM(calories),0) AS calPlan,
       COALESCE(SUM(protein_g),0) AS proPlan,
       COALESCE(SUM(carbs_g),0) AS carbPlan,
       COALESCE(SUM(fat_g),0) AS fatPlan,
       COALESCE(SUM(CASE WHEN is_done=1 THEN calories ELSE 0 END),0) AS calDone,
       COALESCE(SUM(CASE WHEN is_done=1 THEN protein_g ELSE 0 END),0) AS proDone,
       COALESCE(SUM(CASE WHEN is_done=1 THEN carbs_g ELSE 0 END),0) AS carbDone,
       COALESCE(SUM(CASE WHEN is_done=1 THEN fat_g ELSE 0 END),0) AS fatDone
     FROM rutina_plan_comidas WHERE user_id = ? AND plan_date = CURDATE()`, [userId]
  ) as any;
  return {
    perfil: perfil || null,
    despensaCount: despensa?.n ?? 0,
    porVencerCount: porVencer?.n ?? 0,
    comprasPendientes: compras?.n ?? 0,
    comidasHoy: comidasHoy?.n ?? 0,
    nutricion: {
      caloriasPlan: Number(macros?.calPlan ?? 0),
      caloriasConsumidas: Number(macros?.calDone ?? 0),
      proteinaPlan: Number(macros?.proPlan ?? 0),
      proteinaConsumida: Number(macros?.proDone ?? 0),
      carbsPlan: Number(macros?.carbPlan ?? 0),
      carbsConsumidos: Number(macros?.carbDone ?? 0),
      grasaPlan: Number(macros?.fatPlan ?? 0),
      grasaConsumida: Number(macros?.fatDone ?? 0),
    },
  };
}
