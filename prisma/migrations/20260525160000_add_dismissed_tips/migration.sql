-- Add per-user dismissed onboarding tip IDs
ALTER TABLE "User" ADD COLUMN "dismissedTips" JSONB NOT NULL DEFAULT '[]';
