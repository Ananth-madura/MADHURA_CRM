-- ============================================================
-- ACHME CRM - Fix 500 Error with 45+ Items
-- Run this on IBM-SERVER MySQL (database: achme)
-- ============================================================

USE achme;

-- Fix description column: VARCHAR(255) → TEXT (removes 255 char limit)
ALTER TABLE quotation_items MODIFY COLUMN description TEXT NOT NULL;
ALTER TABLE service_estimation_items MODIFY COLUMN description TEXT NOT NULL;
ALTER TABLE estimate_invoice_items MODIFY COLUMN description TEXT NOT NULL;
ALTER TABLE estimate_items MODIFY COLUMN description TEXT NOT NULL;
ALTER TABLE performainvoice_items MODIFY COLUMN description TEXT NOT NULL;
ALTER TABLE service_items MODIFY COLUMN description TEXT NOT NULL;

-- Fix quantity column: INT → DECIMAL (supports fractional quantities)
ALTER TABLE quotation_items MODIFY COLUMN quantity DECIMAL(10,2) NOT NULL;
ALTER TABLE service_estimation_items MODIFY COLUMN quantity DECIMAL(10,2) NOT NULL;
ALTER TABLE estimate_invoice_items MODIFY COLUMN quantity DECIMAL(10,2) NOT NULL;
ALTER TABLE estimate_items MODIFY COLUMN quantity DECIMAL(10,2) NOT NULL;
ALTER TABLE performainvoice_items MODIFY COLUMN quantity DECIMAL(10,2) NOT NULL;
ALTER TABLE service_items MODIFY COLUMN quantity DECIMAL(10,2) NOT NULL;

-- Verify the fix was applied
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'achme'
  AND column_name = 'description'
  AND table_name IN (
    'quotation_items',
    'service_estimation_items',
    'estimate_invoice_items',
    'estimate_items',
    'performainvoice_items',
    'service_items'
  )
ORDER BY table_name;
-- Expected result: data_type = 'text' for ALL tables above
