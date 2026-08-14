package httpapi

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httprate"

	"github.com/dryo/api/internal/auth"
	"github.com/dryo/api/internal/config"
	"github.com/dryo/api/internal/notify"
	"github.com/dryo/api/internal/store"
)

// NewRouter builds the fully-wired HTTP handler.
func NewRouter(cfg config.Config, verifier *auth.Verifier, st *store.Store) http.Handler {
	api := &API{store: st, notify: notify.New(cfg.OneSignalAppID, cfg.OneSignalKey)}
	r := chi.NewRouter()

	// Baseline middleware: request id, real ip, panic recovery, hard timeout.
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(20 * time.Second))
	r.Use(securityHeaders)

	// CORS locked to configured web origins.
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.CORSOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		ExposedHeaders:   []string{"X-Request-Id"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	// Rate limit: 120 requests/minute per client IP.
	r.Use(httprate.LimitByIP(120, time.Minute))

	r.Route("/api/v1", func(r chi.Router) {
		// Public.
		r.Get("/health", api.health)

		// Authenticated (valid Firebase ID token required).
		r.Group(func(r chi.Router) {
			r.Use(verifier.Middleware)

			// Reachable even when PENDING so the client can render an
			// "awaiting access" state.
			r.Get("/me", api.me)

			// Active accounts only.
			r.Group(func(r chi.Router) {
				r.Use(api.requireActive)

				r.Get("/batches", api.listBatches)
				r.Post("/batches", api.createBatch)
				r.Get("/batches/{id}", api.getBatch)
				r.Patch("/batches/{id}", api.updateBatch)
				r.Post("/batches/{id}/load", api.loadBatch)
				r.Post("/batches/{id}/advance", api.advanceBatch)
				r.Post("/batches/{id}/payment", api.setBatchPaid)

				r.Get("/chambers", api.listChambers)
				r.Post("/chambers", api.createChamber)
				r.Get("/chambers/{id}/detail", api.getChamberDetail)
				r.Post("/chambers/{id}/toggle", api.toggleChamber)
				r.Post("/chambers/{id}/expenses", api.addChamberExpense)

				r.Get("/intake", api.listIntake)
				r.Post("/intake", api.createIntake)
				r.Post("/intake/{id}/load", api.loadIntake)

				r.Get("/inventory", api.listInventory)

				// Business management (Phase 1).
				r.Get("/farmers", api.listFarmers)
				r.Post("/farmers", api.createFarmer)
				r.Get("/farmers/{id}", api.getFarmer)
				r.Patch("/farmers/{id}", api.updateFarmer)
				r.Post("/farmers/{id}/transactions", api.addFarmerTransaction)

				r.Get("/sales", api.listSales)
				r.Post("/sales", api.createSale)

				r.Get("/pricing", api.listGradePrices)
				r.Get("/addons", api.listAddons)
				r.Get("/settings", api.getSettings)

				r.Get("/reports/summary", api.reportSummary)

				// Owner/Manager only.
				r.Group(func(r chi.Router) {
					r.Use(api.requireManage)

					r.Get("/members", api.listMembers)
					r.Patch("/members/{uid}", api.updateMember)

					r.Get("/invitations", api.listInvitations)
					r.Post("/invitations", api.createInvitation)
					r.Delete("/invitations/{id}", api.revokeInvitation)

					r.Put("/pricing/{grade}", api.upsertGradePrice)
					r.Delete("/pricing/{grade}", api.deleteGradePrice)
					r.Post("/addons", api.createAddon)
					r.Patch("/addons/{id}", api.updateAddon)
					r.Delete("/addons/{id}", api.deleteAddon)
					r.Patch("/settings", api.updateSettings)
					r.Post("/inventory", api.upsertInventory)
					r.Patch("/inventory/{grade}", api.updateInventory)
					r.Delete("/inventory/{grade}", api.deleteInventory)

					r.Patch("/chambers/{id}", api.updateChamber)
					r.Delete("/chambers/{id}", api.deleteChamber)
					r.Delete("/farmers/{id}", api.deleteFarmer)
					r.Delete("/batches/{id}", api.deleteBatch)
					r.Delete("/sales/{id}", api.deleteSale)
				})
			})
		})
	})

	return r
}
