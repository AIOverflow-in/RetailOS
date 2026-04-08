package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const testSecret = "test-jwt-secret-for-unit-tests-32bytes"

// ---------------------------------------------------------------------------
// Helper: generate a signed tenant JWT
// ---------------------------------------------------------------------------

func signTenantToken(claims *Claims, secret string) string {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	s, _ := token.SignedString([]byte(secret))
	return s
}

func signSuperAdminToken(claims *SuperAdminClaims, secret string) string {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	s, _ := token.SignedString([]byte(secret))
	return s
}

func dummyHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})
}

// ---------------------------------------------------------------------------
// JWTAuth middleware
// ---------------------------------------------------------------------------

func TestJWTAuth_ValidToken(t *testing.T) {
	claims := &Claims{
		TenantID:    "tenant-123",
		SchemaName:  "tenant_abc",
		Username:    "shopowner",
		OrderPrefix: "INV",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := signTenantToken(claims, testSecret)

	req := httptest.NewRequest(http.MethodGet, "/products", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	w := httptest.NewRecorder()
	handler := JWTAuth(testSecret)(dummyHandler())
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d; body = %s", w.Code, http.StatusOK, w.Body.String())
	}
}

func TestJWTAuth_MissingHeader(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/products", nil)
	w := httptest.NewRecorder()

	handler := JWTAuth(testSecret)(dummyHandler())
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

func TestJWTAuth_MalformedHeader(t *testing.T) {
	tests := []struct {
		name   string
		header string
	}{
		{"no bearer prefix", "Token abc123"},
		{"empty bearer", "Bearer "},
		{"just bearer", "Bearer"},
		{"basic auth", "Basic dXNlcjpwYXNz"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/products", nil)
			req.Header.Set("Authorization", tt.header)
			w := httptest.NewRecorder()

			handler := JWTAuth(testSecret)(dummyHandler())
			handler.ServeHTTP(w, req)

			if w.Code != http.StatusUnauthorized {
				t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
			}
		})
	}
}

func TestJWTAuth_ExpiredToken(t *testing.T) {
	claims := &Claims{
		TenantID:   "tenant-123",
		SchemaName: "tenant_abc",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
		},
	}
	token := signTenantToken(claims, testSecret)

	req := httptest.NewRequest(http.MethodGet, "/products", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	w := httptest.NewRecorder()
	handler := JWTAuth(testSecret)(dummyHandler())
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

func TestJWTAuth_WrongSecret(t *testing.T) {
	claims := &Claims{
		TenantID:   "tenant-123",
		SchemaName: "tenant_abc",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
		},
	}
	token := signTenantToken(claims, "wrong-secret")

	req := httptest.NewRequest(http.MethodGet, "/products", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	w := httptest.NewRecorder()
	handler := JWTAuth(testSecret)(dummyHandler())
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

func TestJWTAuth_InvalidSigningMethod(t *testing.T) {
	// Create a token with "none" signing method
	token := jwt.NewWithClaims(jwt.SigningMethodNone, &Claims{
		TenantID:   "tenant-123",
		SchemaName: "tenant_abc",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
		},
	})
	tokenStr, _ := token.SignedString(jwt.UnsafeAllowNoneSignatureType)

	req := httptest.NewRequest(http.MethodGet, "/products", nil)
	req.Header.Set("Authorization", "Bearer "+tokenStr)

	w := httptest.NewRecorder()
	handler := JWTAuth(testSecret)(dummyHandler())
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

func TestJWTAuth_ClaimsInContext(t *testing.T) {
	claims := &Claims{
		TenantID:    "tenant-456",
		SchemaName:  "tenant_xyz",
		Username:    "testuser",
		OrderPrefix: "TST",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
		},
	}
	token := signTenantToken(claims, testSecret)

	var extractedClaims *Claims
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		extractedClaims = ClaimsFromCtx(r.Context())
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	w := httptest.NewRecorder()
	JWTAuth(testSecret)(inner).ServeHTTP(w, req)

	if extractedClaims == nil {
		t.Fatal("claims not found in context")
	}
	if extractedClaims.TenantID != "tenant-456" {
		t.Errorf("TenantID = %q, want %q", extractedClaims.TenantID, "tenant-456")
	}
	if extractedClaims.SchemaName != "tenant_xyz" {
		t.Errorf("SchemaName = %q, want %q", extractedClaims.SchemaName, "tenant_xyz")
	}
	if extractedClaims.Username != "testuser" {
		t.Errorf("Username = %q, want %q", extractedClaims.Username, "testuser")
	}
	if extractedClaims.OrderPrefix != "TST" {
		t.Errorf("OrderPrefix = %q, want %q", extractedClaims.OrderPrefix, "TST")
	}
}

// ---------------------------------------------------------------------------
// SuperAdminAuth middleware
// ---------------------------------------------------------------------------

func TestSuperAdminAuth_ValidToken(t *testing.T) {
	claims := &SuperAdminClaims{
		AdminID:  "admin-789",
		Username: "superadmin",
		Role:     "super_admin",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
		},
	}
	token := signSuperAdminToken(claims, testSecret)

	req := httptest.NewRequest(http.MethodGet, "/super-admin/tenants", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	w := httptest.NewRecorder()
	handler := SuperAdminAuth(testSecret)(dummyHandler())
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d; body = %s", w.Code, http.StatusOK, w.Body.String())
	}
}

func TestSuperAdminAuth_WrongRole(t *testing.T) {
	claims := &SuperAdminClaims{
		AdminID:  "admin-789",
		Username: "normaluser",
		Role:     "tenant",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
		},
	}
	token := signSuperAdminToken(claims, testSecret)

	req := httptest.NewRequest(http.MethodGet, "/super-admin/tenants", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	w := httptest.NewRecorder()
	handler := SuperAdminAuth(testSecret)(dummyHandler())
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("status = %d, want %d", w.Code, http.StatusForbidden)
	}
}

