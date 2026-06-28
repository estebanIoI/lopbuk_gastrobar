-- Migration: add age gate (verificación +18) fields to store_info
-- Run this on the main database

ALTER TABLE store_info
  ADD COLUMN IF NOT EXISTS age_gate_enabled     TINYINT(1)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS age_gate_description TEXT                 DEFAULT NULL;
