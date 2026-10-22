-- name: GetCustomerByPhone :one
SELECT * FROM customers WHERE phone = $1 LIMIT 1;

-- name: CreateCustomer :one
INSERT INTO customers (phone, name, age, address)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: IncrementVisitCount :exec
UPDATE customers SET visit_count = visit_count + 1 WHERE customer_id = $1;

-- name: ListCustomers :many
SELECT * FROM customers
WHERE $1::text = ''
   OR name ILIKE '%' || $1 || '%'
   OR phone ILIKE '%' || $1 || '%'
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountCustomers :one
SELECT COUNT(*) FROM customers
WHERE $1::text = ''
   OR name ILIKE '%' || $1 || '%'
   OR phone ILIKE '%' || $1 || '%';

-- name: UpdateCustomer :one
UPDATE customers
SET name = @name,
    phone = @phone,
    age = sqlc.narg(age),
    -- set_address false = the caller sent no address: keep the saved one.
    address = CASE WHEN @set_address::boolean THEN sqlc.narg(address)::text ELSE address END
WHERE customer_id = @customer_id
RETURNING *;
