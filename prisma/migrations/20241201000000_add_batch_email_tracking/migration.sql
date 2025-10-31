-- Check if EmailLog table exists and create it if not
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'EmailLog') THEN
        -- Create EmailStatus enum if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmailStatus') THEN
            CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'BOUNCED');
        END IF;

        -- Create EmailLog table with all fields including batch tracking
        CREATE TABLE "EmailLog" (
            "id" TEXT NOT NULL,
            "to" TEXT[],
            "cc" TEXT[],
            "subject" TEXT NOT NULL,
            "body" TEXT NOT NULL,
            "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
            "sentAt" TIMESTAMP(3),
            "error" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "gameId" TEXT,
            "sentById" TEXT,
            "gameIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
            "groupId" TEXT,
            "campaignId" TEXT,
            "recipientCategory" TEXT,
            "additionalMessage" TEXT,

            CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
        );

        -- Create indexes
        CREATE INDEX "EmailLog_gameId_idx" ON "EmailLog"("gameId");
        CREATE INDEX "EmailLog_sentById_idx" ON "EmailLog"("sentById");
        CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");
        CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");

        -- Add foreign keys if Game and User tables exist
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'Game') THEN
            ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;

        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'User') THEN
            ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
    ELSE
        -- Table exists, add new columns if they don't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'EmailLog' AND column_name = 'gameIds') THEN
            ALTER TABLE "EmailLog" ADD COLUMN "gameIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'EmailLog' AND column_name = 'groupId') THEN
            ALTER TABLE "EmailLog" ADD COLUMN "groupId" TEXT;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'EmailLog' AND column_name = 'campaignId') THEN
            ALTER TABLE "EmailLog" ADD COLUMN "campaignId" TEXT;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'EmailLog' AND column_name = 'recipientCategory') THEN
            ALTER TABLE "EmailLog" ADD COLUMN "recipientCategory" TEXT;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'EmailLog' AND column_name = 'additionalMessage') THEN
            ALTER TABLE "EmailLog" ADD COLUMN "additionalMessage" TEXT;
        END IF;

        -- Create status index if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'EmailLog' AND indexname = 'EmailLog_status_idx') THEN
            CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");
        END IF;
    END IF;
END $$;
