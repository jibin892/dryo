package store

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNotFound is returned when a requested row does not exist.
var ErrNotFound = errors.New("not found")

type Store struct{ pool *pgxpool.Pool }

func New(pool *pgxpool.Pool) *Store { return &Store{pool: pool} }

func newID(prefix string) string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	return prefix + "-" + hex.EncodeToString(b)
}

const userCols = `uid, display_name, phone, email, role, house_name, status, invited_by, created_at`

// ─────────────────────────── Accounts ───────────────────────────

// ProvisionUser is the account lifecycle. It is called on every /me request:
//   - existing user  → refresh contact fields, return as-is (role/status kept)
//   - matched invite → activate with the invited role, accept the invite
//   - first user ever → OWNER (bootstraps the curing house)
//   - otherwise      → PENDING account with no access
func (s *Store) ProvisionUser(ctx context.Context, uid, email, phone, name string, google bool) (User, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return User{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// 1. Existing user.
	if u, err := scanOneUser(ctx, tx, `SELECT `+userCols+` FROM users WHERE uid=$1`, uid); err == nil {
		_, _ = tx.Exec(ctx,
			`UPDATE users SET display_name=COALESCE(NULLIF($2,''), display_name),
			 email=COALESCE(NULLIF($3,''), email), phone=COALESCE(NULLIF($4,''), phone)
			 WHERE uid=$1`, uid, name, email, phone)
		u.DisplayName = firstNonEmpty(name, u.DisplayName)
		if err := tx.Commit(ctx); err != nil {
			return User{}, err
		}
		return u, nil
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return User{}, err
	}

	displayName := firstNonEmpty(name, phone, "Dryo user")

	// 2. Matched invitation (by email or phone).
	inv, err := scanOneInvite(ctx, tx,
		`SELECT id, email, phone, role, status, invited_by, created_at, accepted_at
		 FROM invitations
		 WHERE status='PENDING' AND (
		   (email <> '' AND lower(email)=lower($1)) OR (phone <> '' AND phone=$2))
		 ORDER BY created_at ASC LIMIT 1`, email, phone)
	if err == nil {
		u, err := scanOneUser(ctx, tx,
			`INSERT INTO users (uid, display_name, phone, email, role, status, invited_by)
			 VALUES ($1,$2,$3,$4,$5,'ACTIVE',$6) RETURNING `+userCols,
			uid, displayName, phone, email, inv.Role, inv.InvitedBy)
		if err != nil {
			return User{}, err
		}
		if _, err := tx.Exec(ctx, `UPDATE invitations SET status='ACCEPTED', accepted_at=now() WHERE id=$1`, inv.ID); err != nil {
			return User{}, err
		}
		if err := tx.Commit(ctx); err != nil {
			return User{}, err
		}
		return u, nil
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return User{}, err
	}

	// 3. Bootstrap first user as OWNER, else PENDING.
	var count int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM users`).Scan(&count); err != nil {
		return User{}, err
	}
	role, status := RoleOperator, StatusPending
	if count == 0 {
		role, status = RoleOwner, StatusActive
	}
	u, err := scanOneUser(ctx, tx,
		`INSERT INTO users (uid, display_name, phone, email, role, status)
		 VALUES ($1,$2,$3,$4,$5,$6) RETURNING `+userCols,
		uid, displayName, phone, email, role, status)
	if err != nil {
		return User{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return User{}, err
	}
	return u, nil
}

func (s *Store) GetUser(ctx context.Context, uid string) (User, error) {
	u, err := scanOneUser(ctx, s.pool, `SELECT `+userCols+` FROM users WHERE uid=$1`, uid)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrNotFound
	}
	return u, err
}

func (s *Store) ListMembers(ctx context.Context) ([]User, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+userCols+` FROM users ORDER BY created_at ASC`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByNameLax[User])
}

func (s *Store) UpdateMember(ctx context.Context, uid, role, status string) (User, error) {
	u, err := scanOneUser(ctx, s.pool,
		`UPDATE users SET role=COALESCE(NULLIF($2,''), role), status=COALESCE(NULLIF($3,''), status)
		 WHERE uid=$1 RETURNING `+userCols, uid, role, status)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrNotFound
	}
	return u, err
}

// ─────────────────────────── Invitations ───────────────────────────

const inviteCols = `id, email, phone, role, status, invited_by, created_at, accepted_at`

func (s *Store) ListInvitations(ctx context.Context) ([]Invitation, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+inviteCols+` FROM invitations ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByNameLax[Invitation])
}

