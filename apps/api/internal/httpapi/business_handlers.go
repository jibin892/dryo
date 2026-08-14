package httpapi

import (
	"errors"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/dryo/api/internal/store"
)

// ── Farmers & ledger ──

func (a *API) listFarmers(w http.ResponseWriter, r *http.Request) {
	items, err := a.store.ListFarmers(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list farmers")
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (a *API) createFarmer(w http.ResponseWriter, r *http.Request) {
	var f store.Farmer
	if !decodeJSON(w, r, &f) {
		return
	}
	if strings.TrimSpace(f.Name) == "" {
		writeError(w, http.StatusBadRequest, "farmer name is required")
		return
	}
	out, err := a.store.CreateFarmer(r.Context(), f)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create farmer")
		return
	}
	writeJSON(w, http.StatusCreated, out)
}

type farmerDetail struct {
	store.Farmer
	Transactions []store.FarmerTransaction `json:"transactions"`
	Batches      []store.Batch             `json:"batches"`
}

func (a *API) getFarmer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	f, err := a.store.GetFarmer(r.Context(), id)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "farmer not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load farmer")
		return
	}
	txns, err := a.store.ListFarmerTransactions(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load ledger")
		return
	}
	batches, err := a.store.ListFarmerBatches(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load lots")
		return
	}
	writeJSON(w, http.StatusOK, farmerDetail{Farmer: f, Transactions: txns, Batches: batches})
}

type txnBody struct {
	Type    string  `json:"type"`
	Amount  float64 `json:"amount"` // positive magnitude; sign is applied by type
	Note    string  `json:"note"`
	BatchID *string `json:"batchId"`
}

// signedAmount converts a positive magnitude into the ledger's signed convention.
func signedAmount(kind string, amount float64) (float64, bool) {
	mag := math.Abs(amount)
	switch kind {
	case "PURCHASE": // house owes the farmer
		return mag, true
	case "ADVANCE", "PAYMENT", "JOBWORK_CHARGE": // reduces what the house owes
		return -mag, true
	case "ADJUSTMENT": // caller-signed
		return amount, true
	default:
		return 0, false
	}
}

func (a *API) addFarmerTransaction(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body txnBody
	if !decodeJSON(w, r, &body) {
		return
	}
	amount, ok := signedAmount(strings.ToUpper(strings.TrimSpace(body.Type)), body.Amount)
	if !ok {
		writeError(w, http.StatusBadRequest, "type must be PURCHASE, ADVANCE, PAYMENT, JOBWORK_CHARGE or ADJUSTMENT")
		return
	}
	if amount == 0 {
		writeError(w, http.StatusBadRequest, "amount must be non-zero")
		return
	}
	farmer, err := a.store.GetFarmer(r.Context(), id)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "farmer not found")
		return
	}
	out, err := a.store.AddFarmerTransaction(r.Context(), store.FarmerTransaction{
		FarmerID: id, Type: strings.ToUpper(body.Type), Amount: amount, Note: body.Note, BatchID: body.BatchID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not record transaction")
		return
	}
	// Notify the owner when a non-owner records a farmer money movement.
	if u, ok := userFrom(r.Context()); ok && u.Role != store.RoleOwner {
		_ = a.store.AddNotification(r.Context(), "Ledger · "+farmer.Name,
			fmt.Sprintf("%s recorded %s ₹%.0f for %s", u.DisplayName, strings.ToUpper(body.Type), math.Abs(amount), farmer.Name), "neutral")
	}
	writeJSON(w, http.StatusCreated, out)
}

type updateFarmerBody struct {
	Name    string `json:"name"`
	Village string `json:"village"`
	Phone   string `json:"phone"`
	Note    string `json:"note"`
}

func (a *API) updateFarmer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body updateFarmerBody
	if !decodeJSON(w, r, &body) {
		return
	}
	out, err := a.store.UpdateFarmer(r.Context(), id, body.Name, body.Village, body.Phone, body.Note)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "farmer not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update farmer")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

type updateInventoryBody struct {
	CostPerKg float64 `json:"costPerKg"`
	Location  string  `json:"location"`
}

func (a *API) updateInventory(w http.ResponseWriter, r *http.Request) {
	grade := strings.ToUpper(chi.URLParam(r, "grade"))
	var body updateInventoryBody
	if !decodeJSON(w, r, &body) {
		return
	}
	if body.CostPerKg < 0 {
		writeError(w, http.StatusBadRequest, "cost must be zero or positive")
		return
	}
	out, err := a.store.UpdateInventory(r.Context(), grade, body.CostPerKg, body.Location)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "grade not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update inventory")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

// ── Pricing & settings ──

func (a *API) listGradePrices(w http.ResponseWriter, r *http.Request) {
	items, err := a.store.ListGradePrices(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list prices")
		return
	}
	writeJSON(w, http.StatusOK, items)
}

type priceBody struct {
	SellRatePerKg float64 `json:"sellRatePerKg"`
	CostRatePerKg float64 `json:"costRatePerKg"`
	YieldRatio    float64 `json:"yieldRatio"`
}

