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
WHERE o.status = 'active'
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
WHERE o.status = 'active'
  AND o.created_at >= $1
  AND o.created_at <= $2
GROUP BY oi.gst_rate
ORDER BY oi.gst_rate;

-- name: PurchaseGSTSummary :one
SELECT
    COUNT(*)::bigint                                               AS total_batches,
    COALESCE(SUM(b.buying_price * b.purchase_qty), 0)::numeric(14,2)   AS total_buying_value,
    COALESCE(SUM((b.landing_price - b.buying_price) * b.purchase_qty), 0)::numeric(14,2) AS total_input_gst,
    COALESCE(SUM(b.landing_price * b.purchase_qty), 0)::numeric(14,2)   AS total_landing_value
FROM batches b
WHERE b.created_at >= $1
  AND b.created_at <= $2
  AND b.purchase_gst_rate IS NOT NULL;

-- name: PurchaseGSTSlabBreakdown :many
SELECT
    b.purchase_gst_rate AS gst_rate,
    COALESCE(SUM(b.buying_price * b.purchase_qty), 0)::numeric(14,2)   AS buying_value,
    COALESCE(SUM((b.landing_price - b.buying_price) * b.purchase_qty), 0)::numeric(14,2) AS input_gst,
    COALESCE(SUM(b.landing_price * b.purchase_qty), 0)::numeric(14,2)   AS landing_value
FROM batches b
WHERE b.created_at >= $1
  AND b.created_at <= $2
  AND b.purchase_gst_rate IS NOT NULL
GROUP BY b.purchase_gst_rate
ORDER BY b.purchase_gst_rate;