func TestSuperAdminAuth_MissingHeader(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/super-admin/tenants", nil)
	w := httptest.NewRecorder()

	handler := SuperAdminAuth(testSecret)(dummyHandler())
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

func TestSuperAdminAuth_ExpiredToken(t *testing.T) {
	claims := &SuperAdminClaims{
		AdminID: "admin-789",
		Role:    "super_admin",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)),
		},
	}
	token := signSuperAdminToken(claims, testSecret)

	req := httptest.NewRequest(http.MethodGet, "/super-admin/tenants", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	w := httptest.NewRecorder()
	handler := SuperAdminAuth(testSecret)(dummyHandler())
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

func TestSuperAdminAuth_ClaimsInContext(t *testing.T) {
	claims := &SuperAdminClaims{
		AdminID:  "admin-abc",
		Username: "boss",
		Role:     "super_admin",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
		},
	}
	token := signSuperAdminToken(claims, testSecret)

	var extracted *SuperAdminClaims
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		extracted = SuperAdminClaimsFromCtx(r.Context())
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	w := httptest.NewRecorder()
	SuperAdminAuth(testSecret)(inner).ServeHTTP(w, req)

	if extracted == nil {
		t.Fatal("super admin claims not found in context")
	}
	if extracted.AdminID != "admin-abc" {
		t.Errorf("AdminID = %q, want %q", extracted.AdminID, "admin-abc")
	}
	if extracted.Role != "super_admin" {
		t.Errorf("Role = %q, want %q", extracted.Role, "super_admin")
	}
}

// ---------------------------------------------------------------------------
// ClaimsFromCtx / SuperAdminClaimsFromCtx — nil safety
// ---------------------------------------------------------------------------

func TestClaimsFromCtx_NilContext(t *testing.T) {
	ctx := context.Background()
	c := ClaimsFromCtx(ctx)
	if c != nil {
		t.Errorf("expected nil claims from empty context, got %v", c)
	}
}

func TestSuperAdminClaimsFromCtx_NilContext(t *testing.T) {
	ctx := context.Background()
	c := SuperAdminClaimsFromCtx(ctx)
	if c != nil {
		t.Errorf("expected nil claims from empty context, got %v", c)
	}
}

// ---------------------------------------------------------------------------
// JWT error response format
// ---------------------------------------------------------------------------

func TestJWTAuth_ErrorResponseFormat(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/products", nil)
	w := httptest.NewRecorder()

	handler := JWTAuth(testSecret)(dummyHandler())
	handler.ServeHTTP(w, req)

	var body map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("response is not valid JSON: %v, body: %s", err, w.Body.String())
	}
	if body["error"] == "" {
		t.Error("expected error field in response")
	}
}
