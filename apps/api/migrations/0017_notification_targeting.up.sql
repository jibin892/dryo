-- Team activity feed: tag each notification with who did it, and track read
-- state per viewer so everyone sees everyone else's actions (not their own),
-- with an independent unread badge.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_uid text;

CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id text NOT NULL,
  uid             text NOT NULL,
  read_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, uid)
);
