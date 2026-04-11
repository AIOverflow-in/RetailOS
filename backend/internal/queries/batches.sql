-- name: CreateBatch :one
INSERT INTO batches (product_id, batch_no, expiry_date, mrp, buying_price, selling_price, purchase_qty, box_no)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: ListBatchesForProduct :many
SELECT b.*,
       (b.purchase_qty - b.sold_qty) AS available_stock
FROM batches b
WHERE b.product_id = $1
ORDER BY b.created_at DESC;

-- name: ListActiveBatchesForProduct :many
SELECT b.*,
       (b.purchase_qty - b.sold_qty) AS available_stock
FROM batches b
WHERE b.product_id = $1
  AND b.expiry_date > CURRENT_DATE
  AND (b.purchase_qty - b.sold_qty) > 0
ORDER BY b.expiry_date ASC;

-- name: LockBatchForUpdate :one
SELECT batch_id, purchase_qty, sold_qty
FROM batches
WHERE batch_id = $1
FOR UPDATE;

-- name: DeductBatchStock :exec
UPDATE batches
SET sold_qty = sold_qty + $2
WHERE batch_id = $1;

-- name: RestoreBatchStock :exec
UPDATE batches
SET sold_qty = sold_qty - $2
WHERE batch_id = $1;

-- name: GetBatch :one
SELECT * FROM batches WHERE batch_id = $1;

-- name: UpdateBatch :one
UPDATE batches
SET buying_price = $2, selling_price = $3, mrp = $4,
    expiry_date = $5, purchase_qty = $6, box_no = $7
WHERE batch_id = $1
RETURNING *;

-- name: ListInventory :many
SELECT p.product_id, p.name, p.company_name, p.sku, p.hsn_code,
       b.batch_id, b.batch_no, b.expiry_date, b.mrp, b.buying_price, b.selling_price,
       b.purchase_qty, b.sold_qty, b.box_no,
       (b.purchase_qty - b.sold_qty) AS available_stock
FROM products p
JOIN batches b ON b.product_id = p.product_id
ORDER BY p.name, b.expiry_date ASC;
