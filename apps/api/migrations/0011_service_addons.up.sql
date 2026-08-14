-- Paid service add-ons (e.g. Grading) with a central price. Priced either per kg
-- of the lot or as a flat charge. Applied to a batch on top of drying/curing.
CREATE TABLE IF NOT EXISTS service_addons (
  id         text PRIMARY KEY,
  name       text NOT NULL,
  rate       numeric NOT NULL DEFAULT 0,
  per_kg     boolean NOT NULL DEFAULT true,
  active     boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed the Grading add-on so it's ready to price out of the box.
INSERT INTO service_addons (id, name, rate, per_kg)
  VALUES ('addon-grading', 'Grading', 0, true)
  ON CONFLICT (id) DO NOTHING;
