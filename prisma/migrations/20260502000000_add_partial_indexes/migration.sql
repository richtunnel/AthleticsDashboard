-- Create partial index on EmailRecipient(status) for PENDING and RETRYING
CREATE INDEX "EmailRecipient_status_pending_retrying_idx" ON "EmailRecipient"("status") WHERE "status" IN ('PENDING', 'RETRYING');

-- Add syncInProgress to Game model
ALTER TABLE "Game" ADD COLUMN "syncInProgress" BOOLEAN NOT NULL DEFAULT false;
