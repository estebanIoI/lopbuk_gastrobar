# ✅ Política de Aprobación (v4)

> Qué puede hacer un agente/chat solo, y qué exige confirmación humana.

## Requiere SIEMPRE aprobación humana
- Deploy a producción.
- Migraciones destructivas / cambios de schema.
- Cambios en auth, permisos o tenant isolation.
- Cambios en facturación, pagos o planes.
- Borrado de datos reales (incluso soft delete masivo).
- Eliminación de archivos.

## DAIMUZ Chat — Modo ControlChat
El ControlChat actúa sobre el negocio del comerciante. Clasificación:

| Acción | Autonomía |
|---|---|
| Consultar (ventas, stock, pedidos) | ✅ libre |
| Crear/editar producto, publicar oferta/banner, editar tienda | ✅ libre (dentro del tenant) |
| Activar/desactivar un módulo | ⚠️ confirmar con el comerciante |
| Borrar productos/publicaciones en masa, cambios de precio masivos | ⚠️ confirmar |
| Cualquier cosa con pagos, plan o datos de otros tenants | ⛔ prohibido / no aplica |

Toda acción del ControlChat se **audita** (`ChatAction`). Nunca cruza el `tenant`.

← [[governance/universal-constraints]] | [[brain/daimuz-chat]]
