package httpapi

import (
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/dryo/api/internal/auth"
	"github.com/dryo/api/internal/notify"
	"github.com/dryo/api/internal/store"
)

// API holds handler dependencies.
type API struct {
	store  *store.Store
	notify *notify.OneSignal
}

func (a *API) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// me provisions (if needed) and returns the caller's account — reachable even
// when PENDING, so the client can show an "awaiting access" screen.
func (a *API) me(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.ClaimsFrom(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthenticated")
		return
	}
	u, err := a.store.ProvisionUser(r.Context(), claims.UID, claims.Email, claims.Phone, claims.Name, claims.Google)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load account")
		return
	}
	writeJSON(w, http.StatusOK, u)
}

// ── Members & invitations (Owner/Manager) ──

func (a *API) listMembers(w http.ResponseWriter, r *http.Request) {
	members, err := a.store.ListMembers(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list members")
		return
	}
	writeJSON(w, http.StatusOK, members)
}

type updateMemberBody struct {
	Role   string `json:"role"`
	Status string `json:"status"`
}

func (a *API) updateMember(w http.ResponseWriter, r *http.Request) {
	actor, _ := userFrom(r.Context())
	if actor.Role != store.RoleOwner {
		writeError(w, http.StatusForbidden, "only the owner can change member roles")
		return
	}
	uid := chi.URLParam(r, "uid")
	var body updateMemberBody
	if !decodeJSON(w, r, &body) {
		return
	}
	if body.Role != "" && !validRole(body.Role) {
		writeError(w, http.StatusBadRequest, "invalid role")
		return
	}
	if body.Status != "" && !validStatus(body.Status) {
		writeError(w, http.StatusBadRequest, "invalid status")
		return
	}
	u, err := a.store.UpdateMember(r.Context(), uid, body.Role, body.Status)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "member not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update member")
		return
	}
	writeJSON(w, http.StatusOK, u)
}

func (a *API) listInvitations(w http.ResponseWriter, r *http.Request) {
	invites, err := a.store.ListInvitations(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list invitations")
		return
	}
	writeJSON(w, http.StatusOK, invites)
}

type createInviteBody struct {
	Email string `json:"email"`
	Phone string `json:"phone"`
	Role  string `json:"role"`
}

func (a *API) createInvitation(w http.ResponseWriter, r *http.Request) {
	actor, _ := userFrom(r.Context())
	var body createInviteBody
	if !decodeJSON(w, r, &body) {
		return
	}
	email := strings.TrimSpace(body.Email)
	phone := normalizePhone(body.Phone)
	if email == "" && phone == "" {
		writeError(w, http.StatusBadRequest, "provide an email or phone number")
		return
	}
	if email != "" && !emailRe.MatchString(email) {
		writeError(w, http.StatusBadRequest, "invalid email")
		return
	}
	if phone != "" && !phoneRe.MatchString(phone) {
		writeError(w, http.StatusBadRequest, "invalid phone number (use +country format)")
		return
	}
	role := strings.ToUpper(strings.TrimSpace(body.Role))
	if role == "" {
		role = store.RoleOperator
	}
	if role != store.RoleManager && role != store.RoleOperator {
		writeError(w, http.StatusBadRequest, "role must be MANAGER or OPERATOR")
		return
	}
	inv, err := a.store.CreateInvitation(r.Context(), email, phone, role, actor.UID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create invitation")
		return
	}
	contact := inv.Email
	if contact == "" {
		contact = inv.Phone
	}
	a.recordActivity(r.Context(), "Team invitation", fmt.Sprintf("invited %s as %s", contact, strings.ToLower(inv.Role)))
	writeJSON(w, http.StatusCreated, inv)
}

func (a *API) revokeInvitation(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := a.store.RevokeInvitation(r.Context(), id); errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "invitation not found or already handled")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "could not revoke invitation")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "revoked"})
}

// ── Batches ──

func (a *API) listBatches(w http.ResponseWriter, r *http.Request) {
	items, err := a.store.ListBatches(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list batches")
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (a *API) getBatch(w http.ResponseWriter, r *http.Request) {
	b, err := a.store.GetBatch(r.Context(), chi.URLParam(r, "id"))
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "batch not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load batch")
		return
	}
	writeJSON(w, http.StatusOK, b)
}

