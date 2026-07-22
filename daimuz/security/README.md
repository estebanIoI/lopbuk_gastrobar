# 🛡️ Seguridad — Núcleo Defensivo de DAIMUZ

> La región del cerebro que hace a DAIMUZ **un duro en seguridad de datos**.
> Basado en OWASP Top 10 (2021 + LLM 2025 + API 2023), MITRE ATT&CK, NIST CSF 2.0
> e ISO/IEC 27001. Todo aterrizado en el stack y los módulos **reales** de esta plataforma.
> Punto de entrada de seguridad. Toda pregunta de seguridad empieza aquí.

---

## 🎯 Objetivo

Evaluar y endurecer la plataforma de forma **continua** para garantizar:

| Propiedad | Qué protege |
|---|---|
| **Integridad** | Los datos no se alteran sin autorización (ventas inmutables, congelación de precios, kardex) |
| **Confidencialidad** | Aislamiento de tenant, PII, tokens y secretos nunca se filtran |
| **Disponibilidad** | El negocio sigue operando ante fallo, DoS o ransomware |
| **Resistencia** | La plataforma aguanta ataques modernos potenciados por IA |
| **Tiempo de detección (MTTD)** | Cuánto tarda en verse un ataque |
| **Tiempo de recuperación (RTO/MTTR)** | Cuánto tarda en volver a la normalidad |
| **Riesgo financiero / legal / reputacional** | Multas (Ley 1581), fraude en pagos, pérdida de confianza |

