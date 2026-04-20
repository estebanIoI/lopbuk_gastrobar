-- Agrega columnas de abonos recibidos a la tabla cash_sessions
-- Permite rastrear los abonos de fiados cobrados durante cada sesion de caja

ALTER TABLE cash_sessions
  ADD COLUMN total_credit_payments_efectivo  DECIMAL(12,2) NULL DEFAULT 0 AFTER total_fiado_sales,
  ADD COLUMN total_credit_payments_tarjeta   DECIMAL(12,2) NULL DEFAULT 0 AFTER total_credit_payments_efectivo,
  ADD COLUMN total_credit_payments_transfer  DECIMAL(12,2) NULL DEFAULT 0 AFTER total_credit_payments_tarjeta;