func (a *API) createBatch(w http.ResponseWriter, r *http.Request) {
	var b store.Batch
	if !decodeJSON(w, r, &b) {
		return
	}
	if strings.TrimSpace(b.LotCode) == "" || strings.TrimSpace(b.FarmerName) == "" || b.GreenWeightKg <= 0 {
		writeError(w, http.StatusBadRequest, "lotCode, farmerName and a positive greenWeightKg are required")
		return
	}
	out, err := a.store.CreateBatch(r.Context(), b)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create batch")
		return
	}
	kind := "purchase"
	if out.Ownership == "JOBWORK" {
		kind = "job-work lot"
	}
	a.recordActivity(r.Context(), "New "+kind+" · "+out.LotCode,
		fmt.Sprintf("added %s (%s · %.0f kg green)", out.LotCode, out.FarmerName, out.GreenWeightKg))
	writeJSON(w, http.StatusCreated, out)
}

type updateBatchBody struct {
	LotCode         *string  `json:"lotCode"`
	FarmerName      *string  `json:"farmerName"`
	Village         *string  `json:"village"`
	Grade           *string  `json:"grade"`
	Note            *string  `json:"note"`
	GreenWeightKg   *float64 `json:"greenWeightKg"`
	DriedWeightKg   *float64 `json:"driedWeightKg"`
	CurrentMoisture *float64 `json:"currentMoisture"`
	RatePerKg       *float64 `json:"ratePerKg"`
	GradingCharge   *float64  `json:"gradingCharge"`
	GradingEnabled  *bool     `json:"gradingEnabled"`
	AddonIDs        *[]string `json:"addonIds"`
}

func (a *API) updateBatch(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body updateBatchBody
	if !decodeJSON(w, r, &body) {
		return
	}
	out, err := a.store.UpdateBatch(r.Context(), id, store.BatchPatch{
		LotCode:         body.LotCode,
		FarmerName:      body.FarmerName,
		Village:         body.Village,
		Grade:           body.Grade,
		Note:            body.Note,
		GreenWeightKg:   body.GreenWeightKg,
		DriedWeightKg:   body.DriedWeightKg,
		CurrentMoisture: body.CurrentMoisture,
		RatePerKg:       body.RatePerKg,
		GradingCharge:   body.GradingCharge,
		GradingEnabled:  body.GradingEnabled,
		AddonIDs:        body.AddonIDs,
	})
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "batch not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update batch")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

type paidBody struct {
	Paid bool `json:"paid"`
}

func (a *API) setBatchPaid(w http.ResponseWriter, r *http.Request) {
	var body paidBody
	if !decodeJSON(w, r, &body) {
		return
	}
	out, err := a.store.SetBatchPaid(r.Context(), chi.URLParam(r, "id"), body.Paid)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "batch not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update payment status")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

type loadBatchBody struct {
	ChamberID string  `json:"chamberId"`
	Kg        float64 `json:"kg"`
}

func (a *API) loadBatch(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body loadBatchBody
	if !decodeJSON(w, r, &body) {
		return
	}
	if strings.TrimSpace(body.ChamberID) == "" {
		writeError(w, http.StatusBadRequest, "chamberId is required")
		return
	}
	out, err := a.store.LoadBatch(r.Context(), id, body.ChamberID, body.Kg)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "batch not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load batch into chamber")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *API) advanceBatch(w http.ResponseWriter, r *http.Request) {
	b, err := a.store.AdvanceBatch(r.Context(), chi.URLParam(r, "id"))
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "batch not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "could not advance batch")
		return
	}
	writeJSON(w, http.StatusOK, b)
}

// ── Chambers ──

