-- A batch no. can be purchased more than once (different month, price, invoice or
-- distributor). Each purchase is its own batches row, so purchase GST, distributor
-- and margin reports stay correct. Stock, bills and returns all key on batch_id.
-- Checked first so later startups don't take a lock on batches for nothing.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint
             WHERE conname = 'batches_product_id_batch_no_key'
               AND conrelid = 'batches'::regclass) THEN
    ALTER TABLE batches DROP CONSTRAINT batches_product_id_batch_no_key;
  END IF;
END $$;
