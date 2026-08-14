-- Add-ons applied to a batch (Grading, Sorting, Packing, …). Each is a paid
-- post-drying service; its charge is computed on the dried weight at settlement
-- using the central add-on price. Stored as the set of add-on ids on the batch.
ALTER TABLE batches ADD COLUMN IF NOT EXISTS addon_ids text[] NOT NULL DEFAULT '{}';
