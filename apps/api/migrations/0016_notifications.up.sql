-- House notification feed. Used to alert the owner when a manager/operator
-- records a lot or a farmer money movement, so the owner has oversight.
CREATE TABLE IF NOT EXISTS notifications (
  id         text PRIMARY KEY,
  title      text NOT NULL,
  body       text NOT NULL DEFAULT '',
  tone       text NOT NULL DEFAULT 'neutral',
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at    timestamptz
);
CREATE INDEX IF NOT EXISTS notifications_created_idx ON notifications (created_at DESC);
