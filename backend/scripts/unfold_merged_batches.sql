-- Undo the batch folding done by the first version of merge_duplicate_products.sql.
--
-- That version combined batches sharing a batch_no into the oldest one (qty summed,
-- bill lines re-pointed), which moved later purchases into an earlier month in the
-- purchase GST report. Now that a batch_no may repeat (migration 000012), restore each
-- folded purchase as its own batch row from merge_archive_batches / merge_archive_repoints.
--
-- Usage (take and verify a full backup of the tenant first):
--   psql "$DATABASE_URL" -v schema=tenant_xxxxxxxx -f backend/scripts/unfold_merged_batches.sql
--
-- Sales billed against the combined batch after the merge stay on the older row.
-- Aborts without changes if any row would end up with negative stock.
-- Idempotent: rows already restored are skipped. One transaction.

\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path TO :"schema";

ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_product_id_batch_no_key;
ALTER TABLE merge_archive_batches ADD COLUMN IF NOT EXISTS restored_at TIMESTAMPTZ;

CREATE TEMP TABLE todo ON COMMIT DROP AS
SELECT a.*, k.product_id AS kept_product_id
FROM merge_archive_batches a
JOIN batches k ON k.batch_id = a.kept_batch_id
WHERE a.kept_batch_id IS NOT NULL
  AND a.restored_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM batches b WHERE b.batch_id = a.batch_id);

DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(k.batch_no, ', ') INTO bad
  FROM batches k
  JOIN (SELECT kept_batch_id, sum(purchase_qty) pq, sum(sold_qty) sq FROM todo GROUP BY 1) t
    ON t.kept_batch_id = k.batch_id
  WHERE k.sold_qty - t.sq < 0 OR (k.purchase_qty - t.pq) < (k.sold_qty - t.sq);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Split would leave negative stock on batch(es): %', bad;
  END IF;
END $$;

\echo 'Batches to restore / bill lines and adjustments to point back:'
SELECT (SELECT count(*) FROM todo) AS batches,
       (SELECT count(*) FROM merge_archive_repoints r WHERE r.old_batch_id IN (SELECT batch_id FROM todo)) AS repoints;

-- Take the folded quantities back off the older row.
UPDATE batches k
SET purchase_qty = k.purchase_qty - t.pq, sold_qty = k.sold_qty - t.sq
FROM (SELECT kept_batch_id, sum(purchase_qty) pq, sum(sold_qty) sq FROM todo GROUP BY 1) t
WHERE k.batch_id = t.kept_batch_id;

-- Restore each folded purchase as its own row, under the surviving product.
INSERT INTO batches (batch_id, product_id, batch_no, expiry_date, mrp, buying_price, selling_price,
                     purchase_qty, sold_qty, box_no, created_at, purchase_gst_rate, landing_price,
                     distributor_details, distributor_id, purchase_invoice_no)
SELECT batch_id, kept_product_id, batch_no, expiry_date, mrp, buying_price, selling_price,
       purchase_qty, sold_qty, box_no, created_at, purchase_gst_rate, landing_price,
       distributor_details, distributor_id, purchase_invoice_no
FROM todo;

-- Point bill lines and stock adjustments back at the purchase they came from.
UPDATE order_items t SET batch_id = r.old_batch_id
FROM merge_archive_repoints r
WHERE r.table_name = 'order_items' AND t.item_id = r.row_id
  AND t.batch_id = r.new_batch_id AND r.old_batch_id IN (SELECT batch_id FROM todo);
UPDATE stock_adjustments t SET batch_id = r.old_batch_id
FROM merge_archive_repoints r
WHERE r.table_name = 'stock_adjustments' AND t.adjustment_id = r.row_id
  AND t.batch_id = r.new_batch_id AND r.old_batch_id IN (SELECT batch_id FROM todo);

UPDATE merge_archive_batches SET restored_at = now() WHERE batch_id IN (SELECT batch_id FROM todo);

COMMIT;
