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
