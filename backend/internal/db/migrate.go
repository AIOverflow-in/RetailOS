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
// We execute the SQL files directly (instead of golang-migrate) so we can control
// search_path precisely via the same pgxpool connection.
func RunTenantMigrations(ctx context.Context, pool *pgxpool.Pool, schemaName string, _ string) error {
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("acquire connection: %w", err)
	}
	defer conn.Release()

	// Create the schema
	if _, err := conn.Exec(ctx, fmt.Sprintf("CREATE SCHEMA IF NOT EXISTS %s", schemaName)); err != nil {
		return fmt.Errorf("create schema %s: %w", schemaName, err)
	}

	// Set search_path so all subsequent DDL lands in the tenant schema
	if _, err := conn.Exec(ctx, fmt.Sprintf("SET search_path TO %s, public", schemaName)); err != nil {
		return fmt.Errorf("set search_path: %w", err)
	}

	// Run each migration file in order
	migrationFiles := []string{
		"internal/migrations/tenant/000001_create_products.up.sql",
		"internal/migrations/tenant/000002_create_batches.up.sql",
		"internal/migrations/tenant/000003_create_customers.up.sql",
		"internal/migrations/tenant/000004_create_orders.up.sql",
		"internal/migrations/tenant/000005_create_order_items.up.sql",
	}

	for _, f := range migrationFiles {
		sql, err := os.ReadFile(f)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", f, err)
		}
		if _, err := conn.Exec(ctx, string(sql)); err != nil {
			return fmt.Errorf("run migration %s: %w", f, err)
		}
	}

	// Reset search_path before releasing connection
	conn.Exec(ctx, "SET search_path TO public")

	log.Printf("Tenant schema %s provisioned successfully", schemaName)
	return nil
}
