-- AlterTable
ALTER TABLE "User" ADD COLUMN "assignedTeamId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_assignedTeamId_fkey" FOREIGN KEY ("assignedTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "User_assignedTeamId_idx" ON "User"("assignedTeamId");
