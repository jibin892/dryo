package httpapi

import (
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/dryo/api/internal/store"
)

// writeCrudErr maps store errors to HTTP: not-found → 404, guarded (in use) →
// 409 with the reason, anything else → 500.
func writeCrudErr(w http.ResponseWriter, err error, fallback string) {
	switch {
	case errors.Is(err, store.ErrNotFound):
		writeError(w, http.StatusNotFound, "not found")
	case errors.Is(err, store.ErrInUse):
		writeError(w, http.StatusConflict, err.Error())
	default:
		writeError(w, http.StatusInternalServerError, fallback)
	}
}

// ── Chambers ──

type updateChamberBody struct {
	Name        *string  `json:"name"`
	Type        *string  `json:"type"`
	CapacityKg  *float64 `json:"capacityKg"`
	TargetTempC *float64 `json:"targetTempC"`
	CycleHours  *float64 `json:"cycleHours"`
}

func (a *API) updateChamber(w http.ResponseWriter, r *http.Request) {
	var body updateChamberBody
	if !decodeJSON(w, r, &body) {
		return
	}
	out, err := a.store.UpdateChamber(r.Context(), chi.URLParam(r, "id"), store.ChamberPatch{
		Name: body.Name, Type: body.Type, CapacityKg: body.CapacityKg,
		TargetTempC: body.TargetTempC, CycleHours: body.CycleHours,
	})
	if err != nil {
		writeCrudErr(w, err, "could not update chamber")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *API) deleteChamber(w http.ResponseWriter, r *http.Request) {
	if err := a.store.DeleteChamber(r.Context(), chi.URLParam(r, "id")); err != nil {
		writeCrudErr(w, err, "could not delete chamber")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// ── Pricing ──

func (a *API) deleteGradePrice(w http.ResponseWriter, r *http.Request) {
	grade := strings.ToUpper(chi.URLParam(r, "grade"))
	if err := a.store.DeleteGradePrice(r.Context(), grade); err != nil {
		writeCrudErr(w, err, "could not delete grade")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// ── Stock / inventory ──

func (a *API) upsertInventory(w http.ResponseWriter, r *http.Request) {
	var l store.InventoryLot
	if !decodeJSON(w, r, &l) {
		return
	}
	l.Grade = strings.ToUpper(strings.TrimSpace(l.Grade))
	if l.Grade == "" {
		writeError(w, http.StatusBadRequest, "grade is required")
		return
	}
	out, err := a.store.UpsertInventory(r.Context(), l)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not save stock")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *API) deleteInventory(w http.ResponseWriter, r *http.Request) {
	grade := strings.ToUpper(chi.URLParam(r, "grade"))
	if err := a.store.DeleteInventory(r.Context(), grade); err != nil {
		writeCrudErr(w, err, "could not delete stock line")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// ── Farmers ──

func (a *API) deleteFarmer(w http.ResponseWriter, r *http.Request) {
	if err := a.store.DeleteFarmer(r.Context(), chi.URLParam(r, "id")); err != nil {
		writeCrudErr(w, err, "could not delete farmer")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// ── Batches ──

func (a *API) deleteBatch(w http.ResponseWriter, r *http.Request) {
	if err := a.store.DeleteBatch(r.Context(), chi.URLParam(r, "id")); err != nil {
		writeCrudErr(w, err, "could not delete lot")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// ── Sales ──

func (a *API) deleteSale(w http.ResponseWriter, r *http.Request) {
	if err := a.store.DeleteSale(r.Context(), chi.URLParam(r, "id")); err != nil {
		writeCrudErr(w, err, "could not delete sale")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
