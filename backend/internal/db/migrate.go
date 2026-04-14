package db

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5/pgxpool"
)

// tenantMigrations is the single source of truth for tenant schema migrations.
// IMPORTANT: New migration files must be added here to be applied to existing tenants.
var tenantMigrations = []string{
	"internal/migrations/tenant/000001_create_products.up.sql",
	"internal/migrations/tenant/000002_create_batches.up.sql",
	"internal/migrations/tenant/000003_create_customers.up.sql",
	"internal/migrations/tenant/000004_create_orders.up.sql",
	"internal/migrations/tenant/000005_create_order_items.up.sql",
	"internal/migrations/tenant/000006_add_payment_mode_to_orders.up.sql",
	"internal/migrations/tenant/000007_create_stock_adjustments.up.sql",
	"internal/migrations/tenant/000008_add_purchase_gst_to_batches.up.sql",
}

// RunPublicMigrations runs migrations in migrations/public/ against the public schema.
// Called once on server startup.
func RunPublicMigrations(databaseURL string) error {
	m, err := migrate.New(
		"file://internal/migrations/public",
		databaseURL,
	)
	if err != nil {
		return fmt.Errorf("create public migrator: %w", err)
	}
	defer m.Close()

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("run public migrations: %w", err)
	}

	log.Println("Public schema migrations applied")
	return nil
}

// RunTenantMigrations provisions a new tenant schema and runs all tenant migrations.
func RunTenantMigrations(ctx context.Context, pool *pgxpool.Pool, schemaName string, _ string) error {
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("acquire connection: %w", err)
	}
	defer conn.Release()

	if _, err := conn.Exec(ctx, fmt.Sprintf("CREATE SCHEMA IF NOT EXISTS %s", schemaName)); err != nil {
		return fmt.Errorf("create schema %s: %w", schemaName, err)
	}

	if _, err := conn.Exec(ctx, fmt.Sprintf("SET search_path TO %s, public", schemaName)); err != nil {
		return fmt.Errorf("set search_path: %w", err)
	}

	for _, f := range tenantMigrations {
		sql, err := os.ReadFile(f)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", f, err)
		}
		if _, err := conn.Exec(ctx, string(sql)); err != nil {
			return fmt.Errorf("run migration %s: %w", f, err)
		}
	}

	conn.Exec(ctx, "SET search_path TO public")
	log.Printf("Tenant schema %s provisioned successfully", schemaName)
	return nil
}

// MigrateAllTenants runs tenant migrations on every existing tenant schema.
// Migrations must be idempotent (IF NOT EXISTS / IF NOT COLUMN).
func MigrateAllTenants(ctx context.Context, pool *pgxpool.Pool) error {
	rows, err := pool.Query(ctx, "SELECT schema_name FROM tenants")
	if err != nil {
		return fmt.Errorf("list tenants: %w", err)
	}
	defer rows.Close()

	var schemas []string
	for rows.Next() {
		var s string
		if err := rows.Scan(&s); err != nil {
			return fmt.Errorf("scan tenant schema: %w", err)
		}
		schemas = append(schemas, s)
	}

	for _, schema := range schemas {
		conn, err := pool.Acquire(ctx)
		if err != nil {
			return fmt.Errorf("acquire connection for %s: %w", schema, err)
		}

		if _, err := conn.Exec(ctx, fmt.Sprintf("SET search_path TO %s, public", schema)); err != nil {
			conn.Release()
			return fmt.Errorf("set search_path for %s: %w", schema, err)
		}

		migrationErrors := 0
		for _, f := range tenantMigrations {
			sql, err := os.ReadFile(f)
			if err != nil {
				conn.Release()
				return fmt.Errorf("read migration %s: %w", f, err)
			}
			if _, err := conn.Exec(ctx, string(sql)); err != nil {
				log.Printf("WARNING: Migration %s on %s FAILED: %v", f, schema, err)
				migrationErrors++
			} else {
				log.Printf("Migration %s on %s: OK", f, schema)
			}
		}

		conn.Exec(ctx, "SET search_path TO public")
		conn.Release()
		if migrationErrors > 0 {
			log.Printf("Tenant %s migrations completed with %d error(s) — check warnings above", schema, migrationErrors)
		} else {
			log.Printf("Tenant %s migrations applied successfully", schema)
		}
	}

	return nil
}
