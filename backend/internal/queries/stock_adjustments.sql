-- name: CreateStockAdjustment :one
INSERT INTO stock_adjustments (batch_id, qty_change, reason, notes)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: ListStockAdjustments :many
SELECT sa.*, b.batch_no, p.name AS product_name
FROM stock_adjustments sa
JOIN batches b ON b.batch_id = sa.batch_id
JOIN products p ON p.product_id = b.product_id
ORDER BY sa.created_at DESC
LIMIT $1 OFFSET $2;

-- name: CountStockAdjustments :one
SELECT COUNT(*) FROM stock_adjustments;

-- name: AdjustBatchPurchaseQty :exec
UPDATE batches
SET purchase_qty = purchase_qty + $2
WHERE batch_id = $1;
