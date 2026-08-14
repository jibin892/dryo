-- Payment status per batch: whether the money for this lot has been settled with
-- the farmer (paid to them for own-purchase, or collected from them for job-work).
ALTER TABLE batches ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT false;
