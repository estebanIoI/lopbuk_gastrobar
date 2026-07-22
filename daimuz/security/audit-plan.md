# 🔬 Plan Maestro de Auditoría — Las 17 Fases

> Cada fase está aterrizada en la superficie **real** de DAIMUZ y trae un checklist accionable.
> Basado en OWASP Top 10 (2021 · API 2023 · LLM 2025), MITRE ATT&CK, NIST CSF 2.0, ISO 27001.
> Amenazas: [[security/threat-model-2026]] · Activos: [[security/asset-inventory]] · KPIs: [[security/kpis]].

---

## Fase 1 — Inventario de activos
Documento propio: [[security/asset-inventory]]. Auditar VPS, Docker, Traefik, Redis, MySQL,
backups, CDN, Cloudinary, DNS, SSL, firewalls; todas las apps (backend, frontend, móvil, APIs,
panel, marketplace, POS, wallet, IA, jobs); clasificar datos (público/interno/sensible/financiero/
biométrico) y catalogar secretos (JWT, keys de Gemini/OpenAI/SMTP/OAuth/Wompi, wallets).

---

## Fase 2 — Arquitectura de Software
**Superficie DAIMUZ:** monolito Express, gateway Traefik, RBAC (`authorize()`), multi-tenant por
columna `tenant_id`, ORM/queries con Drizzle + MySQL2, transacciones, cache Redis, colas, webhooks.

**Buscar:** Single Point of Failure · race conditions · deadlocks · memory leaks · DoS · lógica
insegura · escalamiento de privilegios · Broken Access Control.

**Puntos calientes reales:**
- Stock: ya resuelto con UPDATE condicional atómico (`stock >= ?`) — verificar que TODO decremento lo use (ver [[governance/universal-constraints]] § Stock).
- Caja: una sola sesión activa por sede; históricos inmutables — verificar que no haya ruta de edición.
- Congelación de precios en `sale_items` — verificar que ningún reporte histórico lea precios vivos.
- Monolito = SPOF: si Express cae, todo cae → medir disponibilidad, health checks, restart policy.

**Checklist:**
- [ ] Mapear SPOF (DB, Redis, contenedor único, Traefik) y su mitigación
- [ ] Revisar transacciones en operaciones multi-tabla (venta, compra, wallet)
- [ ] Cazar race conditions en stock, caja, wallet, cupos de eventos
- [ ] Revisar límites de memoria/CPU por contenedor (evitar memory leak → OOM → DoS)
- [ ] Verificar que la lógica vive solo en `*.service.ts`

---

## Fase 3 — Autenticación
**Superficie DAIMUZ:** JWT en cookie httpOnly (fuente de verdad), Google OAuth, login local con
hash de password. `auth.middleware.ts` = **no tocar sin aprobación**.

**Validar:** JWT · refresh token · expiración · rotación · revocación · hash de password
(Argon2/BCrypt) · 2FA · passkeys · OAuth (Google/Facebook).

**Simular ataques:** credential stuffing · password spraying · session hijacking · replay ·
token theft · cookie poisoning · JWT manipulation · session fixation.

**Gaps conocidos a cerrar:** 2FA/passkeys (aún no presentes) · lockout/rate limit en `/auth/login` ·
revocación explícita de refresh tokens · verificación de `alg` en JWT (evitar `alg: none`).

**Checklist:**
- [ ] Confirmar algoritmo y verificación de firma del JWT (rechazar `none`, algoritmos débiles)
- [ ] Cookie: `HttpOnly` + `Secure` + `SameSite` correctos
- [ ] Expiración corta de access token + rotación de refresh + revocación en logout/robo
- [ ] Hash de password fuerte (Argon2id preferido; si BCrypt, cost adecuado)
- [ ] Rate limit + lockout progresivo en login (anti stuffing/spraying)
- [ ] Roadmap 2FA/passkeys para roles sensibles (dueño, superadmin)

