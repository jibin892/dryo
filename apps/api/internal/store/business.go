package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// ─────────────────────────── models ───────────────────────────

type Farmer struct {
	ID        string    `json:"id"        db:"id"`
	Name      string    `json:"name"      db:"name"`
	Village   string    `json:"village"   db:"village"`
	Phone     string    `json:"phone"     db:"phone"`
	Note      string    `json:"note"      db:"note"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	Balance   float64   `json:"balance"   db:"balance"` // + = house owes farmer
}

type FarmerTransaction struct {
	ID        string    `json:"id"        db:"id"`
	FarmerID  string    `json:"farmerId"  db:"farmer_id"`
	Type      string    `json:"type"      db:"type"`
	Amount    float64   `json:"amount"    db:"amount"`
	Note      string    `json:"note"      db:"note"`
	BatchID   *string   `json:"batchId"   db:"batch_id"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
}

type GradePrice struct {
	Grade         string    `json:"grade"         db:"grade"`
	SellRatePerKg float64   `json:"sellRatePerKg" db:"sell_rate_per_kg"`
	CostRatePerKg float64   `json:"costRatePerKg" db:"cost_rate_per_kg"`
	YieldRatio    float64   `json:"yieldRatio"    db:"yield_ratio"`
	UpdatedAt     time.Time `json:"updatedAt"     db:"updated_at"`
}

type ServiceAddon struct {
	ID        string    `json:"id"        db:"id"`
	Name      string    `json:"name"      db:"name"`
	Rate      float64   `json:"rate"      db:"rate"`
	PerKg     bool      `json:"perKg"     db:"per_kg"`
	Active    bool      `json:"active"    db:"active"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
}

type HouseSettings struct {
	HouseName                string  `json:"houseName"                db:"house_name"`
	DefaultCuringRatePerKg   float64 `json:"defaultCuringRatePerKg"   db:"default_curing_rate_per_kg"`
	DefaultPurchaseRatePerKg float64 `json:"defaultPurchaseRatePerKg" db:"default_purchase_rate_per_kg"`
	GSTNumber                string  `json:"gstNumber"                db:"gst_number"`
}

type Sale struct {
	ID         string    `json:"id"         db:"id"`
	BuyerName  string    `json:"buyerName"  db:"buyer_name"`
	Channel    string    `json:"channel"    db:"channel"`
	Grade      string    `json:"grade"      db:"grade"`
	QuantityKg float64   `json:"quantityKg" db:"quantity_kg"`
	RatePerKg  float64   `json:"ratePerKg"  db:"rate_per_kg"`
	Amount     float64   `json:"amount"     db:"amount"`
	Commission float64   `json:"commission" db:"commission"`
	BatchID    *string   `json:"batchId"    db:"batch_id"`
	InvoiceNo  string    `json:"invoiceNo"  db:"invoice_no"`
	Note       string    `json:"note"       db:"note"`
	SoldAt     time.Time `json:"soldAt"     db:"sold_at"`
}

type ReportSummary struct {
	ActiveBatches    int     `json:"activeBatches"`
	ReadyKg          float64 `json:"readyKg"`
	StoreKg          float64 `json:"storeKg"`
	SalesTotal       float64 `json:"salesTotal"`
	SalesCount       int     `json:"salesCount"`
	Payables         float64 `json:"payables"`
	Receivables      float64 `json:"receivables"`
	AvgYieldPct      float64 `json:"avgYieldPct"`
	StockValueAtCost float64 `json:"stockValueAtCost"`
	GreenInKg        float64 `json:"greenInKg"`      // date-scoped
	ExpenseTotal     float64 `json:"expenseTotal"`   // date-scoped
}

// ─────────────────────────── farmers ───────────────────────────

const farmerCols = `f.id, f.name, f.village, f.phone, f.note, f.created_at,
	COALESCE((SELECT SUM(t.amount) FROM farmer_transactions t WHERE t.farmer_id = f.id), 0) AS balance`

func (s *Store) ListFarmers(ctx context.Context) ([]Farmer, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+farmerCols+` FROM farmers f ORDER BY f.name ASC`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByNameLax[Farmer])
}

func (s *Store) GetFarmer(ctx context.Context, id string) (Farmer, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+farmerCols+` FROM farmers f WHERE f.id=$1`, id)
	if err != nil {
		return Farmer{}, err
	}
	f, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByNameLax[Farmer])
	if errors.Is(err, pgx.ErrNoRows) {
		return Farmer{}, ErrNotFound
	}
	return f, err
}

func (s *Store) CreateFarmer(ctx context.Context, f Farmer) (Farmer, error) {
	if f.ID == "" {
		f.ID = newID("fm")
	}
	rows, err := s.pool.Query(ctx,
		`INSERT INTO farmers (id, name, village, phone, note) VALUES ($1,$2,$3,$4,$5)
		 RETURNING id, name, village, phone, note, created_at, 0::numeric AS balance`,
		f.ID, f.Name, f.Village, f.Phone, f.Note)
	if err != nil {
		return Farmer{}, err
	}
	return pgx.CollectExactlyOneRow(rows, pgx.RowToStructByNameLax[Farmer])
}

func (s *Store) ListFarmerTransactions(ctx context.Context, farmerID string) ([]FarmerTransaction, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, farmer_id, type, amount, note, batch_id, created_at
		 FROM farmer_transactions WHERE farmer_id=$1 ORDER BY created_at DESC`, farmerID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByNameLax[FarmerTransaction])
}

