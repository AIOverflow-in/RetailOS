-- Merge duplicate products (same name + company, ignoring case/spaces) in ONE tenant.
--
-- Usage (take and verify a full backup of the tenant first):
--   psql "$DATABASE_URL" -v schema=tenant_xxxxxxxx -f backend/scripts/merge_duplicate_products.sql
--
-- For each duplicate group the oldest product is kept and the copies' batches move to it
-- unchanged. Batches are never combined: each stays its own purchase (date, price, GST,
-- invoice, distributor), so purchase GST and distributor reports are unaffected.
--
-- Nothing is lost: every removed product row is copied into merge_archive_products first.
-- Bill lines reference batches, which keep their ids, so bills don't change.
-- Runs in one transaction; any error rolls everything back.

\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path TO :"schema";

-- Same as migration 000012: a batch no. may appear more than once per product.
ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_product_id_batch_no_key;

CREATE TEMP TABLE prod_map ON COMMIT DROP AS
SELECT product_id AS dup_id,
       first_value(product_id) OVER (
         PARTITION BY lower(trim(name)), lower(trim(company_name))
         ORDER BY created_at, product_id) AS keep_id
FROM products;
DELETE FROM prod_map WHERE dup_id = keep_id;

CREATE TABLE IF NOT EXISTS merge_archive_products (LIKE products, kept_product_id UUID, merged_at TIMESTAMPTZ);
INSERT INTO merge_archive_products
SELECT p.*, m.keep_id, now() FROM products p JOIN prod_map m ON m.dup_id = p.product_id;

\echo 'Products merged away / batches moved:'
SELECT (SELECT count(*) FROM prod_map) AS products,
       (SELECT count(*) FROM batches WHERE product_id IN (SELECT dup_id FROM prod_map)) AS batches;

UPDATE batches t SET product_id = m.keep_id FROM prod_map m WHERE t.product_id = m.dup_id;
DELETE FROM products WHERE product_id IN (SELECT dup_id FROM prod_map);

-- Exact-name guard; migration 000011 swaps it for the punctuation-insensitive
-- index once no near-duplicates remain.
CREATE UNIQUE INDEX IF NOT EXISTS products_name_company_key
    ON products (lower(trim(name)), lower(trim(company_name)));

COMMIT;
