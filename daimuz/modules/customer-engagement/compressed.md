# Customer Engagement Platform — Resumen rápido

| Aspecto | Detalle |
|---|---|
| Objetivo | Retención automática de clientes para comercios locales |
| Canales | Google Wallet (P1), Push, WhatsApp, In-App, Email (F4) |
| DB | 9 tablas (4 extendidas + 5 nuevas). Migraciones 0048-0049. |
| Módulo backend | `backend/src/modules/customer-engagement/` (7 archivos) |
| Endpoints | 2 público, 7 cliente, 13 admin = **22 total** |
| Event Bus | 6 eventos: points_earned, level_up, sale_completed, geo_enter, redemption, pass_installed |
| Automation Engine | 5 trigger evaluators + 4 action executors (desacoplado, extensible) |
| Customer 360° | Panel lateral con 8 secciones: Resumen, Timeline, Compras, Wallet, Recompensas, Segments, Predicción IA, Notas |
| AI Insights | 4 tipos: churn risk, near level, best day, wallet adoption |
| Niveles | Bronze → Silver → Gold → Platinum (visitas + gasto) |
| Streaks | Rachas con milestones: 3/5/7/10/15/30 días → bonus puntos |
| Geo push | GPS navegador + Haversine (sin servicios externos) |
| Frontend | Landing /wallet/[slug] + Panel 8 tabs + Customer360 + LiveFeed + AIInsights |
