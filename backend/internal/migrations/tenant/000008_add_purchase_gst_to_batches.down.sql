-- Rollback: remove purchase GST, landing price, and distributor details columns
-- Also restore the original CHECK constraint

-- Drop the new constraint
ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_price_check;

-- Drop the new columns
ALTER TABLE batches
  DROP COLUMN IF EXISTS distributor_details,
  DROP COLUMN IF EXISTS landing_price,
  DROP COLUMN IF EXISTS purchase_gst_rate;

-- Restore the original CHECK constraint (matching the auto-generated name pattern)
ALTER TABLE batches ADD CONSTRAINT batches_buying_price_selling_price_mrp_check
  CHECK (buying_price < selling_price AND selling_price < mrp);
