# RetailOS — Dev Guide

## Prerequisites

- Go 1.22+
- Node.js 20+
- `sqlc` — `brew install sqlc`

---

## Backend


### Run

```bash
cd backend
go run ./cmd/server
# → listening on :8080
```

### After changing SQL queries

```bash
cd backend
sqlc generate   # regenerates internal/generated/
go build ./...  # verify it compiles
```

---

## Frontend

### ENV (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_ADMIN_KEY=retailos-admin-2025
```

### Run

```bash
cd frontend
npm install     # first time only
npm run dev
# → http://localhost:3000  (or 3001 if 3000 is taken)
```

---

## Login Credentials

| Field    | Value       |
|----------|-------------|
| Username | `testshop`  |
| Password | `test123`   |
| Shop     | Test Medical Store |

Admin key (for `/admin` page): `retailos-admin-2025`

---

## Stack

| Layer     | Tech                              |
|-----------|-----------------------------------|
| Frontend  | Next.js 16, Redux Toolkit, Tailwind CSS |
| Backend   | Go + chi router, sqlc, pgx        |
| Database  | PostgreSQL (NeonDB, serverless)    |

---

## Common Commands

```bash
# Build backend binary
cd backend && go build -o retailos ./cmd/server

# Check backend health
curl http://localhost:8080/health

# Lint frontend
cd frontend && npm run lint

# Type-check frontend
cd frontend && npx tsc --noEmit
```

---

## Ports

| Service  | Port |
|----------|------|
| Backend  | 8080 |
| Frontend | 3000 |
