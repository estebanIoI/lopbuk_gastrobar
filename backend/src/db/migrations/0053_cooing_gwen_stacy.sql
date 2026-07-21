-- La generación de Drizzle arrastró diffs de tablas/columnas que YA existen en la BD
-- (el historial de snapshots estaba desincronizado con schema.ts). Este archivo se
-- reduce a la única columna realmente nueva de este cambio para no romper el migrate.
ALTER TABLE `store_info` ADD `contact_page_social_images` text;
