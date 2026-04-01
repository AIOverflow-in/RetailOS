-- name: SearchProducts :many
SELECT * FROM products
WHERE $1::text = ''
   OR name ILIKE '%' || $1 || '%'
   OR company_name ILIKE '%' || $1 || '%'
ORDER BY name
LIMIT 30;

-- name: GetProduct :one
SELECT * FROM products WHERE product_id = $1;

-- name: CreateProduct :one
INSERT INTO products (name, company_name, sku, hsn_code)
VALUES ($1, $2, $3, $4)
RETURNING *;
