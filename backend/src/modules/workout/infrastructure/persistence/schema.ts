/**
 * Workout Runtime · infrastructure/persistence/schema
 * -----------------------------------------------------------------------------
 * Migración idempotente (CREATE TABLE IF NOT EXISTS), mismo patrón que el resto
 * del backend (se ejecuta al boot desde index.ts). Scope = usuario, sin tenant.
 */

import db from '../../../../config/database';

export async function ensureWorkoutSchema(): Promise<void> {
  await db.query(`CREATE TABLE IF NOT EXISTS workout_sessions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    routine_id VARCHAR(36) NULL,
    goal VARCHAR(20) NOT NULL DEFAULT 'hypertrophy',
    status ENUM('pending','active','paused','completed','cancelled') NOT NULL DEFAULT 'active',
    started_at DATETIME NULL,
    completed_at DATETIME NULL,
    duration_seconds INT NULL,
    total_volume DECIMAL(12,2) NOT NULL DEFAULT 0,
    current_exercise_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ws_user (user_id, status),
    INDEX idx_ws_user_created (user_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await db.query(`CREATE TABLE IF NOT EXISTS workout_exercises (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    exercise_id VARCHAR(80) NOT NULL,
    exercise_name VARCHAR(160) NULL,
    exercise_order INT NOT NULL DEFAULT 0,
    target_sets INT NOT NULL,
    target_reps INT NOT NULL,
    suggested_weight DECIMAL(8,2) NOT NULL DEFAULT 0,
    movement_pattern VARCHAR(10) NULL,
    completed TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
    INDEX idx_we_session (session_id, exercise_order),
    INDEX idx_we_user_ex (user_id, exercise_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await db.query(`CREATE TABLE IF NOT EXISTS workout_sets (
    id VARCHAR(36) PRIMARY KEY,
    exercise_session_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    set_number INT NOT NULL,
    target_reps INT NOT NULL,
    completed_reps INT NULL,
    target_weight DECIMAL(8,2) NOT NULL DEFAULT 0,
    used_weight DECIMAL(8,2) NULL,
    completed TINYINT(1) NOT NULL DEFAULT 0,
    completed_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (exercise_session_id) REFERENCES workout_exercises(id) ON DELETE CASCADE,
    INDEX idx_wset_exercise (exercise_session_id, set_number)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // Snapshot de progresión por (usuario, ejercicio). Source of truth, no recálculo.
  await db.query(`CREATE TABLE IF NOT EXISTS exercise_progressions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    exercise_id VARCHAR(80) NOT NULL,
    current_weight DECIMAL(8,2) NOT NULL DEFAULT 0,
    next_weight DECIMAL(8,2) NOT NULL DEFAULT 0,
    best_weight DECIMAL(8,2) NOT NULL DEFAULT 0,
    last_action VARCHAR(12) NULL,
    completion_rate DECIMAL(5,3) NULL,
    estimated_1rm DECIMAL(8,2) NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_ep_user_ex (user_id, exercise_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}
