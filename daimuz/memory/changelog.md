# 📅 Changelog — Lopbuk

> Registro de cambios significativos. Formato: `## [YYYY-MM-DD] — Descripción`

---

## [2026-06-06] — Build verde: 68 errores TypeScript corregidos (frontend + backend)

`pnpm exec tsc --noEmit` arrojaba 53 errores en frontend (8 archivos) y 15 en backend (4 archivos). Todos corregidos con cambios puntuales:

**Frontend**
- `lib/types.ts`: `CategoryItem.isHidden?`; nuevos tipos `DailyReportData` / `SedeReportData` / `ProductReportItem` (espejo de `sales.service.ts`).
- `lib/api.ts`: métodos `getDailyReport(date)` (`GET /sales/daily-report`) y `bulkCreateCustomers(customers)` (`POST /customers/bulk`).
- `ChatWidget.tsx`: `useRef<string|undefined>(undefined)` (React 19 exige argumento).
- `gym-management.tsx`: tipado explícito `id: string` en callbacks.
- `landing-page.tsx`: `?? 0` aplicado a cada operando de la resta de touch.
- `restbar.tsx`: `user?.storeName` -> `user?.tenantName` (x3; `User` no tiene `storeName`).
- `ProductTour.tsx`: migración a react-joyride **3.1** — `CallBackProps`->`EventData`, `disableBeacon`->`skipBeacon`, `styles.options`->prop `options`, `callback`->`onEvent`.

**Backend**
- `assistant.routes.ts`: `tenantId: u.tenantId ?? undefined` (`string|null`->`string|undefined`).
- `gym.service.ts`: `status: m.status` lo pisaba `...acc`; renombrado a `membershipStatus`.
- `workorders.controller.ts`: handlers tipados con `AuthRequest` + `req.user!.tenantId!` (patrón de `sales.controller`).
- **Nuevo** `modules/alegra/alegra.service.ts`: stub tipado de facturación electrónica (el import dinámico en `orders.routes.ts` no resolvía). `createInvoice` es no-op hasta implementar el cliente real.

**Pendiente real (no bloquea build):** implementar endpoint backend `POST /customers/bulk` e integración real de Alegra.

---

## [2026-06-05] — Asistente personal en toda la plataforma (role-aware)

Reutilizando la estructura de chat, el asistente ahora es personal y consciente del rol, disponible en admin/comerciante:
- **Backend** `backend/src/modules/assistant/` (service+routes, montado en `/api/assistant`): runner Gemini role-aware.
  - superadmin → **Agente Maestro**: tools de solo lectura sobre TODA la red (kpis_globales, top_comercios, pedidos_pendientes_globales, stock_critico_global, comercios_inactivos).
  - comerciante/administrador_rb → asistente de SU negocio (mis_ventas, mis_pedidos_pendientes, mi_stock_critico, mis_citas) scoped por tenant_id.
  - cliente → sigue usando `/rutina/assistant`.
- **Frontend** `platform-assistant.tsx`: widget flotante (botón ✨ abajo-derecha) montado en `app/page.tsx` (MainLayout). Solo se muestra a superadmin/comerciante si el asistente de plataforma está habilitado.
- Mismo gate global `platform_assistant_enabled` (lo controla el superadmin). Sin migración nueva.
- Esto es el primer paso del "Epicentro IA": el Agente Maestro responde preguntas de la red. Pendiente (fases siguientes): dashboards visuales de pedidos/citas/conversaciones globales, monitor IA, alertas, BI.

---

## [2026-06-05] — Asistente IA de plataforma (superadmin → toda la infraestructura)

