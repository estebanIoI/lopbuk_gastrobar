# 🏊 Plan — Centro recreacional (Mala Playita) sobre el sistema de Reservas

> Comercio nuevo: centro turístico/recreacional con piscina, cancha de voli, tobogán, zona de estar
> y venta de almuerzo/aguardiente. Quiere vender **pases y combos reservables por anticipado**, para
> grupos, con **pago previo** y **check-in** a la llegada, para que el cliente llegue y "ya tenga todo".
> Todo se apoya en el módulo de **Servicios / Reservas** actual — no es un módulo nuevo.

## ✅ Lo que YA se resuelve con lo existente (Fase 0, sin código)
- **Activar el comercio** "Mala Playita".
- Crear un **servicio tipo "cita"** = *"Pase al centro recreacional"* / *"Día de piscina"*.
- **Combos = Modalidades** (la feature recién construida): el cliente elige una al reservar y se cobra esa:
  - *Solo entrada* — $5.000
  - *Entrada + Almuerzo* — $X
  - *Entrada + Almuerzo + Aguardiente* — $Y
  - (Con modalidades, la tarjeta muestra sola "Desde $5.000".)
- **Extras = Complementos (addons)**: aguardiente, gaseosa, alquiler de flotador, etc. (aditivos, suben el ticket).
- **"¿Qué incluye?"**: piscina, cancha de voli, tobogán, zona de estar (lista de beneficios que se ve al reservar).
- **Disponibilidad + aforo**: horario del día (ej. 8am–5pm) con `max_simultaneous` = cupo. **Cancelación gratis** hasta X h.
- **Reserva con datos + resumen + "checking" previo**: el formulario de reserva ya captura nombre/tel/email y arma el total.

Con solo esto, un cliente ya puede reservar un combo y llegar con la reserva hecha. Falta lo de abajo para que sea redondo.

## 🔴 Lo que FALTA (piezas nuevas, por fases)

### Fase 1 — Número de personas (pax) por reserva ← la más importante
Hoy una reserva = 1 persona/cupo. Un centro recreacional necesita "reserva para N personas".
- **Backend**: columna `party_size` (default 1) en `service_bookings` + aceptar `partySize` al crear.
  Total = (precio de modalidad o base) × pax + complementos. El aforo descuenta **`pax`**, no 1.
  (La columna se agrega vía `runCatchup()`, idempotente — como las últimas.)
- **Modal de reserva**: campo *"¿Cuántas personas?"* (stepper) que multiplica el total en vivo.
- **Admin → Reservas**: mostrar "5 personas" en cada reserva.
- **Opcional pro**: lista de nombres de acompañantes (para que se vea aún más pro al llegar).

### Fase 2 — Pago anticipado (prepago)
Hoy las reservas registran el total pero **no cobran online** (la pasarela — MercadoPago/Wompi/Sistecredito —
vive en los **pedidos de tienda**, no en reservas).
- **2A (recomendado para arrancar)**: **reserva sin cobro / pago al llegar**. El cliente reserva, hace su
  "checking", y paga en caja al llegar. **Cero desarrollo**. Valida el flujo real primero.
- **2B (prepago real)**: al confirmar la reserva, generar un **cobro con la pasarela ya integrada**
  (link de pago) ligado a la reserva; el webhook la marca como "pagada". Reutiliza la infraestructura de
  pagos de pedidos (webhooks + idempotencia + conciliación). Es la pieza más grande.
- **Recomendación**: 2A desde el día 1; 2B cuando el flujo esté validado.

### Fase 3 — Check-in a la llegada (el "efecto pro")
- **Backend**: `checked_in_at` (timestamp) + acción "check-in". Estados: pendiente → confirmada → **check-in** → atendida.
- **Admin → Reservas**: filtro *"Hoy"* + botón **"Check-in"** por reserva (marca la llegada).
- **Extra pro**: **QR** en la confirmación de la reserva; el staff lo escanea (o busca por teléfono/nombre) y hace
  el check-in en un toque. Ese es el momento "llegan y ya tienen todo listo".

### Fase 4 — Aforo por DÍA (opcional, si el pase no es por hora)
Un pase de piscina suele ser "por día", no por cita de hora exacta.
- **Rápido**: un solo slot que cubra todo el día con `max_simultaneous` = aforo total. Funciona ya.
- **Mejor**: un modo de servicio *"por día / aforo"* (reservar una fecha, no una hora) que descuenta del cupo
  diario. Es un ajuste de la disponibilidad, no un módulo nuevo.

## 🗺️ Orden sugerido
1. **Fase 0** (hoy, sin código): comercio + servicio "Pase" + modalidades (combos) + complementos + horario/aforo. Ya se reserva.
2. **Fase 1** (pax) — lo que más se nota para grupos.
3. **Fase 3** (check-in + QR) — el efecto pro a la llegada.
4. **Fase 2A** vive desde el inicio (pago al llegar); **Fase 2B** (prepago online) al final.
5. **Fase 4** si el pase debe ser por día con aforo.

## Notas técnicas
- Reusa el módulo de **Servicios/Reservas** existente (bookings, holds anti-doble-reserva, disponibilidad,
  lista de espera, estados). No hay que crear un módulo nuevo.
- Las columnas nuevas (`party_size`, `checked_in_at`, etc.) se agregan en `runCatchup()` de `migrate.ts`
  (idempotentes, se crean solas al arrancar el backend).
- El prepago (2B) es la única pieza que toca la capa de pagos; conviene dejarla para el final.

← [[DAIMUZ]]
