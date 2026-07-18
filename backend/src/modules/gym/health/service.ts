/**
 * health/service.ts
 * Lógica de negocio del dominio Health.
 * Evaluaciones, mediciones corporales, fotos de progreso, condiciones médicas,
 * analytics y comparativas. Todo registrado en el timeline del miembro.
 */
import { db } from '../../../config';
import { AppError } from '../../../common/middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import { addTimelineEvent } from '../members/service';
import type {
  HealthAssessment, BodyMeasurements, ProgressPhoto, AssessmentFile,
  MedicalCondition, MemberHealthDashboard, HealthComparatives,
  HealthAnalytics, MetricComparison, CreateAssessmentInput,
  CreatePhotoInput, CreateMedicalConditionInput,
} from './types';

interface Row extends RowDataPacket {}

function parseJson(f: unknown): unknown {
  if (typeof f === 'string') { try { return JSON.parse(f) } catch { return null } }
  return f ?? null;
}

function calcImc(weight: number | null, height: number | null): number | null {
  if (!weight || !height || height <= 0) return null;
  return Math.round((weight / ((height / 100) ** 2)) * 10) / 10;
}

function calcWHR(waist: number | null, hip: number | null): number | null {
  if (!waist || !hip || hip <= 0) return null;
  return Math.round((waist / hip) * 100) / 100;
}

// ════════════════════════════════════════════════════════════════════
// EVALUACIONES
// ════════════════════════════════════════════════════════════════════

const ASSESSMENT_SELECT = `a.id, a.tenant_id AS tenantId, a.member_id AS memberId,
  a.trainer_id AS trainerId, a.assessment_date AS assessmentDate, a.type,
  a.weight_kg AS weightKg, a.height_cm AS heightCm, a.imc,
  a.body_fat_pct AS bodyFatPct, a.muscle_mass_kg AS muscleMassKg,
  a.body_water_pct AS bodyWaterPct, a.visceral_fat AS visceralFat,
  a.metabolic_age AS metabolicAge, a.bone_mass_kg AS boneMassKg,
  a.resting_hr_bpm AS restingHrBpm, a.systolic_bp AS systolicBp,
  a.diastolic_bp AS diastolicBp, a.flexibility_score AS flexibilityScore,
  a.posture_score AS postureScore, a.mobility_score AS mobilityScore,
  a.pain_level AS painLevel, a.stress_level AS stressLevel,
  a.sleep_hours AS sleepHours, a.water_intake_ml AS waterIntakeMl,
  a.observations, a.is_active AS isActive,
  a.created_at AS createdAt, a.updated_at AS updatedAt`;

const MEASUREMENT_SELECT = `id, assessment_id AS assessmentId, member_id AS memberId,
  measurement_date AS measurementDate, neck_cm AS neckCm, shoulders_cm AS shouldersCm,
  chest_cm AS chestCm, left_arm_cm AS leftArmCm, right_arm_cm AS rightArmCm,
  left_forearm_cm AS leftForearmCm, right_forearm_cm AS rightForearmCm,
  waist_cm AS waistCm, hip_cm AS hipCm, left_thigh_cm AS leftThighCm,
  right_thigh_cm AS rightThighCm, left_calf_cm AS leftCalfCm,
  right_calf_cm AS rightCalfCm, waist_hip_ratio AS waistHipRatio,
  notes, created_at AS createdAt`;

