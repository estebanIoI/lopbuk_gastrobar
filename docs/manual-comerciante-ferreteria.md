# 📘 Manual del Comerciante — Ferretería

**Guía completa para sacarle el máximo provecho a Lopbuk en tu ferretería multi‑sede.**

> Documento de soporte. Está pensado para el dueño/gerente y sus encargados. Puedes leerlo de corrido la primera vez y luego usarlo como referencia por módulo.

---

## Índice

1. [Qué es Lopbuk y cómo piensa tu ferretería](#1-qué-es-lopbuk-y-cómo-piensa-tu-ferretería)
2. [Antes de empezar: conceptos clave](#2-antes-de-empezar-conceptos-clave)
3. [Puesta en marcha (orden recomendado)](#3-puesta-en-marcha-orden-recomendado)
4. [Sedes y bodegas (multibodega)](#4-sedes-y-bodegas-multibodega)
5. [Inventario](#5-inventario)
6. [Compras y recepción de mercancía](#6-compras-y-recepción-de-mercancía)
7. [Punto de Venta (POS)](#7-punto-de-venta-pos)
8. [Cotizaciones (el proyecto del cliente)](#8-cotizaciones-el-proyecto-del-cliente)
9. [Caja, Facturación y Fiados](#9-caja-facturación-y-fiados)
10. [Picking de bodega](#10-picking-de-bodega)
11. [Despacho y flota (Centro de Comando)](#11-despacho-y-flota-centro-de-comando)
12. [El conductor y el seguimiento del cliente](#12-el-conductor-y-el-seguimiento-del-cliente)
13. [Tiempos de operación (cuellos de botella)](#13-tiempos-de-operación-cuellos-de-botella)
14. [Empleados y Jerarquía](#14-empleados-y-jerarquía)
15. [Gerencia (tu pantalla de la mañana)](#15-gerencia-tu-pantalla-de-la-mañana)
16. [Clientes y tienda online](#16-clientes-y-tienda-online)
17. [Rutinas recomendadas (diaria / semanal / mensual)](#17-rutinas-recomendadas)
18. [10 claves para el máximo potencial](#18-10-claves-para-el-máximo-potencial)
19. [Preguntas frecuentes y soporte](#19-preguntas-frecuentes-y-soporte)
20. [Glosario](#20-glosario)

---

## 1. Qué es Lopbuk y cómo piensa tu ferretería

Lopbuk es tu **sistema operativo de negocio**: vende, controla inventario en varias bodegas, prepara y despacha pedidos, mide a tu gente y te da una sola pantalla para decidir.

Está construido alrededor del flujo real de una ferretería de proyectos:

```
El cliente llega
   ↓
Cotiza su obra  ──o──  compra directo
   ↓
Se reserva el material (no se vende dos veces)
   ↓
Bodega prepara el pedido (picking) guiada por ubicaciones
   ↓
Se agrupa en una ruta y se carga al vehículo
   ↓
Sale a ruta → el cliente sigue su pedido en vivo
   ↓
Se entrega con foto y firma → todo queda medido
```

Cada paso deja datos, y esos datos llegan a tu pantalla de **Gerencia** para que sepas *dónde se gana y dónde se pierde* — con números, no con intuición.

---

## 2. Antes de empezar: conceptos clave

Entender estas 5 ideas hace que todo lo demás encaje:

| Concepto | Qué significa en tu ferretería |
|---|---|
| **Sede / Bodega** | Cada punto físico: el punto de venta del centro, la sala de cerámica, la bodega de cemento, la de tejas/ladrillos, la bodega principal. Cada una puede ser *punto de venta*, *bodega* o *mixta*. |
| **Stock total vs. stock por sede** | El producto tiene un **total** (todo lo que tienes) y un **desglose por sede** (cuánto hay en cada bodega). Vender o transferir mueve el desglose; el total solo cambia con compras, ventas o mermas. |
| **Reserva** | Cuando aceptas una cotización, el material queda **apartado**: nadie más lo puede vender ni transferir. Se libera al facturar o al cancelar. |
| **Etapas del pedido** | `Confirmado → En picking → Preparado → Cargado → Despachado → Entregado`. El sistema cronometra cada una para mostrarte los cuellos de botella. |
| **Roles** | Cada empleado ve solo lo suyo: el vendedor vende, el auxiliar prepara, el conductor entrega, el despachador organiza, y tú (comerciante) lo ves todo. |

> 💡 **Regla de oro:** entre más fiel sea la información que cargas (stock real por bodega, ubicaciones, mínimos, sedes de cada empleado), más potente se vuelve el sistema. Basura entra → basura sale.

---

## 3. Puesta en marcha (orden recomendado)

Haz esto **una sola vez**, en este orden, y el resto del sistema "cobra vida". Cada paso habilita al siguiente.

### Paso 1 — Crea tus sedes
`Inventario → botón "Sedes"` → **Agregar sede**.
Crea una por cada punto físico. Marca su **tipo**:
- **Punto de venta** — atiende público (Centro, Cerámica).
- **Bodega** — almacena y despacha (Cemento, Tejas/Ladrillos).
- **Mixta** — vende y almacena (Bodega Principal).

Asigna un **encargado** y un **teléfono** a cada una.

### Paso 2 — Crea cargos y empleados
`Empleados → Configuración` (o `Configuración → Cargos / Crear Empleado`).
1. Crea los **cargos** de tu empresa (Cajero, Auxiliar de bodega, Despachador, Conductor, Vendedor…).
2. Crea cada **empleado** con su rol del sistema y su cargo.
3. En **Jerarquía**, abre la ficha de cada empleado y asígnale la **sede** a la que pertenece y a quién le reporta.

> ⚠️ Asignar la sede al empleado es importante: cuando el vendedor haga una venta sin elegir sede, el sistema descuenta de **su** bodega automáticamente.

### Paso 3 — Carga tu inventario
`Inventario → Agregar producto` (o **Carga masiva** si tienes muchos).
Para cada producto define: nombre, categoría, precio de venta, precio de compra y **punto de reorden**.

### Paso 4 — Distribuye el stock por bodega
`Inventario → botón "Bodegas" → pestaña "Stock por sede"`.
Haz clic en la celda de cada producto/sede y escribe cuántas unidades hay **físicamente** allí. Aprovecha para escribir la **ubicación** (ej. `P3-B1-N2` = pasillo 3, bloque 1, nivel 2) y el **mínimo** de esa bodega.

### Paso 5 — Registra tu flota (si despachas)
`Mi Flota → Agregar vehículo`. Carga placa, capacidad (kg), y en el **perfil del vehículo**: SOAT, tecnomecánica, seguro, odómetro y la regla de mantenimiento (cada X km o próxima fecha de servicio).

### Paso 6 — Conecta WhatsApp (opcional pero muy recomendado)
`Configuración → WhatsApp`. Con esto el sistema envía cotizaciones, avisos de "tu pedido salió" y el link de seguimiento **automáticamente** al cliente.

✅ **Con estos 6 pasos ya tienes la base.** Todo lo demás es operación del día a día.

---

## 4. Sedes y bodegas (multibodega)

**Para qué sirve:** que sepas al instante qué hay en cada bodega sin llamar por teléfono, y que puedas mover mercancía entre puntos con control total.

### Ver el stock de todas las bodegas
`Inventario → Bodegas → pestaña "Stock por sede"`.
Es una tabla: cada fila un producto, cada columna una sede. Ves el total, cuánto hay en cada bodega y cuánto está **"Sin asignar"** (total menos lo distribuido).

- **Distribuir stock:** clic en una celda → escribe la cantidad y la **ubicación** física.
- **Alerta de stock bajo:** si un producto queda por debajo de su mínimo en una bodega, aparece un **aviso ámbar** arriba; si hay stock en otra sede, te sugiere transferir (`↔`).

### Transferir entre bodegas
`Inventario → Bodegas → pestaña "Transferencias" → Nueva transferencia`.
1. Elige **origen** y **destino**.
2. Agrega productos (solo te deja elegir lo que hay físicamente en el origen).
3. La transferencia pasa por: **Solicitada → En tránsito** (sale del origen) **→ Recibida** (entra al destino). Cancelar en tránsito devuelve la mercancía.

Todo queda auditado: quién la pidió, quién la envió y quién la recibió.

> 💡 **Caso típico:** el vendedor del Centro vende cerámica que no está allí pero sí en la Bodega Principal. En el POS, el icono 🏭 junto al stock te muestra en qué bodega está para despachar desde allá.

---

## 5. Inventario

**Para qué sirve:** el corazón del negocio. Todo lo demás (ventas, cotizaciones, picking) sale de aquí.

- **Agregar / editar producto:** nombre, categoría, marca, precios, punto de reorden, imágenes.
- **Categorías y Hormas:** botones dedicados para organizar tu catálogo.
- **Carga masiva:** para subir muchos productos de una vez (o desde imágenes con el asistente de Cloudinary).
- **Filtro por sede:** cuando tienes 2+ sedes, arriba aparece un selector para ver el inventario de una bodega específica.
- **Botón "Bodegas":** stock por sede + transferencias (ver sección 4).

> 💡 **Máximo potencial:** mantén el **punto de reorden** actualizado en cada producto. Eso alimenta la *sugerencia de compra* del dashboard de Gerencia, que te dice qué pedir antes de que se agote.

---

## 6. Compras y recepción de mercancía

**Para qué sirve:** registrar lo que le compras a tus proveedores y **medir cuánto tardas en descargar y almacenar**.

### Registrar una compra
`Compras → Nueva compra/factura`. Elige proveedor, agrega productos con su costo y guarda. Esto sube el stock total.

### Recepción medida (llegada → almacenado)
`Tiempos Operación → sección "Recepción de mercancía"`.
Verás tus compras recientes. Cuando llega el camión del proveedor:
1. Botón **"Llegó"** → elige la **bodega destino** (arranca el cronómetro).
2. Cuando terminan de descargar y guardar → botón **"Almacenada"**.

Al marcar "Almacenada", **el stock de esa compra entra automáticamente a la bodega destino** (a su desglose por sede). Y el sistema calcula el **tiempo de recepción promedio por proveedor** — así detectas qué proveedor te hace perder tiempo en la bodega.

---

## 7. Punto de Venta (POS)

**Para qué sirve:** vender rápido en el mostrador.

- Busca por nombre, SKU o código de barras (o usa el escáner / escáner remoto con el celular).
- Toca el producto para agregarlo; ajusta cantidades en el carrito.
- **Filtro por sede:** si tienes varias, elige la sede activa; la venta descontará de **esa** bodega.
- **🏭 ¿Dónde hay stock?:** el icono junto al stock de cada producto muestra en qué sedes está disponible — ideal cuando no hay en tu punto pero sí en otra bodega.
- **Cobro:** efectivo, tarjeta, transferencia, mixto o **fiado** (a crédito, requiere cliente).
- Al cerrar la venta se descuenta el stock total **y** el de la sede, se registra en caja y queda en el historial.

> 💡 Si el vendedor tiene sede asignada (sección 3), no tiene que elegirla: el sistema usa la suya.

---

## 8. Cotizaciones (el proyecto del cliente)

**Para qué sirve:** el flujo estrella de la ferretería — "el cliente cotiza su obra". Convierte una cotización en venta con un clic y **aparta el material** mientras el cliente decide.

### Crear una cotización
`Cotizaciones → Nueva cotización`.
1. Datos del cliente (nombre + teléfono para WhatsApp).
2. Busca y agrega productos; puedes **negociar el precio por línea**.
3. Define **validez** (por defecto 15 días), **promesa de entrega** y la **sede que despacha**.
4. Guarda como **borrador** o **guarda y envía**.

### Ciclo de vida
```
Borrador → Enviada (WhatsApp) → Aceptada (reserva stock) → Facturada (venta real)
                                        ↘ Cancelada / Vencida (libera la reserva)
```

- **Enviar por WhatsApp:** manda al cliente el resumen (productos, total, validez, fecha de entrega).
- **Aceptar:** aparta el material en la bodega elegida. Nadie más lo puede vender ni transferir.
- **Facturar (1 clic):** elige método de pago y se crea la venta real (libera la reserva y descuenta inventario). Queda enlazada con su número de factura.
- **Imprimir:** vista lista para entregar en papel.

### KPIs arriba del módulo
- **% de conversión** cotización → venta (¿cuántas de las que cotizo terminan en venta?).
- **Valor facturado** desde cotizaciones y **pipeline abierto** (lo que tienes cotizado con material reservado).

> 💡 **Máximo potencial:** cotiza SIEMPRE en el sistema, aunque sea rápido. La tasa de conversión te dice si tus precios/tiempos están cerrando negocios o espantándolos.

---

## 9. Caja, Facturación y Fiados

- **Caja** (`Caja`): abre turno al empezar el día, registra ingresos/egresos de efectivo y ciérralo al final para cuadrar. Cada venta en efectivo cae aquí.
- **Facturación** (`Facturación`): historial de facturas; activa IVA / factura electrónica cuando aplique.
- **Fiados / Crédito** (`Fiados`): controla lo que te deben. Las ventas a crédito exigen cliente registrado, con fecha de vencimiento. Haz seguimiento de saldos y abonos.

> 💡 Cierra la caja **todos los días**. Es la forma más simple de detectar faltantes a tiempo.

---

## 10. Picking de bodega

**Para qué sirve:** que el pedido esté **preparado antes de que llegue el camión** — se acabaron los tiempos muertos esperando a que busquen el material.

`Picking Bodega`. Tablero de 3 columnas: **Pendientes → En preparación → Preparadas hoy**.

### Flujo
1. **Generar desde pedidos** (botón): crea una tarea por cada pedido confirmado que aún no la tenga.
2. El **auxiliar toma** una tarea (queda a su nombre y arranca el cronómetro).
3. La tarjeta muestra los productos **ordenados por ubicación** = la ruta de recorrido dentro de la bodega (no zigzaguea buscando).
4. Al terminar → **"Preparado ✓"**. El pedido avanza solo a "preparando" y aparece listo para cargar en el Centro de Comando.

### Productividad del equipo
Al pie del tablero: ranking de auxiliares con **tareas completadas** y **tiempo promedio**. También lo ves en la ficha de cada persona en Jerarquía.

> 💡 Para que el recorrido sea óptimo, carga las **ubicaciones** de tus productos (sección 4). Sin ubicación, el auxiliar igual prepara, pero pierde tiempo buscando.

---

## 11. Despacho y flota (Centro de Comando)

**Para qué sirve:** organizar todos los despachos del día en una sola pantalla y sacarle el máximo a cada vehículo (no un camión por factura).

`Mi Flota` (o el panel del despachador). Vista **Comando**:
- **Indicadores** arriba: pendientes, en ruta, retrasados, vehículos disponibles, capacidad usada.
- **Tablero kanban** con semáforo de espera; arrastra pedidos entre estados.
- **Rutas agrupadas:** junta varios pedidos de la misma zona en una ruta, respetando la **capacidad (kg)** del vehículo. El sistema **sugiere** el vehículo adecuado y cuántos auxiliares llevar.
- **Estados de la ruta:** `Planificada → Cargando → En ruta → Retornando → Cerrada`. Al salir a ruta, el cliente recibe su WhatsApp automáticamente.

### Perfil del vehículo y mantenimiento preventivo
En cada vehículo: SOAT, tecnomecánica, seguro, odómetro y gastos reales (combustible, peajes, repuestos que reporta el conductor).
- **Mantenimiento preventivo:** define "cada X km" o una "próxima fecha de servicio". El sistema te **avisa** cuando se acerca o se vence, y con **"Servicio hecho"** reinicia el contador.
- **Analítica de flota:** facturación movilizada, costos reales y **utilidad por vehículo**, más ranking de conductores.

> 💡 **La plata está en agrupar.** Antes de despachar, revisa si hay varios pedidos para el mismo barrio y súbelos a la misma ruta. Cada ruta que agrupas es gasolina, conductor y desgaste que ahorras.

---

## 12. El conductor y el seguimiento del cliente

**Para qué sirve:** que el conductor entregue guiado y con prueba, y que el cliente vea su pedido en vivo sin llamarte.

### Panel del conductor (celular)
El conductor entra a su panel y ve sus pedidos asignados, ordenados por cercanía, con mapa.
- Su teléfono **reporta la posición** cada pocos minutos mientras va en ruta.
- Al entregar, marca **"Entregado"** y el sistema le pide la **prueba de entrega**: **foto** + **nombre de quién recibió**.

### Portal de seguimiento del cliente
Cuando el pedido sale a ruta, el cliente recibe por WhatsApp un **link de seguimiento** (`/seguimiento/...`). Ahí ve, **sin necesidad de iniciar sesión**:
- Barra de progreso del pedido.
- Posición aproximada del vehículo (con enlace al mapa) mientras va en camino.
- La prueba de entrega al final.

> 💡 Esto reduce drásticamente las llamadas de "¿dónde va mi pedido?" y proyecta una imagen profesional frente a la competencia.

---

## 13. Tiempos de operación (cuellos de botella)

**Para qué sirve:** saber **dónde se pierde el tiempo** entre que facturas y entregas — con datos.

`Tiempos Operación`.
- **Tiempo por etapa:** barras con los minutos promedio de picking, preparado, cargado, despachado y entregado. La etapa más lenta se resalta en **ámbar** como tu cuello de botella. Arriba, el **ciclo total** promedio.
- **Pedidos en riesgo:** lista de pedidos con promesa vencida (rojo) o próximos a incumplir, cada uno con su motivo y un botón para **avisar al cliente por WhatsApp**. Actúa **antes** de que reclamen.
- **Recepción de mercancía:** tablero accionable de compras + tiempo por proveedor (sección 6).

> 💡 Revisa esta pantalla una vez por semana. Si el cuello está en "picking", quizá falten ubicaciones o auxiliares; si está en "cargado→despachado", el problema es la disponibilidad del vehículo.

---

## 14. Empleados y Jerarquía

**Para qué sirve:** ver a todo tu equipo y controlar sueldo, comisión, productividad, vacaciones y novedades de cada persona en un solo lugar.

- **Empleados** (`Empleados`): configura salario base, tipo de comisión, meta mensual y bono. Da o bloquea acceso al sistema. Aquí aparecen **todos** los colaboradores, no solo vendedores.
- **Jerarquía** (`Jerarquía`): el organigrama de tu ferretería como un árbol. Toca la tarjeta de un colaborador y se abre su **expediente completo**:
  - Cargo, responsabilidades y permisos.
  - Compensación (salario, comisión, meta, bono).
  - **Ventas generadas** (histórico y del mes).
  - **Productividad en bodega** (picking).
  - Vacaciones, nómina, bonos/descuentos y novedades.
  - Vehículo asignado si va en ruta.
  - Selector para definir **a quién reporta** y su **sede**.

> 💡 Usa el expediente cuando evalúes a alguien: tienes ventas, tiempos de picking y novedades en una sola vista, con datos objetivos.

---

## 15. Gerencia (tu pantalla de la mañana)

**Para qué sirve:** la única pantalla que abres cada mañana para saber cómo va todo.

`Gerencia`. En un vistazo:
- **Ventas:** hoy / semana / mes, ticket promedio y **conversión de cotizaciones**.
- **Operación en vivo:** embudo de 6 pasos (pendientes → picking → preparados → cargando → en ruta → entregados hoy) + pedidos **en riesgo** + ciclo promedio.
- **Logística:** vehículos por estado, valor "en la calle", **costo logístico por entrega** y vehículos que **requieren servicio**.
- **Talento:** equipo activo y **top pickers** del día.
- **Inventario:** valor, agotados, bajos y **alerta de mínimos por sede**.
- **Sugerencia de compra:** según el consumo real de los últimos 30 días vs. tu stock, te dice **qué pedir y cuánto** antes de que se agote.
- **Mapa de calor de ventas:** qué **zonas/barrios** compran más — te sirve para planear rutas y decidir dónde abrir la próxima sede.

> 💡 Empieza el día aquí. Si algo está en rojo (riesgo, agotados, mantenimiento vencido), atácalo primero.

---

## 16. Clientes y tienda online

- **Clientes** (`Clientes`): tu CRM. Historial de compras, datos de contacto, exportar y (por ley de datos) borrado bajo solicitud.
- **Tienda / Pedidos online / Cupones / Reseñas** (si los activas): tu ferretería vendiendo por internet. Los pedidos online entran al mismo flujo de picking y despacho, y descuentan de la sede del pedido.
- **Chat vendedor (IA):** un asesor automático en tu tienda y WhatsApp que responde con stock real, arma pedidos y cierra ventas, con aviso de privacidad incluido.

---

## 17. Rutinas recomendadas

### 🗓️ Cada día
1. Abre **Gerencia** y revisa ventas, pedidos en riesgo y alertas.
2. Abre **caja** al iniciar y **ciérrala** al terminar.
3. En **Picking**, genera las tareas de los pedidos del día.
4. En **Centro de Comando**, agrupa pedidos por zona y despacha.
5. Atiende los **pedidos en riesgo** (Tiempos Operación) antes de que el cliente llame.

### 🗓️ Cada semana
1. Revisa **Tiempos de operación**: ¿dónde está el cuello de botella?
2. Revisa la **sugerencia de compra** y haz tus pedidos a proveedores.
3. Mira la **productividad de auxiliares y conductores**.
4. Revisa **transferencias** pendientes y stock bajo por sede.

### 🗓️ Cada mes
1. Revisa la **conversión de cotizaciones** y el **valor facturado**.
2. Revisa **rentabilidad por vehículo** y costo logístico por entrega.
3. Revisa **Finanzas** y **Análisis** para el panorama grande.
4. Verifica **documentos y mantenimiento** de la flota (SOAT/tecno/servicio).
5. Usa el **mapa de calor** para decisiones de zona/expansión.

---

## 18. 10 claves para el máximo potencial

1. **Carga el stock real por bodega**, no un total genérico. Todo el poder multibodega depende de esto.
2. **Pon ubicaciones** a tus productos (pasillo‑bloque‑nivel). El picking se vuelve el doble de rápido.
3. **Asigna sede a cada empleado.** Las ventas descuentan de la bodega correcta sin pensarlo.
4. **Cotiza todo en el sistema.** La tasa de conversión es oro para ajustar precios y tiempos.
5. **Acepta las cotizaciones** para reservar material — evita vender dos veces lo del proyecto de un cliente.
6. **Agrupa despachos por zona.** Es el ahorro de plata más grande y más fácil.
7. **Conecta WhatsApp.** Cotizaciones, avisos y seguimiento salen solos y elevan tu imagen.
8. **Mantén el punto de reorden y los mínimos por sede.** Alimentan las alertas y la sugerencia de compra.
9. **Registra la recepción de compras** (llegó / almacenada). Descubres qué proveedor te cuesta tiempo.
10. **Empieza cada día en Gerencia.** Decidir con datos en 2 minutos vale más que una hora de intuición.

---

## 19. Preguntas frecuentes y soporte

**¿Un producto aparece con stock pero el vendedor no lo encuentra?**
Revisa el desglose en `Inventario → Bodegas`: probablemente el stock está en otra sede. Transfiérelo o vende con despacho desde esa bodega.

**Creé un empleado y no aparece en Empleados.**
El módulo Empleados muestra a todos los colaboradores (menos clientes). Si no lo ves, revisa que el usuario esté activo en `Configuración → Usuarios`.

**El cliente no recibió el WhatsApp de seguimiento.**
Verifica que WhatsApp esté conectado (`Configuración → WhatsApp`) y que el pedido tenga teléfono válido y esté asignado a una ruta que pasó a "En ruta".

**¿Puedo deshacer una venta?**
Sí, anulándola desde el historial/factura. La anulación devuelve el stock a la bodega de la venta.

**¿Los cambios se ven de inmediato?**
En tu operación diaria, sí. Tras actualizaciones del sistema puede requerirse un breve redespliegue; tu proveedor de soporte lo coordina.

**Solicitudes de mejora / errores:** usa el módulo **`Solicitudes Dev`** dentro del sistema para reportar cualquier necesidad directamente al equipo.

---

## 20. Glosario

| Término | Significado |
|---|---|
| **Sede / Bodega** | Punto físico del negocio (venta o almacén). |
| **Desglose de stock** | Cuánto hay de un producto en cada bodega. |
| **Transferencia** | Movimiento de mercancía entre bodegas. |
| **Reserva** | Material apartado por una cotización aceptada. |
| **Picking** | Preparar/alistar los productos de un pedido en bodega. |
| **Ubicación** | Posición física del producto en la bodega (ej. P3‑B1‑N2). |
| **Ruta** | Grupo de pedidos que salen juntos en un vehículo. |
| **POD (prueba de entrega)** | Foto + nombre de quien recibió el pedido. |
| **Ciclo** | Tiempo total desde que se confirma hasta que se entrega. |
| **Punto de reorden / mínimo** | Nivel de stock que dispara la alerta de "hay que pedir". |
| **Pipeline** | Valor de lo cotizado que aún no se factura. |
| **Cuello de botella** | La etapa que más tiempo consume en tu operación. |

---

*Lopbuk — Sistema Operativo de Negocio. Este manual cubre la configuración de ferretería multi‑sede con despacho. Guárdalo como referencia y compártelo con tus encargados.*
