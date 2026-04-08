# Feature: Super Admin System

> **Status:** Planned  
> **Priority:** High  
> **Author:** RetailOS Core Team  
> **Date:** 2026-04-05

---

## 1. Overview

Replace the current static `X-Admin-Key` authentication on admin routes with a proper **Super Admin** user system. Super admins are the creators/operators of RetailOS — they are the only users who can create, manage, and deactivate shops. This route and its functionality must be completely invisible to shop-level users.

### Goals

- Dedicated `super_admins` database table with proper credential storage
- Email-based 2FA via SMTP (OTP on every login)
- Separate auth flow and JWT token type for super admins
- Super admin UI moved out of the shop dashboard entirely
- Remove the Admin link from the shop-level sidebar
- No shop-level user should ever be able to access super admin functionality

---

## 2. Current State (What Exists Today)

### Backend

| Component | File | Details |
|-----------|------|---------|
| Admin handler | `backend/internal/handlers/admin.go` | `CreateTenant`, `ListTenants`, `SetTenantActive` |
| Admin auth middleware | `backend/internal/middleware/auth.go` | `AdminAuth()` — validates static `X-Admin-Key` header |
| Config | `backend/internal/config/config.go` | Loads `ADMIN_SECRET_KEY` from env |
| Routes | `backend/cmd/server/main.go` | `POST/GET/PATCH /admin/tenants` behind `AdminAuth` middleware |
| Tenants table | `backend/internal/migrations/public/000001_create_tenants.up.sql` | Public schema table |

### Frontend

| Component | File | Details |
|-----------|------|---------|
| Admin page | `frontend/app/(dashboard)/admin/page.tsx` | Shop creation UI, tenant list, activate/deactivate |
| API client | `frontend/lib/api.ts` | `createTenant`, `listTenants`, `setTenantActive` — all send `X-Admin-Key` from env |
| Sidebar | `frontend/components/shared/Sidebar.tsx` | Admin link was previously in NAV (already removed from sidebar) |

### Problems with Current Approach

1. **Static API key** (`X-Admin-Key`) is a shared secret — no user identity, no audit trail
2. **Key is exposed in frontend env** (`NEXT_PUBLIC_ADMIN_KEY`) — visible in browser network tab
3. **Admin page lives inside shop dashboard** — any authenticated shop user can navigate to `/admin`
4. **No 2FA** — if the key leaks, anyone can create/manage shops
5. **No session management** — can't revoke access for a specific admin

---

## 3. Proposed Architecture

### 3.1 Database: `super_admins` Table

New migration file: `backend/internal/migrations/public/000002_create_super_admins.up.sql`

```sql
CREATE TABLE IF NOT EXISTS super_admins (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        VARCHAR(100) NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    hashed_password TEXT         NOT NULL,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS super_admin_otp (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id        UUID         NOT NULL REFERENCES super_admins(id) ON DELETE CASCADE,
    otp_code        VARCHAR(6)   NOT NULL,
    expires_at      TIMESTAMPTZ  NOT NULL,
    used            BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_super_admin_otp_admin_id ON super_admin_otp(admin_id);
CREATE INDEX idx_super_admin_otp_expires  ON super_admin_otp(expires_at);
```

**Design decisions:**
- `email` is the 2FA delivery channel (SMTP)
- OTP stored in a separate table to support expiry, one-time use, and audit
- OTP TTL: **5 minutes**
- OTP length: **6 digits**
- Passwords hashed with bcrypt (cost 12), same as tenant passwords

### 3.2 Backend: Auth Flow

#### Login — Two-Step Process

**Step 1: Credential Verification**

```
POST /super-admin/auth/login
Body: { "username": "...", "password": "..." }
Response: { "message": "OTP sent to registered email", "session_id": "uuid" }
```

1. Look up super admin by username
2. Verify password with bcrypt
3. Generate 6-digit OTP
4. Store OTP in `super_admin_otp` table with 5-min expiry
5. Send OTP to super admin's email via SMTP
6. Return a `session_id` (the OTP record UUID) — no JWT yet

**Step 2: OTP Verification**

```
POST /super-admin/auth/verify-otp
Body: { "session_id": "uuid", "otp": "123456" }
Response: { "token": "jwt-token" }
```

1. Look up OTP record by `session_id`
2. Verify OTP matches, not expired, not already used
3. Mark OTP as used
4. Issue a **Super Admin JWT** with distinct claims

#### Super Admin JWT Claims

```go
type SuperAdminClaims struct {
    AdminID  string `json:"admin_id"`
    Username string `json:"username"`
    Role     string `json:"role"` // always "super_admin"
    jwt.RegisteredClaims
}
```

