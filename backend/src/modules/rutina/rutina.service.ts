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

// ─────────────────────────────────────────────────────────────
// ONBOARDING / ACTIVACIÓN — genera el programa inicial del usuario
// ─────────────────────────────────────────────────────────────
const ACTIVITY_FACTOR: Record<string, number> = {
  sedentario: 1.2, ligero: 1.375, moderado: 1.55, activo: 1.725, muy_activo: 1.9,
};
const GOAL_KCAL_DELTA: Record<string, number> = {
  bajar_peso: -0.18, perder_grasa: -0.18, recomposicion: -0.05,
  mantener: 0, salud_general: 0, rendimiento: 0.05,
  subir_masa: 0.12, ganar_musculo: 0.12, volver_entrenar: 0,
};

/** Mifflin-St Jeor + factor de actividad + ajuste por objetivo → kcal y macros. */
function computeNutrition(p: { sex?: string; weightKg?: number; heightCm?: number; age?: number; activityLevel?: string; goal?: string }) {
  const w = Number(p.weightKg) || 70, h = Number(p.heightCm) || 170, age = Number(p.age) || 28;
  const male = (p.sex || 'm').toLowerCase().startsWith('m');
  const bmr = Math.round(10 * w + 6.25 * h - 5 * age + (male ? 5 : -161));
  const tdee = Math.round(bmr * (ACTIVITY_FACTOR[p.activityLevel || 'moderado'] || 1.55));
  const delta = GOAL_KCAL_DELTA[p.goal || 'mantener'] ?? 0;
  const calories = Math.max(1200, Math.round(tdee * (1 + delta)));
  const proteinG = Math.round(w * (p.goal === 'subir_masa' || p.goal === 'ganar_musculo' ? 2.0 : 1.8));
  const fatG = Math.round((calories * 0.27) / 9);
  const carbsG = Math.max(0, Math.round((calories - proteinG * 4 - fatG * 9) / 4));
  const bmi = Math.round((w / Math.pow(h / 100, 2)) * 10) / 10;
  const waterMl = Math.round(w * 35);
  return { bmr, tdee, calories, proteinG, carbsG, fatG, bmi, waterMl };
}

/** Plantilla de split semanal según experiencia/lugar/días. */
function buildSplit(experience: string, location: string, days: number): { name: string; sessions: { day: number; title: string }[] } {
  const home = location === 'casa';
  const d = Math.min(6, Math.max(2, days || 3));
  if (experience === 'principiante' || d <= 3) {
    const sessions = [{ day: 1, title: home ? 'Full Body en casa A' : 'Full Body A' }, { day: 3, title: home ? 'Full Body en casa B' : 'Full Body B' }];
    if (d >= 3) sessions.push({ day: 5, title: home ? 'Full Body en casa C' : 'Full Body C' });
    return { name: home ? 'Full Body en casa' : 'Full Body 3 días', sessions };
  }
  if (d >= 5) {
    return { name: 'Push Pull Legs', sessions: [
      { day: 1, title: 'Push (pecho/hombro/tríceps)' }, { day: 2, title: 'Pull (espalda/bíceps)' }, { day: 3, title: 'Legs (pierna)' },
      { day: 4, title: 'Push B' }, { day: 5, title: 'Pull B' }, ...(d >= 6 ? [{ day: 6, title: 'Legs B' }] : []),
    ] };
  }
  return { name: 'Upper / Lower', sessions: [
    { day: 1, title: 'Tren superior A' }, { day: 2, title: 'Tren inferior A' }, { day: 4, title: 'Tren superior B' }, { day: 5, title: 'Tren inferior B' },
  ] };
}

export async function getOnboardingStatus(userId: string) {
  const p: any = await getPerfil(userId);
  // Onboarded si lo completó explícitamente, o si ya es un usuario con perfil
  // configurado (objetivo + peso) — para no forzar el wizard a usuarios existentes.
  const grandfathered = !!(p && p.goal && p.weight_kg);
  return { onboarded: !!(p && (p.onboarded_at || grandfathered)), hasProfile: !!p };
}