DAIMUZ integra **marketplace, POS, pagos, wallets, IA con agentes, APIs y arquitectura
multi-tenant** → el nivel objetivo es **auditoría continua**: cada despliegue pasa por
SAST, DAST, escaneo de dependencias, revisión de IaC y monitoreo en tiempo real.
Ver [[security/audit-plan#nivel-de-madurez]].

---

## 🗺️ Mapa de la región

| Neurona | Contenido |
|---|---|
| [[security/compressed]] | ⚡ Triage rápido: 10 líneas, el mínimo que todo agente debe saber |
| [[security/threat-model-2026]] | 🎯 Panorama de amenazas 2026 + 10 riesgos prioritarios + mapeo MITRE ATT&CK a DAIMUZ |
| [[security/asset-inventory]] | 📦 Fase 1: inventario completo de activos (infra, apps, datos, secretos) real |
| [[security/audit-plan]] | 🔬 Las 17 fases de auditoría, cada una aterrizada en módulos reales + checklist |
| [[security/kpis]] | 📊 Indicadores: MTTD, MTTR, RTO, RPO, cobertura MFA/cifrado/backups, riesgo residual |
| [[security/tools]] | 🧰 Herramientas recomendadas y dónde encaja cada una en el pipeline |
| [[security/incident-response]] | 🚑 Blue Team: detección → contención → erradicación → recuperación → SOAR |

**Gobierno y ejecución:**

| Nodo | Para qué |
|---|---|
| [[governance/security-policy]] | 🔒 Reglas de seguridad que NUNCA se rompen (tenant isolation, auth, PII, chat que actúa) |
| [[governance/universal-constraints]] | 🔒 Restricciones universales (multi-tenancy, soft-delete, PII Ley 1581) |
| [[agents/security-agent]] | 🕵️ El especialista de seguridad (red team / blue team / reviewer) |
| [[synapses/security-chain]] | 🕸️ Cómo la seguridad atraviesa TODOS los módulos |
| [[context/plan-auditoria-seguridad-2026]] | 🗓️ Roadmap de ejecución por olas (qué auditar primero) |
| [[security/findings/ola-0-2026-07-22]] | 🔎 Hallazgos ejecutados: Ola 0 (higiene) — 2026-07-22 |
| [[security/findings/ola-1-2026-07-22]] | 🔐 Hallazgos + fixes aplicados: Ola 1 (identidad/acceso) — 2026-07-22 |

---

## 🔥 Las 17 fases de un vistazo

| # | Fase | Superficie DAIMUZ | Detalle |
|---|---|---|---|
| 1 | Inventario de activos | VPS, Docker, Traefik, Redis, MySQL, Cloudinary, DNS, SSL | [[security/asset-inventory]] |
| 2 | Arquitectura | Monolito Express, gateway Traefik, RBAC, multi-tenant, Drizzle | [[security/audit-plan#fase-2]] |
| 3 | Autenticación | JWT httpOnly, Google OAuth, refresh, 2FA (gap) | [[security/audit-plan#fase-3]] |
| 4 | Permisos / acceso | `authorize()`, tenant isolation, IDOR, mass assignment | [[security/audit-plan#fase-4]] |
| 5 | Base de datos | MySQL2, Drizzle, SQLi, backups, integridad | [[security/audit-plan#fase-5]] |
| 6 | APIs | REST, WebSocket (Socket.io), webhooks, rate limit | [[security/audit-plan#fase-6]] |
| 7 | **IA / agentes** | `agent.rag.ts`, function calling, prompt injection, RAG poisoning | [[security/audit-plan#fase-7]] |
| 8 | Frontend | Next.js, XSS, CSRF, CSP, cookies, CORS | [[security/audit-plan#fase-8]] |
| 9 | Infraestructura | Docker escape, Traefik, TLS, SSH, fail2ban, CVEs | [[security/audit-plan#fase-9]] |
| 10 | DevSecOps | Pipeline, GitHub, SBOM, Dependabot, SAST/DAST/IaC | [[security/audit-plan#fase-10]] |
| 11 | Cloud | IAM, buckets, backups, Cloudflare, secrets | [[security/audit-plan#fase-11]] |
| 12 | Datos | AES-256, TLS, hash, tokenización, retención, borrado seguro | [[security/audit-plan#fase-12]] |
| 13 | Anti-ransomware | Backups inmutables/offline, RPO, RTO, segmentación | [[security/audit-plan#fase-13]] |
| 14 | Ingeniería social | Phishing, deepfake, BEC, voz IA, simulación empleados | [[security/audit-plan#fase-14]] |
| 15 | Monitoreo | SIEM, logs, UEBA, correlación, mapeo MITRE | [[security/audit-plan#fase-15]] |
| 16 | Red Team | Pentesting, lateral movement, exfiltración, MITRE ATT&CK | [[security/audit-plan#fase-16]] |
| 17 | Blue Team | Detección, respuesta, playbooks, SOAR, KPIs | [[security/incident-response]] |

---

## 🚨 Riesgos prioritarios 2026 (comunidad de ciberseguridad)

> Detalle y mapeo a DAIMUZ en [[security/threat-model-2026]].

1. Robo de credenciales e identidad
2. Phishing y deepfakes generados por IA
3. Ransomware automatizado
4. Compromiso de APIs
5. Vulnerabilidades en la cadena de suministro del software
6. Errores de configuración en la nube
7. Exposición de secretos y claves API
8. Ataques contra aplicaciones de IA (prompt injection, envenenamiento, abuso de agentes)
9. Explotación acelerada de vulnerabilidades críticas (horas, no semanas)
10. Amenazas internas y abuso de privilegios

---

## 🧭 Cómo usar esta región

- **"Voy a tocar auth / tenant / pagos"** → lee [[governance/security-policy]] + [[security/audit-plan#fase-3]] + [[security/audit-plan#fase-4]] antes.
- **"Voy a tocar el agente IA"** → lee [[security/audit-plan#fase-7]] (prompt injection, RAG poisoning, function calling abuse). **Obligatorio.**
- **"Quiero endurecer el despliegue"** → [[security/audit-plan#fase-9]] + [[security/audit-plan#fase-11]].
- **"Hubo un incidente"** → [[security/incident-response]].
- **"¿Cómo vamos en seguridad?"** → [[security/kpis]].

---

*🛡️ Región Seguridad v1.0 — 17 fases · 10 riesgos 2026 · alineada a OWASP · MITRE ATT&CK · NIST CSF 2.0 · ISO 27001*

← [[DAIMUZ]] | → [[security/audit-plan]]