---

## Fase 4 — Permisos y Control de Acceso
**Inspirado en OWASP #1 (Broken Access Control).** Superficie: RBAC vía `authorize('rol', ...)`,
aislamiento de tenant, roles (superadmin, comerciante, cajero, cocinero, driver, cliente…).

**Verificar:** RBAC · ABAC · tenant isolation · escalamiento vertical · escalamiento horizontal ·
Broken Access Control · **IDOR/BOLA** · forced browsing · mass assignment · privilege injection.

**Regla crítica DAIMUZ:** `tenant_id` SIEMPRE de `req.user.tenantId`, jamás del body/params/query
([[governance/universal-constraints]] § Multi-tenancy). El superadmin es la única excepción y debe estar codificada explícitamente.

**Checklist:**
- [ ] Probar IDOR: acceder a `id` de otro tenant en cada endpoint que reciba un id
- [ ] Verificar que ninguna query lea `tenant_id` del request
- [ ] Escalamiento horizontal: cliente A no ve pedidos/PII de cliente B
- [ ] Escalamiento vertical: cajero no accede a finanzas/superadmin
- [ ] Mass assignment: whitelist de campos en updates (no aceptar `role`, `tenant_id`, `is_active` del body)
- [ ] Forced browsing: rutas de admin sin link no quedan sin authz

---

## Fase 5 — Base de Datos
**Superficie DAIMUZ:** MySQL multi-tenant (203 tablas), acceso vía MySQL2/Drizzle, migraciones
versionadas (Drizzle Kit — **prohibido DDL en runtime**).

**Buscar:** SQL injection · blind SQLi · second order injection · mass update/delete · foreign keys ·
cascadas · triggers · backups · restore · integridad · corrupción · índices · permisos · usuarios ·
**root expuesto**.

