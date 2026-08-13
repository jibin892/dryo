-- Settlement stamp: set once a batch reaches READY and its dried stock has been
-- posted to inventory (OWN) and/or the job-work charge billed to the farmer.
-- Guards the READY-transition posting against double-counting on re-advance.
ALTER TABLE batches ADD COLUMN IF NOT EXISTS settled_at timestamptz;