func (a *API) listChambers(w http.ResponseWriter, r *http.Request) {
	items, err := a.store.ListChambers(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list chambers")
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (a *API) createChamber(w http.ResponseWriter, r *http.Request) {
	var c store.Chamber
	if !decodeJSON(w, r, &c) {
		return
	}
	if strings.TrimSpace(c.Name) == "" || c.CapacityKg <= 0 {
		writeError(w, http.StatusBadRequest, "name and a positive capacityKg are required")
		return
	}
	out, err := a.store.CreateChamber(r.Context(), c)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create chamber")
		return
	}
	a.recordActivity(r.Context(), "New chamber · "+out.Name, fmt.Sprintf("added chamber %s (%.0f kg)", out.Name, out.CapacityKg))
	writeJSON(w, http.StatusCreated, out)
}

func (a *API) toggleChamber(w http.ResponseWriter, r *http.Request) {
	c, err := a.store.ToggleChamber(r.Context(), chi.URLParam(r, "id"))
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "chamber not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "could not toggle chamber")
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (a *API) getChamberDetail(w http.ResponseWriter, r *http.Request) {
	out, err := a.store.GetChamberDetail(r.Context(), chi.URLParam(r, "id"))
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "chamber not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load chamber detail")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

type chamberExpenseBody struct {
	Amount   float64 `json:"amount"`
	Category string  `json:"category"`
	Note     string  `json:"note"`
}

func (a *API) addChamberExpense(w http.ResponseWriter, r *http.Request) {
	var body chamberExpenseBody
	if !decodeJSON(w, r, &body) {
		return
	}
	if body.Amount <= 0 {
		writeError(w, http.StatusBadRequest, "amount must be positive")
		return
	}
	out, err := a.store.AddChamberExpense(r.Context(), store.ChamberExpense{
		ChamberID: chi.URLParam(r, "id"),
		Amount:    body.Amount,
		Category:  strings.TrimSpace(body.Category),
		Note:      strings.TrimSpace(body.Note),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not add expense")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

// ── Intake ──

func (a *API) listIntake(w http.ResponseWriter, r *http.Request) {
	items, err := a.store.ListIntake(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list intake")
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (a *API) createIntake(w http.ResponseWriter, r *http.Request) {
	var rec store.IntakeReceipt
	if !decodeJSON(w, r, &rec) {
		return
	}
	if strings.TrimSpace(rec.FarmerName) == "" || rec.WeightKg <= 0 {
		writeError(w, http.StatusBadRequest, "farmerName and a positive weightKg are required")
		return
	}
	out, err := a.store.CreateIntake(r.Context(), rec)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create intake receipt")
		return
	}
	writeJSON(w, http.StatusCreated, out)
}

type loadIntakeBody struct {
	ChamberID string `json:"chamberId"`
}

func (a *API) loadIntake(w http.ResponseWriter, r *http.Request) {
	var body loadIntakeBody
	if !decodeJSON(w, r, &body) {
		return
	}
	if strings.TrimSpace(body.ChamberID) == "" {
		writeError(w, http.StatusBadRequest, "chamberId is required")
		return
	}
	batch, err := a.store.LoadIntake(r.Context(), chi.URLParam(r, "id"), body.ChamberID)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusConflict, "receipt or chamber not available")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load intake")
		return
	}
	writeJSON(w, http.StatusOK, batch)
}

// ── Inventory ──

func (a *API) listInventory(w http.ResponseWriter, r *http.Request) {
	items, err := a.store.ListInventory(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list inventory")
		return
	}
	writeJSON(w, http.StatusOK, items)
}

// ── validation helpers ──

var (
	emailRe = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)
	phoneRe = regexp.MustCompile(`^\+[1-9]\d{7,14}$`)
)

func validRole(role string) bool {
	switch role {
	case store.RoleOwner, store.RoleManager, store.RoleOperator:
		return true
	}
	return false
}

func validStatus(status string) bool {
	switch status {
	case store.StatusActive, store.StatusPending, store.StatusDisabled:
		return true
	}
	return false
}

// normalizePhone turns a bare 10-digit Indian number into E.164 (+91…).
func normalizePhone(phone string) string {
	p := strings.TrimSpace(phone)
	if p == "" {
		return ""
	}
	digits := regexp.MustCompile(`\D`).ReplaceAllString(p, "")
	if strings.HasPrefix(p, "+") {
		return "+" + digits
	}
	if len(digits) == 10 {
		return "+91" + digits
	}
	return "+" + digits
}
