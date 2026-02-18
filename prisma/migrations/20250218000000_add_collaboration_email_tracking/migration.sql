-- Add email tracking fields to CollaborativeMember
ALTER TABLE "CollaborativeMember"
  ADD COLUMN IF NOT EXISTS "emailSent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "emailSentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "emailError" TEXT;

-- Add EMAIL_RESENT to CollaborationAction enum
ALTER TYPE "CollaborationAction" ADD VALUE IF NOT EXISTS 'EMAIL_RESENT';