func (a *API) upsertGradePrice(w http.ResponseWriter, r *http.Request) {
	grade := strings.ToUpper(chi.URLParam(r, "grade"))
	var body priceBody
	if !decodeJSON(w, r, &body) {
		return
	}
	if body.SellRatePerKg < 0 || body.CostRatePerKg < 0 {
		writeError(w, http.StatusBadRequest, "rates must be zero or positive")
		return
	}
	if body.YieldRatio <= 0 || body.YieldRatio > 1 {
		body.YieldRatio = 0.20 // sensible default green→dried ratio
	}
	out, err := a.store.UpsertGradePrice(r.Context(), grade, body.SellRatePerKg, body.CostRatePerKg, body.YieldRatio)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update price")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

// ── Service add-ons ──

func (a *API) listAddons(w http.ResponseWriter, r *http.Request) {
	items, err := a.store.ListAddons(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list add-ons")
		return
	}
	writeJSON(w, http.StatusOK, items)
}

type addonBody struct {
	Name   string  `json:"name"`
	Rate   float64 `json:"rate"`
	PerKg  bool    `json:"perKg"`
	Active bool    `json:"active"`
}

func (a *API) createAddon(w http.ResponseWriter, r *http.Request) {
	var body addonBody
	if !decodeJSON(w, r, &body) {
		return
	}
	if strings.TrimSpace(body.Name) == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	if body.Rate < 0 {
		writeError(w, http.StatusBadRequest, "rate must be zero or positive")
		return
	}
	out, err := a.store.CreateAddon(r.Context(), strings.TrimSpace(body.Name), body.Rate, body.PerKg)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create add-on")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *API) updateAddon(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body addonBody
	if !decodeJSON(w, r, &body) {
		return
	}
	if body.Rate < 0 {
		writeError(w, http.StatusBadRequest, "rate must be zero or positive")
		return
	}
	out, err := a.store.UpdateAddon(r.Context(), id, strings.TrimSpace(body.Name), body.Rate, body.PerKg, body.Active)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "add-on not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update add-on")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *API) deleteAddon(w http.ResponseWriter, r *http.Request) {
	err := a.store.DeleteAddon(r.Context(), chi.URLParam(r, "id"))
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "add-on not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "could not delete add-on")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (a *API) getSettings(w http.ResponseWriter, r *http.Request) {
	hs, err := a.store.GetSettings(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load settings")
		return
	}
	writeJSON(w, http.StatusOK, hs)
}

func (a *API) updateSettings(w http.ResponseWriter, r *http.Request) {
	var hs store.HouseSettings
	if !decodeJSON(w, r, &hs) {
		return
	}
	if strings.TrimSpace(hs.HouseName) == "" {
		writeError(w, http.StatusBadRequest, "houseName is required")
		return
	}
	out, err := a.store.UpdateSettings(r.Context(), hs)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update settings")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

// ── Sales ──

func (a *API) listSales(w http.ResponseWriter, r *http.Request) {
	items, err := a.store.ListSales(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list sales")
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (a *API) createSale(w http.ResponseWriter, r *http.Request) {
	var sale store.Sale
	if !decodeJSON(w, r, &sale) {
		return
	}
	if strings.TrimSpace(sale.BuyerName) == "" || strings.TrimSpace(sale.Grade) == "" || sale.QuantityKg <= 0 || sale.RatePerKg <= 0 {
		writeError(w, http.StatusBadRequest, "buyerName, grade, positive quantityKg and ratePerKg are required")
		return
	}
	if sale.Channel != "" && sale.Channel != "DIRECT" && sale.Channel != "AUCTION" {
		writeError(w, http.StatusBadRequest, "channel must be DIRECT or AUCTION")
		return
	}
	out, err := a.store.CreateSale(r.Context(), sale)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not record sale")
		return
	}
	a.notify.Push("Sale recorded", fmt.Sprintf("%.0f kg %s → %s · ₹%.0f", out.QuantityKg, out.Grade, out.BuyerName, out.Amount))
	writeJSON(w, http.StatusCreated, out)
}

// ── Reports ──

// parseReportRange reads ?from=&to= (RFC3339 or YYYY-MM-DD). Missing bounds
// default to "all time". A bare date `to` is treated as inclusive (end of day).
func parseReportRange(r *http.Request) (time.Time, time.Time) {
	from := time.Unix(0, 0)
	to := time.Now().Add(24 * time.Hour)
	if v := r.URL.Query().Get("from"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			from = t
		} else if t, err := time.Parse("2006-01-02", v); err == nil {
			from = t
		}
	}
	if v := r.URL.Query().Get("to"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			to = t
		} else if t, err := time.Parse("2006-01-02", v); err == nil {
			to = t.Add(24 * time.Hour)
		}
	}
	return from, to
}

// ── Notifications ──

func (a *API) listNotifications(w http.ResponseWriter, r *http.Request) {
	items, err := a.store.ListNotifications(r.Context(), 50)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load notifications")
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (a *API) markNotificationsRead(w http.ResponseWriter, r *http.Request) {
	if err := a.store.MarkNotificationsRead(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "could not update notifications")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (a *API) reportSummary(w http.ResponseWriter, r *http.Request) {
	from, to := parseReportRange(r)
	summary, err := a.store.ReportSummary(r.Context(), from, to)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not build report")
		return
	}
	writeJSON(w, http.StatusOK, summary)
}