/** Completa el onboarding: guarda perfil, calcula nutrición y genera el programa inicial. */
export async function completeOnboarding(userId: string, a: any) {
  if (!userId) throw new AppError('No autenticado', 401);
  const goal = String(a?.goal || 'mantener');
  // Normaliza el sexo a los valores que acepta el ENUM de rutina_perfil
  // ('masculino'/'femenino'); el wizard manda 'm'/'f'.
  const rawSex = String(a?.sex || '').toLowerCase();
  const sex = !rawSex ? null : (rawSex.startsWith('m') ? 'masculino' : rawSex.startsWith('f') ? 'femenino' : rawSex);
  const weightKg = a?.weightKg != null ? Number(a.weightKg) : null;
  const heightCm = a?.heightCm != null ? Number(a.heightCm) : null;
  const age = a?.age != null ? Number(a.age) : null;
  const activityLevel = a?.activityLevel || 'moderado';
  const experience = a?.experience || 'principiante';
  const location = a?.trainingLocation || 'gym';
  const daysPerWeek = a?.daysPerWeek != null ? Number(a.daysPerWeek) : 3;
  const timePerDay = a?.timePerDay != null ? Number(a.timePerDay) : 45;
  const dietaryPrefs = a?.dietaryPrefs || null;
  const motivation = a?.motivation ? String(a.motivation).slice(0, 300) : null;

  const n = computeNutrition({ sex, weightKg: weightKg ?? undefined, heightCm: heightCm ?? undefined, age: age ?? undefined, activityLevel, goal });

  // Meta de peso estimada (si no la dio): ±5% según objetivo.
  let targetWeightKg = a?.targetWeightKg != null ? Number(a.targetWeightKg) : null;
  if (targetWeightKg == null && weightKg != null) {
    if (goal === 'bajar_peso' || goal === 'perder_grasa') targetWeightKg = Math.round(weightKg * 0.92);
    else if (goal === 'subir_masa' || goal === 'ganar_musculo') targetWeightKg = Math.round(weightKg * 1.05);
    else targetWeightKg = weightKg;
  }

  // 1) Perfil (reusa upsertPerfil) + columnas de onboarding.
  await upsertPerfil(userId, {
    sex, heightCm, weightKg, goal, activityLevel,
    dailyCalorieTarget: n.calories, targetWeightKg, bmr: n.bmr, tdee: n.tdee, bmi: n.bmi,
    waterTargetMl: n.waterMl, dietaryPrefs, city: a?.city || null,
  });
  await db.execute(
    `UPDATE rutina_perfil SET experience_level = ?, training_location = ?, time_per_day = ?, days_per_week = ?,
       motivation = ?, protein_g = ?, carbs_g = ?, fat_g = ?, onboarded_at = COALESCE(onboarded_at, NOW()) WHERE user_id = ?`,
    [experience, location, timePerDay, daysPerWeek, motivation, n.proteinG, n.carbsG, n.fatG, userId]
  );

  // 2) Rutina inicial con su split (solo si no tiene una de onboarding).
  //    Defensivo: si la generación falla, el onboarding NO se rompe (lo crítico
  //    es el perfil + onboarded_at). La rutina es un bonus.
  const split = buildSplit(experience, location, daysPerWeek);
  try {
    const [existing] = await db.execute<Row[]>("SELECT id FROM rutina_rutinas WHERE user_id = ? AND name LIKE 'Mi programa%' AND is_active = 1 LIMIT 1", [userId]);
    if (!existing.length) {
      const { id: rutinaId } = await createRutina(userId, { name: `Mi programa · ${split.name}`, type: 'general', color: '#f59e0b' });
      let order = 0;
      const addAct = async (data: any) => { try { await addActividad(userId, rutinaId, data); } catch { /* enum/columna distinta: omitir */ } };
      for (const s of split.sessions) await addAct({ dayOfWeek: s.day, title: s.title, type: 'otro', sortOrder: order++ });
      await addAct({ dayOfWeek: null, title: `Tomar ${(n.waterMl / 1000).toFixed(1)} L de agua`, type: 'otro', sortOrder: order++ });
      await addAct({ dayOfWeek: null, title: `${n.proteinG} g de proteína`, type: 'otro', sortOrder: order++ });
    }
  } catch (e) { console.warn('[onboarding] generación de rutina:', (e as any)?.message); }

  // XP por completar el onboarding (P2).
  try { const { gamificationService } = await import('../gamification/gamification.service'); await gamificationService.awardXp(userId, 'onboarding'); } catch { /* no bloquear */ }

  // 3) Roadmap inicial (texto guía).
  const roadmap = [
    { week: 1, title: 'Adaptación', detail: 'Aprende la técnica y crea el hábito.' },
    { week: 2, title: 'Constancia', detail: 'No falles a tus entrenos ni a tu proteína.' },
    { week: 4, title: 'Progresión', detail: 'Sube peso/repeticiones. El cuerpo empieza a cambiar.' },
    { week: 8, title: 'Transformación', detail: 'Resultados visibles si mantienes el ritmo.' },
  ];

  return {
    calories: n.calories, macros: { proteinG: n.proteinG, carbsG: n.carbsG, fatG: n.fatG },
    bmr: n.bmr, tdee: n.tdee, bmi: n.bmi, waterMl: n.waterMl,
    targetWeightKg, goal, split: split.name, daysPerWeek, roadmap,
  };
}

