-- Add purchase GST, landing price, and distributor details columns to batches
ALTER TABLE batches
  ADD COLUMN IF NOT EXISTS purchase_gst_rate  NUMERIC(5,2)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS landing_price      NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS distributor_details JSONB         DEFAULT NULL;

-- Update the CHECK constraint to use landing_price when available, falling back to buying_price
-- First, drop the existing CHECK constraint (PostgreSQL auto-generates constraint names)
ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_buying_price_selling_price_mrp_check;
ALTER TABLE batches DROP CONSTRAINT IF EXISTS "batches_buying_price_selling_price_mrp_check";

-- Add the new constraint that accounts for landing_price
ALTER TABLE batches ADD CONSTRAINT batches_price_check
  CHECK (
    COALESCE(landing_price, buying_price) < selling_price
    AND selling_price < mrp
  );