// AddFarmerTransaction inserts a signed ledger entry. `amount` must already be
// signed by the caller (+ house owes farmer, - farmer owes house).
func (s *Store) AddFarmerTransaction(ctx context.Context, t FarmerTransaction) (FarmerTransaction, error) {
	if t.ID == "" {
		t.ID = newID("ftx")
	}
	rows, err := s.pool.Query(ctx,
		`INSERT INTO farmer_transactions (id, farmer_id, type, amount, note, batch_id)
		 VALUES ($1,$2,$3,$4,$5,$6)
		 RETURNING id, farmer_id, type, amount, note, batch_id, created_at`,
		t.ID, t.FarmerID, t.Type, t.Amount, t.Note, t.BatchID)
	if err != nil {
		return FarmerTransaction{}, err
	}
	return pgx.CollectExactlyOneRow(rows, pgx.RowToStructByNameLax[FarmerTransaction])
}

// ListFarmerBatches returns every lot recorded under a farmer, newest first.
func (s *Store) ListFarmerBatches(ctx context.Context, farmerID string) ([]Batch, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+batchCols+` FROM batches WHERE farmer_id=$1 ORDER BY started_at DESC`, farmerID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByNameLax[Batch])
}

// SetBatchPaid marks a batch's money settled or not. Marking paid posts an
// offsetting PAYMENT for the batch's ledger amount (so the farmer balance zeroes
// for that lot); un-marking removes it. Idempotent.
func (s *Store) SetBatchPaid(ctx context.Context, batchID string, paid bool) (Batch, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Batch{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	b, err := scanOneBatch(ctx, tx, `SELECT `+batchCols+` FROM batches WHERE id=$1 FOR UPDATE`, batchID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Batch{}, ErrNotFound
	} else if err != nil {
		return Batch{}, err
	}

	// Always clear any prior settlement first, so the toggle is idempotent.
	if _, err := tx.Exec(ctx, `DELETE FROM farmer_transactions WHERE batch_id=$1 AND type='PAYMENT'`, batchID); err != nil {
		return Batch{}, err
	}
	if paid && b.FarmerID != nil && *b.FarmerID != "" {
		var owed float64
		if err := tx.QueryRow(ctx,
			`SELECT COALESCE(SUM(amount),0) FROM farmer_transactions WHERE batch_id=$1 AND type <> 'PAYMENT'`, batchID).Scan(&owed); err != nil {
			return Batch{}, err
		}
		if owed != 0 {
			if _, err := tx.Exec(ctx,
				`INSERT INTO farmer_transactions (id, farmer_id, type, amount, note, batch_id) VALUES ($1,$2,'PAYMENT',$3,$4,$5)`,
				newID("ftx"), *b.FarmerID, -owed, "Settled · "+b.LotCode, batchID); err != nil {
				return Batch{}, err
			}
		}
	}

	out, err := scanOneBatch(ctx, tx, `UPDATE batches SET paid=$2 WHERE id=$1 RETURNING `+batchCols, batchID, paid)
	if err != nil {
		return Batch{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Batch{}, err
	}
	return out, nil
}

// ─────────────────────────── pricing & settings ───────────────────────────

const gradePriceCols = `grade, sell_rate_per_kg, cost_rate_per_kg, yield_ratio, updated_at`

func (s *Store) ListGradePrices(ctx context.Context) ([]GradePrice, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+gradePriceCols+` FROM grade_prices ORDER BY sell_rate_per_kg DESC`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByNameLax[GradePrice])
}

func (s *Store) UpsertGradePrice(ctx context.Context, grade string, sell, cost, yieldRatio float64) (GradePrice, error) {
	rows, err := s.pool.Query(ctx,
		`INSERT INTO grade_prices (grade, sell_rate_per_kg, cost_rate_per_kg, yield_ratio, updated_at)
		 VALUES ($1,$2,$3,$4,now())
		 ON CONFLICT (grade) DO UPDATE SET
		   sell_rate_per_kg=EXCLUDED.sell_rate_per_kg,
		   cost_rate_per_kg=EXCLUDED.cost_rate_per_kg,
		   yield_ratio=EXCLUDED.yield_ratio,
		   updated_at=now()
		 RETURNING `+gradePriceCols, grade, sell, cost, yieldRatio)
	if err != nil {
		return GradePrice{}, err
	}
	return pgx.CollectExactlyOneRow(rows, pgx.RowToStructByNameLax[GradePrice])
}

// ─────────────────────────── service add-ons ───────────────────────────

const addonCols = `id, name, rate, per_kg, active, updated_at`

func (s *Store) ListAddons(ctx context.Context) ([]ServiceAddon, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+addonCols+` FROM service_addons ORDER BY name ASC`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByNameLax[ServiceAddon])
}

