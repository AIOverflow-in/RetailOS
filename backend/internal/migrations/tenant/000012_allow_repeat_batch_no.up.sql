-- A batch no. can be purchased more than once (different month, price, invoice or
-- distributor). Each purchase is its own batches row, so purchase GST, distributor
-- and margin reports stay correct. Stock, bills and returns all key on batch_id.
ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_product_id_batch_no_key;
