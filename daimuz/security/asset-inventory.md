# 📦 Fase 1 — Inventario de Activos

> No se puede proteger lo que no se conoce. Auditar **absolutamente todo**.
> Este inventario se mantiene vivo: cada activo nuevo (servicio, secreto, integración)
> se registra aquí. Fuente cruzada: [[architecture/deployment]], [[context/environment]],
> [[vault/integrations]], [[vault/stack/tech-stack]].

---

## 🏗️ Infraestructura

| Activo | En DAIMUZ | Clasificación | Riesgo clave |
|---|---|---|---|
| **VPS** | Host de todo el stack (Docker) | 🔴 Crítico | Compromiso total, ransomware |
| **Docker** | `docker-compose.*.yml` (dev/db/client/stack/dokploy) | 🔴 Crítico | Escape de contenedor, contenedor privilegiado |
| **Traefik** | Reverse proxy / TLS / routing | 🔴 Crítico | Dashboard expuesto, mala config TLS |
| **Redis** | Cache / colas | 🟠 Alto | Puerto expuesto, sin auth, datos en claro |
| **MySQL** | Base multi-tenant (203 tablas) | 🔴 Crítico | SQLi, root expuesto, fuga cross-tenant |
| **Backups** | Dumps/volúmenes de MySQL | 🔴 Crítico | Backups accesibles = ransomware efectivo |
| **CDN / Cloudflare** | Frente de red, DNS | 🟠 Alto | DDoS, misconfig, bypass de origen |
| **Cloudinary** | Media (productos, logos) | 🟡 Medio | Bucket público, PII en imágenes |
| **DNS** | Dominios de tenants/tienda | 🟠 Alto | Hijack, subdominios colgados |
| **SSL/TLS** | Certificados (Traefik/Let's Encrypt) | 🟠 Alto | Expiración, protocolos débiles |
| **Firewall / puertos** | Reglas del VPS | 🔴 Crítico | Puertos de DB/Redis expuestos |

> ⚠️ **Regla de oro:** MySQL y Redis **nunca** deben tener puertos accesibles desde
> Internet. Solo la red interna de Docker. Verificar en [[security/audit-plan#fase-9]].

---

## 🧩 Aplicaciones

| Capa | En DAIMUZ | Notas de seguridad |
|---|---|---|
| **Backend** | Monolito Express 4 + TS + MySQL2 + Socket.io + JWT | Lógica solo en `*.service.ts`; toda ruta con `verifyToken` + `authorize()` |
| **Frontend** | Next.js 16 · React 19 · Zustand | SSR + rutas públicas (storefront/menu/portfolio) |
| **App móvil / PWA** | Paneles mobile-first, scanner remoto | Sesión, deep links, QR de escáner |
| **APIs** | REST kebab-case + WebSocket (Socket.io) + webhooks | Ver [[indexes/endpoints-index]] · [[security/audit-plan#fase-6]] |
| **Panel Administrativo** | Dashboard, finanzas, superadmin | Rol elevado → auditar authz |
| **Marketplace** | Catálogo cross-comercio, proveedores N:N | Aislamiento por tenant en catálogo compartido |
| **POS** | Punto de venta + caja | `cash-sessions`, ventas inmutables |
| **Wallet** | Customer Engagement (Wallet, puntos) | Saldo = dato financiero, integridad transaccional |
| **IA / Agente** | `agent.service.ts`, `agent.rag.ts`, `agent.tools.ts` | Superficie crítica → [[security/audit-plan#fase-7]] |
| **Microservicios / jobs** | `retention.job.ts`, sync offline, automation-engine | Corren fuera del request → auditar sus permisos |

---

## 🗂️ Datos — Clasificación

| Nivel | Ejemplos en DAIMUZ | Dónde vive | Trato |
|---|---|---|---|
| **Públicos** | Catálogo de tienda, menú, portafolio | storefront, `/menu/[slug]` | Sin auth pero acotado por slug/tenant |
| **Internos** | Configuración de tenant, módulos activos | `tenant_modules` | Solo dentro del tenant |
| **Sensibles (PII)** | Nombre, cédula, teléfono, email, dirección, GPS, chats | `customers`, `orders`, `chatbot_messages` | Ley 1581: consentimiento + auditoría + retención |
| **Financieros** | Ventas, P&L, wallet, comisiones, liquidaciones | `sales`, `finances`, wallet | Inmutabilidad, integridad, no exponer en logs |
| **Biométricos** | (si se incorporan: face/QR check-in de eventos) | `events` check-in | Máxima sensibilidad, minimizar |

> Detalle de reglas PII: [[governance/universal-constraints]] § Protección de Datos y
> [[modules/privacy/privacy]]. **Datos de tarjeta NUNCA se almacenan** (los procesa la pasarela).

---

## 🔑 Secretos y Tokens (joyas de la corona)

| Secreto | Uso | Riesgo si se filtra | Rotación |
|---|---|---|---|
| **JWT secret** | Firma de todos los tokens | Falsificación de identidad total | Tras cualquier sospecha |
| **JWT / Refresh token** | Sesión de usuario | Session hijacking | Expiración + rotación |
| **API keys** | Integraciones internas | Acceso no autorizado | Periódica |
| **Gemini / OpenAI** | Agente IA | Costo + fuga de prompts | Periódica + límites de gasto |
| **SMTP** | Correo transaccional | Spam/phishing desde el dominio | Tras exposición |
| **OAuth (Google/Facebook)** | Login social | Suplantación de login | Según proveedor |
| **Wompi / MercadoPago / ADDI / Sistecrédito** | Pagos | Fraude financiero | Según pasarela + webhooks firmados |
| **Google Wallet / Apple Wallet** | Passes/wallet | Emisión fraudulenta de passes | Según proveedor |
| **Evolution API (WhatsApp)** | Mensajería | Secuestro del canal WhatsApp | Auditar despliegue self-hosted |

> **Reglas:** ningún secreto en git (GitLeaks en pipeline), ninguno en logs, ninguno en el
> bundle del frontend. `.env` (2.2 KB) fuera del repo. Gestión centralizada objetivo: HashiCorp Vault.
> Ver [[security/audit-plan#fase-10]] y [[security/audit-plan#fase-12]].

---

## ✅ Checklist Fase 1

- [ ] Diagrama de red actualizado (VPS, contenedores, puertos, egress)
- [ ] Lista de todos los contenedores Docker y sus volúmenes
- [ ] Inventario de todos los endpoints (cotejar con [[indexes/endpoints-index]]) — detectar **Shadow APIs**
- [ ] Inventario de todas las tablas y su clasificación de datos (cotejar [[indexes/db-tables-index]])
- [ ] Registro de todos los secretos y su ubicación (¿alguno en git/logs?)
- [ ] Lista de integraciones externas y su DPA (cotejar [[governance/security-policy]] § procesadores)
- [ ] Certificados SSL y sus fechas de expiración
- [ ] Registro de dominios/subdominios (detectar colgados)

---

← [[security/threat-model-2026]] | → [[security/audit-plan]]
