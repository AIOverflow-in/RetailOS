-- name: DashboardTodaySales :one
SELECT COALESCE(SUM(total_amount), 0)::numeric(14,2) AS total_sales,
       COUNT(*)::bigint AS order_count
FROM orders
WHERE status = 'active'
  AND created_at >= $1;

-- name: DashboardLowStockCount :one
SELECT COUNT(*)::bigint FROM batches
WHERE (purchase_qty - sold_qty) > 0
  AND (purchase_qty - sold_qty) < 10
  AND expiry_date > CURRENT_DATE;

-- name: DashboardExpiringCount :one
SELECT COUNT(*)::bigint FROM batches
WHERE (purchase_qty - sold_qty) > 0
  AND expiry_date > CURRENT_DATE
  AND expiry_date <= CURRENT_DATE + INTERVAL '60 days';

-- name: DashboardPaymentModeSplit :many
SELECT payment_mode, COALESCE(SUM(total_amount), 0)::numeric(14,2) AS total
FROM orders
WHERE status = 'active'
  AND created_at >= $1
GROUP BY payment_mode;

-- name: DashboardDistributorStats :many
SELECT d.distributor_id,
       d.name AS distributor_name,
       COUNT(b.batch_id)::bigint AS batch_count,
       COALESCE(SUM(b.purchase_qty), 0)::bigint AS total_purchase_qty,
       COALESCE(SUM(COALESCE(b.landing_price, b.buying_price) * (b.purchase_qty - b.sold_qty)), 0)::numeric(14,2) AS total_stock_value
FROM distributors d
LEFT JOIN batches b ON b.distributor_id = d.distributor_id
  AND (b.purchase_qty - b.sold_qty) > 0
  AND b.expiry_date > CURRENT_DATE
WHERE d.is_active = TRUE
GROUP BY d.distributor_id, d.name
ORDER BY total_stock_value DESC
LIMIT 5;
