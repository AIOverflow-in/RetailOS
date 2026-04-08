-- name: GetSuperAdminByUsername :one
SELECT * FROM super_admins WHERE username = $1 AND is_active = TRUE;

-- name: CreateSuperAdminOTP :one
INSERT INTO super_admin_otp (admin_id, otp_code, expires_at)
VALUES ($1, $2, NOW() + INTERVAL '5 minutes')
RETURNING *;

-- name: GetOTPByID :one
SELECT o.*, sa.username, sa.email
FROM super_admin_otp o
JOIN super_admins sa ON sa.id = o.admin_id
WHERE o.id = $1
  AND o.otp_code = $2
  AND o.used = FALSE
  AND o.expires_at > NOW();

-- name: MarkOTPUsed :exec
UPDATE super_admin_otp SET used = TRUE WHERE id = $1;

-- name: CleanExpiredOTPs :exec
DELETE FROM super_admin_otp WHERE expires_at < NOW();
