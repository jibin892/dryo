package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

// ChamberRun logs one batch's stay in a chamber (loaded → released).
type ChamberRun struct {
	ID         string     `json:"id"         db:"id"`
	ChamberID  string     `json:"chamberId"  db:"chamber_id"`
	BatchID    string     `json:"batchId"    db:"batch_id"`
	LotCode    string     `json:"lotCode"    db:"lot_code"`
	FarmerName string     `json:"farmerName" db:"farmer_name"`
	GreenKg    float64    `json:"greenKg"    db:"green_kg"`
	DriedKg    *float64   `json:"driedKg"    db:"dried_kg"`
	LoadedAt   time.Time  `json:"loadedAt"   db:"loaded_at"`
	ReleasedAt *time.Time `json:"releasedAt" db:"released_at"`
}

// ChamberExpense is a cost booked against a chamber (electricity, firewood, etc).
type ChamberExpense struct {
	ID        string    `json:"id"        db:"id"`
	ChamberID string    `json:"chamberId" db:"chamber_id"`
	Amount    float64   `json:"amount"    db:"amount"`
	Category  string    `json:"category"  db:"category"`
	Note      string    `json:"note"      db:"note"`
	SpentAt   time.Time `json:"spentAt"   db:"spent_at"`
}

// ChamberStats is the lifetime rollup for a chamber.
type ChamberStats struct {
	TotalRunHours    float64 `json:"totalRunHours"`
	BatchesCompleted int     `json:"batchesCompleted"`
	BatchesTotal     int     `json:"batchesTotal"`
	GreenProcessedKg float64 `json:"greenProcessedKg"`
	DriedProducedKg  float64 `json:"driedProducedKg"`
	AvgYieldPct      float64 `json:"avgYieldPct"`
	ExpenseTotal     float64 `json:"expenseTotal"`
	LoadPct          float64 `json:"loadPct"`
}

// ChamberDetailData bundles everything the chamber detail screen needs.
type ChamberDetailData struct {
	Chamber  Chamber          `json:"chamber"`
	Stats    ChamberStats     `json:"stats"`
	Runs     []ChamberRun     `json:"runs"`
	Expenses []ChamberExpense `json:"expenses"`
}

const runCols = `id, chamber_id, batch_id, lot_code, farmer_name, green_kg, dried_kg, loaded_at, released_at`

// openChamberRun starts a run log when a batch enters a chamber. Any dangling
// open run for the same batch is closed first (defensive against re-loads).
func openChamberRun(ctx context.Context, tx pgx.Tx, chamberID string, b Batch) error {
	if _, err := tx.Exec(ctx,
		`UPDATE chamber_runs SET released_at=now() WHERE batch_id=$1 AND released_at IS NULL`, b.ID); err != nil {
		return err
	}
	_, err := tx.Exec(ctx,
		`INSERT INTO chamber_runs (id, chamber_id, batch_id, lot_code, farmer_name, green_kg)
		 VALUES ($1,$2,$3,$4,$5,$6)`,
		newID("run"), chamberID, b.ID, b.LotCode, b.FarmerName, b.GreenWeightKg)
	return err
}

// closeChamberRun ends the open run for a batch, stamping released time and the
// dried output known at that point.
func closeChamberRun(ctx context.Context, tx pgx.Tx, batchID string, dried *float64) error {
	_, err := tx.Exec(ctx,
		`UPDATE chamber_runs SET released_at=now(), dried_kg=$2 WHERE batch_id=$1 AND released_at IS NULL`,
		batchID, dried)
	return err
}

// ── expenses ──

const expenseCols = `id, chamber_id, amount, category, note, spent_at`

func (s *Store) ListChamberExpenses(ctx context.Context, chamberID string) ([]ChamberExpense, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+expenseCols+` FROM chamber_expenses WHERE chamber_id=$1 ORDER BY spent_at DESC`, chamberID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByNameLax[ChamberExpense])
}

func (s *Store) AddChamberExpense(ctx context.Context, e ChamberExpense) (ChamberExpense, error) {
	if e.ID == "" {
		e.ID = newID("cex")
	}
	rows, err := s.pool.Query(ctx,
		`INSERT INTO chamber_expenses (id, chamber_id, amount, category, note)
		 VALUES ($1,$2,$3,$4,$5) RETURNING `+expenseCols,
		e.ID, e.ChamberID, e.Amount, e.Category, e.Note)
	if err != nil {
		return ChamberExpense{}, err
	}
	return pgx.CollectExactlyOneRow(rows, pgx.RowToStructByNameLax[ChamberExpense])
}

// ── detail rollup ──

func (s *Store) GetChamberDetail(ctx context.Context, id string) (ChamberDetailData, error) {
	chamber, err := s.GetChamber(ctx, id)
	if err != nil {
		return ChamberDetailData{}, err
	}

	runsRows, err := s.pool.Query(ctx,
		`SELECT `+runCols+` FROM chamber_runs WHERE chamber_id=$1 ORDER BY loaded_at DESC LIMIT 50`, id)
	if err != nil {
		return ChamberDetailData{}, err
	}
	runs, err := pgx.CollectRows(runsRows, pgx.RowToStructByNameLax[ChamberRun])
	if err != nil {
		return ChamberDetailData{}, err
	}

	expenses, err := s.ListChamberExpenses(ctx, id)
	if err != nil {
		return ChamberDetailData{}, err
	}

	var stats ChamberStats
	err = s.pool.QueryRow(ctx, `
		SELECT
			COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(released_at, now()) - loaded_at)))/3600.0, 0),
			COUNT(*) FILTER (WHERE released_at IS NOT NULL),
			COUNT(*),
			COALESCE(SUM(green_kg), 0),
			COALESCE(SUM(dried_kg), 0),
			COALESCE(AVG(dried_kg / NULLIF(green_kg,0)) FILTER (WHERE dried_kg IS NOT NULL) * 100, 0)
		FROM chamber_runs WHERE chamber_id=$1`, id).Scan(
		&stats.TotalRunHours, &stats.BatchesCompleted, &stats.BatchesTotal,
		&stats.GreenProcessedKg, &stats.DriedProducedKg, &stats.AvgYieldPct)
	if err != nil {
		return ChamberDetailData{}, err
	}
	for _, e := range expenses {
		stats.ExpenseTotal += e.Amount
	}
	if chamber.CapacityKg > 0 {
		stats.LoadPct = chamber.LoadKg / chamber.CapacityKg * 100
	}

	return ChamberDetailData{Chamber: chamber, Stats: stats, Runs: runs, Expenses: expenses}, nil
}
