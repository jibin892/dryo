package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"

	"github.com/dryo/api/internal/auth"
	"github.com/dryo/api/internal/config"
	"github.com/dryo/api/internal/database"
	"github.com/dryo/api/internal/httpapi"
	"github.com/dryo/api/internal/store"
)

func main() {
	// Load apps/api/.env if present (real env vars still win).
	_ = godotenv.Load()

	cfg := config.Load()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	pool, err := database.NewPool(ctx, cfg.DatabaseURL, cfg.DBMaxConns)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer pool.Close()

	if cfg.RunMigrations {
		if err := database.Migrate(ctx, pool, cfg.SeedOnMigrate); err != nil {
			log.Fatalf("migrate: %v", err)
		}
		log.Println("migrations applied")
	}

	verifier, err := auth.NewVerifier(ctx, cfg.FirebaseProjectID, cfg.GoogleCredentials, cfg.AuthDisabled)
	if err != nil {
		log.Fatalf("firebase: %v", err)
	}

	handler := httpapi.NewRouter(cfg, verifier, store.New(pool))

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      20 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}

	go func() {
		log.Printf("Dryo API listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server: %v", err)
		}
	}()

	<-ctx.Done()
	log.Println("shutting down…")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("graceful shutdown failed: %v", err)
		os.Exit(1)
	}
}
