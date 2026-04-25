-- name: CreateOrder :one
INSERT INTO orders (order_number, customer_id, cgst_total, sgst_total, igst_total, total_amount, payment_mode)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: CreateOrderItem :one
INSERT INTO order_items (order_id, batch_id, product_name, batch_no, qty, sale_price, gst_rate, cgst_amount, sgst_amount, igst_amount, line_total)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING *;

-- name: ListOrders :many
SELECT o.order_id, o.order_number, o.total_amount, o.status, o.payment_mode, o.created_at,
       c.name  AS customer_name,
       c.phone AS customer_phone
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.customer_id
WHERE o.status <> 'deleted'
  AND (
      $1::text = ''
      OR o.order_number ILIKE '%' || $1 || '%'
      OR c.name         ILIKE '%' || $1 || '%'
      OR c.phone        ILIKE '%' || $1 || '%'
  )
  AND ($2::text[] IS NULL OR o.status       = ANY($2::text[]))
  AND ($3::text[] IS NULL OR o.payment_mode = ANY($3::text[]))
  AND ($4::date   IS NULL OR o.created_at::date >= $4::date)
  AND ($5::date   IS NULL OR o.created_at::date <= $5::date)
ORDER BY
  CASE WHEN $6::text = 'date_asc'   THEN o.created_at   END ASC  NULLS LAST,
  CASE WHEN $6::text = 'date_desc'  THEN o.created_at   END DESC NULLS LAST,
  CASE WHEN $6::text = 'total_asc'  THEN o.total_amount END ASC  NULLS LAST,
  CASE WHEN $6::text = 'total_desc' THEN o.total_amount END DESC NULLS LAST,
  o.created_at DESC
LIMIT $7 OFFSET $8;

-- name: CountOrders :one
SELECT COUNT(*) FROM orders WHERE status != 'deleted';

-- name: CountOrdersFiltered :one
SELECT COUNT(*)
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.customer_id
WHERE o.status <> 'deleted'
  AND (
      $1::text = ''
      OR o.order_number ILIKE '%' || $1 || '%'
      OR c.name         ILIKE '%' || $1 || '%'
      OR c.phone        ILIKE '%' || $1 || '%'
  )
  AND ($2::text[] IS NULL OR o.status       = ANY($2::text[]))
  AND ($3::text[] IS NULL OR o.payment_mode = ANY($3::text[]))
  AND ($4::date   IS NULL OR o.created_at::date >= $4::date)
  AND ($5::date   IS NULL OR o.created_at::date <= $5::date);

-- name: GetOrderByID :one
SELECT o.order_id, o.order_number, o.customer_id, o.cgst_total, o.sgst_total, o.igst_total,
       o.total_amount, o.status, o.created_at, o.payment_mode, o.updated_at, o.return_comment,
       c.name  AS customer_name,
       c.phone AS customer_phone,
       c.age   AS customer_age
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.customer_id
WHERE o.order_id = $1;

-- name: GetOrderItems :many
SELECT oi.item_id, oi.order_id, oi.batch_id, oi.product_name, oi.batch_no,
       oi.qty, oi.returned_qty, oi.sale_price, oi.gst_rate, oi.cgst_amount, oi.sgst_amount, oi.igst_amount, oi.line_total,
       b.mrp,
       b.expiry_date
FROM order_items oi
JOIN batches b ON oi.batch_id = b.batch_id
WHERE oi.order_id = $1;

-- name: GetOrderItemByID :one
SELECT oi.item_id, oi.order_id, oi.batch_id, oi.product_name, oi.batch_no,
       oi.qty, oi.returned_qty, oi.sale_price, oi.gst_rate, oi.cgst_amount, oi.sgst_amount, oi.igst_amount, oi.line_total
FROM order_items oi
WHERE oi.item_id = $1;

-- name: UpdateOrderItemReturnedQty :exec
UPDATE order_items SET returned_qty = returned_qty + $2 WHERE item_id = $1;

-- name: UpdateOrderItemQuantity :exec
UPDATE order_items
SET qty = $2, cgst_amount = $3, sgst_amount = $4, igst_amount = $5, line_total = $6
WHERE item_id = $1;

-- name: UpdateOrderAfterEdit :exec
UPDATE orders
SET status = $2, return_comment = $3,
    cgst_total = $4, sgst_total = $5, igst_total = $6,
    total_amount = $7, updated_at = NOW()
WHERE order_id = $1;

-- name: SoftDeleteOrder :exec
UPDATE orders SET status = 'deleted' WHERE order_id = $1;

-- name: MarkOrderReturned :exec
UPDATE orders SET status = 'returned' WHERE order_id = $1;

-- name: CountOrdersInFY :one
SELECT COUNT(*) FROM orders
WHERE created_at >= $1;
