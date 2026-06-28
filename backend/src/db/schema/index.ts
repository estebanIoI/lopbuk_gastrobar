// Punto de entrada del esquema Drizzle.
// `schema.ts` + `relations.ts` fueron generados por `drizzle-kit pull` (baseline
// por introspección de stockpro_truth). drizzle.config apunta a esta carpeta:
// es la FUENTE para `drizzle-kit generate` (diff contra meta/*.json).
//
// Para cambios de esquema: editar las tablas aquí → `npm run db:generate` →
// revisar el .sql → `npm run migrate`. NUNCA DDL en runtime.
export * from './schema'
export * from './relations'
