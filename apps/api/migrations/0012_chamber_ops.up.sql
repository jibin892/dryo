-- Per-chamber run history (each batch's stay) and expense ledger, so a chamber
-- can report hours worked, batches completed, dried output, utilization and cost.

CREATE TABLE IF NOT EXISTS chamber_runs (
  id          text PRIMARY KEY,
  chamber_id  text NOT NULL,
  batch_id    text NOT NULL,
  lot_code    text NOT NULL DEFAULT '',
  farmer_name text NOT NULL DEFAULT '',
  green_kg    numeric NOT NULL DEFAULT 0,
  dried_kg    numeric,
  loaded_at   timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz
);
CREATE INDEX IF NOT EXISTS chamber_runs_chamber_idx ON chamber_runs (chamber_id);

CREATE TABLE IF NOT EXISTS chamber_expenses (
  id         text PRIMARY KEY,
  chamber_id text NOT NULL,
  amount     numeric NOT NULL DEFAULT 0,
  category   text NOT NULL DEFAULT '',
  note       text NOT NULL DEFAULT '',
  spent_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chamber_expenses_chamber_idx ON chamber_expenses (chamber_id);
