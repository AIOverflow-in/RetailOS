-- Idempotent bill creation: the client sends a UUID per bill attempt, and a retry
-- with the same UUID (e.g. after a dropped connection) returns the bill already
-- saved instead of billing and deducting stock twice. Nullable: older clients and
-- existing orders have none.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_ref UUID;
CREATE UNIQUE INDEX IF NOT EXISTS orders_client_ref_key ON orders (client_ref) WHERE client_ref IS NOT NULL;
