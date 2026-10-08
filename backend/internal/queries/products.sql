-- name: SearchProducts :many
SELECT p.product_id, p.name, p.company_name, p.sku, p.hsn_code, p.created_at,
       EXISTS (
         SELECT 1 FROM batches b
         WHERE b.product_id = p.product_id
           AND b.expiry_date > CURRENT_DATE
           AND (b.purchase_qty - b.sold_qty) > 0
       ) AS has_active_stock
FROM products p
WHERE $1::text = ''
   OR p.name ILIKE '%' || $1 || '%'
   OR p.company_name ILIKE '%' || $1 || '%'
ORDER BY p.name
LIMIT $2 OFFSET $3;

-- name: CountProducts :one
SELECT COUNT(*) FROM products
WHERE $1::text = ''
   OR name ILIKE '%' || $1 || '%'
   OR company_name ILIKE '%' || $1 || '%';

-- name: GetProduct :one
SELECT * FROM products WHERE product_id = $1;

-- name: FindProductByNameCompany :one
-- Same key as the products_name_company_norm_key index: letters and digits only,
-- so case, spacing, punctuation and "+" vs "&" don't create a second product.
SELECT * FROM products
WHERE regexp_replace(lower(name), '[^a-z0-9]', '', 'g')
      = regexp_replace(lower(sqlc.arg(name)::text), '[^a-z0-9]', '', 'g')
  AND regexp_replace(lower(company_name), '[^a-z0-9]', '', 'g')
      = regexp_replace(lower(sqlc.arg(company_name)::text), '[^a-z0-9]', '', 'g')
LIMIT 1;

-- name: ListCompanyNames :many
SELECT DISTINCT trim(company_name)::text AS company_name FROM products ORDER BY 1;

-- name: CreateProduct :one
INSERT INTO products (name, company_name, sku, hsn_code)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: UpdateProduct :one
UPDATE products
SET name = $2, company_name = $3, sku = $4, hsn_code = $5
WHERE product_id = $1
RETURNING *;
