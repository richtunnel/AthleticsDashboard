-- Idempotent index creation for EmailRecipient
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'EmailRecipient_status_pending_retrying_idx' AND n.nspname = 'public') THEN 
        CREATE INDEX "EmailRecipient_status_pending_retrying_idx" ON "EmailRecipient"("status") WHERE "status" IN ('PENDING', 'RETRYING');
    END IF; 
END $$;

-- Idempotent column addition for Game
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Game' AND column_name='syncInProgress') THEN 
        ALTER TABLE "Game" ADD COLUMN "syncInProgress" BOOLEAN NOT NULL DEFAULT false; 
    END IF; 
END $$;