- **Signed with the same `JWT_SECRET`** but distinguished by the `role` claim
- **Expiry: 4 hours** (shorter than shop tokens for security)

#### New Middleware: `SuperAdminAuth`

```go
func SuperAdminAuth(jwtSecret string) func(http.Handler) http.Handler
```

- Validates Bearer token (same as `JWTAuth`)
- Parses into `SuperAdminClaims`
- Rejects if `role != "super_admin"`
- Stores claims in context under a new key `SuperAdminClaimsKey`

This **replaces** the current `AdminAuth` middleware on all `/admin/tenants` routes.

### 3.3 Backend: SMTP Email Service

New file: `backend/internal/email/smtp.go`

```go
type SMTPConfig struct {
    Host     string // e.g., "smtp.gmail.com"
    Port     string // e.g., "587"
    Username string // e.g., "retailos.noreply@gmail.com"
    Password string // App password, not account password
    From     string // e.g., "RetailOS <retailos.noreply@gmail.com>"
}

func SendOTP(cfg SMTPConfig, to string, otp string) error
```

- Uses Go's `net/smtp` package (no external dependency)
- TLS connection via `smtp.SendMail` with `STARTTLS`
- Plain HTML email body with the OTP code

### 3.4 Backend: New Environment Variables

Add to `.env` / `.env.example`:

```env
# SMTP (for super admin 2FA)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=retailos.noreply@gmail.com
SMTP_PASSWORD=your-gmail-app-password
SMTP_FROM=RetailOS <retailos.noreply@gmail.com>
```

Update `config.go` to load these fields. `SMTP_*` variables should be **optional** — if not set, the server still starts but super admin login returns an error indicating SMTP is not configured.

### 3.5 Backend: Route Changes

**Current routes (to be removed):**
```
POST   /admin/tenants        [AdminAuth - X-Admin-Key]
GET    /admin/tenants        [AdminAuth - X-Admin-Key]
PATCH  /admin/tenants/{id}   [AdminAuth - X-Admin-Key]
```

**New routes:**
```
POST   /super-admin/auth/login       [public]
POST   /super-admin/auth/verify-otp  [public]

POST   /super-admin/tenants          [SuperAdminAuth]
GET    /super-admin/tenants          [SuperAdminAuth]
PATCH  /super-admin/tenants/{id}     [SuperAdminAuth]
```

**To remove:**
- `AdminAuth` middleware function
- `ADMIN_SECRET_KEY` env variable
- `X-Admin-Key` from CORS `AllowedHeaders`

### 3.6 Backend: SQLC Queries

New file: `backend/internal/queries/super_admins.sql`

```sql
-- name: GetSuperAdminByUsername :one
SELECT * FROM super_admins WHERE username = $1 AND is_active = TRUE;

-- name: CreateSuperAdminOTP :one
INSERT INTO super_admin_otp (admin_id, otp_code, expires_at)
VALUES ($1, $2, NOW() + INTERVAL '5 minutes')
RETURNING *;

-- name: VerifyOTP :one
SELECT sa_otp.*, sa.username, sa.email
FROM super_admin_otp sa_otp
JOIN super_admins sa ON sa.id = sa_otp.admin_id
WHERE sa_otp.id = $1
  AND sa_otp.otp_code = $2
  AND sa_otp.used = FALSE
  AND sa_otp.expires_at > NOW();

-- name: MarkOTPUsed :exec
UPDATE super_admin_otp SET used = TRUE WHERE id = $1;

-- name: CleanExpiredOTPs :exec
DELETE FROM super_admin_otp WHERE expires_at < NOW();
```

### 3.7 Frontend: Route Restructure

**Current:**
```
frontend/app/
  (dashboard)/
    admin/page.tsx     <-- shop users can navigate here
    billing/page.tsx
    inventory/page.tsx
    ...
```

**Proposed:**
```
frontend/app/
  (dashboard)/
    billing/page.tsx
    inventory/page.tsx
    ...                <-- no admin page here
  super-admin/
    layout.tsx         <-- standalone layout with auth guard, no shop sidebar
    login/page.tsx     <-- /super-admin/login
    dashboard/page.tsx <-- /super-admin/dashboard (shop management)
```

- Uses a `super-admin/` directory (not a route group) so URLs map to `/super-admin/*`
- The layout acts as the auth guard — redirects to login if no `sa_token` in localStorage
- Completely separate from shop auth — shop tokens and super admin tokens stored under different localStorage keys

### 3.8 Frontend: Super Admin Login Flow

**Page: `/super-admin/login`**

1. **Step 1 — Credentials form**
   - Username + Password fields
   - On submit: `POST /super-admin/auth/login`
   - On success: show OTP input, store `session_id` in component state

