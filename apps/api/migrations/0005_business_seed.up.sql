-- Phase 1 demo seed (idempotent).

INSERT INTO house_settings (id, house_name, default_curing_rate_per_kg, gst_number) VALUES
  (1, 'Vandanmedu Curing House', 120, '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO grade_prices (grade, sell_rate_per_kg) VALUES
  ('AGEB', 3100),
  ('AGB',  2850),
  ('AGS',  2550),
  ('AGES', 2150),
  ('REJECT', 800)
ON CONFLICT (grade) DO NOTHING;

INSERT INTO farmers (id, name, village, phone, note) VALUES
  ('fm-1', 'Joy Mathew',     'Anakkara',    '+919847011111', 'Regular — second-round picks'),
  ('fm-2', 'Ayesha Beevi',   'Puliyanmala', '+919847022222', ''),
  ('fm-3', 'Salim Rawther',  'Nedumkandam', '+919847033333', 'Job-work only'),
  ('fm-4', 'Leela Varghese', 'Kattappana',  '+919847044444', '')
ON CONFLICT (id) DO NOTHING;

-- A couple of ledger entries so balances are non-trivial.
INSERT INTO farmer_transactions (id, farmer_id, type, amount, note, batch_id) VALUES
  ('ftx-1', 'fm-1', 'PURCHASE', 495600, 'Green 420 kg @ ₹1180', 'bt-1042'),
  ('ftx-2', 'fm-1', 'ADVANCE', -100000, 'Season advance', NULL),
  ('ftx-3', 'fm-3', 'JOBWORK_CHARGE', -31200, 'Curing 260 kg @ ₹120', 'bt-1044')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sales (id, buyer_name, channel, grade, quantity_kg, rate_per_kg, amount, commission, batch_id, invoice_no, sold_at) VALUES
  ('sl-1', 'Bodinayakanur Auction', 'AUCTION', 'AGEB', 121, 3080, 372680, 3727, 'bt-1036', 'INV-1036', '2026-08-10T16:20:00+05:30')
ON CONFLICT (id) DO NOTHING;