export async function createAssessment(
  tenantId: string, memberId: string, trainerId: string, input: CreateAssessmentInput,
): Promise<HealthAssessment> {
  const [member] = await db.execute<Row[]>(
    'SELECT id FROM gym_members WHERE id = ? AND tenant_id = ?', [memberId, tenantId],
  );
  if (!member.length) throw new AppError('Miembro no encontrado', 404);

  const id = uuidv4();
  const assessmentDate = input.assessmentDate || new Date().toISOString().slice(0, 10);
  const imc = calcImc(input.weightKg ?? null, input.heightCm ?? null);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(
      `INSERT INTO gym_health_assessments
        (id, tenant_id, member_id, trainer_id, assessment_date, type,
         weight_kg, height_cm, imc, body_fat_pct, muscle_mass_kg,
         body_water_pct, visceral_fat, metabolic_age, bone_mass_kg,
         resting_hr_bpm, systolic_bp, diastolic_bp, flexibility_score,
         posture_score, mobility_score, pain_level, stress_level,
         sleep_hours, water_intake_ml, observations)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, tenantId, memberId, trainerId || null, assessmentDate,
       input.type || 'periodica', input.weightKg ?? null, input.heightCm ?? null,
       imc, input.bodyFatPct ?? null, input.muscleMassKg ?? null,
       input.bodyWaterPct ?? null, input.visceralFat ?? null,
       input.metabolicAge ?? null, input.boneMassKg ?? null,
       input.restingHrBpm ?? null, input.systolicBp ?? null,
       input.diastolicBp ?? null, input.flexibilityScore ?? null,
       input.postureScore ?? null, input.mobilityScore ?? null,
       input.painLevel ?? null, input.stressLevel ?? null,
       input.sleepHours ?? null, input.waterIntakeMl ?? null,
       input.observations || null],
    );

    // Medidas corporales
    if (input.measurements && Object.values(input.measurements).some(v => v != null)) {
      const m = input.measurements;
      const whr = calcWHR(m.waistCm ?? null, m.hipCm ?? null);
      await conn.execute(
        `INSERT INTO gym_body_measurements
          (id, assessment_id, member_id, measurement_date,
           neck_cm, shoulders_cm, chest_cm, left_arm_cm, right_arm_cm,
           left_forearm_cm, right_forearm_cm, waist_cm, hip_cm,
           left_thigh_cm, right_thigh_cm, left_calf_cm, right_calf_cm,
           waist_hip_ratio, notes)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [uuidv4(), id, memberId, assessmentDate,
         m.neckCm ?? null, m.shouldersCm ?? null, m.chestCm ?? null,
         m.leftArmCm ?? null, m.rightArmCm ?? null,
         m.leftForearmCm ?? null, m.rightForearmCm ?? null,
         m.waistCm ?? null, m.hipCm ?? null,
         m.leftThighCm ?? null, m.rightThighCm ?? null,
         m.leftCalfCm ?? null, m.rightCalfCm ?? null,
         whr, m.notes || null],
      );
    }

    // Fotos asociadas
    if (input.photos?.length) {
      for (const p of input.photos) {
        await conn.execute(
          `INSERT INTO gym_progress_photos
            (id, tenant_id, member_id, assessment_id, category, label, photo_url, view_angle, taken_at)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [uuidv4(), tenantId, memberId, id, 'evaluacion',
           p.label || null, p.photoUrl, p.viewAngle || 'frontal', assessmentDate],
        );
      }
    }

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  const weightStr = input.weightKg ? `${input.weightKg}kg` : '';
  await addTimelineEvent(tenantId, memberId, 'health.assessment',
    `Evaluación ${input.type || 'periodica'} registrada ${weightStr}`,
    'assessment', id).catch(() => {});

  return getAssessment(tenantId, id);
}

export async function getAssessment(tenantId: string, assessmentId: string): Promise<HealthAssessment> {
  const [rows] = await db.execute<Row[]>(
    `SELECT ${ASSESSMENT_SELECT} FROM gym_health_assessments a WHERE a.id = ? AND a.tenant_id = ?`,
    [assessmentId, tenantId],
  );
  if (!rows.length) throw new AppError('Evaluación no encontrada', 404);

  const a = rows[0] as any;

  const [meas] = await db.execute<Row[]>(
    `SELECT ${MEASUREMENT_SELECT} FROM gym_body_measurements WHERE assessment_id = ? LIMIT 1`,
    [assessmentId],
  );

  const [photos] = await db.execute<Row[]>(
    `SELECT id, tenant_id AS tenantId, member_id AS memberId, assessment_id AS assessmentId,
            category, label, photo_url AS photoUrl, thumbnail_url AS thumbnailUrl,
            view_angle AS viewAngle, taken_at AS takenAt, day_label AS dayLabel,
            sort_order AS sortOrder, uploaded_by AS uploadedBy, created_at AS createdAt
     FROM gym_progress_photos WHERE assessment_id = ? ORDER BY sort_order ASC`,
    [assessmentId],
  );

  const [files] = await db.execute<Row[]>(
    `SELECT id, tenant_id AS tenantId, member_id AS memberId, assessment_id AS assessmentId,
            category, title, file_url AS fileUrl, file_type AS fileType, file_size AS fileSize,
            notes, uploaded_by AS uploadedBy, created_at AS createdAt
     FROM gym_assessment_files WHERE assessment_id = ?`,
    [assessmentId],
  );

  return {
    ...a,
    isActive: Boolean(a.isActive),
    measurements: meas.length ? (meas[0] as any) : undefined,
    photos: photos as ProgressPhoto[],
    files: files as AssessmentFile[],
  };
}

export async function listAssessments(
  tenantId: string, memberId: string,
): Promise<HealthAssessment[]> {
  const [rows] = await db.execute<Row[]>(
    `SELECT ${ASSESSMENT_SELECT} FROM gym_health_assessments a
     WHERE a.tenant_id = ? AND a.member_id = ? AND a.is_active = 1
     ORDER BY a.assessment_date DESC LIMIT 50`,
    [tenantId, memberId],
  );
  return rows.map(r => ({ ...r, isActive: Boolean(r.isActive) })) as HealthAssessment[];
}

// ════════════════════════════════════════════════════════════════════
// FOTOS DE PROGRESO
// ════════════════════════════════════════════════════════════════════

export async function addProgressPhoto(
  tenantId: string, memberId: string, uploadedBy: string, input: CreatePhotoInput,
): Promise<ProgressPhoto> {
  const id = uuidv4();
  await db.execute<ResultSetHeader>(
    `INSERT INTO gym_progress_photos
      (id, tenant_id, member_id, assessment_id, category, label, photo_url, thumbnail_url, view_angle, taken_at, day_label, uploaded_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, memberId, input.assessmentId || null,
     input.category || 'progreso', input.label || null, input.photoUrl,
     input.thumbnailUrl || null, input.viewAngle || 'frontal',
     input.takenAt || new Date().toISOString().slice(0, 10),
     input.dayLabel || null, uploadedBy],
  );

  await addTimelineEvent(tenantId, memberId, 'health.photo_uploaded',
    `Foto de ${input.category || 'progreso'} subida`, 'photo', id).catch(() => {});

  const [rows] = await db.execute<Row[]>(
    `SELECT id, tenant_id AS tenantId, member_id AS memberId, assessment_id AS assessmentId,
            category, label, photo_url AS photoUrl, thumbnail_url AS thumbnailUrl,
            view_angle AS viewAngle, taken_at AS takenAt, day_label AS dayLabel,
            sort_order AS sortOrder, uploaded_by AS uploadedBy, created_at AS createdAt
     FROM gym_progress_photos WHERE id = ?`, [id],
  );
  return rows[0] as ProgressPhoto;
}

export async function listProgressPhotos(
  tenantId: string, memberId: string, category?: string,
): Promise<ProgressPhoto[]> {
  const params: unknown[] = [tenantId, memberId];
  let where = 'tenant_id = ? AND member_id = ?';
  if (category) { where += ' AND category = ?'; params.push(category); }

  const [rows] = await db.execute<Row[]>(
    `SELECT id, tenant_id AS tenantId, member_id AS memberId, assessment_id AS assessmentId,
            category, label, photo_url AS photoUrl, thumbnail_url AS thumbnailUrl,
            view_angle AS viewAngle, taken_at AS takenAt, day_label AS dayLabel,
            sort_order AS sortOrder, uploaded_by AS uploadedBy, created_at AS createdAt
     FROM gym_progress_photos WHERE ${where} ORDER BY taken_at DESC, sort_order ASC LIMIT 100`,
    params,
  );
  return rows as ProgressPhoto[];
}

export async function deleteProgressPhoto(tenantId: string, photoId: string): Promise<void> {
  const [r] = await db.execute<ResultSetHeader>(
    'DELETE FROM gym_progress_photos WHERE id = ? AND tenant_id = ?', [photoId, tenantId],
  );
  if (r.affectedRows === 0) throw new AppError('Foto no encontrada', 404);
}

export async function reorderPhotos(tenantId: string, photoIds: string[]): Promise<void> {
  for (let i = 0; i < photoIds.length; i++) {
    await db.execute<ResultSetHeader>(
      'UPDATE gym_progress_photos SET sort_order = ? WHERE id = ? AND tenant_id = ?',
      [i, photoIds[i], tenantId],
    );
  }
}

// ════════════════════════════════════════════════════════════════════
// ARCHIVOS DE EVALUACIÓN
// ════════════════════════════════════════════════════════════════════

export async function uploadAssessmentFile(
  tenantId: string, memberId: string, uploadedBy: string,
  input: { assessmentId?: string; category: string; title: string; fileUrl: string; fileType?: string; fileSize?: number; notes?: string },
): Promise<AssessmentFile> {
  const id = uuidv4();
  await db.execute<ResultSetHeader>(
    `INSERT INTO gym_assessment_files
      (id, tenant_id, member_id, assessment_id, category, title, file_url, file_type, file_size, notes, uploaded_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, memberId, input.assessmentId || null, input.category, input.title,
     input.fileUrl, input.fileType || null, input.fileSize ?? null, input.notes || null, uploadedBy],
  );
  const [rows] = await db.execute<Row[]>(
    `SELECT id, tenant_id AS tenantId, member_id AS memberId, assessment_id AS assessmentId,
            category, title, file_url AS fileUrl, file_type AS fileType, file_size AS fileSize,
            notes, uploaded_by AS uploadedBy, created_at AS createdAt
     FROM gym_assessment_files WHERE id = ?`, [id],
  );
  return rows[0] as AssessmentFile;
}

// ════════════════════════════════════════════════════════════════════
// CONDICIONES MÉDICAS (LESIONES)
// ════════════════════════════════════════════════════════════════════

export async function reportMedicalCondition(
  tenantId: string, memberId: string, reportedBy: string, input: CreateMedicalConditionInput,
): Promise<MedicalCondition> {
  if (!input.description?.trim()) throw new AppError('La descripción es requerida', 400);

  const id = uuidv4();
  await db.execute<ResultSetHeader>(
    `INSERT INTO gym_medical_conditions
      (id, tenant_id, member_id, type, zone, description, date_reported, status, severity,
       restricted_exercises, restricted_movements, document_url, reported_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, tenantId, memberId, input.type, input.zone || null, input.description.trim(),
     input.dateReported || new Date().toISOString().slice(0, 10),
     input.status || 'activa', input.severity || 'moderada',
     input.restrictedExercises ? JSON.stringify(input.restrictedExercises) : null,
     input.restrictedMovements ? JSON.stringify(input.restrictedMovements) : null,
     input.documentUrl || null, reportedBy],
  );

  await addTimelineEvent(tenantId, memberId, 'health.condition_reported',
    `${input.type}: ${input.description.trim().substring(0, 80)}`, 'medical_condition', id).catch(() => {});

  const [rows] = await db.execute<Row[]>(
    `SELECT id, tenant_id AS tenantId, member_id AS memberId, type, zone, description,
            date_reported AS dateReported, status, severity,
            restricted_exercises AS restrictedExercises,
            restricted_movements AS restrictedMovements,
            document_url AS documentUrl, recovery_date AS recoveryDate,
            recovery_notes AS recoveryNotes, reported_by AS reportedBy,
            created_at AS createdAt, updated_at AS updatedAt
     FROM gym_medical_conditions WHERE id = ?`, [id],
  );
  const r = rows[0] as any;
  return {
    ...r,
    restrictedExercises: parseJson(r.restrictedExercises) as string[] | null,
    restrictedMovements: parseJson(r.restrictedMovements) as string[] | null,
  };
}

export async function updateMedicalCondition(
  tenantId: string, conditionId: string,
  input: { status?: string; severity?: string; restrictedExercises?: string[] | null; restrictedMovements?: string[] | null; recoveryDate?: string | null; recoveryNotes?: string | null },
): Promise<MedicalCondition> {
  const [rows] = await db.execute<Row[]>(
    'SELECT * FROM gym_medical_conditions WHERE id = ? AND tenant_id = ?', [conditionId, tenantId],
  );
  if (!rows.length) throw new AppError('Condición no encontrada', 404);

  const c = rows[0];
  const wasActive = c.status === 'activa';
  const nowRecovered = input.status === 'recuperada';

  await db.execute<ResultSetHeader>(
    `UPDATE gym_medical_conditions SET
       status = ?, severity = ?, restricted_exercises = ?, restricted_movements = ?,
       recovery_date = ?, recovery_notes = ?
     WHERE id = ? AND tenant_id = ?`,
    [
      input.status ?? c.status, input.severity ?? c.severity,
      input.restrictedExercises !== undefined ? JSON.stringify(input.restrictedExercises) : c.restricted_exercises,
      input.restrictedMovements !== undefined ? JSON.stringify(input.restrictedMovements) : c.restricted_movements,
      input.recoveryDate !== undefined ? input.recoveryDate : c.recovery_date,
      input.recoveryNotes !== undefined ? input.recoveryNotes : c.recovery_notes,
      conditionId, tenantId,
    ],
  );

  if (wasActive && nowRecovered) {
    await addTimelineEvent(tenantId, c.member_id, 'health.condition_recovered',
      `Alta médica: ${c.description?.substring(0, 80) || c.type}`, 'medical_condition', conditionId);
    // Cambiar status del miembro si estaba lesionado
    await db.execute<ResultSetHeader>(
      "UPDATE gym_members SET status = 'activo' WHERE id = ? AND status = 'lesionado'",
      [c.member_id],
    );
  }

  const [updated] = await db.execute<Row[]>(
    `SELECT id, tenant_id AS tenantId, member_id AS memberId, type, zone, description,
            date_reported AS dateReported, status, severity,
            restricted_exercises AS restrictedExercises,
            restricted_movements AS restrictedMovements,
            document_url AS documentUrl, recovery_date AS recoveryDate,
            recovery_notes AS recoveryNotes, reported_by AS reportedBy,
            created_at AS createdAt, updated_at AS updatedAt
     FROM gym_medical_conditions WHERE id = ?`, [conditionId],
  );
  const r = updated[0] as any;
  return {
    ...r,
    restrictedExercises: parseJson(r.restrictedExercises) as string[] | null,
    restrictedMovements: parseJson(r.restrictedMovements) as string[] | null,
  };
}

export async function listMedicalConditions(
  tenantId: string, memberId: string, status?: string,
): Promise<MedicalCondition[]> {
  const params: unknown[] = [tenantId, memberId];
  let where = 'tenant_id = ? AND member_id = ?';
  if (status) { where += ' AND status = ?'; params.push(status); }

  const [rows] = await db.execute<Row[]>(
    `SELECT id, tenant_id AS tenantId, member_id AS memberId, type, zone, description,
            date_reported AS dateReported, status, severity,
            restricted_exercises AS restrictedExercises,
            restricted_movements AS restrictedMovements,
            document_url AS documentUrl, recovery_date AS recoveryDate,
            recovery_notes AS recoveryNotes, reported_by AS reportedBy,
            created_at AS createdAt, updated_at AS updatedAt
     FROM gym_medical_conditions WHERE ${where} ORDER BY date_reported DESC`,
    params,
  );
  return rows.map(r => ({
    ...r,
    restrictedExercises: parseJson(r.restrictedExercises) as string[] | null,
    restrictedMovements: parseJson(r.restrictedMovements) as string[] | null,
  })) as MedicalCondition[];
}

export async function getActiveRestrictions(
  tenantId: string, memberId: string,
): Promise<{ exerciseIds: string[]; movements: string[] }> {
  const [rows] = await db.execute<Row[]>(
    `SELECT restricted_exercises, restricted_movements
     FROM gym_medical_conditions
     WHERE tenant_id = ? AND member_id = ? AND status IN ('activa','recuperando','cronica')`,
    [tenantId, memberId],
  );

  const exerciseIds: string[] = [];
  const movements: string[] = [];
  for (const r of rows as any[]) {
    const ex = parseJson(r.restricted_exercises) as string[] | null;
    if (ex) exerciseIds.push(...ex);
    const mv = parseJson(r.restricted_movements) as string[] | null;
    if (mv) movements.push(...mv);
  }
  return { exerciseIds: Array.from(new Set(exerciseIds)), movements: Array.from(new Set(movements)) };
}

// ════════════════════════════════════════════════════════════════════
// DASHBOARD + COMPARATIVAS + ANALYTICS
// ════════════════════════════════════════════════════════════════════

export async function getHealthDashboard(
  tenantId: string, memberId: string,
): Promise<MemberHealthDashboard> {
  const assessments = await listAssessments(tenantId, memberId);
  const latestAssessment = assessments.length ? await getAssessment(tenantId, assessments[0].id) : null;
  const photos = await listProgressPhotos(tenantId, memberId);
  const conditions = await listMedicalConditions(tenantId, memberId);
  const activeConditions = conditions.filter(c => ['activa','recuperando','cronica'].includes(c.status));
  const comparatives = computeComparatives(assessments);
  const analytics = computeAnalytics(assessments, conditions);

  return {
    memberId, latestAssessment, assessments, photos, conditions,
    activeConditions, comparatives, analytics,
  };
}

function computeComparatives(assessments: HealthAssessment[]): HealthComparatives {
  if (assessments.length < 2) return emptyComparatives();

  const latest = assessments[0];
  const previous = assessments[1];
  const first = assessments[assessments.length - 1];

  return {
    weight: compareMetric(latest.weightKg, previous.weightKg, first?.weightKg ?? null, latest.weightKg),
    bodyFat: compareMetric(latest.bodyFatPct, previous.bodyFatPct, first?.bodyFatPct ?? null, latest.bodyFatPct),
    muscleMass: compareMetric(latest.muscleMassKg, previous.muscleMassKg, first?.muscleMassKg ?? null, latest.muscleMassKg),
    imc: compareMetric(latest.imc, previous.imc, first?.imc ?? null, latest.imc),
    waist: compareMetricFromMeas(assessments, 'waistCm'),
    hip: compareMetricFromMeas(assessments, 'hipCm'),
    chest: compareMetricFromMeas(assessments, 'chestCm'),
  };
}

function compareMetric(current: number | null, previous: number | null, initialValue: number | null, bestValue: number | null): MetricComparison | null {
  if (current == null) return null;
  const change = previous != null ? Math.round((current - previous) * 10) / 10 : null;
  const changePct = previous != null && previous !== 0 ? Math.round((change! / previous) * 1000) / 10 : null;
  const trend: 'up' | 'down' | 'stable' = change == null || Math.abs(change) < 0.1 ? 'stable' : change > 0 ? 'up' : 'down';
  return { current, previous, change, changePct, trend, initialValue, bestValue };
}

function compareMetricFromMeas(assessments: HealthAssessment[], field: string): MetricComparison | null {
  return null;
}

function emptyComparatives(): HealthComparatives {
  const nil = null;
  return {
    weight: nil, bodyFat: nil, muscleMass: nil, imc: nil, waist: nil, hip: nil, chest: nil,
  };
}

function computeAnalytics(assessments: HealthAssessment[], _conditions: MedicalCondition[]): HealthAnalytics {
  const first = assessments[assessments.length - 1];
  const latest = assessments[0];

  let weightLostKg: number | null = null;
  let muscleGainedKg: number | null = null;
  let bodyFatLostPct: number | null = null;
  let bmiImproved = false;
  let bodyFatImproved = false;

  if (first && latest) {
    if (first.weightKg && latest.weightKg) weightLostKg = Math.round((first.weightKg - latest.weightKg) * 10) / 10;
    if (first.muscleMassKg && latest.muscleMassKg) muscleGainedKg = Math.round((latest.muscleMassKg - first.muscleMassKg) * 10) / 10;
    if (first.bodyFatPct && latest.bodyFatPct) bodyFatLostPct = Math.round((first.bodyFatPct - latest.bodyFatPct) * 10) / 10;
    if (first.imc && latest.imc) bmiImproved = latest.imc < first.imc;
    if (first.bodyFatPct && latest.bodyFatPct) bodyFatImproved = latest.bodyFatPct < first.bodyFatPct;
  }

  const daysTracked = first?.assessmentDate && latest?.assessmentDate
    ? Math.round((new Date(latest.assessmentDate).getTime() - new Date(first.assessmentDate).getTime()) / 86400000)
    : 0;

  return {
    totalAssessments: assessments.length,
    weightLostKg, muscleGainedKg, bodyFatLostPct,
    daysTracked,
    firstAssessmentDate: first?.assessmentDate ?? null,
    lastAssessmentDate: latest?.assessmentDate ?? null,
    imcCategory: latest?.imc ? classifyImc(latest.imc) : null,
    weeklyAvgWeight: latest?.weightKg ?? null,
    bmiImproved,
    bodyFatImproved,
  };
}

function classifyImc(imc: number): string {
  if (imc < 18.5) return 'Bajo peso';
  if (imc < 25) return 'Normal';
  if (imc < 30) return 'Sobrepeso';
  if (imc < 35) return 'Obesidad I';
  if (imc < 40) return 'Obesidad II';
  return 'Obesidad III';
}