2. **Step 2 — OTP verification**
   - 6-digit OTP input field
   - On submit: `POST /super-admin/auth/verify-otp` with `session_id` + `otp`
   - On success: store `sa_token` in localStorage, redirect to `/super-admin/dashboard`

**Page: `/super-admin/dashboard`**

- Same UI as current admin page (tenant list, create shop dialog, activate/deactivate)
- API calls use `sa_token` instead of `X-Admin-Key`
- Calls go to `/super-admin/tenants` instead of `/admin/tenants`

### 3.9 Frontend: API Client Changes

Update `frontend/lib/api.ts`:

```typescript
// Remove: X-Admin-Key header from all admin calls
// Add: new super admin methods

export const superAdminApi = {
  login: (username: string, password: string) =>
    request<{ message: string; session_id: string }>(
      '/super-admin/auth/login',
      { method: 'POST', body: JSON.stringify({ username, password }) }
    ),

  verifyOTP: (session_id: string, otp: string) =>
    request<{ token: string }>(
      '/super-admin/auth/verify-otp',
      { method: 'POST', body: JSON.stringify({ session_id, otp }) }
    ),

  listTenants: () =>
    request('/super-admin/tenants', {
      headers: { 'Authorization': `Bearer ${getSuperAdminToken()}` },
    }),

  createTenant: (data: { ... }) =>
    request('/super-admin/tenants', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Authorization': `Bearer ${getSuperAdminToken()}` },
    }),

  setTenantActive: (id: string, is_active: boolean) =>
    request(`/super-admin/tenants/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active }),
      headers: { 'Authorization': `Bearer ${getSuperAdminToken()}` },
    }),
}
```

### 3.10 Frontend: Cleanup

- **Delete** `frontend/app/(dashboard)/admin/page.tsx`
- **Remove** `NEXT_PUBLIC_ADMIN_KEY` from `.env` / `.env.example` / `.env.local`
- **Sidebar** already has no Admin link (previously removed from `NAV` array)
- **Remove** `createTenant`, `listTenants`, `setTenantActive` from the shop `api` object

---

## 4. Seeding the First Super Admin

Since the super admin system protects itself (can't create admins from the UI), the first super admin must be seeded manually.

### Option A: SQL Seed Script

Create `backend/internal/migrations/public/000002_seed_super_admin.sql` (run once):

```sql
-- Generate a bcrypt hash for the password externally, then:
INSERT INTO super_admins (username, email, hashed_password)
VALUES ('admin', 'founder@retailos.in', '<bcrypt-hash-here>');
```

### Option B: CLI Seed Command

Create `backend/cmd/seed-admin/main.go`:

```go
// Usage: go run ./cmd/seed-admin --username=admin --email=founder@retailos.in --password=secret
```

This is the **recommended approach** — avoids putting hashed passwords in migration files and can be rerun safely.

---

## 5. Security Considerations

| Concern | Mitigation |
|---------|------------|
| Brute-force OTP | Rate limit `/super-admin/auth/verify-otp` to 5 attempts per session_id. Lock after 5 failures. |
| Brute-force login | Rate limit `/super-admin/auth/login` to 5 attempts per IP per 15 minutes |
| OTP replay | Mark OTP as `used = TRUE` after successful verification |
| Stale OTPs | 5-minute TTL + periodic cleanup via `CleanExpiredOTPs` query |
| Token theft | 4-hour JWT expiry. No refresh tokens — re-authenticate with 2FA. |
| Shop user accessing super admin routes | `SuperAdminAuth` middleware rejects tokens without `role: "super_admin"` claim |
| Frontend route guessing | `SuperAdminGuard` redirects to `/super-admin/login` if no `sa_token`. Backend rejects regardless. |
| SMTP credentials | Stored in env vars, never committed. Use Gmail App Passwords (not account password). |
| Existing `X-Admin-Key` | Completely removed — no fallback, no backward compatibility |

---

## 6. Implementation Checklist

### Phase 1: Backend — Database & Auth

- [ ] Create migration `000002_create_super_admins.up.sql` (both tables + indexes)
- [ ] Create corresponding `down` migration
- [ ] Write SQLC queries for super admin operations
- [ ] Run `sqlc generate`
- [ ] Add SMTP config fields to `config.go`
- [ ] Create `internal/email/smtp.go` — `SendOTP()` function
- [ ] Create `SuperAdminClaims` struct in `middleware/auth.go`
- [ ] Create `SuperAdminAuth` middleware in `middleware/auth.go`
- [ ] Create `internal/handlers/superadmin.go` — `Login`, `VerifyOTP` handlers
- [ ] Update `admin.go` handlers to use `SuperAdminClaims` from context (for audit trail)
- [ ] Update `cmd/server/main.go` — new routes under `/super-admin/`
- [ ] Remove `AdminAuth` middleware
- [ ] Remove `ADMIN_SECRET_KEY` from config
- [ ] Remove `X-Admin-Key` from CORS allowed headers
- [ ] Add SMTP env vars to `.env.example`
- [ ] Create `cmd/seed-admin/main.go` CLI tool

### Phase 2: Frontend — New Super Admin UI

- [ ] Create `app/super-admin/layout.tsx` — standalone layout with auth guard (no sidebar)
- [ ] Create `app/super-admin/login/page.tsx` — two-step login (credentials + OTP)
- [ ] Create `app/super-admin/dashboard/page.tsx` — move shop management UI here
- [ ] Create `lib/super-admin-api.ts` — dedicated API client with `sa_token` auth

### Phase 3: Cleanup

- [ ] Delete `app/(dashboard)/admin/page.tsx`
- [ ] Remove `createTenant`, `listTenants`, `setTenantActive` from shop `api` object
- [ ] Remove `NEXT_PUBLIC_ADMIN_KEY` from all env files
- [ ] Verify sidebar has no admin link (already done)
- [ ] Seed first super admin in production database

### Phase 4: Testing

- [ ] Test: shop user cannot access `/super-admin/*` routes (backend returns 401)
- [ ] Test: shop user navigating to `/super-admin/dashboard` gets redirected to super admin login
- [ ] Test: super admin login with wrong password returns error
- [ ] Test: super admin login with correct password sends OTP email
- [ ] Test: wrong OTP is rejected
- [ ] Test: expired OTP (after 5 min) is rejected
- [ ] Test: reused OTP is rejected
- [ ] Test: correct OTP returns valid JWT
- [ ] Test: super admin JWT can create/list/toggle tenants
- [ ] Test: shop JWT cannot access `/super-admin/tenants` routes
- [ ] Test: `ADMIN_SECRET_KEY` / `X-Admin-Key` no longer exists anywhere in codebase

---

## 7. Environment Variables Summary

### To Add

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=retailos.noreply@gmail.com
SMTP_PASSWORD=<gmail-app-password>
SMTP_FROM=RetailOS <retailos.noreply@gmail.com>
```

### To Remove

```env
ADMIN_SECRET_KEY=...          # backend
NEXT_PUBLIC_ADMIN_KEY=...     # frontend
```

---

## 8. Gmail SMTP Setup (For Reference)

1. Use or create a Google account for `retailos.noreply@gmail.com`
2. Enable 2-Step Verification on the Google account
3. Go to Google Account > Security > App Passwords
4. Generate an app password for "Mail"
5. Use that 16-character app password as `SMTP_PASSWORD`
6. Free tier: ~500 emails/day (more than enough for a few super admin logins)

---

## 9. File Map — All Files to Create or Modify

### New Files

| File | Purpose |
|------|---------|
| `backend/internal/migrations/public/000002_create_super_admins.up.sql` | Super admin + OTP tables |
| `backend/internal/migrations/public/000002_create_super_admins.down.sql` | Rollback migration |
| `backend/internal/queries/super_admins.sql` | SQLC queries |
| `backend/internal/email/smtp.go` | OTP email sender |
| `backend/internal/handlers/superadmin.go` | Login + VerifyOTP handlers |
| `backend/cmd/seed-admin/main.go` | CLI to seed first super admin |
| `frontend/app/super-admin/layout.tsx` | Standalone layout with built-in auth guard |
| `frontend/app/super-admin/login/page.tsx` | Two-step login page (credentials + OTP) |
| `frontend/app/super-admin/dashboard/page.tsx` | Shop management dashboard |
| `frontend/lib/super-admin-api.ts` | Dedicated API client for super admin endpoints |

### Modified Files

| File | Changes |
|------|---------|
| `backend/internal/middleware/auth.go` | Add `SuperAdminClaims`, `SuperAdminAuth` middleware. Remove `AdminAuth`. |
| `backend/internal/config/config.go` | Add SMTP fields. Remove `AdminSecretKey`. |
| `backend/cmd/server/main.go` | New `/super-admin/` routes. Remove old `/admin/` route group. |
| `backend/.env.example` | Add SMTP vars. Remove `ADMIN_SECRET_KEY`. |
| `backend/sqlc.yaml` | Add super admin queries path |
| `frontend/lib/api.ts` | Add `superAdminApi`. Remove admin methods from `api`. |

### Deleted Files

| File | Reason |
|------|--------|
| `frontend/app/(dashboard)/admin/page.tsx` | Replaced by `(superadmin)/dashboard/page.tsx` |
