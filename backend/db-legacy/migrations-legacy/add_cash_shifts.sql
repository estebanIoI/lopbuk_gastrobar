-- =====================================================
-- CAJA POR TURNOS — evolución de cash-sessions.
-- No rompe el flujo actual: shift_type = 'unico' = comportamiento de hoy.
-- =====================================================

-- 1. Turno en la sesión de caja existente
ALTER TABLE cash_sessions
  ADD COLUMN IF NOT EXISTS shift_type ENUM('mañana','tarde','unico') NOT NULL DEFAULT 'unico';
ALTER TABLE cash_sessions
  ADD COLUMN IF NOT EXISTS shift_label VARCHAR(50) NULL;

-- 2. Empleados que trabajaron en cada sesión/turno
CREATE TABLE IF NOT EXISTS shift_employees (
  id            VARCHAR(36) PRIMARY KEY,
  tenant_id     VARCHAR(36) NOT NULL,
  session_id    VARCHAR(36) NOT NULL,
  user_id       VARCHAR(36) NULL,                 -- NULL si es ad-hoc (sin cuenta)
  employee_name VARCHAR(100) NOT NULL,
  role_label    VARCHAR(50) NULL,                 -- "mesero", "cajera", "cocina"
  status        ENUM('activo','baja') NOT NULL DEFAULT 'activo',
  baja_reason   VARCHAR(255) NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_shiftemp_session (session_id),
  KEY idx_shiftemp_tenant (tenant_id),
  FOREIGN KEY (session_id) REFERENCES cash_sessions(id) ON DELETE CASCADE
);

-- 3. Bonos y descuentos por empleado (se asignan al cerrar el turno)
CREATE TABLE IF NOT EXISTS shift_employee_bonuses (
  id           VARCHAR(36) PRIMARY KEY,
  tenant_id    VARCHAR(36) NOT NULL,
  session_id   VARCHAR(36) NOT NULL,
  shift_emp_id VARCHAR(36) NOT NULL,
  type         ENUM('bono','descuento') NOT NULL,
  amount       DECIMAL(10,2) NOT NULL DEFAULT 0,
  concept      VARCHAR(255) NULL,                 -- "propinas", "puntualidad", "tardanza"
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_bonus_session (session_id),
  KEY idx_bonus_emp (shift_emp_id),
  FOREIGN KEY (session_id) REFERENCES cash_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (shift_emp_id) REFERENCES shift_employees(id) ON DELETE CASCADE
);