// ─────────────────────────────────────────────────────────────
// MISSION CONTROL — el "Hoy" enfocado en la misión del día
// ─────────────────────────────────────────────────────────────
const CHECK_ITEMS = [
  { key: 'entrenar', label: 'Entrenar', emoji: '🏋️' },
  { key: 'agua', label: 'Tomar agua', emoji: '💧' },
  { key: 'proteina', label: 'Proteína', emoji: '🍗' },
  { key: 'sueno', label: 'Dormir bien', emoji: '😴' },
  { key: 'pasos', label: 'Caminar', emoji: '🚶' },
];

export async function getTodayMission(userId: string) {
  const p: any = await getPerfil(userId);
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const dow = now.getDay(); // 0=Dom

  // Día N del programa (desde onboarded_at o creación del perfil).
  const startRaw = p?.onboarded_at || p?.created_at || null;
  let dayNumber = 1;
  if (startRaw) dayNumber = Math.max(1, Math.floor((Date.now() - new Date(startRaw).getTime()) / 86400000) + 1);

  // Sesión de hoy: actividad de la rutina "Mi programa" para el día de la semana.
  let todaySession: string | null = null;
  try {
    const [rows] = await db.execute<Row[]>(
      `SELECT a.title FROM rutina_actividades a
         JOIN rutina_rutinas r ON r.id = a.rutina_id
        WHERE a.user_id = ? AND a.is_active = 1 AND a.day_of_week = ? AND r.is_active = 1
        ORDER BY (r.name LIKE 'Mi programa%') DESC, a.sort_order ASC LIMIT 1`, [userId, dow]
    );
    todaySession = (rows[0] as any)?.title || null;
  } catch { /* sin rutina */ }

  // Checklist del día.
  const [checks] = await db.execute<Row[]>('SELECT item_key, done FROM consumer_daily_checks WHERE user_id = ? AND day = ?', [userId, todayStr]);
  const doneSet = new Set((checks as any[]).filter(c => c.done).map(c => c.item_key));
  const checklist = CHECK_ITEMS.map(i => ({ ...i, done: doneSet.has(i.key) }));
  const completed = checklist.filter(c => c.done).length;

  return {
    dayNumber,
    goal: p?.goal || null,
    calorieTarget: p?.daily_calorie_target ?? null,
    proteinG: p?.protein_g ?? null,
    waterMl: p?.water_target_ml ?? null,
    todaySession: todaySession || (dow === 0 || dow === 6 ? 'Descanso activo / movilidad' : 'Día libre — muévete'),
    isRestDay: !todaySession,
    checklist, completed, total: checklist.length,
  };
}

export async function toggleDailyCheck(userId: string, itemKey: string, done: boolean) {
  if (!CHECK_ITEMS.some(i => i.key === itemKey)) throw new AppError('Ítem inválido', 400);
  const today = new Date().toISOString().slice(0, 10);
  await db.execute(
    `INSERT INTO consumer_daily_checks (id, user_id, day, item_key, done) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE done = VALUES(done)`,
    [uuidv4(), userId, today, itemKey, done ? 1 : 0]
  );
  // Marcar "entrenar" cuenta como actividad del día (alimenta la racha) + XP.
  if (done) {
    try {
      const { gamificationService } = await import('../gamification/gamification.service');
      await gamificationService.awardXp(userId, itemKey === 'entrenar' ? 'workout' : 'daily_check');
    } catch { /* no bloquear */ }
    if (itemKey === 'entrenar') {
      try { await db.query('INSERT IGNORE INTO consumer_streak_days (user_id, day) VALUES (?, CURDATE())', [userId]); } catch { /* sin streak */ }
    }
  }
  return getTodayMission(userId);
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
