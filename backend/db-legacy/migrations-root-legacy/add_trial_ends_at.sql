-- Migration: add trial support to tenants
ALTER TABLE tenants
  ADD COLUMN trial_ends_at DATETIME NULL DEFAULT NULL COMMENT '7-day trial expiry; NULL means no active trial';
