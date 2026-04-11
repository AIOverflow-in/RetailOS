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
WHERE o.status = 'active'
  AND (
      $1::text = ''
      OR o.order_number ILIKE '%' || $1 || '%'
      OR c.name         ILIKE '%' || $1 || '%'
      OR c.phone        ILIKE '%' || $1 || '%'
  )
ORDER BY o.created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountOrders :one
SELECT COUNT(*) FROM orders WHERE status != 'deleted';

-- name: CountOrdersFiltered :one
SELECT COUNT(*)
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.customer_id
WHERE o.status = 'active'
  AND (
      $1::text = ''
      OR o.order_number ILIKE '%' || $1 || '%'
      OR c.name         ILIKE '%' || $1 || '%'
      OR c.phone        ILIKE '%' || $1 || '%'
  );

-- name: GetOrderByID :one
SELECT o.*,
       c.name  AS customer_name,
       c.phone AS customer_phone
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.customer_id
WHERE o.order_id = $1;

-- name: GetOrderItems :many
SELECT * FROM order_items WHERE order_id = $1;

-- name: SoftDeleteOrder :exec
UPDATE orders SET status = 'deleted' WHERE order_id = $1;

-- name: MarkOrderReturned :exec
UPDATE orders SET status = 'returned' WHERE order_id = $1;

-- name: CountOrdersInFY :one
SELECT COUNT(*) FROM orders
WHERE created_at >= $1;
