-- AlterTable: add parentCode to User
ALTER TABLE "User" ADD COLUMN "parentCode" TEXT;

-- CreateIndex: unique constraint on parentCode
CREATE UNIQUE INDEX "User_parentCode_key" ON "User"("parentCode");
