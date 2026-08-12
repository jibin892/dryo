-- Chamber cycle timing + inventory cost basis.

ALTER TABLE chambers ADD COLUMN IF NOT EXISTS started_at timestamptz;

-- Backfill a start time for chambers already running, from elapsed hours.
UPDATE chambers
   SET started_at = now() - make_interval(hours => elapsed_hours::int)
 WHERE status <> 'IDLE' AND started_at IS NULL;

-- Cost basis for graded stock (₹/kg). Enables stock valuation + sale margin.
ALTER TABLE inventory_lots ADD COLUMN IF NOT EXISTS cost_per_kg numeric NOT NULL DEFAULT 0;