func (s *Store) CreateAddon(ctx context.Context, name string, rate float64, perKg bool) (ServiceAddon, error) {
	rows, err := s.pool.Query(ctx,
		`INSERT INTO service_addons (id, name, rate, per_kg) VALUES ($1,$2,$3,$4)
		 RETURNING `+addonCols, newID("addon"), name, rate, perKg)
	if err != nil {
		return ServiceAddon{}, err
	}
	return pgx.CollectExactlyOneRow(rows, pgx.RowToStructByNameLax[ServiceAddon])
}

func (s *Store) UpdateAddon(ctx context.Context, id, name string, rate float64, perKg, active bool) (ServiceAddon, error) {
	rows, err := s.pool.Query(ctx,
		`UPDATE service_addons SET name=COALESCE(NULLIF($2,''), name), rate=$3, per_kg=$4, active=$5, updated_at=now()
		 WHERE id=$1 RETURNING `+addonCols, id, name, rate, perKg, active)
	if err != nil {
		return ServiceAddon{}, err
	}
	a, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByNameLax[ServiceAddon])
	if errors.Is(err, pgx.ErrNoRows) {
		return ServiceAddon{}, ErrNotFound
	}
	return a, err
}

func (s *Store) DeleteAddon(ctx context.Context, id string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM service_addons WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) GetSettings(ctx context.Context) (HouseSettings, error) {
	rows, err := s.pool.Query(ctx,
		`INSERT INTO house_settings (id) VALUES (1) ON CONFLICT (id) DO UPDATE SET id=1
		 RETURNING house_name, default_curing_rate_per_kg, default_purchase_rate_per_kg, gst_number`)
	if err != nil {
		return HouseSettings{}, err
	}
	return pgx.CollectExactlyOneRow(rows, pgx.RowToStructByNameLax[HouseSettings])
}

func (s *Store) UpdateSettings(ctx context.Context, hs HouseSettings) (HouseSettings, error) {
	rows, err := s.pool.Query(ctx,
		`UPDATE house_settings SET house_name=$1, default_curing_rate_per_kg=$2, default_purchase_rate_per_kg=$3, gst_number=$4 WHERE id=1
		 RETURNING house_name, default_curing_rate_per_kg, default_purchase_rate_per_kg, gst_number`,
		hs.HouseName, hs.DefaultCuringRatePerKg, hs.DefaultPurchaseRatePerKg, hs.GSTNumber)
	if err != nil {
		return HouseSettings{}, err
	}
	return pgx.CollectExactlyOneRow(rows, pgx.RowToStructByNameLax[HouseSettings])
}

