# Migraciones PostgreSQL

> ⚠️ **Importante:** La app actualmente corre sobre **MySQL** (driver `mysql2`,
> `DB_HOST=mysql`, `DATABASE_URL=mysql://...`). Estas migraciones Postgres solo
> aplican si/ cuando se migre el backend a PostgreSQL. Mientras el backend siga
> en MySQL, los fixes de producción van en `backend/migrations/*.sql` (sintaxis MySQL).

## Convenciones

- Numerar en orden: `001_*.sql`, `002_*.sql`, ...
- Una migración = un cambio atómico y reversible cuando sea posible.
- Cabecera con: fecha, problema, fix y si es idempotente.

## Diferencias clave MySQL → PostgreSQL (a tener en cuenta al portar)

| MySQL | PostgreSQL |
|---|---|
| `USE db;` | No existe. Te conectas a la BD (`\c db` en psql o eliges en pgAdmin). |
| `ALTER TABLE t DROP PRIMARY KEY` | `ALTER TABLE t DROP CONSTRAINT t_pkey` (PK por defecto = `<tabla>_pkey`). |
| `AUTO_INCREMENT` | `SERIAL` / `GENERATED ... AS IDENTITY`. |
| `TINYINT(1)` (booleanos) | `BOOLEAN`. |
| `DATETIME` / `TIMESTAMP` | `TIMESTAMP` / `TIMESTAMPTZ`. |
| `ENGINE=InnoDB ... CHARSET=utf8mb4` | No aplica (se omite). |
| Comillas backtick `` `col` `` | Comillas dobles `"col"`. |
| `ON UPDATE CURRENT_TIMESTAMP` | Requiere trigger. |

## Cómo aplicar

```bash
# Conéctate a la base correcta primero (NO uses USE)
psql "postgresql://USER:PASS@HOST:5432/daimuz_lopbuk" -f 001_fix_categories_composite_pk.sql
```
