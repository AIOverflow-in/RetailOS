package main

import (
	"context"
	"fmt"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/rs/cors"

	"github.com/retail-os/backend/internal/config"
	"github.com/retail-os/backend/internal/db"
	"github.com/retail-os/backend/internal/email"
	"github.com/retail-os/backend/internal/handlers"
	"github.com/retail-os/backend/internal/middleware"
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
	}
	superAdminHandler := handlers.NewSuperAdminHandler(pool, cfg.JWTSecret, smtpCfg)
	inventoryHandler := handlers.NewInventoryHandler(pool)
	customerHandler := handlers.NewCustomerHandler(pool)
	orderHandler := handlers.NewOrderHandler(pool)
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

	// Super admin auth (public — login + OTP verification)
	r.With(loginLimiter.Limit).Post("/super-admin/auth/login", superAdminHandler.Login)
	r.With(loginLimiter.Limit).Post("/super-admin/auth/verify-otp", superAdminHandler.VerifyOTP)

	// Super admin protected routes (JWT with role=super_admin)
	r.Group(func(r chi.Router) {
		r.Use(middleware.SuperAdminAuth(cfg.JWTSecret))
		r.Post("/super-admin/tenants", adminHandler.CreateTenant)
		r.Get("/super-admin/tenants", adminHandler.ListTenants)
		r.Patch("/super-admin/tenants/{id}", adminHandler.SetTenantActive)
	})

	// Tenant-scoped routes (JWT + search_path middleware)
	r.Group(func(r chi.Router) {
		r.Use(middleware.JWTAuth(cfg.JWTSecret))
		r.Use(middleware.TenantContext(pool))

		// Inventory
		r.Get("/products", inventoryHandler.ListProducts)
		r.Post("/products", inventoryHandler.CreateProduct)
		r.Get("/batches/active", inventoryHandler.ListActiveBatches)
		r.Get("/batches", inventoryHandler.ListBatches)
		r.Post("/batches", inventoryHandler.CreateBatch)
		r.Get("/inventory", inventoryHandler.ListInventory)

		// Customers
		r.Get("/customers", customerHandler.LookupCustomer)

		// Orders
		r.Post("/orders", orderHandler.CreateOrder)
		r.Get("/orders", orderHandler.ListOrders)
		r.Get("/orders/{id}", orderHandler.GetOrder)
		r.Delete("/orders/{id}", orderHandler.SoftDeleteOrder)

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
