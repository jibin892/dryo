package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
)

// ErrInUse is returned when a guarded delete is blocked by dependents.
var ErrInUse = errors.New("in use")

// ─────────────────────────── Chambers ───────────────────────────

// ChamberPatch carries optional chamber edits; nil fields are left unchanged.
type ChamberPatch struct {
	Name        *string
	Type        *string
	CapacityKg  *float64
	TargetTempC *float64
	CycleHours  *float64
}

func (s *Store) UpdateChamber(ctx context.Context, id string, p ChamberPatch) (Chamber, error) {
	c, err := s.GetChamber(ctx, id)
	if err != nil {
		return Chamber{}, err
	}
	if p.Name != nil {
		c.Name = *p.Name
	}
	if p.Type != nil && *p.Type != "" {
		c.Type = *p.Type
	}
	if p.CapacityKg != nil {
		c.CapacityKg = *p.CapacityKg
	}
	if p.TargetTempC != nil {
		c.TargetTempC = *p.TargetTempC
	}
	if p.CycleHours != nil {
		c.CycleHours = *p.CycleHours
	}
	return scanOneChamber(ctx, s.pool,
		`UPDATE chambers SET name=$2, type=$3, capacity_kg=$4, target_temp_c=$5, cycle_hours=$6
		 WHERE id=$1 RETURNING `+chamberCols,
		id, c.Name, c.Type, c.CapacityKg, c.TargetTempC, c.CycleHours)
}

// DeleteChamber removes a chamber (and its run/expense logs). Blocked while a
// batch is loaded or it is powered on.
func (s *Store) DeleteChamber(ctx context.Context, id string) error {
	c, err := s.GetChamber(ctx, id)
	if err != nil {
		return err
	}
	if (c.BatchID != nil && *c.BatchID != "") || c.Status != "IDLE" {
		return fmt.Errorf("%w: chamber is running or has a batch loaded", ErrInUse)
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	if _, err := tx.Exec(ctx, `DELETE FROM chamber_runs WHERE chamber_id=$1`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM chamber_expenses WHERE chamber_id=$1`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM chambers WHERE id=$1`, id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// ─────────────────────────── Grade prices ───────────────────────────

// DeleteGradePrice removes a grade from the rate card. Blocked while stock of
// that grade is still on hand.
func (s *Store) DeleteGradePrice(ctx context.Context, grade string) error {
	var bulk float64
	if err := s.pool.QueryRow(ctx, `SELECT COALESCE(SUM(bulk_kg),0) FROM inventory_lots WHERE grade=$1`, grade).Scan(&bulk); err != nil {
		return err
	}
	if bulk > 0 {
		return fmt.Errorf("%w: %.0f kg of %s still in stock", ErrInUse, bulk, grade)
	}
	tag, err := s.pool.Exec(ctx, `DELETE FROM grade_prices WHERE grade=$1`, grade)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ─────────────────────────── Inventory / stock ───────────────────────────

// UpsertInventory sets a grade's stock line (manual add / correction).
func (s *Store) UpsertInventory(ctx context.Context, l InventoryLot) (InventoryLot, error) {
	rows, err := s.pool.Query(ctx,
		`INSERT INTO inventory_lots (grade, bulk_kg, bags, location, avg_moisture, cost_per_kg)
		 VALUES ($1,$2,$3,$4,$5,$6)
		 ON CONFLICT (grade) DO UPDATE SET
		   bulk_kg=EXCLUDED.bulk_kg, bags=EXCLUDED.bags,
		   location=COALESCE(NULLIF(EXCLUDED.location,''), inventory_lots.location),
		   avg_moisture=EXCLUDED.avg_moisture, cost_per_kg=EXCLUDED.cost_per_kg
		 RETURNING grade, bulk_kg, bags, location, avg_moisture, cost_per_kg`,
		l.Grade, l.BulkKg, l.Bags, l.Location, l.AvgMoisture, l.CostPerKg)
	if err != nil {
		return InventoryLot{}, err
	}
	return pgx.CollectExactlyOneRow(rows, pgx.RowToStructByNameLax[InventoryLot])
}

func (s *Store) DeleteInventory(ctx context.Context, grade string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM inventory_lots WHERE grade=$1`, grade)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ─────────────────────────── Farmers ───────────────────────────

// DeleteFarmer removes a farmer and their ledger. Blocked while lots exist under
// them (delete/reassign those first).
func (s *Store) DeleteFarmer(ctx context.Context, id string) error {
	var lots int
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM batches WHERE farmer_id=$1`, id).Scan(&lots); err != nil {
		return err
	}
	if lots > 0 {
		return fmt.Errorf("%w: %d lot(s) still recorded under this farmer", ErrInUse, lots)
	}
	tag, err := s.pool.Exec(ctx, `DELETE FROM farmers WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ─────────────────────────── Batches ───────────────────────────

// DeleteBatch removes a lot created in error, reversing its ledger entries,
// freeing its chamber and clearing its run log. Blocked once the batch is
// settled (stock/charges already booked at READY).
func (s *Store) DeleteBatch(ctx context.Context, id string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	b, err := scanOneBatch(ctx, tx, `SELECT `+batchCols+` FROM batches WHERE id=$1 FOR UPDATE`, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	} else if err != nil {
		return err
	}
	if b.SettledAt != nil {
		return fmt.Errorf("%w: lot is finished/settled — its stock and charges are already booked", ErrInUse)
	}
	if b.ChamberID != nil && *b.ChamberID != "" {
		if _, err := tx.Exec(ctx, `UPDATE chambers SET status='IDLE', batch_id=NULL, load_kg=0 WHERE id=$1`, *b.ChamberID); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(ctx, `DELETE FROM chamber_runs WHERE batch_id=$1`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM farmer_transactions WHERE batch_id=$1`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM batches WHERE id=$1`, id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// ─────────────────────────── Sales ───────────────────────────

// DeleteSale removes a sale and returns its quantity to stock.
func (s *Store) DeleteSale(ctx context.Context, id string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var grade string
	var qty float64
	err = tx.QueryRow(ctx, `SELECT grade, quantity_kg FROM sales WHERE id=$1`, id).Scan(&grade, &qty)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	} else if err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE inventory_lots SET bulk_kg = bulk_kg + $2 WHERE grade=$1`, grade, qty); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM sales WHERE id=$1`, id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
