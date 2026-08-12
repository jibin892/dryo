-- Dryo schema — PostgreSQL 18
-- Cardamom dryer & curing house ERP.

CREATE TABLE IF NOT EXISTS users (
  uid          text PRIMARY KEY,
  display_name text NOT NULL DEFAULT '',
  phone        text NOT NULL DEFAULT '',
  email        text NOT NULL DEFAULT '',
  role         text NOT NULL DEFAULT 'OPERATOR',
  house_name   text NOT NULL DEFAULT 'Vandanmedu Curing House',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chambers (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  type          text NOT NULL,               -- FLUE_KILN | ELECTRIC | SOLAR_BIOMASS
  status        text NOT NULL DEFAULT 'IDLE',-- IDLE|HEATING|DRYING|CURING|COOLING|FAULT
  temp_c        numeric NOT NULL DEFAULT 0,
  target_temp_c numeric NOT NULL DEFAULT 0,
  humidity      numeric NOT NULL DEFAULT 0,
  load_kg       numeric NOT NULL DEFAULT 0,
  capacity_kg   numeric NOT NULL,
  batch_id      text,
  elapsed_hours numeric NOT NULL DEFAULT 0,
  cycle_hours   numeric NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS batches (
  id               text PRIMARY KEY,
  lot_code         text NOT NULL,
  farmer_name      text NOT NULL,
  village          text NOT NULL DEFAULT '',
  green_weight_kg  numeric NOT NULL,
  dried_weight_kg  numeric,
  chamber_id       text REFERENCES chambers(id) ON DELETE SET NULL,
  stage            text NOT NULL DEFAULT 'INTAKE', -- INTAKE|DRYING|CURING|GRADING|READY|DISPATCHED
  started_at       timestamptz NOT NULL DEFAULT now(),
  target_moisture  numeric NOT NULL DEFAULT 10,
  current_moisture numeric NOT NULL,
  grade            text,                           -- AGEB|AGB|AGS|AGES|REJECT
  rate_per_kg      numeric NOT NULL DEFAULT 0,
  note             text
);
CREATE INDEX IF NOT EXISTS batches_stage_idx ON batches(stage);

CREATE TABLE IF NOT EXISTS intake_receipts (
  id           text PRIMARY KEY,
  farmer_name  text NOT NULL,
  village      text NOT NULL DEFAULT '',
  weight_kg    numeric NOT NULL,
  moisture_pct numeric NOT NULL,
  rate_per_kg  numeric NOT NULL DEFAULT 0,
  received_at  timestamptz NOT NULL DEFAULT now(),
  status       text NOT NULL DEFAULT 'PENDING'  -- PENDING | LOADED
);

CREATE TABLE IF NOT EXISTS inventory_lots (
  grade        text PRIMARY KEY,               -- AGEB|AGB|AGS|AGES|REJECT
  bulk_kg      numeric NOT NULL DEFAULT 0,
  bags         integer NOT NULL DEFAULT 0,
  location     text NOT NULL DEFAULT '',
  avg_moisture numeric NOT NULL DEFAULT 0
);
