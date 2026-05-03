-- Idempotent index creation
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'ChatMessage_senderUserId_createdAt_idx' AND n.nspname = 'public') THEN 
        CREATE INDEX "ChatMessage_senderUserId_createdAt_idx" ON "ChatMessage"("senderUserId", "createdAt");
    END IF; 
END $$;

-- Idempotent column addition example (if we were adding a column)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ChatMessage' AND column_name='idempotencyKey') THEN 
        ALTER TABLE "ChatMessage" ADD COLUMN "idempotencyKey" TEXT; 
    END IF; 
END $$;
