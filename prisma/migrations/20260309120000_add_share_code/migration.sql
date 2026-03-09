-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "shareCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_shareCode_key" ON "User"("shareCode");
