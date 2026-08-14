-- Default green purchase rate (₹/kg) paid to farmers on own-purchase lots, so
-- New lot can pre-fill it. Sits alongside the default curing rate.
ALTER TABLE house_settings ADD COLUMN IF NOT EXISTS default_purchase_rate_per_kg numeric NOT NULL DEFAULT 0;
