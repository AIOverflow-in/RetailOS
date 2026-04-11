package main

import (
	"context"
	"fmt"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/retail-os/backend/internal/config"
	"github.com/retail-os/backend/internal/db"
	"github.com/retail-os/backend/internal/email"
	"github.com/retail-os/backend/internal/handlers"
	"github.com/retail-os/backend/internal/middleware"
	"github.com/rs/cors"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()

	// Run public migrations on startup (idempotent)
	if err := db.RunPublicMigrations(cfg.DatabaseURL); err != nil {
		log.Fatalf("public migrations failed: %v", err)
	}

	// Connect pool
	pool, err := db.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db connection failed: %v", err)
	}
	defer pool.Close()

	// Run tenant migrations on all existing tenants
	if err := db.MigrateAllTenants(ctx, pool); err != nil {
		log.Printf("WARNING: tenant migrations had errors: %v", err)
	}

	// Handlers
	authHandler := handlers.NewAuthHandler(pool, cfg.JWTSecret)
	adminHandler := handlers.NewAdminHandler(pool, cfg.DatabaseURL)
	smtpCfg := email.SMTPConfig{
		Host:         cfg.SMTPHost,
		Port:         cfg.SMTPPort,
		Username:     cfg.SMTPUsername,
		Password:     cfg.SMTPPassword,
		From:         cfg.SMTPFrom,
		ResendAPIKey: cfg.ResendAPIKey,
		ResendFrom:   cfg.ResendFromAddr,
		Environment:  cfg.Environment,
	}
	superAdminHandler := handlers.NewSuperAdminHandler(pool, cfg.JWTSecret, smtpCfg)
	inventoryHandler := handlers.NewInventoryHandler(pool)
	customerHandler := handlers.NewCustomerHandler(pool)
	orderHandler := handlers.NewOrderHandler(pool)
	stockAdjHandler := handlers.NewStockAdjustmentHandler(pool)
	dashboardHandler := handlers.NewDashboardHandler(pool)
	reportHandler := handlers.NewReportHandler(pool)

	// Router
	r := chi.NewRouter()
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "http://localhost:3001", "https://*.vercel.app"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
	}).Handler)

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})

	// Rate limiter for login endpoints: 5 attempts per 10 seconds, burst of 5
	loginLimiter := middleware.NewRateLimiter(0.5, 5)

	// Auth
	r.With(loginLimiter.Limit).Post("/auth/login", authHandler.Login)

	// Super admin routes — only available in dev/development environment
	if cfg.Environment == "dev" || cfg.Environment == "development" {
		log.Println("Super admin routes enabled (ENVIRONMENT=" + cfg.Environment + ")")

		r.Post("/super-admin/auth/login", superAdminHandler.Login)
		r.Post("/super-admin/auth/verify-otp", superAdminHandler.VerifyOTP)

		r.Group(func(r chi.Router) {
			r.Use(middleware.SuperAdminAuth(cfg.JWTSecret))
			r.Post("/super-admin/tenants", adminHandler.CreateTenant)
			r.Get("/super-admin/tenants", adminHandler.ListTenants)
			r.Patch("/super-admin/tenants/{id}", adminHandler.SetTenantActive)
		})
	} else {
		log.Println("Super admin routes disabled (ENVIRONMENT=" + cfg.Environment + ")")
	}

	// Tenant-scoped routes (JWT + search_path middleware)
	r.Group(func(r chi.Router) {
		r.Use(middleware.JWTAuth(cfg.JWTSecret))
		r.Use(middleware.TenantContext(pool))

		// Dashboard
		r.Get("/dashboard", dashboardHandler.GetDashboard)

		// Inventory
		r.Get("/products", inventoryHandler.ListProducts)
		r.Post("/products", inventoryHandler.CreateProduct)
		r.Put("/products/{id}", inventoryHandler.UpdateProduct)
		r.Get("/batches/active", inventoryHandler.ListActiveBatches)
		r.Get("/batches", inventoryHandler.ListBatches)
		r.Post("/batches", inventoryHandler.CreateBatch)
		r.Put("/batches/{id}", inventoryHandler.UpdateBatch)
		r.Get("/inventory", inventoryHandler.ListInventory)

		// Stock Adjustments
		r.Post("/stock-adjustments", stockAdjHandler.CreateAdjustment)
		r.Get("/stock-adjustments", stockAdjHandler.ListAdjustments)

		// Customers
		r.Get("/customers", customerHandler.LookupCustomer)
		r.Put("/customers/{id}", customerHandler.UpdateCustomer)

		// Orders
		r.Post("/orders", orderHandler.CreateOrder)
		r.Get("/orders", orderHandler.ListOrders)
		r.Get("/orders/{id}", orderHandler.GetOrder)
		r.Delete("/orders/{id}", orderHandler.SoftDeleteOrder)
		r.Post("/orders/{id}/return", orderHandler.ReturnOrder)

		// Reports
		r.Get("/reports/gst", reportHandler.GSTReport)
		r.Get("/reports/gst/export", reportHandler.GSTReportCSV)
	})

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("RetailOS API listening on %s", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
