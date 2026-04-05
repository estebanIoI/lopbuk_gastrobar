-- Migration: add contact page fields to store_info
-- Run this on the main database

ALTER TABLE store_info
  ADD COLUMN IF NOT EXISTS contact_page_enabled  TINYINT(1)   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contact_page_title     VARCHAR(255)          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS contact_page_description TEXT                 DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS contact_page_image     VARCHAR(500)          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS contact_page_products  TEXT                  DEFAULT NULL,  -- JSON array of product IDs
  ADD COLUMN IF NOT EXISTS contact_page_links     TEXT                  DEFAULT NULL;  -- JSON array of custom links
