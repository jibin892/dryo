-- Demo seed data (idempotent). Mirrors the web app's mock dataset.

INSERT INTO chambers (id, name, type, status, temp_c, target_temp_c, humidity, load_kg, capacity_kg, batch_id, elapsed_hours, cycle_hours) VALUES
  ('ch-1', 'Kiln A',           'FLUE_KILN',     'CURING', 52, 50, 34, 420, 500, 'bt-1042', 22, 28),
  ('ch-2', 'Kiln B',           'FLUE_KILN',     'DRYING', 58, 55, 48, 480, 500, 'bt-1043',  9, 26),
  ('ch-3', 'Electric Dryer 1', 'ELECTRIC',      'FAULT',  71, 55, 40, 300, 350, 'bt-1044',  6, 18),
  ('ch-4', 'Solar Bay',        'SOLAR_BIOMASS', 'IDLE',   31,  0, 62,   0, 400, NULL,       0, 24)
ON CONFLICT (id) DO NOTHING;

INSERT INTO batches (id, lot_code, farmer_name, village, green_weight_kg, dried_weight_kg, chamber_id, stage, started_at, target_moisture, current_moisture, grade, rate_per_kg, note) VALUES
  ('bt-1042', 'VDM-1042', 'Joy Mathew',      'Anakkara',    420, NULL, 'ch-1', 'CURING',     '2026-08-10T06:20:00+05:30', 10, 12.4, NULL,   1180, 'Second-round pick, uniform green pods.'),
  ('bt-1043', 'VDM-1043', 'Ayesha Beevi',    'Puliyanmala', 480, NULL, 'ch-2', 'DRYING',     '2026-08-10T21:00:00+05:30', 10, 41,   NULL,   1220, NULL),
  ('bt-1044', 'VDM-1044', 'Estate — Block 7','Vandanmedu',  300, NULL, 'ch-3', 'DRYING',     '2026-08-11T00:10:00+05:30', 10, 33,   NULL,   1150, 'Over-temp alarm — check flue damper.'),
  ('bt-1045', 'VDM-1045', 'Salim Rawther',   'Nedumkandam', 260, NULL, NULL,   'INTAKE',     '2026-08-11T05:40:00+05:30', 10, 72,   NULL,   1090, NULL),
  ('bt-1041', 'VDM-1041', 'Joy Mathew',      'Anakkara',    400, 82,   NULL,   'GRADING',    '2026-08-09T04:00:00+05:30', 10, 9.6,  'AGEB', 1180, NULL),
  ('bt-1039', 'VDM-1039', 'Ayesha Beevi',    'Puliyanmala', 520, 104,  NULL,   'READY',      '2026-08-08T05:30:00+05:30', 10, 9.2,  'AGB',  1220, NULL),
  ('bt-1036', 'VDM-1036', 'Estate — Block 3','Vandanmedu',  610, 121,  NULL,   'DISPATCHED', '2026-08-06T05:00:00+05:30', 10, 9.0,  'AGEB', 1240, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO intake_receipts (id, farmer_name, village, weight_kg, moisture_pct, rate_per_kg, received_at, status) VALUES
  ('in-501', 'Salim Rawther',   'Nedumkandam', 260, 72, 1090, '2026-08-11T05:40:00+05:30', 'PENDING'),
  ('in-502', 'Leela Varghese',  'Kattappana',  180, 74, 1075, '2026-08-11T07:05:00+05:30', 'PENDING'),
  ('in-500', 'Joy Mathew',      'Anakkara',    420, 71, 1180, '2026-08-10T06:10:00+05:30', 'LOADED')
ON CONFLICT (id) DO NOTHING;

INSERT INTO inventory_lots (grade, bulk_kg, bags, location, avg_moisture) VALUES
  ('AGEB', 340, 17, 'Store A · Rack 1', 9.4),
  ('AGB',  218, 11, 'Store A · Rack 2', 9.6),
  ('AGS',   96,  5, 'Store B · Rack 1', 9.8),
  ('AGES',  42,  3, 'Store B · Rack 2', 10.1),
  ('REJECT',28,  2, 'Store B · Bin',    11.5)
ON CONFLICT (grade) DO NOTHING;
