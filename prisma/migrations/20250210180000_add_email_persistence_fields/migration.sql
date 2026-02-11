-- AlterTable
ALTER TABLE IF EXISTS "EmailLog"
ADD COLUMN IF NOT EXISTS     "selectedSchoolNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS     "visibleColumnIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS     "customRecipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS     "recipientCategory" TEXT;
