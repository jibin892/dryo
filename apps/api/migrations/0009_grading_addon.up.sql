-- Grading is an optional paid add-on, charged per batch, separate from drying.
ALTER TABLE batches ADD COLUMN IF NOT EXISTS grading_charge numeric NOT NULL DEFAULT 0;
