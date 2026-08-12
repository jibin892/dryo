-- Seed realistic cost basis (₹/kg) below the selling price so margins are positive.
UPDATE inventory_lots SET cost_per_kg = 2400 WHERE grade = 'AGEB'   AND cost_per_kg = 0;
UPDATE inventory_lots SET cost_per_kg = 2250 WHERE grade = 'AGB'    AND cost_per_kg = 0;
UPDATE inventory_lots SET cost_per_kg = 2050 WHERE grade = 'AGS'    AND cost_per_kg = 0;
UPDATE inventory_lots SET cost_per_kg = 1750 WHERE grade = 'AGES'   AND cost_per_kg = 0;
UPDATE inventory_lots SET cost_per_kg = 500  WHERE grade = 'REJECT' AND cost_per_kg = 0;
