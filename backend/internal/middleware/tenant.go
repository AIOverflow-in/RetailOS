package middleware

import (
	"context"
	"fmt"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

// TenantContext acquires a DB connection, sets the search_path to the tenant's
// schema, and stores the connection in the request context.
// The connection is reset and released after the handler returns.
func TenantContext(pool *pgxpool.Pool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := ClaimsFromCtx(r.Context())
			if claims == nil {
				http.Error(w, `{"error":"no tenant claims"}`, http.StatusUnauthorized)
				return
			}

			conn, err := pool.Acquire(r.Context())
			if err != nil {
				http.Error(w, `{"error":"db unavailable"}`, http.StatusServiceUnavailable)
				return
			}
			defer func() {
				// Reset search_path to public before returning to pool
				conn.Exec(context.Background(), "SET search_path TO public")
				conn.Release()
			}()

			_, err = conn.Exec(r.Context(),
				fmt.Sprintf("SET search_path TO %s, public", claims.SchemaName))
			if err != nil {
				http.Error(w, `{"error":"tenant context error"}`, http.StatusInternalServerError)
				return
			}

			ctx := context.WithValue(r.Context(), ConnKey, conn)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// ConnFromCtx retrieves the tenant-scoped DB connection from context.
func ConnFromCtx(ctx context.Context) *pgxpool.Conn {
	c, _ := ctx.Value(ConnKey).(*pgxpool.Conn)
	return c
}