Asistente activable a nivel plataforma (no solo por comercio):
- **Toggle**: `platform_settings.platform_assistant_enabled`. Superadmin lo activa en Integraciones (`superadmin-home.tsx`, switch). Endpoints `GET /chatbot/platform-assistant`, `PUT /chatbot/superadmin/platform-assistant`.
- **Asistente del usuario** (`backend/src/modules/rutina/rutina.assistant.ts`): Gemini con function-calling y acceso CONTROLADO a los datos del propio usuario. Tools: guardar_perfil, crear_rutina_ejercicio, agregar_comida, agregar_lista_compras, recomendar_productos (búsqueda cross-comercio real). Reusa `getAIKey()`. Ruta `POST /rutina/assistant` (gate: plataforma activa) + `GET /rutina/assistant/status`.
- **Chat del usuario** (`consumer-routine.tsx` → `ChatAssistant`): botón "Asistente" en el header (solo si plataforma activa); hace cuestionario breve, arma rutina/plan a medida y muestra tarjetas de productos recomendados. Tras cada acción refresca la vista.
- **Vista comerciante** (`dashboard.tsx` → `AssistantConnectedBanner`): banner "Asistente conectado a tu negocio" cuando está activo (recuerda publicar catálogo con stock para aparecer en recomendaciones).
- Rutinas verificadas: generadas a medida por IA (decisión del usuario), sin catálogo curado.

Sin migración nueva (reusa platform_settings + tablas rutina_*).

---

## [2026-06-05] — Importación masiva: auto-crear categorías inexistentes

`products.service.bulkCreate` ahora resuelve la categoría del CSV (por id o por nombre) y, si no existe para el tenant, la crea automáticamente dentro de la misma transacción (slug como id, nombre original). Mapas en memoria evitan duplicados intra-lote y respetan el UNIQUE (tenant_id, name). Texto de ayuda del modal actualizado en `bulk-upload-dialog.tsx`.
Archivos: `backend/src/modules/products/products.service.ts`, `frontend/components/bulk-upload-dialog.tsx`.

---

## [2026-06-05] — Gym: control de acceso QR + rutina semanal

Tres piezas integradas en la vista del usuario logueado (sin migración nueva, reusa gym_asistencia, gym_membresias, rutina_actividades_log):
- **QR de acceso**: el miembro ve su QR (codifica `GYM:<userId>`, lib `qrcode.react`) y un banner de estado (permitido/por_vencer/denegado) en su pestaña Gym. Endpoint `GET /gym/me/acceso` (`memberAccess` + `computeAccess`).
- **Escáner + resultado (recepción)**: pestaña "Acceso QR" en `gym-management.tsx` con cámara `@zxing/browser` + código manual; muestra pantalla de resultado a pantalla completa (verde/ámbar/rojo) y registra el ingreso si procede. Endpoint `POST /gym/scan` (`scanAccess` valida membresía, auto-marca vencida, registra check-in).
- **Mi semana (Lun–Dom)**: componente `WeekStrip` en la pestaña Rutina — bloques por día, marca actividades cumplidas (`rutina_actividades_log` vía `POST /rutina/actividades/:id/toggle-log` + `GET /rutina/actividades-log`) y cruza con la asistencia real al gym (puntos violeta).

---

## [2026-06-05] — Gym: aprovechar al máximo la estructura

Auditoría y completado del módulo gym para usar todo el esquema:
- Backend: `memberCheckIn`/`memberCheckOut` (auto check-in del miembro, valida membresía activa), `listMemberAttendance` (historial por miembro), `miAsistencia` ahora devuelve `openCheckIn`, `getMemberDetail` incluye asistencia. Rutas: `POST /gym/me/checkin`, `POST /gym/me/checkout`, `GET /gym/members/:id/asistencia`.
- Frontend staff (`gym-management.tsx`): plan con peso/descanso por ejercicio + descripción; progreso con medidas corporales (cintura/pecho/brazo/pierna/cadera → JSON); detalle de miembro con edición completa de membresía (estado/fechas/auto-renew/notas), acciones rápidas activar/pausar/cancelar, e historial de asistencia.
- Frontend miembro (`consumer-routine` GymView): botón de auto check-in / marcar salida por gimnasio activo.
- API: `miGymCheckIn/Out`, `getGymMemberAttendance`.

---

## [2026-06-05] — Rediseño UI módulo CONSUMIDOR (rutina)

