# Caja por Turnos — evolución de cash-sessions

Extiende el módulo de caja con **turnos** (mañana/tarde/único), **empleados
dinámicos por turno** y **bonos/descuentos por empleado**. No rompe el flujo
actual: una caja con `shift_type = 'unico'` se comporta exactamente como hoy.

## Base de datos — `backend/src/migrations/add_cash_shifts.sql`

- `cash_sessions`: + `shift_type ENUM('mañana','tarde','unico')` (default `unico`) + `shift_label`.
- `shift_employees`: quién trabajó en cada sesión (de cuenta o ad-hoc), con `status` activo/baja y `baja_reason`.
- `shift_employee_bonuses`: bonos/descuentos por empleado, asignados al cierre.

## Backend — `backend/src/modules/cash-sessions/`

| Método | Ruta | Cambio |
|---|---|---|
| POST | `/api/cash-sessions/open` | **modificado**: recibe `shiftType`, `shiftLabel`, `employees[]` |
| GET | `/api/cash-sessions/:id/employees` | nuevo: empleados del turno (+ sus bonos) |
| POST | `/api/cash-sessions/:id/employees` | nuevo: agregar empleado al turno en curso |
| PUT | `/api/cash-sessions/:id/employees/:empId` | nuevo: editar rol / dar de baja |
| POST | `/api/cash-sessions/:id/close` | **modificado**: recibe `bonuses[]` por empleado |
| GET | `/api/cash-sessions/daily-summary?date=` | nuevo: consolidado de ambos turnos del día |

`openSession`/`closeSession` reciben parámetros opcionales (compatibilidad total).
El resumen diario agrega por turno: apertura, ventas, esperado/contado/diferencia,
empleados y totales de bonos/descuentos.

## Frontend — `components/cash-shifts/shift-components.tsx`

`ShiftSelector` · `EmployeePicker` · `ShiftEmployeeManager` · `BonusDiscountPanel`
· `DailySummaryView` · `ShiftBadge`. Cliente API extendido en `lib/api.ts`
(`openCashSession(opts)`, `closeCashSession({bonuses})`, `getShiftEmployees`,
`addShiftEmployee`, `updateShiftEmployee`, `getCashDailySummary`).

Integrado en `components/cash-register.tsx`:
- **Apertura**: selector de turno + selector de empleados (lista + ad-hoc).
- **Sesión activa**: `ShiftBadge` en el título, botón "Resumen del día", y panel
  de gestión de empleados (solo si hay turno ≠ único).
- **Cierre**: panel de bonos/descuentos por empleado (solo si hay turno).

## Compatibilidad

Si el comercio no usa turnos, deja "Único" → mismo comportamiento de hoy. La UI
de turnos (badge, gestor de empleados, bonos) solo aparece cuando la sesión tiene
`shift_type` distinto de `unico`.

## Cómo probar

1. Aplicar `add_cash_shifts.sql`.
2. Abrir caja eligiendo **Mañana**, seleccionar empleados (o agregar ad-hoc), operar.
3. Durante el turno: agregar/editar/dar baja empleados.
4. Cerrar: contar efectivo + asignar bonos/descuentos por empleado.
5. Repetir con **Tarde** y ver el **Resumen del día** consolidado.