**Checklist:**
- [ ] Confirmar queries parametrizadas SIEMPRE (nada de concatenación de strings)
- [ ] Usuario de app con privilegios mínimos (no root); root sin acceso remoto
- [ ] MySQL sin puerto expuesto a Internet (solo red Docker)
- [ ] Revisar FKs/cascadas: un DELETE no debe arrastrar datos de negocio (soft delete)
- [ ] Backups automáticos + prueba de restore real (enlaza [[security/audit-plan#fase-13]])
- [ ] Integridad: checksums, detección de corrupción, migraciones revisadas antes de aplicar

---

## Fase 6 — APIs
**Superficie DAIMUZ:** REST (kebab-case, ~ver [[indexes/endpoints-index]]), WebSocket (Socket.io para
POS/pedidos/scanner), webhooks (Stripe, Wompi, WhatsApp), rutas públicas (storefront/menu).

**Auditar:** REST · GraphQL (si aplica) · WebSocket · webhooks · OpenAPI · rate limit · validación de
entrada/salida · payload injection · replay · authentication · authorization · API enumeration ·
API discovery · **Shadow APIs** · API keys.

**Basado en OWASP API Top 10 (BOLA, Broken Auth, BOPLA, unrestricted resource consumption).**

**Checklist:**
- [ ] Inventario completo de endpoints vs código → detectar Shadow/undocumented APIs
- [ ] Rate limiting global y por endpoint sensible (login, checkout, agente IA)
- [ ] Validación de entrada estricta (esquemas), validación de salida (no filtrar campos internos)
- [ ] WebSocket: authz por sala/tenant (no unirse a room de otro tenant)
- [ ] Webhooks: verificar firma + idempotencia + anti-replay (timestamp/nonce)
- [ ] Sin datos internos en endpoints públicos (storefront acotado por slug)

---

## Fase 7 — IA / Agentes 🔥
**La auditoría más importante de 2026.** Superficie DAIMUZ: `agent.service.ts`, `agent.rag.ts`
(RAG), `agent.tools.ts` (function calling), canal WhatsApp (Evolution API), proveedor LLM
(Gemini/OpenAI). El ControlChat **ejecuta acciones reales** en el negocio.

**Evaluar (OWASP LLM Top 10):** prompt injection · indirect prompt injection · data leakage ·
tool poisoning · agent hijacking · prompt stealing · alucinación crítica · sensitive prompt
disclosure · LLM jailbreak · function calling abuse · RAG poisoning · memory poisoning · supply chain IA.

**Reglas críticas DAIMUZ (ya en governance):**
- **NUNCA** PII de clientes al contexto RAG (guard en `agent.rag.ts`) — saldría al LLM sin base legal.
- Toda tool corre con el `tenant_id` del usuario, respeta permisos y aprobaciones, y audita `ChatAction`.
- Excepción sancionada: el agente puede ver nombre + resumen de compras del PROPIO cliente de la sesión; la dirección se resuelve server-side, nunca va al LLM.

**Checklist:**
- [ ] Prompt injection directo: intentar que el agente ignore sus instrucciones / cruce de tenant
- [ ] Indirect injection: payload en catálogo, nombre de producto, mensaje de WhatsApp o fuente RAG
- [ ] Function calling abuse: forzar tools fuera del tenant o sin aprobación (debe fallar)
- [ ] Data leakage: pedir al agente secretos, PII de otros clientes, prompt del sistema
- [ ] RAG/memory poisoning: envenenar la base de conocimiento y medir impacto
- [ ] Límites de gasto y rate limit sobre llamadas al LLM (anti abuso de costo)
- [ ] Registrar cada acción del agente (`ChatAction`) y revisar el audit trail

---

## Fase 8 — Frontend
**Superficie DAIMUZ:** Next.js 16 / React 19, storefront público, cookies de sesión, colorimetría.

**Auditar:** XSS (DOM/stored/reflected) · CSRF · clickjacking · CSP · headers · cookies · SameSite ·
Secure · HttpOnly · CORS · LocalStorage · SessionStorage.

**Checklist:**
- [ ] CSP estricta (script-src sin `unsafe-inline` donde sea posible)
- [ ] Headers de seguridad: HSTS, X-Frame-Options/frame-ancestors, X-Content-Type-Options, Referrer-Policy
- [ ] Stored XSS: sanear contenido generado por tenant (nombres de producto, secciones HTML de storefront)
- [ ] CSRF: sesiones en cookie → protección anti-CSRF (SameSite + token si aplica)
- [ ] No guardar tokens/PII en LocalStorage; sesión en cookie httpOnly
- [ ] CORS: allowlist de orígenes, no `*` con credenciales

---

## Fase 9 — Infraestructura
**Superficie DAIMUZ:** Docker en VPS, Traefik, TLS, SSH, firewall, puertos.

**Auditar:** Docker escape · contenedores privilegiados · secrets · variables de entorno · volumes ·
Traefik · firewall · SSH · fail2ban · TLS/SSL · puertos · servicios expuestos · escaneo de puertos ·
escaneo de CVEs · kernel.

**Checklist:**
- [ ] Ningún contenedor `privileged` ni con socket de Docker montado sin necesidad
- [ ] Secretos vía entorno/secret store, no en la imagen ni en `docker-compose` commiteado
- [ ] Nmap externo: solo 80/443 abiertos; MySQL/Redis/Traefik-dashboard cerrados
- [ ] SSH: solo clave (no password), fail2ban activo, puerto/limitación
- [ ] TLS moderno (1.2+), sin cifradores débiles, certificados válidos y auto-renovados
- [ ] Escaneo de CVEs de imágenes base (Trivy) y del kernel/paquetes del host

---

## Fase 10 — DevSecOps
**Superficie DAIMUZ:** repo Git (GitHub), dependencias npm, Docker build, deploy (Dokploy/Komodo),
migraciones en el arranque (`migrate` antes de `index.js`).

**Auditar:** pipeline · GitHub · secrets · dependencias · SBOM · Dependabot · npm · supply chain ·
CI/CD · firmado · SAST · DAST · IaC · escaneo de contenedores.

**La cadena de suministro es hoy una categoría principal de OWASP.**

**Checklist:**
- [ ] GitLeaks/secret scanning en cada push (bloquear secretos)
- [ ] Dependabot + `npm audit` + pin de versiones; revisar dependencias transitivas
- [ ] Generar SBOM del backend y frontend
- [ ] SAST (Semgrep/SonarQube) y DAST (OWASP ZAP) en CI
- [ ] Escaneo de imágenes (Trivy) e IaC (docker-compose/Traefik) antes de deploy
- [ ] Proteger ramas, revisar permisos de GitHub Actions, firmar artefactos/imágenes

---

## Fase 11 — Cloud
**Superficie DAIMUZ:** Cloudflare/CDN, Cloudinary (media), DNS, posibles buckets/almacenamiento,
secretos gestionados.

**Auditar:** IAM · buckets · storage · backups · logs · snapshots · cifrado de snapshots ·
cloud secrets · cloud SQL · cloud functions · Cloudflare · CDN.

**Checklist:**
- [ ] Cloudinary: carpetas no listables públicamente, sin PII en imágenes
- [ ] IAM de mínimo privilegio en cada servicio cloud; sin claves largas compartidas
- [ ] Snapshots/backups cifrados y con acceso restringido
- [ ] Cloudflare: WAF activo, reglas anti-bot, protección de origen (no bypasseable)
- [ ] Logs de acceso centralizados y retenidos

---

## Fase 12 — Datos (Cifrado y Ciclo de Vida)
**Auditar:** cifrado (AES-256) · TLS · hash · integridad · firmas · rotación · clasificación ·
tokenización · anonimización · pseudonimización · retención · borrado seguro.

**Ya implementado en DAIMUZ (Ley 1581, módulo privacy):** consentimiento previo, anonimización para
el derecho al olvido (no DELETE), retención automática (`retention.job.ts`: chat 12m, delivery-chat 6m,
GPS 90d), auditoría de todo acceso/export/borrado de PII en `audit_log`, `redactPII()` en logs,
`minimizeGatewayPayload()` en webhooks de pasarela.

**Checklist:**
- [ ] TLS en todo tránsito (interno y externo); cifrado en reposo donde el dato lo amerite (AES-256)
- [ ] Datos de tarjeta: confirmar que NUNCA se almacenan (los maneja la pasarela)
- [ ] Rotación de claves de cifrado y de firma
- [ ] Tokenización/pseudonimización de PII donde sea viable
- [ ] Borrado seguro real (que la anonimización sea irreversible y verificable)
- [ ] Firmar DPAs pendientes (Wompi, Cloudinary, Evolution API, MercadoPago, ADDI, Sistecrédito)

---

## Fase 13 — Anti-Ransomware
> Los expertos recomiendan priorizar **respaldo, segmentación y recuperación** antes que confiar
> solo en prevención. El ransomware sigue creciendo.

**Auditar:** backups offline · immutable backup · recovery · snapshots · restore · **pruebas reales** ·
tiempo de recuperación · RPO · RTO · segmentación · aislamiento.

**Checklist:**
- [ ] Regla 3-2-1: 3 copias, 2 medios, 1 offline/inmutable fuera del VPS
- [ ] Backups inmutables (no borrables por un atacante con acceso al VPS)
- [ ] Prueba de restore end-to-end programada (no basta con tener el backup)
- [ ] Medir RPO (cuántos datos se pierden) y RTO (cuánto tarda volver) reales
- [ ] Segmentar: la DB no debe ser alcanzable desde toda la red; egress controlado
- [ ] Plan de recuperación documentado y enlazado a [[security/incident-response]]

---

## Fase 14 — Ingeniería Social
> Los ataques potenciados por IA hacen la ingeniería social más convincente y difícil de detectar.

**Auditar:** phishing · vishing · smishing · QRishing · deepfake · CEO fraud · BEC · voz IA · video IA ·
simulación a empleados.

**Vectores DAIMUZ:** BEC contra el dueño para autorizar cambios de precio/pagos; deepfake de voz al
soporte; smishing suplantando la marca de la tienda; QR malicioso en el flujo de menú/eventos.

**Checklist:**
- [ ] Campaña de phishing simulado a empleados + medición de clics
- [ ] Verificación fuera de banda para acciones sensibles (pagos, cambios masivos) — enlaza [[governance/approval-policy]]
- [ ] Concientización sobre deepfake de voz/video y BEC
- [ ] Procedimiento de reporte de intentos de phishing

---

## Fase 15 — Monitoreo
**Auditar:** SIEM · logs · alertas · auditoría · correlación · anomalías · UEBA · detección con IA ·
**mapeo MITRE**.

**En DAIMUZ:** ya existe `audit_log` (acciones PII, `ChatAction` del agente). Falta centralizar en un
SIEM y correlacionar.

**Checklist:**
- [ ] Centralizar logs (app, Traefik, MySQL, Docker, host) en un SIEM (Wazuh/Elastic/Splunk)
- [ ] Alertas sobre eventos clave: login anómalo, export masivo de PII, cambios de rol, fallas de authz
- [ ] Correlación + UEBA para detectar comportamiento anómalo de usuarios/insiders
- [ ] Cada alerta mapeada a su técnica MITRE ATT&CK (ver [[security/threat-model-2026]])
- [ ] Integridad de logs (a prueba de manipulación; detectar "Impair Defenses")

---

## Fase 16 — Red Team
**Auditar:** pentesting · caja negra/gris/blanca · ataques internos y externos · persistencia ·
lateral movement · exfiltración · simulación de ransomware · **MITRE ATT&CK**.

**Checklist:**
- [ ] Pentest externo (caja negra) contra storefront/API/Traefik
- [ ] Pentest autenticado (caja gris) por rol: cliente, cajero, comerciante
- [ ] Revisión de código/config (caja blanca) de auth, tenant isolation, agente IA
- [ ] Cadena de ataque completa: acceso inicial → persistencia → lateral → exfiltración
- [ ] Simulacro de ransomware controlado para validar Fase 13
- [ ] Reportar cada hallazgo mapeado a ATT&CK y priorizado por impacto

---

## Fase 17 — Blue Team
Documento propio: [[security/incident-response]]. Detección · respuesta · contención · erradicación ·
recuperación · lecciones aprendidas · playbooks · SOAR. KPIs en [[security/kpis]].

---

## Nivel de Madurez

Para una plataforma empresarial como DAIMUZ (marketplace, POS, pagos, wallets, IA, APIs,
multi-tenant) el objetivo es **auditoría continua**: cada despliegue pasa automáticamente por
SAST, DAST, escaneo de dependencias, revisión de configuración de infraestructura, pruebas de
penetración periódicas y monitoreo en tiempo real. Esto reduce la ventana entre el descubrimiento
de una vulnerabilidad y su mitigación — crítico porque los tiempos de explotación siguen acortándose
(hoy en horas). Roadmap de adopción por olas: [[context/plan-auditoria-seguridad-2026]].

```
Nivel 1 — Reactivo:     se audita tras un incidente
Nivel 2 — Periódico:    pentest anual + escaneos manuales
Nivel 3 — Integrado:    SAST/DAST/deps en CI, alertas básicas
Nivel 4 — Continuo:     cada deploy escaneado + SIEM + red/blue team   ← OBJETIVO DAIMUZ
Nivel 5 — Adaptativo:   respuesta automatizada (SOAR) + threat hunting proactivo
```

---

← [[security/asset-inventory]] | [[security/README]] | → [[security/kpis]]
