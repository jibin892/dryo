-- Account lifecycle + invitations + permissions.

ALTER TABLE users ADD COLUMN IF NOT EXISTS status     text NOT NULL DEFAULT 'ACTIVE'; -- ACTIVE | PENDING | DISABLED
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS invitations (
  id          text PRIMARY KEY,
  email       text NOT NULL DEFAULT '',
  phone       text NOT NULL DEFAULT '',      -- E.164, e.g. +919847012345
  role        text NOT NULL DEFAULT 'OPERATOR', -- MANAGER | OPERATOR
  status      text NOT NULL DEFAULT 'PENDING',  -- PENDING | ACCEPTED | REVOKED
  invited_by  text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);

CREATE INDEX IF NOT EXISTS invitations_email_idx ON invitations (lower(email)) WHERE email <> '';
CREATE INDEX IF NOT EXISTS invitations_phone_idx ON invitations (phone)        WHERE phone <> '';
CREATE INDEX IF NOT EXISTS invitations_status_idx ON invitations (status);