func (s *Store) CreateInvitation(ctx context.Context, email, phone, role, invitedBy string) (Invitation, error) {
	return scanOneInvite(ctx, s.pool,
		`INSERT INTO invitations (id, email, phone, role, invited_by)
		 VALUES ($1,$2,$3,$4,$5) RETURNING `+inviteCols,
		newID("inv"), strings.TrimSpace(email), strings.TrimSpace(phone), role, invitedBy)
}

func (s *Store) RevokeInvitation(ctx context.Context, id string) error {
	tag, err := s.pool.Exec(ctx, `UPDATE invitations SET status='REVOKED' WHERE id=$1 AND status='PENDING'`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ─────────────────────────── Batches ───────────────────────────

const batchCols = `id, lot_code, farmer_name, village, green_weight_kg, dried_weight_kg,
	chamber_id, stage, started_at, target_moisture, current_moisture, grade, rate_per_kg, note,
	ownership, farmer_id, curing_rate_per_kg, grading_charge`

var stageOrder = []string{"INTAKE", "DRYING", "CURING", "GRADING", "READY", "DISPATCHED"}

func (s *Store) ListBatches(ctx context.Context) ([]Batch, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+batchCols+` FROM batches ORDER BY started_at DESC`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByNameLax[Batch])
}

func (s *Store) GetBatch(ctx context.Context, id string) (Batch, error) {
	b, err := scanOneBatch(ctx, s.pool, `SELECT `+batchCols+` FROM batches WHERE id=$1`, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Batch{}, ErrNotFound
	}
	return b, err
}

func (s *Store) CreateBatch(ctx context.Context, b Batch) (Batch, error) {
	if b.ID == "" {
		b.ID = newID("bt")
	}
	if b.TargetMoisture == 0 {
		b.TargetMoisture = 10
	}
	if b.Ownership == "" {
		b.Ownership = "OWN"
	}
	// Loading straight into a chamber starts the drying stage.
	loadChamber := b.ChamberID != nil && *b.ChamberID != ""
	if loadChamber {
		b.Stage = "DRYING"
	} else if b.Stage == "" {
		b.Stage = "INTAKE"
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Batch{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	out, err := scanOneBatch(ctx, tx,
		`INSERT INTO batches (id, lot_code, farmer_name, village, green_weight_kg, chamber_id, stage,
		   target_moisture, current_moisture, rate_per_kg, note, ownership, farmer_id, curing_rate_per_kg, grade, grading_charge)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING `+batchCols,
		b.ID, b.LotCode, b.FarmerName, b.Village, b.GreenWeightKg, b.ChamberID, b.Stage,
		b.TargetMoisture, b.CurrentMoisture, b.RatePerKg, b.Note, b.Ownership, b.FarmerID, b.CuringRatePerKg, b.Grade, b.GradingCharge)
	if err != nil {
		return Batch{}, err
	}
	if loadChamber {
		if _, err := tx.Exec(ctx, `UPDATE chambers SET status='DRYING', batch_id=$2 WHERE id=$1`, *b.ChamberID, b.ID); err != nil {
			return Batch{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return Batch{}, err
	}
	return out, nil
}

// BatchPatch carries optional edits; nil fields are left unchanged.
type BatchPatch struct {
	LotCode         *string
	FarmerName      *string
	Village         *string
	Grade           *string
	Note            *string
	GreenWeightKg   *float64
	DriedWeightKg   *float64
	CurrentMoisture *float64
	RatePerKg       *float64
	GradingCharge   *float64
}

// UpdateBatch edits a batch's details, including the actual dried weight and grade.
func (s *Store) UpdateBatch(ctx context.Context, id string, p BatchPatch) (Batch, error) {
	b, err := s.GetBatch(ctx, id)
	if err != nil {
		return Batch{}, err
	}
	if p.LotCode != nil {
		b.LotCode = *p.LotCode
	}
	if p.FarmerName != nil {
		b.FarmerName = *p.FarmerName
	}
	if p.Village != nil {
		b.Village = *p.Village
	}
	if p.GreenWeightKg != nil {
		b.GreenWeightKg = *p.GreenWeightKg
	}
	if p.CurrentMoisture != nil {
		b.CurrentMoisture = *p.CurrentMoisture
	}
	if p.RatePerKg != nil {
		b.RatePerKg = *p.RatePerKg
	}
	if p.DriedWeightKg != nil {
		if v := *p.DriedWeightKg; v <= 0 {
			b.DriedWeightKg = nil
		} else {
			b.DriedWeightKg = &v
		}
	}
	if p.Grade != nil {
		if g := strings.ToUpper(strings.TrimSpace(*p.Grade)); g == "" {
			b.Grade = nil
		} else {
			b.Grade = &g
		}
	}
	if p.Note != nil {
		n := *p.Note
		b.Note = &n
	}
	if p.GradingCharge != nil {
		b.GradingCharge = *p.GradingCharge
	}
	return scanOneBatch(ctx, s.pool,
		`UPDATE batches SET lot_code=$2, farmer_name=$3, village=$4, green_weight_kg=$5,
		   dried_weight_kg=$6, current_moisture=$7, rate_per_kg=$8, grade=$9, note=$10, grading_charge=$11
		 WHERE id=$1 RETURNING `+batchCols,
		id, b.LotCode, b.FarmerName, b.Village, b.GreenWeightKg, b.DriedWeightKg,
		b.CurrentMoisture, b.RatePerKg, b.Grade, b.Note, b.GradingCharge)
}

// AdvanceBatch moves a batch to the next lifecycle stage. Moving into GRADING
// derives a dried weight (~20% yield) and frees the chamber.
func (s *Store) AdvanceBatch(ctx context.Context, id string) (Batch, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Batch{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	b, err := scanOneBatch(ctx, tx, `SELECT `+batchCols+` FROM batches WHERE id=$1 FOR UPDATE`, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Batch{}, ErrNotFound
	} else if err != nil {
		return Batch{}, err
	}

	next := nextStage(b.Stage)
	if next == "GRADING" && b.DriedWeightKg == nil {
		dried := math.Round(b.GreenWeightKg * 0.2)
		b.DriedWeightKg = &dried
		b.ChamberID = nil
		if _, err := tx.Exec(ctx,
			`UPDATE chambers SET status='IDLE', batch_id=NULL, load_kg=0 WHERE batch_id=$1`, id); err != nil {
			return Batch{}, err
		}
	}
	b.Stage = next

	out, err := scanOneBatch(ctx, tx,
		`UPDATE batches SET stage=$2, dried_weight_kg=$3, chamber_id=$4 WHERE id=$1 RETURNING `+batchCols,
		id, b.Stage, b.DriedWeightKg, b.ChamberID)
	if err != nil {
		return Batch{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Batch{}, err
	}
	return out, nil
}

// LoadBatch assigns an INTAKE batch to a chamber and starts drying, occupying
// the chamber — all in one transaction.
func (s *Store) LoadBatch(ctx context.Context, batchID, chamberID string) (Batch, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Batch{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	out, err := scanOneBatch(ctx, tx,
		`UPDATE batches SET chamber_id=$2, stage='DRYING' WHERE id=$1 RETURNING `+batchCols, batchID, chamberID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Batch{}, ErrNotFound
	} else if err != nil {
		return Batch{}, err
	}
	if _, err := tx.Exec(ctx, `UPDATE chambers SET status='DRYING', batch_id=$2 WHERE id=$1`, chamberID, batchID); err != nil {
		return Batch{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Batch{}, err
	}
	return out, nil
}

func nextStage(stage string) string {
	for i, s := range stageOrder {
		if s == stage {
			if i+1 < len(stageOrder) {
				return stageOrder[i+1]
			}
			return stage
		}
	}
	return stage
}

// ─────────────────────────── Chambers ───────────────────────────

const chamberCols = `id, name, type, status, temp_c, target_temp_c, humidity, load_kg,
	capacity_kg, batch_id, elapsed_hours, cycle_hours, started_at`

// CreateChamber adds a new chamber (kiln/dryer) to the drying floor.
func (s *Store) CreateChamber(ctx context.Context, c Chamber) (Chamber, error) {
	if c.ID == "" {
		c.ID = newID("ch")
	}
	if c.Status == "" {
		c.Status = "IDLE"
	}
	if c.Type == "" {
		c.Type = "FLUE_KILN"
	}
	return scanOneChamber(ctx, s.pool,
		`INSERT INTO chambers (id, name, type, status, target_temp_c, capacity_kg, cycle_hours)
		 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING `+chamberCols,
		c.ID, c.Name, c.Type, c.Status, c.TargetTempC, c.CapacityKg, c.CycleHours)
}

func (s *Store) ListChambers(ctx context.Context) ([]Chamber, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+chamberCols+` FROM chambers ORDER BY name ASC`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByNameLax[Chamber])
}

func (s *Store) GetChamber(ctx context.Context, id string) (Chamber, error) {
	c, err := scanOneChamber(ctx, s.pool, `SELECT `+chamberCols+` FROM chambers WHERE id=$1`, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Chamber{}, ErrNotFound
	}
	return c, err
}

// ToggleChamber cycles chamber power: FAULT→IDLE (reset), IDLE→HEATING, else→IDLE.
func (s *Store) ToggleChamber(ctx context.Context, id string) (Chamber, error) {
	cur, err := s.GetChamber(ctx, id)
	if err != nil {
		return Chamber{}, err
	}
	status, temp := "IDLE", cur.TempC
	starting := false
	switch cur.Status {
	case "FAULT":
		status, temp = "IDLE", 31
	case "IDLE":
		status, starting = "HEATING", true
	}
	// Stamp the cycle start when powering on; clear it when going idle.
	if starting {
		return scanOneChamber(ctx, s.pool,
			`UPDATE chambers SET status=$2, temp_c=$3, started_at=now(), elapsed_hours=0 WHERE id=$1 RETURNING `+chamberCols,
			id, status, temp)
	}
	return scanOneChamber(ctx, s.pool,
		`UPDATE chambers SET status=$2, temp_c=$3, started_at=NULL WHERE id=$1 RETURNING `+chamberCols, id, status, temp)
}

// ─────────────────────────── Intake ───────────────────────────

const intakeCols = `id, farmer_name, village, weight_kg, moisture_pct, rate_per_kg, received_at, status`

func (s *Store) ListIntake(ctx context.Context) ([]IntakeReceipt, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+intakeCols+` FROM intake_receipts ORDER BY received_at DESC`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByNameLax[IntakeReceipt])
}

func (s *Store) CreateIntake(ctx context.Context, r IntakeReceipt) (IntakeReceipt, error) {
	if r.ID == "" {
		r.ID = newID("in")
	}
	return scanOneIntake(ctx, s.pool,
		`INSERT INTO intake_receipts (id, farmer_name, village, weight_kg, moisture_pct, rate_per_kg, status)
		 VALUES ($1,$2,$3,$4,$5,$6,'PENDING') RETURNING `+intakeCols,
		r.ID, r.FarmerName, r.Village, r.WeightKg, r.MoisturePct, r.RatePerKg)
}

// LoadIntake marks a receipt LOADED and assigns it to a heating chamber.
func (s *Store) LoadIntake(ctx context.Context, receiptID, chamberID string) (Chamber, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Chamber{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	tag, err := tx.Exec(ctx, `UPDATE intake_receipts SET status='LOADED' WHERE id=$1 AND status='PENDING'`, receiptID)
	if err != nil {
		return Chamber{}, err
	}
	if tag.RowsAffected() == 0 {
		return Chamber{}, ErrNotFound
	}
	c, err := scanOneChamber(ctx, tx,
		`UPDATE chambers SET status='HEATING', batch_id=$2 WHERE id=$1 AND status='IDLE' RETURNING `+chamberCols,
		chamberID, receiptID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Chamber{}, fmt.Errorf("%w: chamber not idle/available", ErrNotFound)
	} else if err != nil {
		return Chamber{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Chamber{}, err
	}
	return c, nil
}

// ─────────────────────────── Inventory ───────────────────────────

func (s *Store) ListInventory(ctx context.Context) ([]InventoryLot, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT grade, bulk_kg, bags, location, avg_moisture, cost_per_kg FROM inventory_lots ORDER BY bulk_kg DESC`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByNameLax[InventoryLot])
}

// UpdateInventory edits a lot's cost basis and storage location.
func (s *Store) UpdateInventory(ctx context.Context, grade string, costPerKg float64, location string) (InventoryLot, error) {
	rows, err := s.pool.Query(ctx,
		`UPDATE inventory_lots SET cost_per_kg=$2, location=COALESCE(NULLIF($3,''), location) WHERE grade=$1
		 RETURNING grade, bulk_kg, bags, location, avg_moisture, cost_per_kg`, grade, costPerKg, location)
	if err != nil {
		return InventoryLot{}, err
	}
	lot, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByNameLax[InventoryLot])
	if errors.Is(err, pgx.ErrNoRows) {
		return InventoryLot{}, ErrNotFound
	}
	return lot, err
}

// UpdateFarmer edits a farmer's profile fields.
func (s *Store) UpdateFarmer(ctx context.Context, id, name, village, phone, note string) (Farmer, error) {
	rows, err := s.pool.Query(ctx,
		`UPDATE farmers SET name=COALESCE(NULLIF($2,''), name), village=$3, phone=$4, note=$5 WHERE id=$1
		 RETURNING id, name, village, phone, note, created_at, 0::numeric AS balance`,
		id, name, village, phone, note)
	if err != nil {
		return Farmer{}, err
	}
	f, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByNameLax[Farmer])
	if errors.Is(err, pgx.ErrNoRows) {
		return Farmer{}, ErrNotFound
	}
	return f, err
}

// ─────────────────────────── scan helpers ───────────────────────────

// querier is satisfied by both *pgxpool.Pool and pgx.Tx.
type querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

func scanOneUser(ctx context.Context, q querier, sql string, args ...any) (User, error) {
	rows, err := q.Query(ctx, sql, args...)
	if err != nil {
		return User{}, err
	}
	return pgx.CollectExactlyOneRow(rows, pgx.RowToStructByNameLax[User])
}

func scanOneInvite(ctx context.Context, q querier, sql string, args ...any) (Invitation, error) {
	rows, err := q.Query(ctx, sql, args...)
	if err != nil {
		return Invitation{}, err
	}
	return pgx.CollectExactlyOneRow(rows, pgx.RowToStructByNameLax[Invitation])
}

func scanOneBatch(ctx context.Context, q querier, sql string, args ...any) (Batch, error) {
	rows, err := q.Query(ctx, sql, args...)
	if err != nil {
		return Batch{}, err
	}
	return pgx.CollectExactlyOneRow(rows, pgx.RowToStructByNameLax[Batch])
}

func scanOneChamber(ctx context.Context, q querier, sql string, args ...any) (Chamber, error) {
	rows, err := q.Query(ctx, sql, args...)
	if err != nil {
		return Chamber{}, err
	}
	return pgx.CollectExactlyOneRow(rows, pgx.RowToStructByNameLax[Chamber])
}

func scanOneIntake(ctx context.Context, q querier, sql string, args ...any) (IntakeReceipt, error) {
	rows, err := q.Query(ctx, sql, args...)
	if err != nil {
		return IntakeReceipt{}, err
	}
	return pgx.CollectExactlyOneRow(rows, pgx.RowToStructByNameLax[IntakeReceipt])
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
