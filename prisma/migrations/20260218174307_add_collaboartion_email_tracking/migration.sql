-- Create CollaborativeRole enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CollaborativeRole') THEN
        CREATE TYPE "CollaborativeRole" AS ENUM ('VIEWER', 'MEMBER');
    END IF;
END $$;
 
-- Create CollaborativeStatus enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CollaborativeStatus') THEN
        CREATE TYPE "CollaborativeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');
    END IF;
END $$;
 
-- Create CollaborationAction enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CollaborationAction') THEN
        CREATE TYPE "CollaborationAction" AS ENUM ('INVITE_CREATED', 'INVITE_ACCEPTED', 'INVITE_EXPIRED', 'MEMBER_REVOKED', 'EMAIL_RESENT');
    ELSE
        -- Add EMAIL_RESENT to existing enum
        ALTER TYPE "CollaborationAction" ADD VALUE IF NOT EXISTS 'EMAIL_RESENT';
    END IF;
END $$;
 
-- Create CollaborativeMember table if it doesn't exist
CREATE TABLE IF NOT EXISTS "CollaborativeMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "CollaborativeRole" NOT NULL DEFAULT 'VIEWER',
    "status" "CollaborativeStatus" NOT NULL DEFAULT 'PENDING',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "token" TEXT,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "emailSentAt" TIMESTAMP(3),
    "emailError" TEXT,
 
    CONSTRAINT "CollaborativeMember_pkey" PRIMARY KEY ("id")
);
 
-- Add unique constraint on token if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'CollaborativeMember_token_key'
    ) THEN
        CREATE UNIQUE INDEX "CollaborativeMember_token_key" ON "CollaborativeMember"("token");
    END IF;
END $$;
 
-- Add unique constraint on userId + email if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'CollaborativeMember_userId_email_key'
    ) THEN
        CREATE UNIQUE INDEX "CollaborativeMember_userId_email_key" ON "CollaborativeMember"("userId", "email");
    END IF;
END $$;
 
-- Add indexes if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'CollaborativeMember_userId_status_idx'
    ) THEN
        CREATE INDEX "CollaborativeMember_userId_status_idx" ON "CollaborativeMember"("userId", "status");
    END IF;
END $$;
 
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'CollaborativeMember_email_idx'
    ) THEN
        CREATE INDEX "CollaborativeMember_email_idx" ON "CollaborativeMember"("email");
    END IF;
END $$;
 
-- Add foreign key constraint if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'CollaborativeMember_userId_fkey'
        AND table_name = 'CollaborativeMember'
    ) THEN
        ALTER TABLE "CollaborativeMember" ADD CONSTRAINT "CollaborativeMember_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
 
-- Create CollaborationAuditLog table if it doesn't exist
CREATE TABLE IF NOT EXISTS "CollaborationAuditLog" (
    "id" TEXT NOT NULL,
    "action" "CollaborationAction" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "targetEmail" TEXT,
    "collaboratorId" TEXT,
    "role" "CollaborativeRole",
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 
    CONSTRAINT "CollaborationAuditLog_pkey" PRIMARY KEY ("id")
);
 
-- Add indexes for CollaborationAuditLog if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'CollaborationAuditLog_ownerId_createdAt_idx'
    ) THEN
        CREATE INDEX "CollaborationAuditLog_ownerId_createdAt_idx" ON "CollaborationAuditLog"("ownerId", "createdAt");
    END IF;
END $$;
 
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'CollaborationAuditLog_action_createdAt_idx'
    ) THEN
        CREATE INDEX "CollaborationAuditLog_action_createdAt_idx" ON "CollaborationAuditLog"("action", "createdAt");
    END IF;
END $$;