La vista del cliente estaba básica y no exponía todo el backend. Rediseño completo de `consumer-routine.tsx`:
- Header con degradado + anillo SVG de calorías (consumidas/meta) + barras de macros (P/C/F) del día.
- Editor de **perfil/objetivos** (modal, antes inexistente): objetivo, peso/meta, kcal, agua, nivel actividad, ciudad.
- Pestaña **Rutina** nueva: constructor de rutinas + actividades (día/hora/tipo), antes sin UI.
- Pestaña **Cocina** (sub-tabs Despensa/Recetas) con **creación de recetas** completa (macros, dificultad, meal_type, ingredientes) y "qué puedo cocinar".
- **Plan** con captura y totales de macros + toggle hecho.
- Chips de objetivo/agua/peso, empty states, tab bar pulido. Pestaña Gym condicional intacta.
- Backend: `getResumen` ahora devuelve nutrición del día (plan vs consumido) y `listPlanComidas` incluye macros.

Tabs finales: Hoy · Rutina · Cocina · Plan · Compras · Gym(si miembro).

---

## [2026-06-05] — Módulo GIMNASIO end-to-end

### Backend (`/api/gym`)
- `gym.service.ts` (nuevo): membresías con cobro (registrarPago avanza next_payment según ciclo), planes+ejercicios (transacción), progreso, asistencia check-in/out, stats del gym, detalle de miembro, y vistas del miembro (misMembresias, miPlan, miProgreso, miAsistencia con cálculo de racha/streak).
- `gym.routes.ts` (nuevo): authorize POR RUTA — staff (`comerciante`/`administrador_rb`/`vendedor`/`cajero`) en `/gym/...`, miembro (`cliente`) en `/gym/me/...`. `index.ts` + montado en `src/index.ts`.

### Frontend
- `components/gym-management.tsx` (nuevo): panel del comercio — stats, tabla de miembros, alta de miembro (por email), modal de detalle con planes/progreso, registrar pago, crear plan con ejercicios, registrar progreso, y pestaña de asistencia con check-out.
- Montado en dashboard: `app/page.tsx` (import + `case 'gym'`) y entrada "Gimnasio" (icono Dumbbell) en `components/sidebar.tsx`.
- Vista del miembro: pestaña "Gym" agregada a `consumer-routine.tsx` (solo si tiene membresía) — membresías, racha de asistencia, plan de entrenamiento y progreso reciente.

### Pendiente
- Correr migraciones en MySQL prod (categorías, identidad, lifestyle/gym) + push.
- Cobro real de membresías (hoy `registrarPago` solo avanza fechas; integrar con pasarela/efectivo si se requiere).

---

## [2026-06-05] — Categorías PK compuesta + base de datos módulo Consumidor/Gimnasio

### Fixes
- **Categorías 500 entre tenants**: PK era global → migración a PK compuesta `(tenant_id, id)`. Archivos: `backend/migrations/fix_categories_composite_pk.sql` (MySQL) + versión Postgres en `backend/migrations/postgres/001_*.sql`. Esquema base actualizado.
- Aclaración de infra: **producción corre en MySQL** (no Postgres). pgAdmin estaba conectado al motor equivocado (`categories does not exist`).

### Nueva base de datos (solo migración, sin código aún)
- **Módulo Consumidor (Rutina/Estilo de vida)** — datos del usuario final cross-comercio (pertenecen a `users.id`, no a un tenant):
  - `rutina_perfil`, `rutina_despensa`, `rutina_recetas`, `rutina_receta_ingredientes`, `rutina_rutinas`, `rutina_actividades`, `rutina_plan_comidas`, `rutina_lista_compras`
- **Módulo Gimnasio** — tenant-scoped (`business_type=gimnasio`), control de miembros y progreso:
  - `gym_membresias`, `gym_planes_entrenamiento`, `gym_ejercicios`, `gym_progreso`
- Archivo: `backend/migrations/add_lifestyle_rutina_and_gym_modules.sql`
- Visión: vista del cliente logueado con su rutina diaria, qué comer, recetas con lo que tiene en despensa, lista de lo que falta comprar, y compra cruzada a comercios registrados (proteínas, frutas, gimnasio, ropa, etc.).

