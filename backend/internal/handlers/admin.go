package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/retail-os/backend/internal/db"
	"github.com/retail-os/backend/internal/generated"
)

type AdminHandler struct {
	pool        *pgxpool.Pool
	databaseURL string
}

func NewAdminHandler(pool *pgxpool.Pool, databaseURL string) *AdminHandler {
	return &AdminHandler{pool: pool, databaseURL: databaseURL}
}

type createTenantRequest struct {
	ShopName    string `json:"shop_name"`
	Username    string `json:"username"`
	Password    string `json:"password"`
	OrderPrefix string `json:"order_prefix"`
}

func (h *AdminHandler) CreateTenant(w http.ResponseWriter, r *http.Request) {
	var req createTenantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.ShopName == "" || req.Username == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "shop_name, username, and password are required")
		return
	}

	if req.OrderPrefix == "" {
		req.OrderPrefix = "INV"
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not hash password")
		return
	}

	schemaName := fmt.Sprintf("tenant_%s", randomHex(8))

	q := generated.New(h.pool)
	tenant, err := q.CreateTenant(r.Context(), generated.CreateTenantParams{
		ShopName:       req.ShopName,
		SchemaName:     schemaName,
		OrderPrefix:    req.OrderPrefix,
		Username:       req.Username,
		HashedPassword: string(hashed),
	})
	if err != nil {
		writeError(w, http.StatusConflict, "username already exists or db error: "+err.Error())
		return
	}

	// Provision tenant schema + run migrations
	if err := db.RunTenantMigrations(r.Context(), h.pool, schemaName, h.databaseURL); err != nil {
		writeError(w, http.StatusInternalServerError, "schema provisioning failed: "+err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, tenant)
}

func (h *AdminHandler) ListTenants(w http.ResponseWriter, r *http.Request) {
	q := generated.New(h.pool)
	tenants, err := q.ListTenants(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not fetch tenants")
		return
	}
	writeJSON(w, http.StatusOK, tenants)
}

func (h *AdminHandler) SetTenantActive(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")

	var body struct {
		IsActive bool `json:"is_active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	var id pgtype.UUID
	if err := id.Scan(idStr); err != nil {
		writeError(w, http.StatusBadRequest, "invalid tenant id")
		return
	}

	q := generated.New(h.pool)
	if err := q.SetTenantActive(context.Background(), generated.SetTenantActiveParams{
		TenantID: id,
		IsActive: body.IsActive,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "update failed")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func randomHex(n int) string {
	const chars = "abcdef0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = chars[rand.Intn(len(chars))]
	}
	return string(b)
}
