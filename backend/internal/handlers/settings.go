package handlers

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/retail-os/backend/internal/generated"
	"github.com/retail-os/backend/internal/middleware"
)

type SettingsHandler struct{ pool *pgxpool.Pool }

func NewSettingsHandler(pool *pgxpool.Pool) *SettingsHandler {
	return &SettingsHandler{pool: pool}
}

// GetSettings handles GET /settings — returns the tenant's settings JSON.
func (h *SettingsHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromCtx(r.Context())
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "missing claims")
		return
	}

	var tid pgtype.UUID
	if err := tid.Scan(claims.TenantID); err != nil {
		writeError(w, http.StatusBadRequest, "invalid tenant id")
		return
	}

	// Query the public tenants table directly via the pool, bypassing the
	// per-tenant search_path set by the TenantContext middleware.
	q := generated.New(h.pool)
	settings, err := q.GetTenantSettings(r.Context(), tid)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not fetch settings")
		return
	}

	// settings is a []byte containing JSON; write it directly so we preserve
	// the original structure (and return `{}` for empty settings).
	if len(settings) == 0 {
		settings = []byte("{}")
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(settings)
}

// UpdateSettings handles PUT /settings — replaces the tenant's settings JSON.
func (h *SettingsHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromCtx(r.Context())
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "missing claims")
		return
	}

	var tid pgtype.UUID
	if err := tid.Scan(claims.TenantID); err != nil {
		writeError(w, http.StatusBadRequest, "invalid tenant id")
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "could not read body")
		return
	}

	// Validate that the body is a JSON object.
	var obj map[string]interface{}
	if err := json.Unmarshal(body, &obj); err != nil {
		writeError(w, http.StatusBadRequest, "body must be a JSON object")
		return
	}

	// Re-marshal to canonical form.
	normalized, err := json.Marshal(obj)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not encode settings")
		return
	}

	// Use raw Exec with the JSON as a string so pgx's simple protocol
	// serializes it as a text literal (cast to jsonb in SQL). Passing the
	// generated []byte param would be encoded as bytea and fail to cast.
	if _, err := h.pool.Exec(r.Context(),
		"UPDATE tenants SET settings = $2::jsonb WHERE tenant_id = $1",
		tid, string(normalized),
	); err != nil {
		writeError(w, http.StatusInternalServerError, "could not update settings: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(normalized)
}