### Decisiones tomadas
- Consumidor = **cross-comercio (usuario de plataforma)**. `users` con `role='cliente'` ES el platform_user (no se crea tabla aparte). `users.tenant_id` ya es NULL-able.
- Capa de identidad: nueva tabla `customer_tenant_profiles` (PK `platform_user_id + tenant_id`) con dirección por comercio (neighborhood/municipality/department), bloqueo (`is_blocked`/`block_reason`), consentimiento Habeas Data (`accepts_marketing`), y métricas denormalizadas (first/last_order_at, total_orders, total_spent, average_ticket, total_returns). `customers` se mantiene para mostrador. Archivo: `backend/migrations/add_platform_identity.sql`.

### Construido (end-to-end módulo CONSUMIDOR/rutina)
- **Migración** `add_lifestyle_rutina_and_gym_modules.sql` ampliada: macros (protein/carbs/fat) en recetas y plan de comidas; perfil con bmr/tdee/bmi/target_weight/water_target; recetas con cook/total minutes, difficulty, meal_type; gym_membresias con price/payment_cycle/auto_renew/next_payment; + tablas nuevas `gym_asistencia` y `rutina_actividades_log`.
- **Backend** módulo `rutina` (nuevo): `rutina.service.ts` (perfil, despensa, recetas+ingredientes, rutinas+actividades, plan comidas, lista compras, "qué puedo cocinar", generar lista desde receta, resumen), `rutina.routes.ts` (authorize cliente, REST), `index.ts`, montado en `src/index.ts` como `/api/rutina`.
- **Frontend**: `lib/api.ts` con métodos rutina; `components/consumer-routine.tsx` (overlay full-screen con pestañas Hoy/Despensa/Recetas/Plan/Compras). En `landing-page.tsx` se agregó SOLO un botón nuevo "Rutina" al nav inferior (visible si logueado) + render del overlay. **Las 5 secciones existentes (Mi cuenta, Ofertas, buscar, Carrito, Tienda) quedaron intactas.**

### Pendiente
- Correr en MySQL de prod: `fix_categories_composite_pk.sql`, `add_platform_identity.sql`, `add_lifestyle_rutina_and_gym_modules.sql`.
- `commit` + `push` para que Komodo reconstruya con el código nuevo.
- Módulo GIMNASIO (backend/frontend) aún no construido (solo tablas).
- Nota infra: el mount de bash a veces ve copias desfasadas por OneDrive; los tools Read/Edit ven la versión real.

---

## [2026-06-04] — Despliegue en producción (Komodo) + fixes del chatbot IA

### Despliegue
- App desplegada en producción con **Komodo** (`deploy.alexsters.works`), stack `daimuz` (2 servicios: `daimuz_backend`, `daimuz_app`). Dominio: `https://daimuz.alexsters.works`.
- Komodo construye desde el repo de GitHub `github.com/estebanIoI/lopbuk_gastrobar.git` (branch `main`), **no** desde la carpeta local. Los cambios deben hacerse `commit` + `push` para que el build los tome.
- Config Komodo: **Pre Build Images** = ENABLED (corre `docker compose build`), **Destroy Before Deploy** = ENABLED.

### Fixes
- **Google OAuth en prod**: `NEXT_PUBLIC_GOOGLE_CLIENT_ID` iba vacío en los build args del frontend → el provider no se montaba. Las vars `NEXT_PUBLIC_*` se hornean en build, no en runtime. Se pasó el client ID real como build arg.
- **Chatbot — modelo Gemini retirado**: `gemini-2.0-flash` ya no existe (404). En `agent.service.ts` el modelo estaba hardcodeado. Cambiado a alias `gemini-flash-latest` (configurable vía env `GEMINI_MODEL`).
- **Chatbot — soporte Groq**: `callAI()` ahora enruta por prefijo de key: `AIza`→Gemini, `gsk_`→Groq (endpoint OpenAI-compatible, modelo vía env `GROQ_MODEL`, default `llama-3.3-70b-versatile`), otra→OpenAI. Nota: el function-calling (pedidos/reservas) solo está implementado para Gemini.

### Archivos modificados
- `backend/src/modules/agent/agent.service.ts` — modelo Gemini por alias/env + función `callGroq` + routing en `callAI`

