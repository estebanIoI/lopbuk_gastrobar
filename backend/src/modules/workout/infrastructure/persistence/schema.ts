/**
 * Workout Runtime · infrastructure/persistence/schema
 * -----------------------------------------------------------------------------
 * Migración idempotente (CREATE TABLE IF NOT EXISTS), mismo patrón que el resto
 * del backend (se ejecuta al boot desde index.ts). Scope = usuario, sin tenant.
 */

import db from '../../../../config/database';

// DDL congelado: las tablas workout_sessions/exercises/sets y exercise_progressions
// viven en el baseline Drizzle (src/db/migrations). No-op conservado porque la invocan
// el boot/handlers (ya como no-op). Ver CLAUDE.md.
export async function ensureWorkoutSchema(): Promise<void> { /* no-op: esquema en migraciones */ }
