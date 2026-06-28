-- Migration: expand users.phone to support encrypted values and long numbers

ALTER TABLE users
  MODIFY phone TEXT NULL;
