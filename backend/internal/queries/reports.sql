-- name: GSTReportSummary :one
SELECT
    COUNT(DISTINCT o.order_id)::bigint                         AS total_orders,
    COALESCE(SUM(oi.sale_price * oi.qty), 0)::numeric(14,2)   AS taxable_value,
    COALESCE(SUM(oi.cgst_amount), 0)::numeric(14,2)            AS total_cgst,
    COALESCE(SUM(oi.sgst_amount), 0)::numeric(14,2)            AS total_sgst,
    COALESCE(SUM(oi.igst_amount), 0)::numeric(14,2)            AS total_igst,
    COALESCE(SUM(oi.line_total), 0)::numeric(14,2)             AS total_sales
FROM orders o
JOIN order_items oi ON o.order_id = oi.order_id
WHERE o.status != 'deleted'
  AND o.created_at >= $1
  AND o.created_at <= $2;

-- name: GSTSlabBreakdown :many
SELECT
    oi.gst_rate,
    COALESCE(SUM(oi.sale_price * oi.qty), 0)::numeric(14,2) AS taxable_value,
    COALESCE(SUM(oi.cgst_amount), 0)::numeric(14,2)          AS cgst,
    COALESCE(SUM(oi.sgst_amount), 0)::numeric(14,2)          AS sgst,
    COALESCE(SUM(oi.igst_amount), 0)::numeric(14,2)          AS igst,
    COALESCE(SUM(oi.line_total), 0)::numeric(14,2)           AS total
FROM orders o
JOIN order_items oi ON o.order_id = oi.order_id
WHERE o.status != 'deleted'
  AND o.created_at >= $1
  AND o.created_at <= $2
GROUP BY oi.gst_rate
ORDER BY oi.gst_rate;