// ─────────────────────────── sales ───────────────────────────

const saleCols = `id, buyer_name, channel, grade, quantity_kg, rate_per_kg, amount, commission,
	batch_id, invoice_no, note, sold_at`

func (s *Store) ListSales(ctx context.Context) ([]Sale, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+saleCols+` FROM sales ORDER BY sold_at DESC`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByNameLax[Sale])
}

// CreateSale records a sale and draws the quantity down from graded inventory
// (never below zero) in one transaction.
func (s *Store) CreateSale(ctx context.Context, sale Sale) (Sale, error) {
	if sale.ID == "" {
		sale.ID = newID("sl")
	}
	if sale.Amount == 0 {
		sale.Amount = sale.QuantityKg * sale.RatePerKg
	}
	if sale.Channel == "" {
		sale.Channel = "DIRECT"
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Sale{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	if _, err := tx.Exec(ctx,
		`UPDATE inventory_lots SET bulk_kg = GREATEST(0, bulk_kg - $2) WHERE grade=$1`,
		sale.Grade, sale.QuantityKg); err != nil {
		return Sale{}, err
	}

	rows, err := tx.Query(ctx,
		`INSERT INTO sales (id, buyer_name, channel, grade, quantity_kg, rate_per_kg, amount, commission, batch_id, invoice_no, note)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING `+saleCols,
		sale.ID, sale.BuyerName, sale.Channel, sale.Grade, sale.QuantityKg, sale.RatePerKg,
		sale.Amount, sale.Commission, sale.BatchID, sale.InvoiceNo, sale.Note)
	if err != nil {
		return Sale{}, err
	}
	out, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByNameLax[Sale])
	if err != nil {
		return Sale{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Sale{}, err
	}
	return out, nil
}

// ─────────────────────────── reports ───────────────────────────

// ReportSummary rolls up the house. Flow metrics (sales, green-in, expenses) are
// scoped to [from, to); stock/payable metrics are always current (point-in-time).
func (s *Store) ReportSummary(ctx context.Context, from, to time.Time) (ReportSummary, error) {
	var r ReportSummary
	q := `
		SELECT
			(SELECT count(*) FROM batches WHERE stage IN ('DRYING','CURING')),
			(SELECT COALESCE(SUM(dried_weight_kg),0) FROM batches WHERE stage='READY'),
			(SELECT COALESCE(SUM(bulk_kg),0) FROM inventory_lots),
			(SELECT COALESCE(SUM(amount),0) FROM sales WHERE sold_at >= $1 AND sold_at < $2),
			(SELECT count(*) FROM sales WHERE sold_at >= $1 AND sold_at < $2),
			(SELECT COALESCE(SUM(bal),0) FROM (SELECT SUM(amount) bal FROM farmer_transactions GROUP BY farmer_id HAVING SUM(amount) > 0) p),
			(SELECT COALESCE(-SUM(bal),0) FROM (SELECT SUM(amount) bal FROM farmer_transactions GROUP BY farmer_id HAVING SUM(amount) < 0) n),
			(SELECT COALESCE(AVG(dried_weight_kg / NULLIF(green_weight_kg,0)) * 100, 0) FROM batches WHERE dried_weight_kg IS NOT NULL),
			(SELECT COALESCE(SUM(bulk_kg * cost_per_kg), 0) FROM inventory_lots),
			(SELECT COALESCE(SUM(green_weight_kg),0) FROM batches WHERE started_at >= $1 AND started_at < $2),
			(SELECT COALESCE(SUM(amount),0) FROM chamber_expenses WHERE spent_at >= $1 AND spent_at < $2)
	`
	err := s.pool.QueryRow(ctx, q, from, to).Scan(
		&r.ActiveBatches, &r.ReadyKg, &r.StoreKg, &r.SalesTotal, &r.SalesCount,
		&r.Payables, &r.Receivables, &r.AvgYieldPct, &r.StockValueAtCost, &r.GreenInKg, &r.ExpenseTotal)
	return r, err
}
