-- Merge duplicate products (same name + company, ignoring case/spaces) in ONE tenant.
--
-- Usage (take and verify a full backup of the tenant first):
--   psql "$DATABASE_URL" -v schema=tenant_xxxxxxxx -f backend/scripts/merge_duplicate_products.sql
--
-- For each duplicate group the oldest product is kept and the copies' batches move to it.
-- Where two batches in a group share a batch_no (blocked by UNIQUE(product_id, batch_no)),
-- they are folded into the oldest batch: qty is summed and bill lines / stock adjustments
-- are re-pointed to it.
--
-- Nothing is lost: every removed product and batch row, and every re-pointed bill line and
-- stock adjustment, is copied into merge_archive_* tables in the same schema first.
-- Bill lines keep their own product_name / batch_no / prices, so printed bills don't change.
-- Runs in one transaction; any error rolls everything back.

\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path TO :"schema";

CREATE TEMP TABLE prod_map ON COMMIT DROP AS
SELECT product_id AS dup_id,
       first_value(product_id) OVER (
         PARTITION BY lower(trim(name)), lower(trim(company_name))
         ORDER BY created_at, product_id) AS keep_id
FROM products;
DELETE FROM prod_map WHERE dup_id = keep_id;

CREATE TEMP TABLE batch_map ON COMMIT DROP AS
SELECT batch_id AS dup_batch,
       first_value(batch_id) OVER (
         PARTITION BY g.keep_id, b.batch_no
         ORDER BY b.created_at, b.batch_id) AS keep_batch
FROM batches b
JOIN (SELECT dup_id AS pid, keep_id FROM prod_map
      UNION SELECT keep_id, keep_id FROM prod_map) g ON g.pid = b.product_id;
DELETE FROM batch_map WHERE dup_batch = keep_batch;

-- Archive before touching anything.
CREATE TABLE IF NOT EXISTS merge_archive_products (LIKE products, kept_product_id UUID, merged_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS merge_archive_batches  (LIKE batches,  kept_batch_id   UUID, merged_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS merge_archive_repoints (
    table_name TEXT, row_id UUID, old_batch_id UUID, new_batch_id UUID, merged_at TIMESTAMPTZ);

INSERT INTO merge_archive_products
SELECT p.*, m.keep_id, now() FROM products p JOIN prod_map m ON m.dup_id = p.product_id;

-- Kept batches that absorb others are archived too, with their pre-merge quantities.
INSERT INTO merge_archive_batches
SELECT b.*, m.keep_batch, now() FROM batches b JOIN batch_map m ON m.dup_batch = b.batch_id
UNION ALL
SELECT b.*, NULL, now() FROM batches b WHERE b.batch_id IN (SELECT keep_batch FROM batch_map);

INSERT INTO merge_archive_repoints
SELECT 'order_items', t.item_id, t.batch_id, m.keep_batch, now()
FROM order_items t JOIN batch_map m ON m.dup_batch = t.batch_id
UNION ALL
SELECT 'stock_adjustments', t.adjustment_id, t.batch_id, m.keep_batch, now()
FROM stock_adjustments t JOIN batch_map m ON m.dup_batch = t.batch_id;

\echo 'Products merged away / batches folded / rows re-pointed:'
SELECT (SELECT count(*) FROM prod_map) AS products,
       (SELECT count(*) FROM batch_map) AS batches,
       (SELECT count(*) FROM merge_archive_repoints
         WHERE new_batch_id IN (SELECT keep_batch FROM batch_map)) AS repointed;

-- Fold same-batch_no batches.
UPDATE batches k
SET purchase_qty = k.purchase_qty + s.pq, sold_qty = k.sold_qty + s.sq
FROM (SELECT m.keep_batch, sum(d.purchase_qty) pq, sum(d.sold_qty) sq
      FROM batch_map m JOIN batches d ON d.batch_id = m.dup_batch
      GROUP BY m.keep_batch) s
WHERE k.batch_id = s.keep_batch;

UPDATE order_items       t SET batch_id = m.keep_batch FROM batch_map m WHERE t.batch_id = m.dup_batch;
UPDATE stock_adjustments t SET batch_id = m.keep_batch FROM batch_map m WHERE t.batch_id = m.dup_batch;
DELETE FROM batches WHERE batch_id IN (SELECT dup_batch FROM batch_map);

-- Move remaining batches to the kept product, then drop the copies.
UPDATE batches t SET product_id = m.keep_id FROM prod_map m WHERE t.product_id = m.dup_id;
DELETE FROM products WHERE product_id IN (SELECT dup_id FROM prod_map);

CREATE UNIQUE INDEX IF NOT EXISTS products_name_company_key
    ON products (lower(trim(name)), lower(trim(company_name)));

COMMIT;
