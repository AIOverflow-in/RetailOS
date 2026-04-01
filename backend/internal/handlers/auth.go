package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/retail-os/backend/internal/generated"
	"github.com/retail-os/backend/internal/middleware"
)

type AuthHandler struct {
	pool      *pgxpool.Pool
	jwtSecret string
}

func NewAuthHandler(pool *pgxpool.Pool, jwtSecret string) *AuthHandler {
	return &AuthHandler{pool: pool, jwtSecret: jwtSecret}
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type loginResponse struct {
	Token      string `json:"token"`
	ShopName   string `json:"shop_name"`
	SchemaName string `json:"schema_name"`
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Username == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "username and password are required")
		return
	}

	q := generated.New(h.pool)
	tenant, err := q.GetTenantByUsername(r.Context(), req.Username)
	if err != nil {
		// Use generic message to avoid username enumeration
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	if !tenant.IsActive {
		writeError(w, http.StatusForbidden, "shop account is inactive. Please contact support.")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(tenant.HashedPassword), []byte(req.Password)); err != nil {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	claims := &middleware.Claims{
		TenantID:    tenant.TenantID.String(),
		SchemaName:  tenant.SchemaName,
		Username:    tenant.Username,
		OrderPrefix: tenant.OrderPrefix,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(8 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(h.jwtSecret))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not generate token")
		return
	}

	writeJSON(w, http.StatusOK, loginResponse{
		Token:      signed,
		ShopName:   tenant.ShopName,
		SchemaName: tenant.SchemaName,
	})
}