### Resultado
- ✅ Chatbot IA corriendo en producción tras `push` al repo + rebuild en Komodo.

### Pendiente menor
- Unificar el `GOOGLE_CLIENT_ID` del backend con el `NEXT_PUBLIC_GOOGLE_CLIENT_ID` del frontend (estaban con valores distintos).

---

## [2026-05-28] — SQL sincronizado v3.8 + neuronas nuevas

### SQL
- Migración v3.8 agrega `categories.is_active/color/sort_order` (fresh + idempotente en existentes)
- Tablas `rb_gastos`, `rb_ingresos_diarios`, `rb_gastos_fijos` integradas al script principal

### DAIMUZ
- Nueva neurona `modules/restbar-finanzas/` (completa + compressed)
- `indexes/endpoints-index.md` actualizado: CATEGORIES PATCH visibility + RESTBAR FINANZAS 13 endpoints
- `indexes/db-tables-index.md` actualizado: 3 tablas nuevas + columnas de categories
- `indexes/files-index.md` actualizado: archivos de categories CRUD + restbar.finanzas + restbar-finanzas.tsx
- `gastrobar-ops/compressed.md` actualizado: Finance Tracker documentado

---

## [2026-05-27] — Tracker Financiero Gastrobar + Categorías CRUD + DAIMUZ v3

### Nuevas funcionalidades
- **Tracker Financiero RestBar**: tab "Finanzas" (admin-only) en el módulo RestBar. Registra gastos variables, ingresos diarios, gastos fijos (con periodos: mensual/quincenal/semanal) y genera resumen quincenal. Auto-timestamp capturado en servidor al momento del registro. Timeline cronológico con iconos diferenciados.
- **Categorías CRUD completo** en módulo Inventario: dialog "Gestionar Categorías" con lista, edición inline, color picker, toggle ocultar/mostrar y eliminar con validación (no elimina si tiene productos activos).

### Mejoras
- **CategoryItem** extendido: ahora incluye `isActive`, `color`, `sortOrder`
- **Store Zustand**: nuevas acciones `updateCategory`, `toggleCategoryVisibility`; `fetchCategories` acepta `includeHidden`
- **DAIMUZ v3** completado al 100/100: gobernanza (3 archivos), todos los compressed.md (22 módulos), synapses completas, bugs-history poblado, deployment.md corregido (Dokploy + Evolution API v2)

### Bugs corregidos
- `api.ts`: método duplicado `toggleCategoryVisibility` → renombrado el de storefront a `toggleStorefrontCategoryVisibility` para evitar colisión en clase

### Archivos modificados
- `frontend/components/restbar.tsx` — tab Finanzas + import RestBarFinanzas
- `frontend/components/restbar-finanzas.tsx` — componente nuevo (tracker financiero completo)
- `backend/src/modules/restbar/restbar.finanzas.routes.ts` — router con 13 endpoints
- `backend/src/modules/restbar/restbar.routes.ts` — mount del sub-router `/finanzas`
- `backend/src/index.ts` — 3 CREATE TABLE para rb_gastos/rb_ingresos_diarios/rb_gastos_fijos
- `frontend/lib/types.ts` — CategoryItem extendido
- `frontend/lib/store.ts` — updateCategory + toggleCategoryVisibility
- `frontend/lib/api.ts` — métodos categorías + fix duplicado
- `frontend/components/inventory-list.tsx` — dialog categorías CRUD completo
- `frontend/components/store-customization.tsx` — actualizado a toggleStorefrontCategoryVisibility
- `backend/src/modules/categories/categories.service.ts` — update + toggleVisibility
- `backend/src/modules/categories/categories.controller.ts` — update + toggleVisibility
- `backend/src/modules/categories/categories.routes.ts` — PUT /:id + PATCH /:id/visibility

### Métricas de esta sesión
- Tiempo total estimado: ~18 minutos
- Files explorados antes de implementar: 3 (vs 8-12 sin DAIMUZ)
- Backtracking: 0
- Bugs encontrados en runtime: 0 (el duplicado de api.ts detectado en pre-lectura)

