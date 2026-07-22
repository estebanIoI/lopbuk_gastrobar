# 🗓️ Plan de Ejecución — Auditoría de Seguridad 2026

> Roadmap para llevar DAIMUZ a **auditoría continua** (Nivel 4). No se hace todo de golpe:
> se ejecuta por olas, priorizando por riesgo e impacto. Marco completo: [[security/README]].
> Estado: 📋 Planeado · Fecha de creación: 2026-07-22.

---

## Principio de priorización

Primero lo que combina **mayor impacto** (identidad, tenant, IA, pagos, secretos) con **menor
esfuerzo** de arranque. Cada hallazgo → tarea ([[tasks/task-template]]) → riesgo residual en [[security/kpis]].

---

## Ola 0 — Higiene inmediata (días)
> Bajo esfuerzo, corta las heridas que más sangran (riesgos 2026 #5, #6, #7).
> 🔎 **Hallazgos de la primera pasada (2026-07-22): [[security/findings/ola-0-2026-07-22]]**

- [x] Integrar **GitLeaks** en el pipeline — `.github/workflows/security.yml` + `.gitleaks.toml` (falta commitear/correr)
- [ ] Auditar el **historial de git** por secretos (runbook en el doc de hallazgos)
- [ ] **Nmap** externo al VPS: confirmar que MySQL/Redis/Traefik-dashboard NO están expuestos (runbook)
- [x] `npm audit` + **Dependabot** — `.github/dependabot.yml` + job `deps-audit` (falta commitear)
- [x] **Trivy** — job `trivy-fs` en el workflow
- [ ] Verificar backups: ¿existen, offline/inmutables, restaurables? (runbook — base de Fase 13)
- [x] Confirmar cookies `HttpOnly + Secure + SameSite` — ✅ **correcto en código**
- [ ] ⚠️ **F1** (alto): `/auth/register` público con `role`/`tenant` del body — decidir fix
- [ ] ⚠️ **F2** (alto): fallback público de `JWT_SECRET` — fail-closed en prod

## Ola 1 — Identidad y acceso (Fases 3, 4)
> Riesgos #1, #4, #10. 🔎 **En curso — hallazgos y fixes: [[security/findings/ola-1-2026-07-22]]**

- [x] Auditar `auth.middleware.ts`: firma JWT, rechazo de `alg:none` → **F5 aplicado** (`algorithms:['HS256']`)
- [x] Rate limit + lockout en `/auth/login` → presente; **F3 pendiente** (mover a Redis + IP)
- [ ] Barrido de **IDOR/BOLA** en endpoints de alto riesgo (payments, orders, customers, events)
- [x] `tenant_id` del JWT + mass assignment → **F1 aplicado** (register ya no acepta role=superadmin ni tenantId del body)
- [x] Fail-closed de secretos en prod → **F2 aplicado** (`env.ts`)
- [x] bcrypt cost 10 → 12 → **F4 aplicado**
- [ ] Rediseño de `/auth/register` (staff autenticado + signup público server-side) — requiere confirmar UX
- [ ] Roadmap **2FA/passkeys** para dueño y superadmin

## Ola 2 — IA y APIs (Fases 6, 7)
> Riesgo #8 (la auditoría estrella de 2026) y #4.

- [ ] Batería de **prompt injection** (directo e indirecto) contra el agente
- [ ] Probar **function calling abuse** y cruce de tenant (debe fallar)
- [ ] Confirmar guard: **cero PII al contexto RAG**
- [ ] Inventario de endpoints vs código → cazar **Shadow APIs**
- [ ] Firma + idempotencia + anti-replay en webhooks (Wompi/Stripe/WhatsApp)

## Ola 3 — Infra, DevSecOps y datos (Fases 9, 10, 11, 12)
> Riesgos #5, #6, #7, #9.

- [ ] SAST (Semgrep/SonarQube) + DAST (ZAP) en CI
- [ ] Escaneo de IaC y contenedores en cada deploy
- [ ] Endurecer Docker (sin privileged), SSH (solo clave + fail2ban), TLS moderno
- [ ] Rotación de secretos; evaluar HashiCorp **Vault**
- [ ] Cerrar DPAs pendientes (Wompi, Cloudinary, Evolution API, MercadoPago, ADDI, Sistecrédito)

## Ola 4 — Resiliencia (Fase 13, 14)
> Riesgos #2, #3.

- [ ] Backups 3-2-1 con copia inmutable; **prueba de restore real**; medir RPO/RTO
- [ ] Segmentación de red (DB no alcanzable desde toda la red)
- [ ] Campaña de **phishing simulado** a empleados; verificación fuera de banda para pagos/cambios masivos

## Ola 5 — Detección y continuo (Fases 15, 16, 17)
> Riesgo #9; consolidar Nivel 4.

- [ ] Centralizar logs en **SIEM** (Wazuh/Elastic); alertas clave + mapeo MITRE
- [ ] Primer **pentest** (caja negra + gris por rol)
- [ ] Playbooks del Blue Team probados ([[security/incident-response]])
- [ ] Cada deploy pasa automáticamente por los escaneos → **auditoría continua alcanzada**

---

## Cómo se mide el avance
Panel de [[security/kpis]]: críticas abiertas, cobertura MFA/cifrado/backups, MTTD/MTTR, dependencias
vulnerables, riesgo residual por módulo. Se revisa al cerrar cada ola.

---

← [[context/pending]] | [[DAIMUZ]] | → [[security/README]]
