-- name: GetCustomerByPhone :one
SELECT * FROM customers WHERE phone = $1 LIMIT 1;

-- name: CreateCustomer :one
INSERT INTO customers (phone, name, age)
VALUES ($1, $2, $3)
RETURNING *;

-- name: IncrementVisitCount :exec
UPDATE customers SET visit_count = visit_count + 1 WHERE customer_id = $1;
