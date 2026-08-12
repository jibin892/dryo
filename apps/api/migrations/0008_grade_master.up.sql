-- Make grade the master product: sell price + cost price + green→dried yield ratio.
ALTER TABLE grade_prices ADD COLUMN IF NOT EXISTS cost_rate_per_kg numeric NOT NULL DEFAULT 0;
ALTER TABLE grade_prices ADD COLUMN IF NOT EXISTS yield_ratio      numeric NOT NULL DEFAULT 0.20;

UPDATE grade_prices SET cost_rate_per_kg = 2400, yield_ratio = 0.22 WHERE grade = 'AGEB'   AND cost_rate_per_kg = 0;
UPDATE grade_prices SET cost_rate_per_kg = 2250, yield_ratio = 0.21 WHERE grade = 'AGB'    AND cost_rate_per_kg = 0;
UPDATE grade_prices SET cost_rate_per_kg = 2050, yield_ratio = 0.20 WHERE grade = 'AGS'    AND cost_rate_per_kg = 0;
UPDATE grade_prices SET cost_rate_per_kg = 1750, yield_ratio = 0.19 WHERE grade = 'AGES'   AND cost_rate_per_kg = 0;
UPDATE grade_prices SET cost_rate_per_kg = 500,  yield_ratio = 0.18 WHERE grade = 'REJECT' AND cost_rate_per_kg = 0;
