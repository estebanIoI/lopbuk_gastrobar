# Workout Runtime (Fase 5)

Runtime de entrenamiento del **consumidor** (scope = `users.id`, igual que `rutina`
— sin `tenant_id`). Conecta el botón "Iniciar rutina" con el progression engine
determinístico (`modules/progression`).

> **Alcance V1:** persistencia + endpoints + puente de progresión.
> **NO incluye todavía** (a propósito): frontend, sockets/live sync, rest timer
> backend, IA coach runtime, fatigue engine, gamificación avanzada.

## Capas

```
shared/         enums (estados) · schema (contratos .parse(), sin deps)
domain/
  entities/     WorkoutSession · WorkoutExercise · WorkoutSet · snapshot
  state-machine/ SessionStateMachine (transiciones explícitas, sin "boolean hell")
  calculators/  session-metrics (volumen, peso de trabajo, reps completadas) — puro
application/
  services/     workout-session (lifecycle) · set-tracking · progression-bridge
  events/       contratos de eventos + publisher (no-op extensible)
infrastructure/
  persistence/  ensureWorkoutSchema (CREATE TABLE IF NOT EXISTS, idempotente)
  repositories/ workout.repository (ÚNICO acceso a DB, user-scoped, transaccional)
workout.routes.ts   endpoints
__tests__/      state machine · métricas · progression-bridge (node:test)
```

## Máquina de estados

```
pending → active, cancelled
active  → paused, completed, cancelled
paused  → active, cancelled
completed / cancelled  → (terminal)
```

Toda transición pasa por `SessionStateMachine.assertTransition`; ningún servicio
muta `status` a mano.

## Flujo (donde nace la magia)

```
POST /workouts/start            → crea sesión 'active' + ejercicios + sets (snapshot del plan)
POST /workouts/:id/sets/:sid/complete → marca set (reps+peso), recalcula completitud del ejercicio
POST /workouts/:id/complete     → corre el progression engine por ejercicio:
                                    workingWeight + reps → ProgressionDecision
                                    → upsert exercise_progressions (snapshot, NO recálculo)
                                    → publica progression_computed + workout_completed
                                    → devuelve resumen (duración, volumen, decisiones, PRs)
```

El runtime **no decide cargas**: delega 100% en `progressionService`. Si un
ejercicio no tiene sets completados, no genera señal (no improvisa).

## Endpoints (`/api/workouts`, auth `cliente`)

| Método | Ruta | Acción |
|---|---|---|
| POST | `/start` | Iniciar sesión |
| GET | `/` | Listar sesiones recientes |
| GET | `/:id` | Detalle (ejercicios + sets) |
| POST | `/:id/sets/:setId/complete` | Registrar set |
| POST | `/:id/pause` · `/resume` · `/cancel` | Lifecycle |
| POST | `/:id/complete` | Completar → progresión + resumen |

## Tablas (idempotentes, boot)

`workout_sessions` · `workout_exercises` · `workout_sets` · `exercise_progressions`
(snapshot por usuario+ejercicio, source of truth para precargar el peso sugerido).

## Contrato de `POST /start`

```jsonc
{
  "routineId": "opcional",
  "goal": "hypertrophy",
  "exercises": [
    { "exerciseId": "press_banca", "name": "Press banca",
      "targetSets": 4, "targetReps": 12, "suggestedWeight": 22.5,
      "movementPattern": "upper" }
  ]
}
```

## Tests

Igual que el progression engine: runner nativo `node:test`. Las piezas puras
(state machine, calculadoras, progression-bridge) se testean sin DB.
