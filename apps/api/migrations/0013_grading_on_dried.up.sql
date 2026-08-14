-- Grading (and other add-ons) are post-drying services: the charge is computed
-- on the actual DRIED weight at grading time, not on green weight at intake.
-- A batch only opts in here; the price comes from the central Grading add-on and
-- the final grading_charge is stamped at settlement (READY).
ALTER TABLE batches ADD COLUMN IF NOT EXISTS grading_enabled boolean NOT NULL DEFAULT false;
