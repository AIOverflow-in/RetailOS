-- name: GetTenantByUsername :one
SELECT * FROM tenants WHERE username = $1 LIMIT 1;

-- name: CreateTenant :one
INSERT INTO tenants (shop_name, schema_name, order_prefix, username, hashed_password)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: ListTenants :many
SELECT tenant_id, shop_name, schema_name, order_prefix, username, is_active, created_at
FROM tenants
ORDER BY created_at DESC;

-- name: SetTenantActive :exec
UPDATE tenants SET is_active = $2 WHERE tenant_id = $1;

-- name: GetTenantByID :one
SELECT * FROM tenants WHERE tenant_id = $1 LIMIT 1;

-- name: GetTenantSettings :one
SELECT settings FROM tenants WHERE tenant_id = $1;

-- name: UpdateTenantSettings :exec
UPDATE tenants SET settings = $2 WHERE tenant_id = $1;