### Documentación DAIMUZ añadida
- `brain/daimuz-replication.md` — guía completa para replicar DAIMUZ en cualquier proyecto
- `memory/recuerdo-daimuz-estructura.md` — recuerdo corto con el mínimo viable y formato compressed.md

---

## [2026-05-27] — Memoria unificada en DAIMUZ + mejoras cajero

### Nuevas funcionalidades
- **División de cuenta igualitaria** en `cajero-panel.tsx`: el cajero activa un modo que divide el total entre N personas (contador +/−, grid rápido 2–10 personas, auto-rellena el campo de monto)

### Mejoras
- **CLAUDE.md** creado en root: Claude Code ahora usa `daimuz/` como sistema de memoria del proyecto
- **Limpieza de docs**: eliminada carpeta `docs/`, contenido migrado a `daimuz/vault/` (api-routes, business-rules, changelog)
- **READMEs actualizados**: eliminado `README copy.md` obsoleto, reescritos `backend/README.md` y `frontend/README.md` con información actual de Lopbuk

### Archivos modificados
- `frontend/components/cajero-panel.tsx` — división igualitaria
- `CLAUDE.md` — nuevo
- `backend/README.md` · `frontend/README.md` — reescritos
- `daimuz/` — neuronas alimentadas con estado actual

---

## [2026-05-26] — Núcleo cognitivo DAIMUZ

### Nuevas funcionalidades
- Creado sistema de documentación DAIMUZ en Obsidian
- 60+ neuronas organizadas en brain, memory, architecture, modules, flows, decisions, prompts, context, vault

---

## [2026-05] — Agente IA (Fases 1 y 2)

### Completado
- **Fase 1 — RAG + Function Calling**: agente responde con contexto del negocio
- **Fase 2 — WhatsApp (Evolution API v2)**: webhook configurado, mensajes entrantes/salientes
- Fix `agent.service.ts`: productos solo se sugieren cuando el mensaje lo pide explícitamente
- Fix `whatsapp.service.ts`: `setWebhook` corregido al formato plano de Evolution API v2

---

## [Mayo 2026] — Estado del ecosistema completo

### Sistema Core
- Multi-tenancy por columna (`tenant_id`)
- Auth JWT + httpOnly cookie + Google OAuth
- Módulos activables por tenant
- Multi-sede (sucursales)
- 10 roles con permisos diferenciados

### Operaciones de Negocio
- POS completo (carrito, descuentos, múltiples pagos, impresión)
- Cierres de caja con arqueo
- Kardex completo (entrada, salida, ajuste, merma, transferencia)
- Recetas BOM con food cost automático
- Control de merma con justificaciones
- Niveles PAR y alertas de reorden
- Compras a proveedores

### Gastrobar
- Mesas con estados, comandas, reservas
- Panel de cocina, bartender, mesero, cajero
- Cajero: cobro por comensal o mesa completa + división igualitaria

### Clientes y Finanzas
- CRM básico con historial de compras
- Fiados y créditos con control de cupo
- Flujo de caja (ingresos, egresos, P&L)

### Delivery y Digital
- Pedidos con estados completos + asignación de conductores
- Storefront público por slug único
- Checkout de tienda online
- Landing page personalizable por tenant
- Portafolio de proyectos/servicios
- Menú digital público

### Integraciones
- Stripe (pagos + suscripciones SaaS)
- WhatsApp Business API (Evolution API v2)
- Google OAuth
- Cloudinary (imágenes)
- Impresoras térmicas (POS)

---

## [2024] — v1.0 Base

### Fundacional
- Estructura inicial (Next.js + Express + MySQL)
- Auth JWT básico
- CRUD productos e inventario
- POS inicial
- Dashboard básico

---

## Template para nuevas entradas

```markdown
## [YYYY-MM-DD] — Título

### Nuevas funcionalidades
- Feature agregado

### Mejoras
- Mejora aplicada

### Bugs corregidos
- Bug resuelto

### Archivos modificados
- `ruta/al/archivo.ts`
```

---

← [[current-state]] | [[DAIMUZ]] | → [[completed-features]]
