-- Migration: Change emp_role from ENUM to VARCHAR so admin can enter any custom role
-- Run this once against your MySQL database

ALTER TABLE `teammember`
  MODIFY COLUMN `emp_role` VARCHAR(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL;

-- Verify
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'teammember' AND COLUMN_NAME = 'emp_role';
