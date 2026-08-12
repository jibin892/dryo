-- Phase 1 — business management: farmers, ledger, pricing, sales, job-work.

-- Farmers / suppliers
CREATE TABLE IF NOT EXISTS farmers (
  id         text PRIMARY KEY,
  name       text NOT NULL,
  village    text NOT NULL DEFAULT '',
  phone      text NOT NULL DEFAULT '',
  note       text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Farmer money ledger. `amount` is signed from the HOUSE's books:
--   +amount  → house owes the farmer (payable, e.g. green purchased)
--   -amount  → farmer owes the house (advance, curing charge, or payment made)
-- Net balance = SUM(amount): positive = still to pay the farmer.
CREATE TABLE IF NOT EXISTS farmer_transactions (
  id         text PRIMARY KEY,
  farmer_id  text NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  type       text NOT NULL,             -- PURCHASE | JOBWORK_CHARGE | ADVANCE | PAYMENT | ADJUSTMENT
  amount     numeric NOT NULL,
  note       text NOT NULL DEFAULT '',
  batch_id   text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS farmer_tx_farmer_idx ON farmer_transactions (farmer_id);

-- Per-grade selling price (one business account = this house).
CREATE TABLE IF NOT EXISTS grade_prices (
  grade            text PRIMARY KEY,          -- AGEB | AGB | AGS | AGES | REJECT
  sell_rate_per_kg numeric NOT NULL DEFAULT 0,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- House-wide settings (single row).
CREATE TABLE IF NOT EXISTS house_settings (
  id                         integer PRIMARY KEY DEFAULT 1,
  house_name                 text NOT NULL DEFAULT 'Vandanmedu Curing House',
  default_curing_rate_per_kg numeric NOT NULL DEFAULT 0,
  gst_number                 text NOT NULL DEFAULT '',
  CONSTRAINT house_settings_singleton CHECK (id = 1)
);

-- Sales / dispatch
CREATE TABLE IF NOT EXISTS sales (
  id          text PRIMARY KEY,
  buyer_name  text NOT NULL,
  channel     text NOT NULL DEFAULT 'DIRECT',  -- DIRECT | AUCTION
  grade       text NOT NULL,
  quantity_kg numeric NOT NULL,
  rate_per_kg numeric NOT NULL,
  amount      numeric NOT NULL,
  commission  numeric NOT NULL DEFAULT 0,
  batch_id    text,
  invoice_no  text NOT NULL DEFAULT '',
  note        text NOT NULL DEFAULT '',
  sold_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sales_sold_at_idx ON sales (sold_at DESC);

-- Ownership / job-work on batches and intake.
ALTER TABLE batches ADD COLUMN IF NOT EXISTS ownership          text NOT NULL DEFAULT 'OWN'; -- OWN | JOBWORK
ALTER TABLE batches ADD COLUMN IF NOT EXISTS farmer_id          text;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS curing_rate_per_kg numeric NOT NULL DEFAULT 0;

ALTER TABLE intake_receipts ADD COLUMN IF NOT EXISTS ownership          text NOT NULL DEFAULT 'OWN';
ALTER TABLE intake_receipts ADD COLUMN IF NOT EXISTS farmer_id          text;
ALTER TABLE intake_receipts ADD COLUMN IF NOT EXISTS curing_rate_per_kg numeric NOT NULL DEFAULT 0;
