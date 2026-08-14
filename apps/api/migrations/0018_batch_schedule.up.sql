-- Planned drying day for a lot that can't be loaded yet (all chambers full).
-- Stored as a plain YYYY-MM-DD string; NULL means unscheduled.
ALTER TABLE batches ADD COLUMN IF NOT EXISTS scheduled_for text;
